import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { parseUnits, formatUnits } from 'ethers';
import {
  LineChart, Line, XAxis, YAxis, ReferenceLine,
  ResponsiveContainer, Tooltip, Legend,
} from 'recharts';
import { useFundWallet } from '@privy-io/react-auth';
import { base } from 'viem/chains';
import { useMarket } from '../hooks/useMarkets.js';
import { useContracts } from '../hooks/useContracts.js';
import { usePriceWebSocket } from '../hooks/usePriceWebSocket.js';
import s from './MarketPage.module.css';

const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:3001') + '/api';
const TIME_RANGES = ['1H', '6H', '1D', '1W', '1M', 'ALL'];

function formatChartTime(ts) {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
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
  // Raw 6-decimal string: anything above 1000 in raw units ($0.001) is raw
  // $1 = 1000000, $0.01 = 10000. Threshold at 1000 catches everything > $0.001
  if (n > 1000) return n / 1e6;
  return n;
}

export default function MarketPage({ account, provider, signer, onConnect, authenticated, walletReady }) {
  const { address: marketAddress } = useParams();
  const { market: rawMarket, loading, refetch } = useMarket(marketAddress);
  const { usdc, getMarket } = useContracts(signer || provider);
  const prices = usePriceWebSocket();
  const { fundWallet } = useFundWallet();

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

  // On-chain overrides (after trades)
  const [chainPriceA, setChainPriceA] = useState(null);
  const [chainPriceB, setChainPriceB] = useState(null);
  const [chainVolume, setChainVolume] = useState(null);
  const [txCount, setTxCount] = useState(0); // trigger for re-fetching position

  // Comments
  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState('');
  const [commentLoading, setCommentLoading] = useState(false);

  // Position
  const [position, setPosition] = useState(null);
  const [sellLoading, setSellLoading] = useState(false);


  // Prices: on-chain override > WS > API cache
  const livePrice = prices[marketAddress];
  const priceA = chainPriceA != null ? chainPriceA : smartParsePrice(livePrice?.priceA ?? market?.priceA);
  const priceB = chainPriceB != null ? chainPriceB : smartParsePrice(livePrice?.priceB ?? market?.priceB);
  const currentPrice = selectedSide === 'A' ? priceA : priceB;

  // Price history for chart
  const [priceHistoryData, setPriceHistoryData] = useState([]);

  const fetchPriceHistory = useCallback(async () => {
    if (!marketAddress) return;
    try {
      const res = await fetch(`${API_URL}/markets/price-history/${marketAddress}`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) setPriceHistoryData(data);
      }
    } catch {}
  }, [marketAddress]);

  useEffect(() => { fetchPriceHistory(); }, [fetchPriceHistory]);

  // Build chart data: history + current live point
  const chartData = useMemo(() => {
    const points = priceHistoryData.map(p => ({
      time: formatChartTime(p.timestamp),
      sideA: smartParsePrice(p.priceA),
      sideB: smartParsePrice(p.priceB),
    }));
    // Always add current live point
    points.push({ time: 'Now', sideA: priceA, sideB: priceB });
    return points;
  }, [priceHistoryData, priceA, priceB]);

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
  }, [account, marketAddress, getMarket, signer, priceA, priceB, txCount]);

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

  // Refresh prices/volume directly from chain
  const refreshFromChain = async () => {
    if (!getMarket || !marketAddress) return;
    try {
      const mc = getMarket(marketAddress);
      const pA = await mc.priceA();
      const pB = await mc.priceB();
      const vol = await mc.totalVolume();
      const parsedA = smartParsePrice(pA.toString());
      const parsedB = smartParsePrice(pB.toString());
      const parsedVol = smartParseUSDC(vol.toString());
      console.log('On-chain refresh:', { priceA: parsedA, priceB: parsedB, volume: parsedVol });
      setChainPriceA(parsedA);
      setChainPriceB(parsedB);
      setChainVolume(parsedVol);
      setTxCount(c => c + 1);
    } catch (e) {
      console.error('refreshFromChain failed:', e.message);
    }
    // Refresh backend cache + price history
    try {
      await fetch(`${API_URL}/markets/refresh`, { method: 'POST' });
      fetchPriceHistory();
    } catch {}
    // Refresh USDC balance
    if (usdc && account) {
      try { setUsdcBalance(await usdc.balanceOf(account)); } catch {}
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
          setTxError(`Insufficient USDC. You have $${(Number(balance) / 1e6).toFixed(2)}. You need USDC on Base to trade.`);
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
      await refreshFromChain();
    } catch (e) {
      console.error('Transaction failed:', e);
      const msg = e?.reason || e?.message || 'Transaction failed';
      if (msg.includes('insufficient')) {
        setTxError('Insufficient USDC. You need USDC on Base to trade.');
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
      await refreshFromChain();
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
              Volume: <span>${(() => { const v = chainVolume != null ? chainVolume : (market.totalVolume || 0); if (v === 0) return '0'; if (v < 1) return v.toFixed(2); if (v < 1000) return v.toFixed(2); return v.toLocaleString(undefined, {maximumFractionDigits: 0}); })()}</span>
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
              <div className={s.priceValueGreen}>{priceA.toFixed(1)}%</div>
              <div className={s.priceSide}>${(priceA / 100).toFixed(2)} per share</div>
            </div>
            <div className={s.priceBox}>
              <div className={s.priceLabel}>{sideBName}</div>
              <div className={s.priceValueRed}>{priceB.toFixed(1)}%</div>
              <div className={s.priceSide}>${(priceB / 100).toFixed(2)} per share</div>
            </div>
          </div>

          {/* Chart */}
          <div className={s.chartSection}>
            <div className={s.chartHeader}>
              <span className={s.chartTitle}>Price History</span>
            </div>
            <div className={s.chartArea}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                  <XAxis
                    dataKey="time"
                    tick={{ fontSize: 10, fill: '#9c9b96', fontFamily: 'DM Sans' }}
                    axisLine={false}
                    tickLine={false}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    domain={[0, 100]}
                    tick={{ fontSize: 10, fill: '#9c9b96', fontFamily: 'DM Sans' }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => `${v}%`}
                    width={36}
                  />
                  <ReferenceLine
                    y={50}
                    stroke="#E8E7E2"
                    strokeDasharray="4 4"
                  />
                  <Tooltip
                    contentStyle={{
                      background: '#fff',
                      border: '0.5px solid #E8E7E2',
                      borderRadius: 4,
                      fontSize: 12,
                      fontFamily: 'DM Sans',
                    }}
                    formatter={(value, name) => [`${Number(value).toFixed(1)}%`, name === 'sideA' ? sideAName : sideBName]}
                  />
                  <Legend
                    formatter={(value) => value === 'sideA' ? sideAName : sideBName}
                    wrapperStyle={{ fontSize: 11, fontFamily: 'DM Sans' }}
                  />
                  <Line type="monotone" dataKey="sideA" stroke="#1a6b3c" strokeWidth={2} dot={chartData.length <= 2} />
                  <Line type="monotone" dataKey="sideB" stroke="#8b2500" strokeWidth={2} dot={chartData.length <= 2} />
                </LineChart>
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

            {authenticated && walletReady && usdcBalance != null && usdcBalance === 0n && (
              <div className={s.fundPrompt}>
                <p className={s.fundText}>Add USDC to your wallet to start picking sides.</p>
                <button className={s.fundBtn} onClick={() => { if (account) fundWallet({ address: account, options: { chain: base, asset: 'USDC' } }).catch(() => {}); }}>
                  Add USDC
                </button>
              </div>
            )}

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
                <span className={s.infoValue}>{currentPrice.toFixed(1)}%</span>
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

            {txError && <div className={s.errorMsg}>{txError}</div>}

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
            <p className={s.tosLine}>
              By trading, you agree to our <a href="/terms" target="_blank" rel="noopener noreferrer">Terms</a>, <a href="/privacy" target="_blank" rel="noopener noreferrer">Privacy Policy</a>, and <a href="/risk" target="_blank" rel="noopener noreferrer">Risk Disclosure</a>.
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
