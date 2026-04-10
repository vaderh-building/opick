import { useState, useCallback } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { useFundWallet } from '@privy-io/react-auth';
import { base } from 'viem/chains';
import { useWallet } from './hooks/useWallet.js';
import { useWelcomeBonus } from './hooks/useWelcomeBonus.js';
import { useReferralCapture } from './hooks/useReferralCapture.js';
import Navbar from './components/Navbar.jsx';
import Footer from './components/Footer.jsx';
import WelcomeBonusToast from './components/WelcomeBonusToast.jsx';
import InviteEarnModal from './components/InviteEarnModal.jsx';
import LandingPage from './pages/LandingPage.jsx';
import HomePage from './pages/HomePage.jsx';
import MarketPage from './pages/MarketPage.jsx';
import PortfolioPage from './pages/PortfolioPage.jsx';
import CreatePage from './pages/CreatePage.jsx';
import AccountPage from './pages/AccountPage.jsx';
import CreatorsPage from './pages/CreatorsPage.jsx';
import DevelopersPage from './pages/DevelopersPage.jsx';
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
    if (account) fundWallet({ address: account, options: { chain: base, asset: 'USDC' } }).catch(() => {});
  }, [account, fundWallet]);

  const bonus = useWelcomeBonus(account);
  useReferralCapture(account);

  const [inviteOpen, setInviteOpen] = useState(false);
  const pageProps = { account, provider, signer, onConnect: connect, authenticated, walletReady, displayName };

  return (
    <BrowserRouter>
      <WelcomeBonusToast status={bonus.status} amount={bonus.amount} />
      <InviteEarnModal isOpen={inviteOpen} onClose={() => setInviteOpen(false)} account={account} />
      <Navbar
        account={account}
        authenticated={authenticated}
        displayName={displayName}
        onConnect={connect}
        onConnectLocal={connectLocal}
        onDisconnect={disconnect}
        onFundWallet={onFundWallet}
        onInvite={() => setInviteOpen(true)}
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
          <Route path="/developers" element={<DevelopersPage />} />
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
