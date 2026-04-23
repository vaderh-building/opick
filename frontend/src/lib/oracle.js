// Thin oracle client. Swap `fetchOracle` in place later; page components stay untouched.

import { SUBJECTS, MARKETS, findSubject, findMarket, marketsForSubject, correlatedSubjects } from './mockData.js';

const ORACLE_URL =
  import.meta.env.VITE_ORACLE_URL ||
  import.meta.env.NEXT_PUBLIC_ORACLE_URL ||
  '';

const USE_MOCK = !ORACLE_URL || import.meta.env.VITE_USE_MOCK === 'true';

async function safeFetchJson(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`oracle ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn('[oracle] fetch failed, using mock:', err.message);
    return null;
  }
}

export function isUsingMock() { return USE_MOCK; }

export async function fetchSubjects() {
  if (USE_MOCK) return SUBJECTS;
  const data = await safeFetchJson(`${ORACLE_URL}/api/subjects`);
  return data?.subjects || SUBJECTS;
}

export async function fetchSubject(slug) {
  if (USE_MOCK) return findSubject(slug);
  const data = await safeFetchJson(`${ORACLE_URL}/api/subjects/${slug}`);
  return data?.subject || findSubject(slug);
}

export async function fetchMarkets() {
  if (USE_MOCK) return MARKETS;
  const data = await safeFetchJson(`${ORACLE_URL}/api/markets`);
  return data?.markets || MARKETS;
}

export async function fetchMarket(id) {
  if (USE_MOCK) return findMarket(id);
  const data = await safeFetchJson(`${ORACLE_URL}/api/markets/${id}`);
  return data?.market || findMarket(id);
}

export async function fetchMarketsForSubject(slug) {
  if (USE_MOCK) return marketsForSubject(slug);
  const data = await safeFetchJson(`${ORACLE_URL}/api/subjects/${slug}/markets`);
  return data?.markets || marketsForSubject(slug);
}

export async function fetchCorrelatedSubjects(slug) {
  if (USE_MOCK) return correlatedSubjects(slug);
  const data = await safeFetchJson(`${ORACLE_URL}/api/subjects/${slug}/correlated`);
  return data?.subjects || correlatedSubjects(slug);
}
