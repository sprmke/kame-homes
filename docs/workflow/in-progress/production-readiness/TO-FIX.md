---
title: 'To fix (working)'
status: active
updated: 2026-10-19
stage: in-progress
kind: reference
---

# To fix

Working copy of ledger rows that block or delay launch. Final grouping is Phase 10; this list is live.

## Waiting on you (merge)

| PR                                                    | What                                                                                                                        | CI        |
| ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | --------- |
| [#145](https://github.com/sprmke/kame-homes/pull/145) | CI guards fix. `develop` CI + CD Dev are red until this merges                                                              | green     |
| [#146](https://github.com/sprmke/kame-homes/pull/146) | Readiness folder, ledger, cards, evidence (stacked on #145)                                                                 | green     |
| [#147](https://github.com/sprmke/kame-homes/pull/147) | Start call 44px, for-hosts em dash, footer heading order, CSP console error, CSP `frame-ancestors 'self'` (stacked on #145) | rerunning |
| [#148](https://github.com/sprmke/kame-homes/pull/148) | Public listing page views never stored from browsers (stacked on #145)                                                      | rerunning |

## Blockers

| ID     | Gate | Tag | Item                                                                                                                                                                                                                                                      | Owner           |
| ------ | ---- | --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------- |
| PR-025 | F    | 🔴  | GitHub `development` missing `DEV_DB_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_DB_PASSWORD`, `SMOKE_PROPERTY_SLUG`                                                                                                                                             | operator        |
| PR-119 | C    | 🔴  | **Down payment mismatch.** Guest form charges ₱1,500 × nights (hard-coded, every property); host uses the property's flat `default_down_payment`. QA booking: guest paid ₱10,500, host record ₱1,500. Needs product decision, then one rule on both sides | product → agent |
| PR-120 | B    | 🟡  | `guest-chat-attachments` bucket is public; guests may share IDs in chat                                                                                                                                                                                   | agent           |
| PR-116 | A    | 🔴  | Google Maps embed **403** on `dev.kamehomes.space` (public listing map broken). Add the dev domain to the Maps key referrers / enable Maps Embed API                                                                                                      | operator        |
| PR-117 | C    | 🔴  | Public listing page views never stored (Host Analytics traffic empty). Fix in #148                                                                                                                                                                        | agent           |
| PR-118 | A    | 🟡  | Marketing on Free: UI shows full themes + **New theme**, API refuses (`marketingStudio`). Align gate (in-progress marketing-themes module)                                                                                                                | other session   |
| PR-001 | B    | ⛔  | Turnstile enforce on hosted UI                                                                                                                                                                                                                            | operator        |
| PR-003 | D    | ⛔  | Paid AI billing cap                                                                                                                                                                                                                                       | operator        |
| PR-008 | B    | 🟡  | Guest-token write paths after grace (read path verified 401)                                                                                                                                                                                              | agent           |
| PR-024 | F    | ⛔  | Restore drill with measured RTO (needs `DEV_DB_URL`)                                                                                                                                                                                                      | operator        |
| PR-030 | C    | ⛔  | PayMongo sandbox E2E                                                                                                                                                                                                                                      | operator        |
| PR-088 | G    | ⏸️  | mt-prod / cutover not this track                                                                                                                                                                                                                          | operator        |

Hosted-dev deploy (PR-076) **done** 2026-10-19 from `3e269a98`.

## High, operator

P0-2, P0-4, P0-5, P0-6, PR-026, PR-027, PR-041, PR-056, PR-084, PR-085, PR-073.

## High, agent (needs seed + accounts)

PR-005, PR-013, PR-014, PR-016, PR-019, PR-023, PR-052, PR-060, PR-064.

## Decisions

PR-012 CSP enforce · PR-113 brand teal contrast · PR-032 double-booking DB constraint · PR-031 parking refund path · PR-035 payout scale · PR-042 budget fail-closed · PR-059 capacity targets · PR-082 RPO/RTO.

## Score improvements by page

Sources: Lighthouse perf (mobile, throttled) + a11y/BP/SEO (desktop) on `dev.kamehomes.space`, 2026-10-19.

| ID     | Page / section                                                                                                                                              | Score today                   | Change                                                                                                          | Expected gain            |
| ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- | --------------------------------------------------------------------------------------------------------------- | ------------------------ |
| PR-113 | **All CTAs** (`--primary` in `ui/src/index.css`), PWA Install button, `/for-hosts/login` brand panel, pricing plan badges, `/properties` active filter pill | A11y 94–96                    | Darken teal for text-bearing fills (about 30% L for 4.5:1 with white) or use dark text on teal. Brand decision. | A11y → 100 on most pages |
| PR-114 | `/services`, `/for-hosts`, `/for-hosts/pricing`, `/for-hosts/login`, `/for-guests/login`, `/about`, `/contact`, `/support`, `/privacy`, `/terms`            | SEO 91                        | Add `usePageMeta({ description })` (helper exists, used by listing pages)                                       | SEO → 100                |
| PR-040 | `/` landing hero + featured carousel                                                                                                                        | Perf 57, LCP 12.1s, 2.5 MiB   | Priority-load only the first hero image, lazy the rest, smaller AVIF/WebP widths, defer tour/motion chunks      | Perf 75+                 |
| PR-040 | `/properties/:slug/form` guest form                                                                                                                         | Perf 57, LCP 15.2s, CLS 0.086 | Split form steps, defer upload/PDF/map chunks, reserve height for async sections                                | Perf 70+, CLS < 0.05     |
| PR-040 | `/properties`, `/parkings`, `/for-hosts/pricing`                                                                                                            | Perf 58–60, LCP 8–10s         | Ship list skeleton in first chunk; shrink vendor chunk; preconnect Supabase                                     | Perf 70+                 |
| PR-112 | Auth guard shells: `/org/*`, `/admin` (signed-out)                                                                                                          | Perf 46, **CLS 0.270**        | Guard renders a full-height skeleton matching the redirect target so layout does not jump                       | CLS < 0.1, Perf 60+      |
| PR-108 | `/for-hosts` tour mock                                                                                                                                      | —                             | Left rail labels clip at 1024px                                                                                 | UX                       |
| PR-103 | `dev.kamehomes.space`                                                                                                                                       | indexable                     | `X-Robots-Tag: noindex` on non-prod Vercel env                                                                  | keeps dev out of Google  |
| —      | Best practices 92 everywhere                                                                                                                                | 92                            | Remaining hit is no public source maps (intended). CSP console error fixed in #147.                             | stays 92 (by design)     |

## Low (UX found 2026-10-19)

| ID     | Item                                                                 |
| ------ | -------------------------------------------------------------------- |
| PR-108 | Em dash fixed in #147. Tour rail clip remains.                       |
| PR-110 | Start call 43.999px. Fixed in #147.                                  |
| PR-115 | Footer heading order + CSP Report-Only console error. Fixed in #147. |
