import { Link } from 'react-router-dom';
import { useMarkets } from '../hooks/useMarkets.js';
import { usePriceWebSocket } from '../hooks/usePriceWebSocket.js';
import MarketCard from '../components/MarketCard.jsx';
import styles from './LandingPage.module.css';

const PRECISION = 1e18;
function parsePrice(val) { return Number(val) / PRECISION; }
function parseUSDC(val) { return Number(val) / 1e6; }

export default function LandingPage() {
  const { markets } = useMarkets();
  const wsPrices = usePriceWebSocket();

  const parsed = markets.map((m) => {
    const ws = wsPrices[m.address];
    const pA = parsePrice(ws?.priceA ?? m.priceA);
    const pB = parsePrice(ws?.priceB ?? m.priceB);
    return {
      ...m,
      priceA: isNaN(pA) ? 0.5 : pA,
      priceB: isNaN(pB) ? 0.5 : pB,
      totalVolume: parseUSDC(m.totalVolume) || 0,
      creatorEarnings: parseUSDC(m.creatorEarnings) || 0,
    };
  });

  const featured = [...parsed]
    .sort((a, b) => b.totalVolume - a.totalVolume)
    .slice(0, 4);

  return (
    <div className={styles.page}>
      {/* Hero */}
      <section className={styles.hero}>
        <h1 className={styles.heroTitle}>
          A market for every <em>opinion.</em>
        </h1>
        <p className={styles.heroSub}>
          See what the world thinks. Pick a side,<br />
          profit when others agree.
        </p>
        <Link to="/markets" className={styles.cta}>Browse Markets</Link>
        <p className={styles.tosLine}>
          By using OPick, you agree to our <a href="/terms" target="_blank" rel="noopener noreferrer">Terms</a>, <a href="/privacy" target="_blank" rel="noopener noreferrer">Privacy Policy</a>, and <a href="/risk" target="_blank" rel="noopener noreferrer">Risk Disclosure</a>.
        </p>
      </section>

      {/* Featured */}
      {featured.length > 0 && (
        <section className={styles.featured}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>Trending debates</h2>
            <Link to="/markets" className={styles.viewAll}>View all &rarr;</Link>
          </div>
          <div className={styles.grid}>
            {featured.map((m) => (
              <MarketCard key={m.address} market={m} />
            ))}
          </div>
        </section>
      )}

      {/* How it works */}
      <section className={styles.howSection}>
        <h2 className={styles.sectionTitle}>How it works</h2>
        <div className={styles.steps}>
          <div className={styles.step}>
            <span className={styles.stepNum}>1</span>
            <div>
              <p className={styles.stepLabel}>Create a market</p>
              <p className={styles.stepBody}>Pick any debate, name both sides, go live instantly.</p>
            </div>
          </div>
          <div className={styles.step}>
            <span className={styles.stepNum}>2</span>
            <div>
              <p className={styles.stepLabel}>Pick a side</p>
              <p className={styles.stepBody}>Put money behind your opinion. Price reflects consensus.</p>
            </div>
          </div>
          <div className={styles.step}>
            <span className={styles.stepNum}>3</span>
            <div>
              <p className={styles.stepLabel}>Profit when others agree</p>
              <p className={styles.stepBody}>Sell anytime. If more people join your side, you profit.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className={styles.bottomCta}>
        <p className={styles.bottomText}>Have a debate the world should weigh in on?</p>
        <Link to="/create" className={styles.ctaOutline}>Create a Market</Link>
      </section>
    </div>
  );
}
