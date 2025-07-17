import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  Logger,
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
      // Create workspace
      const workspace = await this.databaseService.workspace.create({
        data: {
          name: createWorkspaceDto.name,
          description: createWorkspaceDto.description,
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
      await this.cacheService.set(cacheKey, workspace, this.CACHE_TTL);

      this.logger.log(`Workspace created: ${workspace.name} by user ${userId}`);
      return this.formatWorkspaceResponse(workspace);
    } catch (error) {
      this.logger.error(`Error creating workspace:`, error);
      throw error;
    }
  }

  async findByUser(userId: string): Promise<WorkspaceResponseDto[]> {
    try {
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
      throw error;
    }
  }

  async findById(id: string): Promise<WorkspaceResponseDto | null> {
    try {
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
      throw error;
    }
  }

  async addMember(
    workspaceId: string,
    addMemberDto: AddMemberDto,
    requesterId: string,
  ): Promise<WorkspaceMemberResponseDto> {
    try {
      // Check if requester has permission
      await this.checkPermission(workspaceId, requesterId, [
        WorkspaceRole.OWNER,
        WorkspaceRole.ADMIN,
      ]);

      // Find user by email
      const user = await this.userService.findByEmail(addMemberDto.email);
      if (!user) {
        throw new NotFoundException('User not found');
      }

      // Check if user is already a member
      /* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
      const existingMember = await (
        this.databaseService as any
      ).workspaceMember.findFirst({
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

      // Add member
      const member = await this.databaseService.workspaceMember.create({
        data: {
          workspaceId,
          userId: user.id,
          role: addMemberDto.role,
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
        `User ${user.email} added to workspace ${workspaceId} as ${addMemberDto.role}`,
      );

      return this.formatMemberResponse(member);
    } catch (error) {
      this.logger.error(
        `Error adding member to workspace ${workspaceId}:`,
        error,
      );
      throw error;
    }
  }

  async removeMember(
    workspaceId: string,
    memberId: string,
    requesterId: string,
  ): Promise<void> {
    try {
      // Check if requester has permission
      await this.checkPermission(workspaceId, requesterId, [
        WorkspaceRole.OWNER,
        WorkspaceRole.ADMIN,
      ]);

      // Find member
      const member = await this.databaseService.workspaceMember.findFirst({
        where: {
          id: memberId,
          workspaceId,
        },
      });

      if (!member) {
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
      throw error;
    }
  }

  async updateMemberRole(
    workspaceId: string,
    memberId: string,
    updateMemberRoleDto: UpdateMemberRoleDto,
    requesterId: string,
  ): Promise<WorkspaceMemberResponseDto> {
    try {
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

      if (!member) {
        throw new NotFoundException('Member not found');
      }

      // Cannot change owner role
      if (member.role === WorkspaceRole.OWNER) {
        throw new ForbiddenException('Cannot change owner role');
      }

      // Update member role
      const updatedMember = await this.databaseService.workspaceMember.update({
        where: { id: memberId },
        data: { role: updateMemberRoleDto.role },
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
        `Member ${memberId} role updated to ${updateMemberRoleDto.role} in workspace ${workspaceId}`,
      );

      return this.formatMemberResponse(updatedMember);
    } catch (error) {
      this.logger.error(
        `Error updating member role in workspace ${workspaceId}:`,
        error,
      );
      throw error;
    }
  }

  async switchWorkspace(userId: string, workspaceId: string): Promise<void> {
    try {
      // Check if user is member of the workspace
      const member = await this.databaseService.workspaceMember.findFirst({
        where: {
          workspaceId,
          userId,
        },
      });

      if (!member) {
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
      throw error;
    }
  }

  private async checkPermission(
    workspaceId: string,
    userId: string,
    allowedRoles: WorkspaceRole[],
  ): Promise<void> {
    const member = await this.databaseService.workspaceMember.findFirst({
      where: {
        workspaceId,
        userId,
      },
    });

    if (!member) {
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
