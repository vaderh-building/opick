import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAttentionMarket } from '../../hooks/useAttentionMarkets.js';
import { useSubject, useSubjects } from '../../hooks/useSubjects.js';
import SmallCapsLabel from '../../components/v6/SmallCapsLabel.jsx';
import SubjectName from '../../components/v6/SubjectName.jsx';
import IndexNumber from '../../components/v6/IndexNumber.jsx';
import TombstoneTable from '../../components/v6/TombstoneTable.jsx';
import Sparkline from '../../components/v6/Sparkline.jsx';
import HairlineRule from '../../components/v6/HairlineRule.jsx';
import LiveTimestamp from '../../components/v6/LiveTimestamp.jsx';
import PulsingDot from '../../components/v6/PulsingDot.jsx';
import TradeGateModal from '../../components/v6/TradeGateModal.jsx';
import { computeAttentionRating, getAttentionTier, formatRating } from '../../lib/attentionRating.js';
import styles from './MarketV6Editorial.module.css';

const METRIC_PLAIN = {
  'Engagement Density': 'Engagement per post',
  'Velocity': 'Momentum',
  'Mention Count': 'Posts',
  'Engagement-Weighted': 'Weighted score',
};

function plainMetric(label) {
  return METRIC_PLAIN[label] || label;
}

function formatTime(iso) {
  try {
    const d = new Date(iso);
    const pad = (n) => String(n).padStart(2, '0');
    return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;
  } catch {
    return '-';
  }
}

function formatDate(iso) {
  if (!iso) return '-';
  return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

function formatUsd(n) {
  return `$${Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function MarketV6Editorial() {
  const { id } = useParams();
  const { market, loading } = useAttentionMarket(id);
  const { subject: subjectA } = useSubject(market?.subjectA);
  const { subject: subjectB } = useSubject(market?.subjectB);
  const { subjects: allSubjects } = useSubjects();

  const [amount, setAmount] = useState('');
  const [gateOpen, setGateOpen] = useState(false);

  if (loading || !market) {
    return (
      <div className={styles.page}>
        <p className={styles.loading}>{loading ? 'Loading market…' : 'This market is not on file.'}</p>
        {!loading && (
          <Link to="/" className={styles.backLink}>Return to the Index</Link>
        )}
      </div>
    );
  }

  const openGate = () => setGateOpen(true);

  const priceYesPct = Math.round(market.priceYes * 100);
  const priceNoPct = Math.round(market.priceNo * 100);
  const yesLeading = market.leadingSide === 'yes';
  const metricPlain = plainMetric(market.metric).toLowerCase();
  const settlementDateText = formatDate(market.settlesOn);
  const aName = subjectA?.name || 'Subject A';
  const bName = subjectB?.name || 'Subject B';

  const parsedAmount = Number(amount);
  const validAmount = Number.isFinite(parsedAmount) && parsedAmount > 0;
  const yesPayout = validAmount ? parsedAmount / market.priceYes : 0;
  const noPayout = validAmount ? parsedAmount / market.priceNo : 0;

  const yesCents = Math.round(market.priceYes * 100);
  const noCents = Math.round(market.priceNo * 100);

  const exampleAmount = 100;
  const exampleYes = exampleAmount / market.priceYes;
  const exampleNo = exampleAmount / market.priceNo;

  return (
    <div className={styles.page}>
      <div className={styles.crumbs}>
        <Link to="/" className={styles.crumb}>The Index</Link>
        <span className={styles.crumbDiv}>/</span>
        <span className={styles.crumbCurrent}>Market</span>
      </div>

      <section className={styles.masthead}>
        <SmallCapsLabel size="md" className={styles.kicker}>Open Question</SmallCapsLabel>
        <SubjectName variant="large" as="h1" className={styles.title}>{market.title}</SubjectName>
        <p className={styles.question}>
          Will {aName} have higher {metricPlain} than {bName} when this market settles on {settlementDateText}?
        </p>
        <p className={styles.methodologyInline}>
          <Link to="/about">How the Attention Rating is calculated →</Link>
        </p>
      </section>

      <HairlineRule margin="lg" />

      <section className={styles.three}>
        {/* Left subject */}
        <SubjectSummary subject={subjectA} metricLabel={market.metric} align="left" allSubjects={allSubjects} />

        {/* Middle — trade + ledger */}
        <div className={styles.tradeCol}>
          <SmallCapsLabel size="md" className={styles.tradeLabel}>Current Market</SmallCapsLabel>
          <div className={styles.prices}>
            <div className={`${styles.priceBlock} ${yesLeading ? styles.leadingYes : ''}`}>
              <SmallCapsLabel size="xs" className={styles.priceCaption}>Yes</SmallCapsLabel>
              <IndexNumber value={priceYesPct} suffix="%" decimals={0} variant="display" className={styles.priceNumber} />
              <p className={styles.priceSubject}>{aName} leads</p>
            </div>
            <div className={styles.priceDivider} aria-hidden="true" />
            <div className={`${styles.priceBlock} ${!yesLeading ? styles.leadingNo : ''}`}>
              <SmallCapsLabel size="xs" className={styles.priceCaption}>No</SmallCapsLabel>
              <IndexNumber value={priceNoPct} suffix="%" decimals={0} variant="display" className={styles.priceNumberNo} />
              <p className={styles.priceSubject}>{bName} leads</p>
            </div>
          </div>

          <div className={styles.tradeForm}>
            <label htmlFor="amount" className={styles.amountLabel}>
              <SmallCapsLabel size="xs">Amount (USDC)</SmallCapsLabel>
            </label>
            <input
              id="amount"
              type="number"
              min="1"
              inputMode="decimal"
              className={styles.amountInput}
              placeholder="100"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
            {validAmount ? (
              <p className={styles.payoutHelper}>
                <span>{formatUsd(parsedAmount)} at {yesCents}¢ Yes → {formatUsd(yesPayout)} if {aName} leads</span>
                <span>{formatUsd(parsedAmount)} at {noCents}¢ No → {formatUsd(noPayout)} if {bName} leads</span>
              </p>
            ) : null}
            <div className={styles.tradeButtons}>
              <button
                type="button"
                className={styles.buyYes}
                onClick={openGate}
              >
                Buy Yes
              </button>
              <button
                type="button"
                className={styles.buyNo}
                onClick={openGate}
              >
                Buy No
              </button>
            </div>
            <div className={styles.howItWorks}>
              <SmallCapsLabel size="xs" className={styles.howItWorksLabel}>How this market works</SmallCapsLabel>
              <ol className={styles.howItWorksList}>
                <li>
                  Settles {settlementDateText} at 20:00 UTC. The OPick Oracle reads each subject’s {metricPlain} from the X API over the prior 7 days.
                </li>
                <li>
                  If {aName}’s number is higher, Yes shares pay $1 each. If {bName}’s is higher, No shares pay $1 each. A tie refunds all positions.
                </li>
                <li>
                  At {yesCents}¢ Yes, a $100 bet wins {formatUsd(exampleYes)} if {aName} leads. At {noCents}¢ No, a $100 bet wins {formatUsd(exampleNo)} if {bName} leads.
                </li>
              </ol>
            </div>
          </div>

          <div className={styles.ledger}>
            <SmallCapsLabel size="md" className={styles.ledgerLabel}>Recent Trades</SmallCapsLabel>
            <table className={styles.ledgerTable}>
              <thead>
                <tr>
                  <th>Trade</th>
                  <th>Side</th>
                  <th className={styles.numHead}>Amount</th>
                  <th className={styles.numHead}>Price</th>
                  <th className={styles.numHead}>Time UTC</th>
                </tr>
              </thead>
              <tbody>
                {market.recentTrades.map((t, idx) => (
                  <tr key={`${t.hash}-${idx}`}>
                    <td>{t.hash}</td>
                    <td className={t.side === 'YES' ? styles.sideYes : styles.sideNo}>
                      {t.side === 'YES' ? 'Yes' : 'No'}
                    </td>
                    <td className={styles.numCell}><IndexNumber value={t.amount} prefix="$" decimals={2} variant="inline" /></td>
                    <td className={styles.numCell}><IndexNumber value={t.price} decimals={2} variant="inline" /></td>
                    <td className={styles.numCell}>{formatTime(t.ts)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right subject */}
        <SubjectSummary subject={subjectB} metricLabel={market.metric} align="right" allSubjects={allSubjects} />
      </section>

      <HairlineRule margin="lg" />

      <section className={styles.historySection}>
        <header className={styles.sectionHeader}>
          <SmallCapsLabel size="lg">Price History · Yes Side</SmallCapsLabel>
          <span className={styles.sectionMeta}>Last 48 hours · hourly</span>
        </header>
        <div className={styles.historyChart}>
          <Sparkline data={market.history} width={1000} height={160} stroke="var(--ink)" />
          <div className={styles.chartAxis}>
            <span>48h ago</span>
            <span>24h ago</span>
            <span>Now</span>
          </div>
        </div>
      </section>

      <HairlineRule margin="lg" />

      <section className={styles.ledgerFull}>
        <header className={styles.sectionHeader}>
          <SmallCapsLabel size="lg">Full Ledger</SmallCapsLabel>
          <span className={styles.sectionMeta}>Every transaction on this market</span>
        </header>
        <div className={styles.fullLedgerWrap}>
          <table className={styles.fullLedgerTable}>
            <thead>
              <tr>
                <th>Trader</th>
                <th>Side</th>
                <th className={styles.numHead}>USDC</th>
                <th className={styles.numHead}>Price</th>
                <th className={styles.numHead}>Timestamp</th>
              </tr>
            </thead>
            <tbody>
              {market.recentTrades.map((t, idx) => (
                <tr key={`row-${idx}`}>
                  <td>{t.hash}…{String.fromCharCode(97 + (idx % 26))}{String.fromCharCode(97 + ((idx + 7) % 26))}</td>
                  <td className={t.side === 'YES' ? styles.sideYes : styles.sideNo}>
                    {t.side === 'YES' ? 'Yes' : 'No'}
                  </td>
                  <td className={styles.numCell}><IndexNumber value={t.amount} prefix="$" decimals={2} variant="inline" /></td>
                  <td className={styles.numCell}><IndexNumber value={t.price} decimals={2} variant="inline" /></td>
                  <td className={styles.numCell}>{new Date(t.ts).toISOString().replace('T', ' ').replace('Z', ' UTC')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <HairlineRule margin="lg" />

      <section className={styles.methodology}>
        <SmallCapsLabel size="lg" className={styles.methodKicker}>How This Market Settles</SmallCapsLabel>
        <div className={styles.methodBody}>
          <p>
            At settlement, the OPick Oracle reads the final value of <em>{market.metric}</em> for each subject across the measurement window. If the leading subject named on the Yes side holds the higher value at close, Yes pays out at face. Otherwise, No pays out.
          </p>
          <p>
            The oracle derives its numbers from public X data, normalizes on a rolling 24-hour window, and publishes signed outputs on-chain. No human discretion is applied at settlement.
          </p>
          <Link to="/about" className={styles.methodLink}>Read the full methodology →</Link>
        </div>
      </section>

      <footer className={styles.footer}>
        <HairlineRule margin="none" />
        <div className={styles.footerRow}>
          <span className={styles.footerLive}>
            <PulsingDot /> <SmallCapsLabel size="xs">Market Live</SmallCapsLabel>
          </span>
          <LiveTimestamp />
          <span className={styles.footerLinks}>
            <Link to={`/subjects/${market.subjectA}`}>{subjectA?.name}</Link>
            <span className={styles.footerDiv}>·</span>
            <Link to={`/subjects/${market.subjectB}`}>{subjectB?.name}</Link>
          </span>
        </div>
      </footer>

      <TradeGateModal
        open={gateOpen}
        onClose={() => setGateOpen(false)}
        subjectA={market.subjectA}
        subjectB={market.subjectB}
      />
    </div>
  );
}

function SubjectSummary({ subject, metricLabel, align, allSubjects }) {
  if (!subject) return <aside className={styles.subjectCol} />;
  const alignStyle = align === 'right' ? styles.subjectRight : '';
  const pool = Array.isArray(allSubjects) && allSubjects.length ? allSubjects : [subject];
  const rating = computeAttentionRating(subject.metrics?.engagementWeighted, pool);
  const tier = getAttentionTier(rating);

  return (
    <aside className={`${styles.subjectCol} ${alignStyle}`}>
      <SmallCapsLabel size="md" className={styles.subjectLabel}>Subject</SmallCapsLabel>
      <SubjectName variant="medium" as="h2" className={styles.subjectName}>{subject.name}</SubjectName>
      <p className={styles.subjectHandle}>{subject.handle}</p>
      <p className={styles.subjectBio}>{subject.bio}</p>

      <div className={styles.ratingBlock}>
        <SmallCapsLabel size="xs" className={styles.ratingEyebrow}>Attention Rating</SmallCapsLabel>
        <p className={styles.ratingValue}>{formatRating(rating)}</p>
        <p className={styles.ratingTier}>{tier}</p>
      </div>

      <TombstoneTable
        title={`This market · ${plainMetric(metricLabel)}`}
        rows={[
          { label: 'Posts', value: <IndexNumber value={subject.metrics.mentionCount} variant="inline" /> },
          { label: 'Engagement per post', value: <IndexNumber value={subject.metrics.engagementDensity} decimals={2} variant="inline" /> },
          { label: 'Momentum', value: <IndexNumber value={subject.metrics.velocity} decimals={2} suffix="×" variant="inline" /> },
        ]}
      />

      <Link to={`/subjects/${subject.slug}`} className={styles.subjectLink}>View dossier →</Link>
    </aside>
  );
}
