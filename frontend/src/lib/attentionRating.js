// Attention Rating: 0-100 score derived from engagement-weighted signal.
// Logarithmic scaling against the observed population so the top end is hard
// to earn. With the current mock data the distribution lands ~50-90; no
// subject should reach the 95+ Phenomenon tier without exceptional signal.

const BASELINE = 50;
const SPAN = 40;
const CURVE = 1.5;
const MAX = 94.99;

function round2(n) {
  return Math.round(n * 100) / 100;
}

export function computeAttentionRating(engagementWeighted, allSubjects) {
  if (!Array.isArray(allSubjects) || allSubjects.length === 0) return BASELINE;

  const logValue = Math.log10(Math.max(Number(engagementWeighted) || 0, 1));
  const allLogValues = allSubjects.map(
    (s) => Math.log10(Math.max(Number(s?.metrics?.engagementWeighted) || 0, 1)),
  );
  const minLog = Math.min(...allLogValues);
  const maxLog = Math.max(...allLogValues);
  if (maxLog === minLog) return round2(Math.min(BASELINE + SPAN, MAX));

  const normalized = (logValue - minLog) / (maxLog - minLog);
  const shaped = Math.pow(normalized, CURVE);
  const rating = BASELINE + shaped * SPAN;
  return round2(Math.max(0, Math.min(rating, MAX)));
}

export function getAttentionTier(rating) {
  const floor = Math.floor(rating);
  if (floor >= 95) return 'Phenomenon';
  if (floor >= 85) return 'Dominating';
  if (floor >= 70) return 'Trending';
  if (floor >= 55) return 'Active';
  if (floor >= 40) return 'Present';
  return 'Quiet';
}

export function formatRating(rating) {
  return Number(rating).toFixed(2);
}
