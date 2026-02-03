function normalizeBaseUrl(url) {
  return String(url || '').trim().replace(/\/+$/, '');
}

function getFrontendBaseUrl() {
  const raw = process.env.APP_FRONTEND_URL || process.env.FRONTEND_URL;
  if (raw) return normalizeBaseUrl(raw);

  // Fallback only for local/dev usage. In production we prefer failing fast.
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Missing APP_FRONTEND_URL/FRONTEND_URL env var (required in production).');
  }
  return 'http://localhost:5173';
}

function joinFrontendUrl(pathWithQuery) {
  const base = getFrontendBaseUrl();
  const p = String(pathWithQuery || '').trim().replace(/^\/+/, '');
  return `${base}/${p}`;
}

module.exports = { getFrontendBaseUrl, joinFrontendUrl };
