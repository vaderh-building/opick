import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Contract, formatUnits } from 'ethers';
import { useFundWallet } from '@privy-io/react-auth';
import { base } from 'viem/chains';
import { USDC_ADDRESS, FACTORY_ADDRESS } from '../config.js';
import USDCAbi from '../abi/MockUSDC.json';
import OPickFactoryAbi from '../abi/OPickFactory.json';
import OPickMarketAbi from '../abi/OPickMarket.json';
import { useMarkets } from '../hooks/useMarkets.js';
import styles from './AccountPage.module.css';

function truncAddr(a) { return a ? `${a.slice(0, 6)}...${a.slice(-4)}` : ''; }

export default function AccountPage({ account, provider, signer, onConnect, authenticated, walletReady, displayName }) {
  const [balance, setBalance] = useState(null);
  const [positions, setPositions] = useState([]);
  const [posLoading, setPosLoading] = useState(false);
  const [sellingId, setSellingId] = useState(null);
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState('active');
  const { fundWallet } = useFundWallet();
  const { markets } = useMarkets();

  const refreshBalance = useCallback(async () => {
    if (!provider || !account || !account.startsWith('0x')) return;
    try {
      const usdc = new Contract(USDC_ADDRESS, USDCAbi, provider);
      setBalance(await usdc.balanceOf(account));
    } catch {}
  }, [provider, account]);

  useEffect(() => { refreshBalance(); }, [refreshBalance]);

  // Fetch positions
  const fetchPositions = useCallback(async () => {
    if (!account || !account.startsWith('0x') || !provider) return;
    setPosLoading(true);
    try {
      let marketList = markets;
      if (!marketList.length && FACTORY_ADDRESS && provider) {
        try {
          const factory = new Contract(FACTORY_ADDRESS, OPickFactoryAbi, provider);
          const total = Number(await factory.totalMarkets());
          if (total > 0) {
            const addrs = await factory.getMarkets(0, total);
            marketList = Array.from(addrs).map(a => ({ address: a }));
          }
        } catch {}
      }

      const results = [];
      const rpc = signer || provider;
      for (const m of marketList) {
        try {
          const c = new Contract(m.address, OPickMarketAbi, rpc);
          const sharesA = await c.sharesA(account);
          const sharesB = await c.sharesB(account);
          if (sharesA > 0n || sharesB > 0n) {
            const topic = m.topic || await c.topic();
            const sideAName = m.sideAName || await c.sideAName();
            const sideBName = m.sideBName || await c.sideBName();
            const [reserveA, reserveB, k] = await Promise.all([c.reserveA(), c.reserveB(), c.k()]);
            const side = sharesA > 0n ? 'A' : 'B';
            const shares = side === 'A' ? sharesA : sharesB;
            // Simulate sell
            let gross;
            if (side === 'A') { gross = reserveB - k / (reserveA + shares); }
            else { gross = reserveA - k / (reserveB + shares); }
            const sellValue = Number(gross) * 0.99 / 1e6;
            // Try both original and lowercase keys for cost basis
            const costKey = `opick_cost_${m.address}_${account}`;
            const costKeyLower = `opick_cost_${m.address.toLowerCase()}_${account.toLowerCase()}`;
            const costBasis = parseFloat(localStorage.getItem(costKey) || localStorage.getItem(costKeyLower) || '0');
            results.push({
              address: m.address, topic, sideAName, sideBName,
              side, shares, sellValue, costBasis,
              sideName: side === 'A' ? sideAName : sideBName,
            });
          }
        } catch {}
      }
      setPositions(results);
    } catch { setPositions([]); }
    finally { setPosLoading(false); }
  }, [account, markets, provider, signer]);

  useEffect(() => {
    if (account && provider) fetchPositions();
    else { setPosLoading(false); setPositions([]); }
  }, [account, provider, fetchPositions]);

  const handleSell = async (pos) => {
    if (!signer) return;
    setSellingId(pos.address);
    try {
      const c = new Contract(pos.address, OPickMarketAbi, signer);
      const tx = pos.side === 'A' ? await c.sellA(pos.shares) : await c.sellB(pos.shares);
      await tx.wait();
      await fetchPositions();
      refreshBalance();
    } catch {}
    finally { setSellingId(null); }
  };

  const handleFund = async () => {
    if (!account) return;
    try {
      await fundWallet({ address: account, options: { chain: base, asset: 'USDC' } });
      setTimeout(refreshBalance, 3000);
    } catch {}
  };

  const handleCopy = () => {
    if (!account) return;
    navigator.clipboard.writeText(account).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  if (!authenticated) {
    return (
      <div className={styles.page}>
        <h1 className={styles.title}>Account</h1>
        <div className={styles.center}>
          <p className={styles.muted}>Sign in to view your account.</p>
          <button className={styles.primaryBtn} onClick={onConnect}>Sign In</button>
        </div>
      </div>
    );
  }

  const balNum = balance != null ? Number(formatUnits(balance, 6)) : null;
  const balStr = balNum != null ? `$${balNum.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : '...';
  const totalValue = positions.reduce((s, p) => s + p.sellValue, 0);
  const marketsJoined = positions.length;

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Account</h1>

      {/* Profile card */}
      <div className={styles.profileCard}>
        <div className={styles.profileTop}>
          <div>
            {displayName && <p className={styles.displayName}>{displayName}</p>}
            {account && (
              <div className={styles.addrRow}>
                <span className={styles.addr}>{truncAddr(account)}</span>
                <button className={styles.copyBtn} onClick={handleCopy}>{copied ? 'Copied' : 'Copy'}</button>
              </div>
            )}
          </div>
          <div className={styles.balBlock}>
            <span className={styles.balLabel}>USDC Balance</span>
            <span className={styles.balValue}>{balStr}</span>
            <button className={styles.addBtn} onClick={handleFund}>Add USDC</button>
          </div>
        </div>

        <div className={styles.stats}>
          <div className={styles.stat}>
            <span className={styles.statLabel}>Positions Value</span>
            <span className={styles.statValue}>${totalValue.toFixed(2)}</span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statLabel}>Markets Joined</span>
            <span className={styles.statValue}>{marketsJoined}</span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statLabel}>Positions</span>
            <span className={styles.statValue}>{positions.length}</span>
          </div>
        </div>
      </div>

      {/* Positions */}
      <div className={styles.tabBar}>
        <button className={activeTab === 'active' ? styles.tabActive : styles.tab} onClick={() => setActiveTab('active')}>Active</button>
        <button className={activeTab === 'closed' ? styles.tabActive : styles.tab} onClick={() => setActiveTab('closed')}>Closed</button>
      </div>

      {activeTab === 'active' && (
        <>
          {posLoading && <p className={styles.loadingText}>Checking positions...</p>}

          {!posLoading && positions.length === 0 && (
            <div className={styles.empty}>
              <p className={styles.emptyText}>No active positions</p>
              <p className={styles.emptySubtext}>Browse markets and pick a side to get started.</p>
              <Link to="/markets" className={styles.browseLink}>Browse Markets</Link>
            </div>
          )}

          {!posLoading && positions.length > 0 && (
            <div className={styles.positionList}>
              {positions.map((p) => {
                const hasCost = p.costBasis > 0;
                const pnl = hasCost ? p.sellValue - p.costBasis : null;
                return (
                  <div key={p.address} className={styles.posRow}>
                    <div className={styles.posInfo}>
                      <Link to={`/market/${p.address}`} className={styles.posMarket}>{p.topic}</Link>
                      <span className={p.side === 'A' ? styles.badgeA : styles.badgeB}>{p.sideName}</span>
                    </div>
                    <div className={styles.posNumbers}>
                      <div className={styles.posCol}>
                        <span className={styles.posLabel}>Shares</span>
                        <span className={styles.posVal}>{(Number(p.shares) / 1e6).toFixed(2)}</span>
                      </div>
                      <div className={styles.posCol}>
                        <span className={styles.posLabel}>Value</span>
                        <span className={styles.posVal}>${p.sellValue.toFixed(2)}</span>
                      </div>
                      <div className={styles.posCol}>
                        <span className={styles.posLabel}>P&L</span>
                        {pnl != null ? (
                          <span className={pnl >= 0 ? styles.posValGreen : styles.posValRed}>
                            {pnl >= 0 ? '+' : '-'}${Math.abs(pnl).toFixed(2)}
                          </span>
                        ) : (
                          <span className={styles.posVal}>--</span>
                        )}
                      </div>
                      <button
                        className={styles.sellBtn}
                        onClick={() => handleSell(p)}
                        disabled={sellingId === p.address}
                      >
                        {sellingId === p.address ? 'Selling...' : 'Sell'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {activeTab === 'closed' && (
        <div className={styles.empty}>
          <p className={styles.emptyText}>No closed positions</p>
        </div>
      )}
    </div>
  );
}
