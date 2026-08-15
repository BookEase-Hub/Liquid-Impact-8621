/**
 * LRU in-memory TTL cache — Redis substitute for single-server deployments.
 * Max 1000 entries. Evicts least-recently-used when full.
 * Keys: scan:{imageHash} | barcode:{code} | product:{fingerprint}
 */

const MAX_SIZE = 1000;

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

// Map preserves insertion order — we exploit this for O(1) LRU:
// newest entries are at the end; oldest (LRU) are at the front.
const store = new Map<string, CacheEntry<unknown>>();

// Auto-evict expired entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store.entries()) {
    if (now > entry.expiresAt) store.delete(key);
  }
}, 5 * 60 * 1000).unref();

export function cacheSet(key: string, data: unknown, ttlSeconds: number): void {
  // Evict oldest (front of Map) if at capacity
  if (store.size >= MAX_SIZE && !store.has(key)) {
    const oldest = store.keys().next().value;
    if (oldest !== undefined) store.delete(oldest);
  }
  // Delete + re-insert moves to end (most recently used)
  store.delete(key);
  store.set(key, { data, expiresAt: Date.now() + ttlSeconds * 1000 });
}

export function cacheGet<T>(key: string): T | null {
  const entry = store.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    store.delete(key);
    return null;
  }
  // Move to end = mark as recently used
  store.delete(key);
  store.set(key, entry);
  return entry.data as T;
}

export function cacheDel(key: string): void {
  store.delete(key);
}

export function cacheStats(): { size: number; maxSize: number } {
  return { size: store.size, maxSize: MAX_SIZE };
}
