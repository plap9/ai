import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  UseGuards,
  HttpCode,
  HttpStatus,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { UserService } from './user.service';
import { CreateUserDto, UpdateUserDto, UserResponseDto } from './dto';
import {
  ValidatedBody,
  CurrentUser,
  UUIDParam,
  TypeSafeJwtGuard,
  TypeSafeRoleGuard,
  RequireRoles,
  AuthenticatedUser,
} from '@ai-assistant/utils';
import { createSchema } from '@ai-assistant/utils';

/**
 * User validation schemas
 */
const userSchemas = {
  create: createSchema({
    email: {
      required: true,
      type: 'email' as const,
      message: 'Valid email address is required',
    },
    password: {
      required: true,
      type: 'string' as const,
      minLength: 8,
      maxLength: 100,
      message: 'Password must be 8-100 characters long',
    },
    name: {
      required: true,
      type: 'string' as const,
      minLength: 2,
      maxLength: 50,
      message: 'Name must be 2-50 characters long',
    },
    role: {
      required: false,
      type: 'string' as const,
      message: 'Role must be a valid user role',
    },
  }),
  update: createSchema({
    email: {
      required: false,
      type: 'email' as const,
      message: 'Valid email address is required',
    },
    name: {
      required: false,
      type: 'string' as const,
      minLength: 2,
      maxLength: 50,
      message: 'Name must be 2-50 characters long',
    },
    role: {
      required: false,
      type: 'string' as const,
      message: 'Role must be a valid user role',
    },
  }),
};

/**
 * Enhanced User Controller với comprehensive type safety
 */
@ApiTags('users')
@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new user' })
  @ApiResponse({
    status: 201,
    description: 'User created successfully',
    type: UserResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Validation failed' })
  @ApiResponse({ status: 409, description: 'User already exists' })
  async create(
    @ValidatedBody(userSchemas.create) body: CreateUserDto,
  ): Promise<UserResponseDto> {
    try {
      return await this.userService.create(body);
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException('Failed to create user');
    }
  }

  @Get('profile')
  @UseGuards(TypeSafeJwtGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiResponse({
    status: 200,
    description: 'User profile retrieved successfully',
    type: UserResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Authentication required' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async getProfile(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<UserResponseDto> {
    try {
      const userProfile = await this.userService.findById(user.id);
      if (!userProfile) {
        throw new NotFoundException('User profile not found');
      }
      return userProfile;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException('Failed to retrieve user profile');
    }
  }

  @Get(':id')
  @UseGuards(TypeSafeJwtGuard, TypeSafeRoleGuard)
  @RequireRoles('ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get user by ID (Admin only)' })
  @ApiResponse({
    status: 200,
    description: 'User retrieved successfully',
    type: UserResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Authentication required' })
  @ApiResponse({ status: 403, description: 'Admin access required' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async findOne(@UUIDParam('id') id: string): Promise<UserResponseDto> {
    try {
      const user = await this.userService.findById(id);
      if (!user) {
        throw new NotFoundException('User not found');
      }
      return user;
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      throw new BadRequestException('Failed to retrieve user');
    }
  }

  @Patch('profile')
  @UseGuards(TypeSafeJwtGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update current user profile' })
  @ApiResponse({
    status: 200,
    description: 'Profile updated successfully',
    type: UserResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Validation failed' })
  @ApiResponse({ status: 401, description: 'Authentication required' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async updateProfile(
    @CurrentUser() user: AuthenticatedUser,
    @ValidatedBody(userSchemas.update) body: UpdateUserDto,
  ): Promise<UserResponseDto> {
    try {
      return await this.userService.update(user.id, body);
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      throw new BadRequestException('Failed to update profile');
    }
  }

  @Patch(':id')
  @UseGuards(TypeSafeJwtGuard, TypeSafeRoleGuard)
  @RequireRoles('ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update user by ID (Admin only)' })
  @ApiResponse({
    status: 200,
    description: 'User updated successfully',
    type: UserResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Validation failed' })
  @ApiResponse({ status: 401, description: 'Authentication required' })
  @ApiResponse({ status: 403, description: 'Admin access required' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async update(
    @UUIDParam('id') id: string,
    @ValidatedBody(userSchemas.update) body: UpdateUserDto,
  ): Promise<UserResponseDto> {
    try {
      return await this.userService.update(id, body);
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      throw new BadRequestException('Failed to update user');
    }
  }

  @Delete('profile')
  @UseGuards(TypeSafeJwtGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete current user account' })
  @ApiResponse({ status: 204, description: 'Account deleted successfully' })
  @ApiResponse({ status: 401, description: 'Authentication required' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async deleteProfile(@CurrentUser() user: AuthenticatedUser): Promise<void> {
    try {
      const success = await this.userService.delete(user.id);
      if (!success) {
        throw new NotFoundException('User account not found');
      }
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      throw new BadRequestException('Failed to delete account');
    }
  }

  @Delete(':id')
  @UseGuards(TypeSafeJwtGuard, TypeSafeRoleGuard)
  @RequireRoles('ADMIN')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete user by ID (Admin only)' })
  @ApiResponse({ status: 204, description: 'User deleted successfully' })
  @ApiResponse({ status: 401, description: 'Authentication required' })
  @ApiResponse({ status: 403, description: 'Admin access required' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async remove(@UUIDParam('id') id: string): Promise<void> {
    try {
      const success = await this.userService.delete(id);
      if (!success) {
        throw new NotFoundException('User not found');
      }
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      throw new BadRequestException('Failed to delete user');
    }
  }

  @Get()
  @UseGuards(TypeSafeJwtGuard, TypeSafeRoleGuard)
  @RequireRoles('ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all users (Admin only)' })
  @ApiResponse({
    status: 200,
    description: 'Users retrieved successfully',
    type: [UserResponseDto],
  })
  @ApiResponse({ status: 401, description: 'Authentication required' })
  @ApiResponse({ status: 403, description: 'Admin access required' })
  findAll(): UserResponseDto[] {
    // This would need to be implemented in UserService
    // For now, return empty array or implement pagination
    return [];
  }
}
