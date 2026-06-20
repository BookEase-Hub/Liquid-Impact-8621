/**
 * In-memory TTL cache — Redis substitute for free-tier deployments.
 * Survives per-process lifetime. Resets on restart (acceptable for cache).
 * Keys: scan:{imageHash} | barcode:{code} | product:{fingerprint}
 */

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

const store = new Map<string, CacheEntry<unknown>>();

// Auto-evict stale entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store.entries()) {
    if (now > entry.expiresAt) store.delete(key);
  }
}, 5 * 60 * 1000).unref();

export function cacheSet(key: string, data: unknown, ttlSeconds: number): void {
  store.set(key, { data, expiresAt: Date.now() + ttlSeconds * 1000 });
}

export function cacheGet<T>(key: string): T | null {
  const entry = store.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    store.delete(key);
    return null;
  }
  return entry.data as T;
}

export function cacheDel(key: string): void {
  store.delete(key);
}

export function cacheSize(): number {
  return store.size;
}
