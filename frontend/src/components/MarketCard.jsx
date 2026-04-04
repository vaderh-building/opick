import { Link } from 'react-router-dom';
import styles from './MarketCard.module.css';

function formatVolume(value) {
  const v = Number(value) || 0;
  if (v === 0) return '$0';
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(1)}K`;
  return `$${Math.round(v)}`;
}

function formatPercent(price) {
  const p = Number(price) || 0;
  return `${(p * 100).toFixed(1)}%`;
}

export default function MarketCard({ market }) {
  if (!market) return null;

  const {
    address = '',
    topic = 'Untitled',
    sideAName = 'Side A',
    sideBName = 'Side B',
    category = '',
    priceA: rawA = 0.5,
    priceB: rawB = 0.5,
    totalVolume = 0,
  } = market;

  const priceA = Number(rawA) || 0.5;
  const priceB = Number(rawB) || 0.5;
  const pctA = priceA * 100;

  return (
    <Link to={`/market/${address}`} className={styles.card}>
      <div className={styles.topRow}>
        <span className={styles.category}>{category}</span>
        <span className={styles.volume}>{formatVolume(totalVolume)}</span>
      </div>

      <h3 className={styles.title}>{topic}</h3>

      <div className={styles.chartArea}>
        <svg className={styles.chartSvg} viewBox="0 0 280 70" preserveAspectRatio="none">
          <line x1="0" y1="35" x2="280" y2="35" stroke="var(--border-dim)" strokeWidth="0.5" strokeDasharray="3 3" />
          <line x1="0" y1={35 - (pctA - 50) * 0.5} x2="280" y2={35 - (pctA - 50) * 0.5}
            stroke={pctA >= 50 ? 'var(--green)' : 'var(--red)'} strokeWidth="1.5" />
        </svg>
        <span className={styles.chartLabel}>50%</span>
      </div>

      <div className={styles.sides}>
        <div className={styles.sideA}>
          <span className={`${styles.sideName} ${styles.sideNameA}`}>{sideAName}</span>
          <span className={`${styles.sidePrice} ${styles.priceGreen}`}>{formatPercent(priceA)}</span>
        </div>
        <span className={styles.vs}>vs</span>
        <div className={styles.sideB}>
          <span className={`${styles.sideName} ${styles.sideNameB}`}>{sideBName}</span>
          <span className={`${styles.sidePrice} ${styles.priceRed}`}>{formatPercent(priceB)}</span>
        </div>
      </div>

      <div className={styles.convictionBar}>
        <div className={styles.convictionA} style={{ width: `${pctA}%` }} />
        <div className={styles.convictionB} style={{ width: `${100 - pctA}%` }} />
      </div>
    </Link>
  );
}
