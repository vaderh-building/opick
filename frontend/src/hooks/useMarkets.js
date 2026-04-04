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

export function useMarket(address) {
  const [market, setMarket] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchMarket = useCallback(async () => {
    if (!address) return;
    try {
      const res = await fetch(`${API_URL}/markets/${address}`);
      const data = await res.json();
      // Only set if it has real market data (not an error object)
      if (data && data.topic) {
        setMarket(data);
      } else if (data && data.error) {
        console.error('Market API error:', data.error, data.details);
      }
    } catch (err) {
      console.error('Failed to fetch market:', err);
    } finally {
      setLoading(false);
    }
  }, [address]);

  useEffect(() => {
    fetchMarket();
  }, [fetchMarket]);

  return { market, loading, refetch: fetchMarket };
}
