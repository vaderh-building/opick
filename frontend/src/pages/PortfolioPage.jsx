import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Contract } from 'ethers';
import { useContracts } from '../hooks/useContracts';
import { useMarkets } from '../hooks/useMarkets';
import { FACTORY_ADDRESS } from '../config.js';
import OPickFactoryAbi from '../abi/OPickFactory.json';
import OPickMarketAbi from '../abi/OPickMarket.json';
import styles from './PortfolioPage.module.css';

export default function PortfolioPage({ account, provider, signer, onConnect, authenticated, walletReady }) {
  const { getMarket } = useContracts(signer || provider);
  const { markets } = useMarkets();

  const [positions, setPositions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sellingId, setSellingId] = useState(null);

  const fetchPositions = useCallback(async () => {
    if (!account || !account.startsWith('0x') || !provider) {
      setPositions([]);
      return;
    }
    setLoading(true);

    try {
      console.log('Opinions: checking positions for', account);

      // Get market addresses: prefer backend cache, fallback to on-chain
      let marketList = markets;
      if (!marketList.length && FACTORY_ADDRESS && provider) {
        try {
          const factory = new Contract(FACTORY_ADDRESS, OPickFactoryAbi, provider);
          const total = Number(await factory.totalMarkets());
          console.log('Opinions: factory reports', total, 'markets (on-chain fallback)');
          if (total > 0) {
            const addrs = await factory.getMarkets(0, total);
            marketList = Array.from(addrs).map(a => ({ address: a }));
          }
        } catch (e) {
          console.error('Opinions: factory query failed:', e.message);
        }
      } else {
        console.log('Opinions: using', marketList.length, 'markets from backend cache');
      }

      if (!marketList.length) {
        setPositions([]);
        setLoading(false);
        return;
      }

      const results = [];
      for (const m of marketList) {
        try {
          const contract = new Contract(m.address, OPickMarketAbi, provider);
          const sharesA = await contract.sharesA(account);
          const sharesB = await contract.sharesB(account);
          console.log('Opinions:', m.address.slice(0, 10), 'sharesA=', sharesA.toString(), 'sharesB=', sharesB.toString());

          if (sharesA > 0n || sharesB > 0n) {
            const [topic, sideAName, sideBName, reserveA, reserveB] = await Promise.all([
              m.topic ? Promise.resolve(m.topic) : contract.topic(),
              m.sideAName ? Promise.resolve(m.sideAName) : contract.sideAName(),
              m.sideBName ? Promise.resolve(m.sideBName) : contract.sideBName(),
              contract.reserveA(),
              contract.reserveB(),
            ]);

            const totalReserves = Number(reserveA) + Number(reserveB);
            const priceA = totalReserves > 0 ? Number(reserveB) / totalReserves : 0.5;
            const priceB = totalReserves > 0 ? Number(reserveA) / totalReserves : 0.5;

            results.push({
              address: m.address,
              topic: topic || 'Untitled',
              choiceA: sideAName || 'Side A',
              choiceB: sideBName || 'Side B',
              sharesA: sharesA > 0n ? Number(sharesA) : 0,
              sharesB: sharesB > 0n ? Number(sharesB) : 0,
              valueA: sharesA > 0n ? (Number(sharesA) * priceA) / 1e6 : 0,
              valueB: sharesB > 0n ? (Number(sharesB) * priceB) / 1e6 : 0,
              priceA,
              priceB,
            });
          }
        } catch (e) {
          console.error('Opinions: failed reading', m.address?.slice(0, 10), e.message?.slice(0, 80));
        }
      }

      console.log('Opinions: found', results.length, 'positions');
      setPositions(results);
    } catch (e) {
      console.error('Opinions: fetchPositions failed:', e.message);
      setPositions([]);
    } finally {
      setLoading(false);
    }
  }, [account, markets, provider]);

  useEffect(() => {
    if (account && provider) {
      fetchPositions();
    } else {
      setLoading(false);
      setPositions([]);
    }
  }, [account, provider, fetchPositions]);

  const handleSell = async (position, side) => {
    if (!signer) return;
    const key = `${position.address}-${side}`;
    setSellingId(key);

    try {
      const contract = new Contract(position.address, OPickMarketAbi, signer);
      const shares = side === 'A' ? position.sharesA : position.sharesB;
      const tx = side === 'A'
        ? await contract.sellA(shares)
        : await contract.sellB(shares);
      await tx.wait();
      await fetchPositions();
    } catch (err) {
      console.error('Sell failed:', err);
    } finally {
      setSellingId(null);
    }
  };

  const totalValue = positions.reduce((sum, p) => sum + p.valueA + p.valueB, 0);

  if (!authenticated) {
    return (
      <div className={styles.page}>
        <h1 className={styles.title}>Your <em>Opinions</em></h1>
        <div className={styles.notConnected}>
          <p className={styles.notConnectedText}>Sign in to see your opinions</p>
          <button className={styles.connectBtn} onClick={onConnect}>Sign In</button>
        </div>
      </div>
    );
  }

  if (authenticated && !account) {
    return (
      <div className={styles.page}>
        <h1 className={styles.title}>Your <em>Opinions</em></h1>
        <div className={styles.loading}><p>Loading your account...</p></div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Your <em>Opinions</em></h1>

      {loading && (
        <div className={styles.loading}>
          <div className={styles.spinner} />
          <p>Checking positions...</p>
        </div>
      )}

      {!loading && positions.length === 0 && (
        <div className={styles.empty}>
          <p className={styles.emptyText}>No opinions yet</p>
          <p className={styles.emptySubtext}>Browse markets to pick your first side.</p>
          <Link to="/markets" className={styles.browseLink}>Browse Markets</Link>
        </div>
      )}

      {!loading && positions.length > 0 && (
        <>
          <div className={styles.summary}>
            <div className={styles.statCard}>
              <p className={styles.statLabel}>Current Value</p>
              <p className={styles.statValue}>${totalValue.toFixed(2)}</p>
            </div>
          </div>

          <div className={styles.positionsList}>
            {positions.map((p) => (
              <div key={p.address} className={styles.positionCard}>
                <div className={styles.posCardTop}>
                  <Link to={`/market/${p.address}`} className={styles.marketLink}>{p.topic}</Link>
                </div>
                {p.sharesA > 0 && (
                  <div className={styles.posCardRow}>
                    <span className={styles.pillA}>{p.choiceA}</span>
                    <span className={styles.fieldValue}>{(p.sharesA / 1e6).toFixed(2)} shares</span>
                    <span className={styles.fieldValue}>${p.valueA.toFixed(2)}</span>
                    <button
                      className={styles.sellBtn}
                      disabled={sellingId === `${p.address}-A`}
                      onClick={() => handleSell(p, 'A')}
                    >
                      {sellingId === `${p.address}-A` ? 'Selling...' : 'Sell'}
                    </button>
                  </div>
                )}
                {p.sharesB > 0 && (
                  <div className={styles.posCardRow}>
                    <span className={styles.pillB}>{p.choiceB}</span>
                    <span className={styles.fieldValue}>{(p.sharesB / 1e6).toFixed(2)} shares</span>
                    <span className={styles.fieldValue}>${p.valueB.toFixed(2)}</span>
                    <button
                      className={styles.sellBtn}
                      disabled={sellingId === `${p.address}-B`}
                      onClick={() => handleSell(p, 'B')}
                    >
                      {sellingId === `${p.address}-B` ? 'Selling...' : 'Sell'}
                    </button>
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
