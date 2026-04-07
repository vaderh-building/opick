import { useState, useEffect } from 'react';
import styles from './WelcomeBonusToast.module.css';

export default function WelcomeBonusToast({ status, amount }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (status === 'claiming' || status === 'claimed') {
      setVisible(true);
      if (status === 'claimed') {
        const timer = setTimeout(() => setVisible(false), 8000);
        return () => clearTimeout(timer);
      }
    }
  }, [status]);

  if (!visible) return null;

  return (
    <div className={styles.toast}>
      {status === 'claiming' && (
        <p className={styles.text}>Setting up your account...</p>
      )}
      {status === 'claimed' && (
        <>
          <p className={styles.title}>Welcome to OPick!</p>
          <p className={styles.text}>You have ${amount || '2.00'} to start trading.</p>
        </>
      )}
      <button className={styles.close} onClick={() => setVisible(false)}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>
  );
}
