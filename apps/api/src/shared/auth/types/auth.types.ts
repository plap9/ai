import { UserRole } from '@prisma/client';

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: UserRole;
}

export interface AuthenticatedRequest {
  user: AuthenticatedUser;
}

export interface RefreshTokenRequest {
  body: {
    refreshToken: string;
  };
}

// Type Guards
export function isAuthenticatedUser(user: unknown): user is AuthenticatedUser {
  return (
    typeof user === 'object' &&
    user !== null &&
    typeof (user as Record<string, unknown>).id === 'string' &&
    typeof (user as Record<string, unknown>).email === 'string' &&
    typeof (user as Record<string, unknown>).role === 'string' &&
    Object.values(UserRole).includes(
      (user as Record<string, unknown>).role as UserRole,
    )
  );
}

export function isAuthenticatedRequest(
  req: unknown,
): req is AuthenticatedRequest {
  return (
    typeof req === 'object' &&
    req !== null &&
    'user' in req &&
    isAuthenticatedUser((req as Record<string, unknown>).user)
  );
}

export function hasRefreshTokenBody(
  body: unknown,
): body is { refreshToken: string } {
  return (
    typeof body === 'object' &&
    body !== null &&
    'refreshToken' in body &&
    typeof (body as Record<string, unknown>).refreshToken === 'string'
  );
}
