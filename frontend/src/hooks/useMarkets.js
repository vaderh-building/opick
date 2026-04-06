import { useState, useEffect, useCallback } from 'react';

const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:3001') + '/api';

export function useMarkets() {
  const [markets, setMarkets] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchMarkets = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/markets`);
      const data = await res.json();
      if (Array.isArray(data)) {
        setMarkets(data);
      }
    } catch (err) {
      console.error('Failed to fetch markets:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMarkets();
  }, [fetchMarkets]);

  return { markets, loading, refetch: fetchMarkets };
}

function isValidMarket(data) {
  return data && typeof data === 'object' && data.topic && data.sideAName;
}

export function useMarket(address) {
  const [market, setMarket] = useState(null);
  const [loading, setLoading] = useState(true);
  const [retrying, setRetrying] = useState(false);

  const fetchMarket = useCallback(async () => {
    if (!address) { setLoading(false); return; }
    setLoading(true);
    setRetrying(false);

    // First attempt: try single endpoint then list
    for (const url of [`${API_URL}/markets/${address}`, `${API_URL}/markets`]) {
      try {
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          const found = Array.isArray(data)
            ? data.find(m => m.address.toLowerCase() === address.toLowerCase())
            : data;
          if (isValidMarket(found)) {
            setMarket(found);
            setLoading(false);
            return;
          }
        }
      } catch {}
    }

    // Not found yet. Retry up to 5 times with 3s intervals.
    setRetrying(true);
    for (let i = 0; i < 5; i++) {
      await new Promise(r => setTimeout(r, 3000));
      try {
        const res = await fetch(`${API_URL}/markets/${address}`);
        if (res.ok) {
          const data = await res.json();
          if (isValidMarket(data)) {
            setMarket(data);
            setLoading(false);
            setRetrying(false);
            return;
          }
        }
      } catch {}
    }

    // Give up
    setLoading(false);
    setRetrying(false);
  }, [address]);

  useEffect(() => {
    fetchMarket();
  }, [fetchMarket]);

  return { market, loading, retrying, refetch: fetchMarket };
}
