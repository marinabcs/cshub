import { useState, useEffect, useCallback, useRef } from 'react';
import { getCached, setCached, invalidateCache } from '../services/cache';

/**
 * Hook React que usa cache em memória com TTL.
 *
 * @param {string} cacheKey - Chave do cache
 * @param {() => Promise<any>} fetchFn - Função async que retorna os dados
 * @param {number} ttlMs - TTL em milissegundos
 * @param {any[]} deps - Dependências do useEffect
 * @returns {{ data: any, loading: boolean, error: any, refetch: () => void }}
 */
export function useCachedQuery(cacheKey, fetchFn, ttlMs = 300000, deps = []) {
  const cached = getCached(cacheKey);
  const [data, setData] = useState(cached);
  const [loading, setLoading] = useState(!cached);
  const [error, setError] = useState(null);
  const mountedRef = useRef(true);

  const doFetch = useCallback(async (force = false) => {
    if (force) {
      invalidateCache(cacheKey);
    }

    const existing = force ? null : getCached(cacheKey);
    if (existing) {
      setData(existing);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const result = await fetchFn();
      if (mountedRef.current) {
        setCached(cacheKey, result, ttlMs);
        setData(result);
        setLoading(false);
      }
    } catch (err) {
      if (mountedRef.current) {
        setError(err);
        setLoading(false);
      }
    }
  }, [cacheKey, fetchFn, ttlMs]);

  useEffect(() => {
    mountedRef.current = true;
    doFetch();
    return () => { mountedRef.current = false; };
  }, [cacheKey, ...deps]);

  const refetch = useCallback(() => doFetch(true), [doFetch]);

  return { data, loading, error, refetch };
}
