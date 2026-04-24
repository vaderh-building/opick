// Attention Rating: 0-100 score derived from engagement-weighted signal.
// Logarithmic scaling against the observed population so the top end is hard
// to earn. With the current mock data the distribution lands ~50-90; no
// subject should reach the 95+ Phenomenon tier without exceptional signal.

const BASELINE = 50;
const SPAN = 40;
const CURVE = 1.5;

export function computeAttentionRating(engagementWeighted, allSubjects) {
  if (!Array.isArray(allSubjects) || allSubjects.length === 0) return BASELINE;

  const logValue = Math.log10(Math.max(Number(engagementWeighted) || 0, 1));
  const allLogValues = allSubjects.map(
    (s) => Math.log10(Math.max(Number(s?.metrics?.engagementWeighted) || 0, 1)),
  );
  const minLog = Math.min(...allLogValues);
  const maxLog = Math.max(...allLogValues);
  if (maxLog === minLog) return Math.min(BASELINE + SPAN, 94);

  const normalized = (logValue - minLog) / (maxLog - minLog);
  const shaped = Math.pow(normalized, CURVE);
  const rating = Math.round(BASELINE + shaped * SPAN);
  return Math.max(0, Math.min(rating, 94));
}

export function getAttentionTier(rating) {
  if (rating >= 95) return 'Phenomenon';
  if (rating >= 85) return 'Dominating';
  if (rating >= 70) return 'Trending';
  if (rating >= 55) return 'Active';
  if (rating >= 40) return 'Present';
  return 'Quiet';
}
