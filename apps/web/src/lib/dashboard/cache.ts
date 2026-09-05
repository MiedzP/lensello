/**
 * LRU Cache implementation for dashboard routing engine.
 * Keeps decision cache to 1000 items, evicts oldest on overflow.
 * TTL: 1 hour (3600000ms) per cached entry.
 */

export interface CacheEntry<T> {
  value: T;
  timestamp: number;
}

export class LRUCache<T> {
  private cache: Map<string, CacheEntry<T>> = new Map();
  private maxSize: number;
  private ttlMs: number;

  constructor(maxSize = 1000, ttlMs = 3600000) {
    this.maxSize = maxSize;
    this.ttlMs = ttlMs; // Default 1 hour
  }

  /**
   * Get a value from the cache. Returns undefined if not found or expired.
   * Moves accessed entry to the end (most recent).
   */
  get(key: string): T | undefined {
    const entry = this.cache.get(key);

    if (!entry) {
      return undefined;
    }

    // Check if expired
    if (Date.now() - entry.timestamp > this.ttlMs) {
      this.cache.delete(key);
      return undefined;
    }

    // Move to end (most recent) by deleting and re-adding
    this.cache.delete(key);
    this.cache.set(key, entry);

    return entry.value;
  }

  /**
   * Set a value in the cache.
   * If cache exceeds maxSize, evicts oldest (least recently used) entry.
   */
  set(key: string, value: T): void {
    // Remove existing entry if present to update it
    if (this.cache.has(key)) {
      this.cache.delete(key);
    }

    // Evict oldest if at capacity
    if (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
    }

    this.cache.set(key, { value, timestamp: Date.now() });
  }

  /**
   * Clear the entire cache.
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics for monitoring.
   */
  getStats() {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      utilization: (this.cache.size / this.maxSize) * 100,
    };
  }

  /**
   * Evict expired entries. Run periodically to prevent memory bloat.
   */
  evictExpired(): number {
    let evicted = 0;
    const now = Date.now();

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.ttlMs) {
        this.cache.delete(key);
        evicted++;
      }
    }

    return evicted;
  }
}

/**
 * Global cache instance for dashboard routing decisions.
 * Shared across all requests in this process.
 */
export const dashboardCache = new LRUCache<any>(1000, 3600000);

/**
 * Periodic cleanup task. Call this in a background job (e.g., via a cron route).
 * Removes expired entries to prevent memory bloat over time.
 */
export async function cleanupExpiredCacheEntries() {
  const evicted = dashboardCache.evictExpired();
  console.log(`[Dashboard Cache] Evicted ${evicted} expired entries`);
  return { evicted };
}
