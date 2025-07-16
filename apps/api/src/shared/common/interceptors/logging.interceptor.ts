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

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(LoggingInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const now = Date.now();
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();

    const method = request.method;
    const url = request.url;
    const headers = request.headers;
    const body = request.body as Record<string, unknown> | undefined;
    const query = request.query;
    const params = request.params;

    const userAgent = headers['user-agent'] || '';
    const forwardedFor = headers['x-forwarded-for'];
    const realIp = headers['x-real-ip'];
    const ip =
      (Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor) ||
      (Array.isArray(realIp) ? realIp[0] : realIp) ||
      request.ip ||
      'unknown';

    this.logger.log(`${method} ${url} - ${ip} - ${userAgent} - START`);

    if (process.env.NODE_ENV === 'development') {
      this.logger.debug(`Request Body: ${JSON.stringify(body)}`);
      this.logger.debug(`Query Params: ${JSON.stringify(query)}`);
      this.logger.debug(`Route Params: ${JSON.stringify(params)}`);
    }

    return next.handle().pipe(
      tap({
        next: (data) => {
          const duration = Date.now() - now;
          this.logger.log(
            `${method} ${url} - ${response.statusCode} - ${duration}ms - SUCCESS`,
          );

          if (process.env.NODE_ENV === 'development') {
            this.logger.debug(`Response: ${JSON.stringify(data)}`);
          }
        },
        error: (error) => {
          const duration = Date.now() - now;
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          this.logger.error(
            `${method} ${url} - ${response.statusCode || 500} - ${duration}ms - ERROR: ${errorMessage}`,
          );
        },
      }),
    );
  }
}
