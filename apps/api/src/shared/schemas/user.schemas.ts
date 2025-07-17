import {
  createSchema,
  CommonSchemas,
  mergeSchemas,
  makeOptional,
  omitFields,
} from '@ai-assistant/utils';
import type { ValidationSchema } from '@ai-assistant/utils';

/**
 * Schema for creating a new user
 */
export const createUserSchema: ValidationSchema = mergeSchemas(
  CommonSchemas.userRegistration,
  {
    name: {
      required: true,
      type: 'string' as const,
      minLength: 1,
      maxLength: 100,
      message: 'Name is required and must be 1-100 characters',
    },
    role: {
      type: 'string' as const,
      validator: (value: unknown) => value === 'USER' || value === 'ADMIN',
      message: 'Role must be either USER or ADMIN',
    },
  },
);

/**
 * Schema for updating user information (excluding password)
 */
export const updateUserSchema: ValidationSchema = makeOptional(
  omitFields(createUserSchema, ['password']),
);

/**
 * Schema for updating user profile
 */
export const updateProfileSchema: ValidationSchema = createSchema({
  name: {
    type: 'string' as const,
    minLength: 1,
    maxLength: 100,
    message: 'Name must be 1-100 characters',
  },
  bio: {
    type: 'string' as const,
    maxLength: 500,
    message: 'Bio must be at most 500 characters',
  },
  avatar: {
    type: 'string' as const,
    pattern: /^https?:\/\/.+/,
    message: 'Avatar must be a valid URL',
  },
});

/**
 * Schema for changing user password
 */
export const changeUserPasswordSchema: ValidationSchema = createSchema({
  currentPassword: {
    required: true,
    type: 'string' as const,
    minLength: 1,
    message: 'Current password is required',
  },
  newPassword: {
    required: true,
    type: 'string' as const,
    minLength: 8,
    message: 'New password must be at least 8 characters',
  },
  confirmPassword: {
    required: true,
    type: 'string' as const,
    minLength: 8,
    message: 'Confirm password must be at least 8 characters',
  },
});

/**
 * Schema for user preferences
 */
export const userPreferencesSchema: ValidationSchema = createSchema({
  theme: {
    type: 'string' as const,
    validator: (value: unknown) =>
      value === 'light' || value === 'dark' || value === 'system',
    message: 'Theme must be light, dark, or system',
  },
  language: {
    type: 'string' as const,
    pattern: /^[a-z]{2}(-[A-Z]{2})?$/,
    message: 'Language must be in format like "en" or "en-US"',
  },
  timezone: {
    type: 'string' as const,
    minLength: 1,
    message: 'Timezone is required',
  },
  notifications: {
    type: 'object' as const,
    properties: {
      email: {
        type: 'boolean' as const,
        message: 'Email notifications must be true or false',
      },
      push: {
        type: 'boolean' as const,
        message: 'Push notifications must be true or false',
      },
      desktop: {
        type: 'boolean' as const,
        message: 'Desktop notifications must be true or false',
      },
    },
    message:
      'Notifications must be an object with email, push, and desktop properties',
  },
});

/**
 * All user schemas for easy import
 */
export const UserSchemas = {
  create: createUserSchema,
  update: updateUserSchema,
  updateProfile: updateProfileSchema,
  changePassword: changeUserPasswordSchema,
  preferences: userPreferencesSchema,
} as const;
