import { Link, NavLink } from 'react-router-dom';
import { usePrivy } from '@privy-io/react-auth';
import { useWallet } from '../../hooks/useWallet.js';
import { issueLabel } from '../../lib/issue.js';
import styles from './Masthead.module.css';

function truncate(address) {
  if (!address) return '';
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export default function Masthead() {
  const wallet = useWallet();
  const { ready } = usePrivy();
  const { account, connect, disconnect, authenticated } = wallet;

  return (
    <header className={styles.masthead}>
      <div className={styles.row}>
        <Link to="/" className={styles.logo} aria-label="OPick home">
          <span className={styles.indexLabel}>Attention Index</span>
        </Link>

        <div className={styles.centerBlock}>
          <nav className={styles.nav} aria-label="Primary">
            <NavLink end to="/" className={({ isActive }) => `${styles.navLink} ${isActive ? styles.navLinkActive : ''}`}>Index</NavLink>
            <NavLink to="/about" className={({ isActive }) => `${styles.navLink} ${isActive ? styles.navLinkActive : ''}`}>Method</NavLink>
            <NavLink to="/legacy" className={({ isActive }) => `${styles.navLink} ${isActive ? styles.navLinkActive : ''}`}>Archive</NavLink>
          </nav>
        </div>

        <div className={styles.rightBlock}>
          <span className={styles.issue}>{issueLabel()}</span>
          {ready && (authenticated || account) ? (
            <button className={styles.wallet} onClick={disconnect} title="Disconnect wallet">
              <span className={styles.walletDot} />
              <span className={styles.walletAddr}>{truncate(account) || 'Signed in'}</span>
            </button>
          ) : (
            <button className={styles.wallet} onClick={connect}>
              <span className={styles.walletLabel}>Connect</span>
            </button>
          )}
        </div>
      </div>
      <div className={styles.hairline} />
    </header>
  );
}
