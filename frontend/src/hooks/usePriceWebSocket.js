import { useState, useEffect, useRef } from 'react';

const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:3001';

export function usePriceWebSocket() {
  const [prices, setPrices] = useState({});
  const ws = useRef(null);

  useEffect(() => {
    const connect = () => {
      ws.current = new WebSocket(WS_URL);
      ws.current.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'prices') {
            setPrices(msg.data);
          }
        } catch (e) {}
      };
      ws.current.onclose = () => {
        setTimeout(connect, 3000);
      };
    };
    connect();
    return () => { if (ws.current) ws.current.close(); };
  }, []);

  return prices;
}
