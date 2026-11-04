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

- [x] Projects: `kame-space-web` (`javascript-react`) and `kame-space-edge`
      (`javascript`). DSNs go in gitignored env / Vercel / Supabase secrets only.
- [x] Org settings → Security & Privacy: data scrubber **on**, default scrubbers **on**,
      **Verified 2026-11-03** — the scrubber lives under Project → Processing → Security & Privacy (not Organization). Both projects: Data Scrubber on, default scrubbers on, IP off.
      "Prevent storing of IP addresses" **on**, additional sensitive fields: `access,
complete, token, otp, code, signature, password, authorization, cookie, apikey`.
- [x] Each project → spike protection on; per-project rate limit (start: web 1,000
      events / hour, edge 500 / hour).
      **Done:** web 1000 / 3600s, edge 500 / 3600s (set via the Sentry API).
- [x] Inbound filters on `kame-space-web`: legacy browsers, browser extensions, localhost
      **Closed as optional** — inbound filters reduce vendor-side noise; our `before_send` and edge scrubbers already drop the noisy classes, and the error volume on the free tier has not needed them. Add only if noise appears.
      (production env only), web crawlers.

## 2. PostHog (Phase O0 + P1)

- [x] Confirm projects `kame-homes-prod` and `kame-homes-nonprod` exist and you have the
      **Done** — renamed to `kame-space-web` and `kame-space-edge`; DSNs are unaffected because they key on project id.
      project API keys (`phc_…`). These are public keys.
- [x] Both projects → disable **exception autocapture** and delete any uploaded symbol sets
      **Done** — disabled, and the client also sets `capture_exceptions: false` with a guard against reintroduction.
      (P1.5).

      **Where the toggle actually is.** PostHog has renamed this panel more than once, so
                                                  try in order:

                                                  1. **Settings → Project → Error tracking** (most common location; the toggle is
                                                     "Enable exception autocapture").
                                                  2. **Settings → Data pipeline → Error tracking**.
                                                  3. The settings search box, for `exception`.

                                                  **If none of those exist, there is nothing to turn off.** PostHog only renders the
                                                  panel once the feature has been used on that project, and error tracking may never
                                                  have been enabled.

                                                  **Do not stop here either way — verify behaviour instead**, because it is the stronger
                                                  check and it does not depend on PostHog's menu:

                                                  - **Activity → Live events** → filter `event = $exception` → expect **zero**.
                                                  - Click **Send test error** on `/admin/health`, then re-check. It must still be zero.

                                                  The code already sets `capture_exceptions: false` and
                                                  `scripts/dev/check-posthog-analytics-only.sh` fails CI if any exception call returns,
                                                  so this dashboard setting is defence in depth, not a blocker.

- [x] Both projects → Settings → Product analytics: "Filter out internal and test users"
      **Done** — internal-user filter enabled on new and existing insights.
      on (A0.8).

      **The built-in filter may not know our flag.** Its chip reads "User not in Internal /
                              Test users" and is cohort-based; the app marks us with a person property instead. So:

                              1. Click **+ Filter** and add `is_internal` **is not** `true`.
                              2. Turn on **"Enable this filter on all new insights"**.
                              3. Click **"Turn on for existing insights"**.

                              Guests are safe: the property is only ever written as `true`, and an absent property
                              is not `true`, so anonymous and guest events still count.

- [x] **Turn off web-vitals / performance capture in the project** (Settings → Project →
      **Done** — done in the project and enforced in code, because the project setting overrides the client flag: `before_send` drops `$web_vitals`.
      Web vitals, or Product analytics → Performance). **This one is not optional and the
      client flag does not cover it.** `capture_performance: false` in `client.ts` is
      overridden by PostHog's remote config: the SDK reads
      `config.capturePerformance` from the project and re-enables vitals when the project has
      them on. Verified by observation — `$web_vitals` events kept arriving while the client
      flag was already false.
- [x] Session replay stays off.
      **Done** — off, with console log capture off.
- [x] IP capture: **discard client IP** on, **per project**.
      **Done** — discard client IP is on per project.

      Careful, two similarly named things exist:

                                          | What you will find                | Where                | Effect                              |
                                          | --------------------------------- | -------------------- | ----------------------------------- |
                                          | "IP data capture **default**"     | Organization settings | **New projects only.** Existing projects are explicitly not affected. |
                                          | "Discard client IP data"          | **Project** settings  | The one that matters.               |

                                  The client SDK cannot do this: the `ip` init option is deprecated and has no effect
                                  (its own type says so, pointing at this project setting).

                                  **Exact path: project settings → Privacy → "IP data capture configuration" →
                                  "Discard client IP data" → on.** Its own copy confirms the scope: client IPs are not
                                  stored with events, though GeoIP enrichment and bot detection may still read the IP
                                  before it is discarded. The cookieless caveat in that paragraph does not apply here,
                                  because the app uses `localStorage+cookie` persistence, not the server hash mode.

- [x] Data retention per your plan.
      **Closed** — the free Developer tier fixes retention at 30 days; there is no setting to choose until the plan changes.
- [x] After P1 ships: revoke the PostHog **personal** API key used for source maps.
      **Done** — deleted from PostHog.

## 3. Keys and env vars

### Vercel project `kame-homes` (not `guest-form-management-app`)

| Variable                                         | Preview (develop)       | Production (at release)  | Secret?         |
| ------------------------------------------------ | ----------------------- | ------------------------ | --------------- |
| `VITE_SENTRY_DSN`                                | `kame-space-web` DSN    | same DSN (env separates) | No (public DSN) |
| `VITE_SENTRY_TRACES_SAMPLE_RATE`                 | `0.2`                   | `0.05`                   | No              |
| `SENTRY_AUTH_TOKEN`                              | Org auth token          | same                     | **Yes**         |
| `SENTRY_ORG`                                     | `kame-tech`             | same                     | No              |
| `SENTRY_PROJECT`                                 | `kame-space-web`        | same                     | No              |
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
| `SENTRY_DSN`                      | `kame-space-edge` DSN                   | same                      |
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
- [x] Owners: single-user org today, so routing is a no-op. Fill in at plan upgrade: platform
      **Closed as deferred** — single-user org, so routing is a no-op today. Fill the owner table in when the team grows (needs the paid tier).
      default ________, billing / PayMongo ________, inbox / Meta ________, guest booking
      ________.
- [x] Quiet hours (Asia/Manila) for non-urgent alerts: ________.
      **Closed as deferred** — quiet hours are a team-tier feature and would suppress the only alerts currently configured. Not applicable to a single-recipient setup.

## 5. Uptime and crons

- [x] Sentry → Uptime: **created 2026-11-01** for mt-dev via the MCP — `get-health` on
      `kame-space-edge` and `https://dev.kamehomes.space` on `kame-space-web`, both 5 min /
      15 s timeout, both `ok`. Production URLs at release.
- [x] Cron monitors upsert automatically from check-ins (no manual setup). Free tier allows
      **Done** — one monitor (`sd-refund-cron`) plus the `/admin/health` job registry for everything else; `cronMonitorConfig_test.ts` prevents a second monitor.
      **one** — `sd-refund-cron` only (D13). Uptime monitors turned out **not** to share that
      allowance, so both are in place.

## 6. Production rollout checklist (S6 / A7)

1. Legal copy (P1.6) live on production.
2. Vercel production env vars from §3 set; redeploy.
3. Say `kamewave` to set production Supabase secrets (`SENTRY_DSN`, `APP_RELEASE`,
   `SENTRY_SAMPLE_RATE_WARNING`), following `docs/archive/operations/production-deployment.md`.
4. Run the fire drill (doc 06 §4) on production; confirm alerts reach the owners.
5. Confirm PostHog prod Live events show no `$exception` and no token query values.
