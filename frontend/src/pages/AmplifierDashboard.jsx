import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useWallet } from '../hooks/useWallet.js';
import { useSponsoredTx } from '../hooks/useSponsoredTx.js';
import OPickV6MarketAbi from '../abi/OPickV6Market.json';
import s from './AmplifierDashboard.module.css';

const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:3001') + '/api';

function truncAddr(a) { return a ? `${a.slice(0, 6)}...${a.slice(-4)}` : ''; }

export default function AmplifierDashboard({ onConnect, authenticated }) {
  const { account } = useWallet();
  const { sponsoredCall } = useSponsoredTx();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [claimingId, setClaimingId] = useState(null);

  useEffect(() => {
    if (!account) { setLoading(false); return; }
    (async () => {
      try {
        const res = await fetch(`${API_URL}/v6/amplifier/${account}/earnings`);
        if (res.ok) setData(await res.json());
      } catch {}
      setLoading(false);
    })();
  }, [account]);

  const handleClaim = async (marketId) => {
    setClaimingId(marketId);
    try {
      await sponsoredCall(marketId, OPickV6MarketAbi, 'claimAmplifierFees', []);
      // Refresh data
      const res = await fetch(`${API_URL}/v6/amplifier/${account}/earnings`);
      if (res.ok) setData(await res.json());
    } catch {}
    setClaimingId(null);
  };

  if (!authenticated) {
    return (
      <div className={s.page}>
        <h1 className={s.title}>Amplifier earnings</h1>
        <div className={s.center}>
          <p className={s.muted}>Connect wallet to see your amplifier earnings</p>
          <button className={s.primaryBtn} onClick={onConnect}>Connect</button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className={s.page}>
        <h1 className={s.title}>Amplifier earnings</h1>
        <p className={s.muted}>Loading...</p>
      </div>
    );
  }

  const markets = data?.markets || [];
  const totalPending = data?.total_pending_usdc || 0;
  const totalClaimed = data?.total_claimed_usdc || 0;

  return (
    <div className={s.page}>
      <h1 className={s.title}>Amplifier earnings</h1>
      <p className={s.subtitle}>Earn 1% on every bet placed through your referral links</p>

      <div className={s.statsRow}>
        <div className={s.statCard}>
          <span className={s.statLabel}>Total pending</span>
          <span className={s.statValue}>${totalPending.toFixed(2)}</span>
        </div>
        <div className={s.statCard}>
          <span className={s.statLabel}>Total claimed</span>
          <span className={s.statValue}>${totalClaimed.toFixed(2)}</span>
        </div>
        <div className={s.statCard}>
          <span className={s.statLabel}>Markets</span>
          <span className={s.statValue}>{markets.length}</span>
        </div>
      </div>

      {markets.length === 0 ? (
        <div className={s.empty}>
          <p className={s.emptyText}>No amplifier earnings yet</p>
          <p className={s.emptySubtext}>Share V6 market links with your referral code to start earning.</p>
        </div>
      ) : (
        <div className={s.table}>
          <div className={s.tableHeader}>
            <span className={s.colStatus}>Status</span>
            <span className={s.colMarket}>Market</span>
            <span className={s.colVol}>Referred</span>
            <span className={s.colFees}>Pending</span>
            <span className={s.colAction}>Actions</span>
          </div>
          {markets.map((m) => (
            <div key={m.market_id} className={s.tableRow}>
              <span className={s.colStatus}>
                <span className={m.market_state === 'OPEN' ? s.badgeOpen : s.badgeClosed}>
                  {m.market_state === 'OPEN' ? 'Open' : m.market_state === 'CLOSED_RESOLVED' ? 'Resolved' : 'Refunded'}
                </span>
              </span>
              <span className={s.colMarket}>{m.market_topic?.slice(0, 30)}{m.market_topic?.length > 30 ? '...' : ''}</span>
              <span className={s.colVol}>${m.referred_volume_usdc?.toFixed(2)}</span>
              <span className={s.colFees}>${m.pending_fees_usdc?.toFixed(2)}</span>
              <span className={s.colAction}>
                {m.claimable && !m.claimed && (
                  <button className={s.claimBtn} onClick={() => handleClaim(m.market_id)}
                    disabled={claimingId === m.market_id}>
                    {claimingId === m.market_id ? '...' : 'Claim'}
                  </button>
                )}
                <Link to={`/v6/m/${m.market_id}`} className={s.viewLink}>View</Link>
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
