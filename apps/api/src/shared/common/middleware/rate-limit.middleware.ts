import {
  Injectable,
  NestMiddleware,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { CacheService } from '../../cache/cache.service';
import {
  isString,
  isAuthenticatedRequest,
  AuthenticatedRequest,
} from '@ai-assistant/utils';

/**
 * Rate limiting configuration interface
 */
interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  keyGenerator?: (req: Request) => string;
  skipIf?: (req: Request) => boolean;
  message?: string;
}

/**
 * Rate limit entry trong cache
 */
interface RateLimitEntry {
  count: number;
  resetTime: number;
}

/**
 * Rate limit response headers
 */
interface RateLimitHeaders {
  'X-RateLimit-Limit': string;
  'X-RateLimit-Remaining': string;
  'X-RateLimit-Reset': string;
}

/**
 * Default rate limit configurations cho different endpoint types
 */
export const RateLimitConfigs = {
  // Standard API endpoints
  api: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 100,
    message: 'Too many requests from this IP, please try again later',
  } as RateLimitConfig,

  // Authentication endpoints (stricter)
  auth: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 5, // Only 5 login attempts per 15 minutes
    message: 'Too many authentication attempts, please try again later',
  } as RateLimitConfig,

  // File upload endpoints
  upload: {
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 10,
    message: 'Too many file uploads, please try again later',
  } as RateLimitConfig,

  // Admin endpoints (very strict)
  admin: {
    windowMs: 5 * 60 * 1000, // 5 minutes
    maxRequests: 20,
    message: 'Too many admin requests, please try again later',
  } as RateLimitConfig,
} as const;

/**
 * Type-safe Rate Limiting Middleware
 */
@Injectable()
export class RateLimitMiddleware implements NestMiddleware {
  private readonly config: RateLimitConfig;

  constructor(
    private readonly cacheService: CacheService,
    config?: Partial<RateLimitConfig>,
  ) {
    this.config = {
      ...RateLimitConfigs.api,
      ...config,
    };
  }

  async use(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Skip if configured to skip
      if (this.config.skipIf && this.config.skipIf(req)) {
        return next();
      }

      // Generate cache key
      const key = this.generateKey(req);

      // Get current rate limit data
      const limitData = await this.getRateLimitData(key);

      // Check if limit exceeded
      if (limitData.count >= this.config.maxRequests) {
        this.setRateLimitHeaders(res, limitData);
        throw new HttpException(
          {
            statusCode: HttpStatus.TOO_MANY_REQUESTS,
            message: this.config.message || 'Rate limit exceeded',
            retryAfter: Math.ceil((limitData.resetTime - Date.now()) / 1000),
            timestamp: new Date().toISOString(),
          },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }

      // Increment counter
      await this.incrementCounter(key, limitData);

      // Set response headers
      this.setRateLimitHeaders(res, {
        count: limitData.count + 1,
        resetTime: limitData.resetTime,
      });

      next();
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      // Log error but don't block request if cache fails
      console.error('Rate limiting error:', error);
      next();
    }
  }

  /**
   * Generate cache key for rate limiting
   */
  private generateKey(req: Request): string {
    if (this.config.keyGenerator) {
      return this.config.keyGenerator(req);
    }

    // Default key generation strategy
    const ip = this.getClientIP(req);

    // For authenticated requests, include user ID
    if (isAuthenticatedRequest(req)) {
      const authReq = req as AuthenticatedRequest;
      return `rate_limit:${ip}:${authReq.user.id}`;
    }

    return `rate_limit:${ip}`;
  }

  /**
   * Get client IP address với type safety
   */
  private getClientIP(req: Request): string {
    const forwarded = req.headers['x-forwarded-for'];
    const realIP = req.headers['x-real-ip'];
    const remoteAddress = req.socket.remoteAddress;

    if (isString(forwarded)) {
      return forwarded.split(',')[0].trim();
    }

    if (isString(realIP)) {
      return realIP;
    }

    return remoteAddress || 'unknown';
  }

  /**
   * Get rate limit data from cache
   */
  private async getRateLimitData(key: string): Promise<RateLimitEntry> {
    try {
      const cached = await this.cacheService.get<RateLimitEntry>(key);

      if (cached && cached.resetTime > Date.now()) {
        return cached;
      }

      // Create new entry if expired or doesn't exist
      return {
        count: 0,
        resetTime: Date.now() + this.config.windowMs,
      };
    } catch {
      // Return default if cache fails
      return {
        count: 0,
        resetTime: Date.now() + this.config.windowMs,
      };
    }
  }

  /**
   * Increment counter in cache
   */
  private async incrementCounter(
    key: string,
    limitData: RateLimitEntry,
  ): Promise<void> {
    try {
      const updatedData: RateLimitEntry = {
        count: limitData.count + 1,
        resetTime: limitData.resetTime,
      };

      const ttl = Math.ceil((limitData.resetTime - Date.now()) / 1000);
      await this.cacheService.set(key, updatedData, ttl);
    } catch (error) {
      console.error('Failed to increment rate limit counter:', error);
    }
  }

  /**
   * Set rate limit headers
   */
  private setRateLimitHeaders(res: Response, limitData: RateLimitEntry): void {
    const headers: RateLimitHeaders = {
      'X-RateLimit-Limit': this.config.maxRequests.toString(),
      'X-RateLimit-Remaining': Math.max(
        0,
        this.config.maxRequests - limitData.count,
      ).toString(),
      'X-RateLimit-Reset': limitData.resetTime.toString(),
    };

    Object.entries(headers).forEach(([key, value]) => {
      res.setHeader(key, value);
    });
  }
}

/**
 * Pre-configured middleware classes
 */
@Injectable()
export class AuthRateLimitMiddleware extends RateLimitMiddleware {
  constructor(cacheService: CacheService) {
    super(cacheService, RateLimitConfigs.auth);
  }
}

@Injectable()
export class UploadRateLimitMiddleware extends RateLimitMiddleware {
  constructor(cacheService: CacheService) {
    super(cacheService, RateLimitConfigs.upload);
  }
}

@Injectable()
export class AdminRateLimitMiddleware extends RateLimitMiddleware {
  constructor(cacheService: CacheService) {
    super(cacheService, RateLimitConfigs.admin);
  }
}
