import { ValidationSchema, ValidationRule, validateObject } from './type-guards';

/**
 * Validation error class
 */
export class ValidationError extends Error {
  public readonly errors: string[];

  constructor(message: string, errors: string[]) {
    super(message);
    this.name = 'ValidationError';
    this.errors = errors;
  }
}

/**
 * Validation result interface
 */
export interface ValidationResult<T = unknown> {
  valid: boolean;
  data?: T;
  errors: string[];
}

/**
 * Validate và parse data với schema
 */
export function validateAndParse<T = unknown>(
  data: unknown,
  schema: ValidationSchema,
): ValidationResult<T> {
  const validation = validateObject(data, schema);

  return {
    valid: validation.valid,
    data: validation.valid ? (data as T) : undefined,
    errors: validation.errors,
  };
}

/**
 * Validate và throw error nếu invalid
 */
export function validateOrThrow<T = unknown>(data: unknown, schema: ValidationSchema): T {
  const result = validateAndParse<T>(data, schema);

  if (!result.valid) {
    throw new ValidationError('Validation failed', result.errors);
  }

  return result.data!;
}

/**
 * Pre-defined validation schemas
 */
export const CommonSchemas = {
  /**
   * Schema cho pagination
   */
  pagination: {
    page: {
      type: 'number' as const,
      min: 1,
      message: 'Page must be a positive number',
    },
    limit: {
      type: 'number' as const,
      min: 1,
      max: 100,
      message: 'Limit must be between 1 and 100',
    },
  },

  /**
   * Schema cho user registration
   */
  userRegistration: {
    email: {
      required: true,
      type: 'email' as const,
      message: 'Valid email is required',
    },
    password: {
      required: true,
      type: 'string' as const,
      minLength: 8,
      message: 'Password must be at least 8 characters',
    },
    firstName: {
      required: true,
      type: 'string' as const,
      minLength: 1,
      maxLength: 50,
      message: 'First name is required and must be 1-50 characters',
    },
    lastName: {
      required: true,
      type: 'string' as const,
      minLength: 1,
      maxLength: 50,
      message: 'Last name is required and must be 1-50 characters',
    },
  },

  /**
   * Schema cho user login
   */
  userLogin: {
    email: {
      required: true,
      type: 'email' as const,
      message: 'Valid email is required',
    },
    password: {
      required: true,
      type: 'string' as const,
      minLength: 1,
      message: 'Password is required',
    },
  },

  /**
   * Schema cho workspace creation
   */
  workspaceCreation: {
    name: {
      required: true,
      type: 'string' as const,
      minLength: 1,
      maxLength: 100,
      message: 'Workspace name is required and must be 1-100 characters',
    },
    description: {
      type: 'string' as const,
      maxLength: 500,
      message: 'Description must be at most 500 characters',
    },
  },

  /**
   * Schema cho UUID parameter
   */
  uuidParam: {
    id: {
      required: true,
      type: 'uuid' as const,
      message: 'Valid UUID is required',
    },
  },
} as const satisfies Record<string, ValidationSchema>;

/**
 * Helper để create custom schema
 */
export function createSchema(schema: ValidationSchema): ValidationSchema {
  return schema;
}

/**
 * Merge multiple schemas
 */
export function mergeSchemas(...schemas: ValidationSchema[]): ValidationSchema {
  return schemas.reduce((merged, schema) => ({ ...merged, ...schema }), {});
}

/**
 * Make all fields optional trong schema
 */
export function makeOptional(schema: ValidationSchema): ValidationSchema {
  const optional: ValidationSchema = {};

  for (const [key, rule] of Object.entries(schema)) {
    optional[key] = { ...rule, required: false };
  }

  return optional;
}

/**
 * Pick specific fields từ schema
 */
export function pickFields(schema: ValidationSchema, fields: string[]): ValidationSchema {
  const picked: ValidationSchema = {};

  for (const field of fields) {
    if (schema[field]) {
      picked[field] = schema[field];
    }
  }

  return picked;
}

/**
 * Omit specific fields từ schema
 */
export function omitFields(schema: ValidationSchema, fields: string[]): ValidationSchema {
  const omitted: ValidationSchema = {};

  for (const [key, rule] of Object.entries(schema)) {
    if (!fields.includes(key)) {
      omitted[key] = rule;
    }
  }

  return omitted;
}
