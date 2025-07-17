// NestJS decorators (@SafeBody, @ValidatedBody, etc.) sẽ được implement ở đây
// Waiting for user to provide the implementation

import { createParamDecorator, ExecutionContext, BadRequestException } from '@nestjs/common';
import { Request } from 'express';
import { SafeParser, ValidationSchema, validateObject, isUUID } from '../type-guards';

/**
 * Type-safe body decorator
 * Usage: @SafeBody() body: SafeParser
 */
export const SafeBody = createParamDecorator((data: unknown, ctx: ExecutionContext): SafeParser => {
  const request = ctx.switchToHttp().getRequest<Request>();
  return new SafeParser(request.body);
});

/**
 * Type-safe query decorator
 * Usage: @SafeQuery() query: SafeParser
 */
export const SafeQuery = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): SafeParser => {
    const request = ctx.switchToHttp().getRequest<Request>();
    return new SafeParser(request.query);
  },
);

/**
 * Type-safe params decorator
 * Usage: @SafeParams() params: SafeParser
 */
export const SafeParams = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): SafeParser => {
    const request = ctx.switchToHttp().getRequest<Request>();
    return new SafeParser(request.params);
  },
);

/**
 * Enhanced validated body decorator với generic typing
 * Usage: @ValidatedBody(schema) body: T
 */
export const ValidatedBody = <T = unknown>(schema: ValidationSchema) => {
  return createParamDecorator((data: unknown, ctx: ExecutionContext): T => {
    const request = ctx.switchToHttp().getRequest<Request>();
    const { valid, errors } = validateObject(request.body, schema);

    if (!valid) {
      throw new BadRequestException({
        statusCode: 400,
        message: 'Validation failed',
        errors,
        timestamp: new Date().toISOString(),
        path: request.url,
      });
    }

    return request.body as T;
  })();
};

/**
 * UUID param decorator với validation
 * Usage: @UUIDParam('id') id: string
 */
export const UUIDParam = createParamDecorator(
  (paramName: string, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest<Request>();
    const value = request.params[paramName];

    if (!isUUID(value)) {
      throw new BadRequestException({
        statusCode: 400,
        message: 'Invalid UUID format',
        errors: [`${paramName} must be a valid UUID`],
        timestamp: new Date().toISOString(),
        path: request.url,
      });
    }

    return value;
  },
);

/**
 * Safe single param decorator
 * Usage: @SafeParam('id') id: string | undefined
 */
export const SafeParam = createParamDecorator(
  (paramName: string, ctx: ExecutionContext): string | undefined => {
    const request = ctx.switchToHttp().getRequest<Request>();
    const parser = new SafeParser(request.params);
    return parser.getString(paramName) || undefined;
  },
);

/**
 * Safe single query decorator
 * Usage: @SafeQueryParam('page') page: number
 */
export const SafeQueryParam = createParamDecorator((paramName: string, ctx: ExecutionContext) => {
  const request = ctx.switchToHttp().getRequest<Request>();
  const parser = new SafeParser(request.query);
  return parser.getString(paramName) || undefined;
});

/**
 * Validated query decorator cho pagination
 * Usage: @ValidatedQuery(schema) query: T
 */
export const ValidatedQuery = <T = unknown>(schema: ValidationSchema) => {
  return createParamDecorator((data: unknown, ctx: ExecutionContext): T => {
    const request = ctx.switchToHttp().getRequest<Request>();
    const { valid, errors } = validateObject(request.query, schema);

    if (!valid) {
      throw new BadRequestException({
        statusCode: 400,
        message: 'Query validation failed',
        errors,
        timestamp: new Date().toISOString(),
        path: request.url,
      });
    }

    return request.query as T;
  })();
};

/**
 * Current user decorator (type-safe)
 * Usage: @CurrentUser() user: UserEntity
 */
export const CurrentUser = createParamDecorator((data: unknown, ctx: ExecutionContext) => {
  const request = ctx.switchToHttp().getRequest<Request>();
  return (request as any).user;
});

/**
 * User ID decorator từ JWT
 * Usage: @UserId() userId: string
 */
export const UserId = createParamDecorator((data: unknown, ctx: ExecutionContext): string => {
  const request = ctx.switchToHttp().getRequest<Request>();
  const user = (request as any).user;

  if (!user?.id || !isUUID(user.id)) {
    throw new BadRequestException({
      statusCode: 400,
      message: 'Invalid user context',
      errors: ['User ID not found or invalid'],
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }

  return user.id;
});
