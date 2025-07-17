import {
  createParamDecorator,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import {
  isObject,
  hasProperty,
  isAuthenticatedUser,
  AuthenticatedUser,
} from '@ai-assistant/utils';

/**
 * Type guard cho authenticated request
 */
function isAuthenticatedRequest(
  req: unknown,
): req is { user: AuthenticatedUser } {
  return (
    isObject(req) && hasProperty(req, 'user') && isAuthenticatedUser(req.user)
  );
}

/**
 * Enhanced CurrentUser decorator với type safety
 * Trả về authenticated user object từ request
 */
export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): AuthenticatedUser => {
    const request: unknown = ctx.switchToHttp().getRequest();

    if (!isAuthenticatedRequest(request)) {
      throw new UnauthorizedException({
        statusCode: 401,
        message: 'User not authenticated',
        errors: ['Valid authentication token is required'],
        timestamp: new Date().toISOString(),
      });
    }

    return request.user;
  },
);
