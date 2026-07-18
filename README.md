# 🔗 Reflink — affiliate tracking you own forever

## Demo

VIDEO-PLACEHOLDER

![MIT License](https://img.shields.io/badge/license-MIT-green.svg)

Self-hosted affiliate & referral program software. Give every affiliate a tracking link, count their clicks, attribute their conversions, compute their commissions, and export the payout CSV — from one Node process and one SQLite file that you own.

**Pay once. Own it forever. No subscription.** Tapfiliate is $89/mo. FirstPromoter starts at $49/mo. Reflink is **$39 once**.

![Screenshot](docs/screenshot.png)

## Features

- **Tracking links** — `https://your-host/r/CODE` records the click and 302-redirects to your landing page (with `?ref=CODE` appended for client-side pickup)
- **Cookie-based attribution** with a configurable window (30/60/90 days — your call)
- **Conversion tracking two ways**
  - Server-to-server postback: `GET /convert?ref=CODE&order_id=X&amount=49.99` from your checkout webhook (recommended)
  - JS pixel: `<script defer src="https://your-host/track.js"></script>` + `reflink.convert(orderId, amount)`
- **Order-ID dedupe** — the same order can never pay commission twice
- **Commission rules per affiliate** — percent of sale or flat amount
- **Approval workflow** — pending → approved/rejected → paid; nothing pays out by accident
- **Payouts + CSV export** for manual Stripe/PayPal runs
- **Affiliate portal** — affiliates sign in with an access key and see their own clicks, conversions, earnings, link, and your uploaded banners. Nothing else.
- **Leaderboard + dashboard** for you
- **Privacy-sane** — visitor IPs are stored only as salted hashes, never raw

## Quick start

```bash
npm i
npm run build   # build the React dashboard
npm start       # http://localhost:5350  (admin password: "admin" until you set one)
```

Copy `.env.example` to `.env` and set `ADMIN_PASSWORD`.

**Desktop mode:** `npm run desktop` runs the same app as a Windows desktop app (Electron), auto-logged-in, data stored locally. Run it as a desktop app, or deploy to a $5 VPS when you need it public.

**Docker:** `docker compose up -d` — SQLite data persists in a named volume.

## Wiring it into your checkout

1. Create an affiliate → they get `https://your-host/r/CODE`.
2. On purchase, your server calls the postback:
   `GET https://your-host/convert?ref=CODE&order_id=ORDER123&amount=49.99`
   (get `CODE` from the `rl_ref` cookie / `?ref=` param your landing page received).
3. Approve conversions in the dashboard, bundle into a payout, export CSV, pay via Stripe/PayPal.

## vs Tapfiliate

| | Reflink | Tapfiliate |
|---|---|---|
| Price | **$39 once** | $89/mo ($1,068/yr) |
| Data ownership | Your server, your SQLite file | Their cloud |
| Affiliates | Unlimited | Tiered limits |
| Clicks/conversions | Unlimited | Plan-capped |
| Affiliate portal | ✅ | ✅ |
| Payout CSV export | ✅ | ✅ |
| Fancy MLM tiers, auto-payouts, integrations marketplace | ❌ (on purpose) | ✅ |

If you need multi-level marketing trees and 40 native integrations, buy Tapfiliate. If you need "who sent this sale and what do I owe them" — that's Reflink.

## ☕ Skip the setup — get the 1-click installer

The source is MIT and always will be. If you'd rather have a packaged Windows installer with updates: **[Get Reflink on Whop →](https://whop.com/benjisaiempire/reflink)**

## Tech stack

Node 20+ · Express · better-sqlite3 · React 18 · Vite · Tailwind 4 · Framer Motion · Lucide · Electron (desktop mode)

## License

MIT © 2026 Ben (bensblueprints)

## macOS build

See [MAC-BUILD.md](MAC-BUILD.md). Quickest path: GitHub **Actions** tab -> run the **Mac Build** (`mac-build.yml`) workflow to get a downloadable `.dmg` (unsigned - right-click -> Open on first launch).
