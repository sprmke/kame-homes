# Phase 7 hosted-dev walk — 2026-10-19

`node scripts/dev/qa-walk-hosted-dev.mjs` against `dev.kamehomes.space`, signed in as the seeded QA accounts. 54 routes × 375 / 768 / 1280 = **162 page loads**.

| Group  | Account              | Routes                                                        |
| ------ | -------------------- | ------------------------------------------------------------- |
| host   | QA owner (Free plan) | 11 org + 18 property routes                                   |
| guest  | QA guest             | 5 `/account/*` routes                                         |
| public | none                 | 20 routes incl. the QA listing, calendar, booking form, a 404 |

## Results

| Check                                        | Result                                                                                                                                      |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Crash / error-boundary text                  | **0**                                                                                                                                       |
| Horizontal overflow at any width             | **0**                                                                                                                                       |
| Bottom tab bar on signed-in pages below `lg` | present on **all** (375 + 768)                                                                                                              |
| Tab titles                                   | Scoped correctly (`Readiness QA Stays - Dashboard`, `QA Monaco 1801 - Bookings`, …). Only the 404 page uses the bare `Kame Homes` fallback. |
| HTTP status of documents                     | all 200                                                                                                                                     |
| Legacy redirects                             | `/activity` → Settings, `/calendar` → Pricing, `/operations` → Notifications. All documented in route guides.                               |
| `/org/:slug/setup-guide`                     | Not-found page. Expected: setup guide is an overlay, not a URL.                                                                             |

## Console errors (deduped)

| Error                                               | Pages                                | Verdict                                                                                                                                                                                                    |
| --------------------------------------------------- | ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CSP Report-Only `upgrade-insecure-requests` ignored | every page                           | Fixed in #147                                                                                                                                                                                              |
| `property-page-view` CORS / `ERR_FAILED`            | public listing, Public Pages preview | **Bug, 0 pageviews ever stored.** Fixed in [#148](https://github.com/sprmke/kame-homes/pull/148), proven in Chromium                                                                                       |
| `google.com/maps/embed/v1/place` **403**            | public listing, Public Pages preview | **Map broken on dev.** Maps key referrer list or Embed API not enabled for `dev.kamehomes.space` (operator, P0-4)                                                                                          |
| `frame-ancestors 'none'` violation                  | Public Pages preview                 | Preview iframes our own origin. Would break when CSP is enforced. Fixed in #147 (`'self'`)                                                                                                                 |
| `marketing-themes` 429                              | property Marketing                   | Free-plan gate (`upgradeHook: marketingStudio`), not a rate limit. Page still shows the full themes UI and **New theme** on Free. Gate mismatch in the in-progress marketing-themes module (other session) |
| `data:,` CSP + `%c%d … NaN`                         | login pages, booking form            | Inside Cloudflare Turnstile iframe. Third-party noise                                                                                                                                                      |

Screenshots: `ui/e2e/artifacts/readiness/` (gitignored). Raw rows: `/tmp/qa-walk.json` at capture time.

## Not covered by this walk

- Role-scoped members (Full Access / Operations / Read Only), paid plan, parking, super admin.
- Click-through flows (submit booking, workflow transitions, uploads, modals). This walk proves every page loads cleanly at three sizes; flows are next.
