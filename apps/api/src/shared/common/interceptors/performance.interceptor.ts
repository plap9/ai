import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { Request, Response } from 'express';
import {
  isString,
  isNumber,
  isAuthenticatedRequest,
  AuthenticatedRequest,
} from '@ai-assistant/utils';

/**
 * Performance metrics interface
 */
interface PerformanceMetrics {
  endpoint: string;
  method: string;
  statusCode: number;
  responseTime: number;
  userId?: string;
  workspaceId?: string;
  userAgent?: string;
  ip: string;
  timestamp: Date;
  memoryUsage: {
    rss: number;
    heapUsed: number;
    heapTotal: number;
    external: number;
  };
  requestSize?: number;
  responseSize?: number;
}

/**
 * Performance alert thresholds
 */
interface PerformanceThresholds {
  slowResponseTime: number; // milliseconds
  highMemoryUsage: number; // bytes
  errorRateThreshold: number; // percentage
}

/**
 * Default performance thresholds
 */
const DEFAULT_THRESHOLDS: PerformanceThresholds = {
  slowResponseTime: 1000, // 1 second
  highMemoryUsage: 200 * 1024 * 1024, // 200MB
  errorRateThreshold: 5, // 5%
};

/**
 * Performance monitoring interceptor với type safety
 */
@Injectable()
export class PerformanceMonitoringInterceptor implements NestInterceptor {
  private readonly logger = new Logger(PerformanceMonitoringInterceptor.name);
  private readonly thresholds: PerformanceThresholds;

  // In-memory metrics storage (trong production nên dùng external storage)
  private readonly metrics: PerformanceMetrics[] = [];
  private readonly maxMetricsStorage = 1000;

  constructor(thresholds?: Partial<PerformanceThresholds>) {
    this.thresholds = {
      ...DEFAULT_THRESHOLDS,
      ...thresholds,
    };
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const startTime = Date.now();
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();

    // Capture initial memory usage
    const initialMemory = process.memoryUsage();

    return next.handle().pipe(
      tap(() => {
        this.recordMetrics(
          context,
          request,
          response,
          startTime,
          initialMemory,
        );
      }),
      catchError((error) => {
        this.recordMetrics(
          context,
          request,
          response,
          startTime,
          initialMemory,
          error,
        );
        throw error;
      }),
    );
  }

  /**
   * Record performance metrics với type safety
   */
  private recordMetrics(
    context: ExecutionContext,
    request: Request,
    response: Response,
    startTime: number,
    initialMemory: NodeJS.MemoryUsage,
    error?: Error,
  ): void {
    try {
      const endTime = Date.now();
      const responseTime = endTime - startTime;
      const currentMemory = process.memoryUsage();

      const metrics: PerformanceMetrics = {
        endpoint: this.getEndpoint(request),
        method: request.method,
        statusCode: error ? 500 : response.statusCode,
        responseTime,
        userId: this.extractUserId(request),
        workspaceId: this.extractWorkspaceId(request),
        userAgent: this.extractUserAgent(request),
        ip: this.extractClientIP(request),
        timestamp: new Date(startTime),
        memoryUsage: {
          rss: currentMemory.rss - initialMemory.rss,
          heapUsed: currentMemory.heapUsed - initialMemory.heapUsed,
          heapTotal: currentMemory.heapTotal - initialMemory.heapTotal,
          external: currentMemory.external - initialMemory.external,
        },
        requestSize: this.getRequestSize(request),
        responseSize: this.getResponseSize(response),
      };

      // Store metrics
      this.storeMetrics(metrics);

      // Check thresholds và alert if needed
      this.checkThresholds(metrics, error);

      // Log performance info
      this.logPerformance(metrics, error);
    } catch (metricsError) {
      this.logger.error('Failed to record performance metrics:', metricsError);
    }
  }

  /**
   * Extract endpoint path từ request
   */
  private getEndpoint(request: Request): string {
    const route = request.route?.path;
    if (isString(route)) {
      return route;
    }
    return request.path || 'unknown';
  }

  /**
   * Extract user ID từ authenticated request
   */
  private extractUserId(request: Request): string | undefined {
    if (isAuthenticatedRequest(request)) {
      const authRequest = request as AuthenticatedRequest;
      return authRequest.user?.id;
    }
    return undefined;
  }

  /**
   * Extract workspace ID từ request
   */
  private extractWorkspaceId(request: Request): string | undefined {
    // Check params first
    if (request.params?.workspaceId && isString(request.params.workspaceId)) {
      return request.params.workspaceId;
    }

    // Check query params
    if (request.query?.workspaceId && isString(request.query.workspaceId)) {
      return request.query.workspaceId;
    }

    // Check authenticated user workspace
    if (isAuthenticatedRequest(request)) {
      const authRequest = request as AuthenticatedRequest;
      return authRequest.user?.workspaceId;
    }

    return undefined;
  }

  /**
   * Extract user agent với type safety
   */
  private extractUserAgent(request: Request): string | undefined {
    const userAgent = request.headers['user-agent'];
    return isString(userAgent) ? userAgent : undefined;
  }

  /**
   * Extract client IP address
   */
  private extractClientIP(request: Request): string {
    const forwarded = request.headers['x-forwarded-for'];
    const realIP = request.headers['x-real-ip'];
    const remoteAddress = request.socket.remoteAddress;

    if (isString(forwarded)) {
      return forwarded.split(',')[0].trim();
    }

    if (isString(realIP)) {
      return realIP;
    }

    return remoteAddress || 'unknown';
  }

  /**
   * Get request size in bytes
   */
  private getRequestSize(request: Request): number | undefined {
    const contentLength = request.headers['content-length'];
    if (isString(contentLength)) {
      const size = parseInt(contentLength, 10);
      return isNumber(size) && !isNaN(size) ? size : undefined;
    }
    return undefined;
  }

  /**
   * Get response size in bytes
   */
  private getResponseSize(response: Response): number | undefined {
    const contentLength = response.getHeader('content-length');
    if (isString(contentLength)) {
      const size = parseInt(contentLength, 10);
      return isNumber(size) && !isNaN(size) ? size : undefined;
    }
    if (isNumber(contentLength)) {
      return contentLength;
    }
    return undefined;
  }

  /**
   * Store metrics in memory (với size limit)
   */
  private storeMetrics(metrics: PerformanceMetrics): void {
    this.metrics.push(metrics);

    // Keep only recent metrics
    if (this.metrics.length > this.maxMetricsStorage) {
      this.metrics.splice(0, this.metrics.length - this.maxMetricsStorage);
    }
  }

  /**
   * Check performance thresholds và alert
   */
  private checkThresholds(metrics: PerformanceMetrics, error?: Error): void {
    // Slow response time alert
    if (metrics.responseTime > this.thresholds.slowResponseTime) {
      this.logger.warn(
        `Slow response detected: ${metrics.endpoint} took ${metrics.responseTime}ms`,
        {
          endpoint: metrics.endpoint,
          method: metrics.method,
          responseTime: metrics.responseTime,
          userId: metrics.userId,
          threshold: this.thresholds.slowResponseTime,
        },
      );
    }

    // High memory usage alert
    const totalMemoryUsage = Math.max(
      metrics.memoryUsage.heapUsed,
      metrics.memoryUsage.rss,
    );

    if (totalMemoryUsage > this.thresholds.highMemoryUsage) {
      this.logger.warn(
        `High memory usage detected: ${Math.round(totalMemoryUsage / 1024 / 1024)}MB`,
        {
          endpoint: metrics.endpoint,
          memoryUsage: metrics.memoryUsage,
          threshold: Math.round(this.thresholds.highMemoryUsage / 1024 / 1024),
        },
      );
    }

    // Error alert
    if (error) {
      this.logger.error(`Error in ${metrics.endpoint}: ${error.message}`, {
        endpoint: metrics.endpoint,
        method: metrics.method,
        userId: metrics.userId,
        error: error.stack,
        responseTime: metrics.responseTime,
      });
    }
  }

  /**
   * Log performance information
   */
  private logPerformance(metrics: PerformanceMetrics, error?: Error): void {
    const logLevel = this.getLogLevel(metrics, error);
    const message = `${metrics.method} ${metrics.endpoint} - ${metrics.statusCode} - ${metrics.responseTime}ms`;

    const logData = {
      endpoint: metrics.endpoint,
      method: metrics.method,
      statusCode: metrics.statusCode,
      responseTime: metrics.responseTime,
      userId: metrics.userId,
      workspaceId: metrics.workspaceId,
      memoryDelta: Math.round(metrics.memoryUsage.heapUsed / 1024 / 1024), // MB
      timestamp: metrics.timestamp.toISOString(),
    };

    switch (logLevel) {
      case 'error':
        this.logger.error(message, logData);
        break;
      case 'warn':
        this.logger.warn(message, logData);
        break;
      case 'debug':
        this.logger.debug(message, logData);
        break;
      default:
        this.logger.log(message, logData);
    }
  }

  /**
   * Determine log level based on metrics
   */
  private getLogLevel(metrics: PerformanceMetrics, error?: Error): string {
    if (error || metrics.statusCode >= 500) {
      return 'error';
    }

    if (
      metrics.statusCode >= 400 ||
      metrics.responseTime > this.thresholds.slowResponseTime
    ) {
      return 'warn';
    }

    if (metrics.responseTime < 100) {
      return 'debug';
    }

    return 'log';
  }

  /**
   * Get performance summary statistics
   */
  getPerformanceSummary(minutes: number = 5): {
    totalRequests: number;
    averageResponseTime: number;
    errorRate: number;
    slowRequests: number;
    topSlowEndpoints: Array<{ endpoint: string; avgResponseTime: number }>;
  } {
    const cutoffTime = new Date(Date.now() - minutes * 60 * 1000);
    const recentMetrics = this.metrics.filter((m) => m.timestamp >= cutoffTime);

    if (recentMetrics.length === 0) {
      return {
        totalRequests: 0,
        averageResponseTime: 0,
        errorRate: 0,
        slowRequests: 0,
        topSlowEndpoints: [],
      };
    }

    const totalRequests = recentMetrics.length;
    const averageResponseTime =
      recentMetrics.reduce((sum, m) => sum + m.responseTime, 0) / totalRequests;
    const errorCount = recentMetrics.filter((m) => m.statusCode >= 500).length;
    const errorRate = (errorCount / totalRequests) * 100;
    const slowRequests = recentMetrics.filter(
      (m) => m.responseTime > this.thresholds.slowResponseTime,
    ).length;

    // Calculate top slow endpoints
    const endpointStats = new Map<string, { total: number; count: number }>();
    recentMetrics.forEach((m) => {
      const key = `${m.method} ${m.endpoint}`;
      const existing = endpointStats.get(key) || { total: 0, count: 0 };
      endpointStats.set(key, {
        total: existing.total + m.responseTime,
        count: existing.count + 1,
      });
    });

    const topSlowEndpoints = Array.from(endpointStats.entries())
      .map(([endpoint, stats]) => ({
        endpoint,
        avgResponseTime: Math.round(stats.total / stats.count),
      }))
      .sort((a, b) => b.avgResponseTime - a.avgResponseTime)
      .slice(0, 5);

    return {
      totalRequests,
      averageResponseTime: Math.round(averageResponseTime),
      errorRate: Math.round(errorRate * 100) / 100,
      slowRequests,
      topSlowEndpoints,
    };
  }

  /**
   * Clear stored metrics
   */
  clearMetrics(): void {
    this.metrics.length = 0;
  }
}
