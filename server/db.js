const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const Database = require('better-sqlite3');

function nativeBindingPath() {
  // Under Electron the Node-ABI binding won't load; use the vendored Electron prebuild.
  if (!process.versions.electron) return null;
  const p = path.join(__dirname, '..', 'vendor', 'better_sqlite3-electron.node');
  return fs.existsSync(p) ? p : null;
}

const ALPHABET = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789';
function genCode(len = 8) {
  const bytes = crypto.randomBytes(len);
  let out = '';
  for (let i = 0; i < len; i++) out += ALPHABET[bytes[i] % ALPHABET.length];
  return out;
}

function genToken(len = 32) {
  return crypto.randomBytes(len).toString('hex');
}

// Privacy: raw IPs are never stored — only a salted hash, for fraud/duplicate review.
function hashIp(ip, salt) {
  return crypto.createHash('sha256').update(`${salt}|${ip || ''}`).digest('hex').slice(0, 24);
}

function openDb(dbPath) {
  fs.mkdirSync(path.dirname(path.resolve(dbPath)), { recursive: true });
  const nativeBinding = nativeBindingPath();
  const db = new Database(dbPath, nativeBinding ? { nativeBinding } : {});
  db.pragma('journal_mode = WAL');

  db.exec(`
    CREATE TABLE IF NOT EXISTS affiliates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      ref_code TEXT NOT NULL UNIQUE,
      portal_key TEXT NOT NULL UNIQUE,
      commission_type TEXT NOT NULL DEFAULT 'percent',  -- 'percent' | 'flat'
      commission_value REAL NOT NULL DEFAULT 20,        -- percent (0-100) or flat cents
      status TEXT NOT NULL DEFAULT 'active',            -- active | paused
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS clicks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ref_code TEXT NOT NULL,
      at INTEGER NOT NULL,
      ip_hash TEXT,
      ua TEXT,
      landing_url TEXT
    );
    CREATE TABLE IF NOT EXISTS conversions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ref_code TEXT NOT NULL,
      order_id TEXT NOT NULL UNIQUE,
      amount_cents INTEGER NOT NULL DEFAULT 0,
      commission_cents INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'pending',           -- pending | approved | rejected | paid
      payout_id INTEGER,
      at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS payouts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      affiliate_id INTEGER NOT NULL,
      amount_cents INTEGER NOT NULL,
      period TEXT,
      created_at INTEGER NOT NULL,
      paid_at INTEGER
    );
    CREATE TABLE IF NOT EXISTS assets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      filename TEXT NOT NULL,
      mime TEXT NOT NULL,
      size INTEGER NOT NULL,
      uploaded_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_clicks_code ON clicks(ref_code, at);
    CREATE INDEX IF NOT EXISTS idx_conversions_code ON conversions(ref_code, at);
  `);

  return db;
}

const DEFAULT_SETTINGS = {
  default_landing_url: '',
  cookie_window_days: '30',
  currency: 'USD',
  ip_salt: ''
};

function getSettings(db) {
  const out = { ...DEFAULT_SETTINGS };
  for (const r of db.prepare('SELECT key, value FROM settings').all()) {
    if (r.value !== '' && r.value != null) out[r.key] = r.value;
  }
  if (!out.ip_salt) {
    out.ip_salt = genToken(16);
    db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
      .run('ip_salt', out.ip_salt);
  }
  return out;
}

function setSettings(db, obj) {
  const stmt = db.prepare(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
  );
  const tx = db.transaction((entries) => {
    for (const [k, v] of entries) {
      if (k in DEFAULT_SETTINGS && k !== 'ip_salt') stmt.run(k, String(v ?? ''));
    }
  });
  tx(Object.entries(obj));
}

module.exports = { openDb, genCode, genToken, hashIp, getSettings, setSettings, DEFAULT_SETTINGS };
