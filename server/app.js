const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const express = require('express');
const cookieParser = require('cookie-parser');
const { openDb, genCode, genToken, hashIp, getSettings, setSettings } = require('./db');
const { TRACKER } = require('./tracker');

const ADMIN_COOKIE = 'rl_admin';
const AFF_COOKIE = 'rl_aff';
const REF_COOKIE = 'rl_ref';
const CODE_RE = /^[A-Za-z0-9_-]{1,64}$/;

function createApp({ dbPath, adminPassword, autologinToken = null, assetsDir = null } = {}) {
  const db = openDb(dbPath);
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', true);
  app.use(cookieParser());

  const ASSETS_DIR = assetsDir || path.join(path.dirname(path.resolve(dbPath)), 'assets');
  fs.mkdirSync(ASSETS_DIR, { recursive: true });

  app.locals.db = db;

  // ---- sessions (in-memory, simple by design) ----
  const adminSessions = new Set();
  const affSessions = new Map(); // token -> affiliate_id

  function requireAdmin(req, res, next) {
    if (req.cookies[ADMIN_COOKIE] && adminSessions.has(req.cookies[ADMIN_COOKIE])) return next();
    res.status(401).json({ error: 'unauthorized' });
  }
  function requireAffiliate(req, res, next) {
    const t = req.cookies[AFF_COOKIE];
    if (t && affSessions.has(t)) {
      req.affiliate = db.prepare('SELECT * FROM affiliates WHERE id = ?').get(affSessions.get(t));
      if (req.affiliate) return next();
    }
    res.status(401).json({ error: 'unauthorized' });
  }

  // Light per-key rate limit for public endpoints.
  const rateMap = new Map();
  function rateLimited(key, max = 60, windowMs = 10_000) {
    const now = Date.now();
    const arr = (rateMap.get(key) || []).filter((t) => now - t < windowMs);
    if (arr.length >= max) return true;
    arr.push(now);
    rateMap.set(key, arr);
    if (rateMap.size > 10000) rateMap.clear();
    return false;
  }

  const findAffByCode = db.prepare('SELECT * FROM affiliates WHERE ref_code = ?');

  function commissionFor(aff, amountCents) {
    if (!aff) return 0;
    if (aff.commission_type === 'flat') return Math.round(aff.commission_value);
    return Math.round(amountCents * (aff.commission_value / 100));
  }

  function clientIp(req) {
    return (req.ip || '').replace('::ffff:', '');
  }

  // ================= PUBLIC: tracking =================

  app.get('/track.js', (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Cache-Control', 'public, max-age=86400');
    res.type('application/javascript').send(TRACKER);
  });

  // Redirect tracking link: /r/CODE?to=https://target — records a click.
  app.get('/r/:code', (req, res) => {
    const code = String(req.params.code || '');
    if (!CODE_RE.test(code)) return res.status(400).send('bad code');
    const aff = findAffByCode.get(code);
    if (!aff || aff.status !== 'active') return res.status(404).send('unknown link');
    if (rateLimited('click:' + clientIp(req), 120)) return res.status(429).send('rate limited');

    const settings = getSettings(db);
    let target = String(req.query.to || settings.default_landing_url || '');
    try {
      const u = new URL(target);
      if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new Error('bad scheme');
      if (!u.searchParams.has('ref')) u.searchParams.set('ref', code);
      target = u.toString();
    } catch {
      target = '';
    }

    db.prepare('INSERT INTO clicks (ref_code, at, ip_hash, ua, landing_url) VALUES (?, ?, ?, ?, ?)')
      .run(code, Date.now(), hashIp(clientIp(req), settings.ip_salt),
           String(req.headers['user-agent'] || '').slice(0, 300), target || null);

    const windowDays = Math.max(1, Number(settings.cookie_window_days) || 30);
    res.cookie(REF_COOKIE, code, { maxAge: windowDays * 86400_000, sameSite: 'lax', httpOnly: true });
    if (!target) return res.status(200).send('Click recorded — set a default landing URL in Reflink settings.');
    res.redirect(302, target);
  });

  // Conversion postback (server-to-server or beacon from track.js).
  // GET|POST /convert?ref=CODE&order_id=X&amount=49.99   (amount in currency units)
  const convertCors = (req, res, next) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(204).end();
    next();
  };
  app.options('/convert', convertCors);
  app.all('/convert', convertCors, (req, res) => {
    if (rateLimited('convert:' + clientIp(req), 60)) return res.status(429).json({ error: 'rate limited' });
    const q = { ...req.query };
    const ref = String(q.ref || req.cookies[REF_COOKIE] || '');
    const orderId = String(q.order_id || '').trim().slice(0, 120);
    const amount = Number(q.amount);
    if (!CODE_RE.test(ref)) return res.status(400).json({ error: 'missing or invalid ref' });
    if (!orderId) return res.status(400).json({ error: 'order_id is required' });
    const aff = findAffByCode.get(ref);
    if (!aff || aff.status !== 'active') return res.status(404).json({ error: 'unknown ref code' });

    const amountCents = Number.isFinite(amount) && amount >= 0 ? Math.round(amount * 100) : 0;
    const commission = commissionFor(aff, amountCents);
    const info = db.prepare(`
      INSERT INTO conversions (ref_code, order_id, amount_cents, commission_cents, status, at)
      VALUES (?, ?, ?, ?, 'pending', ?)
      ON CONFLICT(order_id) DO NOTHING
    `).run(ref, orderId, amountCents, commission, Date.now());
    res.status(info.changes ? 201 : 200).json({ ok: true, duplicate: !info.changes });
  });

  // Public asset download (marketing banners for affiliates to hotlink).
  app.get('/assets/:id/:name', (req, res) => {
    const asset = db.prepare('SELECT * FROM assets WHERE id = ?').get(req.params.id);
    if (!asset) return res.status(404).send('not found');
    const file = path.join(ASSETS_DIR, `${asset.id}`);
    if (!fs.existsSync(file)) return res.status(404).send('not found');
    res.set('Content-Type', asset.mime);
    res.set('Cache-Control', 'public, max-age=86400');
    fs.createReadStream(file).pipe(res);
  });

  // ================= AUTH =================

  app.use(express.json({ limit: '256kb' }));

  app.get('/api/health', (req, res) => res.json({ ok: true, app: 'reflink' }));

  app.post('/api/login', (req, res) => {
    if (String((req.body || {}).password || '') !== adminPassword) {
      return res.status(401).json({ error: 'wrong password' });
    }
    const t = genToken(24);
    adminSessions.add(t);
    res.cookie(ADMIN_COOKIE, t, { httpOnly: true, sameSite: 'lax' });
    res.json({ ok: true });
  });

  app.post('/api/logout', (req, res) => {
    adminSessions.delete(req.cookies[ADMIN_COOKIE]);
    res.clearCookie(ADMIN_COOKIE);
    res.json({ ok: true });
  });

  app.get('/api/me', (req, res) =>
    res.json({ authed: Boolean(req.cookies[ADMIN_COOKIE] && adminSessions.has(req.cookies[ADMIN_COOKIE])) }));

  app.get('/auth/auto', (req, res) => {
    if (autologinToken && req.query.token === autologinToken) {
      const t = genToken(24);
      adminSessions.add(t);
      res.cookie(ADMIN_COOKIE, t, { httpOnly: true, sameSite: 'lax' });
    }
    res.redirect('/');
  });

  // ================= AFFILIATE PORTAL =================

  app.post('/api/portal/login', (req, res) => {
    const email = String((req.body || {}).email || '').trim().toLowerCase();
    const key = String((req.body || {}).key || '').trim();
    if (rateLimited('portal:' + clientIp(req), 20)) return res.status(429).json({ error: 'rate limited' });
    const aff = db.prepare('SELECT * FROM affiliates WHERE lower(email) = ?').get(email);
    if (!aff || !key || !crypto.timingSafeEqual(
      Buffer.from(key.padEnd(64).slice(0, 64)), Buffer.from(aff.portal_key.padEnd(64).slice(0, 64)))) {
      return res.status(401).json({ error: 'invalid email or access key' });
    }
    const t = genToken(24);
    affSessions.set(t, aff.id);
    res.cookie(AFF_COOKIE, t, { httpOnly: true, sameSite: 'lax' });
    res.json({ ok: true });
  });

  app.post('/api/portal/logout', (req, res) => {
    affSessions.delete(req.cookies[AFF_COOKIE]);
    res.clearCookie(AFF_COOKIE);
    res.json({ ok: true });
  });

  function affiliateStats(aff) {
    const clicks = db.prepare('SELECT COUNT(*) n FROM clicks WHERE ref_code = ?').get(aff.ref_code).n;
    const conv = db.prepare(`
      SELECT COUNT(*) n,
             COALESCE(SUM(amount_cents), 0) revenue_cents,
             COALESCE(SUM(CASE WHEN status IN ('pending') THEN commission_cents END), 0) pending_cents,
             COALESCE(SUM(CASE WHEN status IN ('approved') THEN commission_cents END), 0) approved_cents,
             COALESCE(SUM(CASE WHEN status IN ('paid') THEN commission_cents END), 0) paid_cents
      FROM conversions WHERE ref_code = ? AND status != 'rejected'
    `).get(aff.ref_code);
    return { clicks, conversions: conv.n, revenue_cents: conv.revenue_cents,
             pending_cents: conv.pending_cents, approved_cents: conv.approved_cents, paid_cents: conv.paid_cents };
  }

  app.get('/api/portal/me', requireAffiliate, (req, res) => {
    const aff = req.affiliate;
    const recent = db.prepare(
      "SELECT order_id, amount_cents, commission_cents, status, at FROM conversions WHERE ref_code = ? ORDER BY at DESC LIMIT 50"
    ).all(aff.ref_code);
    const assets = db.prepare('SELECT id, filename, mime, size FROM assets ORDER BY uploaded_at DESC').all();
    res.json({
      affiliate: { id: aff.id, name: aff.name, email: aff.email, ref_code: aff.ref_code,
                   commission_type: aff.commission_type, commission_value: aff.commission_value },
      stats: affiliateStats(aff),
      recent_conversions: recent,
      assets,
      currency: getSettings(db).currency
    });
  });

  // ================= ADMIN API =================

  app.get('/api/affiliates', requireAdmin, (req, res) => {
    const rows = db.prepare('SELECT * FROM affiliates ORDER BY created_at DESC').all();
    res.json(rows.map((a) => ({ ...a, ...affiliateStats(a) })));
  });

  app.post('/api/affiliates', requireAdmin, (req, res) => {
    const b = req.body || {};
    const name = String(b.name || '').trim().slice(0, 120);
    const email = String(b.email || '').trim().toLowerCase().slice(0, 200);
    if (!name || !email.includes('@')) return res.status(400).json({ error: 'name and valid email required' });
    let ref_code = String(b.ref_code || '').trim() || genCode(8);
    if (!CODE_RE.test(ref_code)) return res.status(400).json({ error: 'ref code: letters/digits/dash/underscore only' });
    const commission_type = b.commission_type === 'flat' ? 'flat' : 'percent';
    let commission_value = Number(b.commission_value);
    if (!Number.isFinite(commission_value) || commission_value < 0) commission_value = commission_type === 'flat' ? 500 : 20;
    if (commission_type === 'percent') commission_value = Math.min(commission_value, 100);
    try {
      const info = db.prepare(`
        INSERT INTO affiliates (name, email, ref_code, portal_key, commission_type, commission_value, status, created_at)
        VALUES (?, ?, ?, ?, ?, ?, 'active', ?)
      `).run(name, email, ref_code, genToken(16), commission_type, commission_value, Date.now());
      res.status(201).json(db.prepare('SELECT * FROM affiliates WHERE id = ?').get(info.lastInsertRowid));
    } catch (e) {
      res.status(409).json({ error: 'email or ref code already exists' });
    }
  });

  app.put('/api/affiliates/:id', requireAdmin, (req, res) => {
    const aff = db.prepare('SELECT * FROM affiliates WHERE id = ?').get(req.params.id);
    if (!aff) return res.status(404).json({ error: 'not found' });
    const b = req.body || {};
    const name = String(b.name ?? aff.name).trim().slice(0, 120) || aff.name;
    const status = b.status === 'paused' ? 'paused' : 'active';
    const commission_type = (b.commission_type ?? aff.commission_type) === 'flat' ? 'flat' : 'percent';
    let commission_value = Number(b.commission_value ?? aff.commission_value);
    if (!Number.isFinite(commission_value) || commission_value < 0) commission_value = aff.commission_value;
    db.prepare('UPDATE affiliates SET name = ?, status = ?, commission_type = ?, commission_value = ? WHERE id = ?')
      .run(name, status, commission_type, commission_value, aff.id);
    res.json(db.prepare('SELECT * FROM affiliates WHERE id = ?').get(aff.id));
  });

  app.post('/api/affiliates/:id/regen-key', requireAdmin, (req, res) => {
    const aff = db.prepare('SELECT * FROM affiliates WHERE id = ?').get(req.params.id);
    if (!aff) return res.status(404).json({ error: 'not found' });
    const key = genToken(16);
    db.prepare('UPDATE affiliates SET portal_key = ? WHERE id = ?').run(key, aff.id);
    res.json({ portal_key: key });
  });

  app.delete('/api/affiliates/:id', requireAdmin, (req, res) => {
    const aff = db.prepare('SELECT * FROM affiliates WHERE id = ?').get(req.params.id);
    if (!aff) return res.status(404).json({ error: 'not found' });
    db.transaction(() => {
      db.prepare('DELETE FROM clicks WHERE ref_code = ?').run(aff.ref_code);
      db.prepare('DELETE FROM conversions WHERE ref_code = ?').run(aff.ref_code);
      db.prepare('DELETE FROM payouts WHERE affiliate_id = ?').run(aff.id);
      db.prepare('DELETE FROM affiliates WHERE id = ?').run(aff.id);
    })();
    res.json({ ok: true });
  });

  app.get('/api/conversions', requireAdmin, (req, res) => {
    const limit = Math.min(Math.max(Number(req.query.limit) || 200, 1), 2000);
    const rows = req.query.status
      ? db.prepare('SELECT c.*, a.name AS affiliate_name FROM conversions c LEFT JOIN affiliates a ON a.ref_code = c.ref_code WHERE c.status = ? ORDER BY c.at DESC LIMIT ?').all(String(req.query.status), limit)
      : db.prepare('SELECT c.*, a.name AS affiliate_name FROM conversions c LEFT JOIN affiliates a ON a.ref_code = c.ref_code ORDER BY c.at DESC LIMIT ?').all(limit);
    res.json(rows);
  });

  app.post('/api/conversions/:id/status', requireAdmin, (req, res) => {
    const conv = db.prepare('SELECT * FROM conversions WHERE id = ?').get(req.params.id);
    if (!conv) return res.status(404).json({ error: 'not found' });
    const status = String((req.body || {}).status || '');
    if (!['pending', 'approved', 'rejected'].includes(status)) return res.status(400).json({ error: 'bad status' });
    if (conv.status === 'paid') return res.status(400).json({ error: 'already paid' });
    db.prepare('UPDATE conversions SET status = ? WHERE id = ?').run(status, conv.id);
    res.json(db.prepare('SELECT * FROM conversions WHERE id = ?').get(conv.id));
  });

  // Create a payout: bundles all approved conversions for one affiliate.
  app.post('/api/payouts', requireAdmin, (req, res) => {
    const aff = db.prepare('SELECT * FROM affiliates WHERE id = ?').get((req.body || {}).affiliate_id);
    if (!aff) return res.status(404).json({ error: 'affiliate not found' });
    const approved = db.prepare("SELECT * FROM conversions WHERE ref_code = ? AND status = 'approved'").all(aff.ref_code);
    if (!approved.length) return res.status(400).json({ error: 'no approved conversions to pay out' });
    const total = approved.reduce((s, c) => s + c.commission_cents, 0);
    const period = new Date().toISOString().slice(0, 7);
    let payoutId;
    db.transaction(() => {
      const info = db.prepare('INSERT INTO payouts (affiliate_id, amount_cents, period, created_at, paid_at) VALUES (?, ?, ?, ?, ?)')
        .run(aff.id, total, period, Date.now(), Date.now());
      payoutId = info.lastInsertRowid;
      db.prepare("UPDATE conversions SET status = 'paid', payout_id = ? WHERE ref_code = ? AND status = 'approved'")
        .run(payoutId, aff.ref_code);
    })();
    res.status(201).json(db.prepare('SELECT * FROM payouts WHERE id = ?').get(payoutId));
  });

  app.get('/api/payouts', requireAdmin, (req, res) => {
    res.json(db.prepare(`
      SELECT p.*, a.name AS affiliate_name, a.email AS affiliate_email
      FROM payouts p LEFT JOIN affiliates a ON a.id = p.affiliate_id ORDER BY p.created_at DESC
    `).all());
  });

  // CSV export for Stripe/PayPal manual payouts (all-time or ?period=YYYY-MM).
  app.get('/api/payouts/export.csv', requireAdmin, (req, res) => {
    const rows = req.query.period
      ? db.prepare('SELECT p.*, a.name, a.email FROM payouts p JOIN affiliates a ON a.id = p.affiliate_id WHERE p.period = ? ORDER BY p.created_at').all(String(req.query.period))
      : db.prepare('SELECT p.*, a.name, a.email FROM payouts p JOIN affiliates a ON a.id = p.affiliate_id ORDER BY p.created_at').all();
    const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const currency = getSettings(db).currency;
    const lines = ['payout_id,affiliate_name,affiliate_email,amount,currency,period,created_at'];
    for (const r of rows) {
      lines.push([r.id, esc(r.name), esc(r.email), (r.amount_cents / 100).toFixed(2), currency, r.period,
        new Date(r.created_at).toISOString()].join(','));
    }
    res.set('Content-Type', 'text/csv; charset=utf-8');
    res.set('Content-Disposition', 'attachment; filename="reflink-payouts.csv"');
    res.send(lines.join('\n') + '\n');
  });

  app.get('/api/leaderboard', requireAdmin, (req, res) => {
    const affs = db.prepare("SELECT * FROM affiliates").all();
    const board = affs.map((a) => ({
      id: a.id, name: a.name, ref_code: a.ref_code, status: a.status, ...affiliateStats(a)
    })).sort((x, y) => (y.approved_cents + y.paid_cents + y.pending_cents) - (x.approved_cents + x.paid_cents + x.pending_cents));
    const totals = {
      clicks: db.prepare('SELECT COUNT(*) n FROM clicks').get().n,
      conversions: db.prepare("SELECT COUNT(*) n FROM conversions WHERE status != 'rejected'").get().n,
      revenue_cents: db.prepare("SELECT COALESCE(SUM(amount_cents),0) n FROM conversions WHERE status != 'rejected'").get().n,
      commission_cents: db.prepare("SELECT COALESCE(SUM(commission_cents),0) n FROM conversions WHERE status != 'rejected'").get().n
    };
    res.json({ leaderboard: board, totals, currency: getSettings(db).currency });
  });

  // ---- marketing assets (banner upload as raw bytes) ----
  app.post('/api/assets', requireAdmin, express.raw({ type: '*/*', limit: '5mb' }), (req, res) => {
    const filename = String(req.query.name || 'asset').replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 120);
    const mime = String(req.headers['content-type'] || 'application/octet-stream').slice(0, 100);
    if (!Buffer.isBuffer(req.body) || !req.body.length) return res.status(400).json({ error: 'empty body' });
    const info = db.prepare('INSERT INTO assets (filename, mime, size, uploaded_at) VALUES (?, ?, ?, ?)')
      .run(filename, mime, req.body.length, Date.now());
    fs.writeFileSync(path.join(ASSETS_DIR, String(info.lastInsertRowid)), req.body);
    res.status(201).json(db.prepare('SELECT * FROM assets WHERE id = ?').get(info.lastInsertRowid));
  });

  app.get('/api/assets', requireAdmin, (req, res) => {
    res.json(db.prepare('SELECT * FROM assets ORDER BY uploaded_at DESC').all());
  });

  app.delete('/api/assets/:id', requireAdmin, (req, res) => {
    db.prepare('DELETE FROM assets WHERE id = ?').run(req.params.id);
    try { fs.unlinkSync(path.join(ASSETS_DIR, String(req.params.id))); } catch { /* gone */ }
    res.json({ ok: true });
  });

  app.get('/api/settings', requireAdmin, (req, res) => {
    const { ip_salt, ...rest } = getSettings(db);
    res.json(rest);
  });
  app.put('/api/settings', requireAdmin, (req, res) => {
    setSettings(db, req.body || {});
    const { ip_salt, ...rest } = getSettings(db);
    res.json(rest);
  });

  // ================= SPA =================

  const dist = path.join(__dirname, '..', 'dist');
  if (fs.existsSync(dist)) {
    app.use(express.static(dist, { index: false }));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api') || req.path.startsWith('/r/') || req.path.startsWith('/assets/') ||
          req.path === '/convert' || req.path === '/track.js') return next();
      res.set('Cache-Control', 'no-store');
      res.sendFile(path.join(dist, 'index.html'));
    });
  }

  return app;
}

module.exports = { createApp };
