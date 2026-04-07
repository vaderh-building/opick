import { useState, useEffect } from 'react';
import styles from './InviteEarnModal.module.css';

const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:3001') + '/api';

export default function InviteEarnModal({ isOpen, onClose, account }) {
  const [stats, setStats] = useState({ totalReferred: 0, activated: 0, earned: 0, pending: 0 });
  const [copied, setCopied] = useState(false);

  const link = account ? `https://opick.io/?ref=${account}` : '';
  const shareText = `Just put my money where my mouth is on @opickmarket. Try it: ${link}`;

  useEffect(() => {
    if (!isOpen || !account) return;
    fetch(`${API_URL}/referral-stats?address=${account}`)
      .then(r => r.json())
      .then(setStats)
      .catch(() => {});
  }, [isOpen, account]);

  const handleCopy = () => {
    navigator.clipboard.writeText(link).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isOpen) return null;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <button className={styles.closeBtn} onClick={onClose}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        <h2 className={styles.title}>Invite friends, earn $2 each</h2>
        <p className={styles.sub}>When your friend makes their first trade, you both get $2 USDC.</p>

        <div className={styles.linkRow}>
          <input className={styles.linkInput} readOnly value={link} />
          <button className={styles.copyBtn} onClick={handleCopy}>
            {copied ? 'Copied!' : 'Copy Link'}
          </button>
        </div>

        <div className={styles.shareRow}>
          <a
            className={styles.shareBtn}
            href={`https://x.com/intent/tweet?text=${encodeURIComponent(shareText)}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            Share on X
          </a>
          <a
            className={styles.shareBtn}
            href={`https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent('Check out OPick, an opinion market. Pick a side, profit when others agree.')}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            Telegram
          </a>
        </div>

        <div className={styles.stats}>
          <div className={styles.stat}>
            <span className={styles.statNum}>{stats.totalReferred}</span>
            <span className={styles.statLabel}>Invited</span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statNum}>{stats.activated}</span>
            <span className={styles.statLabel}>Activated</span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statNum}>{'$'}{stats.earned}.00</span>
            <span className={styles.statLabel}>Earned</span>
          </div>
        </div>
      </div>
    </div>
  );
}
