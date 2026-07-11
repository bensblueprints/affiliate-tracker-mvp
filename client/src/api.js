async function req(path, options = {}) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    ...options,
    body: options.body != null && !(options.body instanceof Blob) ? JSON.stringify(options.body) : options.body
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || `HTTP ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return data;
}

export const api = {
  me: () => req('/api/me'),
  login: (password) => req('/api/login', { method: 'POST', body: { password } }),
  logout: () => req('/api/logout', { method: 'POST' }),
  affiliates: () => req('/api/affiliates'),
  createAffiliate: (body) => req('/api/affiliates', { method: 'POST', body }),
  updateAffiliate: (id, body) => req(`/api/affiliates/${id}`, { method: 'PUT', body }),
  deleteAffiliate: (id) => req(`/api/affiliates/${id}`, { method: 'DELETE' }),
  regenKey: (id) => req(`/api/affiliates/${id}/regen-key`, { method: 'POST' }),
  conversions: (status) => req(`/api/conversions${status ? `?status=${status}` : ''}`),
  setConversionStatus: (id, status) => req(`/api/conversions/${id}/status`, { method: 'POST', body: { status } }),
  payouts: () => req('/api/payouts'),
  createPayout: (affiliate_id) => req('/api/payouts', { method: 'POST', body: { affiliate_id } }),
  leaderboard: () => req('/api/leaderboard'),
  assets: () => req('/api/assets'),
  deleteAsset: (id) => req(`/api/assets/${id}`, { method: 'DELETE' }),
  uploadAsset: async (file) => {
    const res = await fetch(`/api/assets?name=${encodeURIComponent(file.name)}`, {
      method: 'POST',
      headers: { 'Content-Type': file.type || 'application/octet-stream' },
      body: file
    });
    if (!res.ok) throw new Error('upload failed');
    return res.json();
  },
  settings: () => req('/api/settings'),
  saveSettings: (body) => req('/api/settings', { method: 'PUT', body }),
  portalLogin: (email, key) => req('/api/portal/login', { method: 'POST', body: { email, key } }),
  portalLogout: () => req('/api/portal/logout', { method: 'POST' }),
  portalMe: () => req('/api/portal/me')
};

export function money(cents, currency = 'USD') {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format((cents || 0) / 100);
}

export function timeAgo(ms) {
  if (!ms) return 'never';
  const s = Math.max(0, Math.floor((Date.now() - ms) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}
