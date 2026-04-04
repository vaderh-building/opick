import styles from './DocsPage.module.css';

export default function DocsPage() {
  return (
    <div className={styles.page}>
      <h1 className={styles.title}>How OPick Works</h1>
      <p className={styles.subtitle}>Everything you need to know, nothing you don't.</p>

      {/* ── What is OPick? ── */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>What is OPick?</h2>
        <p className={styles.lead}>
          Create a debate on anything. Pick a side with real money. The price <em>is</em> the consensus.
        </p>
        <p className={styles.body}>
          Most markets try to predict the future — will this stock go up, who wins the election.
          OPick is different. There's no future event to resolve. The market itself is the point.
          The price of each side reflects what people believe <em>right now</em>, and it changes
          as more people weigh in.
        </p>
        <p className={styles.body}>
          Think of it like a live poll, except people put money behind their opinion.
          That makes the signal honest — it's easy to click a button in a Twitter poll,
          but when real dollars are on the line, people think harder about what they actually believe.
        </p>
        <p className={styles.body}>
          If you pick a side early and more people agree with you later, the price goes up
          and you can sell for a profit. If the crowd disagrees, the price drops. No judges,
          no expiry dates — just people and their convictions.
        </p>
      </section>

      <hr className={styles.divider} />

      {/* ── How It Works ── */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>How It Works</h2>
        <div className={styles.steps}>
          <div className={styles.step}>
            <span className={styles.stepNum}>1</span>
            <div>
              <h3 className={styles.stepTitle}>Create a market</h3>
              <p className={styles.stepBody}>
                Pick any debate — "Messi vs Ronaldo," "Is AI overhyped?" — name both sides, and
                your market goes live instantly. Anyone can create one.
              </p>
            </div>
          </div>
          <div className={styles.step}>
            <span className={styles.stepNum}>2</span>
            <div>
              <h3 className={styles.stepTitle}>Pick a side</h3>
              <p className={styles.stepBody}>
                Choose which side you believe in and enter an amount. The more people pick
                a side, the higher its price climbs. You're buying in at today's price.
              </p>
            </div>
          </div>
          <div className={styles.step}>
            <span className={styles.stepNum}>3</span>
            <div>
              <h3 className={styles.stepTitle}>Profit when others agree</h3>
              <p className={styles.stepBody}>
                If more people come around to your side after you, the price rises and your
                position is worth more. Sell anytime to lock in your gain — or hold and ride
                the consensus.
              </p>
            </div>
          </div>
        </div>
      </section>

      <hr className={styles.divider} />

      {/* ── Market Types ── */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Market Types</h2>
        <p className={styles.body}>
          You might have seen prediction markets — "Will Bitcoin hit $100K by December?"
          Those have a clear end date and a definitive answer. When the date arrives, one
          side wins and the other loses. Case closed.
        </p>
        <p className={styles.body}>
          OPick markets are <em>sentiment</em> markets. There's no expiry and no resolution.
          "Who is the football GOAT?" doesn't have a right answer — it has a <em>popular</em> answer,
          and that answer can shift over time. The price is a living measure of what the crowd believes.
        </p>
        <div className={styles.compare}>
          <div className={styles.compareCol}>
            <p className={styles.compareLabel}>Prediction Markets</p>
            <p className={styles.compareBody}>
              Has an end date. Resolves to a fact.
              Price converges to <span className={styles.mono}>0%</span> or <span className={styles.mono}>100%</span> at expiry.
              You're betting on being <em>right</em>.
            </p>
          </div>
          <div className={styles.compareDivider} />
          <div className={styles.compareCol}>
            <p className={styles.compareLabel}>Sentiment Markets</p>
            <p className={styles.compareBody}>
              No end date. No resolution.
              Price floats between <span className={styles.mono}>0%</span> and <span className={styles.mono}>100%</span> forever.
              You're betting on being <em>early</em>.
            </p>
          </div>
        </div>
      </section>

      <hr className={styles.divider} />

      {/* ── Creating a Market ── */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Creating a Market</h2>
        <p className={styles.body}>
          Anyone can create a market. Choose from a template — GOAT debates, head-to-head
          matchups, hot takes — or build something entirely custom. Name your two sides,
          pick a category, and you're live.
        </p>
        <p className={styles.body}>
          There's a one-time <span className={styles.mono}>$5</span> creation fee in USDC.
          In return, you earn <span className={styles.mono}>30%</span> of the spread revenue on every
          single trade in your market, forever. You don't need to manage anything — the
          revenue flows automatically.
        </p>
        <p className={styles.body}>
          A niche market with a small but loyal community might earn you steady passive income.
          A viral debate that captures the internet's attention could earn significantly more.
          The better the question, the more people trade, the more you earn.
        </p>
      </section>

      <hr className={styles.divider} />

      {/* ── Pricing & Fees ── */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Pricing & Fees</h2>
        <p className={styles.body}>
          There are no visible fees on OPick. You won't see a "fee" line item when you trade.
        </p>
        <p className={styles.body}>
          Behind the scenes, there's a small <span className={styles.mono}>0.5%</span> spread
          built into the sell price. When you sell a position, the amount you receive is
          <span className={styles.mono}> 0.5%</span> less than the raw market value. That's it.
          Of that spread, <span className={styles.mono}>30%</span> goes to the market's
          creator and the remaining <span className={styles.mono}>70%</span> stays in the
          liquidity pool, which benefits all remaining holders.
        </p>
        <p className={styles.body}>
          Prices are determined by an automated market maker. When more people pick a side,
          the price goes up. When people sell, it goes down. The price always reflects the
          current balance of opinion.
        </p>
      </section>

      <hr className={styles.divider} />

      {/* ── For Builders ── */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>For Builders</h2>
        <p className={styles.body}>
          OPick's contracts are open and composable. If you're building trading bots,
          AI agents, or analytics tools, you can interact directly with the on-chain
          market maker — create markets, execute trades, and read prices programmatically.
        </p>
        <p className={styles.bodyMuted}>
          Contract documentation and SDK details coming soon.
        </p>
      </section>
    </div>
  );
}
