import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { AuthResolver } from './auth.resolver';
import { UserModule } from '../user/user.module';
import { DatabaseModule } from '../../shared/database';
import { CacheModule } from '../../shared/cache';
import { JwtStrategy, JwtRefreshStrategy } from '../../shared/auth/strategies';
import {
  JwtAuthGuard,
  GqlAuthGuard,
  RolesGuard,
} from '../../shared/auth/guards';

@Module({
  imports: [
    UserModule,
    DatabaseModule,
    CacheModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'your-secret-key',
      signOptions: {
        expiresIn: process.env.JWT_EXPIRES_IN || '1h',
      },
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    AuthResolver,
    JwtStrategy,
    JwtRefreshStrategy,
    JwtAuthGuard,
    GqlAuthGuard,
    RolesGuard,
  ],
  exports: [
    AuthService,
    JwtModule,
    PassportModule,
    JwtAuthGuard,
    GqlAuthGuard,
    RolesGuard,
  ],
})
export class AuthModule {}
