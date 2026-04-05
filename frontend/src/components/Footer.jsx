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
          <a href="https://github.com/vaderh-building/opick" className={styles.link} target="_blank" rel="noopener noreferrer">GitHub</a>
        </nav>
      </div>
    </footer>
  );
}
