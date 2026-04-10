import styles from './DevelopersPage.module.css';

const BASE_URL = 'https://opick-production.up.railway.app/api/v1';

const ENDPOINTS = [
  {
    method: 'GET',
    path: '/markets',
    desc: 'Returns all active markets with current prices, volume, and reserves.',
    curl: `curl ${BASE_URL}/markets`,
    response: `[
  {
    "address": "0xFe51...",
    "topic": "Who is the GOAT? Messi vs Ronaldo",
    "sideAName": "Messi",
    "priceA": "500125000000000000",
    ...
  }
]`,
  },
  {
    method: 'GET',
    path: '/markets/:address',
    desc: 'Returns full data for a single market by contract address.',
    curl: `curl ${BASE_URL}/markets/0xFe514e2cF3901b611daA9CcDEC58CD77B76783E5`,
    response: `{
  "address": "0xFe51...",
  "topic": "Who is the GOAT? Messi vs Ronaldo",
  "sideAName": "Messi",
  "sideBName": "Ronaldo",
  ...
}`,
  },
  {
    method: 'GET',
    path: '/markets/:address/trades',
    desc: 'Returns the last 20 trades on a market, most recent first.',
    curl: `curl ${BASE_URL}/markets/trades/0xFe51...`,
    response: `[
  { "timestamp": 1712700000000, "side": "Messi", "amount": 5 },
  ...
]`,
  },
  {
    method: 'GET',
    path: '/markets/:address/price-history',
    desc: 'Returns up to 500 price data points for charting.',
    curl: `curl ${BASE_URL}/markets/price-history/0xFe51...`,
    response: `[
  { "timestamp": 1712700000000, "priceA": "500125...", "priceB": "499875..." },
  ...
]`,
  },
  {
    method: 'GET',
    path: '/snapshot',
    desc: 'Returns every market in a single request. Ideal for bots and dashboards.',
    curl: `curl ${BASE_URL}/snapshot`,
    response: `[
  {
    "address": "0xFe51...",
    "topic": "Who is the GOAT?",
    "priceA": "500125...",
    "totalVolume": "7000000",
    ...
  }
]`,
  },
  {
    method: 'GET',
    path: '/health',
    desc: 'Returns backend status, cached market count, chain ID, and factory address.',
    curl: `curl ${BASE_URL}/health`,
    response: `{
  "status": "ok",
  "cachedMarkets": 10,
  "chainId": 8453,
  "factoryAddress": "0x0491..."
}`,
  },
];

export default function DevelopersPage() {
  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Developer API</h1>
      <p className={styles.intro}>
        OPick exposes a public read-only API. Use it to build bots, dashboards, indexers, or anything else.
        No API key, no rate limits today, no auth. All endpoints return JSON.
      </p>
      <p className={styles.baseUrl}>
        Base URL: <code className={styles.code}>{BASE_URL}</code>
      </p>

      {ENDPOINTS.map((ep) => (
        <section className={styles.endpoint} key={ep.path}>
          <div className={styles.epHeader}>
            <span className={styles.method}>{ep.method}</span>
            <span className={styles.path}>{ep.path}</span>
          </div>
          <p className={styles.epDesc}>{ep.desc}</p>
          <pre className={styles.codeBlock}>{ep.curl}</pre>
          <p className={styles.responseLabel}>Response:</p>
          <pre className={styles.codeBlock}>{ep.response}</pre>
        </section>
      ))}

      <section className={styles.contact}>
        <h2 className={styles.contactTitle}>Get in touch</h2>
        <p className={styles.contactText}>Building something with OPick? Reach out: vader@opick.io</p>
      </section>
    </div>
  );
}
