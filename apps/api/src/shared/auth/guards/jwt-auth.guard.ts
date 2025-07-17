import { Injectable, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { TypeSafeJwtGuard, IS_PUBLIC_KEY } from '@ai-assistant/utils';

/**
 * Enhanced JWT Auth Guard với type safety và public route support
 * Extends TypeSafeJwtGuard từ utils package
 */
@Injectable()
export class JwtAuthGuard extends TypeSafeJwtGuard {
  constructor(private reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    // Check if route is marked as public
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    // Use type-safe validation from parent class
    return super.canActivate(context);
  }
}
