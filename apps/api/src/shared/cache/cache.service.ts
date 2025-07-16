import { Injectable, Logger } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject } from '@nestjs/common';
import { Cache } from 'cache-manager';

@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);

  constructor(@Inject(CACHE_MANAGER) private cacheManager: Cache) {}

  // Get single value
  async get<T>(key: string): Promise<T | null> {
    try {
      const value = await this.cacheManager.get<T>(key);
      this.logger.debug(`Cache GET: ${key} -> ${value ? 'HIT' : 'MISS'}`);
      return value || null;
    } catch (error) {
      this.logger.error(`Cache GET error for key ${key}:`, error);
      return null;
    }
  }

  // Set single value
  async set(key: string, value: any, ttl?: number): Promise<void> {
    try {
      await this.cacheManager.set(key, value, ttl);
      this.logger.debug(`Cache SET: ${key} (TTL: ${ttl || 'default'})`);
    } catch (error) {
      this.logger.error(`Cache SET error for key ${key}:`, error);
    }
  }

  // Delete single key
  async del(key: string): Promise<void> {
    try {
      await this.cacheManager.del(key);
      this.logger.debug(`Cache DEL: ${key}`);
    } catch (error) {
      this.logger.error(`Cache DEL error for key ${key}:`, error);
    }
  }

  // Clear all cache (note: not all cache implementations support reset)
  reset(): void {
    try {
      // Note: reset is not available in all cache implementations
      // For Redis, this would need to be implemented differently
      this.logger.warn('Cache RESET: Not implemented for this cache store');
    } catch (error) {
      this.logger.error('Cache RESET error:', error);
    }
  }

  // Get multiple values
  async mget<T>(keys: string[]): Promise<(T | null)[]> {
    try {
      const values = await Promise.all(keys.map((key) => this.get<T>(key)));
      this.logger.debug(`Cache MGET: ${keys.length} keys`);
      return values;
    } catch (error) {
      this.logger.error(`Cache MGET error for keys ${keys.join(', ')}:`, error);
      return keys.map(() => null);
    }
  }

  // Set multiple values
  async mset(keyValues: Record<string, any>, ttl?: number): Promise<void> {
    try {
      await Promise.all(
        Object.entries(keyValues).map(([key, value]) =>
          this.set(key, value, ttl),
        ),
      );
      this.logger.debug(`Cache MSET: ${Object.keys(keyValues).length} keys`);
    } catch (error) {
      this.logger.error('Cache MSET error:', error);
    }
  }

  // Check if key exists
  async exists(key: string): Promise<boolean> {
    try {
      const value = await this.cacheManager.get(key);
      return value !== undefined;
    } catch (error) {
      this.logger.error(`Cache EXISTS error for key ${key}:`, error);
      return false;
    }
  }

  // Get or set pattern
  async getOrSet<T>(
    key: string,
    factory: () => Promise<T>,
    ttl?: number,
  ): Promise<T> {
    try {
      let value = await this.get<T>(key);

      if (value === null) {
        value = await factory();
        await this.set(key, value, ttl);
        this.logger.debug(`Cache FACTORY: ${key} -> generated and cached`);
      }

      return value;
    } catch (error) {
      this.logger.error(`Cache GET_OR_SET error for key ${key}:`, error);
      return await factory();
    }
  }

  // Helper method to generate cache keys
  generateKey(prefix: string, ...parts: (string | number)[]): string {
    return `${prefix}:${parts.join(':')}`;
  }

  // Helper method to get cache with prefix
  async getWithPrefix<T>(prefix: string, key: string): Promise<T | null> {
    const fullKey = this.generateKey(prefix, key);
    return this.get<T>(fullKey);
  }

  // Helper method to set cache with prefix
  async setWithPrefix(
    prefix: string,
    key: string,
    value: any,
    ttl?: number,
  ): Promise<void> {
    const fullKey = this.generateKey(prefix, key);
    await this.set(fullKey, value, ttl);
  }
}
