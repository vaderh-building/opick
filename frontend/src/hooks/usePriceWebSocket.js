import { useState, useEffect, useRef } from 'react';

const WS_URL = import.meta.env.VITE_WS_URL || '';

export function usePriceWebSocket() {
  const [prices, setPrices] = useState({});
  const ws = useRef(null);

  useEffect(() => {
    if (!WS_URL) return; // No WS in production unless configured

    const connect = () => {
      try {
        ws.current = new WebSocket(WS_URL);
        ws.current.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data);
            if (msg.type === 'prices') {
              setPrices(msg.data);
            }
          } catch {}
        };
        ws.current.onerror = () => {};
        ws.current.onclose = () => {
          setTimeout(connect, 10000);
        };
      } catch {}
    };
    connect();
    return () => { if (ws.current) ws.current.close(); };
  }, []);

  return prices;
}
