import { IsEmail, IsNotEmpty, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { WorkspaceRole } from '@prisma/client';

export class AddMemberDto {
  @ApiProperty({
    description: 'Email of the user to add',
    example: 'user@example.com',
  })
  @IsEmail({}, { message: 'Please provide a valid email address' })
  @IsNotEmpty({ message: 'Email is required' })
  email: string;

  @ApiProperty({
    description: 'Role to assign to the member',
    enum: WorkspaceRole,
    example: WorkspaceRole.MEMBER,
  })
  @IsEnum(WorkspaceRole, { message: 'Role must be OWNER, ADMIN, or MEMBER' })
  @IsNotEmpty({ message: 'Role is required' })
  role: WorkspaceRole;
}

export class UpdateMemberRoleDto {
  @ApiProperty({
    description: 'New role for the member',
    enum: WorkspaceRole,
    example: WorkspaceRole.ADMIN,
  })
  @IsEnum(WorkspaceRole, { message: 'Role must be OWNER, ADMIN, or MEMBER' })
  @IsNotEmpty({ message: 'Role is required' })
  role: WorkspaceRole;
}

export class WorkspaceMemberResponseDto {
  @ApiProperty({
    description: 'Member ID',
    example: 'uuid-string',
  })
  id: string;

  @ApiProperty({
    description: 'User ID',
    example: 'uuid-string',
  })
  userId: string;

  @ApiProperty({
    description: 'User email',
    example: 'user@example.com',
  })
  email: string;

  @ApiProperty({
    description: 'User name',
    example: 'John Doe',
  })
  name: string | null;

  @ApiProperty({
    description: 'Member role in workspace',
    enum: WorkspaceRole,
    example: WorkspaceRole.MEMBER,
  })
  role: WorkspaceRole;

  @ApiProperty({
    description: 'Date when member joined the workspace',
    example: '2023-01-01T00:00:00.000Z',
  })
  joinedAt: Date;
}
