import { Resolver, Query, Mutation, Args, Context } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { WorkspaceService } from './workspace.service';
import {
  CreateWorkspaceDto,
  WorkspaceResponseDto,
  AddMemberDto,
  UpdateMemberRoleDto,
  WorkspaceMemberResponseDto,
} from './dto';

interface GraphQLContext {
  req: {
    user: {
      id: string;
      email: string;
    };
  };
}

@Resolver('Workspace')
export class WorkspaceResolver {
  constructor(private readonly workspaceService: WorkspaceService) {}

  @Query('workspace')
  @UseGuards() // GqlAuthGuard will be added later
  async workspace(
    @Args('id') id: string,
  ): Promise<WorkspaceResponseDto | null> {
    return this.workspaceService.findById(id);
  }

  @Query('myWorkspaces')
  @UseGuards() // GqlAuthGuard will be added later
  async myWorkspaces(
    @Context() context: GraphQLContext,
  ): Promise<WorkspaceResponseDto[]> {
    return this.workspaceService.findByUser(context.req.user.id);
  }

  @Mutation('createWorkspace')
  @UseGuards() // GqlAuthGuard will be added later
  async createWorkspace(
    @Args('input') input: CreateWorkspaceDto,
    @Context() context: GraphQLContext,
  ): Promise<WorkspaceResponseDto> {
    return this.workspaceService.create(context.req.user.id, input);
  }

  @Mutation('addMember')
  @UseGuards() // GqlAuthGuard will be added later
  async addMember(
    @Args('workspaceId') workspaceId: string,
    @Args('input') input: AddMemberDto,
    @Context() context: GraphQLContext,
  ): Promise<WorkspaceMemberResponseDto> {
    return this.workspaceService.addMember(
      workspaceId,
      input,
      context.req.user.id,
    );
  }

  @Mutation('removeMember')
  @UseGuards() // GqlAuthGuard will be added later
  async removeMember(
    @Args('workspaceId') workspaceId: string,
    @Args('memberId') memberId: string,
    @Context() context: GraphQLContext,
  ): Promise<boolean> {
    await this.workspaceService.removeMember(
      workspaceId,
      memberId,
      context.req.user.id,
    );
    return true;
  }

  @Mutation('updateMemberRole')
  @UseGuards() // GqlAuthGuard will be added later
  async updateMemberRole(
    @Args('workspaceId') workspaceId: string,
    @Args('memberId') memberId: string,
    @Args('input') input: UpdateMemberRoleDto,
    @Context() context: GraphQLContext,
  ): Promise<WorkspaceMemberResponseDto> {
    return this.workspaceService.updateMemberRole(
      workspaceId,
      memberId,
      input,
      context.req.user.id,
    );
  }

  @Mutation('switchWorkspace')
  @UseGuards() // GqlAuthGuard will be added later
  async switchWorkspace(
    @Args('workspaceId') workspaceId: string,
    @Context() context: GraphQLContext,
  ): Promise<boolean> {
    await this.workspaceService.switchWorkspace(
      context.req.user.id,
      workspaceId,
    );
    return true;
  }
}
