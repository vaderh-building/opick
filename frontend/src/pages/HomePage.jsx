import { useState, useMemo } from 'react';
import { useMarkets } from '../hooks/useMarkets.js';
import { usePriceWebSocket } from '../hooks/usePriceWebSocket.js';
import MarketCard from '../components/MarketCard.jsx';
import styles from './HomePage.module.css';

const CATEGORIES = ['All', 'Sports', 'Music', 'Tech', 'Culture', 'Finance', 'Lifestyle'];
const SORT_OPTIONS = [
  { value: 'volume', label: 'Volume' },
  { value: 'movers', label: 'Biggest movers' },
  { value: 'contested', label: 'Most contested' },
  { value: 'newest', label: 'Newest' },
];

const PRECISION = 1e18;

function parsePrice(val) {
  return Number(val) / PRECISION;
}

function parseUSDC(val) {
  return Number(val) / 1e6;
}

function formatUSD(value) {
  if (value === 0) return '$0';
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  return `$${Math.round(value)}`;
}

export default function HomePage() {
  const [activeCategory, setActiveCategory] = useState('All');
  const [sortBy, setSortBy] = useState('volume');
  const { markets, loading } = useMarkets();
  const wsPrices = usePriceWebSocket();

  // Merge WS prices into market data and parse numeric values
  const mergedMarkets = useMemo(() => {
    return markets.map((m) => {
      const ws = wsPrices[m.address];
      const priceA = parsePrice(ws?.priceA ?? m.priceA);
      const priceB = parsePrice(ws?.priceB ?? m.priceB);
      return {
        ...m,
        priceA,
        priceB,
        totalVolume: parseUSDC(m.totalVolume),
        creatorEarnings: parseUSDC(m.creatorEarnings),
        reserveA: parseUSDC(m.reserveA),
        reserveB: parseUSDC(m.reserveB),
      };
    });
  }, [markets, wsPrices]);

  // Filter & sort
  const filtered = useMemo(() => {
    let result = mergedMarkets;
    if (activeCategory !== 'All') {
      result = result.filter((m) => m.category === activeCategory);
    }
    switch (sortBy) {
      case 'volume':
        result = [...result].sort((a, b) => b.totalVolume - a.totalVolume);
        break;
      case 'movers':
        result = [...result].sort((a, b) => Math.abs(b.priceA - 0.5) - Math.abs(a.priceA - 0.5));
        break;
      case 'contested':
        result = [...result].sort((a, b) => Math.abs(a.priceA - 0.5) - Math.abs(b.priceA - 0.5));
        break;
      case 'newest':
        result = [...result].reverse();
        break;
      default:
        break;
    }
    return result;
  }, [mergedMarkets, activeCategory, sortBy]);

  const totalVolume = mergedMarkets.reduce((s, m) => s + m.totalVolume, 0);
  const activeCount = mergedMarkets.length;
  const totalEarnings = mergedMarkets.reduce((s, m) => s + m.creatorEarnings, 0);

  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <h1 className={styles.heroTitle}>A market for every <em className={styles.heroOpinion}>opinion.</em></h1>
        <p className={styles.heroSubtitle}>
          Create a debate on anything. Pick a side with real money. No right answer — only what people believe.
        </p>
      </section>

      <div className={styles.statsBar}>
        <div className={styles.statBox}>
          <span className={styles.statLabel}>24h Volume</span>
          <span className={styles.statValue}>{formatUSD(totalVolume)}</span>
        </div>
        <div className={styles.statBox}>
          <span className={styles.statLabel}>Active Markets</span>
          <span className={styles.statValue}>{activeCount}</span>
        </div>
        <div className={styles.statBox}>
          <span className={styles.statLabel}>Creator Earnings</span>
          <span className={styles.statValue}>{formatUSD(totalEarnings)}</span>
        </div>
      </div>

      <div className={styles.filterRow}>
        <div className={styles.categories}>
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              className={`${styles.catPill} ${activeCategory === cat ? styles.catPillActive : ''}`}
              onClick={() => setActiveCategory(cat)}
            >
              {cat}
            </button>
          ))}
        </div>
        <select
          className={styles.sortSelect}
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
        >
          {SORT_OPTIONS.map(({ value, label }) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </div>

      <div className={styles.grid}>
        {filtered.map((market) => (
          <MarketCard key={market.address} market={market} />
        ))}
      </div>

      {!loading && filtered.length === 0 && (
        <p className={styles.empty}>No markets found in this category.</p>
      )}
      {loading && (
        <p className={styles.empty}>Loading markets...</p>
      )}
    </div>
  );
}
