import { useState, useEffect, useCallback } from 'react';

const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:3001') + '/api';

export function useV6Markets(stateFilter) {
  const [markets, setMarkets] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchMarkets = useCallback(async () => {
    try {
      const qs = stateFilter ? `?state=${stateFilter}` : '';
      const res = await fetch(`${API_URL}/v6/markets${qs}`);
      const data = await res.json();
      if (data.markets && Array.isArray(data.markets)) {
        setMarkets(data.markets);
      }
    } catch (err) {
      console.error('Failed to fetch V6 markets:', err);
    } finally {
      setLoading(false);
    }
  }, [stateFilter]);

  useEffect(() => { fetchMarkets(); }, [fetchMarkets]);

  return { markets, loading, refetch: fetchMarkets };
}

export function useV6Market(address) {
  const [market, setMarket] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchMarket = useCallback(async () => {
    if (!address) { setLoading(false); return; }
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/v6/markets/${address}`);
      if (res.ok) {
        const data = await res.json();
        setMarket(data);
      }
    } catch {}
    setLoading(false);
  }, [address]);

  useEffect(() => { fetchMarket(); }, [fetchMarket]);

  // Poll progress every 15s
  useEffect(() => {
    if (!address) return;
    const iv = setInterval(async () => {
      try {
        const res = await fetch(`${API_URL}/v6/markets/${address}/progress`);
        if (res.ok) {
          const prog = await res.json();
          setMarket(prev => prev ? { ...prev, ...prog, current_pool_usdc: prog.pool_filled_usdc, progress_percentage: prog.percentage, seconds_until_expiry: prog.seconds_remaining } : prev);
        }
      } catch {}
    }, 15000);
    return () => clearInterval(iv);
  }, [address]);

  return { market, loading, refetch: fetchMarket };
}
