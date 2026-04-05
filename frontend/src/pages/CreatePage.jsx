import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { parseUnits } from 'ethers';
import { useContracts } from '../hooks/useContracts';
import { FACTORY_ADDRESS } from '../config.js';
import styles from './CreatePage.module.css';

const TEMPLATES = [
  { id: 'goat', icon: '\u{1F3C6}', name: 'GOAT', desc: "Who's the greatest of all time?", prefill: "Who is the GOAT of" },
  { id: 'h2h', icon: '\u{1F94A}', name: 'Head to Head', desc: 'Two rivals, one winner', prefill: '' },
  { id: 'bull-bear', icon: '\u{1F4C8}', name: 'Bull or Bear', desc: 'Is something overhyped or underhyped?', prefill: '' },
  { id: 'hot-take', icon: '\u{1F525}', name: 'Hot Take', desc: 'A spicy opinion for the crowd', prefill: '' },
  { id: 'best-of', icon: '\u{2B50}', name: 'Best of', desc: "What's the best in a category?", prefill: "What is the best" },
  { id: 'custom', icon: '\u{270F}\u{FE0F}', name: 'Custom', desc: 'Create your own format', prefill: '' },
];

const CATEGORIES = ['Sports', 'Music', 'Tech', 'Culture', 'Finance', 'Lifestyle'];

export default function CreatePage({ account, provider, signer, onConnect, authenticated, walletReady }) {
  const navigate = useNavigate();
  const { usdc, factory } = useContracts(signer || provider);

  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [topic, setTopic] = useState('');
  const [choiceA, setChoiceA] = useState('');
  const [choiceB, setChoiceB] = useState('');
  const [category, setCategory] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleTemplateClick = (template) => {
    setSelectedTemplate(template.id);
    if (template.prefill && template.id !== 'custom') {
      setTopic(template.prefill);
    }
  };

  const handleCreate = async () => {
    setError('');
    setSuccess('');

    if (!topic.trim() || !choiceA.trim() || !choiceB.trim() || !category) {
      setError('Please fill in all fields.');
      return;
    }

    if (!account) {
      try {
        if (onConnect) onConnect();
      } catch {
        setError('Please connect your wallet to create a market.');
        return;
      }
    }

    if (!factory || !usdc) {
      setError('Contracts not loaded. Check your connection.');
      return;
    }

    setCreating(true);

    try {
      // Approve 5 USDC for market creation
      const approveTx = await usdc.approve(FACTORY_ADDRESS, parseUnits('5', 6));
      await approveTx.wait();

      // Create the market
      const createTx = await factory.createMarket(
        topic.trim(),
        choiceA.trim(),
        choiceB.trim(),
        category
      );
      const receipt = await createTx.wait();

      // Try to get market address from events
      let marketAddress = null;
      for (const log of receipt.logs) {
        try {
          const parsed = factory.interface.parseLog(log);
          if (parsed && parsed.name === 'MarketCreated') {
            marketAddress = parsed.args.market || parsed.args[0];
            break;
          }
        } catch {
          // Not a factory event, skip
        }
      }

      setSuccess('Market created successfully!');

      setTimeout(() => {
        if (marketAddress) {
          navigate(`/market/${marketAddress}`);
        } else {
          navigate('/');
        }
      }, 1500);
    } catch (err) {
      console.error('Create market failed:', err);
      setError(err.reason || err.message || 'Transaction failed.');
    } finally {
      setCreating(false);
    }
  };

  if (!authenticated) {
    return (
      <div className={styles.page}>
        <div className={styles.authGate}>
          <h2 className={styles.authTitle}>Sign in to create a market</h2>
          <p className={styles.authSub}>Connect your wallet to start a debate and earn from every trade.</p>
          <button className={styles.authBtn} onClick={() => { if (onConnect) onConnect(); }}>
            Sign In
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Create a new market</h1>
      <p className={styles.subtitle}>Start a debate, earn from every trade.</p>

      <div className={styles.layout}>
        {/* Left: Form */}
        <div className={styles.formSection}>
          {/* Templates */}
          <div>
            <p className={styles.templateLabel}>Pick a type</p>
            <div className={styles.templates}>
              {TEMPLATES.map((t) => (
                <div
                  key={t.id}
                  className={
                    selectedTemplate === t.id
                      ? styles.templateCardSelected
                      : styles.templateCard
                  }
                  onClick={() => handleTemplateClick(t)}
                >
                  <span className={styles.templateIcon}>{t.icon}</span>
                  <p className={styles.templateName}>{t.name}</p>
                  <p className={styles.templateDesc}>{t.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Form fields */}
          <div className={styles.formFields}>
            <div className={styles.fieldGroup}>
              <label className={styles.fieldLabel}>Your debate</label>
              <input
                type="text"
                className={styles.fieldInput}
                placeholder="e.g., Who is the football GOAT?"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
              />
            </div>

            <div className={styles.choiceRow}>
              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel}>Choice A</label>
                <input
                  type="text"
                  className={styles.fieldInput}
                  placeholder="e.g., Messi"
                  value={choiceA}
                  onChange={(e) => setChoiceA(e.target.value)}
                />
              </div>
              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel}>Choice B</label>
                <input
                  type="text"
                  className={styles.fieldInput}
                  placeholder="e.g., Ronaldo"
                  value={choiceB}
                  onChange={(e) => setChoiceB(e.target.value)}
                />
              </div>
            </div>

            <div className={styles.fieldGroup}>
              <label className={styles.fieldLabel}>Category</label>
              <select
                className={styles.fieldSelect}
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                <option value="">Select a category</option>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Messages */}
          {error && <div className={styles.errorMsg}>{error}</div>}
          {success && <div className={styles.successMsg}>{success}</div>}

          {/* Create button */}
          <div>
            <button
              className={styles.createBtn}
              onClick={handleCreate}
              disabled={creating}
            >
              {creating && <span className={styles.btnSpinner} />}
              {creating ? 'Creating Market...' : 'Create Market'}
            </button>
            <p className={styles.costNote}>
              Creation costs 5 USDC. Your market goes live instantly.
            </p>
          </div>
        </div>

        {/* Right: What you get */}
        <div className={styles.sidebar}>
          <h3 className={styles.sidebarTitle}>What you get</h3>
          <ul className={styles.perks}>
            <li className={styles.perk}>30% of spread revenue from every trade, forever</li>
            <li className={styles.perk}>Your name as market creator</li>
            <li className={styles.perk}>A market anyone can trade</li>
          </ul>
          <p className={styles.sidebarNote}>Active markets earn spread revenue from every trade.</p>
        </div>
      </div>
    </div>
  );
}
