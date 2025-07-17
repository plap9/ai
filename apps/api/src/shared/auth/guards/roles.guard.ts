import { Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { TypeSafeRoleGuard } from '@ai-assistant/utils';

/**
 * Enhanced Roles Guard với type safety
 * Extends TypeSafeRoleGuard từ utils package
 */
@Injectable()
export class RolesGuard extends TypeSafeRoleGuard {
  constructor(reflector: Reflector) {
    super(reflector);
  }

  // TypeSafeRoleGuard đã có implementation đầy đủ
  // Chỉ cần extend và pass reflector
}
