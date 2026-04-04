import { useState, useEffect, useCallback, useMemo } from 'react';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import { BrowserProvider, JsonRpcProvider, Wallet } from 'ethers';
import { RPC_URL } from '../config.js';

const HARDHAT_PRIVATE_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
const IS_DEV = import.meta.env.VITE_DEV_MODE === 'true' ||
  (typeof window !== 'undefined' && window.location.hostname === 'localhost');
const BASE_SEPOLIA_CHAIN_ID = 84532;

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

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

  // Local dev
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

  // Setup wallet when authenticated + wallets available
  useEffect(() => {
    if (localMode || !ready || !authenticated) {
      if (!localMode && !authenticated) {
        setPrivySigner(null);
        setPrivyAccount(null);
        setWalletReady(false);
      }
      return;
    }

    // Immediate address from user object
    let userAddr = user?.wallet?.address || null;
    if (!userAddr && user?.linkedAccounts) {
      const wa = user.linkedAccounts.find(a => a.type === 'wallet');
      if (wa?.address) userAddr = wa.address;
    }
    if (userAddr) setPrivyAccount(userAddr);

    console.log('Wallets:', wallets?.length, wallets?.map(w => `${w.walletClientType}:${w.address?.slice(0, 8)}`));

    if (!wallets.length) return;

    const wallet = wallets.find(w => w.walletClientType === 'privy') || wallets[0];
    if (wallet.address) setPrivyAccount(wallet.address);

    let cancelled = false;

    (async () => {
      try {
        try { await wallet.switchChain(BASE_SEPOLIA_CHAIN_ID); } catch {}

        const ethProvider = await wallet.getEthereumProvider();
        if (cancelled) return;
        const bp = new BrowserProvider(ethProvider);
        const s = await bp.getSigner();
        const addr = await s.getAddress();
        if (cancelled) return;

        setPrivySigner(s);
        setPrivyAccount(addr);
        setWalletReady(true);
        console.log('Wallet ready:', addr);
      } catch (e) {
        console.error('Wallet setup failed:', e.message);
        if (!cancelled) setWalletReady(false);
      }
    })();

    return () => { cancelled = true; };
  }, [authenticated, ready, wallets, localMode, user]);

  // If authenticated but no wallets after delay, try creating one
  useEffect(() => {
    if (localMode || !authenticated || !ready || wallets.length > 0 || walletReady) return;

    let cancelled = false;
    (async () => {
      await sleep(3000);
      if (cancelled || wallets.length > 0) return;

      if (createWallet) {
        console.log('No wallets found, creating embedded wallet...');
        try {
          await createWallet();
          console.log('Embedded wallet created');
        } catch (e) {
          console.warn('createWallet failed:', e.message);
        }
      }
    })();

    return () => { cancelled = true; };
  }, [authenticated, ready, wallets, localMode, walletReady, createWallet]);

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
