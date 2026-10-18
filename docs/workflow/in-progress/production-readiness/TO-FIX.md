---
title: 'To fix (working)'
status: active
updated: 2026-10-19
stage: in-progress
kind: reference
---

# To fix

Working copy of ledger rows that block or delay launch. Final grouping is Phase 10; this list is live.

## Blockers

| ID     | Gate | Tag | Item                                                                                   | Owner    |
| ------ | ---- | --- | -------------------------------------------------------------------------------------- | -------- |
| PR-076 | F    | 🔴  | Hosted-dev still catching up (functions deploy in flight)                              | agent    |
| PR-025 | F    | 🔴  | GitHub `development` missing `DEV_DB_URL` / anon / db password / `SMOKE_PROPERTY_SLUG` | operator |
| PR-001 | B    | ⛔  | Turnstile enforce on hosted UI                                                         | operator |
| PR-003 | D    | ⛔  | Paid AI billing cap                                                                    | operator |
| PR-008 | B    | 🟡  | Guest-token IDOR remaining after grace                                                 | agent    |
| PR-024 | F    | ⛔  | Restore drill with measured RTO                                                        | operator |
| PR-030 | C    | ⛔  | PayMongo sandbox E2E                                                                   | operator |
| PR-088 | G    | ⏸️  | mt-prod / cutover not this track                                                       | operator |

## High, operator

P0-2, P0-4, P0-5, P0-6, PR-026, PR-027, PR-041, PR-056, PR-084, PR-085, PR-073.

## High, agent (after baseline SHA)

PR-005, PR-013, PR-014, PR-016, PR-019, PR-023, PR-052, PR-060, PR-064, PR-069.

## Decisions

PR-012 CSP enforce · PR-032 double-booking DB constraint · PR-031 parking refund path · PR-035 payout scale · PR-042 budget fail-closed · PR-059 capacity targets · PR-082 RPO/RTO.

## New checklists (not yet executed)

PR-100–PR-107 (privacy, email, a11y, SEO noindex on **dev**, races, browsers, third-party down, supply chain).

SEO probe: `dev.kamehomes.space` has **no** `x-robots-tag` and `robots.txt` allows `/` (PR-103).

## Low (UX found 2026-10-19)

| ID     | Item                                                                                                                                                                                                  |
| ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PR-108 | `/for-hosts` hero uses an em dash (`connected—so`). Banned by `human-copy`. Tour mock left rail clips labels at this viewport.                                                                        |
| PR-109 | `/properties` empty (0 listings) while functions still deploying. Re-test after V-1. If still empty, listing search RPC / seed is 🔴.                                                                 |
| PR-110 | Local `ci:quality` in worktree: `voiceReceptionistConsent` Start call height `43.999` vs `44`. GitHub `e2e-smoke` on #145 was green. Treat as subpixel flake; round the assertion or add 1px `min-h`. |
