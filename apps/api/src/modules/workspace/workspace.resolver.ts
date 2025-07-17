import { Resolver, Query, Mutation, Args, Context } from '@nestjs/graphql';
import {
  UseGuards,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { WorkspaceService } from './workspace.service';
import { WorkspaceRole } from '@prisma/client';
import {
  CreateWorkspaceDto,
  WorkspaceResponseDto,
  AddMemberDto,
  UpdateMemberRoleDto,
  WorkspaceMemberResponseDto,
} from './dto';
import {
  TypeSafeJwtGuard,
  RequireWorkspaceRole,
  isAuthenticatedUser,
  AuthenticatedUser,
} from '@ai-assistant/utils';
import {
  isObject,
  hasProperty,
  isUUID,
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

/**
 * Helper để validate workspace permission
 */
function validateWorkspaceAccess(
  user: AuthenticatedUser,
  workspaceId: string,
  requiredRoles: string[] = [],
): void {
  if (!isUUID(workspaceId)) {
    throw new BadRequestException('Invalid workspace ID format');
  }

  const userWorkspace = user.workspaces.find((ws) => ws.id === workspaceId);
  if (!userWorkspace) {
    throw new ForbiddenException('User is not a member of this workspace');
  }

  if (requiredRoles.length > 0 && !requiredRoles.includes(userWorkspace.role)) {
    throw new ForbiddenException(
      `Insufficient workspace permissions. Required: ${requiredRoles.join(', ')}`,
    );
  }
}

@Resolver('Workspace')
export class WorkspaceResolver {
  constructor(private readonly workspaceService: WorkspaceService) {}

  @Query('workspace')
  @UseGuards(TypeSafeJwtGuard)
  async workspace(
    @Args('id') id: unknown,
    @Context() context: unknown,
  ): Promise<WorkspaceResponseDto | null> {
    try {
      const user = getAuthenticatedUserFromContext(context);

      // Type-safe validation của workspace ID
      if (!isUUID(id)) {
        throw new BadRequestException('Invalid workspace ID format');
      }

      // Check workspace access
      validateWorkspaceAccess(user, id);

      return await this.workspaceService.findById(id);
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }
      throw new BadRequestException('Failed to fetch workspace');
    }
  }

  @Query('myWorkspaces')
  @UseGuards(TypeSafeJwtGuard)
  async myWorkspaces(
    @Context() context: unknown,
  ): Promise<WorkspaceResponseDto[]> {
    try {
      const user = getAuthenticatedUserFromContext(context);

      if (!isUUID(user.id)) {
        throw new BadRequestException(
          'Invalid user ID in authentication context',
        );
      }

      return await this.workspaceService.findByUser(user.id);
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException('Failed to fetch user workspaces');
    }
  }

  @Mutation('createWorkspace')
  @UseGuards(TypeSafeJwtGuard)
  async createWorkspace(
    @Args('input') input: unknown,
    @Context() context: unknown,
  ): Promise<WorkspaceResponseDto> {
    try {
      const user = getAuthenticatedUserFromContext(context);

      if (!isUUID(user.id)) {
        throw new BadRequestException(
          'Invalid user ID in authentication context',
        );
      }

      // Type-safe validation của input using SafeParser
      const parser = new SafeParser(input);

      const name = parser.getNonEmptyString('name');
      if (!name) {
        throw new BadRequestException('Workspace name is required');
      }

      const description = parser.getString('description', '');

      // Build validated create data
      const createData: CreateWorkspaceDto = {
        name,
        description: description || undefined,
      };

      return await this.workspaceService.create(user.id, createData);
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException('Failed to create workspace');
    }
  }

  @Mutation('addMember')
  @UseGuards(TypeSafeJwtGuard)
  @RequireWorkspaceRole('ADMIN', 'OWNER')
  async addMember(
    @Args('workspaceId') workspaceId: unknown,
    @Args('input') input: unknown,
    @Context() context: unknown,
  ): Promise<WorkspaceMemberResponseDto> {
    try {
      const user = getAuthenticatedUserFromContext(context);

      // Validate workspace ID
      if (!isUUID(workspaceId)) {
        throw new BadRequestException('Invalid workspace ID format');
      }

      // Check admin permission (enforced by decorator but double-check)
      validateWorkspaceAccess(user, workspaceId, ['ADMIN', 'OWNER']);

      // Type-safe validation của input
      const parser = new SafeParser(input);

      const email = parser.getString('email');
      if (!email || !email.includes('@')) {
        throw new BadRequestException('Valid email is required');
      }

      const role = parser.getString('role', 'MEMBER');
      if (!isNonEmptyString(role)) {
        throw new BadRequestException('Role is required');
      }

      // Validate role enum
      if (!Object.values(WorkspaceRole).includes(role as WorkspaceRole)) {
        throw new BadRequestException(
          'Invalid role. Must be OWNER, ADMIN, or MEMBER',
        );
      }

      // Build validated add member data
      const addMemberData: AddMemberDto = {
        email,
        role: role as WorkspaceRole,
      };

      return await this.workspaceService.addMember(
        workspaceId,
        addMemberData,
        user.id,
      );
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }
      throw new BadRequestException('Failed to add member to workspace');
    }
  }

  @Mutation('removeMember')
  @UseGuards(TypeSafeJwtGuard)
  @RequireWorkspaceRole('ADMIN', 'OWNER')
  async removeMember(
    @Args('workspaceId') workspaceId: unknown,
    @Args('memberId') memberId: unknown,
    @Context() context: unknown,
  ): Promise<boolean> {
    try {
      const user = getAuthenticatedUserFromContext(context);

      // Validate IDs
      if (!isUUID(workspaceId)) {
        throw new BadRequestException('Invalid workspace ID format');
      }
      if (!isUUID(memberId)) {
        throw new BadRequestException('Invalid member ID format');
      }

      // Check admin permission
      validateWorkspaceAccess(user, workspaceId, ['ADMIN', 'OWNER']);

      await this.workspaceService.removeMember(workspaceId, memberId, user.id);
      return true;
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }
      throw new BadRequestException('Failed to remove member from workspace');
    }
  }

  @Mutation('updateMemberRole')
  @UseGuards(TypeSafeJwtGuard)
  @RequireWorkspaceRole('ADMIN', 'OWNER')
  async updateMemberRole(
    @Args('workspaceId') workspaceId: unknown,
    @Args('memberId') memberId: unknown,
    @Args('input') input: unknown,
    @Context() context: unknown,
  ): Promise<WorkspaceMemberResponseDto> {
    try {
      const user = getAuthenticatedUserFromContext(context);

      // Validate IDs
      if (!isUUID(workspaceId)) {
        throw new BadRequestException('Invalid workspace ID format');
      }
      if (!isUUID(memberId)) {
        throw new BadRequestException('Invalid member ID format');
      }

      // Check admin permission
      validateWorkspaceAccess(user, workspaceId, ['ADMIN', 'OWNER']);

      // Type-safe validation của input
      const parser = new SafeParser(input);

      const role = parser.getNonEmptyString('role');
      if (!role) {
        throw new BadRequestException('Role is required');
      }

      // Validate role enum
      if (!Object.values(WorkspaceRole).includes(role as WorkspaceRole)) {
        throw new BadRequestException(
          'Invalid role. Must be OWNER, ADMIN, or MEMBER',
        );
      }

      // Build validated update role data
      const updateRoleData: UpdateMemberRoleDto = {
        role: role as WorkspaceRole,
      };

      return await this.workspaceService.updateMemberRole(
        workspaceId,
        memberId,
        updateRoleData,
        user.id,
      );
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }
      throw new BadRequestException('Failed to update member role');
    }
  }

  @Mutation('switchWorkspace')
  @UseGuards(TypeSafeJwtGuard)
  async switchWorkspace(
    @Args('workspaceId') workspaceId: unknown,
    @Context() context: unknown,
  ): Promise<boolean> {
    try {
      const user = getAuthenticatedUserFromContext(context);

      // Validate workspace ID
      if (!isUUID(workspaceId)) {
        throw new BadRequestException('Invalid workspace ID format');
      }

      // Check basic workspace access (user must be member)
      validateWorkspaceAccess(user, workspaceId);

      await this.workspaceService.switchWorkspace(user.id, workspaceId);
      return true;
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }
      throw new BadRequestException('Failed to switch workspace');
    }
  }
}
