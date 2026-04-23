// Mock data for OPick V6 Attention Index.
// Numbers are synthesized to feel realistic but are not authoritative.
// Bios are intentionally minimal: birth year (or founding year), primary role, tracked-since.
// Swap this module for a real oracle fetch without changing page components.

const now = Date.UTC(2026, 3, 23);
const day = 86400 * 1000;

function generateSeries(base, volatility, length, seed) {
  const arr = [];
  let value = base;
  let r = seed;
  for (let i = 0; i < length; i++) {
    r = (r * 9301 + 49297) % 233280;
    const noise = (r / 233280 - 0.5) * 2 * volatility;
    value = Math.max(0, value + noise + Math.sin(i / 3) * volatility * 0.25);
    arr.push(Math.round(value));
  }
  return arr;
}

export const SUBJECTS = [
  {
    slug: 'elon-musk',
    name: 'Elon Musk',
    handle: '@elonmusk',
    bio: 'Born 1971. CEO of Tesla and xAI, owner of X.',
    trackedSince: '2026-04-23',
    metrics: {
      engagementWeighted: 948712,
      mentionCount: 1248904,
      engagementDensity: 0.76,
      velocity: 1.42,
    },
    sevenDayDelta: 0.184,
    peak: { value: 1_004_112, date: '2026-04-21' },
    trough: { value: 412_008, date: '2026-03-02' },
    correlates: ['donald-trump', 'sam-altman', 'xai'],
    series30d: generateSeries(780000, 60000, 30, 11),
  },
  {
    slug: 'sam-altman',
    name: 'Sam Altman',
    handle: '@sama',
    bio: 'Born 1985. CEO of OpenAI.',
    trackedSince: '2026-04-23',
    metrics: {
      engagementWeighted: 612_440,
      mentionCount: 812_011,
      engagementDensity: 0.62,
      velocity: 1.08,
    },
    sevenDayDelta: 0.092,
    peak: { value: 701_220, date: '2026-04-18' },
    trough: { value: 233_104, date: '2026-02-20' },
    correlates: ['openai', 'elon-musk', 'xai'],
    series30d: generateSeries(540000, 35000, 30, 23),
  },
  {
    slug: 'donald-trump',
    name: 'Donald Trump',
    handle: '@realDonaldTrump',
    bio: 'Born 1946. 45th and 47th US President.',
    trackedSince: '2026-04-23',
    metrics: {
      engagementWeighted: 728_014,
      mentionCount: 1_048_300,
      engagementDensity: 0.58,
      velocity: 0.91,
    },
    sevenDayDelta: -0.041,
    peak: { value: 902_500, date: '2026-01-20' },
    trough: { value: 318_200, date: '2025-11-12' },
    correlates: ['elon-musk'],
    series30d: generateSeries(680000, 42000, 30, 37),
  },
  {
    slug: 'taylor-swift',
    name: 'Taylor Swift',
    handle: '@taylorswift13',
    bio: 'Born 1989. Musician, songwriter.',
    trackedSince: '2026-04-23',
    metrics: {
      engagementWeighted: 502_018,
      mentionCount: 905_440,
      engagementDensity: 0.81,
      velocity: 0.74,
    },
    sevenDayDelta: 0.021,
    peak: { value: 612_100, date: '2026-02-14' },
    trough: { value: 280_110, date: '2025-12-02' },
    correlates: [],
    series30d: generateSeries(480000, 28000, 30, 53),
  },
  {
    slug: 'sam-bankman-fried',
    name: 'Sam Bankman-Fried',
    handle: '@SBF_FTX',
    bio: 'Born 1992. Founder of FTX, currently incarcerated.',
    trackedSince: '2026-04-23',
    metrics: {
      engagementWeighted: 84_200,
      mentionCount: 112_800,
      engagementDensity: 0.44,
      velocity: 0.12,
    },
    sevenDayDelta: -0.188,
    peak: { value: 812_400, date: '2023-11-03' },
    trough: { value: 42_100, date: '2025-08-11' },
    correlates: [],
    series30d: generateSeries(90000, 9000, 30, 71),
  },
  {
    slug: 'openai',
    name: 'OpenAI',
    handle: '@OpenAI',
    bio: 'Founded 2015. AI research lab, creator of ChatGPT.',
    trackedSince: '2026-04-23',
    metrics: {
      engagementWeighted: 588_210,
      mentionCount: 912_008,
      engagementDensity: 0.64,
      velocity: 0.98,
    },
    sevenDayDelta: 0.071,
    peak: { value: 702_100, date: '2026-04-15' },
    trough: { value: 312_440, date: '2026-01-02' },
    correlates: ['sam-altman', 'xai'],
    series30d: generateSeries(540000, 32000, 30, 83),
  },
  {
    slug: 'xai',
    name: 'xAI',
    handle: '@xai',
    bio: 'Founded 2023. AI lab led by Elon Musk, creator of Grok.',
    trackedSince: '2026-04-23',
    metrics: {
      engagementWeighted: 322_400,
      mentionCount: 488_090,
      engagementDensity: 0.66,
      velocity: 1.34,
    },
    sevenDayDelta: 0.221,
    peak: { value: 410_200, date: '2026-04-22' },
    trough: { value: 88_200, date: '2025-10-10' },
    correlates: ['elon-musk', 'openai'],
    series30d: generateSeries(240000, 24000, 30, 97),
  },
  {
    slug: 'tesla',
    name: 'Tesla',
    handle: '@Tesla',
    bio: 'Founded 2003. Electric vehicles and energy.',
    trackedSince: '2026-04-23',
    metrics: {
      engagementWeighted: 438_900,
      mentionCount: 702_100,
      engagementDensity: 0.63,
      velocity: 0.82,
    },
    sevenDayDelta: 0.013,
    peak: { value: 612_300, date: '2026-03-02' },
    trough: { value: 240_900, date: '2025-09-04' },
    correlates: ['elon-musk'],
    series30d: generateSeries(420000, 25000, 30, 109),
  },
  {
    slug: 'polymarket',
    name: 'Polymarket',
    handle: '@Polymarket',
    bio: 'Founded 2020. Prediction market platform.',
    trackedSince: '2026-04-23',
    metrics: {
      engagementWeighted: 108_440,
      mentionCount: 188_200,
      engagementDensity: 0.58,
      velocity: 0.88,
    },
    sevenDayDelta: 0.064,
    peak: { value: 312_100, date: '2024-11-06' },
    trough: { value: 62_440, date: '2025-02-01' },
    correlates: [],
    series30d: generateSeries(102000, 9000, 30, 131),
  },
  {
    slug: 'bitcoin',
    name: 'Bitcoin',
    handle: '@bitcoin',
    bio: 'Released 2009. Decentralized digital currency.',
    trackedSince: '2026-04-23',
    metrics: {
      engagementWeighted: 712_009,
      mentionCount: 1_188_300,
      engagementDensity: 0.60,
      velocity: 0.94,
    },
    sevenDayDelta: 0.088,
    peak: { value: 902_400, date: '2026-03-18' },
    trough: { value: 402_100, date: '2025-10-02' },
    correlates: [],
    series30d: generateSeries(680000, 38000, 30, 151),
  },
];

export const MARKETS = [
  {
    id: 'musk-altman-density',
    title: 'Musk / Altman, Engagement Density',
    question: 'Which subject commands greater attention per mention?',
    subjectA: 'elon-musk',
    subjectB: 'sam-altman',
    metric: 'Engagement Density',
    metricSuffix: '',
    priceYes: 0.62,
    priceNo: 0.38,
    leadingSide: 'yes',
    volumeUsdc: 184_210,
    liquidityUsdc: 42_800,
    settlesOn: '2026-05-15',
    recentTrades: [
      { hash: '0xa83d', side: 'YES', amount: 420.50, price: 0.61, ts: '2026-04-23T04:18:22Z' },
      { hash: '0xb910', side: 'NO', amount: 128.00, price: 0.39, ts: '2026-04-23T04:11:05Z' },
      { hash: '0xc017', side: 'YES', amount: 1_024.00, price: 0.60, ts: '2026-04-23T03:54:00Z' },
      { hash: '0xd88a', side: 'YES', amount: 86.00, price: 0.60, ts: '2026-04-23T03:41:49Z' },
      { hash: '0xe321', side: 'NO', amount: 220.00, price: 0.41, ts: '2026-04-23T03:22:12Z' },
      { hash: '0xf044', side: 'YES', amount: 50.00, price: 0.59, ts: '2026-04-23T03:02:00Z' },
      { hash: '0x1120', side: 'YES', amount: 700.00, price: 0.58, ts: '2026-04-23T02:48:33Z' },
      { hash: '0x2288', side: 'NO', amount: 310.00, price: 0.42, ts: '2026-04-23T02:21:19Z' },
      { hash: '0x3391', side: 'YES', amount: 55.00, price: 0.57, ts: '2026-04-23T02:04:04Z' },
      { hash: '0x4412', side: 'YES', amount: 1_200.00, price: 0.56, ts: '2026-04-23T01:48:00Z' },
    ],
    history: generateSeries(58, 3, 48, 201).map((v) => Math.min(95, Math.max(10, v))),
  },
  {
    id: 'trump-swift-velocity',
    title: 'Trump / Swift, Velocity',
    question: 'Which subject is accelerating faster in the week ahead?',
    subjectA: 'donald-trump',
    subjectB: 'taylor-swift',
    metric: 'Velocity',
    metricSuffix: '×',
    priceYes: 0.44,
    priceNo: 0.56,
    leadingSide: 'no',
    volumeUsdc: 98_420,
    liquidityUsdc: 18_200,
    settlesOn: '2026-05-01',
    recentTrades: [
      { hash: '0x5523', side: 'NO', amount: 220.00, price: 0.57, ts: '2026-04-23T04:03:22Z' },
      { hash: '0x6634', side: 'NO', amount: 120.00, price: 0.56, ts: '2026-04-23T03:22:12Z' },
      { hash: '0x7745', side: 'YES', amount: 50.00, price: 0.44, ts: '2026-04-23T02:48:00Z' },
      { hash: '0x8856', side: 'NO', amount: 420.00, price: 0.55, ts: '2026-04-23T02:04:04Z' },
      { hash: '0x9967', side: 'NO', amount: 80.00, price: 0.56, ts: '2026-04-23T01:48:00Z' },
    ],
    history: generateSeries(50, 4, 48, 203).map((v) => Math.min(90, Math.max(10, v))),
  },
  {
    id: 'openai-xai-mentions',
    title: 'OpenAI / xAI, Mention Count',
    question: 'Which lab will accumulate more X mentions in this period?',
    subjectA: 'openai',
    subjectB: 'xai',
    metric: 'Mention Count',
    metricSuffix: '',
    priceYes: 0.58,
    priceNo: 0.42,
    leadingSide: 'yes',
    volumeUsdc: 62_300,
    liquidityUsdc: 12_400,
    settlesOn: '2026-05-08',
    recentTrades: [
      { hash: '0xaa11', side: 'YES', amount: 110.00, price: 0.58, ts: '2026-04-23T04:22:22Z' },
      { hash: '0xbb22', side: 'YES', amount: 240.00, price: 0.57, ts: '2026-04-23T03:40:12Z' },
    ],
    history: generateSeries(55, 3, 48, 205).map((v) => Math.min(90, Math.max(10, v))),
  },
];

export function findSubject(slug) {
  return SUBJECTS.find((s) => s.slug === slug) || null;
}

export function findMarket(id) {
  return MARKETS.find((m) => m.id === id) || null;
}

export function marketsForSubject(slug) {
  return MARKETS.filter((m) => m.subjectA === slug || m.subjectB === slug);
}

export function correlatedSubjects(slug) {
  const subj = findSubject(slug);
  if (!subj) return [];
  return subj.correlates.map(findSubject).filter(Boolean);
}

export function epochNow() { return now; }
export function dayMs() { return day; }
