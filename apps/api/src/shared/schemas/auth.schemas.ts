import { createSchema } from '@ai-assistant/utils';

/**
 * Schema cho user registration
 */
export const registerSchema = createSchema({
  email: {
    required: true,
    type: 'email' as const,
    message: 'Valid email address is required',
  },
  password: {
    required: true,
    type: 'string' as const,
    minLength: 8,
    maxLength: 100,
    message: 'Password must be 8-100 characters long',
  },
  name: {
    required: true,
    type: 'string' as const,
    minLength: 2,
    maxLength: 50,
    message: 'Name must be 2-50 characters long',
  },
});

/**
 * Schema cho user login
 */
export const loginSchema = createSchema({
  email: {
    required: true,
    type: 'email' as const,
    message: 'Valid email address is required',
  },
  password: {
    required: true,
    type: 'string' as const,
    minLength: 1,
    message: 'Password is required',
  },
});

/**
 * Schema cho refresh token request
 */
export const refreshTokenSchema = createSchema({
  refreshToken: {
    required: true,
    type: 'string' as const,
    minLength: 10,
    message: 'Valid refresh token is required',
  },
});

/**
 * All auth schemas
 */
export const authSchemas = {
  register: registerSchema,
  login: loginSchema,
  refreshToken: refreshTokenSchema,
} as const;
