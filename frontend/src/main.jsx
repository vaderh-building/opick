import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { PrivyProvider } from '@privy-io/react-auth';
import App from './App.jsx';

const privyAppId = import.meta.env.VITE_PRIVY_APP_ID || 'PLACEHOLDER';
console.log('Privy App ID:', privyAppId === 'PLACEHOLDER' ? 'NOT SET (using placeholder)' : privyAppId.slice(0, 8) + '...');

const baseSepolia = {
  id: 84532,
  name: 'Base Sepolia',
  network: 'base-sepolia',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://sepolia.base.org'] },
    public: { http: ['https://sepolia.base.org'] },
  },
  blockExplorers: {
    default: { name: 'BaseScan', url: 'https://sepolia.basescan.org' },
  },
  testnet: true,
};

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <PrivyProvider
      appId={privyAppId}
      config={{
        loginMethods: ['email', 'google', 'twitter', 'wallet'],
        appearance: {
          theme: 'light',
          accentColor: '#1a6b3c',
          logo: null,
        },
        embeddedWallets: {
          createOnLogin: 'users-without-wallets',
        },
        supportedChains: [baseSepolia],
        defaultChain: baseSepolia,
      }}
    >
      <App />
    </PrivyProvider>
  </StrictMode>,
);
