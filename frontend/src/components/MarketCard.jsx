import { Link } from 'react-router-dom';
import styles from './MarketCard.module.css';

function formatVolume(value) {
  if (value === 0) return '$0';
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  return `$${Math.round(value)}`;
}

function formatPercent(price) {
  return `${(price * 100).toFixed(1)}%`;
}

export default function MarketCard({ market }) {
  const { address, topic, sideAName, sideBName, category, priceA, priceB, totalVolume } = market;
  const pctA = priceA * 100;
  const lineColor = pctA >= 50 ? 'var(--green)' : 'var(--red)';

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
          <path
            d={`M0,${55 - pctA * 0.5} C40,${50 - pctA * 0.4} 70,${30 + (50 - pctA) * 0.3} 100,${40 - pctA * 0.2} C130,${45 - pctA * 0.3} 160,${25 + (50 - pctA) * 0.2} 200,${38 - pctA * 0.15} C240,${42 - pctA * 0.25} 260,${35 - (pctA - 50) * 0.4} 280,${35 - (pctA - 50) * 0.5}`}
            fill="none"
            stroke={lineColor}
            strokeWidth="1.5"
            strokeLinecap="round"
          />
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
