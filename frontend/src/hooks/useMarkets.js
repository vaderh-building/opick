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

  const fetchMarket = useCallback(async () => {
    if (!address) return;

    // Try the single market endpoint
    try {
      const res = await fetch(`${API_URL}/markets/${address}`);
      if (res.ok) {
        const data = await res.json();
        if (isValidMarket(data)) {
          setMarket(data);
          setLoading(false);
          return;
        }
      }
    } catch {}

    // Fallback: fetch the full list and find our market
    try {
      const res = await fetch(`${API_URL}/markets`);
      if (res.ok) {
        const list = await res.json();
        if (Array.isArray(list)) {
          const found = list.find(m => m.address.toLowerCase() === address.toLowerCase());
          if (isValidMarket(found)) {
            setMarket(found);
            setLoading(false);
            return;
          }
        }
      }
    } catch {}

    // Still not found — retry single endpoint after 3s (cache might still be loading)
    await new Promise(r => setTimeout(r, 3000));
    try {
      const res = await fetch(`${API_URL}/markets/${address}`);
      if (res.ok) {
        const data = await res.json();
        if (isValidMarket(data)) {
          setMarket(data);
        }
      }
    } catch {}

    setLoading(false);
  }, [address]);

  useEffect(() => {
    fetchMarket();
  }, [fetchMarket]);

  return { market, loading, refetch: fetchMarket };
}
