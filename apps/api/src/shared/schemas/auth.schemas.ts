import { createSchema, CommonSchemas, mergeSchemas } from '@ai-assistant/utils';
import type { ValidationSchema } from '@ai-assistant/utils';

/**
 * Schema for user login
 */
export const loginSchema: ValidationSchema = CommonSchemas.userLogin;

/**
 * Schema for user registration
 */
export const registerSchema: ValidationSchema = mergeSchemas(
  CommonSchemas.userLogin,
  {
    name: {
      required: true,
      type: 'string' as const,
      minLength: 1,
      maxLength: 100,
      message: 'Name is required and must be 1-100 characters',
    },
  },
);

/**
 * Schema for refresh token request
 */
export const refreshTokenSchema: ValidationSchema = createSchema({
  refreshToken: {
    required: true,
    type: 'string' as const,
    minLength: 1,
    message: 'Refresh token is required',
  },
});

/**
 * Schema for password change
 */
export const changePasswordSchema: ValidationSchema = createSchema({
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
});

/**
 * Schema for forgot password request
 */
export const forgotPasswordSchema: ValidationSchema = createSchema({
  email: {
    required: true,
    type: 'email' as const,
    message: 'Valid email is required',
  },
});

/**
 * Schema for reset password
 */
export const resetPasswordSchema: ValidationSchema = createSchema({
  token: {
    required: true,
    type: 'string' as const,
    minLength: 1,
    message: 'Reset token is required',
  },
  newPassword: {
    required: true,
    type: 'string' as const,
    minLength: 8,
    message: 'New password must be at least 8 characters',
  },
});

/**
 * All auth schemas
 */
export const authSchemas = {
  register: registerSchema,
  login: loginSchema,
  refreshToken: refreshTokenSchema,
  changePassword: changePasswordSchema,
  forgotPassword: forgotPasswordSchema,
  resetPassword: resetPasswordSchema,
} as const;
