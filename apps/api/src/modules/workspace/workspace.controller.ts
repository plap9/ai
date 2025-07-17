import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
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
import { ParseUUIDPipe } from '../../shared/common/pipes';

interface AuthenticatedUser {
  id: string;
  email: string;
}

interface AuthenticatedRequest extends Request {
  user: AuthenticatedUser;
}

@ApiTags('workspaces')
@Controller('workspaces')
export class WorkspaceController {
  constructor(private readonly workspaceService: WorkspaceService) {}

  @Post()
  @UseGuards() // JwtAuthGuard will be added later
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new workspace' })
  @ApiResponse({
    status: 201,
    description: 'Workspace created successfully',
    type: WorkspaceResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async create(
    @Body() createWorkspaceDto: CreateWorkspaceDto,
    @Request() req: AuthenticatedRequest,
  ): Promise<WorkspaceResponseDto> {
    return this.workspaceService.create(req.user.id, createWorkspaceDto);
  }

  @Get()
  @UseGuards() // JwtAuthGuard will be added later
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get user workspaces' })
  @ApiResponse({
    status: 200,
    description: 'User workspaces retrieved successfully',
    type: [WorkspaceResponseDto],
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async findAll(
    @Request() req: AuthenticatedRequest,
  ): Promise<WorkspaceResponseDto[]> {
    return this.workspaceService.findByUser(req.user.id);
  }

  @Get(':id')
  @UseGuards() // JwtAuthGuard will be added later
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get workspace by ID' })
  @ApiResponse({
    status: 200,
    description: 'Workspace retrieved successfully',
    type: WorkspaceResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Workspace not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<WorkspaceResponseDto> {
    const workspace = await this.workspaceService.findById(id);
    if (!workspace) {
      throw new Error('Workspace not found');
    }
    return workspace;
  }

  @Post(':id/members')
  @UseGuards() // JwtAuthGuard will be added later
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Add member to workspace' })
  @ApiResponse({
    status: 201,
    description: 'Member added successfully',
    type: WorkspaceMemberResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  @ApiResponse({ status: 404, description: 'User not found' })
  @ApiResponse({ status: 409, description: 'User already a member' })
  async addMember(
    @Param('id', ParseUUIDPipe) workspaceId: string,
    @Body() addMemberDto: AddMemberDto,
    @Request() req: AuthenticatedRequest,
  ): Promise<WorkspaceMemberResponseDto> {
    return this.workspaceService.addMember(
      workspaceId,
      addMemberDto,
      req.user.id,
    );
  }

  @Delete(':id/members/:memberId')
  @UseGuards() // JwtAuthGuard will be added later
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove member from workspace' })
  @ApiResponse({ status: 204, description: 'Member removed successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  @ApiResponse({ status: 404, description: 'Member not found' })
  async removeMember(
    @Param('id', ParseUUIDPipe) workspaceId: string,
    @Param('memberId', ParseUUIDPipe) memberId: string,
    @Request() req: AuthenticatedRequest,
  ): Promise<void> {
    await this.workspaceService.removeMember(
      workspaceId,
      memberId,
      req.user.id,
    );
  }

  @Patch(':id/members/:memberId/role')
  @UseGuards() // JwtAuthGuard will be added later
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update member role' })
  @ApiResponse({
    status: 200,
    description: 'Member role updated successfully',
    type: WorkspaceMemberResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  @ApiResponse({ status: 404, description: 'Member not found' })
  async updateMemberRole(
    @Param('id', ParseUUIDPipe) workspaceId: string,
    @Param('memberId', ParseUUIDPipe) memberId: string,
    @Body() updateMemberRoleDto: UpdateMemberRoleDto,
    @Request() req: AuthenticatedRequest,
  ): Promise<WorkspaceMemberResponseDto> {
    return this.workspaceService.updateMemberRole(
      workspaceId,
      memberId,
      updateMemberRoleDto,
      req.user.id,
    );
  }

  @Post(':id/switch')
  @UseGuards() // JwtAuthGuard will be added later
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Switch to workspace' })
  @ApiResponse({ status: 200, description: 'Workspace switched successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Not a member of workspace' })
  async switchWorkspace(
    @Param('id', ParseUUIDPipe) workspaceId: string,
    @Request() req: AuthenticatedRequest,
  ): Promise<{ message: string }> {
    await this.workspaceService.switchWorkspace(req.user.id, workspaceId);
    return { message: 'Workspace switched successfully' };
  }
}
