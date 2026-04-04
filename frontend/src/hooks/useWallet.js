import { useState, useEffect, useCallback, useMemo } from 'react';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import { BrowserProvider, JsonRpcProvider, Wallet } from 'ethers';
import { RPC_URL } from '../config.js';

const HARDHAT_PRIVATE_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
const IS_DEV = import.meta.env.VITE_DEV_MODE === 'true' ||
  (typeof window !== 'undefined' && window.location.hostname === 'localhost');
const BASE_SEPOLIA_CHAIN_ID = 84532;

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

export function useWallet() {
  const { ready, authenticated, user, login: privyLogin, logout: privyLogout } = usePrivy();
  const { wallets } = useWallets();

  // Local dev mode
  const [localMode, setLocalMode] = useState(
    IS_DEV && localStorage.getItem('opick_connect_method') === 'local'
  );
  const [localSigner, setLocalSigner] = useState(null);
  const [localAccount, setLocalAccount] = useState(
    localMode ? localStorage.getItem('opick_account') : null
  );

  const rpcProvider = useMemo(() => new JsonRpcProvider(RPC_URL), []);

  useEffect(() => {
    if (localMode && IS_DEV) {
      const w = new Wallet(HARDHAT_PRIVATE_KEY, rpcProvider);
      setLocalSigner(w);
      setLocalAccount(w.address);
    }
  }, [localMode, rpcProvider]);

  // Privy state
  const [privySigner, setPrivySigner] = useState(null);
  const [privyAccount, setPrivyAccount] = useState(null);
  const [walletReady, setWalletReady] = useState(false);

  useEffect(() => {
    if (localMode || !ready || !authenticated) {
      if (!localMode && !authenticated) {
        setPrivySigner(null);
        setPrivyAccount(null);
        setWalletReady(false);
      }
      return;
    }

    // Get address from user object immediately for display
    let userAddr = user?.wallet?.address || null;
    if (!userAddr && user?.linkedAccounts) {
      const wa = user.linkedAccounts.find(a => a.type === 'wallet');
      if (wa?.address) userAddr = wa.address;
    }
    if (userAddr) setPrivyAccount(userAddr);

    console.log('Auth state:', authenticated, 'Wallets:', wallets?.length,
      wallets?.map(w => `${w.walletClientType}:${w.address?.slice(0,8)}`));

    if (!wallets.length) return;

    // Prefer embedded (privy) wallet, fall back to first
    const wallet = wallets.find(w => w.walletClientType === 'privy') || wallets[0];
    if (wallet.address) setPrivyAccount(wallet.address);

    let cancelled = false;

    (async () => {
      try {
        // Switch to Base Sepolia
        try {
          console.log('Switching chain to', BASE_SEPOLIA_CHAIN_ID);
          await wallet.switchChain(BASE_SEPOLIA_CHAIN_ID);
        } catch (e) {
          console.warn('Chain switch failed (may already be on correct chain):', e.message);
        }

        console.log('Getting ethereum provider...');
        const ethProvider = await wallet.getEthereumProvider();
        if (cancelled) return;

        console.log('Creating BrowserProvider + signer...');
        const bp = new BrowserProvider(ethProvider);
        const s = await bp.getSigner();
        const addr = await s.getAddress();
        if (cancelled) return;

        console.log('Wallet ready:', addr);
        setPrivySigner(s);
        setPrivyAccount(addr);
        setWalletReady(true);
      } catch (e) {
        console.error('Wallet setup failed:', e.message);
        if (!cancelled) setWalletReady(false);
      }
    })();

    return () => { cancelled = true; };
  }, [authenticated, ready, wallets, localMode, user]);

  // Retry: if authenticated but wallets empty, poll for up to 10s
  useEffect(() => {
    if (localMode || !authenticated || !ready || wallets.length > 0 || walletReady) return;

    let cancelled = false;
    (async () => {
      console.log('Waiting for embedded wallet to provision...');
      for (let i = 0; i < 5; i++) {
        await sleep(2000);
        if (cancelled || wallets.length > 0) return;
        console.log(`  Retry ${i + 1}/5, wallets:`, wallets.length);
      }
      console.log('Embedded wallet not provisioned after 10s');
    })();

    return () => { cancelled = true; };
  }, [authenticated, ready, wallets, localMode, walletReady]);

  const account = localMode ? localAccount : privyAccount;
  const signer = localMode ? localSigner : privySigner;
  const provider = rpcProvider;
  const isReady = localMode ? !!localSigner : walletReady;

  const connect = useCallback(() => {
    if (authenticated) return;
    privyLogin();
  }, [authenticated, privyLogin]);

  const connectLocal = useCallback(async () => {
    if (!IS_DEV) return null;
    const w = new Wallet(HARDHAT_PRIVATE_KEY, rpcProvider);
    setLocalMode(true);
    setLocalSigner(w);
    setLocalAccount(w.address);
    localStorage.setItem('opick_account', w.address);
    localStorage.setItem('opick_connect_method', 'local');
    return w.address;
  }, [rpcProvider]);

  const disconnect = useCallback(async () => {
    if (localMode) {
      setLocalMode(false);
      setLocalSigner(null);
      setLocalAccount(null);
      localStorage.removeItem('opick_account');
      localStorage.removeItem('opick_connect_method');
    } else if (authenticated) {
      setPrivySigner(null);
      setPrivyAccount(null);
      setWalletReady(false);
      await privyLogout();
    }
  }, [localMode, authenticated, privyLogout]);

  return {
    account,
    provider,
    signer,
    connect,
    connectLocal: IS_DEV ? connectLocal : null,
    disconnect,
    ready,
    authenticated: localMode || authenticated,
    walletReady: isReady,
    user,
  };
}
