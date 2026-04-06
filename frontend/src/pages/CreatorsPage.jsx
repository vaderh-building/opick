import { Link } from 'react-router-dom';
import styles from './CreatorsPage.module.css';

export default function CreatorsPage() {
  return (
    <div className={styles.page}>
      <h1 className={styles.pageTitle}>Create markets. Earn forever.</h1>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>How creator earnings work</h2>
        <p className={styles.body}>
          Anyone can create a market for free. Once live, you earn 30% of the 1% spread on every
          sell in your market. Forever.
        </p>
        <p className={styles.body}>
          The more volume your market generates, the more you earn. There is no cap.
        </p>
        <p className={styles.body}>
          Earnings are automatic. No claiming, no waiting. USDC goes straight to your wallet on every trade.
        </p>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Why create a market?</h2>
        <p className={styles.body}>
          You know what your audience argues about. Turn that energy into a market.
        </p>
        <p className={styles.body}>
          When you create a market and pick a side early, you earn from both price movement and creator spread.
          Your position grows in value as your audience joins, and you collect revenue from every trade they make.
        </p>
        <p className={styles.body}>
          Your followers become advocates. They pick a side and promote it to their own networks.
          The more controversial the topic, the more volume, the more you earn.
        </p>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>How to get started</h2>
        <ol className={styles.steps}>
          <li>Sign in to OPick</li>
          <li>Go to <Link to="/create" className={styles.link}>Create</Link> and pick a topic</li>
          <li>Name both sides, choose a category</li>
          <li>Create your market for free</li>
          <li>Share your market link with your audience</li>
          <li>Watch the volume and your earnings grow</li>
        </ol>
      </section>

      <div className={styles.cta}>
        <Link to="/create" className={styles.ctaBtn}>Create your first market</Link>
      </div>
    </div>
  );
}
