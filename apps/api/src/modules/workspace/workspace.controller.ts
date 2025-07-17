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
  ForbiddenException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { WorkspaceService } from './workspace.service';
import {
  CreateWorkspaceDto,
  WorkspaceResponseDto,
  AddMemberDto,
  UpdateMemberRoleDto,
  WorkspaceMemberResponseDto,
} from './dto';
import { WorkspaceSchemas } from '../../shared/schemas';
import {
  ValidatedBody,
  CurrentUser,
  UUIDParam,
  TypeSafeJwtGuard,
  WorkspacePermissionGuard,
  RequireWorkspaceRole,
  AuthenticatedUser,
} from '@ai-assistant/utils';

/**
 * Enhanced Workspace Controller với comprehensive type safety và workspace permissions
 */
@ApiTags('workspaces')
@Controller('workspaces')
export class WorkspaceController {
  constructor(private readonly workspaceService: WorkspaceService) {}

  @Post()
  @UseGuards(TypeSafeJwtGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new workspace' })
  @ApiResponse({
    status: 201,
    description: 'Workspace created successfully',
    type: WorkspaceResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Validation failed' })
  @ApiResponse({ status: 401, description: 'Authentication required' })
  async create(
    @ValidatedBody(WorkspaceSchemas.create) body: CreateWorkspaceDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<WorkspaceResponseDto> {
    try {
      return await this.workspaceService.create(user.id, body);
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException('Failed to create workspace');
    }
  }

  @Get()
  @UseGuards(TypeSafeJwtGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get user workspaces' })
  @ApiResponse({
    status: 200,
    description: 'User workspaces retrieved successfully',
    type: [WorkspaceResponseDto],
  })
  @ApiResponse({ status: 401, description: 'Authentication required' })
  async findAll(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<WorkspaceResponseDto[]> {
    try {
      return await this.workspaceService.findByUser(user.id);
    } catch {
      throw new BadRequestException('Failed to retrieve workspaces');
    }
  }

  @Get(':id')
  @UseGuards(TypeSafeJwtGuard, WorkspacePermissionGuard)
  @RequireWorkspaceRole('MEMBER', 'ADMIN', 'OWNER')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get workspace by ID' })
  @ApiResponse({
    status: 200,
    description: 'Workspace retrieved successfully',
    type: WorkspaceResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Authentication required' })
  @ApiResponse({ status: 403, description: 'Workspace access denied' })
  @ApiResponse({ status: 404, description: 'Workspace not found' })
  async findOne(@UUIDParam('id') id: string): Promise<WorkspaceResponseDto> {
    try {
      const workspace = await this.workspaceService.findById(id);
      if (!workspace) {
        throw new NotFoundException('Workspace not found');
      }
      return workspace;
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }
      throw new BadRequestException('Failed to retrieve workspace');
    }
  }

  @Post(':id/members')
  @UseGuards(TypeSafeJwtGuard, WorkspacePermissionGuard)
  @RequireWorkspaceRole('ADMIN', 'OWNER')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Add member to workspace (Admin/Owner only)' })
  @ApiResponse({
    status: 201,
    description: 'Member added successfully',
    type: WorkspaceMemberResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Validation failed' })
  @ApiResponse({ status: 401, description: 'Authentication required' })
  @ApiResponse({ status: 403, description: 'Admin/Owner access required' })
  @ApiResponse({ status: 404, description: 'User or workspace not found' })
  @ApiResponse({ status: 409, description: 'User already a member' })
  async addMember(
    @UUIDParam('id') workspaceId: string,
    @ValidatedBody(WorkspaceSchemas.addMember) body: AddMemberDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<WorkspaceMemberResponseDto> {
    try {
      return await this.workspaceService.addMember(workspaceId, body, user.id);
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }
      throw new BadRequestException('Failed to add member to workspace');
    }
  }

  @Delete(':id/members/:memberId')
  @UseGuards(TypeSafeJwtGuard, WorkspacePermissionGuard)
  @RequireWorkspaceRole('ADMIN', 'OWNER')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove member from workspace (Admin/Owner only)' })
  @ApiResponse({ status: 204, description: 'Member removed successfully' })
  @ApiResponse({ status: 401, description: 'Authentication required' })
  @ApiResponse({ status: 403, description: 'Admin/Owner access required' })
  @ApiResponse({ status: 404, description: 'Member or workspace not found' })
  async removeMember(
    @UUIDParam('id') workspaceId: string,
    @UUIDParam('memberId') memberId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    try {
      await this.workspaceService.removeMember(workspaceId, memberId, user.id);
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }
      throw new BadRequestException('Failed to remove member from workspace');
    }
  }

  @Patch(':id/members/:memberId/role')
  @UseGuards(TypeSafeJwtGuard, WorkspacePermissionGuard)
  @RequireWorkspaceRole('ADMIN', 'OWNER')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update member role (Admin/Owner only)' })
  @ApiResponse({
    status: 200,
    description: 'Member role updated successfully',
    type: WorkspaceMemberResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Validation failed' })
  @ApiResponse({ status: 401, description: 'Authentication required' })
  @ApiResponse({ status: 403, description: 'Admin/Owner access required' })
  @ApiResponse({ status: 404, description: 'Member or workspace not found' })
  async updateMemberRole(
    @UUIDParam('id') workspaceId: string,
    @UUIDParam('memberId') memberId: string,
    @ValidatedBody(WorkspaceSchemas.updateMemberRole) body: UpdateMemberRoleDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<WorkspaceMemberResponseDto> {
    try {
      return await this.workspaceService.updateMemberRole(
        workspaceId,
        memberId,
        body,
        user.id,
      );
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }
      throw new BadRequestException('Failed to update member role');
    }
  }

  @Post(':id/switch')
  @UseGuards(TypeSafeJwtGuard, WorkspacePermissionGuard)
  @RequireWorkspaceRole('MEMBER', 'ADMIN', 'OWNER')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Switch to workspace' })
  @ApiResponse({ status: 200, description: 'Workspace switched successfully' })
  @ApiResponse({ status: 401, description: 'Authentication required' })
  @ApiResponse({ status: 403, description: 'Not a member of workspace' })
  @ApiResponse({ status: 404, description: 'Workspace not found' })
  async switchWorkspace(
    @UUIDParam('id') workspaceId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ message: string; workspaceId: string }> {
    try {
      await this.workspaceService.switchWorkspace(user.id, workspaceId);
      return {
        message: 'Workspace switched successfully',
        workspaceId,
      };
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }
      throw new BadRequestException('Failed to switch workspace');
    }
  }

  @Get(':id/members')
  @UseGuards(TypeSafeJwtGuard, WorkspacePermissionGuard)
  @RequireWorkspaceRole('MEMBER', 'ADMIN', 'OWNER')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get workspace members' })
  @ApiResponse({
    status: 200,
    description: 'Workspace members retrieved successfully',
    type: [WorkspaceMemberResponseDto],
  })
  @ApiResponse({ status: 401, description: 'Authentication required' })
  @ApiResponse({ status: 403, description: 'Workspace access denied' })
  @ApiResponse({ status: 404, description: 'Workspace not found' })
  getMembers(
    @UUIDParam('id') workspaceId: string,
  ): WorkspaceMemberResponseDto[] {
    // TODO: Implement getMembers in WorkspaceService
    // For now, return empty array as placeholder
    void workspaceId; // Parameter will be used when implementing actual logic
    return [];
  }

  @Patch(':id')
  @UseGuards(TypeSafeJwtGuard, WorkspacePermissionGuard)
  @RequireWorkspaceRole('ADMIN', 'OWNER')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update workspace (Admin/Owner only)' })
  @ApiResponse({
    status: 200,
    description: 'Workspace updated successfully',
    type: WorkspaceResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Validation failed' })
  @ApiResponse({ status: 401, description: 'Authentication required' })
  @ApiResponse({ status: 403, description: 'Admin/Owner access required' })
  @ApiResponse({ status: 404, description: 'Workspace not found' })
  update(
    @UUIDParam('id') workspaceId: string,
    @ValidatedBody(WorkspaceSchemas.update) body: Partial<CreateWorkspaceDto>,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<WorkspaceResponseDto> {
    // TODO: Implement workspace update in WorkspaceService
    // Parameters will be used when implementing actual logic
    void workspaceId;
    void body;
    void user;

    throw new BadRequestException('Workspace update not yet implemented');
  }
}
