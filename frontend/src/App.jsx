import { useState, useCallback, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useFundWallet, usePrivy } from '@privy-io/react-auth';
import { base } from 'viem/chains';
import { useWallet } from './hooks/useWallet.js';
import { useWelcomeBonus } from './hooks/useWelcomeBonus.js';
import { useReferralCapture } from './hooks/useReferralCapture.js';
import { configureAuth } from './lib/api.js';
import Masthead from './components/v6/Masthead.jsx';
import Navbar from './components/Navbar.jsx';
import Footer from './components/Footer.jsx';
import WelcomeBonusToast from './components/WelcomeBonusToast.jsx';
import InviteEarnModal from './components/InviteEarnModal.jsx';
import ConsentModal, { hasConsented } from './components/ConsentModal.jsx';

// V6 editorial pages
import HomeV6 from './pages/v6/HomeV6.jsx';
import SubjectPage from './pages/v6/SubjectPage.jsx';
import MarketV6Editorial from './pages/v6/MarketV6Editorial.jsx';
import AboutPage from './pages/v6/AboutPage.jsx';
import EssayAttentionPage from './pages/v6/EssayAttentionPage.jsx';
import LegacyPage from './pages/v6/LegacyPage.jsx';

// Legacy V5 routes (preserved, not linked from new nav)
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

// Routes that retain the legacy V5 chrome (old Navbar + Footer).
const LEGACY_PATH_PREFIXES = [
  '/legacy/market',
  '/v6/m',
  '/account',
  '/portfolio',
  '/opinions',
  '/create',
  '/creators',
  '/amplifier',
  '/developers',
  '/docs',
  '/terms',
  '/privacy',
  '/risk',
  '/u/',
];

function LayoutSwitch({ children, pageProps, onInvite }) {
  const location = useLocation();
  const path = location.pathname;
  const isLegacy = LEGACY_PATH_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`) || path.startsWith(`${p}`));

  if (isLegacy) {
    return (
      <>
        <Navbar {...pageProps} onInvite={onInvite} />
        <main style={{ paddingTop: 52, minHeight: 'calc(100vh - 52px)' }}>{children}</main>
        <Footer />
      </>
    );
  }
  return (
    <>
      <Masthead />
      <main>{children}</main>
    </>
  );
}

function App() {
  const wallet = useWallet();
  const { account, provider, signer, connect, connectLocal, disconnect, authenticated, walletReady, displayName } = wallet;

  const { authenticated: privyAuthed, getAccessToken } = usePrivy();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    configureAuth(async () => {
      if (!privyAuthed) return null;
      try {
        return await getAccessToken();
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

  const pageProps = {
    account,
    provider,
    signer,
    onConnect: gatedConnect,
    onConnectLocal: connectLocal,
    onDisconnect: disconnect,
    onFundWallet,
    authenticated,
    walletReady,
    displayName,
  };

  return (
    <BrowserRouter>
      <WelcomeBonusToast status={bonus.status} amount={bonus.amount} />
      <InviteEarnModal isOpen={inviteOpen} onClose={() => setInviteOpen(false)} account={account} />
      <ConsentModal isOpen={consentOpen} onClose={() => setConsentOpen(false)} onConsent={handleConsent} />
      <LayoutSwitch pageProps={pageProps} onInvite={() => setInviteOpen(true)}>
        <Routes>
          {/* V6 primary routes */}
          <Route path="/" element={<HomeV6 />} />
          <Route path="/subjects/:slug" element={<SubjectPage />} />
          <Route path="/markets/:id" element={<MarketV6Editorial />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/essay/attention" element={<EssayAttentionPage />} />
          <Route path="/legacy" element={<LegacyPage />} />

          {/* V5 deep-link preservation */}
          <Route path="/legacy/market/:address" element={<MarketPage {...pageProps} />} />

          {/* V5 URLs redirected */}
          <Route path="/markets" element={<Navigate to="/" replace />} />
          <Route path="/market/:address" element={<Navigate to="/legacy" replace />} />

          {/* Old preserved routes */}
          <Route path="/home-legacy" element={<HomePage />} />
          <Route path="/landing-legacy" element={<LandingPage />} />
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

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </LayoutSwitch>
    </BrowserRouter>
  );
}

export default App;
