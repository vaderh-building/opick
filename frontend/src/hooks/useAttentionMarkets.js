import { useEffect, useState } from 'react';
import { fetchMarkets, fetchMarket, fetchMarketsForSubject } from '../lib/oracle.js';

export function useAttentionMarkets() {
  const [markets, setMarkets] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetchMarkets().then((list) => {
      if (cancelled) return;
      setMarkets(list || []);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  return { markets, loading };
}

export function useAttentionMarket(id) {
  const [market, setMarket] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    if (!id) { setLoading(false); return; }
    setLoading(true);
    fetchMarket(id).then((m) => {
      if (cancelled) return;
      setMarket(m);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [id]);

  return { market, loading };
}

export function useMarketsForSubject(slug) {
  const [markets, setMarkets] = useState([]);
  useEffect(() => {
    let cancelled = false;
    if (!slug) return;
    fetchMarketsForSubject(slug).then((list) => {
      if (cancelled) return;
      setMarkets(list || []);
    });
    return () => { cancelled = true; };
  }, [slug]);
  return markets;
}
