import { useCallback } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { useFundWallet } from '@privy-io/react-auth';
import { base } from 'viem/chains';
import { useWallet } from './hooks/useWallet.js';
import Navbar from './components/Navbar.jsx';
import Footer from './components/Footer.jsx';
import LandingPage from './pages/LandingPage.jsx';
import HomePage from './pages/HomePage.jsx';
import MarketPage from './pages/MarketPage.jsx';
import PortfolioPage from './pages/PortfolioPage.jsx';
import CreatePage from './pages/CreatePage.jsx';
import AccountPage from './pages/AccountPage.jsx';
import CreatorsPage from './pages/CreatorsPage.jsx';
import DocsPage from './pages/DocsPage.jsx';
import TermsPage from './pages/TermsPage.jsx';
import PrivacyPage from './pages/PrivacyPage.jsx';
import RiskPage from './pages/RiskPage.jsx';
import './index.css';

function App() {
  const wallet = useWallet();
  const { account, provider, signer, connect, connectLocal, disconnect, authenticated, walletReady, displayName } = wallet;

  const { fundWallet } = useFundWallet();
  const onFundWallet = useCallback(() => {
    console.log('Navbar Add USDC, account:', account);
    if (account) fundWallet({ address: account, options: { chain: base, asset: 'USDC' } }).catch((e) => console.error('fundWallet error:', e?.message || e));
  }, [account, fundWallet]);

  const pageProps = { account, provider, signer, onConnect: connect, authenticated, walletReady, displayName };

  return (
    <BrowserRouter>
      <Navbar
        account={account}
        authenticated={authenticated}
        displayName={displayName}
        onConnect={connect}
        onConnectLocal={connectLocal}
        onDisconnect={disconnect}
        onFundWallet={onFundWallet}
      />
      <main style={{ paddingTop: 52, minHeight: 'calc(100vh - 52px)' }}>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/markets" element={<HomePage />} />
          <Route path="/market/:address" element={<MarketPage {...pageProps} />} />
          <Route path="/opinions" element={<AccountPage {...pageProps} />} />
          <Route path="/portfolio" element={<AccountPage {...pageProps} />} />
          <Route path="/create" element={<CreatePage {...pageProps} />} />
          <Route path="/account" element={<AccountPage {...pageProps} />} />
          <Route path="/creators" element={<CreatorsPage />} />
          <Route path="/docs" element={<DocsPage />} />
          <Route path="/terms" element={<TermsPage />} />
          <Route path="/privacy" element={<PrivacyPage />} />
          <Route path="/risk" element={<RiskPage />} />
        </Routes>
      </main>
      <Footer />
    </BrowserRouter>
  );
}

export default App;
