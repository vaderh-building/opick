import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { parseUnits, formatUnits } from 'ethers';
import {
  AreaChart, Area, XAxis, YAxis, ReferenceLine,
  ResponsiveContainer, Tooltip,
} from 'recharts';
import { useMarket } from '../hooks/useMarkets.js';
import { useContracts } from '../hooks/useContracts.js';
import { usePriceWebSocket } from '../hooks/usePriceWebSocket.js';
import s from './MarketPage.module.css';

const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:3001') + '/api';
const TIME_RANGES = ['1H', '6H', '1D', '1W', '1M', 'ALL'];

// Generate a flat line at the current price (no fake data)
function generateFlatLine(currentPrice) {
  const price = currentPrice != null ? currentPrice : 50;
  const now = Date.now();
  const interval = (24 * 60 * 60 * 1000) / 10;
  return Array.from({ length: 11 }, (_, i) => ({
    time: new Date(now - (10 - i) * interval).toLocaleTimeString([], {
      hour: '2-digit', minute: '2-digit',
    }),
    priceA: Math.round(price * 10) / 10,
  }));
}

function truncateAddress(addr) {
  if (!addr) return '';
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

// Defensive parsers — handle both raw BigInt strings and already-parsed values
function smartParsePrice(val) {
  if (!val && val !== 0) return 50;
  const n = Number(val);
  if (isNaN(n)) return 50;
  // Raw BigInt string like "500000000000000000" → 50
  if (n > 1e10) return (n / 1e18) * 100;
  // Already a fraction like 0.5 → 50
  if (n <= 1) return n * 100;
  // Already a percentage like 50 → 50
  return n;
}

function smartParseUSDC(val) {
  if (!val && val !== 0) return 0;
  const n = Number(val);
  if (isNaN(n)) return 0;
  // Raw 6-decimal string like "1000000000" → 1000
  if (n > 1e7) return n / 1e6;
  // Already parsed
  return n;
}

export default function MarketPage({ account, provider, signer, onConnect, authenticated, walletReady }) {
  const { address: marketAddress } = useParams();
  const { market: rawMarket, loading, refetch } = useMarket(marketAddress);
  const { usdc, getMarket } = useContracts(signer || provider);
  const prices = usePriceWebSocket();

  // Parse market data from API
  const market = rawMarket ? {
    ...rawMarket,
    topic: rawMarket.topic || 'Untitled',
    sideAName: rawMarket.sideAName || 'Side A',
    sideBName: rawMarket.sideBName || 'Side B',
    category: rawMarket.category || '',
    creator: rawMarket.creator || '',
    totalVolume: smartParseUSDC(rawMarket.totalVolume),
    creatorEarnings: smartParseUSDC(rawMarket.creatorEarnings),
  } : null;

  // UI state
  const [selectedSide, setSelectedSide] = useState('A');
  const [amount, setAmount] = useState('');
  const [timeRange, setTimeRange] = useState('1D');
  const [activeTab, setActiveTab] = useState('comments');
  const [txLoading, setTxLoading] = useState(false);
  const [txError, setTxError] = useState('');

  // Balance
  const [usdcBalance, setUsdcBalance] = useState(null);

  // Comments
  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState('');
  const [commentLoading, setCommentLoading] = useState(false);

  // Position
  const [position, setPosition] = useState(null);
  const [sellLoading, setSellLoading] = useState(false);

  // Faucet
  const [faucetLoading, setFaucetLoading] = useState(false);
  const [faucetDone, setFaucetDone] = useState(false);

  // Get live prices or fall back to market data → percentage 0-100
  const livePrice = prices[marketAddress];
  const priceA = smartParsePrice(livePrice?.priceA ?? market?.priceA);
  const priceB = smartParsePrice(livePrice?.priceB ?? market?.priceB);
  const currentPrice = selectedSide === 'A' ? priceA : priceB;

  // Chart data — flat line at current price (real history when available)
  const chartData = useMemo(
    () => generateFlatLine(priceA),
    [marketAddress, Math.round(priceA)]
  );

  // Fetch USDC balance
  useEffect(() => {
    if (!usdc || !account) return;
    (async () => {
      try {
        const bal = await usdc.balanceOf(account);
        setUsdcBalance(bal);
      } catch (e) {
        console.error('Failed to fetch USDC balance:', e);
      }
    })();
  }, [usdc, account, txLoading]);

  // Fetch position
  useEffect(() => {
    if (!account || !marketAddress || !getMarket || !signer) return;
    (async () => {
      try {
        const marketContract = getMarket(marketAddress);
        if (!marketContract) return;
        const sharesA = await marketContract.sharesA(account);
        const sharesB = await marketContract.sharesB(account);
        if (sharesA > 0n || sharesB > 0n) {
          const side = sharesA > 0n ? 'A' : 'B';
          const shares = side === 'A' ? sharesA : sharesB;
          const price = side === 'A' ? priceA : priceB;
          const currentValue = (Number(formatUnits(shares, 6)) * price) / 100;
          setPosition({ side, shares, currentValue });
        } else {
          setPosition(null);
        }
      } catch (e) {
        // Contract might not support these methods
        setPosition(null);
      }
    })();
  }, [account, marketAddress, getMarket, signer, priceA, priceB]);

  // Fetch comments
  const fetchComments = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/comments/${marketAddress}`);
      if (res.ok) {
        const data = await res.json();
        setComments(data);
      }
    } catch (e) {
      console.error('Failed to fetch comments:', e);
    }
  }, [marketAddress]);

  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  // Post comment
  const handlePostComment = async () => {
    if (!commentText.trim() || !account) return;
    setCommentLoading(true);
    try {
      await fetch(`${API_URL}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          marketAddress,
          userAddress: account,
          text: commentText.trim(),
        }),
      });
      setCommentText('');
      fetchComments();
    } catch (e) {
      console.error('Failed to post comment:', e);
    } finally {
      setCommentLoading(false);
    }
  };

  const handleFaucet = async () => {
    if (!signer || !usdc || faucetLoading) return;
    setFaucetLoading(true);
    setFaucetDone(false);
    try {
      const tx = await usdc.faucet();
      await tx.wait();
      setFaucetDone(true);
      setTxError('');
      if (account) {
        const bal = await usdc.balanceOf(account);
        setUsdcBalance(bal);
      }
    } catch (e) {
      setTxError('Faucet failed: ' + (e?.reason || e?.message || ''));
    } finally {
      setFaucetLoading(false);
    }
  };

  // Buy shares
  const handleBuy = async () => {
    if (!amount || !signer || !usdc || !getMarket) {
      if (!signer) setTxError('Wallet not ready. Please wait a moment.');
      return;
    }
    setTxError('');
    setTxLoading(true);
    try {
      const amountBigInt = parseUnits(amount, 6);

      // Check USDC balance
      if (account) {
        const balance = await usdc.balanceOf(account);
        if (balance < amountBigInt) {
          setTxError(`Insufficient USDC balance. You have $${(Number(balance) / 1e6).toFixed(2)}. Use the faucet to get testnet USDC.`);
          setTxLoading(false);
          return;
        }
      }

      const marketContract = getMarket(marketAddress);

      // Approve USDC
      const approveTx = await usdc.approve(marketAddress, amountBigInt);
      await approveTx.wait();

      // Buy shares
      const buyTx = selectedSide === 'A'
        ? await marketContract.buyA(amountBigInt)
        : await marketContract.buyB(amountBigInt);
      await buyTx.wait();

      setAmount('');
      setTxError('');
      refetch();
    } catch (e) {
      console.error('Transaction failed:', e);
      const msg = e?.reason || e?.message || 'Transaction failed';
      if (msg.includes('insufficient')) {
        setTxError('Insufficient USDC. Use the faucet to get testnet tokens.');
      } else {
        setTxError(msg.length > 100 ? msg.slice(0, 100) + '...' : msg);
      }
    } finally {
      setTxLoading(false);
    }
  };

  // Sell shares
  const handleSell = async () => {
    if (!position || !signer || !getMarket) return;
    setSellLoading(true);
    setTxError('');
    try {
      const marketContract = getMarket(marketAddress);
      const sellFn = position.side === 'A'
        ? marketContract.sellA(position.shares)
        : marketContract.sellB(position.shares);
      const sellTx = await sellFn;
      await sellTx.wait();
      setPosition(null);
      refetch();
    } catch (e) {
      console.error('Sell failed:', e);
      setTxError(e?.reason || e?.message || 'Sell failed');
    } finally {
      setSellLoading(false);
    }
  };

  // Quick add amounts
  const handleQuickAdd = (val) => {
    if (val === 'max' && usdcBalance != null) {
      setAmount(formatUnits(usdcBalance, 6));
    } else {
      const current = parseFloat(amount) || 0;
      setAmount(String(current + val));
    }
  };

  // Calculated values
  const amountNum = parseFloat(amount) || 0;
  const priceDecimal = currentPrice / 100;
  const potentialReturn = priceDecimal > 0 ? (amountNum / priceDecimal) - amountNum : 0;

  if (loading) {
    return <div className={s.loading}>Loading market...</div>;
  }

  if (!market) {
    return (
      <div className={s.notFound}>
        <h2 className={s.notFoundTitle}>Market not found</h2>
        <p className={s.notFoundText}>This market may not exist or the address is invalid.</p>
        <Link to="/" className={s.backLink} style={{ marginTop: 16, display: 'inline-flex' }}>
          Back to markets
        </Link>
      </div>
    );
  }

  const sideAName = market.sideAName || 'Side A';
  const sideBName = market.sideBName || 'Side B';

  return (
    <div className={s.page}>
      <div className={s.layout}>
        {/* LEFT COLUMN */}
        <div className={s.left}>
          <Link to="/markets" className={s.backLink}>
            &larr; All markets
          </Link>
          <h1 className={s.title}>{market.topic}</h1>

          <div className={s.meta}>
            {market.category && (
              <span className={s.categoryPill}>{market.category}</span>
            )}
            <span className={s.metaItem}>
              Volume: <span>${(market.totalVolume || 0) === 0 ? '0' : market.totalVolume.toLocaleString(undefined, {maximumFractionDigits: 0})}</span>
            </span>
            {market.creator && (
              <span className={s.metaItem}>
                Creator: <span>{truncateAddress(market.creator)}</span>
              </span>
            )}
          </div>

          {/* Price bar */}
          <div className={s.priceBar}>
            <div className={s.priceBox}>
              <div className={s.priceLabel}>{sideAName}</div>
              <div className={s.priceValueGreen}>{Math.round(priceA)}%</div>
              <div className={s.priceSide}>${(priceA / 100).toFixed(2)} per share</div>
            </div>
            <div className={s.priceBox}>
              <div className={s.priceLabel}>{sideBName}</div>
              <div className={s.priceValueRed}>{Math.round(priceB)}%</div>
              <div className={s.priceSide}>${(priceB / 100).toFixed(2)} per share</div>
            </div>
          </div>

          {/* Chart */}
          <div className={s.chartSection}>
            <div className={s.chartHeader}>
              <span className={s.chartTitle}>{sideAName} Price</span>
              <div className={s.timeButtons}>
                {TIME_RANGES.map((t) => (
                  <button
                    key={t}
                    className={timeRange === t ? s.timeBtnActive : s.timeBtn}
                    onClick={() => setTimeRange(t)}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
            <div className={s.chartArea}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                  <defs>
                    <linearGradient id="greenGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#1a6b3c" stopOpacity={0.2} />
                      <stop offset="100%" stopColor="#1a6b3c" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="time"
                    tick={{ fontSize: 11, fill: '#9c9b96' }}
                    axisLine={false}
                    tickLine={false}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    domain={[0, 100]}
                    tick={{ fontSize: 11, fill: '#9c9b96' }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => `${v}%`}
                    width={40}
                  />
                  <ReferenceLine
                    y={50}
                    stroke="#E8E7E2"
                    strokeDasharray="4 4"
                  />
                  <Tooltip
                    contentStyle={{
                      background: '#fff',
                      border: '1px solid #E8E7E2',
                      borderRadius: 8,
                      fontSize: 13,
                    }}
                    formatter={(value) => [`${value}%`, sideAName]}
                  />
                  <Area
                    type="monotone"
                    dataKey="priceA"
                    stroke="#1a6b3c"
                    strokeWidth={2}
                    fill="url(#greenGrad)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Tabs */}
          <div className={s.tabs}>
            <button
              className={activeTab === 'comments' ? s.tabActive : s.tab}
              onClick={() => setActiveTab('comments')}
            >
              Comments
            </button>
            <button
              className={activeTab === 'holders' ? s.tabActive : s.tab}
              onClick={() => setActiveTab('holders')}
            >
              Top Holders
            </button>
            <button
              className={activeTab === 'activity' ? s.tabActive : s.tab}
              onClick={() => setActiveTab('activity')}
            >
              Activity
            </button>
          </div>

          <div className={s.tabContent}>
            {activeTab === 'comments' && (
              <>
                {account ? (
                  <div className={s.commentForm}>
                    <input
                      type="text"
                      className={s.commentInput}
                      placeholder="Add a comment..."
                      value={commentText}
                      onChange={(e) => setCommentText(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handlePostComment()}
                    />
                    <button
                      className={s.commentPostBtn}
                      onClick={handlePostComment}
                      disabled={commentLoading || !commentText.trim()}
                    >
                      Post
                    </button>
                  </div>
                ) : (
                  <div className={s.connectPrompt}>
                    <p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 8 }}>
                      Connect your wallet to comment
                    </p>
                  </div>
                )}

                {comments.length > 0 ? (
                  <div className={s.commentList}>
                    {comments.map((c, i) => (
                      <div key={c.id || i} className={s.comment}>
                        <div className={s.commentHeader}>
                          <span className={s.commentUser}>
                            {truncateAddress(c.userAddress)}
                          </span>
                          <span className={s.commentTime}>
                            {timeAgo(c.createdAt)}
                          </span>
                        </div>
                        <p className={s.commentText}>{c.text}</p>
                        <div className={s.commentFooter}>
                          <button className={s.likeBtn}>
                            &#9825; {c.likes || 0}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className={s.noComments}>No comments yet. Be the first!</div>
                )}
              </>
            )}

            {activeTab === 'holders' && (
              <div className={s.placeholder}>Coming soon</div>
            )}

            {activeTab === 'activity' && (
              <div className={s.placeholder}>Coming soon</div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN - Trade Panel */}
        <div className={s.right}>
          <div className={s.tradeCard}>
            <div className={s.tradeHeader}>Pick a Side</div>

            <div className={s.sideToggle}>
              <button
                className={selectedSide === 'A' ? s.sideBtnA : s.sideBtn}
                onClick={() => setSelectedSide('A')}
              >
                {sideAName}
              </button>
              <button
                className={selectedSide === 'B' ? s.sideBtnB : s.sideBtn}
                onClick={() => setSelectedSide('B')}
              >
                {sideBName}
              </button>
            </div>

            <div className={s.amountSection}>
              <div className={s.amountLabel}>Amount</div>
              <div className={s.amountInputWrap}>
                <span className={s.amountPrefix}>$</span>
                <input
                  type="number"
                  className={s.amountInput}
                  placeholder="0"
                  min="0"
                  step="any"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </div>
              <div className={s.quickAmounts}>
                {[1, 5, 10, 100].map((v) => (
                  <button
                    key={v}
                    className={s.quickBtn}
                    onClick={() => handleQuickAdd(v)}
                  >
                    +${v}
                  </button>
                ))}
                <button
                  className={s.quickBtn}
                  onClick={() => handleQuickAdd('max')}
                >
                  Max
                </button>
              </div>
            </div>

            <div className={s.infoSection}>
              <div className={s.infoRow}>
                <span className={s.infoLabel}>Entry price</span>
                <span className={s.infoValue}>{Math.round(currentPrice)}%</span>
              </div>
              <div className={s.infoRow}>
                <span className={s.infoLabel}>If everyone agrees with you</span>
                <span className={s.infoValueGreen}>
                  {potentialReturn > 0 ? `+$${potentialReturn.toFixed(2)}` : '$0.00'}
                </span>
              </div>
              <div className={s.infoRow}>
                <span className={s.infoLabel}>Avg price</span>
                <span className={s.infoValue}>
                  ${priceDecimal > 0 ? priceDecimal.toFixed(2) : '0.00'} / share
                </span>
              </div>
            </div>

            {faucetDone && <div className={s.successMsg}>10,000 USDC claimed!</div>}

            {txError && (
              <div className={s.errorMsg}>
                {txError}
                {txError.includes('nsufficient') && walletReady && (
                  <button className={s.faucetLink} onClick={handleFaucet} disabled={faucetLoading}>
                    {faucetLoading ? 'Claiming...' : '→ Get 10,000 free USDC'}
                  </button>
                )}
              </div>
            )}

            {!authenticated ? (
              <button className={s.pickBtnGreen} onClick={onConnect}>
                Sign in to pick a side
              </button>
            ) : !walletReady ? (
              <button className={s.pickBtnGreen} disabled title="Your wallet is being set up. This may take a moment.">
                Wallet setup in progress...
              </button>
            ) : (
              <button
                className={selectedSide === 'A' ? s.pickBtnGreen : s.pickBtnRed}
                onClick={handleBuy}
                disabled={txLoading || !amountNum}
              >
                {txLoading
                  ? 'Processing...'
                  : `Pick ${selectedSide === 'A' ? sideAName : sideBName}`}
              </button>
            )}

            <p className={s.pickDisclaimer}>
              Price moves as people pick sides. Sell anytime for profit.
            </p>

            {/* Position */}
            {position && (
              <div className={s.positionSection}>
                <div className={s.positionTitle}>Your Position</div>
                <div className={s.positionRow}>
                  <span className={s.positionLabel}>Side</span>
                  <span className={s.positionValue}>
                    {position.side === 'A' ? sideAName : sideBName}
                  </span>
                </div>
                <div className={s.positionRow}>
                  <span className={s.positionLabel}>Shares</span>
                  <span className={s.positionValue}>
                    {Number(formatUnits(position.shares, 6)).toFixed(2)}
                  </span>
                </div>
                <div className={s.positionRow}>
                  <span className={s.positionLabel}>Current value</span>
                  <span className={s.positionValue}>
                    ${position.currentValue.toFixed(2)}
                  </span>
                </div>
                <button
                  className={s.sellBtn}
                  onClick={handleSell}
                  disabled={sellLoading}
                >
                  {sellLoading ? 'Selling...' : 'Sell All'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
