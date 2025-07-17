import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request, Response } from 'express';
import { isObject, hasProperty, isString } from '@ai-assistant/utils';

/**
 * Type guard để check request có user
 */
function hasUserProperty(req: unknown): req is Request & { user?: unknown } {
  return isObject(req) && hasProperty(req, 'user');
}

/**
 * Type guard để extract safe user info
 */
function getSafeUserInfo(user: unknown): { id?: string; email?: string } {
  if (!isObject(user)) return {};

  return {
    id: hasProperty(user, 'id') && isString(user.id) ? user.id : undefined,
    email:
      hasProperty(user, 'email') && isString(user.email)
        ? user.email
        : undefined,
  };
}

/**
 * Enhanced Logging Interceptor với type safety
 */
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(LoggingInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const now = Date.now();
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();

    const method = request.method;
    const url = request.url;
    const headers = request.headers;
    const body = request.body as Record<string, unknown> | undefined;
    const query = request.query;
    const params = request.params;

    // Extract user info safely
    const userInfo = hasUserProperty(request)
      ? getSafeUserInfo(request.user)
      : {};

    // Extract IP address safely
    const userAgent = isString(headers['user-agent'])
      ? headers['user-agent']
      : '';
    const forwardedFor = headers['x-forwarded-for'];
    const realIp = headers['x-real-ip'];
    const ip = this.extractClientIp(forwardedFor, realIp, request.ip);

    // Log request start
    this.logger.log(`${method} ${url} - ${ip} - ${userAgent} - START`, {
      userId: userInfo.id,
      userEmail: userInfo.email,
    });

    if (process.env.NODE_ENV === 'development') {
      this.logger.debug(
        `Request Body: ${JSON.stringify(this.sanitizeData(body))}`,
      );
      this.logger.debug(`Query Params: ${JSON.stringify(query)}`);
      this.logger.debug(`Route Params: ${JSON.stringify(params)}`);
    }

    return next.handle().pipe(
      tap({
        next: (data) => {
          const duration = Date.now() - now;
          this.logger.log(
            `${method} ${url} - ${response.statusCode} - ${duration}ms - SUCCESS`,
            {
              userId: userInfo.id,
              duration,
              statusCode: response.statusCode,
            },
          );

          if (process.env.NODE_ENV === 'development') {
            this.logger.debug(
              `Response: ${JSON.stringify(this.sanitizeData(data))}`,
            );
          }
        },
        error: (error) => {
          const duration = Date.now() - now;
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          const statusCode = response.statusCode || 500;

          this.logger.error(
            `${method} ${url} - ${statusCode} - ${duration}ms - ERROR: ${errorMessage}`,
            {
              userId: userInfo.id,
              duration,
              statusCode,
              error: errorMessage,
              stack: error instanceof Error ? error.stack : undefined,
            },
          );
        },
      }),
    );
  }

  /**
   * Safely extract client IP address
   */
  private extractClientIp(
    forwardedFor: string | string[] | undefined,
    realIp: string | string[] | undefined,
    requestIp: string | undefined,
  ): string {
    if (forwardedFor) {
      const ip = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor;
      if (isString(ip)) return ip;
    }

    if (realIp) {
      const ip = Array.isArray(realIp) ? realIp[0] : realIp;
      if (isString(ip)) return ip;
    }

    return isString(requestIp) ? requestIp : 'unknown';
  }

  /**
   * Sanitize sensitive data trong logs
   */
  private sanitizeData(data: unknown): unknown {
    if (!isObject(data)) return data;

    const sanitized = { ...data };
    const sensitiveFields = [
      'password',
      'token',
      'secret',
      'key',
      'refreshToken',
      'accessToken',
    ];

    for (const field of sensitiveFields) {
      if (hasProperty(sanitized, field)) {
        sanitized[field] = '[REDACTED]';
      }
    }

    return sanitized;
  }
}
