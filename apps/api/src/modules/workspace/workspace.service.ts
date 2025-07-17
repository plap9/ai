import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { DatabaseService } from '../../shared/database/database.service';
import { CacheService } from '../../shared/cache/cache.service';
import { UserService } from '../user/user.service';
import {
  CreateWorkspaceDto,
  WorkspaceResponseDto,
  AddMemberDto,
  UpdateMemberRoleDto,
  WorkspaceMemberResponseDto,
} from './dto';
import { WorkspaceRole } from '@prisma/client';
import { SafeParser, isUUID, isObject, hasProperty } from '@ai-assistant/utils';

/**
 * Type guard để validate workspace member object
 */
function isValidWorkspaceMember(member: unknown): member is {
  id: string;
  workspaceId: string;
  userId: string;
  role: WorkspaceRole;
} {
  return (
    isObject(member) &&
    hasProperty(member, 'id') &&
    hasProperty(member, 'workspaceId') &&
    hasProperty(member, 'userId') &&
    hasProperty(member, 'role') &&
    isUUID(member.id) &&
    isUUID(member.workspaceId) &&
    isUUID(member.userId) &&
    Object.values(WorkspaceRole).includes(member.role as WorkspaceRole)
  );
}

@Injectable()
export class WorkspaceService {
  private readonly logger = new Logger(WorkspaceService.name);
  private readonly CACHE_PREFIX = 'workspace';
  private readonly CACHE_TTL = 300; // 5 minutes

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly cacheService: CacheService,
    private readonly userService: UserService,
  ) {}

  async create(
    userId: string,
    createWorkspaceDto: CreateWorkspaceDto,
  ): Promise<WorkspaceResponseDto> {
    try {
      // Type-safe validation của input
      if (!isUUID(userId)) {
        throw new BadRequestException('Invalid user ID format');
      }

      const parser = new SafeParser(createWorkspaceDto);
      const name = parser.getNonEmptyString('name');
      const description = parser.getString('description');

      if (!name) {
        throw new BadRequestException('Workspace name is required');
      }

      // Create workspace
      const workspace = await this.databaseService.workspace.create({
        data: {
          name,
          description: description || null,
          ownerId: userId,
        },
        include: {
          members: {
            include: {
              user: {
                select: {
                  id: true,
                  email: true,
                  name: true,
                },
              },
            },
          },
        },
      });

      // Add owner as member
      await this.databaseService.workspaceMember.create({
        data: {
          workspaceId: workspace.id,
          userId: userId,
          role: WorkspaceRole.OWNER,
        },
      });

      // Cache the workspace
      const cacheKey = this.cacheService.generateKey(
        this.CACHE_PREFIX,
        workspace.id,
      );
      const formattedWorkspace = this.formatWorkspaceResponse(workspace);
      await this.cacheService.set(cacheKey, formattedWorkspace, this.CACHE_TTL);

      this.logger.log(`Workspace created: ${workspace.name} by user ${userId}`);
      return formattedWorkspace;
    } catch (error) {
      this.logger.error(`Error creating workspace:`, error);
      if (
        error instanceof BadRequestException ||
        error instanceof ConflictException
      ) {
        throw error;
      }
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      throw new BadRequestException(
        `Failed to create workspace: ${errorMessage}`,
      );
    }
  }

  async findByUser(userId: string): Promise<WorkspaceResponseDto[]> {
    try {
      // Type-safe validation
      if (!isUUID(userId)) {
        throw new BadRequestException('Invalid user ID format');
      }

      const workspaces = await this.databaseService.workspace.findMany({
        where: {
          members: {
            some: {
              userId: userId,
            },
          },
        },
        include: {
          members: {
            include: {
              user: {
                select: {
                  id: true,
                  email: true,
                  name: true,
                },
              },
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      return workspaces.map((workspace) =>
        this.formatWorkspaceResponse(workspace),
      );
    } catch (error) {
      this.logger.error(`Error finding workspaces for user ${userId}:`, error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      throw new BadRequestException(
        `Failed to find workspaces: ${errorMessage}`,
      );
    }
  }

  async findById(id: string): Promise<WorkspaceResponseDto | null> {
    try {
      // Type-safe validation
      if (!isUUID(id)) {
        throw new BadRequestException('Invalid workspace ID format');
      }

      // Try cache first
      const cacheKey = this.cacheService.generateKey(this.CACHE_PREFIX, id);
      const cachedWorkspace =
        await this.cacheService.get<WorkspaceResponseDto>(cacheKey);
      if (cachedWorkspace) {
        this.logger.debug(`Workspace found in cache: ${id}`);
        return cachedWorkspace;
      }

      // Query database
      const workspace = await this.databaseService.workspace.findUnique({
        where: { id },
        include: {
          members: {
            include: {
              user: {
                select: {
                  id: true,
                  email: true,
                  name: true,
                },
              },
            },
          },
        },
      });

      if (!workspace) {
        return null;
      }

      const formattedWorkspace = this.formatWorkspaceResponse(workspace);

      // Cache the result
      await this.cacheService.set(cacheKey, formattedWorkspace, this.CACHE_TTL);

      return formattedWorkspace;
    } catch (error) {
      this.logger.error(`Error finding workspace ${id}:`, error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      throw new BadRequestException(
        `Failed to find workspace: ${errorMessage}`,
      );
    }
  }

  async addMember(
    workspaceId: string,
    addMemberDto: AddMemberDto,
    requesterId: string,
  ): Promise<WorkspaceMemberResponseDto> {
    try {
      // Type-safe validation của inputs
      if (!isUUID(workspaceId)) {
        throw new BadRequestException('Invalid workspace ID format');
      }
      if (!isUUID(requesterId)) {
        throw new BadRequestException('Invalid requester ID format');
      }

      const parser = new SafeParser(addMemberDto);
      const email = parser.getEmail('email');
      const role = parser.getString('role');

      if (!email) {
        throw new BadRequestException('Valid email is required');
      }
      if (
        !role ||
        !Object.values(WorkspaceRole).includes(role as WorkspaceRole)
      ) {
        throw new BadRequestException('Valid workspace role is required');
      }

      // Check if requester has permission
      await this.checkPermission(workspaceId, requesterId, [
        WorkspaceRole.OWNER,
        WorkspaceRole.ADMIN,
      ]);

      // Find user by email
      const user = await this.userService.findByEmail(email);
      if (!user) {
        throw new NotFoundException('User not found');
      }

      // Check if user is already a member using type-safe query
      const existingMember =
        await this.databaseService.workspaceMember.findFirst({
          where: {
            workspaceId,
            userId: user.id,
          },
        });

      if (existingMember) {
        throw new ConflictException(
          'User is already a member of this workspace',
        );
      }

      // Add member với proper type validation
      const member = await this.databaseService.workspaceMember.create({
        data: {
          workspaceId,
          userId: user.id,
          role: role as WorkspaceRole,
        },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true,
            },
          },
        },
      });

      // Clear workspace cache
      const cacheKey = this.cacheService.generateKey(
        this.CACHE_PREFIX,
        workspaceId,
      );
      await this.cacheService.del(cacheKey);

      this.logger.log(
        `User ${email} added to workspace ${workspaceId} as ${role}`,
      );

      return this.formatMemberResponse(member);
    } catch (error) {
      this.logger.error(
        `Error adding member to workspace ${workspaceId}:`,
        error,
      );
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException ||
        error instanceof ConflictException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      throw new BadRequestException(`Failed to add member: ${errorMessage}`);
    }
  }

  async removeMember(
    workspaceId: string,
    memberId: string,
    requesterId: string,
  ): Promise<void> {
    try {
      // Type-safe validation
      if (!isUUID(workspaceId)) {
        throw new BadRequestException('Invalid workspace ID format');
      }
      if (!isUUID(memberId)) {
        throw new BadRequestException('Invalid member ID format');
      }
      if (!isUUID(requesterId)) {
        throw new BadRequestException('Invalid requester ID format');
      }

      // Check if requester has permission
      await this.checkPermission(workspaceId, requesterId, [
        WorkspaceRole.OWNER,
        WorkspaceRole.ADMIN,
      ]);

      // Find member với type validation
      const member = await this.databaseService.workspaceMember.findFirst({
        where: {
          id: memberId,
          workspaceId,
        },
      });

      if (!member || !isValidWorkspaceMember(member)) {
        throw new NotFoundException('Member not found');
      }

      // Cannot remove owner
      if (member.role === WorkspaceRole.OWNER) {
        throw new ForbiddenException('Cannot remove workspace owner');
      }

      // Remove member
      await this.databaseService.workspaceMember.delete({
        where: { id: memberId },
      });

      // Clear workspace cache
      const cacheKey = this.cacheService.generateKey(
        this.CACHE_PREFIX,
        workspaceId,
      );
      await this.cacheService.del(cacheKey);

      this.logger.log(
        `Member ${memberId} removed from workspace ${workspaceId}`,
      );
    } catch (error) {
      this.logger.error(
        `Error removing member ${memberId} from workspace ${workspaceId}:`,
        error,
      );
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      throw new BadRequestException(`Failed to remove member: ${errorMessage}`);
    }
  }

  async updateMemberRole(
    workspaceId: string,
    memberId: string,
    updateMemberRoleDto: UpdateMemberRoleDto,
    requesterId: string,
  ): Promise<WorkspaceMemberResponseDto> {
    try {
      // Type-safe validation
      if (!isUUID(workspaceId)) {
        throw new BadRequestException('Invalid workspace ID format');
      }
      if (!isUUID(memberId)) {
        throw new BadRequestException('Invalid member ID format');
      }
      if (!isUUID(requesterId)) {
        throw new BadRequestException('Invalid requester ID format');
      }

      const parser = new SafeParser(updateMemberRoleDto);
      const role = parser.getString('role');

      if (
        !role ||
        !Object.values(WorkspaceRole).includes(role as WorkspaceRole)
      ) {
        throw new BadRequestException('Valid workspace role is required');
      }

      // Check if requester has permission
      await this.checkPermission(workspaceId, requesterId, [
        WorkspaceRole.OWNER,
      ]);

      // Find member
      const member = await this.databaseService.workspaceMember.findFirst({
        where: {
          id: memberId,
          workspaceId,
        },
      });

      if (!member || !isValidWorkspaceMember(member)) {
        throw new NotFoundException('Member not found');
      }

      // Cannot change owner role
      if (member.role === WorkspaceRole.OWNER) {
        throw new ForbiddenException('Cannot change owner role');
      }

      // Update member role
      const updatedMember = await this.databaseService.workspaceMember.update({
        where: { id: memberId },
        data: { role: role as WorkspaceRole },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true,
            },
          },
        },
      });

      // Clear workspace cache
      const cacheKey = this.cacheService.generateKey(
        this.CACHE_PREFIX,
        workspaceId,
      );
      await this.cacheService.del(cacheKey);

      this.logger.log(
        `Member ${memberId} role updated to ${role} in workspace ${workspaceId}`,
      );

      return this.formatMemberResponse(updatedMember);
    } catch (error) {
      this.logger.error(
        `Error updating member role in workspace ${workspaceId}:`,
        error,
      );
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      throw new BadRequestException(
        `Failed to update member role: ${errorMessage}`,
      );
    }
  }

  async switchWorkspace(userId: string, workspaceId: string): Promise<void> {
    try {
      // Type-safe validation
      if (!isUUID(userId)) {
        throw new BadRequestException('Invalid user ID format');
      }
      if (!isUUID(workspaceId)) {
        throw new BadRequestException('Invalid workspace ID format');
      }

      // Check if user is member of the workspace
      const member = await this.databaseService.workspaceMember.findFirst({
        where: {
          workspaceId,
          userId,
        },
      });

      if (!member || !isValidWorkspaceMember(member)) {
        throw new ForbiddenException('User is not a member of this workspace');
      }

      // Store current workspace in cache for user
      const cacheKey = this.cacheService.generateKey(
        'current_workspace',
        userId,
      );
      await this.cacheService.set(cacheKey, workspaceId, 86400); // 24 hours

      this.logger.log(`User ${userId} switched to workspace ${workspaceId}`);
    } catch (error) {
      this.logger.error(`Error switching workspace for user ${userId}:`, error);
      if (
        error instanceof BadRequestException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      throw new BadRequestException(
        `Failed to switch workspace: ${errorMessage}`,
      );
    }
  }

  private async checkPermission(
    workspaceId: string,
    userId: string,
    allowedRoles: WorkspaceRole[],
  ): Promise<void> {
    // Type-safe validation
    if (!isUUID(workspaceId)) {
      throw new BadRequestException('Invalid workspace ID format');
    }
    if (!isUUID(userId)) {
      throw new BadRequestException('Invalid user ID format');
    }

    const member = await this.databaseService.workspaceMember.findFirst({
      where: {
        workspaceId,
        userId,
      },
    });

    if (!member || !isValidWorkspaceMember(member)) {
      throw new ForbiddenException('User is not a member of this workspace');
    }
    if (!allowedRoles.includes(member.role)) {
      throw new ForbiddenException('Insufficient permissions');
    }
  }

  private formatWorkspaceResponse(workspace: {
    id: string;
    name: string;
    description: string | null;
    ownerId: string;
    createdAt: Date;
    updatedAt: Date;
    members?: Array<{
      id: string;
      userId: string;
      role: WorkspaceRole;
      createdAt: Date;
      user: {
        id: string;
        email: string;
        name: string | null;
      };
    }>;
  }): WorkspaceResponseDto {
    return {
      id: workspace.id,
      name: workspace.name,
      description: workspace.description,
      ownerId: workspace.ownerId,
      createdAt: workspace.createdAt,
      updatedAt: workspace.updatedAt,
      members:
        workspace.members?.map((member) => this.formatMemberResponse(member)) ||
        [],
    };
  }

  private formatMemberResponse(member: {
    id: string;
    userId: string;
    role: WorkspaceRole;
    createdAt: Date;
    user: {
      id: string;
      email: string;
      name: string | null;
    };
  }): WorkspaceMemberResponseDto {
    return {
      id: member.id,
      userId: member.userId,
      email: member.user.email,
      name: member.user.name,
      role: member.role,
      joinedAt: member.createdAt,
    };
  }
}
