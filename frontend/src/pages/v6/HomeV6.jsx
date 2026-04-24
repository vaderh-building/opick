import { Link } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';
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

const UPDATE_INTERVAL_MS = 12 * 60 * 60 * 1000;

function formatSignedPercent(value) {
  const pct = value * 100;
  const sign = pct > 0 ? '+' : pct < 0 ? '' : '';
  return `${sign}${pct.toFixed(1)}%`;
}

function formatShare(value) {
  return `${(value * 100).toFixed(1)}%`;
}

function formatCommas(n) {
  return Number(n).toLocaleString('en-US');
}

function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: '2-digit' });
}

function nextUpdateDelta(now) {
  const t = now.getTime();
  const slotsSinceEpoch = Math.floor(t / UPDATE_INTERVAL_MS);
  const next = (slotsSinceEpoch + 1) * UPDATE_INTERVAL_MS;
  const diffMs = Math.max(0, next - t);
  const totalMinutes = Math.floor(diffMs / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return { hours, minutes };
}

function useCountdown() {
  const [delta, setDelta] = useState(() => nextUpdateDelta(new Date()));
  useEffect(() => {
    const tick = () => setDelta(nextUpdateDelta(new Date()));
    tick();
    const id = setInterval(tick, 30 * 1000);
    return () => clearInterval(id);
  }, []);
  return delta;
}

export default function HomeV6() {
  const { subjects, loading } = useSubjects();
  const { markets } = useAttentionMarkets();
  const { hours, minutes } = useCountdown();

  const sorted = useMemo(
    () => [...subjects].sort(
      (a, b) => (b.metrics?.mentionCount ?? 0) - (a.metrics?.mentionCount ?? 0),
    ),
    [subjects],
  );

  const focus = sorted[0] || null;

  const totalMentions = useMemo(
    () => subjects.reduce((sum, s) => sum + (s.metrics?.mentionCount ?? 0), 0),
    [subjects],
  );

  const marketCountBySubject = useMemo(() => {
    const counts = {};
    for (const m of markets) {
      counts[m.subjectA] = (counts[m.subjectA] || 0) + 1;
      counts[m.subjectB] = (counts[m.subjectB] || 0) + 1;
    }
    return counts;
  }, [markets]);

  const firstMarketBySubject = useMemo(() => {
    const map = {};
    for (const m of markets) {
      if (!map[m.subjectA]) map[m.subjectA] = m.id;
      if (!map[m.subjectB]) map[m.subjectB] = m.id;
    }
    return map;
  }, [markets]);

  const focusMarkets = useMemo(() => {
    if (!focus) return [];
    return markets.filter((m) => m.subjectA === focus.slug || m.subjectB === focus.slug);
  }, [focus, markets]);

  return (
    <div className={styles.page}>
      {/* Publication nameplate */}
      <section className={styles.nameplate} aria-label="OPick">
        <span className={styles.nameplateWord}>OPick</span>
      </section>

      {/* Today's Focus hero */}
      {focus ? (
        <article className={styles.focusCard}>
          <div className={`${styles.focusCol} ${styles.colLeft}`}>
            <SmallCapsLabel className={styles.colLabel}>Index</SmallCapsLabel>
            <div className={styles.numberBlock}>
              <IndexNumber
                variant="display"
                value={focus.metrics.engagementWeighted}
              />
            </div>
            <p className={styles.numberCaption}>
              Engagement-Weighted Composite · 7-Day
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
              <span className={focus.sevenDayDelta >= 0 ? styles.deltaUp : styles.deltaDown}>
                {formatSignedPercent(focus.sevenDayDelta)}
              </span>
            </p>
          </div>

          <div className={`${styles.focusCol} ${styles.colMid}`}>
            <Link to={`/subjects/${focus.slug}`} className={styles.portraitLink}>
              <div className={`${styles.portraitFrame} ${focus.isPerson ? styles.portraitPerson : styles.portraitLogo}`}>
                {focus.portraitUrl ? (
                  <img
                    src={focus.portraitUrl}
                    alt={focus.name}
                    loading="eager"
                    className={styles.portraitImg}
                  />
                ) : (
                  <div className={styles.portraitEmpty} aria-hidden="true" />
                )}
              </div>
            </Link>
            <SmallCapsLabel className={styles.colLabel}>Subject</SmallCapsLabel>
            <Link to={`/subjects/${focus.slug}`} className={styles.focusNameLink}>
              <SubjectName variant="large" as="h2" className={styles.focusName}>
                {focus.name}
              </SubjectName>
            </Link>
            <p className={styles.focusHandle}>{focus.handle}</p>
            <p className={styles.focusBio}>{focus.bio}</p>
            <p className={styles.trackedSince}>
              <SmallCapsLabel size="xs" className={styles.inlineCaps}>Tracked since</SmallCapsLabel>
              <span className={styles.trackedValue}>{formatDate(focus.trackedSince)}</span>
            </p>
          </div>

          <div className={`${styles.focusCol} ${styles.colRight}`}>
            <TombstoneTable
              title="Metadata"
              rows={[
                { label: 'Metric', value: 'Engagement-Weighted' },
                { label: 'Sample Size', value: <IndexNumber value={focus.metrics.mentionCount} variant="inline" /> },
                { label: 'Last Update', value: <LiveTimestamp compact /> },
                { label: 'Active Markets', value: focusMarkets.length || '–' },
                { label: 'Most Active Market', value: focusMarkets[0]?.title || '–' },
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
        <p className={styles.loading}>{loading ? 'Loading the index…' : 'No subjects yet.'}</p>
      )}

      {/* Hero strip (section header for the Index) */}
      <section className={styles.heroStrip} aria-label="Index overview">
        <div className={styles.heroCol}>
          <SmallCapsLabel size="sm" className={styles.heroLabel}>The Index</SmallCapsLabel>
          <p className={styles.heroHead}>What’s being discussed.</p>
        </div>
        <div className={styles.heroCol}>
          <LiveTimestamp className={styles.heroClock} />
          <SmallCapsLabel size="sm" className={styles.heroMeta}>
            {subjects.length || 10} subjects tracked
          </SmallCapsLabel>
        </div>
        <div className={styles.heroCol}>
          <SmallCapsLabel size="sm" className={styles.heroLabel}>Next update</SmallCapsLabel>
          <p className={styles.heroCountdown}>
            in {hours}h {String(minutes).padStart(2, '0')}m
          </p>
        </div>
      </section>

      {/* Index table */}
      <section className={styles.indexSection} aria-label="The OPick Attention Index">
        {loading && !sorted.length ? null : (
          <>
            <div className={styles.tableWrap} role="region" aria-label="Attention Index subjects">
              <table className={styles.indexTable}>
                <thead>
                  <tr>
                    <th className={`${styles.th} ${styles.thRank}`}>Rank</th>
                    <th className={`${styles.th} ${styles.thName}`}>Subject</th>
                    <th className={`${styles.th} ${styles.thNum}`}>X Mentions</th>
                    <th className={`${styles.th} ${styles.thNum}`}>Share</th>
                    <th className={`${styles.th} ${styles.thNum}`}>7d Change</th>
                    <th className={`${styles.th} ${styles.thNum}`}>Markets</th>
                    <th className={`${styles.th} ${styles.thAction}`} aria-label="Action" />
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((s, idx) => {
                    const mentions = s.metrics?.mentionCount ?? 0;
                    const share = totalMentions > 0 ? mentions / totalMentions : 0;
                    const mCount = marketCountBySubject[s.slug] || 0;
                    const firstMarketId = firstMarketBySubject[s.slug];
                    const deltaClass = s.sevenDayDelta > 0
                      ? styles.deltaUpCell
                      : s.sevenDayDelta < 0
                        ? styles.deltaDownCell
                        : '';
                    return (
                      <tr key={s.slug} className={styles.row}>
                        <td className={styles.rankCell}>{String(idx + 1).padStart(2, '0')}</td>
                        <td className={styles.nameCell}>
                          <Link to={`/subjects/${s.slug}`} className={styles.nameLink}>
                            <SubjectName variant="small">{s.name}</SubjectName>
                          </Link>
                        </td>
                        <td className={styles.numCell}>{formatCommas(mentions)}</td>
                        <td className={styles.numCell}>{formatShare(share)}</td>
                        <td className={`${styles.numCell} ${deltaClass}`}>
                          {formatSignedPercent(s.sevenDayDelta)}
                        </td>
                        <td className={styles.numCell}>{mCount}</td>
                        <td className={styles.actionCell}>
                          {firstMarketId ? (
                            <Link to={`/markets/${firstMarketId}`} className={styles.rowAction}>
                              Trade →
                            </Link>
                          ) : (
                            <span className={styles.rowActionDim}>Awaiting market</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile card stack */}
            <ul className={styles.indexCards} aria-hidden="false">
              {sorted.map((s, idx) => {
                const mentions = s.metrics?.mentionCount ?? 0;
                const share = totalMentions > 0 ? mentions / totalMentions : 0;
                const mCount = marketCountBySubject[s.slug] || 0;
                const firstMarketId = firstMarketBySubject[s.slug];
                const deltaClass = s.sevenDayDelta > 0
                  ? styles.deltaUpCell
                  : s.sevenDayDelta < 0
                    ? styles.deltaDownCell
                    : '';
                return (
                  <li key={s.slug} className={styles.card}>
                    <div className={styles.cardRow}>
                      <span className={styles.cardRank}>{String(idx + 1).padStart(2, '0')}</span>
                      <Link to={`/subjects/${s.slug}`} className={styles.nameLink}>
                        <SubjectName variant="small">{s.name}</SubjectName>
                      </Link>
                    </div>
                    <dl className={styles.cardGrid}>
                      <div className={styles.cardStat}>
                        <dt className={styles.cardStatLabel}>X Mentions</dt>
                        <dd className={styles.cardStatValue}>{formatCommas(mentions)}</dd>
                      </div>
                      <div className={styles.cardStat}>
                        <dt className={styles.cardStatLabel}>Share</dt>
                        <dd className={styles.cardStatValue}>{formatShare(share)}</dd>
                      </div>
                      <div className={styles.cardStat}>
                        <dt className={styles.cardStatLabel}>7d Change</dt>
                        <dd className={`${styles.cardStatValue} ${deltaClass}`}>
                          {formatSignedPercent(s.sevenDayDelta)}
                        </dd>
                      </div>
                      <div className={styles.cardStat}>
                        <dt className={styles.cardStatLabel}>Markets</dt>
                        <dd className={styles.cardStatValue}>{mCount}</dd>
                      </div>
                    </dl>
                    <div className={styles.cardAction}>
                      {firstMarketId ? (
                        <Link to={`/markets/${firstMarketId}`} className={styles.rowAction}>
                          Trade →
                        </Link>
                      ) : (
                        <span className={styles.rowActionDim}>Awaiting market</span>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>

            <p className={styles.roadmapNote}>
              Currently measuring X. Reddit, Wikipedia, and Google Trends are on the roadmap for Q3 2026.
            </p>
          </>
        )}
      </section>

      <HairlineRule margin="lg" />

      {/* Open questions */}
      <section className={styles.marketsSection}>
        <header className={styles.sectionHeader}>
          <SmallCapsLabel size="lg">Open Questions</SmallCapsLabel>
          <span className={styles.sectionSub}>Markets built on the Index.</span>
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
                  <div className={styles.marketHead}>
                    <SmallCapsLabel size="xs" className={styles.mcLabel}>Market</SmallCapsLabel>
                    <SubjectName variant="small" as="h3" className={styles.mcTitle}>
                      {m.title}
                    </SubjectName>
                    <p className={styles.mcQuestion}>{m.question}</p>
                  </div>
                  <div className={styles.marketBody}>
                    <div>
                      <SmallCapsLabel size="xs" className={styles.mcLabel}>
                        {m.leadingSide === 'yes' ? 'Yes Leading' : 'No Leading'}
                      </SmallCapsLabel>
                      <p className={styles.mcPrice} style={{ color: accent }}>
                        {Math.round(leading * 100)}%
                      </p>
                      <p className={styles.mcMetric}>{m.metric}</p>
                    </div>
                    <dl className={styles.mcStats}>
                      <div className={styles.mcStatRow}>
                        <dt>Volume</dt>
                        <dd>${formatCommas(Math.round(m.volumeUsdc))}</dd>
                      </div>
                      <div className={styles.mcStatRow}>
                        <dt>Liquidity</dt>
                        <dd>${formatCommas(Math.round(m.liquidityUsdc))}</dd>
                      </div>
                      <div className={styles.mcStatRow}>
                        <dt>Settles</dt>
                        <dd>{formatDate(m.settlesOn)}</dd>
                      </div>
                    </dl>
                  </div>
                  <span className={styles.mcCta}>Trade →</span>
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
            Each subject is scored on four parallel metrics: mention count, engagement-weighted score, engagement density, and velocity. The index shown above is ranked by mention count.
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
            <PulsingDot /> <SmallCapsLabel size="xs">OPick Oracle · Live</SmallCapsLabel>
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
