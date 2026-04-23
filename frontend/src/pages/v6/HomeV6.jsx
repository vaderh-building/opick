import { Link } from 'react-router-dom';
import { useMemo } from 'react';
import { useSubjects } from '../../hooks/useSubjects.js';
import { useAttentionMarkets } from '../../hooks/useAttentionMarkets.js';
import SmallCapsLabel from '../../components/v6/SmallCapsLabel.jsx';
import SubjectName from '../../components/v6/SubjectName.jsx';
import IndexNumber from '../../components/v6/IndexNumber.jsx';
import TombstoneTable from '../../components/v6/TombstoneTable.jsx';
import Sparkline from '../../components/v6/Sparkline.jsx';
import HairlineRule from '../../components/v6/HairlineRule.jsx';
import PulsingDot from '../../components/v6/PulsingDot.jsx';
import LiveTimestamp from '../../components/v6/LiveTimestamp.jsx';
import styles from './HomeV6.module.css';

function formatPercent(value) {
  const sign = value > 0 ? '+' : value < 0 ? '' : '';
  return `${sign}${(value * 100).toFixed(1)}%`;
}

function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: '2-digit' });
}

export default function HomeV6() {
  const { subjects, loading } = useSubjects();
  const { markets } = useAttentionMarkets();

  const sorted = useMemo(
    () => [...subjects].sort(
      (a, b) => (b.metrics?.engagementWeighted ?? 0) - (a.metrics?.engagementWeighted ?? 0),
    ),
    [subjects],
  );

  const focus = useMemo(() => {
    if (!subjects.length) return null;
    return [...subjects].sort((a, b) => (b.sevenDayDelta ?? 0) - (a.sevenDayDelta ?? 0))[0];
  }, [subjects]);

  const focusMarkets = useMemo(() => {
    if (!focus) return [];
    return markets.filter((m) => m.subjectA === focus.slug || m.subjectB === focus.slug);
  }, [focus, markets]);

  return (
    <div className={styles.page}>
      <section className={styles.kickerBlock}>
        <SmallCapsLabel size="md" className={styles.kicker}>Today’s Focus</SmallCapsLabel>
        <p className={styles.kickerMeta}>
          <span>Week of {formatDate(new Date().toISOString())}</span>
          <span className={styles.kickerDot}> · </span>
          <span>10 subjects tracked</span>
          <span className={styles.kickerDot}> · </span>
          <span>{markets.length} open question{markets.length === 1 ? '' : 's'}</span>
        </p>
      </section>

      <HairlineRule margin="sm" />

      {focus ? (
        <article className={styles.focusCard}>
          <div className={styles.focusCol + ' ' + styles.colLeft}>
            <SmallCapsLabel className={styles.colLabel}>Subject</SmallCapsLabel>
            <SubjectName variant="large" as="h2" className={styles.focusName}>
              {focus.name}
            </SubjectName>
            <p className={styles.focusHandle}>{focus.handle}</p>
            <p className={styles.focusBio}>{focus.bio}</p>
            <p className={styles.trackedSince}>
              <SmallCapsLabel size="xs" className={styles.inlineCaps}>Tracked since</SmallCapsLabel>
              <span className={styles.trackedValue}>{formatDate(focus.trackedSince)}</span>
            </p>
          </div>

          <div className={styles.focusCol + ' ' + styles.colMid}>
            <SmallCapsLabel className={styles.colLabel}>Index</SmallCapsLabel>
            <div className={styles.numberBlock}>
              <IndexNumber
                variant="hero"
                value={focus.metrics.engagementWeighted}
              />
            </div>
            <p className={styles.numberCaption}>
              Engagement-weighted composite · 7-day
            </p>
            <p className={styles.mentionLine}>
              <SmallCapsLabel size="xs" className={styles.inlineCaps}>7-Day Mentions</SmallCapsLabel>
              <IndexNumber value={focus.metrics.mentionCount} variant="inline" className={styles.mentionValue} />
            </p>
            <div className={styles.sparkWrap}>
              <Sparkline
                data={focus.series30d.slice(-14)}
                width={360}
                height={56}
                stroke="var(--ink)"
              />
              <p className={styles.sparkAxis}>
                <span>14d ago</span>
                <span>Today</span>
              </p>
            </div>
            <p className={styles.deltaLine}>
              <SmallCapsLabel size="xs" className={styles.inlineCaps}>7-Day Change</SmallCapsLabel>
              <span
                className={focus.sevenDayDelta >= 0 ? styles.deltaUp : styles.deltaDown}
              >
                {formatPercent(focus.sevenDayDelta)}
              </span>
            </p>
          </div>

          <div className={styles.focusCol + ' ' + styles.colRight}>
            <TombstoneTable
              title="Metadata"
              rows={[
                { label: 'Metric', value: 'Engagement-Weighted' },
                { label: 'Sample Size', value: <IndexNumber value={focus.metrics.mentionCount} variant="inline" /> },
                { label: 'Last Update', value: <LiveTimestamp compact /> },
                { label: 'Active Markets', value: focusMarkets.length || '—' },
                { label: 'Most Active Market', value: focusMarkets[0]?.title || '—' },
              ]}
            />
            <div className={styles.focusActions}>
              <Link to={`/subjects/${focus.slug}`} className={styles.actionLink}>
                View Full Dossier
              </Link>
              {focusMarkets[0] ? (
                <Link to={`/markets/${focusMarkets[0].id}`} className={styles.actionLinkAlt}>
                  Open Position ↗
                </Link>
              ) : null}
            </div>
          </div>
        </article>
      ) : (
        <p className={styles.loading}>{loading ? 'Loading subjects...' : 'No subjects yet.'}</p>
      )}

      <HairlineRule margin="lg" />

      {/* Index table */}
      <section className={styles.indexSection}>
        <header className={styles.sectionHeader}>
          <SmallCapsLabel size="lg">The Index — All Subjects</SmallCapsLabel>
          <span className={styles.sectionMeta}>
            Ranked by engagement-weighted composite
          </span>
        </header>

        <div className={styles.tableWrap} role="region" aria-label="All tracked subjects">
          <table className={styles.indexTable}>
            <thead>
              <tr>
                <th className={styles.thRank}>#</th>
                <th className={styles.thName}>Subject</th>
                <th className={styles.thNum}>Index</th>
                <th className={styles.thNum}>7-Day</th>
                <th className={styles.thNum}>Sample</th>
                <th className={styles.thAction} />
              </tr>
            </thead>
            <tbody>
              {sorted.map((s, idx) => (
                <tr key={s.slug} className={styles.row}>
                  <td className={styles.rank}>{String(idx + 1).padStart(2, '0')}</td>
                  <td className={styles.nameCell}>
                    <Link to={`/subjects/${s.slug}`} className={styles.nameLink}>
                      <SubjectName variant="small">{s.name}</SubjectName>
                      <span className={styles.handle}>{s.handle}</span>
                    </Link>
                  </td>
                  <td className={styles.numCell}>
                    <IndexNumber value={s.metrics.engagementWeighted} variant="inline" />
                  </td>
                  <td className={`${styles.numCell} ${s.sevenDayDelta >= 0 ? styles.deltaUpCell : styles.deltaDownCell}`}>
                    {formatPercent(s.sevenDayDelta)}
                  </td>
                  <td className={styles.numCell}>
                    <IndexNumber value={s.metrics.mentionCount} variant="inline" />
                  </td>
                  <td className={styles.actionCell}>
                    {markets.some((m) => m.subjectA === s.slug || m.subjectB === s.slug) ? (
                      <Link
                        to={`/markets/${markets.find((m) => m.subjectA === s.slug || m.subjectB === s.slug).id}`}
                        className={styles.rowAction}
                      >
                        Open Position
                      </Link>
                    ) : (
                      <span className={styles.rowActionDim}>Awaiting market</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <HairlineRule margin="lg" />

      {/* Open questions */}
      <section className={styles.marketsSection}>
        <header className={styles.sectionHeader}>
          <SmallCapsLabel size="lg">Open Questions</SmallCapsLabel>
          <span className={styles.sectionMeta}>
            Markets settled from the index
          </span>
        </header>

        {markets.length === 0 ? (
          <p className={styles.emptyMarkets}>
            The first questions will open when the index goes live. Subjects are being tracked in anticipation.
          </p>
        ) : (
          <div className={styles.marketGrid}>
            {markets.map((m) => {
              const leading = m.leadingSide === 'yes' ? m.priceYes : m.priceNo;
              const accent = m.leadingSide === 'yes' ? 'var(--green)' : 'var(--red)';
              return (
                <Link to={`/markets/${m.id}`} key={m.id} className={styles.marketCard}>
                  <div className={styles.marketCol + ' ' + styles.mcLeft}>
                    <SmallCapsLabel size="xs" className={styles.mcLabel}>Market</SmallCapsLabel>
                    <SubjectName variant="small" as="h3" className={styles.mcTitle}>
                      {m.title}
                    </SubjectName>
                    <p className={styles.mcQuestion}>{m.question}</p>
                  </div>
                  <div className={styles.marketCol + ' ' + styles.mcMid}>
                    <SmallCapsLabel size="xs" className={styles.mcLabel}>
                      {m.leadingSide === 'yes' ? 'Yes Leading' : 'No Leading'}
                    </SmallCapsLabel>
                    <IndexNumber
                      variant="display"
                      value={leading * 100}
                      decimals={0}
                      suffix="%"
                      className={styles.mcPrice}
                      style={{ color: accent }}
                    />
                    <p className={styles.mcMetric}>{m.metric}</p>
                  </div>
                  <div className={styles.marketCol + ' ' + styles.mcRight}>
                    <TombstoneTable
                      rows={[
                        { label: 'Volume', value: <IndexNumber value={m.volumeUsdc} prefix="$" decimals={0} variant="inline" /> },
                        { label: 'Liquidity', value: <IndexNumber value={m.liquidityUsdc} prefix="$" decimals={0} variant="inline" /> },
                        { label: 'Settles On', value: formatDate(m.settlesOn) },
                      ]}
                    />
                    <span className={styles.mcCta}>Trade ↗</span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      <HairlineRule margin="lg" />

      {/* Editorial about */}
      <section className={styles.aboutSection}>
        <SmallCapsLabel size="lg" className={styles.aboutKicker}>About the Index</SmallCapsLabel>
        <div className={styles.aboutBody}>
          <p>
            The OPick Attention Index measures cultural temperature through observable public signal on X. We do not predict outcomes. We do not endorse subjects. We record.
          </p>
          <p>
            Each subject is scored on four parallel metrics: mention count, engagement-weighted score, engagement density, and velocity. The index shown above is the engagement-weighted composite.
          </p>
          <p>
            Markets built on these metrics let participants take positions on attention itself, not on who is better, smarter, or more deserving, only on who is being discussed, and how intensely.
          </p>
          <Link to="/about" className={styles.aboutLink}>Read the full methodology →</Link>
        </div>
      </section>

      <footer className={styles.footer}>
        <HairlineRule margin="none" />
        <div className={styles.footerRow}>
          <span className={styles.footerLive}>
            <PulsingDot /> <SmallCapsLabel size="xs">OPick Oracle — Live</SmallCapsLabel>
          </span>
          <LiveTimestamp />
          <span className={styles.footerLinks}>
            <a href="https://github.com/vaderh-building/opick" target="_blank" rel="noreferrer">GitHub</a>
            <span className={styles.footerDiv}>·</span>
            <a href="https://x.com/opickmarket" target="_blank" rel="noreferrer">X</a>
            <span className={styles.footerDiv}>·</span>
            <a href="mailto:hello@opick.io">Contact</a>
          </span>
        </div>
      </footer>
    </div>
  );
}
