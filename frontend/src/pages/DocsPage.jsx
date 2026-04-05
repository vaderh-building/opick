import styles from './DocsPage.module.css';

export default function DocsPage() {
  return (
    <div className={styles.page}>
      <h1 className={styles.pageTitle}>Docs</h1>

      {/* OPick 101 */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>OPick 101</h2>
        <p className={styles.body}>
          OPick is an opinion market where you trade on what people believe, not what will happen.
          Pick a side on any debate, back it with real money, and profit when others agree with you.
          There is no resolution and no expiry. The price is the consensus.
        </p>
      </section>

      {/* How OPick works */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>How OPick works</h2>

        <h3 className={styles.subTitle}>Prices are consensus</h3>
        <p className={styles.body}>
          Every side is priced between <span className={styles.mono}>$0.00</span> and <span className={styles.mono}>$1.00</span>.
          The price reflects how many people have picked that side.
          If "Messi" is trading at <span className={styles.mono}>$0.65</span>, that means 65% of the money in the market is backing Messi.
          Prices move continuously as more people pick sides.
        </p>

        <h3 className={styles.subTitle}>Picking a side</h3>
        <p className={styles.body}>
          When you pick a side, your money enters the market's liquidity pool.
          You receive shares at the current price.
          The more money that follows your side, the higher the price goes, and the more your shares are worth.
          You can sell anytime.
        </p>

        <h3 className={styles.subTitle}>Profit by being early</h3>
        <p className={styles.body}>
          You make money by picking a side before others agree with you.
          Buy at <span className={styles.mono}>$0.40</span>, sell at <span className={styles.mono}>$0.70</span> after
          more people join your side. Unlike prediction markets, there is no resolution event.
          You decide when to sell.
        </p>
      </section>

      {/* Creating a market */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Creating a market</h2>
        <p className={styles.body}>
          Anyone can create a market on any topic. Choose a debate, name both sides, and your market goes live instantly.
        </p>
        <ul className={styles.list}>
          <li>Costs <span className={styles.mono}>$5</span> USDC to create, which seeds the initial liquidity</li>
          <li>You earn 30% of the spread from every trade in your market, forever</li>
          <li>The better the topic, the more trading activity, the more you earn</li>
        </ul>
        <p className={styles.body}>
          Market templates include GOAT debates, Head to Head, Bull or Bear, Hot Takes, Best Of, and Custom.
        </p>
      </section>

      {/* Fees */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Fees</h2>
        <p className={styles.body}>
          OPick has no visible trading fees. Revenue comes from a <span className={styles.mono}>1%</span> spread on sells, built into the price.
        </p>
        <p className={styles.body}>
          When you sell a position:
        </p>
        <ul className={styles.list}>
          <li><span className={styles.mono}>1%</span> spread is taken from the sale amount</li>
          <li><span className={styles.mono}>70%</span> of the spread goes to the OPick protocol</li>
          <li><span className={styles.mono}>30%</span> of the spread goes to the market creator</li>
        </ul>
        <p className={styles.body}>
          There are no fees on buys, deposits, or withdrawals.
        </p>
      </section>

      {/* For builders */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>For builders</h2>
        <p className={styles.body}>
          OPick's smart contracts are open and composable on Base.
          Create markets, execute trades, and read prices programmatically.
          API and SDK documentation coming soon.
        </p>
      </section>

      {/* Why blockchain */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Why blockchain</h2>
        <p className={styles.body}>
          OPick is built on Base, an Ethereum L2 network.
        </p>
        <ul className={styles.list}>
          <li>You control your funds. OPick never holds your money.</li>
          <li>All trades settle through smart contracts. No intermediaries.</li>
          <li>USDC is pegged 1:1 to the US dollar. No crypto volatility.</li>
          <li>Base transactions cost fractions of a penny.</li>
        </ul>
      </section>
    </div>
  );
}
