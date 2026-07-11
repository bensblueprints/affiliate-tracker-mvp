# Reflink — Launch Strategy

## Target communities

- **r/SaaS** — angle: "I replaced my $89/mo affiliate tool with a $39 one-time app; here's the math." Show real screenshots, no links in body, link in comments per sub norms.
- **r/selfhosted** — angle: technical write-up: one Express process, SQLite, salted-IP-hash privacy. This crowd converts on "MIT + docker compose".
- **r/EntrepreneurRideAlong / r/indiehackers** — angle: build story + honest pricing math, ask for feedback on the approval workflow.
- **Indie Hackers product thread** — post the pricing-math card and the portal screenshot.
- **r/juststart / r/Affiliatemarketing** — angle: for program OWNERS (not affiliates): "start an affiliate program without the SaaS bill." Read rules; no affiliate links.

## Hacker News — Show HN draft

**Title:** Show HN: Reflink — self-hosted affiliate tracking (Express + SQLite, MIT)

I run a small software business and wanted an affiliate program without paying Tapfiliate $89/mo for what is functionally a referral code table. Reflink is one Node process + one SQLite file: tracking links with a configurable attribution window, server-to-server conversion postbacks (with order-ID dedupe), per-affiliate commission rules, an affiliate portal, and a payout CSV for manual Stripe/PayPal runs.

Design choices HN might care about: IPs are only stored as salted hashes; payouts are deliberately manual (export CSV — I don't move money); the embed pixel never touches the DOM. MIT source; I sell a packaged installer for people who don't want to babysit a VPS.

## SEO keywords (10)

1. tapfiliate alternative
2. self hosted affiliate program software
3. affiliate tracking software one time purchase
4. firstpromoter alternative
5. referral tracking system open source
6. affiliate program software small business
7. self hosted referral program
8. affiliate link tracker self hosted
9. affiliate software without monthly fee
10. run your own affiliate program

## AppSumo / PitchGround pitch

Reflink gives every SaaS and course creator a full affiliate program they own outright: tracking links, cookie attribution, conversion postbacks with dedupe, commission rules, an affiliate portal, and payout CSV export — self-hosted on any $5 VPS or run as a Windows desktop app. No per-affiliate limits, no monthly fee, MIT source. Competitors charge $49–$199/mo for the same core loop; Reflink is a one-time license, making it a perfect LTD: your customers keep 100% of the value forever, and so do you.

## Price math

**$39 one-time** vs Tapfiliate $89/mo → pays for itself in **14 days**; vs FirstPromoter $49/mo → **24 days**. Three years of Tapfiliate = $3,204. Reflink = $39. That's 82× cheaper.
