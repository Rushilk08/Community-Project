import { useState, useEffect, useRef, useCallback } from 'react';
import { getJobStatus } from '../services/api';

/**
 * Custom hook for customer real-time job hiring status polling:
 * - Polls Flask backend every 3 seconds while active
 * - Updates confirmed workers, remaining positions, and job status
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

  const isFetchingRef = useRef(false);
  const abortControllerRef = useRef(null);

  const fetchStatus = useCallback(async () => {
    if (!jobId) {
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
  }, [jobId]);

  useEffect(() => {
    let timerId = null;

    if (enabled && jobId) {
      fetchStatus();

      timerId = setInterval(() => {
        fetchStatus();
      }, pollingIntervalMs);
    } else {
      setLoading(false);
    }

    return () => {
      if (timerId) clearInterval(timerId);
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      isFetchingRef.current = false;
    };
  }, [enabled, jobId, pollingIntervalMs, fetchStatus]);

  return {
    jobStatus,
    loading,
    error,
    isPolling,
    refresh: fetchStatus
  };
}

export default useJobStatus;
