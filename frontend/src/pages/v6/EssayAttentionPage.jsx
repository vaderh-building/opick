import { Link } from 'react-router-dom';
import SmallCapsLabel from '../../components/v6/SmallCapsLabel.jsx';
import HairlineRule from '../../components/v6/HairlineRule.jsx';
import LiveTimestamp from '../../components/v6/LiveTimestamp.jsx';
import PulsingDot from '../../components/v6/PulsingDot.jsx';
import PumpFunChart from '../../components/v6/PumpFunChart.jsx';
import styles from './EssayAttentionPage.module.css';

const failedCases = [
  {
    project: 'Pump.fun',
    mechanism: 'Bonding curve memecoin issuance on Solana',
    peak: '~$90M fees in first year. 24,000 monthly graduations Jan 2025',
    current: '<1% graduation rate. ~6,600 monthly graduations Mar 2025',
    why: 'A casino with attention-shaped tickets. No two-sided market',
  },
  {
    project: 'Friend.tech',
    mechanism: 'Bonding curve on creator "keys" tied to X accounts',
    peak: '$52M TVL Oct 2023. $180M annualized fees',
    current: '$4.5M TVL. Fees down 99.9%. Smart contracts burned Sep 2024',
    why: 'Whales dump, fans had no reason to hold. A ponzi tree',
  },
  {
    project: 'Kaito Yaps',
    mechanism: 'ML mindshare scoring + $YAPS rewards',
    peak: '$1.38B FDV at peak',
    current: 'Pivoted March 2026 to selling mindshare data to Polymarket as oracle input',
    why: "A measurement system, not a market. Spam crisis from Goodhart's law",
  },
  {
    project: 'BitClout / DeSo',
    mechanism: '"Creator coins" via bonding curve on non-consenting Twitter handles',
    peak: 'High initial token launch price',
    current: 'Down >99% from peak',
    why: 'No IP licensing. Right of publicity exposure',
  },
];

export default function EssayAttentionPage() {
  return (
    <div className={styles.page}>
      <div className={styles.crumbs}>
        <span className={styles.crumb}>Essays</span>
        <span className={styles.crumbDiv}>/</span>
        <span className={styles.crumbCurrent}>Attention as Asset</span>
      </div>

      <section className={styles.masthead}>
        <SmallCapsLabel size="md" className={styles.kicker}>Editorial</SmallCapsLabel>
        <h1 className={styles.title}>
          Attention Is a Market <span className={styles.mark}>Without</span> a Market Maker
        </h1>
        <p className={styles.subtitle}>A research note from the OPick desk</p>
      </section>

      <HairlineRule margin="lg" />

      <article className={styles.article}>
        <section className={styles.section}>
          <SmallCapsLabel size="lg" className={styles.sectionLabel}>Research</SmallCapsLabel>
          <h2 className={styles.h2}>The question.</h2>
          <p>
            For the past few months I've been running an Attention Index that tracks engagement on specific public figures across 1.2 million posts from 84,000 authors on X. The point of building it was a narrow research question. If attention is becoming a financial asset class, what does the underlying signal actually look like, and is it tradeable.
          </p>
          <p>
            The answer is that attention is already trading. It's just trading badly.
          </p>
        </section>

        <HairlineRule margin="md" />

        <section className={styles.section}>
          <SmallCapsLabel size="lg" className={styles.sectionLabel}>The Observation</SmallCapsLabel>
          <h2 className={styles.h2}>Three failed attempts.</h2>
          <p>
            Pump.fun took roughly $90M in fees during its first year and graduated 24,000 tokens in January 2025 alone. By February the number was 11,900. By mid-March, fewer than 1% of new tokens crossed the bonding curve at all. That is not a memecoin slowdown. That is a category that ran out of buyers because the asset it sold was first-mover hype priced as attention, and that asset turned out to have a half-life of about three days. Friend.tech told the same story a year earlier. TVL hit $52M in October 2023, sits at $4.5M today, and fees are down 99.9% from peak. Kaito sold a softer version of the same product through Yaps and a $1.38B FDV token, then pivoted in March 2026 to selling its mindshare data to Polymarket as oracle input. That pivot was a quiet admission. Scoring attention is not a business. Pricing it might be.
          </p>

          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Project</th>
                  <th>Mechanism</th>
                  <th>Peak</th>
                  <th>Current State</th>
                  <th>Why It Failed</th>
                </tr>
              </thead>
              <tbody>
                {failedCases.map((row) => (
                  <tr key={row.project}>
                    <td>{row.project}</td>
                    <td>{row.mechanism}</td>
                    <td>{row.peak}</td>
                    <td>{row.current}</td>
                    <td>{row.why}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className={styles.tableCaption}>Table — Four attempts to monetize attention</p>

          <p style={{ marginTop: 28 }}>
            These were not oracle failures. They were market structure failures. None of them gave anyone a way to actually go long or short the thing they were measuring. They gave you a token, a key, or a point balance, and asked you to ride it down.
          </p>

          <PumpFunChart />
        </section>

        <HairlineRule margin="md" />

        <section className={styles.section}>
          <SmallCapsLabel size="lg" className={styles.sectionLabel}>The Primitive</SmallCapsLabel>
          <h2 className={styles.h2}>Prediction markets, finally deep enough.</h2>
          <p>
            What changed in the last six months is that prediction markets got deep enough to be the missing primitive. Kalshi cleared $14.81B in April 2026, and Polymarket added $5.8B. Combined weekly volume sits around $6B across roughly 358,000 active markets. A meaningful slice of this volume is structured as proxy bets on specific public figures. Trump nominees, Musk tweet counts, celebrity outcomes. None of these are called attention markets, but they are. They are simply unbundled. The Attention Index I'm building is in effect an attempt to bundle them, taking implied probabilities across multiple markets about the same person and producing a single index that tracks how loud their week was.
          </p>
        </section>

        <HairlineRule margin="md" />

        <section className={styles.section}>
          <SmallCapsLabel size="lg" className={styles.sectionLabel}>The Two Problems</SmallCapsLabel>
          <h2 className={styles.h2}>What no one is solving.</h2>
          <p>
            Building this surfaced two problems that I do not see being addressed by any team currently in the space, and that I think actually decide who builds the protocol that wins this category.
          </p>
          <p>
            The first is consent. You cannot tokenize someone's attention without their permission, at least not in any venue that aspires to a US license. Right of publicity is recognized in over 30 states. Sorare and NBA TopShot survived where BitClout and DeSo died because they licensed the IP. Friend.tech sidestepped the question by tying keys to opt-in X accounts, which worked for one cycle. Any protocol listing an Attention Perp on a Taylor Swift index without a licensing pathway is by design building something a regulated US exchange cannot list. That is not an edge case. That is the entire game.
          </p>
          <p>
            The second is who provides liquidity. Public figures and the people around them are the most informed traders in markets about themselves. A Stanford paper out of Robert Bartlett's group, published in April 2026 and covering 41.6 million Kalshi trades, used Kyle's lambda and Glosten-Harris decomposition to measure significant adverse selection in prediction markets. That is on Kalshi, where most trades are sports outcomes with no embedded informed party. An LP underwriting a perp on Elon Musk attention is taking the other side of Musk's communications team. The toxic flow has agency, schedule, and a press release calendar. This is the same problem Spencer's adverse selection essay walks through, except the asymmetry is sharper.
          </p>
        </section>

        <HairlineRule margin="md" />

        <section className={styles.section}>
          <SmallCapsLabel size="lg" className={styles.sectionLabel}>The Call</SmallCapsLabel>
          <h2 className={styles.h2}>Where the category gets decided.</h2>
          <p>
            Neither of these is solvable with better oracle math. Most teams I have looked at, including Noise, Cookie, Loud, and the long tail of mindshare projects, start with the oracle and treat licensing and LP protection as downstream problems. The team that wins this category will work in reverse. They will start with the right of publicity license for a small set of consenting public figures, structure the LP side around flow segmentation so retail and informed flow can be priced separately, and only then build the index on top.
          </p>
          <p>
            The math is the easy part. The hard parts do not show up on a whiteboard.
          </p>
          <p>
            The contrarian call is this. By 2028, the public figures themselves are the LPs. The category does not look like a derivatives venue. It looks like a two-sided marketplace where the subject licenses their identity, underwrites part of the float, and earns yield on the trading volume around their own name. It is the cleanest answer to the adverse selection problem because it removes the asymmetry, since the informed party is also the LP. It is the cleanest answer to the licensing problem for the same reason.
          </p>
          <p>
            If Multicoin is looking at this category, the team to back is the one starting with the license and the LP. Not the one starting with the oracle.
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
