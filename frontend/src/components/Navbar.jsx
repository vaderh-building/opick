import { useState, useRef, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import styles from './Navbar.module.css';

const NAV_LINKS = [
  { to: '/markets', label: 'Markets' },
  { to: '/portfolio', label: 'Picks' },
  { to: '/create', label: 'Create' },
  { to: '/docs', label: 'Docs' },
];

const isDevMode = import.meta.env.VITE_DEV_MODE === 'true' ||
  (typeof window !== 'undefined' && window.location.hostname === 'localhost');

function truncateAddress(address) {
  if (!address) return '';
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export default function Navbar({ account, authenticated, displayName, onConnect, onConnectLocal, onDisconnect }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);
  const location = useLocation();

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClick = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <nav className={styles.navbar}>
      <div className={styles.inner}>
        <Link to="/" className={styles.logo}>
          <span className={styles.logoO}>O</span>
          <span className={styles.logoPick}>Pick</span>
        </Link>

        <div className={styles.right}>
          <div className={styles.navLinks}>
            {NAV_LINKS.map(({ to, label }) => (
              <Link
                key={to}
                to={to}
                className={`${styles.navLink} ${location.pathname === to ? styles.navLinkActive : ''}`}
              >
                {label}
              </Link>
            ))}
          </div>

          {(authenticated || account) ? (
            <div className={styles.accountWrap} ref={dropdownRef}>
              <button
                className={styles.accountBtn}
                onClick={() => setDropdownOpen(!dropdownOpen)}
              >
                <span className={styles.greenDot} />
                {account ? truncateAddress(account) : (displayName || 'Logged in')}
              </button>
              {dropdownOpen && (
                <div className={styles.dropdown}>
                  <Link to="/account" className={styles.dropdownLink} onClick={() => setDropdownOpen(false)}>
                    Your account
                  </Link>
                  <Link to="/account" className={styles.dropdownLink} onClick={() => setDropdownOpen(false)}>
                    Get testnet USDC
                  </Link>
                  <button
                    className={styles.dropdownItem}
                    onClick={() => { onDisconnect(); setDropdownOpen(false); }}
                  >
                    Disconnect
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className={styles.connectGroup}>
              <button className={styles.connectBtn} onClick={() => { if (onConnect) onConnect(); }}>
                Connect
              </button>
              {isDevMode && onConnectLocal && (
                <button className={styles.devBtn} onClick={onConnectLocal}>
                  Dev
                </button>
              )}
            </div>
          )}

          <button
            className={styles.hamburger}
            onClick={() => setMenuOpen((prev) => !prev)}
            aria-label="Toggle menu"
          >
            <span className={`${styles.bar} ${menuOpen ? styles.barOpen1 : ''}`} />
            <span className={`${styles.bar} ${menuOpen ? styles.barOpen2 : ''}`} />
            <span className={`${styles.bar} ${menuOpen ? styles.barOpen3 : ''}`} />
          </button>
        </div>
      </div>

      {menuOpen && (
        <div className={styles.mobileMenu}>
          {NAV_LINKS.map(({ to, label }) => (
            <Link
              key={to}
              to={to}
              className={`${styles.mobileLink} ${location.pathname === to ? styles.mobileLinkActive : ''}`}
              onClick={() => setMenuOpen(false)}
            >
              {label}
            </Link>
          ))}
          {!account && (
            <>
              <button
                className={styles.connectBtnMobile}
                onClick={() => { onConnect(); setMenuOpen(false); }}
              >
                Connect
              </button>
              {isDevMode && onConnectLocal && (
                <button
                  className={styles.devBtnMobile}
                  onClick={() => { onConnectLocal(); setMenuOpen(false); }}
                >
                  Use Test Account
                </button>
              )}
            </>
          )}
        </div>
      )}
    </nav>
  );
}
