import { ApiProperty } from '@nestjs/swagger';
import { WorkspaceMemberResponseDto } from './workspace-member.dto';

export class WorkspaceResponseDto {
  @ApiProperty({
    description: 'Workspace ID',
    example: 'uuid-string',
  })
  id: string;

  @ApiProperty({
    description: 'Workspace name',
    example: 'My Workspace',
  })
  name: string;

  @ApiProperty({
    description: 'Workspace description',
    example: 'This is my personal workspace',
    nullable: true,
  })
  description: string | null;

  @ApiProperty({
    description: 'Workspace owner ID',
    example: 'uuid-string',
  })
  ownerId: string;

  @ApiProperty({
    description: 'Workspace creation date',
    example: '2023-01-01T00:00:00.000Z',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'Workspace last update date',
    example: '2023-01-01T00:00:00.000Z',
  })
  updatedAt: Date;

  @ApiProperty({
    description: 'Workspace members',
    type: [WorkspaceMemberResponseDto],
    required: false,
  })
  members?: WorkspaceMemberResponseDto[];
}
