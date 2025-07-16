import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UserService } from '../user/user.service';
import { DatabaseService } from '../../shared/database/database.service';
import { CacheService } from '../../shared/cache/cache.service';
import { RegisterDto, LoginDto, AuthResponseDto, TokenPair } from './dto';
import { UserResponseDto } from '../user/dto';
import { User } from '@prisma/client';

interface JwtPayload {
  sub: string;
  email: string;
  role: string;
  type: 'access' | 'refresh';
}

// Type guard function to validate JWT payload
function isValidJwtPayload(payload: unknown): payload is JwtPayload {
  return (
    typeof payload === 'object' &&
    payload !== null &&
    typeof (payload as Record<string, unknown>).sub === 'string' &&
    typeof (payload as Record<string, unknown>).email === 'string' &&
    typeof (payload as Record<string, unknown>).role === 'string' &&
    ((payload as Record<string, unknown>).type === 'access' ||
      (payload as Record<string, unknown>).type === 'refresh')
  );
}

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
      // Create user using UserService
      const user = await this.userService.create(registerDto);

      // Generate tokens
      const tokens = await this.generateTokens(user);

      // Store refresh token
      await this.storeRefreshToken(user.id, tokens.refreshToken);

      this.logger.log(`User registered successfully: ${user.email}`);

      return {
        ...tokens,
        user,
      };
    } catch (error) {
      this.logger.error('Registration failed:', error);
      throw error;
    }
  }

  async login(loginDto: LoginDto): Promise<AuthResponseDto> {
    try {
      // Validate user credentials
      const user = await this.userService.validatePassword(
        loginDto.email,
        loginDto.password,
      );

      if (!user) {
        throw new UnauthorizedException('Invalid credentials');
      }

      // Get user response format
      const userResponse = await this.userService.findById(user.id);
      if (!userResponse) {
        throw new UnauthorizedException('User not found');
      }

      // Generate tokens
      const tokens = await this.generateTokens(userResponse);

      // Store refresh token
      await this.storeRefreshToken(user.id, tokens.refreshToken);

      this.logger.log(`User logged in successfully: ${user.email}`);

      return {
        ...tokens,
        user: userResponse,
      };
    } catch (error) {
      this.logger.error('Login failed:', error);
      throw error;
    }
  }

  async refreshToken(refreshToken: string): Promise<AuthResponseDto> {
    try {
      // Verify refresh token
      const payload = await this.verifyRefreshToken(refreshToken);

      // Get user
      const user = await this.userService.findById(payload.sub);
      if (!user) {
        throw new UnauthorizedException('User not found');
      }

      // Check if refresh token is still valid in cache
      const cachedToken = await this.getCachedRefreshToken(user.id);
      if (cachedToken !== refreshToken) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      // Generate new tokens
      const tokens = await this.generateTokens(user);

      // Store new refresh token
      await this.storeRefreshToken(user.id, tokens.refreshToken);

      this.logger.log(`Token refreshed for user: ${user.email}`);

      return {
        ...tokens,
        user,
      };
    } catch (error) {
      this.logger.error('Token refresh failed:', error);
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async logout(userId: string): Promise<void> {
    try {
      // Remove refresh token from cache
      await this.removeRefreshToken(userId);

      this.logger.log(`User logged out: ${userId}`);
    } catch (error) {
      this.logger.error(`Logout failed for user ${userId}:`, error);
      throw error;
    }
  }

  async generateTokens(user: UserResponseDto): Promise<TokenPair> {
    const payload: Omit<JwtPayload, 'type'> = {
      sub: user.id,
      email: user.email,
      role: user.role,
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
      const payload = await this.verifyRefreshToken(token);
      const user = await this.userService.findByEmail(payload.email);

      if (!user) {
        return null;
      }

      // Check if token is still valid in cache
      const cachedToken = await this.getCachedRefreshToken(user.id);
      if (cachedToken !== token) {
        return null;
      }

      return user;
    } catch (error) {
      this.logger.error('Refresh token validation failed:', error);
      return null;
    }
  }

  private async verifyRefreshToken(token: string): Promise<JwtPayload> {
    try {
      const payload: unknown = await this.jwtService.verifyAsync(token);

      if (!isValidJwtPayload(payload)) {
        throw new UnauthorizedException('Invalid token payload');
      }

      if (payload.type !== 'refresh') {
        throw new UnauthorizedException('Invalid token type');
      }

      return payload;
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
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
