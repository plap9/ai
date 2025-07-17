import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Request, Response } from 'express';
import { isObject, hasProperty, isNumber } from '@ai-assistant/utils';

/**
 * Standard API response interface
 */
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  timestamp: string;
  path: string;
  statusCode: number;
}

/**
 * Type guard để check if response is already formatted
 */
function isFormattedResponse(data: unknown): data is ApiResponse<unknown> {
  return (
    isObject(data) &&
    hasProperty(data, 'success') &&
    hasProperty(data, 'timestamp') &&
    hasProperty(data, 'statusCode') &&
    hasProperty(data, 'path')
  );
}

/**
 * Type guard để check if response has error structure
 */
function isErrorResponse(
  data: unknown,
): data is { statusCode: number; message: string } {
  return (
    isObject(data) &&
    hasProperty(data, 'statusCode') &&
    hasProperty(data, 'message') &&
    isNumber(data.statusCode)
  );
}

/**
 * Enhanced Transform Interceptor với type safety
 * Standardizes all API responses
 */
@Injectable()
export class TransformInterceptor<T>
  implements NestInterceptor<T, ApiResponse<T>>
{
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<ApiResponse<T>> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();

    return next.handle().pipe(
      map((data: T) => {
        // If data is already formatted, return as-is
        if (isFormattedResponse(data)) {
          return data as ApiResponse<T>;
        }

        // If data is an error response, preserve error structure
        if (isErrorResponse(data)) {
          return {
            success: false,
            data: data as T,
            message: data.message,
            timestamp: new Date().toISOString(),
            path: request.url,
            statusCode: data.statusCode,
          };
        }

        // Format standard success response
        return {
          success: true,
          data,
          message: this.getSuccessMessage(response.statusCode),
          timestamp: new Date().toISOString(),
          path: request.url,
          statusCode: response.statusCode,
        };
      }),
    );
  }

  /**
   * Get appropriate success message based on status code
   */
  private getSuccessMessage(statusCode: number): string {
    switch (statusCode) {
      case 200:
        return 'Success';
      case 201:
        return 'Created successfully';
      case 202:
        return 'Accepted';
      case 204:
        return 'No content';
      default:
        return 'Success';
    }
  }
}
