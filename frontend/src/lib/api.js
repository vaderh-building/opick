const BASE = (import.meta.env.VITE_API_URL || 'http://localhost:3001') + '/api';

// ---------- Auth token provider ----------
let _getToken = null;
export function configureAuth(getTokenFn) {
  _getToken = getTokenFn;
}

// ---------- ApiError ----------
export class ApiError extends Error {
  constructor(status, body) {
    super(body?.error || `Request failed (${status})`);
    this.name = 'ApiError';
    this.status = status;
    this.code = body?.code || null;
    this.body = body;
  }
}

// ---------- Helpers ----------
export function apiUrl(path) {
  return BASE + path;
}

async function request(method, path, { body, auth = false, multipart = false } = {}) {
  const headers = {};

  if (auth) {
    const token = _getToken ? await _getToken() : null;
    console.log('[api] auth token:', token ? 'present (' + token.length + ' chars)' : 'MISSING');
    if (token) headers['Authorization'] = 'Bearer ' + token;
  }

  const opts = { method, headers };

  if (body && !multipart) {
    headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  } else if (body && multipart) {
    // FormData sets its own Content-Type with boundary
    opts.body = body;
  }

  const res = await fetch(BASE + path, opts);

  if (res.status === 204) return null;

  let parsed;
  try {
    parsed = await res.json();
  } catch {
    parsed = null;
  }

  if (!res.ok) {
    throw new ApiError(res.status, parsed);
  }

  return parsed;
}

// ---------- Public API ----------
export function apiGet(path, { auth = false } = {}) {
  return request('GET', path, { auth });
}

export function apiPost(path, body, { auth = true } = {}) {
  return request('POST', path, { body, auth });
}

export function apiPatch(path, body, { auth = true } = {}) {
  return request('PATCH', path, { body, auth });
}

export function apiDelete(path, { auth = true } = {}) {
  return request('DELETE', path, { auth });
}

export function apiUpload(path, formData) {
  return request('POST', path, { body: formData, auth: true, multipart: true });
}
