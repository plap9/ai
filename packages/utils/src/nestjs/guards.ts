import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  ForbiddenException,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { Observable } from 'rxjs';
import { isObject, hasProperty, isString, isArray, isUUID } from '../type-guards';

/**
 * Interface cho authenticated user
 */
export interface AuthenticatedUser {
  id: string;
  email: string;
  roles: string[];
  workspaces: Array<{
    id: string;
    role: string;
  }>;
}

/**
 * Type guard cho authenticated user
 */
export function isAuthenticatedUser(user: unknown): user is AuthenticatedUser {
  return (
    isObject(user) &&
    hasProperty(user, 'id') &&
    hasProperty(user, 'email') &&
    hasProperty(user, 'roles') &&
    hasProperty(user, 'workspaces') &&
    isUUID(user.id) &&
    isString(user.email) &&
    isArray(user.roles) &&
    isArray(user.workspaces)
  );
}

/**
 * Enhanced JWT Guard với type safety
 */
@Injectable()
export class TypeSafeJwtGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean | Promise<boolean> | Observable<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const user = (request as any).user;

    if (!isAuthenticatedUser(user)) {
      throw new UnauthorizedException({
        statusCode: 401,
        message: 'Authentication required',
        errors: ['Invalid or missing authentication token'],
        timestamp: new Date().toISOString(),
      });
    }

    return true;
  }
}

/**
 * Permission metadata key
 */
export const PERMISSIONS_KEY = 'permissions';

/**
 * Roles metadata key
 */
export const ROLES_KEY = 'roles';

/**
 * Public route metadata key
 */
export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Workspace permission metadata key
 */
export const WORKSPACE_PERMISSIONS_KEY = 'workspacePermissions';

/**
 * Decorators for guards
 */
export const RequirePermissions = (...permissions: string[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);

export const RequireRoles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);

export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

export const RequireWorkspaceRole = (...roles: string[]) =>
  SetMetadata(WORKSPACE_PERMISSIONS_KEY, roles);

/**
 * Enhanced Role Guard với type safety
 */
@Injectable()
export class TypeSafeRoleGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // Check if route is public
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const user = (request as any).user;

    if (!isAuthenticatedUser(user)) {
      throw new UnauthorizedException({
        statusCode: 401,
        message: 'Authentication required',
        errors: ['User not authenticated'],
        timestamp: new Date().toISOString(),
      });
    }

    // Check required roles
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (requiredRoles && requiredRoles.length > 0) {
      const hasRole = requiredRoles.some((role: string) => user.roles.includes(role));

      if (!hasRole) {
        throw new ForbiddenException({
          statusCode: 403,
          message: 'Insufficient permissions',
          errors: [`Required roles: ${requiredRoles.join(', ')}`],
          timestamp: new Date().toISOString(),
        });
      }
    }

    return true;
  }
}

/**
 * Workspace Permission Guard
 */
@Injectable()
export class WorkspacePermissionGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(WORKSPACE_PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const user = (request as any).user;

    if (!isAuthenticatedUser(user)) {
      throw new UnauthorizedException({
        statusCode: 401,
        message: 'Authentication required',
        errors: ['User not authenticated'],
        timestamp: new Date().toISOString(),
      });
    }

    // Get workspace ID from params
    const workspaceId = request.params?.workspaceId;

    if (!isUUID(workspaceId)) {
      throw new ForbiddenException({
        statusCode: 403,
        message: 'Invalid workspace',
        errors: ['Workspace ID is required and must be valid UUID'],
        timestamp: new Date().toISOString(),
      });
    }

    // Check workspace permission
    const userWorkspace = user.workspaces.find((ws) => ws.id === workspaceId);

    if (!userWorkspace) {
      throw new ForbiddenException({
        statusCode: 403,
        message: 'Workspace access denied',
        errors: ['User is not a member of this workspace'],
        timestamp: new Date().toISOString(),
      });
    }

    const hasPermission = requiredRoles.includes(userWorkspace.role);

    if (!hasPermission) {
      throw new ForbiddenException({
        statusCode: 403,
        message: 'Insufficient workspace permissions',
        errors: [`Required workspace roles: ${requiredRoles.join(', ')}`],
        timestamp: new Date().toISOString(),
      });
    }

    return true;
  }
}

/**
 * API Rate Limiting Guard với Redis (optional)
 */
@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(
    private readonly limit: number = 100,
    private readonly windowMs: number = 15 * 60 * 1000, // 15 minutes
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const identifier = this.getIdentifier(request);

    // In real implementation, use Redis for distributed rate limiting
    // For now, use in-memory storage (not suitable for production)
    const key = `rate_limit:${identifier}`;

    // This is a simplified implementation
    // In production, integrate with Redis or similar

    return true; // Placeholder - implement actual rate limiting logic
  }

  private getIdentifier(request: Request): string {
    const user = (request as any).user;

    if (isAuthenticatedUser(user)) {
      return `user:${user.id}`;
    }

    // Fallback to IP address
    return `ip:${request.ip || request.socket.remoteAddress || 'unknown'}`;
  }
}

/**
 * Feature Flag Guard
 */
@Injectable()
export class FeatureFlagGuard implements CanActivate {
  constructor(private readonly flagName: string) {}

  canActivate(context: ExecutionContext): boolean {
    // In real implementation, check feature flag service
    // For now, always allow

    const isEnabled = process.env[`FEATURE_${this.flagName.toUpperCase()}`] === 'true';

    if (!isEnabled) {
      throw new ForbiddenException({
        statusCode: 403,
        message: 'Feature not available',
        errors: [`Feature '${this.flagName}' is not enabled`],
        timestamp: new Date().toISOString(),
      });
    }

    return true;
  }
}

/**
 * Composite guard để combine multiple guards
 */
export function createCompositeGuard(...guards: Array<new (...args: any[]) => CanActivate>) {
  @Injectable()
  class CompositeGuard implements CanActivate {
    public guardInstances: CanActivate[];

    constructor() {
      this.guardInstances = guards.map((GuardClass) => new GuardClass());
    }

    async canActivate(context: ExecutionContext): Promise<boolean> {
      for (const guard of this.guardInstances) {
        const result = await guard.canActivate(context);
        if (!result) {
          return false;
        }
      }
      return true;
    }
  }

  return CompositeGuard;
}
