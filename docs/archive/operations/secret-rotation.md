---
title: 'Secret rotation runbook'
status: active
tags: [operations, security]
updated: 2026-09-18
---

# Secret rotation runbook

How to rotate each class of secret without leaving the previous value live longer than needed. **Do not commit values.** Templates: `ui/.env.example`, `supabase/.env.example`.

Production Edge / Vault changes still require **`kamewave`** in the same agent message (`.cursor/rules/no-prod-deploy.mdc`). This runbook is the procedure; it is not permission to deploy.

## Order that always applies

1. Mint the **new** value in the vendor console (or generate HMAC/OTP material).
2. Set it on **every consumer** (Supabase Edge secrets, Vercel env, GitHub Actions secrets, local `supabase/.env.local`) **before** revoking the old one, unless the vendor supports two live keys.
3. Deploy or restart so running isolates pick up the new value.
4. Revoke / delete the old value.
5. Confirm a smoke path that uses the secret still works.
6. If the old value was ever in a client bundle, logs, or a chat: treat it as **already leaked** and rotate immediately (launch audit P1-4 class).

## Per secret

| Secret                                        | Where it lives                                                           | Blast radius if leaked                                               | Rotation                                                                                                                                                                                                                                                  |
| --------------------------------------------- | ------------------------------------------------------------------------ | -------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `SUPABASE_SERVICE_ROLE_KEY`                   | Edge only. Never `VITE_*`.                                               | Bypasses RLS. Full DB + Storage.                                     | Dashboard → API keys → rotate service_role. Update Edge secrets + any deploy scripts. Guest HMAC tokens that **fell back** to this key (`guestBookingAccessToken.ts`) must be reminted or wait out TTL. Prefer a dedicated `GUEST_BOOKING_ACCESS_SECRET`. |
| `SUPABASE_ANON_KEY`                           | Browser + Edge. Public by design.                                        | Anon RLS paths only.                                                 | Rotate in Dashboard; update Vercel `VITE_SUPABASE_ANON_KEY` and Edge. Not a privilege boundary.                                                                                                                                                           |
| `GUEST_BOOKING_ACCESS_SECRET`                 | Edge.                                                                    | Forged `?access=` tokens for guest PII readers until TTL (180 days). | Set new secret, keep old grace if you dual-verify (not implemented today — rotating **invalidates all outstanding tokens immediately**).                                                                                                                  |
| `ADMIN_ALLOWED_EMAILS` / `SUPER_ADMIN_EMAILS` | Edge.                                                                    | Privilege grant/revoke.                                              | Edit the allow list; sessions stay valid until JWT expiry unless you sign the user out.                                                                                                                                                                   |
| `PAYMONGO_WEBHOOK_SECRET` / secret key        | Edge + PayMongo dashboard.                                               | Fake payment webhooks; charge/refund APIs.                           | Dual-secret window in PayMongo if available, then swap Edge, then drop old.                                                                                                                                                                               |
| `RESEND_API_KEY` / inbound webhook secret     | Edge.                                                                    | Send as the domain; inbound approval spoof.                          | Rotate in Resend; update Edge + webhook signing secret together.                                                                                                                                                                                          |
| `CRON_SECRET` / per-job cron secrets (Vault)  | Hosted Vault + `pg_cron` headers.                                        | Trigger paid crons (refunds, Telegram, calendar sync).               | Fail-closed in production if unset. Rotate Vault, then confirm next cron tick.                                                                                                                                                                            |
| Google OAuth client secret                    | Edge + Google Cloud.                                                     | Host/guest Google sign-in.                                           | New client secret in GCP; update Edge + Vercel redirect URIs unchanged.                                                                                                                                                                                   |
| Meta app secret / webhook verify token        | Edge.                                                                    | Inbox OAuth + webhook spoof.                                         | Rotate in Meta developer console; update Edge; re-verify webhook.                                                                                                                                                                                         |
| Gemini / Groq API keys                        | Edge (`GEMINI_API_KEYS` list).                                           | Unbounded AI spend.                                                  | Append new key, deploy, drop old. Platform cap still applies.                                                                                                                                                                                             |
| PostHog project API key                       | Vercel `VITE_*` (write-only public key) + Edge personal API key if used. | Event injection; not DB access.                                      | Rotate in PostHog; public write keys are expected in the bundle.                                                                                                                                                                                          |
| Turnstile secret                              | Edge.                                                                    | CAPTCHA bypass on public writes.                                     | Rotate in Cloudflare; update Edge; keep site key in Vercel in sync.                                                                                                                                                                                       |

## After a suspected leak

1. Rotate **that** secret first (table above).
2. Grep `ui/dist` and CI artifacts for the prefix (`sb_secret_`, `sk_`, `re_`).
3. Check PostHog / edge logs for the raw value (properties should already be denylisted).
4. If a guest HMAC secret leaked, set `GUEST_BOOKING_ACCESS_ENFORCE=true` only after tokens are reminted or you accept 180-day stale links dying.

Related: [`production-deployment.md`](./production-deployment.md) (secrets checklist), [`docs/architecture/validation-and-env.md`](../../architecture/validation-and-env.md).
