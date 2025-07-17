import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { UserService } from '../../../modules/user/user.service';
import {
  isObject,
  isString,
  isUUID,
  hasProperty,
  AuthenticatedUser,
} from '@ai-assistant/utils';

/**
 * Type guard cho JWT payload từ token
 */
function isValidJwtPayload(payload: unknown): payload is {
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

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly userService: UserService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'your-secret-key',
    });
  }

  async validate(payload: unknown): Promise<AuthenticatedUser> {
    // Validate payload structure using type guard
    if (!isValidJwtPayload(payload)) {
      throw new UnauthorizedException({
        statusCode: 401,
        message: 'Invalid token payload',
        errors: ['Token payload does not match expected structure'],
        timestamp: new Date().toISOString(),
      });
    }

    // Validate that this is an access token
    if (payload.type !== 'access') {
      throw new UnauthorizedException({
        statusCode: 401,
        message: 'Invalid token type',
        errors: ['Only access tokens are allowed for authentication'],
        timestamp: new Date().toISOString(),
      });
    }

    // Get user from database
    const user = await this.userService.findById(payload.sub);
    if (!user) {
      throw new UnauthorizedException({
        statusCode: 401,
        message: 'User not found',
        errors: ['User associated with token no longer exists'],
        timestamp: new Date().toISOString(),
      });
    }

    // Return type-safe user object that will be attached to req.user
    return {
      id: user.id,
      email: user.email,
      roles: [user.role], // Convert single role to array for consistency
      workspaces: [], // Will be populated by user service if needed
    };
  }
}
