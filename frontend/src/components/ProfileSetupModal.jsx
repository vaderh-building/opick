import { useState } from 'react';
import { minidenticon } from 'minidenticons';
import { useWallet } from '../hooks/useWallet.js';
import { apiPost } from '../lib/api.js';
import styles from './ProfileSetupModal.module.css';

const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/;

export default function ProfileSetupModal({ isOpen, onClose, onComplete }) {
  const { account } = useWallet();
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [usernameError, setUsernameError] = useState('');

  if (!isOpen) return null;

  const identicon = account
    ? `data:image/svg+xml;utf8,${encodeURIComponent(minidenticon(account.toLowerCase()))}`
    : null;

  const handleUsernameChange = (e) => {
    const val = e.target.value.toLowerCase().slice(0, 20);
    setUsername(val);
    setUsernameError('');
    if (val && !USERNAME_RE.test(val)) {
      setUsernameError('Letters, numbers, underscore. 3-20 characters.');
    }
  };

  const handleSubmit = async () => {
    setError('');
    setUsernameError('');

    if (!username || !USERNAME_RE.test(username)) {
      setUsernameError('Letters, numbers, underscore. 3-20 characters.');
      return;
    }

    setSubmitting(true);
    try {
      const profile = await apiPost('/profiles', {
        username,
        display_name: displayName.trim() || null,
        bio: bio.trim() || null,
      });
      onComplete(profile);
    } catch (err) {
      if (err.code === 'USERNAME_TAKEN') {
        setUsernameError('That username is taken. Try another.');
      } else if (err.code === 'ALREADY_EXISTS') {
        setError('You already have a profile.');
        setTimeout(() => onClose(), 1500);
      } else {
        setError(err.message || 'Something went wrong. Try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const canSubmit = username.length >= 3 && USERNAME_RE.test(username) && !submitting;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <button className={styles.closeBtn} onClick={onClose} aria-label="Close">
          &#x2715;
        </button>

        <h2 className={styles.title}>Create your profile</h2>
        <p className={styles.subtitle}>Set up your identity to comment on markets.</p>

        {identicon && (
          <div className={styles.identiconWrap}>
            <img src={identicon} alt="" className={styles.identicon} />
          </div>
        )}

        <div className={styles.form}>
          <div className={styles.fieldGroup}>
            <div className={styles.labelRow}>
              <label className={styles.label}>Username</label>
              <span className={styles.counter}>{username.length}/20</span>
            </div>
            <input
              type="text"
              className={usernameError ? styles.inputError : styles.input}
              placeholder="yourname"
              value={username}
              onChange={handleUsernameChange}
              maxLength={20}
              autoFocus
            />
            {usernameError && <p className={styles.fieldError}>{usernameError}</p>}
          </div>

          <div className={styles.fieldGroup}>
            <div className={styles.labelRow}>
              <label className={styles.label}>Display name <span className={styles.optional}>optional</span></label>
              <span className={styles.counter}>{displayName.length}/40</span>
            </div>
            <input
              type="text"
              className={styles.input}
              placeholder="Your name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value.slice(0, 40))}
              maxLength={40}
            />
          </div>

          <div className={styles.fieldGroup}>
            <div className={styles.labelRow}>
              <label className={styles.label}>Bio <span className={styles.optional}>optional</span></label>
              <span className={styles.counter}>{bio.length}/160</span>
            </div>
            <textarea
              className={styles.textarea}
              placeholder="Something about you"
              value={bio}
              onChange={(e) => setBio(e.target.value.slice(0, 160))}
              maxLength={160}
              rows={3}
            />
          </div>
        </div>

        {error && <p className={styles.error}>{error}</p>}

        <div className={styles.buttons}>
          <button className={styles.createBtn} onClick={handleSubmit} disabled={!canSubmit}>
            {submitting ? 'Creating...' : 'Create profile'}
          </button>
          <button className={styles.cancelBtn} onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
