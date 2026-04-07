import { useEffect, useRef } from 'react';

const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:3001') + '/api';

export function useReferralCapture(account) {
  const registered = useRef(false);

  // Capture ref param from URL on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get('ref');
    if (ref && /^0x[a-fA-F0-9]{40}$/.test(ref)) {
      const stored = localStorage.getItem('opick_referrer');
      if (!stored) localStorage.setItem('opick_referrer', ref.toLowerCase());
    }
  }, []);

  // Register referral when account becomes available
  useEffect(() => {
    if (!account || !account.startsWith('0x') || registered.current) return;
    const referrer = localStorage.getItem('opick_referrer');
    if (!referrer || referrer.toLowerCase() === account.toLowerCase()) return;

    registered.current = true;
    fetch(`${API_URL}/register-referral`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ referee: account, referrer }),
    })
      .then(r => r.json())
      .then(data => {
        if (data.success || data.reason === 'already_referred') {
          localStorage.removeItem('opick_referrer');
        }
      })
      .catch(() => {});
  }, [account]);
}
