import { Resolver, Query, Mutation, Args, Context } from '@nestjs/graphql';
import {
  UseGuards,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { UserService } from './user.service';
import { UserResponseDto, UpdateUserDto } from './dto';
import {
  TypeSafeJwtGuard,
  isAuthenticatedUser,
  AuthenticatedUser,
} from '@ai-assistant/utils';
import { isObject, hasProperty, isUUID, SafeParser } from '@ai-assistant/utils';

/**
 * Type-safe GraphQL context interface
 */
interface TypeSafeGraphQLContext {
  req: {
    user?: AuthenticatedUser;
  };
}

/**
 * Type guard để validate GraphQL context
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
    throw new BadRequestException('User not properly authenticated');
  }

  return user;
}

@Resolver('User')
export class UserResolver {
  constructor(private readonly userService: UserService) {}

  @Query('me')
  @UseGuards(TypeSafeJwtGuard)
  async me(@Context() context: unknown): Promise<UserResponseDto> {
    try {
      const user = getAuthenticatedUserFromContext(context);

      if (!isUUID(user.id)) {
        throw new BadRequestException(
          'Invalid user ID in authentication context',
        );
      }

      const userData = await this.userService.findById(user.id);
      if (!userData) {
        throw new NotFoundException('User not found');
      }

      return userData;
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      throw new BadRequestException('Failed to fetch user profile');
    }
  }

  @Query('user')
  @UseGuards(TypeSafeJwtGuard)
  async user(@Args('id') id: unknown): Promise<UserResponseDto | null> {
    try {
      // Type-safe validation của ID parameter
      if (!isUUID(id)) {
        throw new BadRequestException('Invalid user ID format');
      }

      return await this.userService.findById(id);
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException('Failed to fetch user');
    }
  }

  @Mutation('updateProfile')
  @UseGuards(TypeSafeJwtGuard)
  async updateProfile(
    @Args('input') input: unknown,
    @Context() context: unknown,
  ): Promise<UserResponseDto> {
    try {
      const user = getAuthenticatedUserFromContext(context);

      if (!isUUID(user.id)) {
        throw new BadRequestException(
          'Invalid user ID in authentication context',
        );
      }

      // Type-safe validation của input using SafeParser
      const parser = new SafeParser(input);

      // Validate input có tối thiểu một field để update
      if (!parser.has('name') && !parser.has('email')) {
        throw new BadRequestException(
          'At least one field (name or email) is required for update',
        );
      }

      // Build validated update data
      const updateData: Partial<UpdateUserDto> = {};

      const name = parser.getString('name');
      if (name) {
        updateData.name = name;
      }

      const email = parser.getEmail('email');
      if (email) {
        updateData.email = email;
      }

      return await this.userService.update(user.id, updateData);
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      throw new BadRequestException('Failed to update user profile');
    }
  }

  @Query('userById')
  @UseGuards(TypeSafeJwtGuard)
  async userById(
    @Args('userId') userId: unknown,
    @Context() context: unknown,
  ): Promise<UserResponseDto | null> {
    try {
      // Verify current user is authenticated
      getAuthenticatedUserFromContext(context);

      // Type-safe validation của userId parameter
      if (!isUUID(userId)) {
        throw new BadRequestException('Invalid user ID format');
      }

      return await this.userService.findById(userId);
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException('Failed to fetch user by ID');
    }
  }
}
