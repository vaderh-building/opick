import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import { BrowserProvider, JsonRpcProvider, Wallet } from 'ethers';
import { RPC_URL } from '../config.js';

const HARDHAT_PRIVATE_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
const IS_DEV = import.meta.env.VITE_DEV_MODE === 'true' ||
  (typeof window !== 'undefined' && window.location.hostname === 'localhost');

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

  // Privy wallet state
  const [privySigner, setPrivySigner] = useState(null);
  const [privyAccount, setPrivyAccount] = useState(null);
  const [walletReady, setWalletReady] = useState(false);
  const setupAttempted = useRef(false);

  // Core effect: when authenticated + wallets available, get signer
  useEffect(() => {
    if (localMode || !ready || !authenticated) {
      if (!localMode && !authenticated) {
        setPrivySigner(null);
        setPrivyAccount(null);
        setWalletReady(false);
      }
      return;
    }

    // Extract address from any available source
    let addr = null;
    if (user?.wallet?.address) addr = user.wallet.address;
    if (!addr && user?.linkedAccounts) {
      const wa = user.linkedAccounts.find(a => a.type === 'wallet');
      if (wa?.address) addr = wa.address;
    }
    if (!addr && wallets.length > 0) addr = wallets[0].address;

    if (addr && !privyAccount) {
      setPrivyAccount(addr);
    }

    // Setup signer from first available wallet
    if (!wallets.length) return;
    const wallet = wallets[0];
    if (wallet.address && !privyAccount) setPrivyAccount(wallet.address);

    let cancelled = false;

    (async () => {
      try {
        const ethProvider = await wallet.getEthereumProvider();
        if (cancelled) return;
        const bp = new BrowserProvider(ethProvider);
        const s = await bp.getSigner();
        const signerAddr = await s.getAddress();
        if (cancelled) return;
        setPrivySigner(s);
        setPrivyAccount(signerAddr);
        setWalletReady(true);
      } catch (e) {
        console.error('Wallet setup failed:', e.message);
        if (!cancelled) {
          setPrivyAccount(wallet.address || addr);
          setWalletReady(false);
        }
      }
    })();

    return () => { cancelled = true; };
  }, [authenticated, ready, wallets, localMode, user]);

  // Unified interface
  const account = localMode ? localAccount : privyAccount;
  const signer = localMode ? localSigner : privySigner;
  const provider = rpcProvider; // Always use RPC for reads
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
    ready: ready,
    authenticated: localMode || authenticated,
    walletReady: isReady,
  };
}
