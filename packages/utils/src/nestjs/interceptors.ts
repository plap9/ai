import { Injectable, NestInterceptor, ExecutionContext, CallHandler, Logger } from '@nestjs/common';
import { Observable, tap, catchError, map } from 'rxjs';
import { Request, Response } from 'express';
import { SafeParser } from '../type-guards';

/**
 * Interceptor để add SafeParser vào request
 */
@Injectable()
export class SafeParserInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<Request>();

    // Add safe parsers to request
    (request as any).safeBody = new SafeParser(request.body);
    (request as any).safeQuery = new SafeParser(request.query);
    (request as any).safeParams = new SafeParser(request.params);

    return next.handle();
  }
}

/**
 * Logging interceptor cho validation và API calls
 */
@Injectable()
export class ValidationLoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(ValidationLoggingInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<Request>();
    const { method, url, body, query, params } = request;
    const now = Date.now();

    // Log incoming request
    this.logger.log(`${method} ${url} - Request received`, {
      body: this.sanitizeData(body),
      query: this.sanitizeData(query),
      params: this.sanitizeData(params),
    });

    return next.handle().pipe(
      tap(() => {
        const duration = Date.now() - now;
        this.logger.log(`${method} ${url} - Completed in ${duration}ms`);
      }),
      catchError((error) => {
        const duration = Date.now() - now;
        this.logger.error(`${method} ${url} - Failed in ${duration}ms`, {
          error: error.message,
          stack: error.stack,
        });
        throw error;
      }),
    );
  }

  private sanitizeData(data: any): any {
    if (!data || typeof data !== 'object') return data;

    const sanitized = { ...data };
    // Remove sensitive fields
    const sensitiveFields = ['password', 'token', 'secret', 'key'];

    for (const field of sensitiveFields) {
      if (sanitized[field]) {
        sanitized[field] = '[REDACTED]';
      }
    }

    return sanitized;
  }
}

/**
 * Response formatting interceptor
 */
@Injectable()
export class ResponseFormattingInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const response = context.switchToHttp().getResponse<Response>();

    return next.handle().pipe(
      map((data) => {
        // Nếu data đã là formatted response thì return as-is
        if (data && typeof data === 'object' && 'statusCode' in data) {
          return data;
        }

        // Format standard success response
        return {
          statusCode: response.statusCode,
          message: 'Success',
          data,
          timestamp: new Date().toISOString(),
        };
      }),
    );
  }
}

/**
 * Error formatting interceptor
 */
@Injectable()
export class ErrorFormattingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(ErrorFormattingInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      catchError((error) => {
        const request = context.switchToHttp().getRequest<Request>();
        const response = context.switchToHttp().getResponse<Response>();

        // Log error
        this.logger.error(`Error in ${request.method} ${request.url}`, {
          message: error.message,
          stack: error.stack,
          body: this.sanitizeData(request.body),
        });

        // Format error response
        const errorResponse = {
          statusCode: error.status || 500,
          message: error.message || 'Internal server error',
          errors: error.errors || [],
          timestamp: new Date().toISOString(),
          path: request.url,
        };

        response.status(errorResponse.statusCode).json(errorResponse);
        return new Observable(); // Prevent further processing
      }),
    );
  }

  private sanitizeData(data: any): any {
    if (!data || typeof data !== 'object') return data;

    const sanitized = { ...data };
    const sensitiveFields = ['password', 'token', 'secret', 'key'];

    for (const field of sensitiveFields) {
      if (sanitized[field]) {
        sanitized[field] = '[REDACTED]';
      }
    }

    return sanitized;
  }
}

/**
 * Performance monitoring interceptor
 */
@Injectable()
export class PerformanceInterceptor implements NestInterceptor {
  private readonly logger = new Logger(PerformanceInterceptor.name);
  private readonly slowRequestThreshold = 1000; // 1 second

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<Request>();
    const startTime = Date.now();

    return next.handle().pipe(
      tap(() => {
        const duration = Date.now() - startTime;

        if (duration > this.slowRequestThreshold) {
          this.logger.warn(`Slow request detected: ${request.method} ${request.url}`, {
            duration: `${duration}ms`,
            threshold: `${this.slowRequestThreshold}ms`,
          });
        }
      }),
    );
  }
}

/**
 * Cache control interceptor
 */
@Injectable()
export class CacheControlInterceptor implements NestInterceptor {
  constructor(private cacheControl: string = 'no-cache, no-store, must-revalidate') {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const response = context.switchToHttp().getResponse<Response>();

    return next.handle().pipe(
      tap(() => {
        response.header('Cache-Control', this.cacheControl);
        response.header('Pragma', 'no-cache');
        response.header('Expires', '0');
      }),
    );
  }
}
