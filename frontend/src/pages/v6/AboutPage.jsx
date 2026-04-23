import { Link } from 'react-router-dom';
import SmallCapsLabel from '../../components/v6/SmallCapsLabel.jsx';
import HairlineRule from '../../components/v6/HairlineRule.jsx';
import LiveTimestamp from '../../components/v6/LiveTimestamp.jsx';
import PulsingDot from '../../components/v6/PulsingDot.jsx';
import styles from './AboutPage.module.css';

export default function AboutPage() {
  return (
    <div className={styles.page}>
      <div className={styles.crumbs}>
        <Link to="/" className={styles.crumb}>The Index</Link>
        <span className={styles.crumbDiv}>/</span>
        <span className={styles.crumbCurrent}>Method</span>
      </div>

      <section className={styles.masthead}>
        <SmallCapsLabel size="md" className={styles.kicker}>Editorial</SmallCapsLabel>
        <h1 className={styles.title}>
          <span className={styles.mark}>OPick</span> Attention Index
        </h1>
        <p className={styles.subtitle}>A measurement instrument, not a forecast.</p>
      </section>

      <HairlineRule margin="lg" />

      <article className={styles.article}>
        <section className={styles.section}>
          <SmallCapsLabel size="lg" className={styles.sectionLabel}>The Index</SmallCapsLabel>
          <h2 className={styles.h2}>What it measures, and why.</h2>
          <p>
            The Attention Index is a public record of what is being said on X, organized around specific subjects. It does not claim that any subject is better, smarter, or more deserving than another. It only claims that a subject was, or was not, the subject of widespread public signal during a given window.
          </p>
          <p>
            We chose the word <em>index</em> carefully. Not a score, not a ranking, not a prediction. An index is a lens, a way of sorting a world that is already there. Every subject on the Index is placed by the same method, on the same instruments, against the same cut-off, with no human in the loop at measurement time.
          </p>
        </section>

        <HairlineRule margin="md" />

        <section className={styles.section}>
          <SmallCapsLabel size="lg" className={styles.sectionLabel}>The Method</SmallCapsLabel>
          <h2 className={styles.h2}>Four parallel metrics.</h2>

          <ol className={styles.metricList}>
            <li>
              <span className={styles.metricLabel}>Mention Count</span>
              <p>
                The number of public X posts that reference the subject during the measurement window. Posts are matched by handle, canonical name, and the curated alias list maintained in the public oracle repository.
              </p>
              <p className={styles.formula}>
                M(s, t) = | {'{'} p : p &isin; Posts(t), subject(p) = s {'}'} |
              </p>
            </li>
            <li>
              <span className={styles.metricLabel}>Engagement-Weighted Score</span>
              <p>
                Mentions weighted by likes, reposts, quotes, and replies, with a logarithmic dampening to avoid dominance by any single viral post.
              </p>
              <p className={styles.formula}>
                E(s, t) = &sum;<sub>p</sub> ln(1 + likes(p) + 2·reposts(p) + 3·quotes(p) + 4·replies(p))
              </p>
            </li>
            <li>
              <span className={styles.metricLabel}>Engagement Density</span>
              <p>
                Engagement divided by mention count. A measure of intensity: many people posting lightly, versus few people posting with fervor.
              </p>
              <p className={styles.formula}>
                D(s, t) = E(s, t) / M(s, t)
              </p>
            </li>
            <li>
              <span className={styles.metricLabel}>Velocity</span>
              <p>
                The ratio of the current 24-hour engagement to the trailing 7-day baseline. Values above 1.0 indicate acceleration.
              </p>
              <p className={styles.formula}>
                V(s, t) = E(s, t, 24h) / &#x05CD;E(s, t, 7d)
              </p>
            </li>
          </ol>
        </section>

        <HairlineRule margin="md" />

        <section className={styles.section}>
          <SmallCapsLabel size="lg" className={styles.sectionLabel}>The Markets</SmallCapsLabel>
          <h2 className={styles.h2}>How positions are priced.</h2>
          <p>
            Each market is a binary question about one of the four metrics: will subject A hold a higher reading than subject B at close. Prices are determined by a constant-product AMM against USDC, making liquidity continuous and settlement automatic.
          </p>
          <p>
            Positions do not rely on human resolvers. At settlement time, the oracle reads the final metric value for both subjects and pays the winning side at face. Participants take positions on attention itself, not on judgments about the subjects.
          </p>
        </section>

        <HairlineRule margin="md" />

        <section className={styles.section}>
          <SmallCapsLabel size="lg" className={styles.sectionLabel}>The Oracle</SmallCapsLabel>
          <h2 className={styles.h2}>How settlement happens.</h2>
          <p>
            The oracle is an open-source pipeline that ingests public X data, computes each metric on a rolling 24-hour window, signs the outputs, and publishes them on-chain at pre-declared cadences. Every reading is reproducible from the same public inputs. The pipeline’s full source is in the <code>opick-oracle</code> repository.
          </p>
          <p>
            No editor adjusts numbers. No author overrides settlement. The oracle publishes the same output whether anyone reads it or not.
          </p>
        </section>

        <HairlineRule margin="md" />

        <section className={styles.section}>
          <SmallCapsLabel size="lg" className={styles.sectionLabel}>Who We Are</SmallCapsLabel>
          <h2 className={styles.h2}>A founder’s note.</h2>
          <p>
            OPick was started on the belief that attention is the one commodity markets have not yet measured honestly. We are not a sportsbook, not a casino, not a prediction market in the forecasting sense. We are a ledger of what the world is already doing in public.
          </p>
          <p>
            If you are reading this, the index is in its early issues. Numbers are real, markets are being brought online, and we intend to keep publishing for a long time.
          </p>
          <p className={styles.sign}>
            <span className={styles.signature}>The Editors</span>
            <span className={styles.signDate}>Issue No. 01 · Q2 2026</span>
          </p>
        </section>
      </article>

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
            <Link to="/legacy">Archive</Link>
          </span>
        </div>
      </footer>
    </div>
  );
}
