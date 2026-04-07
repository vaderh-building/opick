import { Link } from 'react-router-dom';
import styles from './Footer.module.css';

export default function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <Link to="/" className={styles.logo}>
          <span className={styles.logoO}>O</span>
          <span className={styles.logoPick}>Pick</span>
        </Link>
        <nav className={styles.links}>
          <Link to="/docs" className={styles.link}>Docs</Link>
          <span className={styles.dot}>&middot;</span>
          <Link to="/terms" className={styles.link}>Terms</Link>
          <span className={styles.dot}>&middot;</span>
          <Link to="/privacy" className={styles.link}>Privacy</Link>
          <span className={styles.dot}>&middot;</span>
          <Link to="/risk" className={styles.link}>Risk</Link>
          <span className={styles.dot}>&middot;</span>
          <a href="https://x.com/opickmarket" target="_blank" rel="noopener noreferrer" className={styles.xLink} title="Follow on X">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
          </a>
        </nav>
      </div>
    </footer>
  );
}
