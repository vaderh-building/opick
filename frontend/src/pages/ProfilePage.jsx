import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { minidenticon } from 'minidenticons';
import { useWallet } from '../hooks/useWallet.js';
import { apiGet } from '../lib/api.js';
import EditProfileModal from '../components/EditProfileModal.jsx';
import styles from './ProfilePage.module.css';

function truncAddr(a) { return a ? `${a.slice(0, 6)}...${a.slice(-4)}` : ''; }

function formatJoined(iso) {
  if (!iso) return '';
  const d = new Date(iso + (iso.endsWith('Z') ? '' : 'Z'));
  return 'Joined ' + d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

function AvatarImg({ url, wallet, size = 96 }) {
  const [errored, setErrored] = useState(false);
  const svg = minidenticon(wallet?.toLowerCase() || '');
  const fallback = `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
  return (
    <img
      src={!url || errored ? fallback : url}
      alt="" width={size} height={size}
      className={styles.avatar}
      onError={() => setErrored(true)}
    />
  );
}

export default function ProfilePage() {
  const { username } = useParams();
  const { account } = useWallet();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [copied, setCopied] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  const fetchProfile = async () => {
    setLoading(true);
    setError(null);
    setNotFound(false);
    try {
      const data = await apiGet(`/profiles/by-username/${username.toLowerCase()}`);
      setProfile(data);
    } catch (err) {
      if (err.status === 404) setNotFound(true);
      else setError(err.message || 'Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchProfile(); }, [username]);

  const isOwn = profile && account && profile.wallet_address === account.toLowerCase();

  const handleCopy = () => {
    if (!profile?.wallet_address) return;
    navigator.clipboard.writeText(profile.wallet_address).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  if (loading) {
    return (
      <div className={styles.page}>
        <div className={styles.skeletonAvatar} />
        <div className={styles.skeletonLine1} />
        <div className={styles.skeletonLine2} />
        <div className={styles.skeletonLine3} />
      </div>
    );
  }

  if (notFound) {
    return (
      <div className={styles.page}>
        <div className={styles.center}>
          <p className={styles.notFound}>Profile not found</p>
          <Link to="/markets" className={styles.homeLink}>Browse markets</Link>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.page}>
        <div className={styles.center}>
          <p className={styles.errorText}>{error}</p>
          <button className={styles.retryBtn} onClick={fetchProfile}>Retry</button>
        </div>
      </div>
    );
  }

  if (!profile) return null;

  return (
    <div className={styles.page}>
      <AvatarImg url={profile.avatar_url} wallet={profile.wallet_address} size={96} />

      <h1 className={styles.displayName}>
        {profile.display_name || `@${profile.username}`}
      </h1>

      {profile.display_name && (
        <p className={styles.username}>@{profile.username}</p>
      )}

      <div className={styles.walletRow}>
        <span className={styles.walletAddr}>{truncAddr(profile.wallet_address)}</span>
        <button className={styles.copyBtn} onClick={handleCopy}>
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>

      <p className={profile.bio ? styles.bio : styles.bioEmpty}>
        {profile.bio || 'No bio yet'}
      </p>

      <p className={styles.joined}>{formatJoined(profile.created_at)}</p>

      {isOwn && (
        <button className={styles.editBtn} onClick={() => setEditOpen(true)}>
          Edit profile
        </button>
      )}

      <EditProfileModal
        isOpen={editOpen}
        onClose={() => setEditOpen(false)}
        profile={profile}
        onComplete={(updated) => { setProfile(updated); setEditOpen(false); }}
      />
    </div>
  );
}
