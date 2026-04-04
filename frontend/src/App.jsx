import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { useWallet } from './hooks/useWallet.js';
import Navbar from './components/Navbar.jsx';
import Footer from './components/Footer.jsx';
import LandingPage from './pages/LandingPage.jsx';
import HomePage from './pages/HomePage.jsx';
import MarketPage from './pages/MarketPage.jsx';
import PortfolioPage from './pages/PortfolioPage.jsx';
import CreatePage from './pages/CreatePage.jsx';
import DocsPage from './pages/DocsPage.jsx';
import './index.css';

function App() {
  const wallet = useWallet();
  const { account, provider, signer, connect, connectLocal, disconnect, authenticated, walletReady, displayName } = wallet;

  const pageProps = { account, provider, signer, onConnect: connect, authenticated, walletReady };

  return (
    <BrowserRouter>
      <Navbar
        account={account}
        authenticated={authenticated}
        displayName={displayName}
        onConnect={connect}
        onConnectLocal={connectLocal}
        onDisconnect={disconnect}
      />
      <main style={{ paddingTop: 52, minHeight: 'calc(100vh - 52px)' }}>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/markets" element={<HomePage />} />
          <Route path="/market/:address" element={<MarketPage {...pageProps} />} />
          <Route path="/portfolio" element={<PortfolioPage {...pageProps} />} />
          <Route path="/create" element={<CreatePage {...pageProps} />} />
          <Route path="/docs" element={<DocsPage />} />
        </Routes>
      </main>
      <Footer />
    </BrowserRouter>
  );
}

export default App;
