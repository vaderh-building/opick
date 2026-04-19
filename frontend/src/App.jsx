import { useState, useCallback, useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { useFundWallet, usePrivy } from '@privy-io/react-auth';
import { base } from 'viem/chains';
import { useWallet } from './hooks/useWallet.js';
import { useWelcomeBonus } from './hooks/useWelcomeBonus.js';
import { useReferralCapture } from './hooks/useReferralCapture.js';
import { configureAuth } from './lib/api.js';
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
import ProfilePage from './pages/ProfilePage.jsx';
import CreateMarketV6 from './pages/CreateMarketV6.jsx';
import MarketV6 from './pages/MarketV6.jsx';
import AmplifierDashboard from './pages/AmplifierDashboard.jsx';
import DevelopersPage from './pages/DevelopersPage.jsx';
import DocsPage from './pages/DocsPage.jsx';
import TermsPage from './pages/TermsPage.jsx';
import PrivacyPage from './pages/PrivacyPage.jsx';
import RiskPage from './pages/RiskPage.jsx';
import './index.css';

function App() {
  const wallet = useWallet();
  const { account, provider, signer, connect, connectLocal, disconnect, authenticated, walletReady, displayName } = wallet;

  // Wire Privy token into API client (only re-run when auth state changes)
  const { authenticated: privyAuthed, getAccessToken } = usePrivy();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    configureAuth(async () => {
      if (!privyAuthed) return null;
      try {
        const token = await getAccessToken();
        return token;
      } catch (e) {
        console.error('getAccessToken failed:', e);
        return null;
      }
    });
  }, [privyAuthed]);

  const { fundWallet } = useFundWallet();
  const onFundWallet = useCallback(() => {
    if (account) fundWallet({ address: account, options: { chain: base, asset: 'USDC' } }).catch(() => {});
  }, [account, fundWallet]);

  const bonus = useWelcomeBonus(account);
  useReferralCapture(account);

  const [inviteOpen, setInviteOpen] = useState(false);
  const [consentOpen, setConsentOpen] = useState(false);

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
          <Route path="/u/:username" element={<ProfilePage />} />
          <Route path="/create/v6" element={<CreateMarketV6 {...pageProps} />} />
          <Route path="/v6/m/:address" element={<MarketV6 {...pageProps} />} />
          <Route path="/amplifier" element={<AmplifierDashboard {...pageProps} />} />
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
    </BrowserRouter>
  );
}

export default App;
