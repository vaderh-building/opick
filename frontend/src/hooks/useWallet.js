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
      const wallet = new Wallet(HARDHAT_PRIVATE_KEY, rpcProvider);
      setLocalSigner(wallet);
      setLocalAccount(wallet.address);
    }
  }, [localMode, rpcProvider]);

  const [privyProvider, setPrivyProvider] = useState(null);
  const [privySigner, setPrivySigner] = useState(null);
  const [privyAccount, setPrivyAccount] = useState(null);

  useEffect(() => {
    if (!authenticated || !wallets.length || localMode) {
      setPrivyProvider(null);
      setPrivySigner(null);
      setPrivyAccount(null);
      return;
    }

    const wallet = wallets[0];

    (async () => {
      try {
        const ethProvider = await wallet.getEthereumProvider();
        const bp = new BrowserProvider(ethProvider);
        const s = await bp.getSigner();
        const addr = await s.getAddress();
        setPrivyProvider(bp);
        setPrivySigner(s);
        setPrivyAccount(addr);
      } catch (e) {
        console.error('Failed to get Privy wallet provider:', e);
        setPrivyProvider(null);
        setPrivySigner(null);
        setPrivyAccount(wallet.address || null);
      }
    })();
  }, [authenticated, wallets, localMode]);

  const account = localMode ? localAccount : privyAccount;
  const provider = localMode ? rpcProvider : (privyProvider || rpcProvider);
  const signer = localMode ? localSigner : privySigner;

  const connect = useCallback(() => {
    login();
  }, [login]);

  const connectLocal = useCallback(async () => {
    if (!IS_DEV) return null;
    const wallet = new Wallet(HARDHAT_PRIVATE_KEY, rpcProvider);
    setLocalMode(true);
    setLocalSigner(wallet);
    setLocalAccount(wallet.address);
    localStorage.setItem('opick_account', wallet.address);
    localStorage.setItem('opick_connect_method', 'local');
    return wallet.address;
  }, [rpcProvider]);

  const disconnect = useCallback(async () => {
    if (localMode) {
      setLocalMode(false);
      setLocalSigner(null);
      setLocalAccount(null);
      localStorage.removeItem('opick_account');
      localStorage.removeItem('opick_connect_method');
    } else if (authenticated) {
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
