import { useState, useEffect, useRef, useCallback } from 'react';
import { getJobStatus } from '../services/api';

/**
 * Custom hook for customer real-time job hiring status polling:
 * - Polls Flask backend every 3 seconds while active
 * - Automatically stops polling if job is cancelled or completed
 * - Prevents overlapping network requests
 * - Cancels/aborts gracefully on component unmount
 */
export function useJobStatus(jobId, {
  pollingIntervalMs = 3000,
  enabled = true
} = {}) {
  const [jobStatus, setJobStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isPolling, setIsPolling] = useState(false);
  const [isStopped, setIsStopped] = useState(false);

  const isFetchingRef = useRef(false);
  const abortControllerRef = useRef(null);
  const timerRef = useRef(null);
  const isStoppedRef = useRef(false);

  const stopPolling = useCallback(() => {
    isStoppedRef.current = true;
    setIsStopped(true);
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setIsPolling(false);
  }, []);

  const fetchStatus = useCallback(async () => {
    if (!jobId || isStoppedRef.current) {
      setLoading(false);
      return;
    }

    if (isFetchingRef.current) return;
    isFetchingRef.current = true;

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    try {
      setIsPolling(true);
      const res = await getJobStatus(jobId, { signal: abortControllerRef.current.signal });

      if (res) {
        setJobStatus(res);
        // Automatically stop polling if job is cancelled or completed
        if (res.status === 'cancelled' || res.status === 'completed') {
          stopPolling();
        }
      }
      setError(null);
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.warn(`[useJobStatus] Polling error for job ${jobId}:`, err.message);
        setError(err);
      }
    } finally {
      setLoading(false);
      setIsPolling(false);
      isFetchingRef.current = false;
    }
  }, [jobId, stopPolling]);

  useEffect(() => {
    isStoppedRef.current = false;
    setIsStopped(false);

    if (enabled && jobId) {
      fetchStatus();

      timerRef.current = setInterval(() => {
        if (!isStoppedRef.current) {
          fetchStatus();
        }
      }, pollingIntervalMs);
    } else {
      setLoading(false);
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      isFetchingRef.current = false;
    };
  }, [enabled, jobId, pollingIntervalMs, fetchStatus]);

  const isLive = !isStopped && jobStatus?.status !== 'cancelled' && jobStatus?.status !== 'completed';

  return {
    jobStatus,
    loading,
    error,
    isPolling,
    isLive,
    isStopped,
    stopPolling,
    refresh: () => {
      isStoppedRef.current = false;
      setIsStopped(false);
      fetchStatus();
    }
  };
}

export default useJobStatus;
