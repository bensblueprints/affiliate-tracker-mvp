import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Link2, Users, MousePointerClick, DollarSign, Trophy, Settings as SettingsIcon,
  Image, LogOut, Plus, Trash2, Copy, Check, RefreshCw, Download, X, KeyRound
} from 'lucide-react';
import { api, money, timeAgo } from './api.js';

const card = 'bg-zinc-900/70 border border-zinc-800 rounded-2xl';
const input = 'w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm outline-none focus:border-violet-500';
const btn = 'inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors';
const btnPrimary = `${btn} bg-violet-600 hover:bg-violet-500 text-white`;
const btnGhost = `${btn} bg-zinc-800 hover:bg-zinc-700 text-zinc-200`;

function CopyBtn({ text }) {
  const [ok, setOk] = useState(false);
  return (
    <button
      className="text-zinc-400 hover:text-violet-400 p-1"
      title="Copy"
      onClick={() => {
        navigator.clipboard.writeText(text).then(() => {
          setOk(true);
          setTimeout(() => setOk(false), 1200);
        });
      }}
    >
      {ok ? <Check size={14} /> : <Copy size={14} />}
    </button>
  );
}

function Stat({ icon: Icon, label, value, accent = 'text-violet-400' }) {
  return (
    <div className={`${card} p-4 flex items-center gap-3`}>
      <div className={`p-2 rounded-xl bg-zinc-800 ${accent}`}><Icon size={18} /></div>
      <div>
        <div className="text-xs text-zinc-500">{label}</div>
        <div className="text-lg font-bold">{value}</div>
      </div>
    </div>
  );
}

function Login({ onDone }) {
  const [pw, setPw] = useState('');
  const [err, setErr] = useState('');
  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <motion.form
        initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
        className={`${card} p-8 w-full max-w-sm`}
        onSubmit={async (e) => {
          e.preventDefault();
          try { await api.login(pw); onDone(); } catch { setErr('Wrong password'); }
        }}
      >
        <div className="flex items-center gap-2 mb-1 text-violet-400"><Link2 /><span className="text-xl font-black text-white">Reflink</span></div>
        <p className="text-zinc-500 text-sm mb-6">Affiliate tracking you own. Sign in as admin.</p>
        <input className={input} type="password" placeholder="Admin password" value={pw} onChange={(e) => setPw(e.target.value)} autoFocus />
        {err && <p className="text-red-400 text-xs mt-2">{err}</p>}
        <button className={`${btnPrimary} w-full justify-center mt-4`}>Sign in</button>
        <a href="/portal" className="block text-center text-xs text-zinc-500 hover:text-violet-400 mt-4">Affiliate? Go to your portal →</a>
      </motion.form>
    </div>
  );
}

function AffiliateModal({ initial, onClose, onSaved }) {
  const [f, setF] = useState(initial || { name: '', email: '', ref_code: '', commission_type: 'percent', commission_value: 20 });
  const [err, setErr] = useState('');
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  return (
    <div className="fixed inset-0 bg-black/70 z-40 flex items-center justify-center p-4" onClick={onClose}>
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
        className={`${card} p-6 w-full max-w-md`} onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-bold">{initial ? 'Edit affiliate' : 'New affiliate'}</h3>
          <button onClick={onClose} className="text-zinc-500 hover:text-white"><X size={18} /></button>
        </div>
        <div className="space-y-3">
          <input className={input} placeholder="Name" value={f.name} onChange={(e) => set('name', e.target.value)} />
          {!initial && <input className={input} placeholder="Email" value={f.email} onChange={(e) => set('email', e.target.value)} />}
          {!initial && <input className={input} placeholder="Ref code (blank = auto)" value={f.ref_code} onChange={(e) => set('ref_code', e.target.value)} />}
          <div className="flex gap-2">
            <select className={input} value={f.commission_type} onChange={(e) => set('commission_type', e.target.value)}>
              <option value="percent">% of sale</option>
              <option value="flat">Flat per sale</option>
            </select>
            <input className={input} type="number" min="0" step="0.01"
              value={f.commission_type === 'flat' ? f.commission_value / 100 : f.commission_value}
              onChange={(e) => set('commission_value', f.commission_type === 'flat' ? Math.round(Number(e.target.value) * 100) : Number(e.target.value))} />
          </div>
          <p className="text-xs text-zinc-500">{f.commission_type === 'percent' ? 'Percent of each conversion amount.' : 'Fixed amount (in currency units) per conversion.'}</p>
          {initial && (
            <select className={input} value={f.status} onChange={(e) => set('status', e.target.value)}>
              <option value="active">Active</option>
              <option value="paused">Paused</option>
            </select>
          )}
        </div>
        {err && <p className="text-red-400 text-xs mt-2">{err}</p>}
        <button className={`${btnPrimary} w-full justify-center mt-5`} onClick={async () => {
          try {
            const saved = initial ? await api.updateAffiliate(initial.id, f) : await api.createAffiliate(f);
            onSaved(saved);
          } catch (e) { setErr(e.message); }
        }}>{initial ? 'Save' : 'Create affiliate'}</button>
      </motion.div>
    </div>
  );
}

function Affiliates({ currency }) {
  const [rows, setRows] = useState(null);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [revealKey, setRevealKey] = useState(null);
  const load = () => api.affiliates().then(setRows).catch(() => {});
  useEffect(() => { load(); }, []);
  const base = window.location.origin;
  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="font-bold text-lg">Affiliates</h2>
        <button className={btnPrimary} onClick={() => { setEditing(null); setModal(true); }}><Plus size={16} />New affiliate</button>
      </div>
      <div className="grid gap-3">
        {rows?.length === 0 && <div className={`${card} p-8 text-center text-zinc-500`}>No affiliates yet. Create one, send them their link + portal key, and watch the clicks roll in.</div>}
        {rows?.map((a) => (
          <motion.div layout key={a.id} className={`${card} p-4`}>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex-1 min-w-40">
                <div className="font-semibold flex items-center gap-2">
                  {a.name}
                  {a.status === 'paused' && <span className="text-[10px] bg-amber-500/15 text-amber-400 rounded px-1.5 py-0.5 font-bold">PAUSED</span>}
                </div>
                <div className="text-xs text-zinc-500">{a.email}</div>
              </div>
              <div className="text-xs text-zinc-400 flex items-center gap-1 bg-zinc-800/80 rounded-lg px-2 py-1 font-mono">
                {base}/r/{a.ref_code}<CopyBtn text={`${base}/r/${a.ref_code}`} />
              </div>
              <div className="text-xs text-zinc-500">{a.commission_type === 'percent' ? `${a.commission_value}%` : money(a.commission_value, currency)} / sale</div>
              <div className="flex gap-4 text-center text-xs">
                <div><div className="font-bold text-sm">{a.clicks}</div><div className="text-zinc-500">clicks</div></div>
                <div><div className="font-bold text-sm">{a.conversions}</div><div className="text-zinc-500">sales</div></div>
                <div><div className="font-bold text-sm text-emerald-400">{money(a.pending_cents + a.approved_cents + a.paid_cents, currency)}</div><div className="text-zinc-500">earned</div></div>
              </div>
              <div className="flex gap-1">
                <button className="p-2 text-zinc-400 hover:text-violet-400" title="Portal access key" onClick={async () => {
                  const r = await api.regenKey(a.id);
                  setRevealKey({ id: a.id, name: a.name, email: a.email, key: r.portal_key });
                }}><KeyRound size={15} /></button>
                <button className="p-2 text-zinc-400 hover:text-violet-400" title="Edit" onClick={() => { setEditing(a); setModal(true); }}><SettingsIcon size={15} /></button>
                <button className="p-2 text-zinc-400 hover:text-red-400" title="Delete" onClick={async () => {
                  if (confirm(`Delete ${a.name} and all their data?`)) { await api.deleteAffiliate(a.id); load(); }
                }}><Trash2 size={15} /></button>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
      <AnimatePresence>
        {modal && <AffiliateModal initial={editing} onClose={() => setModal(false)} onSaved={() => { setModal(false); load(); }} />}
        {revealKey && (
          <div className="fixed inset-0 bg-black/70 z-40 flex items-center justify-center p-4" onClick={() => setRevealKey(null)}>
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className={`${card} p-6 w-full max-w-md`} onClick={(e) => e.stopPropagation()}>
              <h3 className="font-bold mb-2">Portal access for {revealKey.name}</h3>
              <p className="text-xs text-zinc-500 mb-3">A fresh access key was generated (old one is now invalid). Send these to your affiliate — they sign in at <span className="font-mono text-zinc-300">{base}/portal</span>.</p>
              <div className="bg-zinc-800 rounded-lg p-3 text-xs font-mono break-all">email: {revealKey.email}<br />key: {revealKey.key}<CopyBtn text={revealKey.key} /></div>
              <button className={`${btnGhost} w-full justify-center mt-4`} onClick={() => setRevealKey(null)}>Done</button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Conversions({ currency }) {
  const [rows, setRows] = useState(null);
  const [filter, setFilter] = useState('');
  const load = () => api.conversions(filter).then(setRows).catch(() => {});
  useEffect(() => { load(); }, [filter]);
  const badge = { pending: 'bg-amber-500/15 text-amber-400', approved: 'bg-emerald-500/15 text-emerald-400', rejected: 'bg-red-500/15 text-red-400', paid: 'bg-violet-500/15 text-violet-300' };
  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="font-bold text-lg">Conversions</h2>
        <select className={`${input} w-auto`} value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="">All</option><option value="pending">Pending</option><option value="approved">Approved</option>
          <option value="rejected">Rejected</option><option value="paid">Paid</option>
        </select>
      </div>
      <div className={`${card} overflow-x-auto`}>
        <table className="w-full text-sm">
          <thead><tr className="text-left text-xs text-zinc-500 border-b border-zinc-800">
            <th className="p-3">Order</th><th className="p-3">Affiliate</th><th className="p-3">Amount</th><th className="p-3">Commission</th><th className="p-3">When</th><th className="p-3">Status</th><th className="p-3"></th>
          </tr></thead>
          <tbody>
            {rows?.length === 0 && <tr><td colSpan={7} className="p-8 text-center text-zinc-500">No conversions yet. Point your checkout's postback at <span className="font-mono">/convert?ref=CODE&order_id=…&amount=…</span></td></tr>}
            {rows?.map((c) => (
              <tr key={c.id} className="border-b border-zinc-800/50">
                <td className="p-3 font-mono text-xs">{c.order_id}</td>
                <td className="p-3">{c.affiliate_name || c.ref_code}</td>
                <td className="p-3">{money(c.amount_cents, currency)}</td>
                <td className="p-3 text-emerald-400">{money(c.commission_cents, currency)}</td>
                <td className="p-3 text-zinc-500 text-xs">{timeAgo(c.at)}</td>
                <td className="p-3"><span className={`text-[10px] font-bold rounded px-1.5 py-0.5 ${badge[c.status]}`}>{c.status.toUpperCase()}</span></td>
                <td className="p-3">
                  {c.status === 'pending' && (
                    <div className="flex gap-1">
                      <button className="text-xs text-emerald-400 hover:underline" onClick={async () => { await api.setConversionStatus(c.id, 'approved'); load(); }}>approve</button>
                      <button className="text-xs text-red-400 hover:underline" onClick={async () => { await api.setConversionStatus(c.id, 'rejected'); load(); }}>reject</button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Payouts({ currency }) {
  const [rows, setRows] = useState(null);
  const [affs, setAffs] = useState([]);
  const [sel, setSel] = useState('');
  const [err, setErr] = useState('');
  const load = () => { api.payouts().then(setRows).catch(() => {}); api.affiliates().then(setAffs).catch(() => {}); };
  useEffect(() => { load(); }, []);
  return (
    <div>
      <div className="flex flex-wrap justify-between items-center gap-3 mb-4">
        <h2 className="font-bold text-lg">Payouts</h2>
        <div className="flex gap-2 items-center">
          <select className={`${input} w-auto`} value={sel} onChange={(e) => setSel(e.target.value)}>
            <option value="">Choose affiliate…</option>
            {affs.map((a) => <option key={a.id} value={a.id}>{a.name} — {money(a.approved_cents, currency)} approved</option>)}
          </select>
          <button className={btnPrimary} disabled={!sel} onClick={async () => {
            setErr('');
            try { await api.createPayout(Number(sel)); load(); } catch (e) { setErr(e.message); }
          }}><DollarSign size={15} />Create payout</button>
          <a className={btnGhost} href="/api/payouts/export.csv"><Download size={15} />CSV</a>
        </div>
      </div>
      {err && <p className="text-red-400 text-xs mb-2">{err}</p>}
      <div className={`${card} overflow-x-auto`}>
        <table className="w-full text-sm">
          <thead><tr className="text-left text-xs text-zinc-500 border-b border-zinc-800">
            <th className="p-3">#</th><th className="p-3">Affiliate</th><th className="p-3">Amount</th><th className="p-3">Period</th><th className="p-3">Created</th>
          </tr></thead>
          <tbody>
            {rows?.length === 0 && <tr><td colSpan={5} className="p-8 text-center text-zinc-500">No payouts yet. Approve conversions, then bundle them into a payout per affiliate. Export the CSV for Stripe/PayPal.</td></tr>}
            {rows?.map((p) => (
              <tr key={p.id} className="border-b border-zinc-800/50">
                <td className="p-3 font-mono text-xs">{p.id}</td>
                <td className="p-3">{p.affiliate_name}<span className="text-zinc-500 text-xs ml-2">{p.affiliate_email}</span></td>
                <td className="p-3 text-emerald-400 font-semibold">{money(p.amount_cents, currency)}</td>
                <td className="p-3">{p.period}</td>
                <td className="p-3 text-zinc-500 text-xs">{timeAgo(p.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Dashboard({ currency }) {
  const [data, setData] = useState(null);
  useEffect(() => { api.leaderboard().then(setData).catch(() => {}); }, []);
  if (!data) return null;
  const t = data.totals;
  return (
    <div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <Stat icon={MousePointerClick} label="Total clicks" value={t.clicks} />
        <Stat icon={DollarSign} label="Conversions" value={t.conversions} accent="text-emerald-400" />
        <Stat icon={DollarSign} label="Tracked revenue" value={money(t.revenue_cents, currency)} accent="text-emerald-400" />
        <Stat icon={Trophy} label="Commission owed" value={money(t.commission_cents, currency)} accent="text-amber-400" />
      </div>
      <h2 className="font-bold text-lg mb-3 flex items-center gap-2"><Trophy size={18} className="text-amber-400" />Leaderboard</h2>
      <div className={`${card} overflow-x-auto`}>
        <table className="w-full text-sm">
          <thead><tr className="text-left text-xs text-zinc-500 border-b border-zinc-800">
            <th className="p-3">#</th><th className="p-3">Affiliate</th><th className="p-3">Clicks</th><th className="p-3">Sales</th><th className="p-3">Revenue</th><th className="p-3">Commission</th>
          </tr></thead>
          <tbody>
            {data.leaderboard.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-zinc-500">Add your first affiliate to see the leaderboard.</td></tr>}
            {data.leaderboard.map((a, i) => (
              <tr key={a.id} className="border-b border-zinc-800/50">
                <td className="p-3 font-bold text-zinc-500">{i + 1}</td>
                <td className="p-3 font-semibold">{a.name}<span className="ml-2 text-xs font-mono text-zinc-500">{a.ref_code}</span></td>
                <td className="p-3">{a.clicks}</td>
                <td className="p-3">{a.conversions}</td>
                <td className="p-3">{money(a.revenue_cents, currency)}</td>
                <td className="p-3 text-emerald-400">{money(a.pending_cents + a.approved_cents + a.paid_cents, currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Assets() {
  const [rows, setRows] = useState(null);
  const load = () => api.assets().then(setRows).catch(() => {});
  useEffect(() => { load(); }, []);
  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="font-bold text-lg">Marketing assets</h2>
        <label className={`${btnPrimary} cursor-pointer`}>
          <Plus size={16} />Upload banner
          <input type="file" className="hidden" onChange={async (e) => {
            const f = e.target.files[0];
            if (f) { await api.uploadAsset(f); load(); }
            e.target.value = '';
          }} />
        </label>
      </div>
      <p className="text-xs text-zinc-500 mb-4">Banners and creatives your affiliates can grab from their portal. Hotlink-friendly public URLs.</p>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {rows?.length === 0 && <div className={`${card} p-8 text-center text-zinc-500 col-span-full`}>No assets yet.</div>}
        {rows?.map((a) => (
          <div key={a.id} className={`${card} p-3`}>
            {a.mime.startsWith('image/')
              ? <img src={`/assets/${a.id}/${a.filename}`} alt={a.filename} className="rounded-lg w-full h-28 object-cover mb-2" />
              : <div className="h-28 flex items-center justify-center text-zinc-600 mb-2"><Image size={32} /></div>}
            <div className="text-xs truncate">{a.filename}</div>
            <div className="flex justify-between items-center mt-1">
              <span className="text-[10px] text-zinc-500">{(a.size / 1024).toFixed(0)} KB</span>
              <div className="flex">
                <CopyBtn text={`${window.location.origin}/assets/${a.id}/${a.filename}`} />
                <button className="text-zinc-400 hover:text-red-400 p-1" onClick={async () => { await api.deleteAsset(a.id); load(); }}><Trash2 size={14} /></button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Settings() {
  const [s, setS] = useState(null);
  const [saved, setSaved] = useState(false);
  useEffect(() => { api.settings().then(setS).catch(() => {}); }, []);
  if (!s) return null;
  const base = window.location.origin;
  return (
    <div className="max-w-xl">
      <h2 className="font-bold text-lg mb-4">Settings</h2>
      <div className={`${card} p-5 space-y-4`}>
        <div>
          <label className="text-xs text-zinc-500 block mb-1">Default landing URL (where /r/CODE redirects)</label>
          <input className={input} placeholder="https://yoursite.com" value={s.default_landing_url} onChange={(e) => setS({ ...s, default_landing_url: e.target.value })} />
        </div>
        <div className="flex gap-3">
          <div className="flex-1">
            <label className="text-xs text-zinc-500 block mb-1">Attribution window (days)</label>
            <input className={input} type="number" min="1" value={s.cookie_window_days} onChange={(e) => setS({ ...s, cookie_window_days: e.target.value })} />
          </div>
          <div className="flex-1">
            <label className="text-xs text-zinc-500 block mb-1">Currency</label>
            <input className={input} value={s.currency} onChange={(e) => setS({ ...s, currency: e.target.value.toUpperCase().slice(0, 3) })} />
          </div>
        </div>
        <button className={btnPrimary} onClick={async () => { await api.saveSettings(s); setSaved(true); setTimeout(() => setSaved(false), 1500); }}>
          {saved ? <Check size={15} /> : null}{saved ? 'Saved' : 'Save settings'}
        </button>
      </div>
      <div className={`${card} p-5 mt-4 text-xs text-zinc-400 space-y-3`}>
        <div className="font-bold text-sm text-zinc-200">Integration cheat-sheet</div>
        <div>
          <div className="text-zinc-500 mb-1">1 — Affiliate link (redirect + 302):</div>
          <code className="block bg-zinc-800 rounded p-2 font-mono">{base}/r/CODE?to=https://yoursite.com/pricing</code>
        </div>
        <div>
          <div className="text-zinc-500 mb-1">2 — Server-to-server conversion postback (recommended):</div>
          <code className="block bg-zinc-800 rounded p-2 font-mono break-all">GET {base}/convert?ref=CODE&order_id=ORDER123&amount=49.99</code>
        </div>
        <div>
          <div className="text-zinc-500 mb-1">3 — Or client-side JS pixel:</div>
          <code className="block bg-zinc-800 rounded p-2 font-mono break-all">{`<script defer src="${base}/track.js"></script>`}<br />{`reflink.convert('ORDER123', 49.99)`}</code>
        </div>
      </div>
    </div>
  );
}

// ─── Affiliate portal ─────────────────────────────────────────────────────────
function Portal() {
  const [me, setMe] = useState(null);
  const [form, setForm] = useState({ email: '', key: '' });
  const [err, setErr] = useState('');
  useEffect(() => { api.portalMe().then(setMe).catch(() => {}); }, []);
  const base = window.location.origin;
  if (!me) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <motion.form initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className={`${card} p-8 w-full max-w-sm`}
          onSubmit={async (e) => {
            e.preventDefault();
            try { await api.portalLogin(form.email, form.key); setMe(await api.portalMe()); } catch { setErr('Invalid email or access key'); }
          }}>
          <div className="flex items-center gap-2 mb-1 text-violet-400"><Link2 /><span className="text-xl font-black text-white">Affiliate portal</span></div>
          <p className="text-zinc-500 text-sm mb-6">Sign in with the access key you were sent.</p>
          <input className={`${input} mb-3`} placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <input className={input} type="password" placeholder="Access key" value={form.key} onChange={(e) => setForm({ ...form, key: e.target.value })} />
          {err && <p className="text-red-400 text-xs mt-2">{err}</p>}
          <button className={`${btnPrimary} w-full justify-center mt-4`}>Sign in</button>
        </motion.form>
      </div>
    );
  }
  const { affiliate: a, stats: s, currency } = me;
  const link = `${base}/r/${a.ref_code}`;
  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-2 text-violet-400"><Link2 /><span className="text-xl font-black text-white">Reflink</span><span className="text-zinc-500 text-sm">/ {a.name}</span></div>
        <button className={btnGhost} onClick={async () => { await api.portalLogout(); setMe(null); }}><LogOut size={15} />Sign out</button>
      </div>
      <div className={`${card} p-5 mb-4`}>
        <div className="text-xs text-zinc-500 mb-1">Your tracking link ({a.commission_type === 'percent' ? `${a.commission_value}% per sale` : `${money(a.commission_value, currency)} per sale`})</div>
        <div className="flex items-center gap-2 font-mono text-sm bg-zinc-800 rounded-lg px-3 py-2">{link}<CopyBtn text={link} /></div>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
        <Stat icon={MousePointerClick} label="Clicks" value={s.clicks} />
        <Stat icon={DollarSign} label="Conversions" value={s.conversions} accent="text-emerald-400" />
        <Stat icon={DollarSign} label="Pending" value={money(s.pending_cents, currency)} accent="text-amber-400" />
        <Stat icon={Check} label="Approved" value={money(s.approved_cents, currency)} accent="text-emerald-400" />
        <Stat icon={Trophy} label="Paid out" value={money(s.paid_cents, currency)} />
      </div>
      <h3 className="font-bold mb-2">Recent conversions</h3>
      <div className={`${card} overflow-x-auto mb-6`}>
        <table className="w-full text-sm">
          <thead><tr className="text-left text-xs text-zinc-500 border-b border-zinc-800"><th className="p-3">Order</th><th className="p-3">Amount</th><th className="p-3">Commission</th><th className="p-3">Status</th><th className="p-3">When</th></tr></thead>
          <tbody>
            {me.recent_conversions.length === 0 && <tr><td colSpan={5} className="p-6 text-center text-zinc-500">Nothing yet — share your link!</td></tr>}
            {me.recent_conversions.map((c, i) => (
              <tr key={i} className="border-b border-zinc-800/50">
                <td className="p-3 font-mono text-xs">{c.order_id}</td>
                <td className="p-3">{money(c.amount_cents, currency)}</td>
                <td className="p-3 text-emerald-400">{money(c.commission_cents, currency)}</td>
                <td className="p-3 text-xs">{c.status}</td>
                <td className="p-3 text-zinc-500 text-xs">{timeAgo(c.at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {me.assets.length > 0 && (
        <>
          <h3 className="font-bold mb-2">Marketing assets</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {me.assets.map((as) => (
              <a key={as.id} href={`/assets/${as.id}/${as.filename}`} target="_blank" rel="noreferrer" className={`${card} p-3 hover:border-violet-500`}>
                {as.mime.startsWith('image/')
                  ? <img src={`/assets/${as.id}/${as.filename}`} alt={as.filename} className="rounded-lg w-full h-24 object-cover mb-2" />
                  : <div className="h-24 flex items-center justify-center text-zinc-600 mb-2"><Image size={28} /></div>}
                <div className="text-xs truncate">{as.filename}</div>
              </a>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default function App() {
  const isPortal = window.location.pathname.startsWith('/portal');
  const [authed, setAuthed] = useState(null);
  const [tab, setTab] = useState('dashboard');
  const [currency, setCurrency] = useState('USD');
  useEffect(() => {
    if (isPortal) return;
    api.me().then((r) => setAuthed(r.authed)).catch(() => setAuthed(false));
  }, []);
  useEffect(() => {
    if (authed) api.settings().then((s) => setCurrency(s.currency || 'USD')).catch(() => {});
  }, [authed]);

  if (isPortal) return <Portal />;
  if (authed === null) return null;
  if (!authed) return <Login onDone={() => setAuthed(true)} />;

  const tabs = [
    ['dashboard', 'Dashboard', Trophy],
    ['affiliates', 'Affiliates', Users],
    ['conversions', 'Conversions', DollarSign],
    ['payouts', 'Payouts', Download],
    ['assets', 'Assets', Image],
    ['settings', 'Settings', SettingsIcon]
  ];
  return (
    <div className="min-h-screen">
      <header className="border-b border-zinc-800/70 sticky top-0 bg-zinc-950/80 backdrop-blur z-30">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center gap-6">
          <div className="flex items-center gap-2 text-violet-400"><Link2 size={20} /><span className="font-black text-white">Reflink</span></div>
          <nav className="flex gap-1 flex-1">
            {tabs.map(([id, label, Icon]) => (
              <button key={id} onClick={() => setTab(id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm ${tab === id ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-white'}`}>
                <Icon size={14} />{label}
              </button>
            ))}
          </nav>
          <button className="text-zinc-500 hover:text-white" title="Sign out" onClick={async () => { await api.logout(); setAuthed(false); }}><LogOut size={16} /></button>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-6 py-8">
        {tab === 'dashboard' && <Dashboard currency={currency} />}
        {tab === 'affiliates' && <Affiliates currency={currency} />}
        {tab === 'conversions' && <Conversions currency={currency} />}
        {tab === 'payouts' && <Payouts currency={currency} />}
        {tab === 'assets' && <Assets />}
        {tab === 'settings' && <Settings />}
      </main>
    </div>
  );
}
