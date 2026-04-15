import { useSendTransaction } from '@privy-io/react-auth';
import { Contract, Interface } from 'ethers';
import { useWallet } from './useWallet.js';

export function useSponsoredTx() {
  const { sendTransaction } = useSendTransaction();
  const { isEmbedded, signer } = useWallet();

  // Low-level raw tx: embedded -> sponsored, external -> signer.sendTransaction
  const sponsoredTx = async ({ to, data, value }) => {
    console.log('[tx]', { isEmbedded, fn: 'sponsoredTx', to });
    if (isEmbedded) {
      const { hash } = await sendTransaction(
        { to, data, value },
        { sponsor: true }
      );
      return hash;
    }
    // External wallet: use ethers signer
    if (!signer) throw new Error('Wallet not ready. Please wait a moment and try again.');
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
    // External wallet: native contract call (MetaMask estimates gas)
    if (!signer) throw new Error('Wallet not ready. Please wait a moment and try again.');
    const contract = new Contract(address, abi, signer);
    const tx = await contract[fnName](...args, opts);
    return tx.hash;
  };

  return { sponsoredTx, sponsoredCall, sendTransaction, isEmbedded };
}
