const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:3001') + '/api';

export function triggerReferralCheck(address) {
  if (!address || !address.startsWith('0x')) return;
  fetch(`${API_URL}/check-referral-payout`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ address }),
  }).catch(() => {});
}
