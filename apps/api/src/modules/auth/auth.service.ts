import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UserService } from '../user/user.service';
import { DatabaseService } from '../../shared/database/database.service';
import { CacheService } from '../../shared/cache/cache.service';
import { RegisterDto, LoginDto, AuthResponseDto, TokenPair } from './dto';
import { UserResponseDto } from '../user/dto';
import { User } from '@prisma/client';
import {
  isObject,
  hasProperty,
  isString,
  isUUID,
  SafeParser,
} from '@ai-assistant/utils';

/**
 * JWT Payload interface
 */
interface JwtPayload {
  sub: string;
  email: string;
  role: string;
  type: 'access' | 'refresh';
}

/**
 * Enhanced type guard function using utils package
 */
function isValidJwtPayload(payload: unknown): payload is JwtPayload {
  return (
    isObject(payload) &&
    hasProperty(payload, 'sub') &&
    hasProperty(payload, 'email') &&
    hasProperty(payload, 'role') &&
    hasProperty(payload, 'type') &&
    isUUID(payload.sub) &&
    isString(payload.email) &&
    isString(payload.role) &&
    (payload.type === 'access' || payload.type === 'refresh')
  );
}

/**
 * Enhanced Auth Service với type safety
 */
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly REFRESH_TOKEN_CACHE_PREFIX = 'refresh_token';
  private readonly ACCESS_TOKEN_EXPIRES_IN = 3600; // 1 hour
  private readonly REFRESH_TOKEN_EXPIRES_IN = 604800; // 7 days

  constructor(
    private readonly userService: UserService,
    private readonly jwtService: JwtService,
    private readonly databaseService: DatabaseService,
    private readonly cacheService: CacheService,
  ) {}

  async register(registerDto: RegisterDto): Promise<AuthResponseDto> {
    try {
      // Validate input using SafeParser
      const safeData = new SafeParser(registerDto);
      const email = safeData.getEmail('email');
      const password = safeData.getNonEmptyString('password');
      const name = safeData.getNonEmptyString('name');

      if (!email || !password || !name) {
        throw new UnauthorizedException({
          statusCode: 400,
          message: 'Registration data validation failed',
          errors: ['Email, password, and name are required'],
          timestamp: new Date().toISOString(),
        });
      }

      // Create user using UserService
      const user = await this.userService.create(registerDto);

      // Generate tokens
      const tokens = await this.generateTokens(user);

      // Store refresh token
      await this.storeRefreshToken(user.id, tokens.refreshToken);

      this.logger.log(`User registered successfully: ${user.email}`, {
        userId: user.id,
        email: user.email,
      });

      return {
        ...tokens,
        user,
      };
    } catch (error) {
      this.logger.error('Registration failed:', {
        error: error instanceof Error ? error.message : String(error),
        email: registerDto.email,
      });
      throw error;
    }
  }

  async login(loginDto: LoginDto): Promise<AuthResponseDto> {
    try {
      // Validate input using SafeParser
      const safeData = new SafeParser(loginDto);
      const email = safeData.getEmail('email');
      const password = safeData.getNonEmptyString('password');

      if (!email || !password) {
        throw new UnauthorizedException({
          statusCode: 400,
          message: 'Login data validation failed',
          errors: ['Valid email and password are required'],
          timestamp: new Date().toISOString(),
        });
      }

      // Validate user credentials
      const user = await this.userService.validatePassword(email, password);

      if (!user) {
        throw new UnauthorizedException({
          statusCode: 401,
          message: 'Authentication failed',
          errors: ['Invalid email or password'],
          timestamp: new Date().toISOString(),
        });
      }

      // Get user response format
      const userResponse = await this.userService.findById(user.id);
      if (!userResponse) {
        throw new UnauthorizedException({
          statusCode: 401,
          message: 'User not found',
          errors: ['User account no longer exists'],
          timestamp: new Date().toISOString(),
        });
      }

      // Generate tokens
      const tokens = await this.generateTokens(userResponse);

      // Store refresh token
      await this.storeRefreshToken(user.id, tokens.refreshToken);

      this.logger.log(`User logged in successfully: ${user.email}`, {
        userId: user.id,
        email: user.email,
      });

      return {
        ...tokens,
        user: userResponse,
      };
    } catch (error) {
      this.logger.error('Login failed:', {
        error: error instanceof Error ? error.message : String(error),
        email: loginDto.email,
      });
      throw error;
    }
  }

  async refreshToken(refreshToken: string): Promise<AuthResponseDto> {
    try {
      // Validate refresh token input
      if (!isString(refreshToken) || refreshToken.trim().length === 0) {
        throw new UnauthorizedException({
          statusCode: 400,
          message: 'Token validation failed',
          errors: ['Refresh token must be a non-empty string'],
          timestamp: new Date().toISOString(),
        });
      }

      // Verify refresh token
      const payload = await this.verifyRefreshToken(refreshToken.trim());

      // Get user
      const user = await this.userService.findById(payload.sub);
      if (!user) {
        throw new UnauthorizedException({
          statusCode: 401,
          message: 'User not found',
          errors: ['User associated with token no longer exists'],
          timestamp: new Date().toISOString(),
        });
      }

      // Check if refresh token is still valid in cache
      const cachedToken = await this.getCachedRefreshToken(user.id);
      if (cachedToken !== refreshToken.trim()) {
        throw new UnauthorizedException({
          statusCode: 401,
          message: 'Token validation failed',
          errors: ['Refresh token is invalid or expired'],
          timestamp: new Date().toISOString(),
        });
      }

      // Generate new tokens
      const tokens = await this.generateTokens(user);

      // Store new refresh token
      await this.storeRefreshToken(user.id, tokens.refreshToken);

      this.logger.log(`Token refreshed for user: ${user.email}`, {
        userId: user.id,
        email: user.email,
      });

      return {
        ...tokens,
        user,
      };
    } catch (error) {
      this.logger.error('Token refresh failed:', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error instanceof UnauthorizedException
        ? error
        : new UnauthorizedException({
            statusCode: 401,
            message: 'Token refresh failed',
            errors: ['Invalid refresh token'],
            timestamp: new Date().toISOString(),
          });
    }
  }

  async logout(userId: string): Promise<void> {
    try {
      // Validate userId input
      if (!isUUID(userId)) {
        throw new UnauthorizedException({
          statusCode: 400,
          message: 'Logout failed',
          errors: ['Invalid user ID format'],
          timestamp: new Date().toISOString(),
        });
      }

      // Remove refresh token from cache
      await this.removeRefreshToken(userId);

      this.logger.log(`User logged out: ${userId}`, {
        userId,
      });
    } catch (error) {
      this.logger.error(`Logout failed for user ${userId}:`, {
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async generateTokens(user: UserResponseDto): Promise<TokenPair> {
    // Validate user data using SafeParser
    const safeUser = new SafeParser(user);
    const userId = safeUser.getUUID('id');
    const email = safeUser.getEmail('email');
    const role = safeUser.getString('role');

    if (!userId || !email || !role) {
      throw new UnauthorizedException({
        statusCode: 500,
        message: 'Token generation failed',
        errors: ['Invalid user data for token generation'],
        timestamp: new Date().toISOString(),
      });
    }

    const payload: Omit<JwtPayload, 'type'> = {
      sub: userId,
      email: email,
      role: role,
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(
        { ...payload, type: 'access' },
        { expiresIn: this.ACCESS_TOKEN_EXPIRES_IN },
      ),
      this.jwtService.signAsync(
        { ...payload, type: 'refresh' },
        { expiresIn: this.REFRESH_TOKEN_EXPIRES_IN },
      ),
    ]);

    return {
      accessToken,
      refreshToken,
      expiresIn: this.ACCESS_TOKEN_EXPIRES_IN,
    };
  }

  async validateRefreshToken(token: string): Promise<User | null> {
    try {
      if (!isString(token) || token.trim().length === 0) {
        return null;
      }

      const payload = await this.verifyRefreshToken(token.trim());
      const user = await this.userService.findByEmail(payload.email);

      if (!user) {
        return null;
      }

      // Check if token is still valid in cache
      const cachedToken = await this.getCachedRefreshToken(user.id);
      if (cachedToken !== token.trim()) {
        return null;
      }

      return user;
    } catch (error) {
      this.logger.error('Refresh token validation failed:', {
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  private async verifyRefreshToken(token: string): Promise<JwtPayload> {
    try {
      const payload: unknown = await this.jwtService.verifyAsync(token);

      if (!isValidJwtPayload(payload)) {
        throw new UnauthorizedException({
          statusCode: 401,
          message: 'Token validation failed',
          errors: ['Invalid token payload structure'],
          timestamp: new Date().toISOString(),
        });
      }

      if (payload.type !== 'refresh') {
        throw new UnauthorizedException({
          statusCode: 401,
          message: 'Token validation failed',
          errors: ['Invalid token type - expected refresh token'],
          timestamp: new Date().toISOString(),
        });
      }

      return payload;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException({
        statusCode: 401,
        message: 'Token validation failed',
        errors: ['Token is expired or invalid'],
        timestamp: new Date().toISOString(),
      });
    }
  }

  private async storeRefreshToken(
    userId: string,
    refreshToken: string,
  ): Promise<void> {
    const cacheKey = this.cacheService.generateKey(
      this.REFRESH_TOKEN_CACHE_PREFIX,
      userId,
    );
    await this.cacheService.set(
      cacheKey,
      refreshToken,
      this.REFRESH_TOKEN_EXPIRES_IN,
    );
  }

  private async getCachedRefreshToken(userId: string): Promise<string | null> {
    const cacheKey = this.cacheService.generateKey(
      this.REFRESH_TOKEN_CACHE_PREFIX,
      userId,
    );
    return this.cacheService.get<string>(cacheKey);
  }

  private async removeRefreshToken(userId: string): Promise<void> {
    const cacheKey = this.cacheService.generateKey(
      this.REFRESH_TOKEN_CACHE_PREFIX,
      userId,
    );
    await this.cacheService.del(cacheKey);
  }
}
