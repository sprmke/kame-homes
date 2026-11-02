---
stage: planned
title: 'Observability split — 05 operator setup (keys, accounts, settings)'
status: planned
tags: [workflow, planned, observability, sentry, posthog, operator]
updated: 2026-11-01
kind: checklist
---

# 05 — Operator setup (what is needed from you)

Never paste secrets into chat, commits or docs. Put them in Vercel, Supabase secrets,
`ui/.env.local` / `ui/.env.development`, or `supabase/.env.local` (all gitignored).

## 1. Sentry account (Phase O0, before S0)

- [x] Sentry org **`kame-tech`** (US region, `https://us.sentry.io`). Region cannot be
      changed later. CSP already allows US + DE ingest hosts.
- [x] Plan tier: **Developer (free)** — decided 2026-11-01 (D13). 1 user, 5k errors/month,
      30-day retention, 1 cron monitor, default alert rules only. Upgrade to Team at the first
      paying customer. Consequences are applied in doc 03 §S3.1 and §S5.

- [x] Projects: `kame-homes-web` (`javascript-react`) and `kame-homes-edge`
      (`javascript`). DSNs go in gitignored env / Vercel / Supabase secrets only.
- [ ] Org settings → Security & Privacy: data scrubber **on**, default scrubbers **on**,
      "Prevent storing of IP addresses" **on**, additional sensitive fields: `access,
complete, token, otp, code, signature, password, authorization, cookie, apikey`.
- [x] Each project → spike protection on; per-project rate limit (start: web 1,000
      events / hour, edge 500 / hour).
      **Done:** web 1000 / 3600s, edge 500 / 3600s (set via the Sentry API).
- [ ] Inbound filters on `kame-homes-web`: legacy browsers, browser extensions, localhost
      (production env only), web crawlers.

## 2. PostHog (Phase O0 + P1)

- [ ] Confirm projects `kame-homes-prod` and `kame-homes-nonprod` exist and you have the
      project API keys (`phc_…`). These are public keys.
- [ ] Both projects → Settings → Error tracking: **disable** exception autocapture and
      delete any uploaded symbol sets (P1.5).
- [ ] Both projects → Settings → Product analytics: "Filter out internal and test users"
      on; add filter `is_internal = true` (A0.8).
- [ ] Session replay stays off.
- [ ] Data retention per your plan; IP capture: **discard client IP** on (Settings →
      Project → IP data capture).
- [ ] After P1 ships: revoke the PostHog **personal** API key used for source maps.

## 3. Keys and env vars

### Vercel project `kame-homes` (not `guest-form-management-app`)

| Variable                                         | Preview (develop)       | Production (at release)  | Secret?         |
| ------------------------------------------------ | ----------------------- | ------------------------ | --------------- |
| `VITE_SENTRY_DSN`                                | `kame-homes-web` DSN    | same DSN (env separates) | No (public DSN) |
| `VITE_SENTRY_TRACES_SAMPLE_RATE`                 | `0.2`                   | `0.05`                   | No              |
| `SENTRY_AUTH_TOKEN`                              | Org auth token          | same                     | **Yes**         |
| `SENTRY_ORG`                                     | `kame-tech`             | same                     | No              |
| `SENTRY_PROJECT`                                 | `kame-homes-web`        | same                     | No              |
| `VITE_POSTHOG_KEY` / `VITE_POSTHOG_HOST`         | nonprod key / `/ingest` | prod key / `/ingest`     | No              |
| `POSTHOG_PERSONAL_API_KEY`, `POSTHOG_PROJECT_ID` | **remove** after S4     | **remove** after S4      | —               |

`SENTRY_AUTH_TOKEN`: Sentry → Settings → Organization Tokens → **Create New Organization
Token**. Organization tokens no longer take custom scopes — Sentry locks them to **`org:ci`**
(Source Map Upload, Release Creation, Code Mappings), which is what `@sentry/vite-plugin`
needs. The value is shown once. Mark it "Sensitive" in Vercel. Build-time only, never
`VITE_`-prefixed.

An `org:ci` token **cannot** read or write organization settings, so the privacy toggles in
§1 can never be applied through it. They stay a UI task.

**Status 2026-11-02 — Preview scope done** (set via the Vercel CLI against team
`kame-works`): `VITE_SENTRY_DSN`, `VITE_SENTRY_TRACES_SAMPLE_RATE=0.2`, `SENTRY_ORG`,
`SENTRY_PROJECT`. Takes effect on the next Preview build; the current `dev.kamehomes.space`
deployment predates them.

`VITE_SENTRY_DSN` had to be added with `--type config`: Vercel refuses a `VITE_` name that
looks like a credential without an explicit type. That is correct here — the DSN ships in
the browser bundle by design. `SENTRY_ORG` / `SENTRY_PROJECT` landed as type `Secret`; that
is harmless (build-time only) but means `vercel env pull` cannot read them back.

Still missing: **`SENTRY_AUTH_TOKEN`** (needs a token created in Sentry first) and the
**Production** copies of all five at release.

### Supabase secrets

| Secret                            | mt-dev `fwor…`                          | mt-prod (at release)      |
| --------------------------------- | --------------------------------------- | ------------------------- |
| `SENTRY_DSN`                      | `kame-homes-edge` DSN                   | same                      |
| `SENTRY_SAMPLE_RATE_WARNING`      | `1`                                     | `0.25`                    |
| `APP_RELEASE`                     | set by `deploy:supabase:dev`            | set by prod deploy script |
| `POSTHOG_API_KEY`, `POSTHOG_HOST` | nonprod key, `https://us.i.posthog.com` | prod key                  |

mt-dev secrets can be set with the dev deploy tooling. **Production secrets are a prod edge
change: the agent will only run that step when you say `kamewave` in the same message.**
Legacy `zftt…` is not touched in this plan.

### Local

- `ui/.env.development.local`: `VITE_SENTRY_DSN` set (web project) for verification — comment
  it out when you do not want local errors in Sentry. Verified 2026-11-01 with a real
  envelope POST.
- `supabase/.env.local`: `SENTRY_DSN` set (edge project) + `SENTRY_SAMPLE_RATE_WARNING=1`.
  Verified 2026-11-01 with a real envelope POST.
- Still needed: `SENTRY_AUTH_TOKEN` (build-time source maps, S4) in Vercel Preview.

## 4. Alerts and owners (before S5)

- [x] Alert email list (who gets paged): **`sprmke.dev@gmail.com`** (D14). Free tier = one
      user, so this must be the **Sentry account email** — check Settings → Account → Emails.
      There is no per-rule recipient list to configure.
- [x] Telegram relay wanted? **No, not now** (D14). Revisit only if it can stay free.
- [ ] Owners: single-user org today, so routing is a no-op. Fill in at plan upgrade: platform
      default ________, billing / PayMongo ________, inbox / Meta ________, guest booking
      ________.
- [ ] Quiet hours (Asia/Manila) for non-urgent alerts: ________.

## 5. Uptime and crons

- [x] Sentry → Uptime: **created 2026-11-01** for mt-dev via the MCP — `get-health` on
      `kame-homes-edge` and `https://dev.kamehomes.space` on `kame-homes-web`, both 5 min /
      15 s timeout, both `ok`. Production URLs at release.
- [ ] Cron monitors upsert automatically from check-ins (no manual setup). Free tier allows
      **one** — `sd-refund-cron` only (D13). Uptime monitors turned out **not** to share that
      allowance, so both are in place.

## 6. Production rollout checklist (S6 / A7)

1. Legal copy (P1.6) live on production.
2. Vercel production env vars from §3 set; redeploy.
3. Say `kamewave` to set production Supabase secrets (`SENTRY_DSN`, `APP_RELEASE`,
   `SENTRY_SAMPLE_RATE_WARNING`), following `docs/archive/operations/production-deployment.md`.
4. Run the fire drill (doc 06 §4) on production; confirm alerts reach the owners.
5. Confirm PostHog prod Live events show no `$exception` and no token query values.
