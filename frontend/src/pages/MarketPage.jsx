import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { parseUnits, formatUnits } from 'ethers';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, ReferenceLine,
  ResponsiveContainer, Tooltip,
} from 'recharts';
import { useFundWallet } from '@privy-io/react-auth';
import { base } from 'viem/chains';
import { useMarket } from '../hooks/useMarkets.js';
import { useContracts } from '../hooks/useContracts.js';
import { usePriceWebSocket } from '../hooks/usePriceWebSocket.js';
import { useSponsoredTx } from '../hooks/useSponsoredTx.js';
import { triggerReferralCheck } from '../hooks/useReferralPayoutTrigger.js';
import { USDC_ADDRESS } from '../config.js';
import USDCAbi from '../abi/MockUSDC.json';
import OPickMarketAbi from '../abi/OPickMarket.json';
import s from './MarketPage.module.css';

const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:3001') + '/api';
const TIME_RANGES = ['1H', '6H', '1D', '1W', '1M', 'ALL'];

function formatChartTime(ts) {
  const diff = Math.round((Date.now() - ts) / 60000);
  if (diff < 1) return 'now';
  if (diff < 60) return `${diff}m ago`;
  if (diff < 1440) return `${Math.round(diff / 60)}h ago`;
  return `${Math.round(diff / 1440)}d ago`;
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

// Simulate sell value using EXACT AMM math from OPickMarket.sol
// At current reserves: sellA puts shares back into reserveA, gets USDC from reserveB
// gross = reserveB - k / (reserveA + shares), then usdcOut = gross * 0.99
function simulateSellValue(sharesRaw, side, rA, rB) {
  if (!sharesRaw || !rA || !rB) return 0;
  const shares = Number(sharesRaw);
  const reserveA = Number(rA);
  const reserveB = Number(rB);
  const k = reserveA * reserveB;
  let gross;
  if (side === 'A') {
    gross = reserveB - k / (reserveA + shares);
  } else {
    gross = reserveA - k / (reserveB + shares);
  }
  return (gross * 0.99) / 1e6; // after 1% spread, convert from raw to USDC
}

// Simulate sell value at a hypothetical price level
// targetPct = what priceA would be (e.g. 60 means 60% for sideA)
// We compute what reserves would look like at that price, then sell
function simulateValueAtPrice(sharesRaw, side, targetPct, rA, rB) {
  if (!sharesRaw || !rA || !rB) return 0;
  const k = Number(rA) * Number(rB);
  // At target: priceA = rB_new / (rA_new + rB_new) = targetPct/100
  // And rA_new * rB_new = k
  // So rB_new = rA_new * targetPct / (100 - targetPct)
  // And rA_new * rA_new * targetPct / (100 - targetPct) = k
  // rA_new = sqrt(k * (100 - targetPct) / targetPct)
  const t = targetPct / 100;
  if (t <= 0 || t >= 1) return 0;
  const rA_new = Math.sqrt(k * (1 - t) / t);
  const rB_new = k / rA_new;
  return simulateSellValue(sharesRaw, side, rA_new, rB_new);
}

export default function MarketPage({ account, provider, signer, onConnect, authenticated, walletReady }) {
  const { address: marketAddress } = useParams();
  const { market: rawMarket, loading, retrying, refetch } = useMarket(marketAddress);
  const { usdc, getMarket } = useContracts(signer || provider);
  const prices = usePriceWebSocket();
  const { fundWallet } = useFundWallet();
  const { sponsoredCall } = useSponsoredTx();

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

  // Trade feed + price flash
  const [trades, setTrades] = useState([]);
  const [priceFlash, setPriceFlash] = useState(null); // 'up' | 'down' | null
  const [shareCopied, setShareCopied] = useState(false);


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

  // Trade feed
  const fetchTrades = useCallback(async () => {
    if (!marketAddress) return;
    try {
      const res = await fetch(`${API_URL}/markets/trades/${marketAddress}`);
      if (res.ok) setTrades(await res.json());
    } catch {}
  }, [marketAddress]);

  useEffect(() => { fetchTrades(); }, [fetchTrades]);
  useEffect(() => {
    const iv = setInterval(fetchTrades, 15000);
    return () => clearInterval(iv);
  }, [fetchTrades]);

  // Build chart data + compute Y-axis range
  const { chartData, yDomain } = useMemo(() => {
    const points = priceHistoryData.map(p => ({
      time: formatChartTime(p.timestamp),
      sideA: smartParsePrice(p.priceA),
      sideB: smartParsePrice(p.priceB),
    }));
    points.push({ time: 'Now', sideA: priceA, sideB: priceB });

    // Deduplicate: if first and last both say "now", label first differently
    if (points.length >= 2 && points[0].time === 'now' && points[points.length - 1].time === 'Now') {
      points[0].time = '1m ago';
    }

    const allVals = points.flatMap(p => [p.sideA, p.sideB]);
    let mn = Math.min(...allVals);
    let mx = Math.max(...allVals);
    if (mx - mn < 1) { mn = 47; mx = 53; } // flat at 50%, tight range
    else { mn -= 1; mx += 1; }
    // Always include 50 in the range
    mn = Math.min(mn, 49);
    mx = Math.max(mx, 51);
    return { chartData: points, yDomain: [Math.max(0, mn), Math.min(100, mx)] };
  }, [priceHistoryData, priceA, priceB]);

  // Fetch USDC balance
  const refreshBalance = useCallback(async () => {
    if (!usdc || !account) return;
    try { setUsdcBalance(await usdc.balanceOf(account)); } catch {}
  }, [usdc, account]);

  useEffect(() => { refreshBalance(); }, [refreshBalance, txLoading]);

  // Auto-refresh balance every 20s
  useEffect(() => {
    if (!usdc || !account) return;
    const iv = setInterval(refreshBalance, 20000);
    return () => clearInterval(iv);
  }, [refreshBalance, usdc, account]);

  // Fetch positions (both sides) with accurate sell values
  useEffect(() => {
    if (!account || !marketAddress || !getMarket || !signer) return;
    (async () => {
      try {
        const mc = getMarket(marketAddress);
        if (!mc) return;
        const sharesA = await mc.sharesA(account);
        const sharesB = await mc.sharesB(account);
        const reserveA = await mc.reserveA();
        const reserveB = await mc.reserveB();

        const positions = [];
        if (sharesA > 0n) {
          const sellVal = simulateSellValue(sharesA, 'A', reserveA, reserveB);
          const costKey = `opick_cost_${marketAddress}_${account}_A`;
          const costBasis = parseFloat(localStorage.getItem(costKey) || '0');
          positions.push({ side: 'A', shares: sharesA, currentValue: sellVal, costBasis });
        }
        if (sharesB > 0n) {
          const sellVal = simulateSellValue(sharesB, 'B', reserveA, reserveB);
          const costKey = `opick_cost_${marketAddress}_${account}_B`;
          const costBasis = parseFloat(localStorage.getItem(costKey) || '0');
          positions.push({ side: 'B', shares: sharesB, currentValue: sellVal, costBasis });
        }
        setPosition(positions.length > 0 ? positions : null);
      } catch {
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

  // Refresh prices/volume directly from chain, log trade, flash price
  const refreshFromChain = async (tradeSide, tradeAmount) => {
    if (!getMarket || !marketAddress) return;
    const prevA = priceA;
    try {
      const mc = getMarket(marketAddress);
      const pA = await mc.priceA();
      const pB = await mc.priceB();
      const vol = await mc.totalVolume();
      const parsedA = smartParsePrice(pA.toString());
      const parsedB = smartParsePrice(pB.toString());
      const parsedVol = smartParseUSDC(vol.toString());
      setChainPriceA(parsedA);
      setChainPriceB(parsedB);
      setChainVolume(parsedVol);
      setTxCount(c => c + 1);
      // Price flash
      if (parsedA > prevA + 0.01) { setPriceFlash('up'); setTimeout(() => setPriceFlash(null), 1200); }
      else if (parsedA < prevA - 0.01) { setPriceFlash('down'); setTimeout(() => setPriceFlash(null), 1200); }
    } catch (e) {
      console.error('refreshFromChain failed:', e.message);
    }
    // Log trade to backend (don't await)
    if (tradeSide && tradeAmount) {
      fetch(`${API_URL}/markets/trades/${marketAddress}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ side: tradeSide, amount: tradeAmount }),
      }).catch(() => {});
      // Optimistic: add to local trades
      setTrades(prev => [{ timestamp: Date.now(), side: tradeSide, amount: tradeAmount }, ...prev].slice(0, 20));
    }
    // Refresh backend (don't block)
    fetch(`${API_URL}/markets/refresh`, { method: 'POST' })
      .then(() => { fetchPriceHistory(); fetchTrades(); })
      .catch(() => {});
    // Refresh USDC balance
    if (usdc && account) {
      try { setUsdcBalance(await usdc.balanceOf(account)); } catch {}
    }
  };

  // Buy shares (gas sponsored via Privy)
  const handleBuy = async () => {
    if (!amount || !account) {
      setTxError('Wallet not ready. Please wait a moment.');
      return;
    }
    setTxError('');
    setTxLoading(true);
    try {
      const amountBigInt = parseUnits(amount, 6);

      // Check USDC balance
      if (usdc) {
        const balance = await usdc.balanceOf(account);
        if (balance < amountBigInt) {
          setTxError(`Insufficient USDC. You have $${(Number(balance) / 1e6).toFixed(2)}. You need USDC on Base to trade.`);
          setTxLoading(false);
          return;
        }
      }

      // Approve USDC (sponsored)
      await sponsoredCall(USDC_ADDRESS, USDCAbi, 'approve', [marketAddress, amountBigInt]);

      // Buy shares (sponsored)
      const fn = selectedSide === 'A' ? 'buyA' : 'buyB';
      await sponsoredCall(marketAddress, OPickMarketAbi, fn, [amountBigInt]);

      const tradeAmt = parseFloat(amount);
      // Track cost basis per side
      if (account) {
        const sideKey = selectedSide === 'A' ? 'A' : 'B';
        const costKey = `opick_cost_${marketAddress}_${account}_${sideKey}`;
        const prev = parseFloat(localStorage.getItem(costKey) || '0');
        localStorage.setItem(costKey, String(prev + tradeAmt));
      }
      setAmount('');
      setTxError('');
      setTxLoading(false);
      refreshFromChain(selectedSide === 'A' ? sideAName : sideBName, tradeAmt);
      // Fire-and-forget referral check
      triggerReferralCheck(account);
    } catch (e) {
      console.error('Transaction failed:', e);
      const msg = e?.reason || e?.message || 'Transaction failed';
      if (msg.includes('insufficient')) {
        setTxError('Insufficient USDC. You need USDC on Base to trade.');
      } else {
        setTxError(msg.length > 100 ? msg.slice(0, 100) + '...' : msg);
      }
      setTxLoading(false);
    }
  };

  // Sell shares (gas sponsored via Privy)
  const handleSell = async (pos) => {
    if (!pos || !account) return;
    setSellLoading(true);
    setTxError('');
    try {
      const fn = pos.side === 'A' ? 'sellA' : 'sellB';
      await sponsoredCall(marketAddress, OPickMarketAbi, fn, [pos.shares]);
      setPosition(null);
      setSellLoading(false);
      refreshFromChain();
    } catch (e) {
      console.error('Sell failed:', e);
      setTxError(e?.reason || e?.message || 'Sell failed');
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
    return (
      <div className={s.loading}>
        {retrying
          ? 'Looking for your market... This may take a moment.'
          : 'Loading market...'}
      </div>
    );
  }

  if (!market) {
    return (
      <div className={s.notFound}>
        <h2 className={s.notFoundTitle}>Market not found</h2>
        <p className={s.notFoundText}>It may still be processing. Try refreshing in a few seconds.</p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 16 }}>
          <button className={s.retryBtn} onClick={refetch}>Refresh</button>
          <Link to="/markets" className={s.backBtn}>Back to Markets</Link>
        </div>
      </div>
    );
  }

  const sideAName = market.sideAName || 'Side A';
  const sideBName = market.sideBName || 'Side B';

  const handleShare = async () => {
    const url = `https://opick.io/market/${marketAddress}`;
    const text = `${market.topic} - ${sideAName} ${priceA.toFixed(1)}% vs ${sideBName} ${priceB.toFixed(1)}% | Pick a side on OPick`;
    if (navigator.share) {
      try { await navigator.share({ title: market.topic, text, url }); return; } catch {}
    }
    try { await navigator.clipboard.writeText(url); } catch {}
    setShareCopied(true);
    setTimeout(() => setShareCopied(false), 2000);
  };

  return (
    <div className={s.page}>
      <div className={s.layout}>
        {/* LEFT COLUMN */}
        <div className={s.left}>
          <Link to="/markets" className={s.backLink}>
            &larr; All markets
          </Link>
          <div className={s.titleRow}>
            <h1 className={s.title}>{market.topic}</h1>
            <button className={s.shareBtn} onClick={handleShare} title="Share this market">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8" /><polyline points="16 6 12 2 8 6" /><line x1="12" y1="2" x2="12" y2="15" />
              </svg>
              {shareCopied && <span className={s.shareToast}>Link copied!</span>}
            </button>
          </div>

          <div className={s.meta}>
            {market.category && (
              <span className={s.categoryPill}>{market.category}</span>
            )}
            <span className={s.metaItem}>
              Volume: <span>{'$'}{(() => { const v = chainVolume != null ? chainVolume : (market.totalVolume || 0); if (v === 0) return '0'; if (v < 1) return v.toFixed(2); if (v < 1000) return v.toFixed(2); return v.toLocaleString(undefined, {maximumFractionDigits: 0}); })()}</span>
            </span>
            {market.creator && (
              <span className={s.metaItem}>
                Creator: <span>{truncateAddress(market.creator)}</span>
              </span>
            )}
          </div>

          {/* Price bar */}
          <div className={s.priceBar}>
            <div className={`${s.priceBox} ${priceFlash === 'up' ? s.flashGreen : priceFlash === 'down' ? s.flashRed : ''}`}>
              <div className={s.priceLabel}>{sideAName}</div>
              <div className={s.priceValueGreen}>{priceA.toFixed(2)}%</div>
              <div className={s.priceSide}>{"$"}{((priceA / 100).toFixed(4))} per share</div>
            </div>
            <div className={`${s.priceBox} ${priceFlash === 'down' ? s.flashGreen : priceFlash === 'up' ? s.flashRed : ''}`}>
              <div className={s.priceLabel}>{sideBName}</div>
              <div className={s.priceValueRed}>{priceB.toFixed(2)}%</div>
              <div className={s.priceSide}>{"$"}{((priceB / 100).toFixed(4))} per share</div>
            </div>
          </div>

          {/* Chart */}
          <div className={s.chartSection}>
            <div className={s.chartHeader}>
              <span className={s.chartTitle}>Price History</span>
              <span className={s.chartLegend}>
                <span className={s.legendDotA} /> {sideAName}
                <span className={s.legendDotB} /> {sideBName}
              </span>
            </div>
            <div className={s.chartArea}>
              {chartData.length < 2 ? (
                <div className={s.chartEmpty}>Waiting for trades...</div>
              ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                  <defs>
                    <linearGradient id="fillA" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#1a6b3c" stopOpacity={0.08} />
                      <stop offset="100%" stopColor="#1a6b3c" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="fillB" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#8b2500" stopOpacity={0.08} />
                      <stop offset="100%" stopColor="#8b2500" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E8E7E2" vertical={false} />
                  <ReferenceLine y={50} stroke="#D1D0CB" strokeDasharray="6 3" strokeWidth={1.5} label={{ value: '50%', position: 'insideTopRight', fontSize: 9, fill: '#9c9b96', offset: 4 }} />
                  <XAxis
                    dataKey="time"
                    tick={{ fontSize: 10, fill: '#9c9b96', fontFamily: 'DM Sans' }}
                    axisLine={false}
                    tickLine={false}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    domain={yDomain}
                    tick={{ fontSize: 10, fill: '#9c9b96', fontFamily: 'DM Sans' }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => `${Number(v).toFixed(1)}%`}
                    width={42}
                  />
                  <Tooltip
                    contentStyle={{
                      background: '#FAFAF7',
                      border: '0.5px solid #E8E7E2',
                      borderRadius: 4,
                      fontSize: 12,
                      fontFamily: 'DM Sans',
                      padding: '8px 12px',
                    }}
                    formatter={(value, name) => [
                      `${Number(value).toFixed(2)}%`,
                      name === 'sideA' ? sideAName : sideBName,
                    ]}
                    labelStyle={{ fontSize: 10, color: '#9c9b96', marginBottom: 4 }}
                  />
                  <Area type="monotone" dataKey="sideA" stroke="#1a6b3c" strokeWidth={2} fill="url(#fillA)" dot={false} />
                  <Area type="monotone" dataKey="sideB" stroke="#8b2500" strokeWidth={2} fill="url(#fillB)" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Recent Activity */}
          {trades.length > 0 && (
            <div className={s.activitySection}>
              <h3 className={s.activityTitle}>Recent Activity</h3>
              <div className={s.activityList}>
                {trades.slice(0, 8).map((t, i) => {
                  const name = t.side === 'A' ? sideAName : t.side === 'B' ? sideBName : (t.side || 'Trade');
                  const isA = t.side === 'A' || t.side === sideAName;
                  return (
                    <div key={i} className={s.activityItem}>
                      <span className={isA ? s.activitySideA : s.activitySideB}>{name}</span>
                      <span className={s.activityAmount}>+{'$'}{Number(t.amount).toFixed(2)}</span>
                      <span className={s.activityTime}>{timeAgo(t.timestamp)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

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
                    +{'$'}{v}
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
                <span className={s.infoValue}>{currentPrice.toFixed(2)}%</span>
              </div>
              {amountNum > 0 && (
                <>
                  <div className={s.infoSectionLabel}>If {selectedSide === 'A' ? sideAName : sideBName} reaches:</div>
                  {[55, 65, 80].map(target => {
                    // Simulate buyA/buyB to get shares, then simulate sell at target
                    const rA = Number(market.reserveA || 0);
                    const rB = Number(market.reserveB || 0);
                    const k = rA * rB;
                    const amt = amountNum * 1e6;
                    let shares;
                    if (selectedSide === 'A') {
                      const nr = rB + amt; shares = rA - k / nr;
                    } else {
                      const na = rA + amt; shares = rB - k / na;
                    }
                    const targetForSide = selectedSide === 'A' ? target : 100 - target;
                    const val = simulateValueAtPrice(shares, selectedSide, targetForSide, rA, rB);
                    const profit = val - amountNum;
                    return (
                      <div className={s.infoRow} key={target}>
                        <span className={s.infoLabel}>{target}%</span>
                        <span className={profit >= 0 ? s.infoValueGreen : s.infoValueRed}>
                          {profit >= 0 ? '+' : '-'}{'$'}{Math.abs(profit).toFixed(2)}
                        </span>
                      </div>
                    );
                  })}
                </>
              )}
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

            {/* Positions (both sides) */}
            {position && position.map((pos) => {
              const posName = pos.side === 'A' ? sideAName : sideBName;
              const pnl = pos.costBasis > 0 ? pos.currentValue - pos.costBasis : null;
              return (
                <div className={s.positionSection} key={pos.side}>
                  <div className={s.positionTitle}>{posName}</div>
                  <div className={s.positionRow}>
                    <span className={s.positionLabel}>Shares</span>
                    <span className={s.positionValue}>
                      {Number(formatUnits(pos.shares, 6)).toFixed(2)}
                    </span>
                  </div>
                  {pos.costBasis > 0 && (
                    <div className={s.positionRow}>
                      <span className={s.positionLabel}>Cost</span>
                      <span className={s.positionValue}>{'$'}{pos.costBasis.toFixed(2)}</span>
                    </div>
                  )}
                  <div className={s.positionRow}>
                    <span className={s.positionLabel}>Sell value</span>
                    <span className={s.positionValue}>{'$'}{pos.currentValue.toFixed(2)}</span>
                  </div>
                  {pnl != null && (
                    <div className={s.positionRow}>
                      <span className={s.positionLabel}>P&L</span>
                      <span className={pnl >= 0 ? s.positionValueGreen : s.positionValueRed}>
                        {pnl >= 0 ? '+' : '-'}{'$'}{Math.abs(pnl).toFixed(2)}
                      </span>
                    </div>
                  )}
                  <div className={s.positionScenarios}>
                    <div className={s.infoSectionLabel}>If {posName} reaches:</div>
                    {[55, 65, 80].map(target => {
                      const targetForSide = pos.side === 'A' ? target : 100 - target;
                      const val = simulateValueAtPrice(pos.shares, pos.side, targetForSide, market.reserveA, market.reserveB);
                      const cost = pos.costBasis > 0 ? pos.costBasis : pos.currentValue;
                      const profit = val - cost;
                      return (
                        <div className={s.infoRow} key={target}>
                          <span className={s.infoLabel}>{target}%</span>
                          <span className={profit >= 0 ? s.infoValueGreen : s.infoValueRed}>
                            {profit >= 0 ? '+' : '-'}{'$'}{Math.abs(profit).toFixed(2)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  <button
                    className={s.sellBtn}
                    onClick={() => handleSell(pos)}
                    disabled={sellLoading}
                  >
                    {sellLoading ? 'Selling...' : `Sell ${posName}`}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
