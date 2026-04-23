// Issue numbering: No. 01 begins 2026-04-23. A new issue every ~14 days.
// Quarter label derived from the same epoch for the masthead suffix.
const EPOCH = Date.UTC(2026, 3, 23); // April 23, 2026 UTC
const DAYS_PER_ISSUE = 14;

function pad2(n) {
  return String(n).padStart(2, '0');
}

function quarterLabel(date) {
  const y = date.getUTCFullYear();
  const q = Math.floor(date.getUTCMonth() / 3) + 1;
  return `Q${q} ${y}`;
}

export function currentIssueNumber(now = new Date()) {
  const ms = now.getTime() - EPOCH;
  if (ms < 0) return 1;
  return Math.floor(ms / (DAYS_PER_ISSUE * 86400 * 1000)) + 1;
}

export function issueLabel(now = new Date()) {
  const n = currentIssueNumber(now);
  return `No. ${pad2(n)}  ·  ${quarterLabel(now)}`;
}
