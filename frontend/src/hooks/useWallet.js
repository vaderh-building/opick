import { useState, useEffect, useCallback, useMemo } from 'react';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import { BrowserProvider, JsonRpcProvider, Wallet } from 'ethers';
import { RPC_URL } from '../config.js';

const HARDHAT_PRIVATE_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
const IS_DEV = import.meta.env.VITE_DEV_MODE === 'true' ||
  (typeof window !== 'undefined' && window.location.hostname === 'localhost');

export function useWallet() {
  const { ready, authenticated, user, login, logout: privyLogout } = usePrivy();
  const { wallets } = useWallets();

  // Local dev mode
  const [localMode, setLocalMode] = useState(
    IS_DEV && localStorage.getItem('opick_connect_method') === 'local'
  );
  const [localSigner, setLocalSigner] = useState(null);
  const [localAccount, setLocalAccount] = useState(
    localMode ? localStorage.getItem('opick_account') : null
  );

  // Read-only provider
  const rpcProvider = useMemo(() => new JsonRpcProvider(RPC_URL), []);

  // Local dev signer
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

  // When Privy authenticates and wallets become available, get ethers signer
  useEffect(() => {
    if (localMode || !authenticated || !ready) {
      if (!localMode) {
        setPrivyProvider(null);
        setPrivySigner(null);
        setPrivyAccount(null);
      }
      return;
    }

    // Privy may provide the user's address before the wallet object is ready
    // Use the user's wallet address immediately for display
    if (user?.wallet?.address) {
      setPrivyAccount(user.wallet.address);
    }

    // If wallets array is populated, get the ethers provider/signer
    if (!wallets.length) return;

    const wallet = wallets[0];
    let cancelled = false;

    (async () => {
      try {
        const ethProvider = await wallet.getEthereumProvider();
        if (cancelled) return;
        const bp = new BrowserProvider(ethProvider);
        const s = await bp.getSigner();
        const addr = await s.getAddress();
        if (cancelled) return;
        setPrivyProvider(bp);
        setPrivySigner(s);
        setPrivyAccount(addr);
      } catch (e) {
        console.error('Failed to get Privy wallet provider:', e);
        if (!cancelled) {
          // Still show the address even if signer fails
          setPrivyAccount(wallet.address || user?.wallet?.address || null);
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
    login();
  }, [login]);

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
