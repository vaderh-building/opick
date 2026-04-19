import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { parseUnits } from 'ethers';
import { useSponsoredTx } from '../hooks/useSponsoredTx.js';
import { V6_FACTORY_ADDRESS } from '../config.js';
import OPickV6FactoryAbi from '../abi/OPickV6Factory.json';
import styles from './CreateMarketV6.module.css';

const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:3001') + '/api';
const CATEGORIES = ['Sports', 'Music', 'Tech', 'Culture', 'Finance', 'Lifestyle'];
const CAP_OPTIONS = [100, 500, 2000];

export default function CreateMarketV6({ account, onConnect, authenticated }) {
  const navigate = useNavigate();
  const { sponsoredCall } = useSponsoredTx();

  const [topic, setTopic] = useState('');
  const [sideA, setSideA] = useState('');
  const [sideB, setSideB] = useState('');
  const [category, setCategory] = useState('');
  const [capOption, setCapOption] = useState(500);
  const [customCap, setCustomCap] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const volumeCap = capOption === 'custom' ? Number(customCap) : capOption;
  const canSubmit = topic.trim() && sideA.trim() && sideB.trim() && category && volumeCap > 0 && !creating;

  const handleCreate = async () => {
    setError('');
    setSuccess('');

    if (!topic.trim() || !sideA.trim() || !sideB.trim() || !category) {
      setError('Please fill in all fields.');
      return;
    }
    if (!volumeCap || volumeCap < 10) {
      setError('Volume cap must be at least $10.');
      return;
    }
    if (!V6_FACTORY_ADDRESS) {
      setError('V6 factory not deployed yet.');
      return;
    }

    setCreating(true);
    try {
      const capUSDC = parseUnits(String(volumeCap), 6);
      const hash = await sponsoredCall(
        V6_FACTORY_ADDRESS, OPickV6FactoryAbi, 'createMarket',
        [topic.trim(), sideA.trim(), sideB.trim(), category, capUSDC]
      );

      setCreating(false);
      setSuccess('Market created!');

      // Try to find the new market address
      try {
        await fetch(`${API_URL}/v6/markets`, { method: 'GET' });
      } catch {}

      setTimeout(() => navigate('/'), 2000);
    } catch (err) {
      setCreating(false);
      const msg = err?.reason || err?.message || 'Transaction failed. Please try again.';
      setError(msg.length > 120 ? msg.slice(0, 120) + '...' : msg);
    }
  };

  if (!authenticated) {
    return (
      <div className={styles.page}>
        <div className={styles.authGate}>
          <p className={styles.authText}>Sign in to create a market</p>
          <button className={styles.authBtn} onClick={onConnect}>Sign In</button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Create a V6 Market</h1>
      <p className={styles.subtitle}>Locked positions, volume cap resolution.</p>

      <div className={styles.layout}>
        <div className={styles.formSection}>
          <div className={styles.fieldGroup}>
            <label className={styles.fieldLabel}>Topic / question</label>
            <input type="text" className={styles.fieldInput} placeholder="e.g., LeBron or Jordan?"
              value={topic} onChange={(e) => setTopic(e.target.value)} />
          </div>

          <div className={styles.choiceRow}>
            <div className={styles.fieldGroup}>
              <label className={styles.fieldLabel}>Side A</label>
              <input type="text" className={styles.fieldInput} placeholder="e.g., LeBron"
                value={sideA} onChange={(e) => setSideA(e.target.value)} />
            </div>
            <div className={styles.fieldGroup}>
              <label className={styles.fieldLabel}>Side B</label>
              <input type="text" className={styles.fieldInput} placeholder="e.g., Jordan"
                value={sideB} onChange={(e) => setSideB(e.target.value)} />
            </div>
          </div>

          <div className={styles.fieldGroup}>
            <label className={styles.fieldLabel}>Category</label>
            <select className={styles.fieldSelect} value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="">Select a category</option>
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <div className={styles.fieldGroup}>
            <label className={styles.fieldLabel}>Volume cap (USDC)</label>
            <div className={styles.capOptions}>
              {CAP_OPTIONS.map((v) => (
                <button key={v} type="button"
                  className={capOption === v ? styles.capBtnActive : styles.capBtn}
                  onClick={() => { setCapOption(v); setCustomCap(''); }}>
                  ${v}
                </button>
              ))}
              <button type="button"
                className={capOption === 'custom' ? styles.capBtnActive : styles.capBtn}
                onClick={() => setCapOption('custom')}>
                Custom
              </button>
            </div>
            {capOption === 'custom' && (
              <input type="number" className={styles.fieldInput} placeholder="Enter amount"
                value={customCap} onChange={(e) => setCustomCap(e.target.value)} min="10" />
            )}
          </div>

          {/* Info box */}
          <div className={styles.infoBox}>
            <p className={styles.infoTitle}>How V6 markets work</p>
            <p className={styles.infoBody}>
              Bettors lock their position. No selling.
              Majority wins when pool fills.
              Refunds if pool not filled in 30 days.
            </p>
            <p className={styles.infoBody}>
              Fee: 3% total (1% platform, 1% creator, 1% amplifier on referred bets).
            </p>
          </div>

          {error && <div className={styles.errorMsg}>{error}</div>}
          {success && <div className={styles.successMsg}>{success}</div>}

          <button type="button" className={styles.createBtn} onClick={handleCreate} disabled={!canSubmit}>
            {creating ? 'Creating...' : 'Create market'}
          </button>
        </div>
      </div>
    </div>
  );
}
