import { useSendTransaction } from '@privy-io/react-auth';
import { BrowserProvider, Contract, Interface } from 'ethers';
import { useWallet } from './useWallet.js';

export function useSponsoredTx() {
  const { sendTransaction } = useSendTransaction();
  const { isEmbedded } = useWallet();

  // Build a fresh signer from window.ethereum (bypasses Privy's RPC proxy)
  const getExternalSigner = async () => {
    if (typeof window === 'undefined' || !window.ethereum) {
      throw new Error('No injected wallet provider found');
    }
    const provider = new BrowserProvider(window.ethereum);
    return provider.getSigner();
  };

  // Low-level raw tx: embedded -> sponsored, external -> window.ethereum
  const sponsoredTx = async ({ to, data, value }) => {
    console.log('[tx]', { isEmbedded, fn: 'sponsoredTx', to });
    if (isEmbedded) {
      const { hash } = await sendTransaction(
        { to, data, value },
        { sponsor: true }
      );
      return hash;
    }
    console.log('[tx-external] sending via window.ethereum', { to, fn: 'raw' });
    const signer = await getExternalSigner();
    const tx = await signer.sendTransaction({ to, data, value: value ?? 0n });
    return tx.hash;
  };

  // Contract-style call: embedded -> encode + sponsoredTx, external -> contract.fn()
  const sponsoredCall = async (address, abi, fnName, args = [], opts = {}) => {
    console.log('[tx]', { isEmbedded, fn: 'sponsoredCall', to: address });
    if (isEmbedded) {
      const iface = new Interface(abi);
      const data = iface.encodeFunctionData(fnName, args);
      return sponsoredTx({ to: address, data });
    }
    console.log('[tx-external] sending via window.ethereum', { to: address, fn: fnName });
    const signer = await getExternalSigner();
    const contract = new Contract(address, abi, signer);
    const tx = await contract[fnName](...args, opts);
    return tx.hash;
  };

  return { sponsoredTx, sponsoredCall, sendTransaction, isEmbedded };
}
