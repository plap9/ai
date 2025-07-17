import {
  createParamDecorator,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { isAuthenticatedRequest } from '../types/auth.types';

export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request: unknown = ctx.switchToHttp().getRequest();

    if (!isAuthenticatedRequest(request)) {
      throw new UnauthorizedException('User not authenticated');
    }

    return request.user;
  },
);
