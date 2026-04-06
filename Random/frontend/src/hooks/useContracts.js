import { useMemo } from 'react';
import { Contract } from 'ethers';
import { USDC_ADDRESS, FACTORY_ADDRESS } from '../config.js';
import USDCAbi from '../abi/MockUSDC.json'; // ERC20 ABI — works for real USDC too
import OPickFactoryAbi from '../abi/OPickFactory.json';
import OPickMarketAbi from '../abi/OPickMarket.json';

export function useContracts(providerOrSigner) {
  const usdc = useMemo(() => {
    if (!providerOrSigner || !USDC_ADDRESS) return null;
    return new Contract(USDC_ADDRESS, USDCAbi, providerOrSigner);
  }, [providerOrSigner]);

  const factory = useMemo(() => {
    if (!providerOrSigner || !FACTORY_ADDRESS) return null;
    return new Contract(FACTORY_ADDRESS, OPickFactoryAbi, providerOrSigner);
  }, [providerOrSigner]);

  const getMarket = useMemo(() => {
    return (address) => {
      if (!providerOrSigner) return null;
      return new Contract(address, OPickMarketAbi, providerOrSigner);
    };
  }, [providerOrSigner]);

  return { usdc, factory, getMarket };
}
