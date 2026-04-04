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
  const { account, provider, signer, connect, connectLocal, disconnect } = useWallet();

  return (
    <BrowserRouter>
      <Navbar
        account={account}
        onConnect={connect}
        onConnectLocal={connectLocal}
        onDisconnect={disconnect}
      />
      <main style={{ paddingTop: 52, minHeight: 'calc(100vh - 52px)' }}>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/markets" element={<HomePage />} />
          <Route path="/market/:address" element={
            <MarketPage account={account} provider={provider} signer={signer} onConnect={connect} />
          } />
          <Route path="/portfolio" element={
            <PortfolioPage account={account} provider={provider} signer={signer} onConnect={connect} />
          } />
          <Route path="/create" element={
            <CreatePage account={account} provider={provider} signer={signer} onConnect={connect} />
          } />
          <Route path="/docs" element={<DocsPage />} />
        </Routes>
      </main>
      <Footer />
    </BrowserRouter>
  );
}

export default App;
