import { Buffer } from 'buffer';
window.Buffer = Buffer;

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { PrivyProvider } from '@privy-io/react-auth';
import App from './App.jsx';

const privyAppId = import.meta.env.VITE_PRIVY_APP_ID || 'PLACEHOLDER';
console.log('Privy App ID:', privyAppId === 'PLACEHOLDER' ? 'NOT SET' : privyAppId.slice(0, 8) + '...');

const baseSepoliaChain = {
  id: 84532,
  name: 'Base Sepolia',
  network: 'base-sepolia',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://sepolia.base.org'] },
    public: { http: ['https://sepolia.base.org'] },
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
          createOnLogin: 'all-users',
          noPromptOnSignature: true,
        },
        defaultChain: baseSepoliaChain,
        supportedChains: [baseSepoliaChain],
      }}
    >
      <App />
    </PrivyProvider>
  </StrictMode>,
);
