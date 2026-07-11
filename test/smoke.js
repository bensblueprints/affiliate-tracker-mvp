// Reflink smoke test — boots the real server, exercises the click → conversion
// → commission → payout pipeline over real HTTP, and asserts rows land in SQLite.
// Kills ONLY the spawned server child (never broad-kills node processes).
const { spawn } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');
const assert = require('node:assert');

const ROOT = path.join(__dirname, '..');
const TEST_PORT = 5550;
const ADMIN_PASSWORD = 'smoke-test-password';
const DB_PATH = path.join(__dirname, 'smoke.db');
const ASSETS_DIR = path.join(__dirname, 'assets'); // server creates it next to the DB
const BASE = `http://127.0.0.1:${TEST_PORT}`;

for (const f of [DB_PATH, DB_PATH + '-wal', DB_PATH + '-shm']) {
  if (fs.existsSync(f)) fs.unlinkSync(f);
}
fs.rmSync(ASSETS_DIR, { recursive: true, force: true });

let serverProc = null;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitFor(fn, label, tries = 40, delay = 250) {
  for (let i = 0; i < tries; i++) {
    try { const v = await fn(); if (v) return v; } catch { /* retry */ }
    await sleep(delay);
  }
  throw new Error(`Timed out waiting for: ${label}`);
}

let cookie = '';
async function api(pathname, options = {}) {
  const res = await fetch(BASE + pathname, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}), ...options.headers },
    body: options.body && typeof options.body === 'object' && !Buffer.isBuffer(options.body)
      ? JSON.stringify(options.body) : options.body,
    redirect: 'manual'
  });
  const setCookie = res.headers.get('set-cookie');
  if (setCookie && setCookie.includes('rl_admin')) cookie = setCookie.split(';')[0];
  let data = {};
  try { data = await res.clone().json(); } catch { /* non-JSON */ }
  return { status: res.status, data, res };
}

async function main() {
  console.log('1. Booting Reflink on port', TEST_PORT, 'with temp DB');
  serverProc = spawn(process.execPath, ['server/index.js'], {
    cwd: ROOT,
    env: { ...process.env, PORT: String(TEST_PORT), ADMIN_PASSWORD, DB_PATH },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  serverProc.stdout.on('data', (d) => process.stdout.write(`   [server] ${d}`));
  serverProc.stderr.on('data', (d) => process.stderr.write(`   [server] ${d}`));
  await waitFor(async () => (await api('/api/health')).data.ok, 'server health');

  console.log('   Auth: wrong password 401, unauthenticated admin API 401, login 200');
  assert.strictEqual((await api('/api/login', { method: 'POST', body: { password: 'nope' } })).status, 401);
  cookie = '';
  assert.strictEqual((await api('/api/affiliates')).status, 401, 'admin API must require auth');
  assert.strictEqual((await api('/api/login', { method: 'POST', body: { password: ADMIN_PASSWORD } })).status, 200);

  console.log('2. Create affiliate (20% commission) + set default landing URL');
  await api('/api/settings', { method: 'PUT', body: { default_landing_url: 'https://example.com/pricing', cookie_window_days: 30, currency: 'USD' } });
  const created = await api('/api/affiliates', {
    method: 'POST',
    body: { name: 'Smoke Affiliate', email: 'smoke@example.com', ref_code: 'smoke123', commission_type: 'percent', commission_value: 20 }
  });
  assert.strictEqual(created.status, 201, 'affiliate create must 201');
  assert.strictEqual(created.data.ref_code, 'smoke123');
  const portalKey = created.data.portal_key;
  assert.ok(portalKey && portalKey.length >= 20, 'portal key generated');

  console.log('3. Click tracking: GET /r/smoke123 → 302 redirect + click row + attribution cookie');
  const click = await fetch(`${BASE}/r/smoke123`, { redirect: 'manual' });
  assert.strictEqual(click.status, 302, 'tracking link must redirect');
  const loc = click.headers.get('location');
  assert.ok(loc.startsWith('https://example.com/pricing'), 'redirects to landing URL');
  assert.ok(loc.includes('ref=smoke123'), 'ref code appended to landing URL');
  const refCookie = click.headers.get('set-cookie') || '';
  assert.ok(refCookie.includes('rl_ref=smoke123'), 'attribution cookie set');

  const Database = require('better-sqlite3');
  const db = new Database(DB_PATH, { readonly: true });
  const clickRow = db.prepare("SELECT * FROM clicks WHERE ref_code = 'smoke123'").get();
  assert.ok(clickRow, 'click row must exist in SQLite');
  assert.ok(clickRow.ip_hash && !clickRow.ip_hash.includes('127.0.0.1'), 'IP is stored hashed, never raw');

  console.log('4. Tracker snippet served and exposes reflink.convert');
  const tracker = await fetch(`${BASE}/track.js`);
  assert.strictEqual(tracker.status, 200);
  const trackerJs = await tracker.text();
  assert.ok(trackerJs.includes('reflink'), 'tracker defines window.reflink');
  assert.ok(!trackerJs.includes('innerHTML'), 'tracker never writes DOM HTML');

  console.log('5. Conversion postback: commission math + order_id dedupe');
  const conv = await fetch(`${BASE}/convert?ref=smoke123&order_id=ORDER-1&amount=49.99`);
  assert.strictEqual(conv.status, 201, 'first conversion must 201');
  const dup = await fetch(`${BASE}/convert?ref=smoke123&order_id=ORDER-1&amount=49.99`);
  const dupJson = await dup.json();
  assert.strictEqual(dup.status, 200, 'duplicate conversion must 200 (not created)');
  assert.strictEqual(dupJson.duplicate, true, 'duplicate flagged');
  const convRow = db.prepare("SELECT * FROM conversions WHERE order_id = 'ORDER-1'").get();
  assert.ok(convRow, 'conversion row in SQLite');
  assert.strictEqual(convRow.amount_cents, 4999);
  assert.strictEqual(convRow.commission_cents, 1000, '20% of $49.99 rounds to $10.00');
  assert.strictEqual(db.prepare("SELECT COUNT(*) n FROM conversions WHERE order_id = 'ORDER-1'").get().n, 1, 'dedupe: exactly one row');
  const badRef = await fetch(`${BASE}/convert?ref=doesnotexist&order_id=X&amount=1`);
  assert.strictEqual(badRef.status, 404, 'unknown ref must 404');

  console.log('6. Affiliate portal: login with email + key, stats reflect real data');
  const portalLogin = await fetch(`${BASE}/api/portal/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'smoke@example.com', key: portalKey })
  });
  assert.strictEqual(portalLogin.status, 200, 'portal login must succeed');
  const affCookie = portalLogin.headers.get('set-cookie').split(';')[0];
  const meRes = await fetch(`${BASE}/api/portal/me`, { headers: { Cookie: affCookie } });
  const meData = await meRes.json();
  assert.strictEqual(meRes.status, 200);
  assert.strictEqual(meData.stats.clicks, 1, 'portal shows the click');
  assert.strictEqual(meData.stats.conversions, 1, 'portal shows the conversion');
  assert.strictEqual(meData.stats.pending_cents, 1000, 'portal shows pending commission');
  const wrongKey = await fetch(`${BASE}/api/portal/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'smoke@example.com', key: 'wrong' })
  });
  assert.strictEqual(wrongKey.status, 401, 'wrong portal key must 401');

  console.log('7. Approve conversion → payout → CSV export');
  const approve = await api(`/api/conversions/${convRow.id}/status`, { method: 'POST', body: { status: 'approved' } });
  assert.strictEqual(approve.status, 200);
  const payout = await api('/api/payouts', { method: 'POST', body: { affiliate_id: created.data.id } });
  assert.strictEqual(payout.status, 201, 'payout create must 201');
  assert.strictEqual(payout.data.amount_cents, 1000, 'payout bundles approved commission');
  const paidRow = db.prepare("SELECT status, payout_id FROM conversions WHERE order_id = 'ORDER-1'").get();
  assert.strictEqual(paidRow.status, 'paid', 'conversion marked paid');
  assert.strictEqual(paidRow.payout_id, payout.data.id);
  const csv = await api('/api/payouts/export.csv');
  const csvText = await csv.res.text();
  assert.ok(csvText.includes('smoke@example.com'), 'CSV contains affiliate email');
  assert.ok(csvText.includes('10.00'), 'CSV contains payout amount');

  console.log('8. Leaderboard totals correct');
  const lb = await api('/api/leaderboard');
  assert.strictEqual(lb.data.totals.clicks, 1);
  assert.strictEqual(lb.data.totals.commission_cents, 1000);
  assert.strictEqual(lb.data.leaderboard[0].ref_code, 'smoke123');

  db.close();
  console.log('\n✅ All Reflink smoke tests passed');
}

async function cleanup(code) {
  if (serverProc && !serverProc.killed) serverProc.kill();
  await sleep(300);
  for (const f of [DB_PATH, DB_PATH + '-wal', DB_PATH + '-shm']) {
    try { if (fs.existsSync(f)) fs.unlinkSync(f); } catch { /* windows lock */ }
  }
  fs.rmSync(ASSETS_DIR, { recursive: true, force: true });
  process.exit(code);
}

main()
  .then(() => cleanup(0))
  .catch(async (err) => {
    console.error('\n❌ Smoke test failed:', err.message);
    await cleanup(1);
  });
