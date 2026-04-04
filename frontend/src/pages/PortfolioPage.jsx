import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useContracts } from '../hooks/useContracts';
import { useMarkets } from '../hooks/useMarkets';
import styles from './PortfolioPage.module.css';

export default function PortfolioPage({ account, provider, signer, onConnect, authenticated, walletReady }) {
  const { getMarket } = useContracts(signer || provider);
  const { markets, loading: marketsLoading } = useMarkets();

  const [positions, setPositions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sellingId, setSellingId] = useState(null);

  const fetchPositions = useCallback(async () => {
    // Need a valid eth address and a signer-backed contract
    if (!account || !account.startsWith('0x') || !markets.length || !getMarket) {
      setPositions([]);
      setLoading(false);
      return;
    }
    setLoading(true);

    try {
      const results = [];

      for (const m of markets) {
        try {
          const contract = getMarket(m.address);
          if (!contract) continue;

          const [sharesA, sharesB] = await Promise.all([
            contract.sharesA(account),
            contract.sharesB(account),
          ]);

          // BigInt comparison — both must be > 0n to count
          const hasA = sharesA > 0n;
          const hasB = sharesB > 0n;

          if (hasA || hasB) {
            const [reserveA, reserveB] = await Promise.all([
              contract.reserveA(),
              contract.reserveB(),
            ]);
            const totalReserves = Number(reserveA) + Number(reserveB);
            const priceA = totalReserves > 0 ? Number(reserveB) / totalReserves : 0.5;
            const priceB = totalReserves > 0 ? Number(reserveA) / totalReserves : 0.5;

            results.push({
              address: m.address,
              topic: m.topic || 'Untitled Market',
              choiceA: m.sideAName || 'Side A',
              choiceB: m.sideBName || 'Side B',
              sharesA: hasA ? Number(sharesA) : 0,
              sharesB: hasB ? Number(sharesB) : 0,
              valueA: hasA ? (Number(sharesA) * priceA) / 1e6 : 0,
              valueB: hasB ? (Number(sharesB) * priceB) / 1e6 : 0,
              priceA,
              priceB,
            });
          }
        } catch {
          // Skip markets that fail to read — don't add them
        }
      }

      setPositions(results);
    } catch {
      setPositions([]);
    } finally {
      setLoading(false);
    }
  }, [account, markets, getMarket]);

  useEffect(() => {
    if (account && markets.length) {
      fetchPositions();
    } else if (!account) {
      setLoading(false);
    }
  }, [account, markets, fetchPositions]);

  const handleSell = async (position, side) => {
    const key = `${position.address}-${side}`;
    setSellingId(key);

    try {
      const contract = getMarket(position.address);
      if (!contract) return;

      const shares = side === 'A' ? position.sharesA : position.sharesB;
      const tx = side === 'A'
        ? await contract.sellA(shares)
        : await contract.sellB(shares);

      await tx.wait();
      await fetchPositions();
    } catch (err) {
      console.error('Sell failed:', err);
      alert('Transaction failed: ' + (err.reason || err.message));
    } finally {
      setSellingId(null);
    }
  };

  const totalValue = positions.reduce((sum, p) => sum + p.valueA + p.valueB, 0);

  if (!authenticated) {
    return (
      <div className={styles.page}>
        <h1 className={styles.title}>Your Picks</h1>
        <div className={styles.notConnected}>
          <p className={styles.notConnectedText}>Sign in to see your picks</p>
          <button className={styles.connectBtn} onClick={onConnect}>
            Sign In
          </button>
        </div>
      </div>
    );
  }

  if (authenticated && !account) {
    return (
      <div className={styles.page}>
        <h1 className={styles.title}>Your Picks</h1>
        <div className={styles.loading}>
          <p>Loading your account...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Your Picks</h1>

      {/* Summary */}
      <div className={styles.summary}>
        <div className={styles.statCard}>
          <p className={styles.statLabel}>Total Invested</p>
          <p className={styles.statValue}>${totalValue.toFixed(2)}</p>
        </div>
        <div className={styles.statCard}>
          <p className={styles.statLabel}>Current Value</p>
          <p className={styles.statValue}>${totalValue.toFixed(2)}</p>
        </div>
        <div className={styles.statCard}>
          <p className={styles.statLabel}>P&L</p>
          <p className={totalValue >= 0 ? styles.statValueGreen : styles.statValueRed}>
            ${totalValue >= 0 ? '+' : ''}{(0).toFixed(2)}
          </p>
        </div>
      </div>

      {/* Loading */}
      {(loading || marketsLoading) && (
        <div className={styles.loading}>
          <div className={styles.spinner} />
          <p>Loading picks...</p>
        </div>
      )}

      {/* Empty state */}
      {!loading && !marketsLoading && positions.length === 0 && (
        <div className={styles.empty}>
          <p className={styles.emptyText}>No picks yet</p>
          <p className={styles.emptySubtext}>Browse markets and pick a side to get started.</p>
        </div>
      )}

      {/* Positions */}
      {!loading && positions.length > 0 && (
        <>
          <div className={styles.headerRow}>
            <span className={styles.headerLabel}>Market</span>
            <span className={styles.headerLabel}>Side</span>
            <span className={styles.headerLabel}>Shares</span>
            <span className={styles.headerLabel}>Value</span>
            <span className={styles.headerLabel}>Price</span>
            <span className={styles.headerLabel}></span>
          </div>
          <div className={styles.positionsList}>
            {positions.map((p) => (
              <div key={p.address}>
                {p.sharesA > 0 && (
                  <div className={styles.positionCard}>
                    <div>
                      <Link to={`/market/${p.address}`} className={styles.marketLink}>
                        {p.topic}
                      </Link>
                    </div>
                    <div>
                      <span className={styles.pillA}>{p.choiceA}</span>
                    </div>
                    <div>
                      <p className={styles.fieldLabel}>Shares</p>
                      <p className={styles.fieldValue}>
                        {(p.sharesA / 1e6).toFixed(2)}
                      </p>
                    </div>
                    <div>
                      <p className={styles.fieldLabel}>Value</p>
                      <p className={styles.fieldValue}>
                        ${p.valueA.toFixed(2)}
                      </p>
                    </div>
                    <div>
                      <p className={styles.fieldLabel}>Price</p>
                      <p className={styles.fieldValue}>
                        ${p.priceA.toFixed(4)}
                      </p>
                    </div>
                    <div>
                      <button
                        className={styles.sellBtn}
                        disabled={sellingId === `${p.address}-A`}
                        onClick={() => handleSell(p, 'A')}
                      >
                        {sellingId === `${p.address}-A` ? 'Selling...' : 'Sell All'}
                      </button>
                    </div>
                  </div>
                )}
                {p.sharesB > 0 && (
                  <div className={styles.positionCard}>
                    <div>
                      <Link to={`/market/${p.address}`} className={styles.marketLink}>
                        {p.topic}
                      </Link>
                    </div>
                    <div>
                      <span className={styles.pillB}>{p.choiceB}</span>
                    </div>
                    <div>
                      <p className={styles.fieldLabel}>Shares</p>
                      <p className={styles.fieldValue}>
                        {(p.sharesB / 1e6).toFixed(2)}
                      </p>
                    </div>
                    <div>
                      <p className={styles.fieldLabel}>Value</p>
                      <p className={styles.fieldValue}>
                        ${p.valueB.toFixed(2)}
                      </p>
                    </div>
                    <div>
                      <p className={styles.fieldLabel}>Price</p>
                      <p className={styles.fieldValue}>
                        ${p.priceB.toFixed(4)}
                      </p>
                    </div>
                    <div>
                      <button
                        className={styles.sellBtn}
                        disabled={sellingId === `${p.address}-B`}
                        onClick={() => handleSell(p, 'B')}
                      >
                        {sellingId === `${p.address}-B` ? 'Selling...' : 'Sell All'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
