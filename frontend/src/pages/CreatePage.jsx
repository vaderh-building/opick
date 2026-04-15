import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { parseUnits, Interface } from 'ethers';
import { useSendTransaction } from '@privy-io/react-auth';
import { useContracts } from '../hooks/useContracts';
import { FACTORY_ADDRESS } from '../config.js';
import OPickFactoryAbi from '../abi/OPickFactory.json';
import styles from './CreatePage.module.css';

const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:3001') + '/api';

const TEMPLATES = [
  { id: 'goat', icon: '\u{1F3C6}', name: 'GOAT', desc: "Who's the greatest of all time?" },
  { id: 'h2h', icon: '\u{1F94A}', name: 'Head to Head', desc: 'Two rivals, one winner' },
  { id: 'bull-bear', icon: '\u{1F4C8}', name: 'Bull or Bear', desc: 'Overhyped or underhyped?' },
  { id: 'hot-take', icon: '\u{1F525}', name: 'Hot Take', desc: 'A spicy opinion for the crowd' },
  { id: 'wyr', icon: '\u{1F914}', name: 'Would You Rather', desc: 'Hypothetical trade, pick your side' },
  { id: 'best-of', icon: '\u{2B50}', name: 'Best of', desc: "What's the best in a category?" },
  { id: 'custom', icon: '\u{270F}\u{FE0F}', name: 'Custom', desc: 'Create your own format' },
  { id: 'worldcup', icon: '\u{26BD}', name: 'World Cup 2026', desc: 'Football debates, no resolution' },
];

const CATEGORIES = ['Sports', 'Music', 'Tech', 'Culture', 'Finance', 'Lifestyle'];

function generateTopic(template, a, b) {
  if (!template || !a) return '';
  switch (template) {
    case 'goat': return `Who is the GOAT? ${a} vs ${b || '...'}`;
    case 'h2h': return `${a} vs ${b || '...'}`;
    case 'bull-bear': return `${a}: Overhyped or Underhyped?`;
    case 'hot-take': return `${a} vs ${b || '...'}`;
    case 'best-of': return `Best ${a}? ${a} vs ${b || '...'}`;
    case 'worldcup': return `${a} vs ${b || '...'}`;
    case 'custom': return `${a} vs ${b || '...'}`;
    default: return `${a} vs ${b || '...'}`;
  }
}

function smartParsePrice(val) {
  const n = Number(val);
  if (!n || isNaN(n)) return 50;
  if (n > 1e10) return (n / 1e18) * 100;
  if (n <= 1) return n * 100;
  return n;
}

export default function CreatePage({ account, provider, signer, onConnect, authenticated, walletReady }) {
  const navigate = useNavigate();
  const { usdc, factory } = useContracts(signer || provider);
  const { sendTransaction } = useSendTransaction();

  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [choiceA, setChoiceA] = useState('');
  const [choiceB, setChoiceB] = useState('');
  const [customTopic, setCustomTopic] = useState('');
  const [category, setCategory] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [wyrFormat, setWyrFormat] = useState('sacrifice'); // 'sacrifice' | 'thisorthat'
  const [wyrInputA, setWyrInputA] = useState('');
  const [wyrInputB, setWyrInputB] = useState('');

  // Smart routing
  const [existingMarket, setExistingMarket] = useState(null);
  const [searching, setSearching] = useState(false);
  const [forceCreate, setForceCreate] = useState(false);
  const searchTimer = useRef(null);

  // Auto-fill for Bull or Bear template
  const effectiveA = choiceA;
  const effectiveB = selectedTemplate === 'bull-bear' ? 'Overhyped'
    : selectedTemplate === 'bull-bear' ? 'Underhyped' // won't reach
    : choiceB;

  const isBullBear = selectedTemplate === 'bull-bear';
  const isHotTake = selectedTemplate === 'hot-take';
  const isCustom = selectedTemplate === 'custom';
  const isWorldCup = selectedTemplate === 'worldcup';
  const isWYR = selectedTemplate === 'wyr';

  // Compute actual sideA/sideB for contract
  const sideA = isBullBear ? 'Overhyped'
    : isWYR && wyrFormat === 'sacrifice' ? 'Yes, worth it'
    : isWYR && wyrFormat === 'thisorthat' ? wyrInputA
    : choiceA;
  const sideB = isBullBear ? 'Underhyped'
    : isWYR && wyrFormat === 'sacrifice' ? 'No, not worth it'
    : isWYR && wyrFormat === 'thisorthat' ? wyrInputB
    : choiceB;

  // Auto-generate topic
  const generatedTopic = useMemo(() => {
    if (isCustom || isWorldCup) return customTopic;
    if (isWYR) {
      if (!wyrInputA) return '';
      if (wyrFormat === 'sacrifice') {
        return wyrInputB ? `Would you give up ${wyrInputA} for ${wyrInputB}?` : '';
      }
      return wyrInputB ? `Would you rather ${wyrInputA} or ${wyrInputB}?` : '';
    }
    return generateTopic(selectedTemplate, choiceA, choiceB);
  }, [selectedTemplate, choiceA, choiceB, customTopic, isCustom, isWorldCup, isWYR, wyrFormat, wyrInputA, wyrInputB]);

  // Labels based on template
  const labelA = isBullBear ? 'Topic' : isHotTake ? 'Your hot take' : 'Choice A';
  const labelB = isHotTake ? 'The other side' : 'Choice B';

  const WC_EXAMPLES = [
    'Brazil vs Argentina, bigger football culture forever',
    'Mbapp\u00e9 vs Messi, who is the real face of football now',
    "USA Men's team, finally serious or still a joke",
    'Did VAR ruin the World Cup',
    'Best World Cup jersey of all time',
  ];

  const WYR_EXAMPLES = [
    { text: 'Give up sex for a year for a guaranteed Knicks championship', format: 'sacrifice', a: 'sex for a year', b: 'a guaranteed Knicks championship' },
    { text: 'Give up coffee forever for Messi to win another World Cup', format: 'sacrifice', a: 'coffee forever', b: 'Messi to win another World Cup' },
    { text: 'Would you rather have unlimited money or unlimited time', format: 'thisorthat', a: 'have unlimited money', b: 'have unlimited time' },
    { text: 'Would you rather be always 10 minutes late or always 20 minutes early', format: 'thisorthat', a: 'be always 10 minutes late', b: 'be always 20 minutes early' },
  ];
  const placeholderA = isBullBear ? 'e.g., AI' : isHotTake ? 'e.g., Pineapple belongs on pizza' : 'e.g., Messi';
  const placeholderB = isHotTake ? 'e.g., It does not' : 'e.g., Ronaldo';
  const showChoiceB = !isBullBear;

  // Debounced search for existing markets
  useEffect(() => {
    setExistingMarket(null);
    setForceCreate(false);

    const a = (isBullBear ? 'Overhyped' : choiceA).trim().toLowerCase();
    const b = (isBullBear ? 'Underhyped' : choiceB).trim().toLowerCase();
    const t = customTopic.trim().toLowerCase();

    if (isWYR) {
      // WYR uses auto-generated sides, search only when both inputs filled
      if (!wyrInputA.trim() || !wyrInputB.trim()) return;
    } else {
      if (!a || !b || a.length < 2 || b.length < 2) return;
    }
    // World Cup and Custom require a topic before searching
    if ((isWorldCup || isCustom) && (!t || t.length < 3)) return;

    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`${API_URL}/markets/search?a=${encodeURIComponent(a)}&b=${encodeURIComponent(b)}`);
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          // For World Cup/Custom, also check topic similarity
          if (isWorldCup || isCustom) {
            const match = data.find(m =>
              m.topic && m.topic.trim().toLowerCase() === t
            );
            if (match) setExistingMarket(match);
          } else {
            setExistingMarket(data[0]);
          }
        }
      } catch {}
      setSearching(false);
    }, 500);

    return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
  }, [choiceA, choiceB, customTopic, isBullBear, isWorldCup, isCustom, isWYR, wyrInputA, wyrInputB]);

  const handleTemplateClick = (t) => {
    setSelectedTemplate(t.id);
    setChoiceA('');
    setChoiceB('');
    setCustomTopic('');
    setWyrInputA('');
    setWyrInputB('');
    setWyrFormat('sacrifice');
    setExistingMarket(null);
    setForceCreate(false);
    if ((t.id === 'goat' || t.id === 'worldcup') && !category) setCategory('Sports');
    if (t.id === 'wyr' && !category) setCategory('Lifestyle');
  };

  const handleCreate = async () => {
    setError('');
    setSuccess('');

    const topic = generatedTopic.trim();
    const a = sideA.trim();
    const b = sideB.trim();

    if (!topic || !a || !b || !category) {
      setError('Please fill in all fields.');
      return;
    }

    if (!factory || !usdc) {
      setError('Contracts not loaded. Check your connection.');
      return;
    }

    setCreating(true);
    setError('');
    setSuccess('');
    try {
      // Encode and send sponsored tx
      const iface = new Interface(OPickFactoryAbi);
      const data = iface.encodeFunctionData('createMarket', [topic, a, b, category]);
      const { hash } = await sendTransaction(
        { to: FACTORY_ADDRESS, data },
        { sponsor: true }
      );

      // Get market address from factory (latest market)
      let marketAddress = null;
      try {
        if (factory) {
          const total = await factory.totalMarkets();
          const markets = await factory.getMarkets(Number(total) - 1, 1);
          if (markets.length > 0) marketAddress = markets[0];
        }
      } catch {}

      setCreating(false);
      setSuccess('Market created!');

      // Refresh backend cache (wait up to 10s)
      const controller = new AbortController();
      const refreshTimeout = setTimeout(() => controller.abort(), 10000);
      try {
        await fetch(`${API_URL}/markets/refresh`, { method: 'POST', signal: controller.signal });
      } catch {}
      clearTimeout(refreshTimeout);

      // Poll until the new market appears in the backend (up to 5 polls, 2s apart)
      if (marketAddress) {
        let found = false;
        for (let i = 0; i < 5; i++) {
          try {
            const res = await fetch(`${API_URL}/markets/${marketAddress}`);
            if (res.ok) {
              const data = await res.json();
              if (data && data.topic) { found = true; break; }
            }
          } catch {}
          await new Promise(r => setTimeout(r, 2000));
        }

        if (found) {
          navigate(`/market/${marketAddress}`);
        } else {
          setSuccess('Market created successfully! It may take a moment to appear.');
        }
      } else {
        navigate('/markets');
      }
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

  const showExisting = existingMarket && !forceCreate;

  return (
    <div className={styles.page}>
      {/* Marketing pitch */}
      <h1 className={styles.heroTitle}>Create markets. Earn forever.</h1>

      <div className={styles.pitchSection}>
        <h2 className={styles.pitchHeading}>How creator earnings work</h2>
        <p className={styles.pitchBody}>
          Anyone can create a market for free. Once live, you earn 30% of the 1% spread on every
          sell in your market. Forever.
        </p>
        <p className={styles.pitchBody}>
          The more volume your market generates, the more you earn. There is no cap.
        </p>
        <p className={styles.pitchBody}>
          Earnings are automatic. No claiming, no waiting. USDC goes straight to your wallet on every trade.
        </p>
      </div>

      <div className={styles.pitchSection}>
        <h2 className={styles.pitchHeading}>Why create a market?</h2>
        <p className={styles.pitchBody}>
          You know what your audience argues about. Turn that energy into a market.
        </p>
        <p className={styles.pitchBody}>
          When you create a market and pick a side early, you earn from both price movement and creator spread.
          Your position grows in value as your audience joins, and you collect revenue from every trade they make.
        </p>
        <p className={styles.pitchBody}>
          Your followers become advocates. They pick a side and promote it to their own networks.
          The more controversial the topic, the more volume, the more you earn.
        </p>
      </div>

      <div className={styles.formDivider} />

      <h2 className={styles.title}>Create a new market</h2>
      <p className={styles.subtitle}>Start a debate, earn from every trade.</p>

      <div className={styles.layout}>
        <div className={styles.formSection}>
          {/* Templates */}
          <div>
            <p className={styles.templateLabel}>Pick a type</p>
            <div className={styles.templates}>
              {TEMPLATES.map((t) => (
                <div
                  key={t.id}
                  className={selectedTemplate === t.id ? styles.templateCardSelected : styles.templateCard}
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
          {selectedTemplate && !isWYR && (
            <div className={styles.formFields}>
              {/* Topic field for Custom and World Cup */}
              {(isCustom || isWorldCup) && (
                <div className={styles.fieldGroup}>
                  <label className={styles.fieldLabel}>Topic</label>
                  <input
                    type="text"
                    className={styles.fieldInput}
                    placeholder={isWorldCup ? 'e.g., Brazil vs Argentina, bigger football culture forever' : 'e.g., Who is the football GOAT?'}
                    value={customTopic}
                    onChange={(e) => setCustomTopic(e.target.value)}
                  />
                </div>
              )}

              {/* Choice A (always shown) */}
              <div className={isBullBear ? '' : styles.choiceRow}>
                <div className={styles.fieldGroup}>
                  <label className={styles.fieldLabel}>{labelA}</label>
                  <input
                    type="text"
                    className={styles.fieldInput}
                    placeholder={placeholderA}
                    value={choiceA}
                    onChange={(e) => setChoiceA(e.target.value)}
                  />
                </div>
                {/* Choice B */}
                {showChoiceB && (
                  <div className={styles.fieldGroup}>
                    <label className={styles.fieldLabel}>{labelB}</label>
                    <input
                      type="text"
                      className={styles.fieldInput}
                      placeholder={placeholderB}
                      value={choiceB}
                      onChange={(e) => setChoiceB(e.target.value)}
                    />
                  </div>
                )}
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
          )}

          {/* Would You Rather form */}
          {isWYR && (
            <div className={styles.formFields}>
              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel}>Format</label>
                <select
                  className={styles.fieldSelect}
                  value={wyrFormat}
                  onChange={(e) => { setWyrFormat(e.target.value); setWyrInputA(''); setWyrInputB(''); }}
                >
                  <option value="sacrifice">Sacrifice trade</option>
                  <option value="thisorthat">This or that</option>
                </select>
                <span className={styles.wyrFormatDesc}>
                  {wyrFormat === 'sacrifice'
                    ? 'Would you give up X for Y?'
                    : 'Would you rather A or B?'}
                </span>
              </div>

              <div className={styles.choiceRow}>
                <div className={styles.fieldGroup}>
                  <label className={styles.fieldLabel}>
                    {wyrFormat === 'sacrifice' ? 'What would you give up' : 'First option'}
                  </label>
                  <input
                    type="text"
                    className={styles.fieldInput}
                    placeholder={wyrFormat === 'sacrifice' ? 'e.g., your favorite food' : 'e.g., live in NYC'}
                    value={wyrInputA}
                    onChange={(e) => setWyrInputA(e.target.value)}
                  />
                </div>
                <div className={styles.fieldGroup}>
                  <label className={styles.fieldLabel}>
                    {wyrFormat === 'sacrifice' ? 'To get what' : 'Second option'}
                  </label>
                  <input
                    type="text"
                    className={styles.fieldInput}
                    placeholder={wyrFormat === 'sacrifice' ? 'e.g., a superpower' : 'e.g., live in LA'}
                    value={wyrInputB}
                    onChange={(e) => setWyrInputB(e.target.value)}
                  />
                </div>
              </div>

              {wyrFormat === 'thisorthat' && (
                <div className={styles.choiceRow}>
                  <div className={styles.fieldGroup}>
                    <label className={styles.fieldLabel}>Side A</label>
                    <input
                      type="text"
                      className={styles.fieldInput}
                      value={sideA}
                      readOnly
                      style={{ opacity: 0.6 }}
                      onChange={() => {}}
                    />
                  </div>
                  <div className={styles.fieldGroup}>
                    <label className={styles.fieldLabel}>Side B</label>
                    <input
                      type="text"
                      className={styles.fieldInput}
                      value={sideB}
                      readOnly
                      style={{ opacity: 0.6 }}
                      onChange={() => {}}
                    />
                  </div>
                </div>
              )}

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
          )}

          {/* WYR suggestions */}
          {isWYR && (
            <div className={styles.wcSection}>
              <p className={styles.wcSugLabel}>Examples:</p>
              <div className={styles.wcSuggestions}>
                {WYR_EXAMPLES.map((ex) => (
                  <button
                    key={ex.text}
                    type="button"
                    className={styles.wcSugBtn}
                    onClick={() => {
                      setWyrFormat(ex.format);
                      setWyrInputA(ex.a);
                      setWyrInputB(ex.b);
                    }}
                  >
                    {ex.text}
                  </button>
                ))}
              </div>
              <p className={styles.wcNote}>
                A hypothetical trade is still just an opinion. Markets do not resolve.
              </p>
            </div>
          )}

          {/* World Cup suggestions */}
          {isWorldCup && (
            <div className={styles.wcSection}>
              <p className={styles.wcSugLabel}>Example debates:</p>
              <div className={styles.wcSuggestions}>
                {WC_EXAMPLES.map((ex) => (
                  <button
                    key={ex}
                    type="button"
                    className={styles.wcSugBtn}
                    onClick={() => {
                      setCustomTopic(ex);
                      if (ex.includes(' vs ')) {
                        const vs = ex.split(' vs ');
                        setChoiceA(vs[0].trim());
                        const rest = vs[1] || '';
                        setChoiceB(rest.split(',')[0].trim());
                      }
                    }}
                  >
                    {ex}
                  </button>
                ))}
              </div>
              <p className={styles.wcNote}>
                These are opinion markets about football debates, not predictions about match results. Markets do not resolve.
              </p>
            </div>
          )}

          {/* Messages */}
          {error && <div className={styles.errorMsg}>{error}</div>}
          {success && (
            <div className={styles.successMsg}>
              {success}
              {success.includes('moment') && (
                <Link to="/markets" style={{ display: 'block', marginTop: 8, color: '#1a6b3c', fontWeight: 600, textDecoration: 'none' }}>
                  View Markets
                </Link>
              )}
            </div>
          )}

          {/* Existing market match */}
          {showExisting && (
            <div className={styles.existingCard}>
              <p className={styles.existingLabel}>This debate is already live!</p>
              <p className={styles.existingTopic}>{existingMarket.topic}</p>
              <div className={styles.existingPrices}>
                <span className={styles.existingSideA}>
                  {existingMarket.sideAName} {Math.round(smartParsePrice(existingMarket.priceA))}%
                </span>
                <span className={styles.existingVs}>vs</span>
                <span className={styles.existingSideB}>
                  {existingMarket.sideBName} {Math.round(smartParsePrice(existingMarket.priceB))}%
                </span>
              </div>
              <Link to={`/market/${existingMarket.address}`} className={styles.joinBtn}>
                Join this debate
              </Link>
              <button className={styles.createAnywayLink} onClick={() => setForceCreate(true)}>
                Or create a new version anyway
              </button>
            </div>
          )}

          {/* Topic preview + Create button */}
          {selectedTemplate && !showExisting && (
            <div>
              {generatedTopic && (
                <p className={styles.topicPreview}>
                  Your market: {generatedTopic}
                </p>
              )}
              <button
                type="button"
                className={styles.createBtn}
                onClick={handleCreate}
                disabled={creating || !generatedTopic || !sideA || !sideB || !category}
              >
                {creating && <span className={styles.btnSpinner} />}
                {creating ? 'Creating...' : 'Create Market'}
              </button>
              <p className={styles.costNote}>
                Free to create. Your market goes live instantly.
              </p>
            </div>
          )}

          {searching && <p className={styles.searchingText}>Checking for existing markets...</p>}
        </div>

        {/* Sidebar */}
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
