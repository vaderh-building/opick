import { useState, useEffect, useCallback } from 'react';
import { Contract, formatUnits } from 'ethers';
import { useFundWallet } from '@privy-io/react-auth';
import { base } from 'viem/chains';
import { USDC_ADDRESS } from '../config.js';
import USDCAbi from '../abi/MockUSDC.json';
import styles from './AccountPage.module.css';

export default function AccountPage({ account, provider, signer, onConnect, authenticated, walletReady, displayName }) {
  const [balance, setBalance] = useState(null);
  const { fundWallet } = useFundWallet();

  const refreshBalance = useCallback(async () => {
    if (!provider || !account || !account.startsWith('0x')) return;
    try {
      const usdc = new Contract(USDC_ADDRESS, USDCAbi, provider);
      const bal = await usdc.balanceOf(account);
      setBalance(bal);
    } catch {}
  }, [provider, account]);

  useEffect(() => { refreshBalance(); }, [refreshBalance]);

  const handleFund = async () => {
    console.log('Add USDC clicked, account:', account, 'fundWallet:', typeof fundWallet);
    if (!account) { console.log('No account, aborting'); return; }
    try {
      console.log('Calling fundWallet...');
      await fundWallet({ address: account, options: { chain: base, asset: 'USDC' } });
      console.log('fundWallet completed');
      setTimeout(refreshBalance, 3000);
    } catch (e) {
      console.error('Fund wallet error:', e?.message || e);
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

  const balNum = balance != null ? Number(formatUnits(balance, 6)) : null;
  const balStr = balNum != null ? `$${balNum.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : '...';

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
          <div className={styles.balanceRow}>
            <span className={styles.mono}>{balStr}</span>
            {account && (
              <button className={styles.fundBtn} onClick={handleFund}>Add USDC</button>
            )}
          </div>
        </div>
      </div>

      <p className={styles.note}>OPick runs on Base. Add USDC to your wallet to start picking sides.</p>
    </div>
  );
}
