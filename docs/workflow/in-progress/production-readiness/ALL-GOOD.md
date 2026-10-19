---
title: 'All good (working)'
status: active
updated: 2026-10-19
stage: in-progress
kind: reference
---

# All good

Only rows with evidence. Everything else stays off this list until the baseline SHA.

| ID                        | Evidence                                                                                                                                                                     |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PR-007 / P0-7             | Branch protection on `develop` and `main`: 1 review, code owners, required check `quality` (`gh api` 2026-10-19)                                                             |
| PR-070                    | `PARKING_INTERIM_UNGATED_FEATURES` removed; parking uses org plan (`useFeatureGate.ts`)                                                                                      |
| PR-071                    | Superhost files present (shared + cron + functions)                                                                                                                          |
| PR-029                    | Error tracking for launch: PostHog. Sentry DSN unset on purpose                                                                                                              |
| PR-091 / D-1              | Guest-token grace 30 days (product)                                                                                                                                          |
| PR-092 / D-2              | In-house pentest first (product)                                                                                                                                             |
| CORS                      | `check-cors-origins.sh` vs `get-health` on `fwor…`: allowed origin echoed; blocked origin not echoed (2026-10-19)                                                            |
| Health                    | `get-health` 200, `db: ok`                                                                                                                                                   |
| Gzip                      | `list-public-pricing-plans` returns gzip                                                                                                                                     |
| Headers                   | HSTS, nosniff, referrer-policy, permissions-policy on `dev.kamehomes.space`. CSP is Report-Only (not all-good; see PR-012)                                                   |
| CI                        | PR #145 all required checks green                                                                                                                                            |
| Local `ci:quality`        | Green 2026-10-19 on dirty tree including concurrent work (Phase 0 evidence)                                                                                                  |
| Hosted-dev deploy         | All migrations + Edge Functions from `3e269a98`, exit 0 (`evidence/phase0-post-deploy-2026-10-19.md`)                                                                        |
| Adversarial auth (anon)   | `adversarialAuthLive.test.ts` 16/16 on hosted dev                                                                                                                            |
| Cross-tenant (A01 / API1) | Outsider + guest denied on 13 org/property reads and writes; owner positive control 200 (`evidence/phase4-qa-seed-and-phase6-idor-2026-10-19.md`)                            |
| Guest booking token       | `get-form` random UUID → 401 Access token required ×25                                                                                                                       |
| Webhook signature         | `paymongo-webhook` bad signature → 401 ×12                                                                                                                                   |
| Cron secrets              | `sd-refund-cron`, `telegram-admin-cron`, `activity-log-retention-cron` without secret → 401                                                                                  |
| Auth captcha (dev)        | Supabase Auth refuses password sign-in without a captcha token (P0-2 done on dev; prod unverified)                                                                           |
| Server validation         | `create-organization` rejects bad contact role and unknown Azure tower                                                                                                       |
| Page loads                | 162 loads (54 routes × 375/768/1280): 0 crashes, 0 horizontal overflow, bottom tab bar on every signed-in phone page (`evidence/phase7-hosted-walk-2026-10-19.md`)           |
| Lighthouse SEO            | `/`, `/properties`, `/parkings`, `/developments` = 100                                                                                                                       |
| Captcha (dev)             | `submit-form` / `claim-sd-voucher` reject missing and bogus Turnstile tokens; real browser passes (P0-1 done on dev)                                                         |
| Guest booking submit      | Real browser on hosted dev → 200, success page, private-bucket uploads, `booking.created` audit, host notification                                                           |
| Server capacity rule      | `submit-form` rejects guests over the property limit                                                                                                                         |
| Host workflow step 1      | `PENDING_REVIEW → PENDING_DOCUMENTS` via UI: GAF PDF, Free-plan email skip toast with Upgrade, `booking.status_changed` audit (`evidence/phase7-booking-flow-2026-10-19.md`) |
| Guest PII storage         | `payment-receipts`, `valid-ids` private; stored URLs 400 anonymously                                                                                                         |
