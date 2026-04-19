import { useState, useEffect } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { parseUnits } from 'ethers';
import { useWallet } from '../hooks/useWallet.js';
import { useSponsoredTx } from '../hooks/useSponsoredTx.js';
import { useV6Market } from '../hooks/useV6Markets.js';
import { USDC_ADDRESS } from '../config.js';
import OPickV6MarketAbi from '../abi/OPickV6Market.json';
import USDCAbi from '../abi/MockUSDC.json';
import s from './MarketV6.module.css';

function truncAddr(a) { return a ? `${a.slice(0, 6)}...${a.slice(-4)}` : ''; }

function formatTimeRemaining(seconds) {
  if (!seconds || seconds <= 0) return 'Expired';
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  if (d > 0) return `${d}d ${h}h`;
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m}m`;
}

export default function MarketV6({ onConnect, authenticated }) {
  const { address: marketAddress } = useParams();
  const [searchParams] = useSearchParams();
  const { account } = useWallet();
  const { sponsoredCall } = useSponsoredTx();
  const { market, loading, refetch } = useV6Market(marketAddress);

  const [pickSide, setPickSide] = useState(null); // 'A' or 'B'
  const [amount, setAmount] = useState('1');
  const [txLoading, setTxLoading] = useState(false);
  const [txError, setTxError] = useState('');
  const [txSuccess, setTxSuccess] = useState('');
  const [claimLoading, setClaimLoading] = useState(false);
  const [closeLoading, setCloseLoading] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  const [copied, setCopied] = useState(false);

  // Capture referrer from URL
  useEffect(() => {
    const ref = searchParams.get('ref');
    if (ref && /^0x[a-fA-F0-9]{40}$/.test(ref) && marketAddress) {
      localStorage.setItem(`opick_ref_${marketAddress.toLowerCase()}`, ref.toLowerCase());
    }
  }, [searchParams, marketAddress]);

  const handleBuy = async () => {
    if (!amount || Number(amount) < 1) { setTxError('Minimum $1 per pick.'); return; }
    setTxError('');
    setTxSuccess('');
    setTxLoading(true);
    try {
      const amountBigInt = parseUnits(amount, 6);
      // Approve USDC first
      await sponsoredCall(USDC_ADDRESS, USDCAbi, 'approve', [marketAddress, amountBigInt]);
      // Buy
      const isSideA = pickSide === 'A';
      const referrer = localStorage.getItem(`opick_ref_${marketAddress.toLowerCase()}`) || '0x0000000000000000000000000000000000000000';
      await sponsoredCall(marketAddress, OPickV6MarketAbi, 'buy', [isSideA, amountBigInt, referrer]);
      setTxSuccess(`Locked $${amount} on ${isSideA ? market.sideAName : market.sideBName}`);
      setPickSide(null);
      refetch();
    } catch (err) {
      const msg = err?.reason || err?.message || 'Transaction failed.';
      setTxError(msg.length > 100 ? msg.slice(0, 100) + '...' : msg);
    } finally {
      setTxLoading(false);
    }
  };

  const handleClaim = async () => {
    setClaimLoading(true);
    setTxError('');
    try {
      await sponsoredCall(marketAddress, OPickV6MarketAbi, 'claim', []);
      setTxSuccess('Claimed successfully!');
      refetch();
    } catch (err) {
      setTxError(err?.reason || err?.message || 'Claim failed.');
    } finally {
      setClaimLoading(false);
    }
  };

  const handleClose = async () => {
    setCloseLoading(true);
    setTxError('');
    try {
      await sponsoredCall(marketAddress, OPickV6MarketAbi, 'close', []);
      setTxSuccess('Market closed. All deposits will be refunded.');
      setConfirmClose(false);
      refetch();
    } catch (err) {
      setTxError(err?.reason || err?.message || 'Close failed.');
    } finally {
      setCloseLoading(false);
    }
  };

  const handleCopyRef = () => {
    if (!account) return;
    navigator.clipboard.writeText(`https://opick.io/v6/m/${marketAddress}?ref=${account}`).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className={s.page}>
        <div className={s.loading}>Loading market...</div>
      </div>
    );
  }

  if (!market) {
    return (
      <div className={s.page}>
        <div className={s.loading}>Market not found. <Link to="/" className={s.backLink}>Back to markets</Link></div>
      </div>
    );
  }

  const pct = market.progress_percentage || 0;
  const isOpen = market.state === 'OPEN';
  const isResolved = market.state === 'CLOSED_RESOLVED';
  const isRefunded = market.state === 'CLOSED_REFUNDED';
  const isCreator = account && market.creator?.toLowerCase() === account.toLowerCase();
  const sideAPct = market.current_pool_usdc > 0 ? Math.round((market.side_a_usdc / market.current_pool_usdc) * 100) : 50;
  const sideBPct = 100 - sideAPct;

  return (
    <div className={s.page}>
      <Link to="/" className={s.backLink}>All markets</Link>

      <div className={s.header}>
        <h1 className={s.topic}>{market.topic}</h1>
        <div className={s.meta}>
          <span className={s.metaItem}>by {truncAddr(market.creator)}</span>
          {market.category && <span className={s.categoryBadge}>{market.category}</span>}
          {isOpen && <span className={s.timeLabel}>Closes in {formatTimeRemaining(market.seconds_until_expiry)}</span>}
          {!isOpen && <span className={s.stateLabel}>{market.state.replace('CLOSED_', '')}</span>}
        </div>
      </div>

      {/* Progress bar */}
      <div className={s.progressSection}>
        <div className={s.progressTrack}>
          <div className={s.progressFill} style={{ width: `${Math.min(pct, 100)}%` }} />
        </div>
        <div className={s.progressInfo}>
          <span className={s.pctLabel}>{pct}% filled</span>
          <span className={s.dollarLabel}>${market.current_pool_usdc?.toFixed(2)} of ${market.volume_cap_usdc?.toFixed(0)}</span>
        </div>
        <p className={s.progressNote}>Market closes when pool fills</p>
      </div>

      {/* Side cards */}
      {isOpen && (
        <>
          <div className={s.sidesRow}>
            <div className={s.sideCardA}>
              <h3 className={s.sideName}>{market.sideAName}</h3>
              <p className={s.sidePct}>{sideAPct}%</p>
              <p className={s.sideDollar}>${market.side_a_usdc?.toFixed(2)} / ${market.current_pool_usdc?.toFixed(2)}</p>
              <button className={s.pickBtnA} onClick={() => setPickSide('A')}>Pick {market.sideAName}</button>
            </div>
            <div className={s.sideCardB}>
              <h3 className={s.sideName}>{market.sideBName}</h3>
              <p className={s.sidePct}>{sideBPct}%</p>
              <p className={s.sideDollar}>${market.side_b_usdc?.toFixed(2)} / ${market.current_pool_usdc?.toFixed(2)}</p>
              <button className={s.pickBtnB} onClick={() => setPickSide('B')}>Pick {market.sideBName}</button>
            </div>
          </div>
          <p className={s.lockNotice}>Positions are locked until the market closes. No selling.</p>
        </>
      )}

      {/* Resolved state */}
      {isResolved && (
        <div className={s.resolvedSection}>
          <div className={market.winner_side === 'A' ? s.winnerCardA : s.winnerCardB}>
            <span className={s.winnerBadge}>WINNER</span>
            <h3 className={s.sideName}>{market.winner_side === 'A' ? market.sideAName : market.sideBName}</h3>
          </div>
          <button className={s.claimBtn} onClick={handleClaim} disabled={claimLoading}>
            {claimLoading ? 'Claiming...' : 'Claim winnings'}
          </button>
        </div>
      )}

      {/* Refunded state */}
      {isRefunded && (
        <div className={s.refundSection}>
          <p className={s.refundText}>Market did not resolve. Pool refunds are available.</p>
          <button className={s.claimBtn} onClick={handleClaim} disabled={claimLoading}>
            {claimLoading ? 'Claiming...' : 'Claim refund'}
          </button>
        </div>
      )}

      {/* Pick modal */}
      {pickSide && (
        <div className={s.modalOverlay} onClick={() => setPickSide(null)}>
          <div className={s.modal} onClick={(e) => e.stopPropagation()}>
            <h3 className={s.modalTitle}>Lock in on {pickSide === 'A' ? market.sideAName : market.sideBName}</h3>
            <div className={s.modalField}>
              <label className={s.modalLabel}>Amount (USDC)</label>
              <input type="number" className={s.modalInput} value={amount}
                onChange={(e) => setAmount(e.target.value)} min="1" step="1" />
              <p className={s.modalHelper}>Min $1 per pick</p>
            </div>
            <p className={s.modalInfo}>You will receive: {amount || '0'} shares</p>
            <p className={s.modalInfo}>Fee: 3% total (deducted on resolution)</p>
            <div className={s.modalButtons}>
              <button className={s.cancelBtn} onClick={() => setPickSide(null)}>Cancel</button>
              <button className={pickSide === 'A' ? s.lockBtnA : s.lockBtnB}
                onClick={handleBuy} disabled={txLoading || !amount || Number(amount) < 1}>
                {txLoading ? 'Processing...' : 'Lock position'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Errors and success */}
      {txError && <div className={s.errorMsg}>{txError}</div>}
      {txSuccess && <div className={s.successMsg}>{txSuccess}</div>}

      {/* Referral link */}
      {account && isOpen && (
        <div className={s.refSection}>
          <p className={s.refTitle}>Share to earn 1% on referred bets</p>
          <div className={s.refRow}>
            <span className={s.refUrl}>opick.io/v6/m/{truncAddr(marketAddress)}?ref={truncAddr(account)}</span>
            <button className={s.refCopyBtn} onClick={handleCopyRef}>{copied ? 'Copied' : 'Copy link'}</button>
          </div>
        </div>
      )}

      {/* Creator controls */}
      {isCreator && isOpen && (
        <div className={s.creatorControls}>
          <p className={s.creatorTitle}>Creator controls</p>
          {!confirmClose ? (
            <button className={s.closeBtn} onClick={() => setConfirmClose(true)}>
              Close market and refund all
            </button>
          ) : (
            <div>
              <p className={s.closeWarning}>Refund all deposits? This cannot be undone.</p>
              <div className={s.closeActions}>
                <button className={s.cancelBtn} onClick={() => setConfirmClose(false)}>Cancel</button>
                <button className={s.closeConfirmBtn} onClick={handleClose} disabled={closeLoading}>
                  {closeLoading ? 'Closing...' : 'Confirm'}
                </button>
              </div>
            </div>
          )}
          <p className={s.closeNote}>This returns all deposits to bettors. No fees collected on refunded markets.</p>
        </div>
      )}
    </div>
  );
}
