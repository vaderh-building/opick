import { useState, useEffect } from 'react';
import { Contract, formatUnits } from 'ethers';
import { USDC_ADDRESS } from '../config.js';
import MockUSDCAbi from '../abi/MockUSDC.json';
import styles from './AccountPage.module.css';

export default function AccountPage({ account, provider, signer, onConnect, authenticated, walletReady, displayName }) {
  const [balance, setBalance] = useState(null);
  const [claiming, setClaiming] = useState(false);
  const [claimed, setClaimed] = useState(false);

  useEffect(() => {
    if (!provider || !account || !account.startsWith('0x')) return;
    (async () => {
      try {
        const usdc = new Contract(USDC_ADDRESS, MockUSDCAbi, provider);
        const bal = await usdc.balanceOf(account);
        setBalance(bal);
      } catch {}
    })();
  }, [provider, account, claimed]);

  const handleFaucet = async () => {
    if (!signer || claiming) return;
    setClaiming(true);
    setClaimed(false);
    try {
      const usdc = new Contract(USDC_ADDRESS, MockUSDCAbi, signer);
      const tx = await usdc.faucet();
      await tx.wait();
      setClaimed(true);
      // Refresh balance
      const bal = await usdc.balanceOf(account);
      setBalance(bal);
    } catch (e) {
      console.error('Faucet failed:', e);
    } finally {
      setClaiming(false);
    }
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

  const formattedBalance = balance != null ? formatUnits(balance, 6) : '—';

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Account</h1>

      <div className={styles.card}>
        {displayName && (
          <div className={styles.row}>
            <span className={styles.label}>Signed in as</span>
            <span className={styles.value}>{displayName}</span>
          </div>
        )}
        {account && (
          <div className={styles.row}>
            <span className={styles.label}>Wallet</span>
            <span className={styles.mono}>{account}</span>
          </div>
        )}
        <div className={styles.row}>
          <span className={styles.label}>USDC Balance</span>
          <span className={styles.mono}>${Number(formattedBalance).toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
        </div>
      </div>

      <div className={styles.faucetSection}>
        <h2 className={styles.subtitle}>Get testnet USDC</h2>
        <p className={styles.muted}>Claim 10,000 free USDC to start picking sides. This is Base Sepolia testnet — tokens have no real value.</p>
        {claimed && <p className={styles.success}>10,000 USDC claimed!</p>}
        <button
          className={styles.primaryBtn}
          onClick={handleFaucet}
          disabled={claiming || !walletReady}
        >
          {claiming ? 'Claiming...' : 'Get 10,000 USDC'}
        </button>
      </div>
    </div>
  );
}
