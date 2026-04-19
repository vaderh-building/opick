import { useState, useMemo, useRef } from 'react';
import { useMarkets } from '../hooks/useMarkets.js';
import { useV6Markets } from '../hooks/useV6Markets.js';
import { usePriceWebSocket } from '../hooks/usePriceWebSocket.js';
import MarketCard from '../components/MarketCard.jsx';
import V6MarketCard from '../components/V6MarketCard.jsx';
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
  const [activeTab, setActiveTab] = useState('v6');
  const [activeCategory, setActiveCategory] = useState('All');
  const [sortBy, setSortBy] = useState('volume');
  const [search, setSearch] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const searchRef = useRef(null);
  const { markets, loading } = useMarkets();
  const { markets: v6Markets, loading: v6Loading } = useV6Markets();
  const wsPrices = usePriceWebSocket();

  // Merge WS prices into market data and parse numeric values
  const mergedMarkets = useMemo(() => {
    return markets.map((m) => {
      const ws = wsPrices[m.address];
      const priceA = parsePrice(ws?.priceA ?? m.priceA);
      const priceB = parsePrice(ws?.priceB ?? m.priceB);
      return {
        ...m,
        priceA: isNaN(priceA) ? 0.5 : priceA,
        priceB: isNaN(priceB) ? 0.5 : priceB,
        totalVolume: parseUSDC(m.totalVolume) || 0,
        creatorEarnings: parseUSDC(m.creatorEarnings) || 0,
        reserveA: parseUSDC(m.reserveA) || 0,
        reserveB: parseUSDC(m.reserveB) || 0,
      };
    });
  }, [markets, wsPrices]);

  // Filter & sort
  const filtered = useMemo(() => {
    let result = mergedMarkets;
    if (activeCategory !== 'All') {
      result = result.filter((m) => m.category === activeCategory);
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter((m) =>
        (m.topic || '').toLowerCase().includes(q) ||
        (m.sideAName || '').toLowerCase().includes(q) ||
        (m.sideBName || '').toLowerCase().includes(q) ||
        (m.category || '').toLowerCase().includes(q)
      );
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
  }, [mergedMarkets, activeCategory, sortBy, search]);

  const totalVolume = mergedMarkets.reduce((s, m) => s + m.totalVolume, 0);
  const activeCount = mergedMarkets.length;
  const totalEarnings = mergedMarkets.reduce((s, m) => s + m.creatorEarnings, 0);

  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <h1 className={styles.heroTitle}>A market for every <em className={styles.heroOpinion}>opinion.</em></h1>
        <p className={styles.heroSubtitle}>
          See what the world thinks. Pick a side, profit when others agree.
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

      <div className={styles.versionTabs}>
        <button className={activeTab === 'v6' ? styles.vTabActive : styles.vTab} onClick={() => setActiveTab('v6')}>
          Live Markets (V6)
        </button>
        <button className={activeTab === 'v5' ? styles.vTabActive : styles.vTab} onClick={() => setActiveTab('v5')}>
          Legacy Markets (V5)
        </button>
      </div>

      {activeTab === 'v6' && (
        <>
          <div className={styles.grid}>
            {v6Markets.map((m) => <V6MarketCard key={m.address} market={m} />)}
          </div>
          {!v6Loading && v6Markets.length === 0 && (
            <p className={styles.empty}>No V6 markets yet. <a href="/create/v6" className={styles.createLink}>Create one</a></p>
          )}
          {v6Loading && <p className={styles.empty}>Loading V6 markets...</p>}
        </>
      )}

      {activeTab === 'v5' && <>
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
        <div className={styles.filterRight}>
          <select
            className={styles.sortSelect}
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
          >
            {SORT_OPTIONS.map(({ value, label }) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
          <button
            className={`${styles.searchToggle} ${searchOpen ? styles.searchToggleActive : ''}`}
            onClick={() => { setSearchOpen(!searchOpen); if (!searchOpen) setTimeout(() => searchRef.current?.focus(), 50); }}
            title="Search markets"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </button>
        </div>
      </div>

      <div className={`${styles.searchBar} ${searchOpen ? styles.searchBarOpen : ''}`}>
        <div className={styles.searchWrap}>
          <svg className={styles.searchIcon} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            ref={searchRef}
            type="text"
            className={styles.searchInput}
            placeholder="Search markets..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onBlur={() => { if (!search) setSearchOpen(false); }}
          />
          {search && (
            <button className={styles.searchClear} onClick={() => { setSearch(''); setSearchOpen(false); }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}
        </div>
      </div>

      <div className={styles.grid}>
        {filtered.map((market) => (
          <MarketCard key={market.address} market={market} />
        ))}
      </div>

      {!loading && filtered.length === 0 && (
        <p className={styles.empty}>No markets found.</p>
      )}
      {loading && (
        <p className={styles.empty}>Loading markets...</p>
      )}
      </>}
    </div>
  );
}
