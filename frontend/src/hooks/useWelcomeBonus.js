import { useState, useEffect, useRef } from 'react';

const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:3001') + '/api';

export function useWelcomeBonus(account) {
  const [status, setStatus] = useState('idle'); // idle | claiming | claimed | already_claimed | failed
  const [amount, setAmount] = useState(null);
  const [txHash, setTxHash] = useState(null);
  const attempted = useRef(false);

  useEffect(() => {
    if (!account || !account.startsWith('0x') || attempted.current) return;

    // Check localStorage first
    const key = `opick_welcome_claimed_${account.toLowerCase()}`;
    if (localStorage.getItem(key)) {
      setStatus('already_claimed');
      return;
    }

    attempted.current = true;

    (async () => {
      // Check backend status
      try {
        const res = await fetch(`${API_URL}/welcome-bonus-status?address=${account}`);
        const data = await res.json();
        if (data.claimed) {
          localStorage.setItem(key, 'true');
          setStatus('already_claimed');
          return;
        }
      } catch {}

      // Claim the bonus
      setStatus('claiming');
      try {
        const res = await fetch(`${API_URL}/claim-welcome-bonus`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ walletAddress: account }),
        });
        const data = await res.json();
        if (data.success) {
          setStatus('claimed');
          setAmount(data.amount);
          setTxHash(data.txHash);
          localStorage.setItem(key, 'true');
        } else if (data.reason === 'already_claimed') {
          setStatus('already_claimed');
          localStorage.setItem(key, 'true');
        } else {
          setStatus('failed');
        }
      } catch {
        setStatus('failed');
      }
    })();
  }, [account]);

  return { status, amount, txHash };
}
