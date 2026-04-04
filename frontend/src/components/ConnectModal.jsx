import styles from './ConnectModal.module.css';

export default function ConnectModal({ isOpen, onClose, onConnect }) {
  if (!isOpen) return null;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.card} onClick={(e) => e.stopPropagation()}>
        <button className={styles.closeBtn} onClick={onClose} aria-label="Close">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M14 4L4 14M4 4l10 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>

        <h2 className={styles.title}>Welcome to OPick</h2>
        <p className={styles.subtitle}>Connect your wallet to start trading opinions</p>

        <button className={styles.metamaskBtn} onClick={() => onConnect('metamask')}>
          <span className={styles.mmDot} />
          Connect with MetaMask
        </button>

        <div className={styles.divider}>
          <span className={styles.dividerLine} />
          <span className={styles.dividerText}>OR</span>
          <span className={styles.dividerLine} />
        </div>

        <button className={styles.localBtn} onClick={() => onConnect('local')}>
          Use Test Account
        </button>
        <p className={styles.localHint}>Uses Hardhat account #0 for local development</p>
      </div>
    </div>
  );
}
