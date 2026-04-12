import { useState } from 'react';
import { Link } from 'react-router-dom';
import styles from './ConsentModal.module.css';

const CONSENT_KEY = 'opick_consent_v1';

export function hasConsented() {
  try {
    const raw = localStorage.getItem(CONSENT_KEY);
    if (!raw) return false;
    const data = JSON.parse(raw);
    return data && data.version === 'v1';
  } catch {
    return false;
  }
}

function saveConsent() {
  localStorage.setItem(CONSENT_KEY, JSON.stringify({
    consentedAt: new Date().toISOString(),
    version: 'v1',
  }));
}

export default function ConsentModal({ isOpen, onClose, onConsent }) {
  const [checks, setChecks] = useState([false, false, false, false]);

  const toggle = (i) => {
    setChecks((prev) => prev.map((v, j) => (j === i ? !v : v)));
  };

  const allChecked = checks.every(Boolean);

  const handleContinue = () => {
    if (!allChecked) return;
    saveConsent();
    onConsent();
  };

  if (!isOpen) return null;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <button className={styles.closeBtn} onClick={onClose} aria-label="Close">
          &#x2715;
        </button>

        <h2 className={styles.title}>Before you continue</h2>

        <p className={styles.body}>
          OPick is an experimental opinion expression tool. It is not a prediction market, securities
          exchange, derivatives platform, or gambling service. Markets do not resolve to any outcome.
          The price of a position depends entirely on subsequent market activity. There is no expected
          return and you may lose all funds you deposit.
          <br /><br />
          Please confirm the following before continuing:
        </p>

        <div className={styles.checks}>
          <label className={styles.checkLabel}>
            <input type="checkbox" checked={checks[0]} onChange={() => toggle(0)} />
            I am at least 18 years old.
          </label>
          <label className={styles.checkLabel}>
            <input type="checkbox" checked={checks[1]} onChange={() => toggle(1)} />
            I am not located in Nevada, Arizona, New York, Texas, or Washington.
          </label>
          <label className={styles.checkLabel}>
            <input type="checkbox" checked={checks[2]} onChange={() => toggle(2)} />
            I understand OPick is an experimental opinion tool, not a financial product.
          </label>
          <label className={styles.checkLabel}>
            <input type="checkbox" checked={checks[3]} onChange={() => toggle(3)} />
            I understand I may lose all funds I deposit and I am not using OPick for financial gain.
          </label>
        </div>

        <p className={styles.note}>
          By continuing you agree to the{' '}
          <Link to="/terms" className={styles.noteLink} onClick={onClose}>Terms of Service</Link>
          {' '}and{' '}
          <Link to="/privacy" className={styles.noteLink} onClick={onClose}>Privacy Policy</Link>.
        </p>

        <div className={styles.buttons}>
          <button
            className={styles.continueBtn}
            disabled={!allChecked}
            onClick={handleContinue}
          >
            Continue
          </button>
          <button className={styles.cancelBtn} onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
