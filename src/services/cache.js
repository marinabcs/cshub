import { getDocs } from 'firebase/firestore';

const cache = new Map();

export function getCached(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > entry.ttl) {
    cache.delete(key);
    return null;
  }
  return entry.data;
}

export function setCached(key, data, ttlMs) {
  cache.set(key, { data, timestamp: Date.now(), ttl: ttlMs });
}

export function invalidateCache(key) {
  cache.delete(key);
}

export function invalidateCachePrefix(prefix) {
  for (const key of cache.keys()) {
    if (key.startsWith(prefix)) {
      cache.delete(key);
    }
  }
}

export function clearAllCache() {
  cache.clear();
}

/**
 * Retorna docs do cache se válido, senão executa getDocs e armazena.
 * Retorna array de doc snapshots (mesmo formato de snapshot.docs).
 */
export async function cachedGetDocs(cacheKey, queryRef, ttlMs = 300000) {
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const snapshot = await getDocs(queryRef);
  const docs = snapshot.docs;
  setCached(cacheKey, docs, ttlMs);
  return docs;
}
