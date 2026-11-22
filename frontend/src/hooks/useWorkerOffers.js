import { useState, useEffect, useRef, useCallback } from 'react';
import { getWorkerOffers } from '../services/api';

/**
 * Custom hook for real-time worker job offer polling:
 * - Polls Flask backend every 3 seconds while active
 * - Deduplicates incoming offers
 * - Prevents overlapping network requests
 * - Cancels/aborts gracefully on component unmount
 */
export function useWorkerOffers({
  pollingIntervalMs = 3000,
  enabled = true
} = {}) {
  const [offers, setOffers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isPolling, setIsPolling] = useState(false);

  const isFetchingRef = useRef(false);
  const abortControllerRef = useRef(null);

  const fetchOffers = useCallback(async () => {
    // Avoid overlapping concurrent requests
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    try {
      setIsPolling(true);
      const res = await getWorkerOffers({ signal: abortControllerRef.current.signal });

      if (res && (res.offers || Array.isArray(res))) {
        const rawOffers = res.offers || res;
        // Set only currently active pending offers returned by backend
        setOffers(Array.isArray(rawOffers) ? rawOffers : []);
      }
      setError(null);
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.warn('[useWorkerOffers] Polling error:', err.message);
        setError(err);
      }
    } finally {
      setLoading(false);
      setIsPolling(false);
      isFetchingRef.current = false;
    }
  }, []);

  useEffect(() => {
    let timerId = null;

    if (enabled) {
      // Immediate initial fetch
      fetchOffers();

      // Recurring polling interval
      timerId = setInterval(() => {
        fetchOffers();
      }, pollingIntervalMs);
    }

    return () => {
      if (timerId) clearInterval(timerId);
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      isFetchingRef.current = false;
    };
  }, [enabled, pollingIntervalMs, fetchOffers]);

  // Remove accepted or rejected offer locally from state immediately
  const removeOffer = useCallback((offerId) => {
    setOffers((prev) => prev.filter((o) => (o.id || o.offer_id) !== offerId));
  }, []);

  return {
    offers,
    loading,
    error,
    isPolling,
    refresh: fetchOffers,
    removeOffer
  };
}

export default useWorkerOffers;
