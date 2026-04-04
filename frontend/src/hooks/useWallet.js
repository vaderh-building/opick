import { useState, useEffect, useCallback, useMemo } from 'react';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import { BrowserProvider, JsonRpcProvider, Wallet } from 'ethers';
import { RPC_URL } from '../config.js';

const HARDHAT_PRIVATE_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
const IS_DEV = import.meta.env.VITE_DEV_MODE === 'true' ||
  (typeof window !== 'undefined' && window.location.hostname === 'localhost');

// Extract wallet address from Privy user object
function getPrivyAddress(user) {
  if (!user) return null;
  // Try direct wallet
  if (user.wallet?.address) return user.wallet.address;
  // Try linked accounts
  const walletAccount = user.linkedAccounts?.find(a => a.type === 'wallet');
  if (walletAccount?.address) return walletAccount.address;
  return null;
}

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
  const [privyProvider, setPrivyProvider] = useState(null);
  const [privySigner, setPrivySigner] = useState(null);
  const [privyAccount, setPrivyAccount] = useState(null);

  // Detect auth state and set account immediately
  useEffect(() => {
    if (localMode) return;

    if (!ready || !authenticated) {
      setPrivyProvider(null);
      setPrivySigner(null);
      setPrivyAccount(null);
      return;
    }

    // Set address immediately from user object (before wallet SDK is ready)
    const addr = getPrivyAddress(user);
    if (addr) {
      setPrivyAccount(addr);
    }

    // If wallets array is populated, get ethers provider/signer
    if (!wallets.length) return;

    const wallet = wallets[0];
    let cancelled = false;

    // Set address from wallet object too
    if (wallet.address && !addr) {
      setPrivyAccount(wallet.address);
    }

    (async () => {
      try {
        const ethProvider = await wallet.getEthereumProvider();
        if (cancelled) return;
        const bp = new BrowserProvider(ethProvider);
        const s = await bp.getSigner();
        const signerAddr = await s.getAddress();
        if (cancelled) return;
        setPrivyProvider(bp);
        setPrivySigner(s);
        setPrivyAccount(signerAddr);
      } catch (e) {
        console.error('Failed to get Privy wallet provider:', e);
        if (!cancelled) {
          setPrivyAccount(wallet.address || addr || null);
        }
      }
    })();

    return () => { cancelled = true; };
  }, [authenticated, ready, wallets, localMode, user]);

  // Unified interface
  const account = localMode ? localAccount : privyAccount;
  const provider = localMode ? rpcProvider : (privyProvider || rpcProvider);
  const signer = localMode ? localSigner : privySigner;

  const connect = useCallback(() => {
    if (authenticated) return; // Already logged in
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
      setPrivyProvider(null);
      setPrivySigner(null);
      setPrivyAccount(null);
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
  };
}
