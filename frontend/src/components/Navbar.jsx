import { useState, useRef, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import styles from './Navbar.module.css';

const NAV_LINKS = [
  { to: '/markets', label: 'Markets' },
  { to: '/create', label: 'Create' },
  { to: '/creators', label: 'Creators' },
  { to: '/developers', label: 'Developers' },
  { to: '/docs', label: 'Docs' },
];

const isDevMode = import.meta.env.VITE_DEV_MODE === 'true' ||
  (typeof window !== 'undefined' && window.location.hostname === 'localhost');

function truncateAddress(address) {
  if (!address) return '';
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function copyToClipboard(text) {
  navigator.clipboard.writeText(text).catch(() => {});
}

export default function Navbar({ account, authenticated, displayName, onConnect, onConnectLocal, onDisconnect, onFundWallet, onInvite }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const dropdownRef = useRef(null);
  const location = useLocation();

  useEffect(() => {
    const handleClick = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleCopy = () => {
    if (!account) return;
    copyToClipboard(account);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

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
            <>
            {onInvite && (
              <button className={styles.inviteBtn} onClick={onInvite}>Invite & Earn</button>
            )}
            <div className={styles.accountWrap} ref={dropdownRef}>
              <button
                className={styles.accountBtn}
                onClick={() => setDropdownOpen(!dropdownOpen)}
              >
                <span className={styles.greenDot} />
                Account
              </button>
              {dropdownOpen && (
                <div className={styles.dropdown}>
                  {account && (
                    <div className={styles.dropdownHeader}>
                      <span className={styles.dropdownAddr}>{truncateAddress(account)}</span>
                      <button className={styles.copyBtn} onClick={handleCopy}>
                        {copied ? 'Copied' : 'Copy'}
                      </button>
                    </div>
                  )}
                  {displayName && !account && (
                    <div className={styles.dropdownHeader}>
                      <span className={styles.dropdownDisplayName}>{displayName}</span>
                    </div>
                  )}
                  <Link to="/account" className={styles.dropdownLink} onClick={() => setDropdownOpen(false)}>
                    Account
                  </Link>
                  {onFundWallet && (
                    <button className={styles.dropdownItem} onClick={() => { onFundWallet(); setDropdownOpen(false); }}>
                      Add USDC
                    </button>
                  )}
                  <div className={styles.dropdownDivider} />
                  <button
                    className={styles.dropdownItemMuted}
                    onClick={() => { onDisconnect(); setDropdownOpen(false); }}
                  >
                    Sign Out
                  </button>
                </div>
              )}
            </div>
            </>
          ) : (
            <div className={styles.connectGroup}>
              <button className={styles.freeBtn} onClick={() => { if (onConnect) onConnect(); }}>
                <span className={styles.freeBtnFull}>Get $2 free</span>
                <span className={styles.freeBtnShort}>$2 free</span>
              </button>
              <button className={styles.connectBtn} onClick={() => { if (onConnect) onConnect(); }}>
                Connect
              </button>
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
          {(authenticated || account) ? (
            <>
              <Link to="/account" className={styles.mobileLink} onClick={() => setMenuOpen(false)}>
                Account
              </Link>
              <button
                className={styles.disconnectBtnMobile}
                onClick={() => { onDisconnect(); setMenuOpen(false); }}
              >
                Sign Out
              </button>
            </>
          ) : (
            <button
              className={styles.connectBtnMobile}
              onClick={() => { onConnect(); setMenuOpen(false); }}
            >
              Connect
            </button>
          )}
        </div>
      )}
    </nav>
  );
}
