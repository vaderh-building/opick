import { useEffect, useRef, useState } from 'react';
import styles from './TradeGateModal.module.css';

const ENDPOINT = '/api/newsletter';

export default function TradeGateModal({ open, onClose, subjectA, subjectB }) {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState('idle'); // idle | sending | ok | err
  const [error, setError] = useState('');
  const dialogRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement;
    setTimeout(() => inputRef.current?.focus(), 30);
    const handler = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => {
      document.removeEventListener('keydown', handler);
      if (prev && prev.focus) prev.focus();
    };
  }, [open, onClose]);

  if (!open) return null;

  const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const submit = async (e) => {
    e.preventDefault();
    if (!validEmail || status === 'sending') return;
    setStatus('sending');
    setError('');
    try {
      const res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          source: 'market-gate',
          subjects: [subjectA, subjectB].filter(Boolean),
          at: new Date().toISOString(),
        }),
      });
      if (!res.ok && res.status !== 201) throw new Error('Signup failed');
      setStatus('ok');
    } catch (err) {
      setStatus('err');
      setError(err.message || 'Could not save signup. Try again.');
    }
  };

  return (
    <div
      className={styles.overlay}
      role="dialog"
      aria-modal="true"
      aria-labelledby="trade-gate-title"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div ref={dialogRef} className={styles.dialog}>
        <button className={styles.closeBtn} onClick={onClose} aria-label="Close">×</button>
        <p className={styles.kicker}>Notice</p>
        <h2 id="trade-gate-title" className={styles.title}>
          The first position opens when the oracle goes live.
        </h2>
        <p className={styles.body}>
          Markets built on the Attention Index settle from real oracle values. The oracle is still being brought online. Leave an email and we will write once, when the first position opens.
        </p>

        {status === 'ok' ? (
          <p className={styles.ok}>Recorded. We will be in touch.</p>
        ) : (
          <form className={styles.form} onSubmit={submit}>
            <label className={styles.label} htmlFor="trade-gate-email">Email</label>
            <input
              id="trade-gate-email"
              ref={inputRef}
              type="email"
              className={styles.input}
              placeholder="name@domain.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
            <button
              type="submit"
              className={styles.submit}
              disabled={!validEmail || status === 'sending'}
            >
              {status === 'sending' ? 'Saving…' : 'Notify me'}
            </button>
            {status === 'err' && <p className={styles.err}>{error}</p>}
          </form>
        )}
      </div>
    </div>
  );
}
