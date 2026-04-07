import { useState } from 'react';
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
  return `${(p * 100).toFixed(2)}%`;
}

export default function MarketCard({ market }) {
  if (!market) return null;
  const [copied, setCopied] = useState(false);

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

  const handleShare = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    const url = `https://opick.io/market/${address}`;
    const text = `${topic} - ${sideAName} ${(pctA).toFixed(1)}% vs ${sideBName} ${(100 - pctA).toFixed(1)}% | Pick a side on OPick`;
    if (navigator.share) {
      try { await navigator.share({ title: topic, text, url }); return; } catch {}
    }
    try { await navigator.clipboard.writeText(url); } catch {}
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Link to={`/market/${address}`} className={styles.card}>
      <div className={styles.topRow}>
        <span className={styles.category}>{category}</span>
        <div className={styles.topRight}>
          <span className={styles.volume}>{formatVolume(totalVolume)}</span>
          <button className={styles.shareBtn} onClick={handleShare} title="Share">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8" /><polyline points="16 6 12 2 8 6" /><line x1="12" y1="2" x2="12" y2="15" />
            </svg>
            {copied && <span className={styles.cardToast}>Copied!</span>}
          </button>
        </div>
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
