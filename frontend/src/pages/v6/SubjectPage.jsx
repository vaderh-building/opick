import { Link, useParams } from 'react-router-dom';
import { useSubject } from '../../hooks/useSubjects.js';
import { useMarketsForSubject } from '../../hooks/useAttentionMarkets.js';
import SmallCapsLabel from '../../components/v6/SmallCapsLabel.jsx';
import SubjectName from '../../components/v6/SubjectName.jsx';
import IndexNumber from '../../components/v6/IndexNumber.jsx';
import TombstoneTable from '../../components/v6/TombstoneTable.jsx';
import Sparkline from '../../components/v6/Sparkline.jsx';
import HairlineRule from '../../components/v6/HairlineRule.jsx';
import PulsingDot from '../../components/v6/PulsingDot.jsx';
import LiveTimestamp from '../../components/v6/LiveTimestamp.jsx';
import styles from './SubjectPage.module.css';

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: '2-digit' });
}

function formatPercent(n) {
  const sign = n > 0 ? '+' : n < 0 ? '' : '';
  return `${sign}${(n * 100).toFixed(1)}%`;
}

export default function SubjectPage() {
  const { slug } = useParams();
  const { subject, correlated, loading } = useSubject(slug);
  const subjectMarkets = useMarketsForSubject(slug);

  if (loading) {
    return (
      <div className={styles.page}>
        <p className={styles.loading}>Loading dossier…</p>
      </div>
    );
  }

  if (!subject) {
    return (
      <div className={styles.page}>
        <p className={styles.notFound}>
          No record of <em>{slug}</em> in the index.
        </p>
        <Link to="/" className={styles.backLink}>Return to the Index</Link>
      </div>
    );
  }

  const { metrics } = subject;

  return (
    <div className={styles.page}>
      <div className={styles.crumbs}>
        <Link to="/" className={styles.crumb}>The Index</Link>
        <span className={styles.crumbDiv}>/</span>
        <span className={styles.crumbCurrent}>{subject.name}</span>
      </div>

      <section className={styles.masthead}>
        <SmallCapsLabel size="md" className={styles.kicker}>Attention Dossier</SmallCapsLabel>
        <SubjectName variant="display" as="h1" className={styles.name}>{subject.name}</SubjectName>
        <p className={styles.handle}>{subject.handle}</p>
      </section>

      <HairlineRule margin="lg" />

      <section className={styles.grid}>
        {/* Left — profile */}
        <aside className={styles.leftCol}>
          <div
            className={`${styles.portraitFrame} ${
              subject.portraitUrl
                ? subject.isPerson
                  ? styles.portraitPerson
                  : styles.portraitLogo
                : ''
            }`}
            aria-hidden={subject.portraitUrl ? undefined : 'true'}
          >
            {subject.portraitUrl ? (
              <img
                src={subject.portraitUrl}
                alt={subject.name}
                loading="eager"
                className={styles.portraitImg}
              />
            ) : (
              <span className={styles.portraitInitials}>{initials(subject.name)}</span>
            )}
          </div>
          <SmallCapsLabel size="md" className={styles.colLabel}>Profile</SmallCapsLabel>
          <p className={styles.bio}>{subject.bio}</p>

          <TombstoneTable
            rows={[
              { label: 'Handle', value: subject.handle },
              { label: 'Tracked Since', value: formatDate(subject.trackedSince) },
              { label: 'Observable On', value: 'X (formerly Twitter)' },
            ]}
          />

          <div className={styles.leftLinks}>
            <a
              href={`https://x.com/${subject.handle.replace(/^@/, '')}`}
              target="_blank"
              rel="noreferrer"
              className={styles.leftLink}
            >
              View on X ↗
            </a>
          </div>
        </aside>

        {/* Middle — index + charts */}
        <div className={styles.middleCol}>
          <SmallCapsLabel size="md" className={styles.colLabel}>Engagement-Weighted Index</SmallCapsLabel>
          <div className={styles.heroNumber}>
            <IndexNumber value={metrics.engagementWeighted} variant="hero" />
          </div>
          <p className={styles.heroCaption}>7-day composite · updated hourly</p>

          <div className={styles.mainChart}>
            <Sparkline
              data={subject.series30d}
              width={640}
              height={140}
              stroke="var(--ink)"
              fill="var(--ink)"
            />
            <div className={styles.chartAxis}>
              <span>30 days ago</span>
              <span>Today</span>
            </div>
          </div>

          <div className={styles.miniGrid}>
            <MiniMetric label="Mention Count" value={metrics.mentionCount} data={subject.series30d} />
            <MiniMetric label="Engagement Density" value={metrics.engagementDensity} decimals={2} data={subject.series30d.slice().reverse()} />
            <MiniMetric label="Velocity" value={metrics.velocity} decimals={2} suffix="×" data={subject.series30d.slice(-14)} />
            <MiniMetric label="7-Day Change" value={subject.sevenDayDelta * 100} decimals={1} suffix="%" data={subject.series30d.slice(0, 14)} />
          </div>
        </div>

        {/* Right — tombstones */}
        <aside className={styles.rightCol}>
          <TombstoneTable
            title="Metrics"
            rows={[
              { label: 'Engagement-Weighted', value: <IndexNumber value={metrics.engagementWeighted} variant="inline" /> },
              { label: 'Mention Count', value: <IndexNumber value={metrics.mentionCount} variant="inline" /> },
              { label: 'Engagement Density', value: <IndexNumber value={metrics.engagementDensity} decimals={2} variant="inline" /> },
              { label: 'Velocity', value: <IndexNumber value={metrics.velocity} decimals={2} variant="inline" suffix="×" /> },
              { label: '7-Day Change', value: formatPercent(subject.sevenDayDelta) },
            ]}
          />

          <TombstoneTable
            title="Historical"
            rows={[
              { label: 'Peak', value: <IndexNumber value={subject.peak.value} variant="inline" /> },
              { label: 'Peak Date', value: formatDate(subject.peak.date) },
              { label: 'Trough', value: <IndexNumber value={subject.trough.value} variant="inline" /> },
              { label: 'Trough Date', value: formatDate(subject.trough.date) },
            ]}
          />

          <TombstoneTable
            title="Markets"
            rows={
              subjectMarkets.length
                ? subjectMarkets.map((m) => ({
                    label: m.metric,
                    value: (
                      <Link to={`/markets/${m.id}`} className={styles.marketRefLink}>
                        {m.title.split(',')[0]}
                      </Link>
                    ),
                  }))
                : [{ label: '—', value: 'No open markets' }]
            }
          />

          <TombstoneTable
            title="Correlated Subjects"
            rows={
              correlated.length
                ? correlated.map((c) => ({
                    label: c.name.split(' ')[0],
                    value: (
                      <Link to={`/subjects/${c.slug}`} className={styles.marketRefLink}>
                        View →
                      </Link>
                    ),
                  }))
                : [{ label: '—', value: 'No strong correlations' }]
            }
          />
        </aside>
      </section>

      <HairlineRule margin="lg" />

      <section className={styles.marketsSection}>
        <header className={styles.sectionHeader}>
          <SmallCapsLabel size="lg">Open Markets on {subject.name}</SmallCapsLabel>
        </header>

        {subjectMarkets.length ? (
          <div className={styles.marketsRow}>
            {subjectMarkets.map((m) => {
              const leading = m.leadingSide === 'yes' ? m.priceYes : m.priceNo;
              const accent = m.leadingSide === 'yes' ? 'var(--green)' : 'var(--red)';
              return (
                <Link to={`/markets/${m.id}`} key={m.id} className={styles.marketCard}>
                  <SmallCapsLabel size="xs" className={styles.mcLabel}>{m.metric}</SmallCapsLabel>
                  <SubjectName variant="small" as="h3" className={styles.mcTitle}>{m.title}</SubjectName>
                  <IndexNumber
                    value={leading * 100}
                    decimals={0}
                    suffix="%"
                    variant="stat"
                    className={styles.mcPrice}
                    style={{ color: accent }}
                  />
                  <p className={styles.mcSide}>{m.leadingSide === 'yes' ? 'Yes leading' : 'No leading'}</p>
                  <span className={styles.mcLink}>Trade ↗</span>
                </Link>
              );
            })}
          </div>
        ) : (
          <p className={styles.emptyMarkets}>
            No markets on this subject yet. Markets are added when questions become measurable.
          </p>
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
            <Link to="/about">Method</Link>
            <span className={styles.footerDiv}>·</span>
            <Link to="/legacy">Archive</Link>
          </span>
        </div>
      </footer>
    </div>
  );
}

function initials(name) {
  return name
    .split(/\s+/)
    .map((part) => part.charAt(0))
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

function MiniMetric({ label, value, data, decimals, suffix }) {
  return (
    <div className={styles.mini}>
      <SmallCapsLabel size="xs" className={styles.miniLabel}>{label}</SmallCapsLabel>
      <IndexNumber value={value} variant="stat" decimals={decimals} suffix={suffix} className={styles.miniValue} />
      <div className={styles.miniChart}>
        <Sparkline data={data || []} width={200} height={32} stroke="var(--ink)" />
      </div>
    </div>
  );
}
