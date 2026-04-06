import { useSendTransaction } from '@privy-io/react-auth';
import { Contract, Interface } from 'ethers';

// Hook that wraps contract calls with Privy gas sponsorship
export function useSponsoredTx() {
  const { sendTransaction } = useSendTransaction();

  // Send a sponsored contract call
  // Usage: await sponsoredCall(contractAddress, abi, functionName, args)
  const sponsoredCall = async (to, abi, functionName, args = []) => {
    const iface = new Interface(abi);
    const data = iface.encodeFunctionData(functionName, args);
    const { hash } = await sendTransaction(
      { to, data },
      { sponsor: true }
    );
    return hash;
  };

  return { sponsoredCall, sendTransaction };
}
