# Product Hunt Launch — Reflink

## Name
Reflink

## Tagline (60 chars)
Self-hosted affiliate tracking. Pay once, no $89/mo.

## Description (260 chars)
Run your own affiliate program: tracking links, click + conversion attribution, commission rules, an affiliate portal, and payout CSV export. One Node process, one SQLite file, your server. $39 once vs Tapfiliate's $89/mo. MIT source, desktop mode included.

## Full description

Affiliate software is fundamentally a referral code and a spreadsheet of who gets paid what — and the SaaS versions charge $49–$89 **per month** for it, forever, scaling with your success.

Reflink is the version you own:

- **Tracking links** — `/r/CODE` records the click, sets a configurable attribution cookie (30/60/90 days), and redirects to your landing page
- **Conversions two ways** — server-to-server postback URL from your checkout webhook, or a 1-line JS pixel with `reflink.convert(orderId, amount)`
- **Order-ID dedupe** — one order can never pay out twice
- **Commission rules per affiliate** — percent or flat, with a pending → approved → paid workflow
- **Affiliate portal** — each affiliate signs in with an access key and sees only their own clicks, sales, earnings, and your uploaded banners
- **Payout CSV** for manual Stripe/PayPal runs, plus a leaderboard so you know who to woo
- **Privacy-sane** — IPs stored as salted hashes only
- One Node process + SQLite. Docker compose for a $5 VPS, or run it as a Windows desktop app.

MIT-licensed. The $39 gets you the 1-click installer.

Tapfiliate is $1,068/yr. FirstPromoter is $588+/yr. Reflink pays for itself in 14 days.

## Maker first comment

Hey PH 👋

I got tired of paying $89/mo to know that "jake_reviews sent 3 sales this month." That's a database row. I was renting a database row.

So I built Reflink: the smallest honest affiliate tracker. It does links, attribution, commissions, a portal, and a payout CSV — and refuses to do the other 90% of enterprise affiliate suites (MLM trees, auto-payout rails, fraud ML). For a solo founder or small SaaS paying 5–50 affiliates, this is the whole job.

Honest notes:
- Payouts are manual by design — you export a CSV and pay via Stripe/PayPal. I don't want your money movement running through my code unaudited.
- Attribution is last-click with a cookie window you control. No fingerprinting.
- Source is MIT on GitHub; $39 gets the packaged installer + updates. `git clone` works too, and I'm fine with that.

Happy to answer anything about attribution edge cases or why order-ID dedupe is the most important line in the codebase.

## Gallery shots (5)

1. **Dashboard/leaderboard** — dark UI, totals up top (clicks, conversions, revenue, commission owed), affiliate leaderboard. Caption: "Who sent what — one glance."
2. **Affiliate list** — tracking links with copy buttons, per-affiliate commission rules. Caption: "Every affiliate, one link, your rules."
3. **Conversions table** — pending/approved/paid badges, approve/reject inline. Caption: "Nothing pays out by accident."
4. **Affiliate portal** — what your affiliate sees: their link, their earnings, banners. Caption: "A portal your affiliates will actually use."
5. **Pricing math card** — "$39 once vs $1,068/yr on Tapfiliate." Caption: "Pays for itself in 14 days."
