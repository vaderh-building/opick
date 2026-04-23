import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMarkets } from '../../hooks/useMarkets.js';
import SmallCapsLabel from '../../components/v6/SmallCapsLabel.jsx';
import HairlineRule from '../../components/v6/HairlineRule.jsx';
import LiveTimestamp from '../../components/v6/LiveTimestamp.jsx';
import PulsingDot from '../../components/v6/PulsingDot.jsx';
import styles from './LegacyPage.module.css';

function formatDate(value) {
  if (!value) return '—';
  try {
    const d = typeof value === 'number' ? new Date(value * 1000) : new Date(value);
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: '2-digit' });
  } catch {
    return '—';
  }
}

function truncAddr(a) {
  if (!a) return '';
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

export default function LegacyPage() {
  const { markets, loading } = useMarkets();
  // If the backend is offline we still render the page gracefully.
  const [err, setErr] = useState(null);
  useEffect(() => {
    const t = setTimeout(() => {
      if (loading) setErr('The V5 index is not currently available.');
    }, 5000);
    return () => clearTimeout(t);
  }, [loading]);

  return (
    <div className={styles.page}>
      <div className={styles.crumbs}>
        <Link to="/" className={styles.crumb}>The Index</Link>
        <span className={styles.crumbDiv}>/</span>
        <span className={styles.crumbCurrent}>Archive</span>
      </div>

      <section className={styles.masthead}>
        <SmallCapsLabel size="md" className={styles.kicker}>Archive</SmallCapsLabel>
        <h1 className={styles.title}>Opinion Markets, 2025 – early 2026</h1>
        <p className={styles.subtitle}>
          The following markets were created under an earlier version of OPick and are preserved for record. New activity is on the Attention Index.
        </p>
      </section>

      <HairlineRule margin="lg" />

      <section className={styles.body}>
        {err && <p className={styles.err}>{err}</p>}

        {!err && loading ? (
          <p className={styles.loading}>Loading archive…</p>
        ) : null}

        {!loading && !markets.length && !err ? (
          <p className={styles.empty}>No archived markets on file.</p>
        ) : null}

        {markets.length > 0 && (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Topic</th>
                  <th>Sides</th>
                  <th>Creator</th>
                  <th>Created</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {markets.map((m) => (
                  <tr key={m.address}>
                    <td className={styles.topic}>
                      <span className={styles.topicText}>{m.topic}</span>
                    </td>
                    <td className={styles.sides}>
                      <span>{m.sideAName || 'A'}</span>
                      <span className={styles.vs}>vs</span>
                      <span>{m.sideBName || 'B'}</span>
                    </td>
                    <td className={styles.addr}>{truncAddr(m.creator)}</td>
                    <td className={styles.date}>{formatDate(m.createdAt || m.created_at)}</td>
                    <td className={styles.linkCell}>
                      <Link
                        to={`/legacy/market/${m.address}`}
                        className={styles.link}
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <footer className={styles.footer}>
        <HairlineRule margin="none" />
        <div className={styles.footerRow}>
          <span className={styles.footerLive}>
            <PulsingDot /> <SmallCapsLabel size="xs">OPick Oracle — Live</SmallCapsLabel>
          </span>
          <LiveTimestamp />
          <span className={styles.footerLinks}>
            <Link to="/">Index</Link>
            <span className={styles.footerDiv}>·</span>
            <Link to="/about">Method</Link>
          </span>
        </div>
      </footer>
    </div>
  );
}
