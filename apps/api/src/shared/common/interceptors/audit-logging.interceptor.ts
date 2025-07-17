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
import { Reflector } from '@nestjs/core';
import {
  isString,
  isObject,
  isUUID,
  SafeParser,
  type AuthenticatedUser,
  type AuditLogLevel,
} from '@ai-assistant/utils';

export interface AuditLogData {
  userId?: string;
  action: string;
  resource: string;
  resourceId?: string;
  workspaceId?: string;
  ipAddress: string;
  userAgent: string;
  requestId: string;
  timestamp: string;
  level: AuditLogLevel;
  details?: Record<string, unknown>;
  success: boolean;
  errorMessage?: string;
  responseTime?: number;
}

export interface AuditLogContext {
  action: string;
  resource: string;
  level?: AuditLogLevel;
  sensitive?: boolean;
  skipLogging?: boolean;
}

// Decorator để đánh dấu endpoints cần audit logging
export const AuditLog = (context: AuditLogContext) =>
  Reflector.createDecorator<AuditLogContext>()(context);

// Pre-built decorators cho các hành động thường gặp
export const AuditAuth = (action: string) =>
  AuditLog({ action, resource: 'auth', level: 'SECURITY' });

export const AuditUser = (action: string) =>
  AuditLog({ action, resource: 'user', level: 'INFO' });

export const AuditWorkspace = (action: string) =>
  AuditLog({ action, resource: 'workspace', level: 'INFO' });

export const AuditSensitive = (action: string, resource: string) =>
  AuditLog({ action, resource, level: 'SECURITY', sensitive: true });

export const AuditCritical = (action: string, resource: string) =>
  AuditLog({ action, resource, level: 'CRITICAL' });

@Injectable()
export class AuditLoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditLoggingInterceptor.name);

  constructor(private readonly reflector: Reflector) {}

  private isValidAuditContext(context: unknown): context is AuditLogContext {
    return (
      isObject(context) &&
      isString((context as any).action) &&
      isString((context as any).resource)
    );
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const startTime = Date.now();
    const rawAuditContext = this.reflector.get(AuditLog, context.getHandler());

    // Type guard để check valid audit context
    if (
      !this.isValidAuditContext(rawAuditContext) ||
      rawAuditContext.skipLogging
    ) {
      return next.handle();
    }

    const auditContext = rawAuditContext;
    const request = this.extractRequest(context);
    const user = this.extractUser(request);
    const requestId = this.generateRequestId();

    const baseLogData: Partial<AuditLogData> = {
      userId: user?.id,
      action: auditContext.action,
      resource: auditContext.resource,
      workspaceId: this.extractWorkspaceId(request),
      ipAddress: this.extractIpAddress(request),
      userAgent: this.extractUserAgent(request),
      requestId,
      timestamp: new Date().toISOString(),
      level: auditContext.level || 'INFO',
    };

    return next.handle().pipe(
      tap({
        next: (data) => {
          const responseTime = Date.now() - startTime;
          const logData: AuditLogData = {
            ...baseLogData,
            resourceId: this.extractResourceId(data, request),
            success: true,
            responseTime,
            details: this.buildDetails(request, data, auditContext),
          } as AuditLogData;

          this.writeAuditLog(logData);
        },
        error: (error) => {
          const responseTime = Date.now() - startTime;
          const logData: AuditLogData = {
            ...baseLogData,
            success: false,
            errorMessage: this.extractErrorMessage(error),
            responseTime,
            details: this.buildErrorDetails(request, error, auditContext),
          } as AuditLogData;

          this.writeAuditLog(logData);
        },
      }),
    );
  }

  private extractRequest(context: ExecutionContext): Request {
    const http = context.switchToHttp();
    const request = http.getRequest<Request>();

    if (!isObject(request)) {
      throw new Error('Invalid request object');
    }

    return request;
  }

  private extractUser(request: Request): AuthenticatedUser | undefined {
    const parser = new SafeParser(request.user);

    if (!parser.has('id') || !isUUID(parser.getString('id'))) {
      return undefined;
    }

    return request.user as AuthenticatedUser;
  }

  private extractWorkspaceId(request: Request): string | undefined {
    const parser = new SafeParser(request.params);
    const workspaceId = parser.getString('workspaceId');

    if (isUUID(workspaceId)) {
      return workspaceId;
    }

    // Check body for workspace ID
    const bodyParser = new SafeParser(request.body);
    const bodyWorkspaceId = bodyParser.getString('workspaceId');

    return isUUID(bodyWorkspaceId) ? bodyWorkspaceId : undefined;
  }

  private extractIpAddress(request: Request): string {
    const parser = new SafeParser(request.headers);

    // Check X-Forwarded-For first (for proxies)
    const forwardedFor = parser.getString('x-forwarded-for');
    if (isString(forwardedFor) && forwardedFor.length > 0) {
      return forwardedFor.split(',')[0].trim();
    }

    // Check X-Real-IP
    const realIp = parser.getString('x-real-ip');
    if (isString(realIp) && realIp.length > 0) {
      return realIp;
    }

    // Fallback to connection IP
    return request.ip || request.connection?.remoteAddress || 'unknown';
  }

  private extractUserAgent(request: Request): string {
    const parser = new SafeParser(request.headers);
    const userAgent = parser.getString('user-agent');

    return isString(userAgent) ? userAgent : 'unknown';
  }

  private extractResourceId(
    data: unknown,
    request: Request,
  ): string | undefined {
    // Try to extract from response data first
    const dataParser = new SafeParser(data);
    const responseId = dataParser.getString('id');

    if (isUUID(responseId)) {
      return responseId;
    }

    // Try to extract from request params
    const paramsParser = new SafeParser(request.params);
    const paramId = paramsParser.getString('id');

    return isUUID(paramId) ? paramId : undefined;
  }

  private extractErrorMessage(error: unknown): string {
    const parser = new SafeParser(error);

    if (parser.has('message')) {
      const message = parser.getString('message');
      return isString(message) ? message : 'Unknown error';
    }

    return 'Unknown error';
  }

  private buildDetails(
    request: Request,
    data: unknown,
    context: AuditLogContext,
  ): Record<string, unknown> {
    const details: Record<string, unknown> = {
      method: request.method,
      url: request.url,
    };

    // Add request body if not sensitive
    if (!context.sensitive && request.body) {
      const bodyParser = new SafeParser(request.body);
      details.requestBody = this.sanitizeData(bodyParser.getRaw());
    }

    // Add query parameters
    if (request.query && Object.keys(request.query).length > 0) {
      details.queryParams = request.query;
    }

    // Add response data summary (not full data for performance)
    const dataParser = new SafeParser(data);
    if (dataParser.has('id')) {
      details.responseId = dataParser.getString('id');
    }

    return details;
  }

  private buildErrorDetails(
    request: Request,
    error: unknown,
    context: AuditLogContext,
  ): Record<string, unknown> {
    const details: Record<string, unknown> = {
      method: request.method,
      url: request.url,
    };

    const errorParser = new SafeParser(error);

    if (errorParser.has('status')) {
      details.statusCode = errorParser.getNumber('status');
    }

    if (errorParser.has('code')) {
      details.errorCode = errorParser.getString('code');
    }

    // Add stack trace for debugging (in development)
    if (process.env.NODE_ENV === 'development' && errorParser.has('stack')) {
      details.stack = errorParser.getString('stack');
    }

    return details;
  }

  private sanitizeData(data: unknown): unknown {
    if (!isObject(data)) {
      return data;
    }

    const sensitive_fields = [
      'password',
      'token',
      'secret',
      'key',
      'authorization',
      'auth',
      'credentials',
    ];

    const sanitized = { ...data };

    for (const field of sensitive_fields) {
      if (field in sanitized) {
        sanitized[field] = '[REDACTED]';
      }
    }

    return sanitized;
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private writeAuditLog(logData: AuditLogData): void {
    const logLevel = this.mapAuditLevelToLogLevel(logData.level);
    const message = this.formatLogMessage(logData);

    switch (logLevel) {
      case 'error':
        this.logger.error(message, JSON.stringify(logData));
        break;
      case 'warn':
        this.logger.warn(message, JSON.stringify(logData));
        break;
      case 'debug':
        this.logger.debug(message, JSON.stringify(logData));
        break;
      default:
        this.logger.log(message, JSON.stringify(logData));
    }

    // TODO: Send to external audit service or database
    // await this.auditService.store(logData);
  }

  private mapAuditLevelToLogLevel(
    auditLevel: AuditLogLevel,
  ): 'error' | 'warn' | 'log' | 'debug' {
    switch (auditLevel) {
      case 'CRITICAL':
        return 'error';
      case 'SECURITY':
        return 'warn';
      case 'INFO':
        return 'log';
      case 'DEBUG':
        return 'debug';
      default:
        return 'log';
    }
  }

  private formatLogMessage(logData: AuditLogData): string {
    const { userId, action, resource, resourceId, success } = logData;
    const status = success ? 'SUCCESS' : 'FAILED';
    const user = userId ? `User ${userId}` : 'Anonymous';
    const target = resourceId ? `${resource}:${resourceId}` : resource;

    return `[AUDIT] ${status} - ${user} ${action} ${target}`;
  }
}
