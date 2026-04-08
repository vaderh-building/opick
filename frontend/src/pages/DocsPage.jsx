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
          When you pick a side, you become an advocate. The more people who join your side after you,
          the more your position is worth. You profit when the world agrees with you.
        </p>
        <p className={styles.body}>
          OPick is not a prediction market. There is no resolution, no expiry, and no one decides who is right.
          The price simply reflects how many people back each side. Think of it like a stock market for opinions.
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
        <h2 className={styles.sectionTitle}>No resolution</h2>
        <p className={styles.body}>
          OPick markets do not resolve to a winner. There is no judge, no oracle,
          no expiry date. Markets stay open forever.
        </p>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Early bird advantage</h2>
        <p className={styles.body}>
          When you buy a side, you get shares at the current price. As more
          people buy that same side after you, your shares become worth more.
          The earlier you buy, the more upside you capture.
        </p>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Profit and exit</h2>
        <p className={styles.body}>
          You can sell your shares anytime at the current market price. Your
          profit is the difference between what you paid and what you sell for,
          minus a 1% spread. There is no waiting for a result.
        </p>
        <p className={styles.disclaimer}>
          This is not a prediction market. Being "right" about the future does
          not earn you money. Getting in early on a popular side does.
        </p>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Pricing</h2>
        <p className={styles.body}>
          OPick uses a bonding curve (constant product market maker) to set prices automatically based on demand.
          The price of each side always sums to $1.00.
        </p>
        <p className={styles.body}>
          There is a 1% spread on sells only. Zero fees on buys, deposits, and withdrawals.
          30% of the spread goes to the market creator.
        </p>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Creating a market</h2>
        <p className={styles.body}>
          Creating a market is free. Pick a topic, name both sides, choose a category,
          and your market goes live instantly.
        </p>
        <p className={styles.body}>
          You earn 30% of all spread revenue from your market, forever.
          The better the topic and the more trading it attracts, the more you earn.
          Create markets on trending topics and promote them to your audience.
        </p>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>For builders</h2>
        <p className={styles.body}>
          OPick is fully onchain and permissionless. Everything you need to build on top of the protocol is public.
        </p>

        <h3 className={styles.subTitle}>What you can build</h3>
        <ul className={styles.list}>
          <li>Trading bots that monitor price movements and trade automatically</li>
          <li>Custom frontends or mobile apps using OPick's smart contracts</li>
          <li>Analytics dashboards tracking volume, price history, and market trends</li>
          <li>Market creation tools that programmatically spin up new markets</li>
        </ul>

        <h3 className={styles.subTitle}>Smart contracts (Base, EVM compatible)</h3>
        <div className={styles.addressBlock}>
          <div className={styles.addressRow}>
            <span className={styles.addressLabel}>Factory</span>
            <span className={styles.addressMono}>0xf2bd8D38a96fcb05D625735DF1826b6f190a0362</span>
          </div>
          <div className={styles.addressRow}>
            <span className={styles.addressLabel}>USDC</span>
            <span className={styles.addressMono}>0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913</span>
          </div>
        </div>

        <h3 className={styles.subTitle}>How it works under the hood</h3>
        <ul className={styles.list}>
          <li>OPickFactory creates new markets and indexes them</li>
          <li>Each OPickMarket is a standalone contract with a CPMM bonding curve</li>
          <li>Call buyA(amount) or buyB(amount) to pick a side</li>
          <li>Call sellA(shares) or sellB(shares) to exit</li>
          <li>All functions accept USDC (6 decimals). Approve the market contract first.</li>
          <li>Read priceA() and priceB() for current prices (always sum to 1.0)</li>
          <li>Read sharesA(address) and sharesB(address) for user positions</li>
        </ul>

        <p className={styles.body}>
          Source code: <a href="https://github.com/vaderh-building/opick" target="_blank" rel="noopener noreferrer" className={styles.link}>github.com/vaderh-building/opick</a>.
          API documentation coming soon.
        </p>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>FAQ</h2>

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

        <h3 className={styles.question}>How do you define who's the best, or who's the GOAT?</h3>
        <p className={styles.body}>
          There is no single right answer. These are opinions, and everyone sees it differently.
          OPick simply lets you put real money behind what you believe. The price reflects where
          the crowd stands right now, and it is always moving.
        </p>
      </section>
    </div>
  );
}
