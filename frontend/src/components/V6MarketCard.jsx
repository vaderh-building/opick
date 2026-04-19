import { Link } from 'react-router-dom';
import styles from './V6MarketCard.module.css';

function truncAddr(a) { return a ? `${a.slice(0, 6)}...${a.slice(-4)}` : ''; }

function formatTimeRemaining(seconds) {
  if (!seconds || seconds <= 0) return 'Expired';
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  if (d > 0) return `${d}d ${h}h remaining`;
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m}m remaining`;
}

export default function V6MarketCard({ market }) {
  const pct = market.progress_percentage || 0;
  const stateLabel = market.state === 'OPEN' ? 'Open'
    : market.state === 'CLOSED_RESOLVED' ? 'Resolved'
    : market.state === 'CLOSED_REFUNDED' ? 'Refunded'
    : market.state;

  return (
    <Link to={`/v6/m/${market.address}`} className={styles.card}>
      <div className={styles.topRow}>
        {market.category && <span className={styles.category}>{market.category}</span>}
        <span className={market.state === 'OPEN' ? styles.statusOpen : styles.statusClosed}>
          {stateLabel}
        </span>
      </div>

      <h3 className={styles.topic}>{market.topic}</h3>

      <div className={styles.progressWrap}>
        <div className={styles.progressTrack}>
          <div className={styles.progressFill} style={{ width: `${Math.min(pct, 100)}%` }} />
        </div>
        <div className={styles.progressLabel}>
          <span className={styles.pctText}>{pct}% filled</span>
        </div>
        <span className={styles.dollarText}>
          (${market.current_pool_usdc?.toFixed(0) || 0} of ${market.volume_cap_usdc?.toFixed(0) || 0})
        </span>
      </div>

      <div className={styles.footer}>
        <span className={styles.time}>
          {market.state === 'OPEN' ? formatTimeRemaining(market.seconds_until_expiry) : stateLabel}
        </span>
        <span className={styles.creator}>by {truncAddr(market.creator)}</span>
      </div>
    </Link>
  );
}
