import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AuthService } from '../../../modules/auth/auth.service';
import { Request } from 'express';
import {
  isObject,
  isString,
  isUUID,
  hasProperty,
  AuthenticatedUser,
} from '@ai-assistant/utils';

/**
 * Type guard cho JWT refresh payload từ token
 */
function isValidJwtRefreshPayload(payload: unknown): payload is {
  sub: string;
  email: string;
  role: string;
  type: 'access' | 'refresh';
} {
  return (
    isObject(payload) &&
    hasProperty(payload, 'sub') &&
    hasProperty(payload, 'email') &&
    hasProperty(payload, 'role') &&
    hasProperty(payload, 'type') &&
    isUUID(payload.sub) &&
    isString(payload.email) &&
    isString(payload.role) &&
    (payload.type === 'access' || payload.type === 'refresh')
  );
}

/**
 * Type guard cho request body chứa refresh token
 */
function hasRefreshTokenBody(body: unknown): body is { refreshToken: string } {
  return (
    isObject(body) &&
    hasProperty(body, 'refreshToken') &&
    isString(body.refreshToken) &&
    body.refreshToken.length > 0
  );
}

/**
 * Enhanced AuthenticatedUser với refresh token
 */
interface AuthenticatedUserWithToken extends AuthenticatedUser {
  refreshToken: string;
}

@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(
  Strategy,
  'jwt-refresh',
) {
  constructor(private readonly authService: AuthService) {
    super({
      jwtFromRequest: ExtractJwt.fromBodyField('refreshToken'),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'your-secret-key',
      passReqToCallback: true,
    });
  }

  async validate(
    req: Request,
    payload: unknown,
  ): Promise<AuthenticatedUserWithToken> {
    // Validate payload structure using type guard
    if (!isValidJwtRefreshPayload(payload)) {
      throw new UnauthorizedException({
        statusCode: 401,
        message: 'Invalid refresh token payload',
        errors: ['Refresh token payload does not match expected structure'],
        timestamp: new Date().toISOString(),
      });
    }

    // Validate that this is a refresh token
    if (payload.type !== 'refresh') {
      throw new UnauthorizedException({
        statusCode: 401,
        message: 'Invalid token type',
        errors: ['Only refresh tokens are allowed for token refresh'],
        timestamp: new Date().toISOString(),
      });
    }

    // Extract refresh token from request using type guard
    if (!hasRefreshTokenBody(req.body)) {
      throw new UnauthorizedException({
        statusCode: 401,
        message: 'Refresh token not provided',
        errors: ['Request body must contain a valid refreshToken'],
        timestamp: new Date().toISOString(),
      });
    }

    const refreshToken = req.body.refreshToken;

    // Validate refresh token
    const user = await this.authService.validateRefreshToken(refreshToken);
    if (!user) {
      throw new UnauthorizedException({
        statusCode: 401,
        message: 'Invalid refresh token',
        errors: ['Refresh token is invalid or expired'],
        timestamp: new Date().toISOString(),
      });
    }

    // Return type-safe user object that will be attached to req.user
    return {
      id: user.id,
      email: user.email,
      roles: [user.role], // Convert single role to array for consistency
      workspaces: [], // Will be populated by user service if needed
      refreshToken,
    };
  }
}
