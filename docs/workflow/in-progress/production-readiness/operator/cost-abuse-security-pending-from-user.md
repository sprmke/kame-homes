---
stage: in-progress
title: 'Cost/abuse/security — pending from operator (Michael)'
status: active
tags: [security, cost, operator, pending]
updated: 2026-09-12
parent: cost-abuse-security-production-readiness.md
origin_stage: in-progress
readiness: unverified
launch_gate: G
launch_blocker: tbd
last_verified: none
---

# Pending actions — operator / product owner

Items that **require you** (keys, dashboards, or hosted env changes). All code for this module is shipped; run verification after dev deploy.

**Product defaults (no action unless you want to override):** 30-day guest link grace, in-house pentest first, voice after P0-3, `default_plan_code` unset.

## Phase 0 — Infra & keys (no code deploy alone fixes these)

| ID   | Action                                                                                                                              | Why                                                                | When done                                                                         |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ | --------------------------------------------------------------------------------- |
| P0-1 | **Cloudflare Turnstile** on hosted **dev** then **prod**: `TURNSTILE_SECRET_KEY`, `VITE_TURNSTILE_SITE_KEY`, `CAPTCHA_MODE=enforce` | CAPTCHA layer is coded but **inert** without keys                  | [ ]                                                                               |
| P0-2 | Enable **Supabase Auth Attack Protection** captcha in Dashboard                                                                     | Stops OTP bombing on `signInWithOtp`                               | [ ]                                                                               |
| P0-3 | **GCP billing** on Gemini project: budget alert + hard cap; provision paid `GEMINI_API_KEY` (+ `GROQ_API_KEY`) per env              | Voice/AI spend unbounded without alerts                            | [ ]                                                                               |
| P0-4 | **Google Maps** API key: HTTP referrer lock (prod + preview + local); restrict APIs to Maps JS + Places + Embed                     | Scrape/abuse of unrestricted key                                   | [ ]                                                                               |
| P0-5 | **Resend / PayMongo / Meta / Supabase** dashboard spending alerts                                                                   | Early invoice surprise                                             | [ ]                                                                               |
| P0-6 | **Vault audit** on hosted **dev**: every `*_CRON_SECRET` set in Edge secrets + pg_cron Vault                                        | Cron fail-closed on `ENVIRONMENT=production` rejects unset secrets | [ ]                                                                               |
| P0-7 | GitHub **branch protection**: require `CI / quality` on `develop` / `main`                                                          | Merge safety                                                       | [x] 2026-10-19 `gh api`: 1 review + codeowners + check `quality` on both branches |

## Product decisions (need your call)

| ID  | Question                                                                         | Options / notes                                                                                                                 | Decision                           |
| --- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| D-1 | **Guest-token cutover window** — how long do emailed bare-UUID links stay valid? | **Default 30 days** via `GUEST_BOOKING_ACCESS_LEGACY_GRACE_DAYS`; set `GUEST_BOOKING_ACCESS_ENFORCE=true` on dev to verify      | **30d** (override in Edge secrets) |
| D-2 | **External pentest** before `app.kamehomes.space`?                               | In-house §6.2 first ([`cost-abuse-verification.md`](../../../../guides/testing/cost-abuse-verification.md)); paid firm optional | **In-house first**                 |
| D-3 | **Voice receptionist global kill switch** — enable when?                         | After P0-3 + voice quota on dev; quota-before-mint already shipped                                                              | **After P0-3**                     |
| D-4 | **`default_plan_code`** on platform settings — which plan code for new orgs?     | Only **zero-PHP** plans auto-enroll; leave unset until product picks tier                                                       | **Unset** (free tier via UI)       |

## Deploy & verification (after code merges)

| ID  | Action                                                                                                                                       | Notes                                                                                     | When done |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | --------- |
| V-1 | Deploy edge functions + migrations to **hosted dev** (`bun run deploy:supabase:dev`)                                                         | Not prod without `kamewave`. In progress 2026-10-19 from `3e269a98` (backup taken).       | [~]       |
| V-2 | Run abuse/CORS scripts against dev (`abuse-public-endpoints.sh`, `check-cors-origins.sh`, `abuse-storage-anon-read.sh` after `--key-shapes`) | Expect 429 / blocked reads                                                                | [ ]       |
| V-3 | Walk [`captcha-anti-spam-hardening.md`](../audits/captcha-anti-spam-hardening.md) pass/fail keys after P0-1                                  |                                                                                           | [ ]       |
| V-4 | Manual pentest checklist §6.2 (1–2 days)                                                                                                     | Auth, IDOR, uploads, payments                                                             | [ ]       |
| V-5 | Set `GUEST_BOOKING_ACCESS_ENFORCE=true` on dev; keep `GUEST_BOOKING_ACCESS_LEGACY_GRACE_DAYS=30` (default)                                   | See [`cost-abuse-verification.md`](../../../../guides/testing/cost-abuse-verification.md) | [ ]       |

## Sibling plans (separate tracks — not duplicated here)

- [`ai-paid-provider-and-production-quotas.md`](../../../planned/ai-paid-provider-and-production-quotas.md) — platform USD ceiling, voice cost fix
- [`super-admin-service-cost-monitoring.md`](../../../planned/super-admin-service-cost-monitoring.md) — metering, Maps mode, PostHog defaults

---

Revisit this file when unblocking launch. Parent plan: [`cost-abuse-security-production-readiness.md`](../audits/cost-abuse-security-production-readiness.md).
