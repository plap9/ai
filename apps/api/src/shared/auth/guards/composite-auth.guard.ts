import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  isAuthenticatedRequest,
  AuthenticatedRequest,
  AuthenticatedUser,
  isAuthenticatedUser,
  isObject,
} from '@ai-assistant/utils';

/**
 * Composite authorization requirements
 */
interface CompositeAuthRequirements {
  roles?: string[];
  permissions?: string[];
  workspaceRoles?: string[];
  conditions?: AuthCondition[];
  operator?: 'AND' | 'OR'; // How to combine all requirements
}

/**
 * Custom authorization condition function
 */
type AuthCondition = (
  user: AuthenticatedUser,
  context: ExecutionContext,
) => boolean | Promise<boolean>;

/**
 * Metadata keys for composite auth
 */
export const COMPOSITE_AUTH_KEY = 'composite-auth';
export const AUTH_CONDITIONS_KEY = 'auth-conditions';

/**
 * Decorator để set composite auth requirements
 */
export const CompositeAuth = (requirements: CompositeAuthRequirements) =>
  SetMetadata(COMPOSITE_AUTH_KEY, requirements);

/**
 * Decorator để set custom auth conditions
 */
export const WithAuthConditions = (...conditions: AuthCondition[]) =>
  SetMetadata(AUTH_CONDITIONS_KEY, conditions);

/**
 * Decorator để require specific roles
 */
export const RequireRoles = (...roles: string[]) =>
  CompositeAuth({ roles, operator: 'OR' });

/**
 * Decorator để require all of multiple roles
 */
export const RequireAllRoles = (...roles: string[]) =>
  CompositeAuth({ roles, operator: 'AND' });

/**
 * Decorator để require workspace roles
 */
export const RequireWorkspaceRoles = (...workspaceRoles: string[]) =>
  CompositeAuth({ workspaceRoles, operator: 'OR' });

/**
 * Composite Authorization Guard với advanced logic
 */
@Injectable()
export class CompositeAuthGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Get composite auth requirements from metadata
    const requirements =
      this.reflector.getAllAndOverride<CompositeAuthRequirements>(
        COMPOSITE_AUTH_KEY,
        [context.getHandler(), context.getClass()],
      );

    // Get additional auth conditions
    const conditions = this.reflector.getAllAndOverride<AuthCondition[]>(
      AUTH_CONDITIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    // If no requirements, allow access
    if (!requirements && (!conditions || conditions.length === 0)) {
      return true;
    }

    // Get request and extract user
    const request = context.switchToHttp().getRequest();

    if (!isAuthenticatedRequest(request)) {
      throw new ForbiddenException('Authentication required');
    }

    const authRequest = request as AuthenticatedRequest;
    const user = authRequest.user;

    if (!isAuthenticatedUser(user)) {
      throw new ForbiddenException('Invalid user authentication');
    }

    // Evaluate all requirements
    const results: boolean[] = [];

    // Check role requirements
    if (requirements?.roles) {
      const roleResult = this.checkRoles(
        user,
        requirements.roles,
        requirements.operator,
      );
      results.push(roleResult);
    }

    // Check workspace role requirements
    if (requirements?.workspaceRoles) {
      const workspaceRoleResult = this.checkWorkspaceRoles(
        user,
        requirements.workspaceRoles,
        requirements.operator,
      );
      results.push(workspaceRoleResult);
    }

    // Check permission requirements
    if (requirements?.permissions) {
      const permissionResult = await this.checkPermissions(
        user,
        requirements.permissions,
        requirements.operator,
        context,
      );
      results.push(permissionResult);
    }

    // Check custom conditions
    if (requirements?.conditions) {
      const conditionResult = await this.checkConditions(
        user,
        requirements.conditions,
        requirements.operator,
        context,
      );
      results.push(conditionResult);
    }

    // Check additional conditions from decorator
    if (conditions && conditions.length > 0) {
      const additionalConditionResult = await this.checkConditions(
        user,
        conditions,
        'AND', // Additional conditions must all pass
        context,
      );
      results.push(additionalConditionResult);
    }

    // Combine results based on operator
    const operator = requirements?.operator || 'AND';
    const finalResult =
      operator === 'AND'
        ? results.every((result) => result === true)
        : results.some((result) => result === true);

    if (!finalResult) {
      throw new ForbiddenException('Insufficient permissions');
    }

    return true;
  }

  /**
   * Check user roles
   */
  private checkRoles(
    user: AuthenticatedUser,
    requiredRoles: string[],
    operator: string = 'OR',
  ): boolean {
    if (!user.roles || user.roles.length === 0) {
      return false;
    }

    if (operator === 'AND') {
      return requiredRoles.every((role) => user.roles.includes(role));
    } else {
      return requiredRoles.some((role) => user.roles.includes(role));
    }
  }

  /**
   * Check workspace roles
   */
  private checkWorkspaceRoles(
    user: AuthenticatedUser,
    requiredRoles: string[],
    operator: string = 'OR',
  ): boolean {
    if (!user.workspaces || user.workspaces.length === 0) {
      return false;
    }

    const userWorkspaceRoles = user.workspaces.map((w) => w.role);

    if (operator === 'AND') {
      return requiredRoles.every((role) => userWorkspaceRoles.includes(role));
    } else {
      return requiredRoles.some((role) => userWorkspaceRoles.includes(role));
    }
  }

  /**
   * Check permissions (extensible for future permission system)
   */
  private async checkPermissions(
    user: AuthenticatedUser,
    requiredPermissions: string[],
    operator: string = 'OR',
    context: ExecutionContext,
  ): Promise<boolean> {
    // For now, map permissions to roles
    // In future, this could check against a permission database
    const rolePermissionMap: Record<string, string[]> = {
      ADMIN: ['read', 'write', 'delete', 'manage_users', 'manage_workspaces'],
      USER: ['read', 'write'],
      OWNER: [
        'read',
        'write',
        'delete',
        'manage_users',
        'manage_workspaces',
        'transfer_ownership',
      ],
    };

    const userPermissions = user.roles.flatMap(
      (role) => rolePermissionMap[role] || [],
    );

    if (operator === 'AND') {
      return requiredPermissions.every((permission) =>
        userPermissions.includes(permission),
      );
    } else {
      return requiredPermissions.some((permission) =>
        userPermissions.includes(permission),
      );
    }
  }

  /**
   * Check custom conditions
   */
  private async checkConditions(
    user: AuthenticatedUser,
    conditions: AuthCondition[],
    operator: string = 'AND',
    context: ExecutionContext,
  ): Promise<boolean> {
    const results = await Promise.all(
      conditions.map((condition) => Promise.resolve(condition(user, context))),
    );

    if (operator === 'AND') {
      return results.every((result) => result === true);
    } else {
      return results.some((result) => result === true);
    }
  }
}

/**
 * Common authorization conditions
 */
export class AuthConditions {
  /**
   * Check if user owns the resource
   */
  static isResourceOwner(
    resourceUserIdPath: string = 'params.userId',
  ): AuthCondition {
    return (user: AuthenticatedUser, context: ExecutionContext) => {
      const request = context.switchToHttp().getRequest();
      const resourceUserId = this.getNestedProperty(
        request,
        resourceUserIdPath,
      );
      return user.id === resourceUserId;
    };
  }

  /**
   * Check if user is in the same workspace as resource
   */
  static isSameWorkspace(
    workspaceIdPath: string = 'params.workspaceId',
  ): AuthCondition {
    return (user: AuthenticatedUser, context: ExecutionContext) => {
      const request = context.switchToHttp().getRequest();
      const resourceWorkspaceId = this.getNestedProperty(
        request,
        workspaceIdPath,
      );

      if (!user.workspaces || !resourceWorkspaceId) {
        return false;
      }

      return user.workspaces.some((w) => w.id === resourceWorkspaceId);
    };
  }

  /**
   * Check if it's business hours (example condition)
   */
  static isBusinessHours(): AuthCondition {
    return () => {
      const now = new Date();
      const hour = now.getHours();
      const isWeekday = now.getDay() >= 1 && now.getDay() <= 5;
      const isBusinessHour = hour >= 9 && hour <= 17;

      return isWeekday && isBusinessHour;
    };
  }

  /**
   * Check if user has been active recently
   */
  static isRecentlyActive(hoursThreshold: number = 24): AuthCondition {
    return (user: AuthenticatedUser) => {
      // This would need lastActiveAt field in user object
      // For now, always return true
      return true;
    };
  }

  /**
   * Check if user account is verified
   */
  static isVerified(): AuthCondition {
    return (user: AuthenticatedUser) => {
      // This would need verified field in user object
      // For now, check if user has roles (simplified verification)
      return user.roles && user.roles.length > 0;
    };
  }

  /**
   * Helper để get nested property từ object
   */
  private static getNestedProperty(obj: any, path: string): any {
    return path.split('.').reduce((current, prop) => {
      return current && current[prop] !== undefined ? current[prop] : undefined;
    }, obj);
  }
}

/**
 * Pre-built composite auth decorators
 */

/**
 * Require admin role OR resource ownership
 */
export const AdminOrOwner = (resourceUserIdPath?: string) =>
  CompositeAuth({
    roles: ['ADMIN'],
    conditions: [AuthConditions.isResourceOwner(resourceUserIdPath)],
    operator: 'OR',
  });

/**
 * Require workspace membership AND specific role
 */
export const WorkspaceMemberWithRole = (
  role: string,
  workspaceIdPath?: string,
) =>
  CompositeAuth({
    workspaceRoles: [role],
    conditions: [AuthConditions.isSameWorkspace(workspaceIdPath)],
    operator: 'AND',
  });

/**
 * Require verified account AND business hours
 */
export const VerifiedBusinessHours = () =>
  CompositeAuth({
    conditions: [AuthConditions.isVerified(), AuthConditions.isBusinessHours()],
    operator: 'AND',
  });
