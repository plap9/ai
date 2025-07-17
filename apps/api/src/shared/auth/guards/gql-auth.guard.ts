import {
  Injectable,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { Request } from 'express';
import {
  isAuthenticatedUser,
  isObject,
  hasProperty,
} from '@ai-assistant/utils';

/**
 * Type guard cho GraphQL context
 */
function isGraphQLContext(context: unknown): context is { req: Request } {
  return (
    isObject(context) && hasProperty(context, 'req') && isObject(context.req)
  );
}

/**
 * Type guard cho Express request với user
 */
function isRequestWithUser(req: unknown): req is Request & { user?: unknown } {
  return isObject(req) && hasProperty(req, 'user');
}

/**
 * Enhanced GraphQL Auth Guard với type safety
 */
@Injectable()
export class GqlAuthGuard {
  canActivate(context: ExecutionContext): boolean {
    const request = this.getRequest(context);

    if (!isRequestWithUser(request)) {
      throw new UnauthorizedException({
        statusCode: 401,
        message: 'Invalid request object',
        errors: ['Request object does not contain user property'],
        timestamp: new Date().toISOString(),
      });
    }

    if (!isAuthenticatedUser(request.user)) {
      throw new UnauthorizedException({
        statusCode: 401,
        message: 'Authentication required',
        errors: ['Invalid or missing authentication token'],
        timestamp: new Date().toISOString(),
      });
    }

    return true;
  }

  getRequest(context: ExecutionContext): Request {
    const ctx = GqlExecutionContext.create(context);
    const gqlContext: unknown = ctx.getContext();

    if (!isGraphQLContext(gqlContext)) {
      throw new UnauthorizedException({
        statusCode: 401,
        message: 'Invalid GraphQL context',
        errors: ['GraphQL context does not contain request object'],
        timestamp: new Date().toISOString(),
      });
    }

    return gqlContext.req;
  }
}
