import { buildCacheKey, CacheKeyType } from '@ai-assistant/utils';
import { isString, isUUID } from '@ai-assistant/utils';

/**
 * Cache TTL configurations (in seconds)
 */
export const CacheTTL = {
  // Short-term caches (5 minutes)
  SHORT: 5 * 60,

  // Medium-term caches (30 minutes)
  MEDIUM: 30 * 60,

  // Long-term caches (2 hours)
  LONG: 2 * 60 * 60,

  // Very long-term caches (12 hours)
  VERY_LONG: 12 * 60 * 60,

  // Daily caches (24 hours)
  DAILY: 24 * 60 * 60,

  // Weekly caches (7 days)
  WEEKLY: 7 * 24 * 60 * 60,
} as const;

/**
 * Type-safe cache key builders với validation
 */
export class CacheKeys {
  /**
   * Rate limiting keys
   */
  static rateLimit(identifier: string): string {
    if (!isString(identifier) || identifier.length === 0) {
      throw new Error('Rate limit identifier must be a non-empty string');
    }
    return buildCacheKey('rate_limit', identifier);
  }

  /**
   * User session keys
   */
  static userSession(userId: string): string {
    if (!isUUID(userId)) {
      throw new Error('User ID must be a valid UUID');
    }
    return buildCacheKey('user_session', userId);
  }

  /**
   * User profile cache keys
   */
  static userProfile(userId: string): string {
    if (!isUUID(userId)) {
      throw new Error('User ID must be a valid UUID');
    }
    return buildCacheKey('user_session', 'profile', userId);
  }

  /**
   * User permissions cache keys
   */
  static userPermissions(userId: string, workspaceId?: string): string {
    if (!isUUID(userId)) {
      throw new Error('User ID must be a valid UUID');
    }

    if (workspaceId) {
      if (!isUUID(workspaceId)) {
        throw new Error('Workspace ID must be a valid UUID');
      }
      return buildCacheKey('user_session', 'permissions', userId, workspaceId);
    }

    return buildCacheKey('user_session', 'permissions', userId);
  }

  /**
   * Workspace data cache keys
   */
  static workspaceData(workspaceId: string): string {
    if (!isUUID(workspaceId)) {
      throw new Error('Workspace ID must be a valid UUID');
    }
    return buildCacheKey('workspace_data', workspaceId);
  }

  /**
   * Workspace members cache keys
   */
  static workspaceMembers(workspaceId: string): string {
    if (!isUUID(workspaceId)) {
      throw new Error('Workspace ID must be a valid UUID');
    }
    return buildCacheKey('workspace_data', 'members', workspaceId);
  }

  /**
   * Workspace settings cache keys
   */
  static workspaceSettings(workspaceId: string): string {
    if (!isUUID(workspaceId)) {
      throw new Error('Workspace ID must be a valid UUID');
    }
    return buildCacheKey('workspace_data', 'settings', workspaceId);
  }

  /**
   * AI response cache keys
   */
  static aiResponse(conversationId: string, messageHash: string): string {
    if (!isUUID(conversationId)) {
      throw new Error('Conversation ID must be a valid UUID');
    }
    if (!isString(messageHash) || messageHash.length === 0) {
      throw new Error('Message hash must be a non-empty string');
    }
    return buildCacheKey('ai_response', conversationId, messageHash);
  }

  /**
   * AI conversation history cache keys
   */
  static aiConversationHistory(userId: string, workspaceId: string): string {
    if (!isUUID(userId)) {
      throw new Error('User ID must be a valid UUID');
    }
    if (!isUUID(workspaceId)) {
      throw new Error('Workspace ID must be a valid UUID');
    }
    return buildCacheKey('ai_response', 'history', userId, workspaceId);
  }

  /**
   * Knowledge base cache keys
   */
  static knowledgeEntry(entryId: string): string {
    if (!isUUID(entryId)) {
      throw new Error('Knowledge entry ID must be a valid UUID');
    }
    return buildCacheKey('knowledge_cache', entryId);
  }

  /**
   * Knowledge search results cache keys
   */
  static knowledgeSearch(workspaceId: string, queryHash: string): string {
    if (!isUUID(workspaceId)) {
      throw new Error('Workspace ID must be a valid UUID');
    }
    if (!isString(queryHash) || queryHash.length === 0) {
      throw new Error('Query hash must be a non-empty string');
    }
    return buildCacheKey('knowledge_cache', 'search', workspaceId, queryHash);
  }

  /**
   * Knowledge embeddings cache keys
   */
  static knowledgeEmbeddings(entryId: string): string {
    if (!isUUID(entryId)) {
      throw new Error('Knowledge entry ID must be a valid UUID');
    }
    return buildCacheKey('knowledge_cache', 'embeddings', entryId);
  }

  /**
   * API analytics cache keys
   */
  static apiAnalytics(endpoint: string, timeframe: string): string {
    if (!isString(endpoint) || endpoint.length === 0) {
      throw new Error('Endpoint must be a non-empty string');
    }
    if (!isString(timeframe) || timeframe.length === 0) {
      throw new Error('Timeframe must be a non-empty string');
    }
    return buildCacheKey('api_analytics', endpoint, timeframe);
  }

  /**
   * User activity cache keys
   */
  static userActivity(userId: string, activityType: string): string {
    if (!isUUID(userId)) {
      throw new Error('User ID must be a valid UUID');
    }
    if (!isString(activityType) || activityType.length === 0) {
      throw new Error('Activity type must be a non-empty string');
    }
    return buildCacheKey('user_session', 'activity', userId, activityType);
  }

  /**
   * Feature flags cache keys
   */
  static featureFlags(userId?: string, workspaceId?: string): string {
    const parts: string[] = ['feature_flags'];

    if (userId) {
      if (!isUUID(userId)) {
        throw new Error('User ID must be a valid UUID');
      }
      parts.push('user', userId);
    }

    if (workspaceId) {
      if (!isUUID(workspaceId)) {
        throw new Error('Workspace ID must be a valid UUID');
      }
      parts.push('workspace', workspaceId);
    }

    return parts.join(':');
  }

  /**
   * System configuration cache keys
   */
  static systemConfig(configKey: string): string {
    if (!isString(configKey) || configKey.length === 0) {
      throw new Error('Config key must be a non-empty string');
    }
    return buildCacheKey('system_config', configKey);
  }

  /**
   * File metadata cache keys
   */
  static fileMetadata(fileId: string): string {
    if (!isUUID(fileId)) {
      throw new Error('File ID must be a valid UUID');
    }
    return buildCacheKey('file_metadata', fileId);
  }

  /**
   * Pagination cache keys
   */
  static paginationData(
    resource: string,
    filters: Record<string, unknown>,
  ): string {
    if (!isString(resource) || resource.length === 0) {
      throw new Error('Resource name must be a non-empty string');
    }

    // Create deterministic hash từ filters
    const filterHash = this.createFilterHash(filters);
    return buildCacheKey('pagination', resource, filterHash);
  }

  /**
   * Create deterministic hash từ filter object
   */
  private static createFilterHash(filters: Record<string, unknown>): string {
    // Sort keys để ensure consistent hash
    const sortedKeys = Object.keys(filters).sort();
    const normalizedFilters = sortedKeys.reduce(
      (acc, key) => {
        acc[key] = filters[key];
        return acc;
      },
      {} as Record<string, unknown>,
    );

    // Simple hash function (trong production có thể dùng crypto)
    const filterString = JSON.stringify(normalizedFilters);
    let hash = 0;
    for (let i = 0; i < filterString.length; i++) {
      const char = filterString.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }
}

/**
 * Cache configuration mapping với TTL
 */
export const CacheConfig = {
  // Rate limiting - short term
  rateLimit: { ttl: CacheTTL.SHORT },

  // User data - medium term
  userSession: { ttl: CacheTTL.MEDIUM },
  userProfile: { ttl: CacheTTL.LONG },
  userPermissions: { ttl: CacheTTL.MEDIUM },
  userActivity: { ttl: CacheTTL.SHORT },

  // Workspace data - long term
  workspaceData: { ttl: CacheTTL.LONG },
  workspaceMembers: { ttl: CacheTTL.MEDIUM },
  workspaceSettings: { ttl: CacheTTL.VERY_LONG },

  // AI responses - very long term
  aiResponse: { ttl: CacheTTL.DAILY },
  aiConversationHistory: { ttl: CacheTTL.LONG },

  // Knowledge base - very long term
  knowledgeEntry: { ttl: CacheTTL.DAILY },
  knowledgeSearch: { ttl: CacheTTL.LONG },
  knowledgeEmbeddings: { ttl: CacheTTL.WEEKLY },

  // Analytics - daily
  apiAnalytics: { ttl: CacheTTL.DAILY },

  // System - very long term
  featureFlags: { ttl: CacheTTL.VERY_LONG },
  systemConfig: { ttl: CacheTTL.DAILY },
  fileMetadata: { ttl: CacheTTL.VERY_LONG },

  // Pagination - short term
  paginationData: { ttl: CacheTTL.SHORT },
} as const;

/**
 * Helper để get cache config theo cache key
 */
export function getCacheConfig(cacheKey: string): { ttl: number } {
  // Extract cache type từ key
  const cacheType = cacheKey.split(':')[0] as keyof typeof CacheConfig;

  if (cacheType in CacheConfig) {
    return CacheConfig[cacheType];
  }

  // Default configuration
  return { ttl: CacheTTL.MEDIUM };
}
