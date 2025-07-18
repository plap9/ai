// TODO: [Open Issue] Implement missing common type definitions as indicated by the placeholder comments.
// Common type definitions sẽ được implement ở đây
// Waiting for user to provide the implementation

export {}; // Temporary export to avoid empty module

// Common type definitions for AI Assistant project

import { Request } from 'express';

/**
 * Authenticated request interface extending guards' AuthenticatedUser
 */
export interface AuthenticatedRequest extends Request {
  user: any; // Use AuthenticatedUser from guards.ts
}

/**
 * Type guard để check xem request có user không
 */
export function isAuthenticatedRequest(req: Request): req is AuthenticatedRequest {
  return req && typeof req === 'object' && 'user' in req && !!req.user;
}

/**
 * Request with optional user
 */
export interface RequestWithUser {
  user?: {
    id: string;
    email: string;
    roles: string[];
  };
}

/**
 * Cache key types
 */
export type CacheKeyType =
  | 'rate_limit'
  | 'user_session'
  | 'workspace_data'
  | 'ai_response'
  | 'knowledge_cache'
  | 'api_analytics'
  | 'system_config'
  | 'file_metadata'
  | 'pagination'
  | 'feature_flags';

/**
 * Type-safe cache key builder
 */
export function buildCacheKey(type: CacheKeyType, ...parts: string[]): string {
  return [type, ...parts].join(':');
}

/**
 * Workspace permission types
 */
export type WorkspacePermission = 'READ' | 'WRITE' | 'ADMIN' | 'OWNER';

/**
 * Workspace role interface
 */
export interface WorkspaceRole {
  userId: string;
  workspaceId: string;
  role: 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER';
  permissions: string[];
}

/**
 * Rate limit configuration
 */
export interface RateLimitConfig {
  windowMs: number;
  max: number;
  message: string;
  standardHeaders: boolean;
  legacyHeaders: boolean;
}

/**
 * File upload configuration
 */
export interface FileUploadConfig {
  maxSize: number;
  allowedMimeTypes: string[];
  allowedExtensions: string[];
  fieldName: string;
}

/**
 * Audit log levels for different types of actions
 */
export type AuditLogLevel = 'DEBUG' | 'INFO' | 'SECURITY' | 'CRITICAL';

/**
 * Audit log entry interface
 */
export interface AuditLogEntry {
  id: string;
  userId?: string;
  action: string;
  resource: string;
  resourceId?: string;
  workspaceId?: string;
  ipAddress: string;
  userAgent: string;
  requestId: string;
  timestamp: Date;
  level: AuditLogLevel;
  details?: Record<string, unknown>;
  success: boolean;
  errorMessage?: string;
  responseTime?: number;
}

/**
 * Pagination result interface
 */
export interface PaginatedResult<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

/**
 * Pagination query interface
 */
export interface PaginationQuery {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

/**
 * API Response wrapper
 */
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  errors?: string[];
  timestamp: string;
  requestId?: string;
}

/**
 * File upload metadata
 */
export interface FileUploadMetadata {
  originalName: string;
  filename: string;
  mimetype: string;
  size: number;
  path: string;
  uploadedAt: Date;
  uploadedBy: string;
}

/**
 * Feature flags interface
 */
export interface FeatureFlags {
  aiAssistant: boolean;
  knowledgeBase: boolean;
  fileUpload: boolean;
  collaboration: boolean;
  advancedAnalytics: boolean;
}
