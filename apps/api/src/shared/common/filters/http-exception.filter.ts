import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: HttpException, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const status = exception.getStatus();

    const errorResponse = exception.getResponse();
    const errorMessage =
      typeof errorResponse === 'string'
        ? errorResponse
        : (errorResponse as { message?: string })?.message ||
          'Internal server error';

    const errorData = {
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
      message: errorMessage,
      error: HttpStatus[status],
    };

    // Log error details
    this.logger.error(
      `HTTP ${status} Error: ${errorMessage}`,
      JSON.stringify({
        url: request.url,
        method: request.method,
        headers: request.headers,
        body: request.body ? JSON.stringify(request.body) : undefined,
        query: request.query,
        params: request.params,
        stack: exception.stack,
      }),
    );

    response.status(status).json(errorData);
  }
}
