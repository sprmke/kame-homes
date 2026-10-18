---
title: 'Operator actions for launch'
status: active
updated: 2026-10-19
stage: in-progress
kind: reference
readiness: operator-blocked
launch_gate: G
---

# Operator actions

Merged from P0/D/V, GitHub env, and checklist 4.4. How to verify each row.

Parent detail: [`cost-abuse-security-pending-from-user.md`](./cost-abuse-security-pending-from-user.md).

| ID                 | Action                                                                                                     | Verify                                                                                                                                 | Status 2026-10-19                          |
| ------------------ | ---------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| P0-1               | Turnstile on hosted UI + `CAPTCHA_MODE=enforce`                                                            | Edge has `TURNSTILE_SECRET_KEY` + `CAPTCHA_MODE`. Confirm Vercel Preview `VITE_TURNSTILE_SITE_KEY` and a real challenge on `/sign-in`. | ⛔ Edge names present; UI enforce unproven |
| P0-2               | Supabase Auth Attack Protection captcha                                                                    | Dashboard → Auth → Attack Protection                                                                                                   | ⛔                                         |
| P0-3               | GCP billing cap + paid Gemini/Groq                                                                         | GCP budget UI; Edge `GEMINI_API_KEYS` / `GROQ_API_KEY` exist (rotation, not necessarily paid)                                          | ⛔                                         |
| P0-4               | Maps key HTTP referrer lock                                                                                | Google Cloud credentials page                                                                                                          | ⛔                                         |
| P0-5               | Spend alerts: Resend, PayMongo, Meta, Supabase                                                             | Each dashboard                                                                                                                         | ⛔                                         |
| P0-6               | Vault `*_CRON_SECRET` matches Edge                                                                         | 23 cron secret **names** on Edge. Confirm pg_cron Vault copies                                                                         | ⛔ partial                                 |
| P0-7               | Branch protection `quality`                                                                                | `gh api …/branches/{develop,main}/protection`                                                                                          | ✅                                         |
| PR-025             | GitHub env `development`: `DEV_DB_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_DB_PASSWORD`, `SMOKE_PROPERTY_SLUG` | `gh api …/environments/development/secrets`                                                                                            | 🔴 missing                                 |
| V-1                | Hosted-dev deploy current `develop`                                                                        | After merge of #145; functions deploy in flight from `3e269a98`                                                                        | 🟡                                         |
| V-2                | Abuse + CORS scripts                                                                                       | CORS on `get-health` **OK** 2026-10-19. Abuse scripts after full function deploy                                                       | 🟡                                         |
| V-3                | Captcha pass/fail keys                                                                                     | After P0-1                                                                                                                             | ⛔                                         |
| V-4                | In-house pentest §6.2                                                                                      | [`pentest-log.md`](../security/pentest-log.md)                                                                                         | 🟡                                         |
| V-5                | Guest token enforce                                                                                        | `GUEST_BOOKING_ACCESS_ENFORCE` **is** set on Edge. Walk old vs new booking links                                                       | 🟡                                         |
| PostHog            | Two projects + Vercel source maps                                                                          | Edge `POSTHOG_API_KEY` set. Prod/nonprod project split unverified                                                                      | ⛔                                         |
| PayMongo sandbox   | Test keys + webhook on dev                                                                                 | `PAYMONGO_SECRET_KEY` + `PAYMONGO_WEBHOOK_SECRET` names present. Run checkout                                                          | ⛔ E2E                                     |
| VAPID / push       | Already on Edge                                                                                            | Real-device QA                                                                                                                         | 🟡                                         |
| Resend DNS         | SPF/DKIM/DMARC                                                                                             | checklist 32                                                                                                                           | ⛔                                         |
| Auth redirect URLs | Supabase Auth allowlist includes `dev.kamehomes.space`                                                     | Dashboard                                                                                                                              | 🟡                                         |
