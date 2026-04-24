import { Link } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';
import { useSubjects } from '../../hooks/useSubjects.js';
import { useAttentionMarkets } from '../../hooks/useAttentionMarkets.js';
import SmallCapsLabel from '../../components/v6/SmallCapsLabel.jsx';
import SubjectName from '../../components/v6/SubjectName.jsx';
import IndexNumber from '../../components/v6/IndexNumber.jsx';
import Sparkline from '../../components/v6/Sparkline.jsx';
import HairlineRule from '../../components/v6/HairlineRule.jsx';
import PulsingDot from '../../components/v6/PulsingDot.jsx';
import LiveTimestamp from '../../components/v6/LiveTimestamp.jsx';
import { computeAttentionRating, getAttentionTier, formatRating } from '../../lib/attentionRating.js';
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

function formatUpdateLine(now, minutesAgo) {
  const updated = new Date(now.getTime() - minutesAgo * 60 * 1000);
  const pad = (n) => String(n).padStart(2, '0');
  const hhmm = `${pad(updated.getUTCHours())}:${pad(updated.getUTCMinutes())} UTC`;
  return `${hhmm}, ${minutesAgo}m ago`;
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
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30 * 1000);
    return () => clearInterval(id);
  }, []);

  const rated = useMemo(
    () => subjects.map((s) => ({
      ...s,
      rating: computeAttentionRating(s.metrics?.engagementWeighted, subjects),
    })),
    [subjects],
  );

  const sorted = useMemo(
    () => [...rated].sort((a, b) => b.rating - a.rating),
    [rated],
  );

  const focus = sorted[0] || null;
  const focusRank = 1;

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
        <p className={styles.tagline}>
          The index of what the world is paying attention to.
        </p>
      </section>

      {/* Today's Focus hero */}
      {focus ? (
        <article className={styles.focusCard}>
          <div className={`${styles.focusCol} ${styles.colLeft}`}>
            <SmallCapsLabel className={styles.colLabel}>Attention Rating</SmallCapsLabel>
            <p className={styles.colDek}>
              How much of the world’s attention {focus.name.split(' ')[0]} commands every day.
            </p>
            <div className={styles.numberBlock}>
              <span className={styles.ratingBig}>{formatRating(focus.rating)}</span>
            </div>
            <p className={styles.tierLine}>
              <span className={styles.tierLabel}>{getAttentionTier(focus.rating)}</span>
              <span className={styles.tierDivider}>·</span>
              <span className={styles.tierRank}>#{focusRank} of {sorted.length}</span>
            </p>
            <p className={styles.numberCaption}>
              7-day rating, updated hourly
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
              <span className={styles.fieldLabel}>7-day change</span>
              <span className={styles.deltaGroup}>
                <span className={focus.sevenDayDelta >= 0 ? styles.deltaUp : styles.deltaDown}>
                  {formatSignedPercent(focus.sevenDayDelta)}
                </span>
                <span className={styles.deltaAside}>· vs previous week</span>
              </span>
            </p>
            <p className={styles.footnote}>
              Based on {formatCommas(focus.metrics.mentionCount)} posts, weighted by likes, reposts, and replies.
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
            <p className={styles.subjectKicker}>Subject</p>
            <Link to={`/subjects/${focus.slug}`} className={styles.focusNameLink}>
              <SubjectName variant="large" as="h2" className={styles.focusName}>
                {focus.name}
              </SubjectName>
            </Link>
            <p className={styles.focusHandle}>{focus.handle}</p>
            <p className={styles.focusBio}>{focus.bio}</p>
            <p className={styles.trackedSince}>
              <span className={styles.fieldLabel}>Tracked since</span>
              <span className={styles.trackedValue}>{formatDate(focus.trackedSince)}</span>
            </p>
          </div>

          <div className={`${styles.focusCol} ${styles.colRight}`}>
            <SmallCapsLabel className={styles.colLabel}>Open Market</SmallCapsLabel>

            {focusMarkets[0] ? (
              <Link to={`/markets/${focusMarkets[0].id}`} className={styles.metaFocal}>
                <p className={styles.metaFocalName}>
                  {(focusMarkets[0].title.split(',')[0] || focusMarkets[0].title).trim()}
                </p>
                <p className={styles.metaFocalQuestion}>
                  Who gets more engagement per post this week?
                </p>
                <p className={styles.metaFocalMeta}>
                  Live · settles Friday 20:00 UTC
                </p>
              </Link>
            ) : null}

            <dl className={styles.metaList}>
              <div className={styles.metaRow}>
                <dt className={styles.metaLabel}>Scoring</dt>
                <dd className={styles.metaValue}>Weighted by likes, reposts, replies</dd>
              </div>
              <div className={styles.metaRow}>
                <dt className={styles.metaLabel}>Based on</dt>
                <dd className={styles.metaValue}>
                  {formatCommas(focus.metrics.mentionCount)} posts from {formatCommas(Math.round(focus.metrics.mentionCount / 14.83))} authors
                </dd>
              </div>
              <div className={styles.metaRow}>
                <dt className={styles.metaLabel}>Updated</dt>
                <dd className={styles.metaValue}>{formatUpdateLine(now, 8)}</dd>
              </div>
            </dl>

            <div className={styles.focusActions}>
              <Link to={`/subjects/${focus.slug}`} className={styles.actionLink}>
                View full dossier
              </Link>
              {focusMarkets[0] ? (
                <Link to={`/markets/${focusMarkets[0].id}`} className={styles.actionLinkAlt}>
                  Open position →
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
                    <th className={`${styles.th} ${styles.thNum}`}>Rating</th>
                    <th className={`${styles.th} ${styles.thTier}`}>Tier</th>
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
                        <td className={`${styles.numCell} ${styles.ratingCell}`}>{formatRating(s.rating)}</td>
                        <td className={styles.tierCell}>{getAttentionTier(s.rating)}</td>
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
                        <dt className={styles.cardStatLabel}>Rating</dt>
                        <dd className={styles.cardStatValue}>{formatRating(s.rating)}</dd>
                      </div>
                      <div className={styles.cardStat}>
                        <dt className={styles.cardStatLabel}>Tier</dt>
                        <dd className={styles.cardStatTier}>{getAttentionTier(s.rating)}</dd>
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

      {/* Methodology explainer */}
      <section className={styles.methodSection}>
        <SmallCapsLabel size="md" className={styles.methodKicker}>Understanding the Rating</SmallCapsLabel>
        <h2 className={styles.methodTitle}>How the Attention Rating Works</h2>
        <div className={styles.methodBody}>
          <p>
            The Attention Rating is a 0–100 score measuring how much attention a subject is receiving right now. It combines how often the subject is mentioned, how strongly people engage with those mentions, and how broadly the conversation is spread.
          </p>
          <p>
            Ratings fall into six tiers. Phenomenon (95+) is reserved for moments that dominate the cultural conversation. Dominating (85–94) means global-scale attention. Trending (70–84) is sustained mainstream visibility. Active (55–69), Present (40–54), and Quiet (below 40) describe steadily narrower spheres of attention.
          </p>
          <p>
            We use a logarithmic scale so the top end is hard to reach. A typical major public figure sits around 70–80 on most days. A score of 90 means something unusual is happening. This keeps the scale meaningful over time.
          </p>
          <Link to="/about" className={styles.methodLink}>Read the full methodology →</Link>
        </div>
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
