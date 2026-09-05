// React Hooks for Marketing Intelligence - PHASE 2
// Performance monitoring and optimization hooks

'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import {
  calculatePriorityScore,
  batchCalculatePriorityScores,
  getCachedLENSMetrics,
  cacheLENSMetrics,
} from './scoring-algorithm';
import {
  batchFetchLENSMetrics,
  batchFetchWithScores,
  invalidateQueryCache,
} from './query-optimizer';
import {
  startViewMonitoring,
  endViewMonitoring,
  markTiming,
  recordBatchQuery,
  recordCacheMiss,
} from './performance-monitor';
import { LENSMetric, PriorityScore } from './types';

/**
 * Hook to monitor a view's performance
 * Usage: const { sessionId, markTiming } = useViewMonitoring('daily-view');
 */
export function useViewMonitoring(viewName: string) {
  const sessionIdRef = useRef<string | null>(null);

  useEffect(() => {
    sessionIdRef.current = startViewMonitoring(viewName);

    return () => {
      if (sessionIdRef.current) {
        endViewMonitoring(sessionIdRef.current);
      }
    };
  }, [viewName]);

  const mark = useCallback((label: string) => {
    if (sessionIdRef.current) {
      markTiming(sessionIdRef.current, label);
    }
  }, []);

  return { mark };
}

/**
 * Hook to fetch LENS metrics with caching
 * Usage: const { metrics, loading, error } = useLENSMetrics(campaignIds);
 */
export function useLENSMetrics(campaignIds: string[]) {
  const [metrics, setMetrics] = useState<Map<string, LENSMetric> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let isMounted = true;

    const fetchMetrics = async () => {
      try {
        setLoading(true);
        setError(null);

        const startTime = performance.now();
        const data = await batchFetchLENSMetrics(campaignIds);
        const duration = performance.now() - startTime;

        recordBatchQuery(campaignIds.length, duration);

        if (isMounted) {
          setMetrics(data);
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err : new Error('Unknown error'));
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    if (campaignIds.length > 0) {
      fetchMetrics();
    }

    return () => {
      isMounted = false;
    };
  }, [campaignIds.join(',')]); // Re-fetch only if campaign list changes

  return { metrics, loading, error };
}

/**
 * Hook to fetch metrics and priority scores together
 * Usage: const { data, loading, error } = useMetricsWithScores(campaignIds);
 */
export function useMetricsWithScores(campaignIds: string[]) {
  const [data, setData] = useState<Map<string, { metrics: LENSMetric; score: number }> | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let isMounted = true;

    const fetch = async () => {
      try {
        setLoading(true);
        setError(null);

        const result = await batchFetchWithScores(campaignIds);

        if (isMounted) {
          setData(result);
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err : new Error('Unknown error'));
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    if (campaignIds.length > 0) {
      fetch();
    }

    return () => {
      isMounted = false;
    };
  }, [campaignIds.join(',')]);

  return { data, loading, error };
}

/**
 * Hook to calculate and cache priority scores
 * Usage: const { scores } = usePriorityScores([{ id: '1', metrics: {...} }]);
 */
export function usePriorityScores(
  campaigns: Array<{ id: string; metrics: LENSMetric }>
): {
  scores: Map<string, PriorityScore>;
  refresh: () => void;
} {
  const [scores, setScores] = useState<Map<string, PriorityScore>>(new Map());

  const calculateScores = useCallback(() => {
    const result = batchCalculatePriorityScores(campaigns);
    setScores(result);
  }, [campaigns]);

  const refresh = useCallback(() => {
    invalidateQueryCache();
    calculateScores();
  }, [calculateScores]);

  useEffect(() => {
    calculateScores();
  }, [campaigns]);

  return { scores, refresh };
}

/**
 * Hook for debounced re-fetching (e.g., on manual refresh)
 * Usage: const refetch = useDebounceRefetch(() => { ... }, 500);
 */
export function useDebounceRefetch(callback: () => void, delayMs = 500) {
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const refetch = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    timerRef.current = setTimeout(() => {
      callback();
      timerRef.current = null;
    }, delayMs);
  }, [callback, delayMs]);

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  return refetch;
}

/**
 * Hook to lazy-load metrics for a view component
 * Useful when view is only occasionally visible
 */
export function useLazyMetrics(shouldLoad: boolean, campaignIds: string[]) {
  const [loaded, setLoaded] = useState(false);
  const { metrics, loading, error } = useLENSMetrics(shouldLoad && loaded ? campaignIds : []);

  useEffect(() => {
    if (shouldLoad && !loaded) {
      setLoaded(true);
    }
  }, [shouldLoad, loaded]);

  return {
    metrics,
    loading: shouldLoad ? loading : false,
    error,
  };
}

/**
 * Hook to track which views are accessed most frequently
 * Helps identify which views to prioritize for optimization
 */
export function useViewAccessTracking(viewName: string) {
  useEffect(() => {
    const key = `view_access_${viewName}`;
    const count = localStorage.getItem(key);
    const newCount = (parseInt(count || '0', 10) + 1).toString();
    localStorage.setItem(key, newCount);

    // Log access stats periodically
    if (parseInt(newCount, 10) % 10 === 0) {
      console.log(`[Analytics] ${viewName} accessed ${newCount} times`);
    }
  }, [viewName]);
}

/**
 * Hook to detect and warn about cache misses
 */
export function useCacheMissDetection(context: string) {
  const recordMiss = useCallback(() => {
    recordCacheMiss(context);
  }, [context]);

  return { recordMiss };
}
