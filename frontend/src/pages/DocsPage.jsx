import styles from './DocsPage.module.css';

export default function DocsPage() {
  return (
    <div className={styles.page}>
      <h1 className={styles.pageTitle}>Docs</h1>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>What is OPick?</h2>
        <p className={styles.body}>
          OPick is an opinion market protocol on Base. Create a debate on any topic, pick a side with real money,
          and let the price reflect what people believe.
        </p>
        <p className={styles.body}>
          There is no resolution and no expiry. You profit by being early, not by being right. If you pick a
          side before the crowd agrees with you, the price rises and your position is worth more. Sell whenever you want.
        </p>
        <p className={styles.body}>
          OPick is permissionless. Anyone can create a market on any topic.
        </p>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>How it works</h2>
        <ol className={styles.numberedList}>
          <li>Sign in with email, Google, X, or a wallet.</li>
          <li>Add USDC to your wallet using a credit card, Apple Pay, or a transfer from an exchange.</li>
          <li>Browse markets or create your own.</li>
          <li>Pick a side. Your money moves the price.</li>
          <li>Sell anytime. If more people joined your side after you, you profit.</li>
        </ol>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Pricing</h2>
        <p className={styles.body}>
          OPick uses a bonding curve (constant product market maker) to set prices automatically based on demand.
          The price of each side always sums to <span className={styles.mono}>$1.00</span>.
        </p>
        <p className={styles.body}>
          There is a <span className={styles.mono}>1%</span> spread on sells only.
          Zero fees on buys, deposits, and withdrawals.
          Of the spread, <span className={styles.mono}>30%</span> goes to the market creator
          and <span className={styles.mono}>70%</span> goes to the protocol.
        </p>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Creating a market</h2>
        <p className={styles.body}>
          Creating a market costs <span className={styles.mono}>$5</span> USDC, which seeds the initial liquidity.
          Pick a topic, name both sides, choose a category, and your market goes live instantly.
        </p>
        <p className={styles.body}>
          You earn <span className={styles.mono}>30%</span> of all spread revenue from your market, forever.
          The better the topic and the more trading it attracts, the more you earn.
          Create markets on trending topics and promote them to your audience.
        </p>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>For builders</h2>
        <p className={styles.body}>
          OPick's smart contracts are deployed on Base (EVM compatible). OPickFactory creates and indexes markets.
          Each OPickMarket uses a CPMM bonding curve for automated pricing.
        </p>
        <div className={styles.addressBlock}>
          <div className={styles.addressRow}>
            <span className={styles.addressLabel}>Factory</span>
            <span className={styles.mono}>0xf2bd8D38a96fcb05D625735DF1826b6f190a0362</span>
          </div>
          <div className={styles.addressRow}>
            <span className={styles.addressLabel}>USDC</span>
            <span className={styles.mono}>0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913</span>
          </div>
        </div>
        <p className={styles.body}>
          Open source at <a href="https://github.com/vaderh-building/opick" target="_blank" rel="noopener noreferrer" className={styles.link}>github.com/vaderh-building/opick</a>. API documentation coming soon.
        </p>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>FAQ</h2>

        <h3 className={styles.question}>Is this like Polymarket?</h3>
        <p className={styles.body}>
          Polymarket resolves markets. Someone wins, someone loses. OPick is perpetual. You profit when others agree
          with you, not when an event happens.
        </p>

        <h3 className={styles.question}>Can I lose money?</h3>
        <p className={styles.body}>
          Yes. If the price moves against your position, you can lose part or all of your investment.
        </p>

        <h3 className={styles.question}>How do I cash out?</h3>
        <p className={styles.body}>
          Sell your position anytime. USDC goes back to your wallet. From there, withdraw to any external wallet or exchange.
        </p>

        <h3 className={styles.question}>Who resolves markets?</h3>
        <p className={styles.body}>
          Nobody. Markets never resolve. That is the point.
        </p>
      </section>
    </div>
  );
}
