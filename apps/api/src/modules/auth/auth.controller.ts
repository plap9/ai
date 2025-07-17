import {
  Controller,
  Post,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { RegisterDto, LoginDto, AuthResponseDto } from './dto';
import { authSchemas } from '../../shared/schemas';
import {
  ValidatedBody,
  CurrentUser,
  TypeSafeJwtGuard,
  AuthenticatedUser,
} from '@ai-assistant/utils';

/**
 * Interface cho typed request bodies
 */
interface RegisterRequest {
  email: string;
  password: string;
  name: string;
}

interface LoginRequest {
  email: string;
  password: string;
}

interface RefreshTokenRequest {
  refreshToken: string;
}

/**
 * Enhanced Auth Controller với type safety
 */
@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register a new user' })
  @ApiResponse({
    status: 201,
    description: 'User registered successfully',
    type: AuthResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Validation failed' })
  @ApiResponse({ status: 409, description: 'User already exists' })
  async register(
    @ValidatedBody(authSchemas.register) body: RegisterRequest,
  ): Promise<AuthResponseDto> {
    // Body is now type-safe and validated
    const registerDto: RegisterDto = {
      email: body.email,
      password: body.password,
      name: body.name,
    };
    return this.authService.register(registerDto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login user' })
  @ApiResponse({
    status: 200,
    description: 'User logged in successfully',
    type: AuthResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  @ApiResponse({ status: 400, description: 'Validation failed' })
  async login(
    @ValidatedBody(authSchemas.login) body: LoginRequest,
  ): Promise<AuthResponseDto> {
    // Body is now type-safe and validated
    const loginDto: LoginDto = {
      email: body.email,
      password: body.password,
    };
    return this.authService.login(loginDto);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh access token' })
  @ApiResponse({
    status: 200,
    description: 'Token refreshed successfully',
    type: AuthResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Invalid refresh token' })
  @ApiResponse({ status: 400, description: 'Validation failed' })
  async refreshToken(
    @ValidatedBody(authSchemas.refreshToken) body: RefreshTokenRequest,
  ): Promise<AuthResponseDto> {
    // Body is now type-safe and validated
    return this.authService.refreshToken(body.refreshToken);
  }

  @Post('logout')
  @UseGuards(TypeSafeJwtGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Logout user' })
  @ApiResponse({ status: 204, description: 'User logged out successfully' })
  @ApiResponse({ status: 401, description: 'Authentication required' })
  async logout(@CurrentUser() user: AuthenticatedUser): Promise<void> {
    // User is now type-safe and validated
    await this.authService.logout(user.id);
  }
}
