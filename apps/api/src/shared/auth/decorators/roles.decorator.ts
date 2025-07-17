import { SetMetadata } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { ROLES_KEY } from '@ai-assistant/utils';

// Export type-safe decorators từ utils package
export { RequireRoles } from '@ai-assistant/utils';

/**
 * Enhanced Roles decorator với type safety
 * Marks routes với required user roles
 */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);

// Re-export ROLES_KEY for consistency
export { ROLES_KEY };
