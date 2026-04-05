import { useState } from 'react';
import styles from './TosModal.module.css';

export default function TosModal({ onAccept }) {
  const [checked, setChecked] = useState(false);

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <h2 className={styles.title}>Welcome to OPick</h2>
        <p className={styles.body}>
          By using OPick, you agree to our{' '}
          <a href="/terms" target="_blank" rel="noopener noreferrer" className={styles.link}>Terms of Service</a>,{' '}
          <a href="/privacy" target="_blank" rel="noopener noreferrer" className={styles.link}>Privacy Policy</a>, and{' '}
          <a href="/risk" target="_blank" rel="noopener noreferrer" className={styles.link}>Risk Disclosure</a>.
          You must be at least 18 years old.
        </p>
        <label className={styles.checkRow}>
          <input
            type="checkbox"
            checked={checked}
            onChange={(e) => setChecked(e.target.checked)}
            className={styles.checkbox}
          />
          <span className={styles.checkLabel}>
            I agree to the Terms of Service, Privacy Policy, and Risk Disclosure
          </span>
        </label>
        <button
          className={styles.btn}
          disabled={!checked}
          onClick={onAccept}
        >
          Continue
        </button>
      </div>
    </div>
  );
}
