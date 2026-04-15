import { useState, useRef } from 'react';
import { minidenticon } from 'minidenticons';
import { apiGet, apiPatch, apiUpload } from '../lib/api.js';
import styles from './EditProfileModal.module.css';

const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/;

function canChangeUsername(profile) {
  if (!profile?.username_changed_at) return { allowed: true };
  const changed = new Date(profile.username_changed_at + (profile.username_changed_at.endsWith('Z') ? '' : 'Z'));
  const unlockAt = new Date(changed.getTime() + 30 * 24 * 60 * 60 * 1000);
  if (Date.now() >= unlockAt.getTime()) return { allowed: true };
  return { allowed: false, unlockAt };
}

function formatDate(d) {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function EditProfileModal({ isOpen, onClose, profile, onComplete }) {
  const [username, setUsername] = useState(profile?.username || '');
  const [displayName, setDisplayName] = useState(profile?.display_name || '');
  const [bio, setBio] = useState(profile?.bio || '');
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [usernameError, setUsernameError] = useState('');
  const fileRef = useRef(null);

  if (!isOpen || !profile) return null;

  const usernameLock = canChangeUsername(profile);
  const usernameChanged = username.toLowerCase() !== profile.username;

  const identicon = `data:image/svg+xml;utf8,${encodeURIComponent(minidenticon(profile.wallet_address))}`;
  const currentAvatar = avatarPreview || profile.avatar_url || identicon;

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      setError('Image must be under 2MB.');
      return;
    }
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setError('Only JPEG, PNG, and WebP images are allowed.');
      return;
    }
    setError('');
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  };

  const handleUsernameChange = (e) => {
    const val = e.target.value.toLowerCase().slice(0, 20);
    setUsername(val);
    setUsernameError('');
    if (val && !USERNAME_RE.test(val)) {
      setUsernameError('Letters, numbers, underscore. 3-20 characters.');
    }
  };

  const handleSave = async () => {
    setError('');
    setUsernameError('');
    setSaving(true);

    let updatedProfile = profile;

    try {
      // Upload avatar first if changed
      if (avatarFile) {
        const fd = new FormData();
        fd.append('avatar', avatarFile);
        await apiUpload('/profiles/me/avatar', fd);
      }

      // Build patch
      const patch = {};
      if (usernameChanged && username) {
        if (!USERNAME_RE.test(username)) {
          setUsernameError('Letters, numbers, underscore. 3-20 characters.');
          setSaving(false);
          return;
        }
        patch.username = username;
      }
      if (displayName !== (profile.display_name || '')) {
        patch.display_name = displayName.trim() || null;
      }
      if (bio !== (profile.bio || '')) {
        patch.bio = bio.trim() || null;
      }

      if (Object.keys(patch).length > 0) {
        updatedProfile = await apiPatch('/profiles/me', patch);
      } else if (avatarFile) {
        // Re-fetch to get updated avatar_url
        updatedProfile = await apiGet(`/profiles/${profile.wallet_address}`);
      }

      onComplete(updatedProfile);
    } catch (err) {
      if (err.code === 'USERNAME_TAKEN') {
        setUsernameError('That username is taken. Try another.');
      } else if (err.code === 'COOLDOWN') {
        const days = Math.ceil((err.body?.retry_after_seconds || 0) / 86400);
        setUsernameError(`Username can be changed again in ${days} day${days !== 1 ? 's' : ''}.`);
      } else {
        setError(err.message || 'Something went wrong. Try again.');
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <button className={styles.closeBtn} onClick={onClose} aria-label="Close">&#x2715;</button>

        <h2 className={styles.title}>Edit profile</h2>

        {/* Avatar */}
        <div className={styles.avatarSection}>
          <img
            src={currentAvatar}
            alt=""
            className={styles.avatarImg}
            onClick={() => fileRef.current?.click()}
          />
          <button className={styles.avatarChangeBtn} onClick={() => fileRef.current?.click()}>
            Change avatar
          </button>
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp"
            style={{ display: 'none' }} onChange={handleFileSelect} />
        </div>

        <div className={styles.form}>
          <div className={styles.fieldGroup}>
            <div className={styles.labelRow}>
              <label className={styles.label}>Username</label>
              <span className={styles.counter}>{username.length}/20</span>
            </div>
            {!usernameLock.allowed ? (
              <>
                <input type="text" className={styles.inputDisabled} value={username} readOnly />
                <p className={styles.cooldownNote}>Can change again on {formatDate(usernameLock.unlockAt)}</p>
              </>
            ) : (
              <input
                type="text" className={usernameError ? styles.inputError : styles.input}
                value={username} onChange={handleUsernameChange} maxLength={20}
              />
            )}
            {usernameError && <p className={styles.fieldError}>{usernameError}</p>}
          </div>

          <div className={styles.fieldGroup}>
            <div className={styles.labelRow}>
              <label className={styles.label}>Display name</label>
              <span className={styles.counter}>{displayName.length}/40</span>
            </div>
            <input type="text" className={styles.input} value={displayName}
              onChange={(e) => setDisplayName(e.target.value.slice(0, 40))} maxLength={40}
              placeholder="Your name" />
          </div>

          <div className={styles.fieldGroup}>
            <div className={styles.labelRow}>
              <label className={styles.label}>Bio</label>
              <span className={styles.counter}>{bio.length}/160</span>
            </div>
            <textarea className={styles.textarea} value={bio}
              onChange={(e) => setBio(e.target.value.slice(0, 160))} maxLength={160}
              rows={3} placeholder="Something about you" />
          </div>
        </div>

        {error && <p className={styles.error}>{error}</p>}

        <div className={styles.buttons}>
          <button className={styles.saveBtn} onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save'}
          </button>
          <button className={styles.cancelBtn} onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
