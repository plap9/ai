import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AuthService } from '../../../modules/auth/auth.service';
import { Request } from 'express';
import { hasRefreshTokenBody } from '../types/auth.types';

interface JwtPayload {
  sub: string;
  email: string;
  role: string;
  type: 'access' | 'refresh';
}

interface AuthenticatedUserWithToken {
  id: string;
  email: string;
  role: string;
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
    payload: JwtPayload,
  ): Promise<AuthenticatedUserWithToken> {
    // Validate that this is a refresh token
    if (payload.type !== 'refresh') {
      throw new UnauthorizedException('Invalid token type');
    }

    // Extract refresh token from request using type guard
    if (!hasRefreshTokenBody(req.body)) {
      throw new UnauthorizedException('Refresh token not provided');
    }

    const refreshToken = req.body.refreshToken;

    // Validate refresh token
    const user = await this.authService.validateRefreshToken(refreshToken);
    if (!user) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    // Return user object that will be attached to req.user
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      refreshToken,
    };
  }
}
