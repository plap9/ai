import { Resolver, Mutation, Args, Context } from '@nestjs/graphql';
import {
  UseGuards,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto, LoginDto, AuthResponseDto } from './dto';
import {
  isObject,
  hasProperty,
  isAuthenticatedUser,
  AuthenticatedUser,
  TypeSafeJwtGuard,
  SafeParser,
  isNonEmptyString,
} from '@ai-assistant/utils';

/**
 * Type-safe GraphQL context interface
 */
interface TypeSafeGraphQLContext {
  req: {
    user?: AuthenticatedUser;
  };
}

/**
 * Type guard cho GraphQL context validation
 */
function isValidGraphQLContext(
  context: unknown,
): context is TypeSafeGraphQLContext {
  return (
    isObject(context) && hasProperty(context, 'req') && isObject(context.req)
  );
}

/**
 * Helper để extract authenticated user từ context
 */
function getAuthenticatedUserFromContext(context: unknown): AuthenticatedUser {
  if (!isValidGraphQLContext(context)) {
    throw new BadRequestException('Invalid GraphQL context');
  }

  const user = context.req.user;
  if (!isAuthenticatedUser(user)) {
    throw new UnauthorizedException('User not properly authenticated');
  }

  return user;
}

/**
 * Enhanced Auth Resolver với comprehensive type safety
 */
@Resolver('Auth')
export class AuthResolver {
  constructor(private readonly authService: AuthService) {}

  @Mutation('register')
  async register(@Args('input') input: unknown): Promise<AuthResponseDto> {
    try {
      // Type-safe input validation using SafeParser
      const parser = new SafeParser(input);

      const email = parser.getEmail('email');
      const password = parser.getNonEmptyString('password');
      const name = parser.getNonEmptyString('name');

      if (!email) {
        throw new BadRequestException('Valid email address is required');
      }
      if (!password || password.length < 8) {
        throw new BadRequestException('Password must be at least 8 characters');
      }
      if (!name) {
        throw new BadRequestException('Name is required');
      }

      // Convert to DTO for service layer
      const registerDto: RegisterDto = {
        email,
        password,
        name,
      };

      return await this.authService.register(registerDto);
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException('Registration failed: Invalid input data');
    }
  }

  @Mutation('login')
  async login(@Args('input') input: unknown): Promise<AuthResponseDto> {
    try {
      // Type-safe input validation using SafeParser
      const parser = new SafeParser(input);

      const email = parser.getEmail('email');
      const password = parser.getNonEmptyString('password');

      if (!email) {
        throw new BadRequestException('Valid email address is required');
      }
      if (!password) {
        throw new BadRequestException('Password is required');
      }

      // Convert to DTO for service layer
      const loginDto: LoginDto = {
        email,
        password,
      };

      return await this.authService.login(loginDto);
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof UnauthorizedException
      ) {
        throw error;
      }
      throw new BadRequestException('Login failed: Invalid input data');
    }
  }

  @Mutation('refreshToken')
  async refreshToken(
    @Args('refreshToken') refreshToken: unknown,
  ): Promise<AuthResponseDto> {
    try {
      // Type-safe refresh token validation
      if (!isNonEmptyString(refreshToken)) {
        throw new BadRequestException('Valid refresh token is required');
      }

      return await this.authService.refreshToken(refreshToken.trim());
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof UnauthorizedException
      ) {
        throw error;
      }
      throw new UnauthorizedException('Token refresh failed');
    }
  }

  @Mutation('logout')
  @UseGuards(TypeSafeJwtGuard)
  async logout(@Context() context: unknown): Promise<boolean> {
    try {
      // Type-safe context validation
      const user = getAuthenticatedUserFromContext(context);

      await this.authService.logout(user.id);
      return true;
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof UnauthorizedException
      ) {
        throw error;
      }
      throw new UnauthorizedException('Logout failed');
    }
  }

  @Mutation('validateToken')
  @UseGuards(TypeSafeJwtGuard)
  validateToken(@Context() context: unknown): AuthenticatedUser {
    try {
      // Type-safe token validation via context
      const user = getAuthenticatedUserFromContext(context);
      return user;
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof UnauthorizedException
      ) {
        throw error;
      }
      throw new UnauthorizedException('Token validation failed');
    }
  }
}
