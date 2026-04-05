import { useState, useEffect } from 'react';
import { Contract, formatUnits } from 'ethers';
import { USDC_ADDRESS } from '../config.js';
import USDCAbi from '../abi/MockUSDC.json';
import styles from './AccountPage.module.css';

export default function AccountPage({ account, provider, signer, onConnect, authenticated, walletReady, displayName }) {
  const [balance, setBalance] = useState(null);

  useEffect(() => {
    if (!provider || !account || !account.startsWith('0x')) return;
    (async () => {
      try {
        const usdc = new Contract(USDC_ADDRESS, USDCAbi, provider);
        const bal = await usdc.balanceOf(account);
        setBalance(bal);
      } catch {}
    })();
  }, [provider, account]);

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

      <p className={styles.note}>OPick runs on Base. USDC is the US dollar stablecoin used for all trades.</p>
    </div>
  );
}
