import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import { BrowserProvider, JsonRpcProvider, Wallet } from 'ethers';
import { RPC_URL } from '../config.js';

const HARDHAT_PRIVATE_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
const IS_DEV = import.meta.env.VITE_DEV_MODE === 'true' ||
  (typeof window !== 'undefined' && window.location.hostname === 'localhost');
const BASE_CHAIN_ID = 8453;

function getUserDisplay(user) {
  if (!user) return null;
  if (user.email?.address) return user.email.address;
  if (user.google?.email) return user.google.email;
  if (user.twitter?.username) return `@${user.twitter.username}`;
  return 'Logged in';
}

export function useWallet() {
  const { ready, authenticated, user, login: privyLogin, logout: privyLogout, createWallet } = usePrivy();
  const { wallets } = useWallets();

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

  const [privySigner, setPrivySigner] = useState(null);
  const [privyAccount, setPrivyAccount] = useState(null);
  const [walletReady, setWalletReady] = useState(false);
  const setupDone = useRef(false);
  const createAttempted = useRef(false);

  // Main wallet setup — runs once when authenticated + wallets available
  useEffect(() => {
    if (localMode || !ready) return;

    if (!authenticated) {
      setPrivySigner(null);
      setPrivyAccount(null);
      setWalletReady(false);
      setupDone.current = false;
      createAttempted.current = false;
      return;
    }

    if (setupDone.current) return;

    // Set display address from user object
    let userAddr = user?.wallet?.address || null;
    if (!userAddr && user?.linkedAccounts) {
      const wa = user.linkedAccounts.find(a => a.type === 'wallet');
      if (wa?.address) userAddr = wa.address;
    }
    if (userAddr && !privyAccount) setPrivyAccount(userAddr);

    if (!wallets.length) return;

    const wallet = wallets.find(w => w.walletClientType === 'privy') || wallets[0];
    if (wallet.address && !privyAccount) setPrivyAccount(wallet.address);

    let cancelled = false;
    setupDone.current = true; // Mark as attempted

    (async () => {
      try {
        try { await wallet.switchChain(BASE_CHAIN_ID); } catch {}
        const ethProvider = await wallet.getEthereumProvider();
        if (cancelled) return;
        const bp = new BrowserProvider(ethProvider);
        const s = await bp.getSigner();
        const addr = await s.getAddress();
        if (cancelled) return;
        setPrivySigner(s);
        setPrivyAccount(addr);
        setWalletReady(true);
      } catch {
        if (!cancelled) {
          setPrivyAccount(wallet.address || userAddr);
          setupDone.current = false; // Allow retry
        }
      }
    })();

    return () => { cancelled = true; };
  }, [authenticated, ready, wallets.length]); // Only re-run when wallets.length changes

  // Create embedded wallet if none exists after 3s
  useEffect(() => {
    if (localMode || !authenticated || !ready || wallets.length > 0 || createAttempted.current) return;

    const timer = setTimeout(async () => {
      if (wallets.length > 0) return;
      createAttempted.current = true;
      if (createWallet) {
        try { await createWallet(); } catch {}
      }
    }, 3000);

    return () => clearTimeout(timer);
  }, [authenticated, ready, wallets.length]);

  const account = localMode ? localAccount : privyAccount;
  const signer = localMode ? localSigner : privySigner;
  const provider = rpcProvider;
  const isReady = localMode ? !!localSigner : walletReady;
  const displayName = !localMode && authenticated && !account ? getUserDisplay(user) : null;

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
      setupDone.current = false;
      createAttempted.current = false;
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
    displayName,
    user,
  };
}
