import { createSchema, CommonSchemas, makeOptional } from '@ai-assistant/utils';
import type { ValidationSchema } from '@ai-assistant/utils';

/**
 * Schema for creating a new workspace
 */
export const createWorkspaceSchema: ValidationSchema =
  CommonSchemas.workspaceCreation;

/**
 * Schema for updating workspace information
 */
export const updateWorkspaceSchema: ValidationSchema = makeOptional(
  createWorkspaceSchema,
);

/**
 * Schema for adding a member to workspace
 */
export const addMemberSchema: ValidationSchema = createSchema({
  email: {
    required: true,
    type: 'email' as const,
    message: 'Valid email is required',
  },
  role: {
    required: true,
    type: 'string' as const,
    validator: (value: unknown) =>
      value === 'OWNER' || value === 'ADMIN' || value === 'MEMBER',
    message: 'Role must be OWNER, ADMIN, or MEMBER',
  },
});

/**
 * Schema for updating member role
 */
export const updateMemberRoleSchema: ValidationSchema = createSchema({
  role: {
    required: true,
    type: 'string' as const,
    validator: (value: unknown) =>
      value === 'OWNER' || value === 'ADMIN' || value === 'MEMBER',
    message: 'Role must be OWNER, ADMIN, or MEMBER',
  },
});

/**
 * Schema for workspace invitation
 */
export const inviteMemberSchema: ValidationSchema = createSchema({
  email: {
    required: true,
    type: 'email' as const,
    message: 'Valid email is required',
  },
  role: {
    required: true,
    type: 'string' as const,
    validator: (value: unknown) => value === 'ADMIN' || value === 'MEMBER',
    message: 'Role must be ADMIN or MEMBER',
  },
  message: {
    type: 'string' as const,
    maxLength: 500,
    message: 'Invitation message must be at most 500 characters',
  },
});

/**
 * Schema for workspace settings
 */
export const workspaceSettingsSchema: ValidationSchema = createSchema({
  allowPublicAccess: {
    type: 'boolean' as const,
    message: 'Allow public access must be true or false',
  },
  defaultMemberRole: {
    type: 'string' as const,
    validator: (value: unknown) => value === 'ADMIN' || value === 'MEMBER',
    message: 'Default member role must be ADMIN or MEMBER',
  },
  features: {
    type: 'object' as const,
    properties: {
      ai: {
        type: 'boolean' as const,
        message: 'AI feature must be true or false',
      },
      knowledge: {
        type: 'boolean' as const,
        message: 'Knowledge feature must be true or false',
      },
      collaboration: {
        type: 'boolean' as const,
        message: 'Collaboration feature must be true or false',
      },
    },
    message:
      'Features must be an object with ai, knowledge, and collaboration properties',
  },
});

/**
 * Schema for workspace transfer
 */
export const transferWorkspaceSchema: ValidationSchema = createSchema({
  newOwnerId: {
    required: true,
    type: 'uuid' as const,
    message: 'Valid user ID is required',
  },
});

/**
 * All workspace schemas for easy import
 */
export const WorkspaceSchemas = {
  create: createWorkspaceSchema,
  update: updateWorkspaceSchema,
  addMember: addMemberSchema,
  updateMemberRole: updateMemberRoleSchema,
  inviteMember: inviteMemberSchema,
  settings: workspaceSettingsSchema,
  transfer: transferWorkspaceSchema,
} as const;
