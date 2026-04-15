import { useState, useCallback, useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { useFundWallet, usePrivy } from '@privy-io/react-auth';
import { base } from 'viem/chains';
import { useWallet } from './hooks/useWallet.js';
import { useWelcomeBonus } from './hooks/useWelcomeBonus.js';
import { useReferralCapture } from './hooks/useReferralCapture.js';
import { configureAuth } from './lib/api.js';
import ProfileSetupModal from './components/ProfileSetupModal.jsx';
import Navbar from './components/Navbar.jsx';
import Footer from './components/Footer.jsx';
import WelcomeBonusToast from './components/WelcomeBonusToast.jsx';
import InviteEarnModal from './components/InviteEarnModal.jsx';
import ConsentModal, { hasConsented } from './components/ConsentModal.jsx';
import LandingPage from './pages/LandingPage.jsx';
import HomePage from './pages/HomePage.jsx';
import MarketPage from './pages/MarketPage.jsx';
import PortfolioPage from './pages/PortfolioPage.jsx';
import CreatePage from './pages/CreatePage.jsx';
import AccountPage from './pages/AccountPage.jsx';
import DevelopersPage from './pages/DevelopersPage.jsx';
import DocsPage from './pages/DocsPage.jsx';
import TermsPage from './pages/TermsPage.jsx';
import PrivacyPage from './pages/PrivacyPage.jsx';
import RiskPage from './pages/RiskPage.jsx';
import './index.css';

const IS_DEV = import.meta.env.VITE_DEV_MODE === 'true' ||
  (typeof window !== 'undefined' && window.location.hostname === 'localhost');

function App() {
  const wallet = useWallet();
  const { account, provider, signer, connect, connectLocal, disconnect, authenticated, walletReady, displayName } = wallet;

  // Wire Privy token into API client
  const { getAccessToken } = usePrivy();
  useEffect(() => {
    configureAuth(getAccessToken);
  }, [getAccessToken]);

  const { fundWallet } = useFundWallet();
  const onFundWallet = useCallback(() => {
    if (account) fundWallet({ address: account, options: { chain: base, asset: 'USDC' } }).catch(() => {});
  }, [account, fundWallet]);

  const bonus = useWelcomeBonus(account);
  useReferralCapture(account);

  const [inviteOpen, setInviteOpen] = useState(false);
  const [consentOpen, setConsentOpen] = useState(false);
  const [profileModalOpen, setProfileModalOpen] = useState(false);

  const gatedConnect = useCallback(() => {
    if (hasConsented()) {
      connect();
    } else {
      setConsentOpen(true);
    }
  }, [connect]);

  const handleConsent = useCallback(() => {
    setConsentOpen(false);
    connect();
  }, [connect]);

  const pageProps = { account, provider, signer, onConnect: gatedConnect, authenticated, walletReady, displayName };

  return (
    <BrowserRouter>
      <WelcomeBonusToast status={bonus.status} amount={bonus.amount} />
      <InviteEarnModal isOpen={inviteOpen} onClose={() => setInviteOpen(false)} account={account} />
      <ConsentModal isOpen={consentOpen} onClose={() => setConsentOpen(false)} onConsent={handleConsent} />
      <ProfileSetupModal
        isOpen={profileModalOpen}
        onClose={() => setProfileModalOpen(false)}
        onComplete={(profile) => { console.log('Profile created:', profile); setProfileModalOpen(false); }}
      />
      <Navbar
        account={account}
        authenticated={authenticated}
        displayName={displayName}
        onConnect={gatedConnect}
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
          <Route path="/creators" element={<CreatePage {...pageProps} />} />
          <Route path="/developers" element={<DevelopersPage />} />
          <Route path="/docs" element={<DocsPage />} />
          <Route path="/terms" element={<TermsPage />} />
          <Route path="/privacy" element={<PrivacyPage />} />
          <Route path="/risk" element={<RiskPage />} />
        </Routes>
      </main>
      <Footer />
      {IS_DEV && authenticated && (
        <button
          onClick={() => setProfileModalOpen(true)}
          style={{
            position: 'fixed', bottom: 16, right: 16, zIndex: 999,
            fontSize: 11, fontFamily: 'var(--font-mono)', padding: '6px 12px',
            background: '#fff', border: '0.5px solid #E8E7E2', borderRadius: 4,
            color: '#6e6d69', cursor: 'pointer',
          }}
        >
          DEV: profile modal
        </button>
      )}
    </BrowserRouter>
  );
}

export default App;
