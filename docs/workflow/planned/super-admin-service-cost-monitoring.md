---
stage: planned
title: 'Super Admin — service cost control & optimization'
status: planned
tags: [planning, planned-modules, super-admin, admin, cost, observability, alerts, performance]
updated: 2026-09-06
---

# Super Admin — service cost control & optimization

**Spun out of** the Sept 2026 infrastructure cost audit (`docs/workflow/intake/_to-prompt.md`
→ "Check current functionalities … that may cost us"). The audit inventoried every metered
external service GFM depends on. This plan makes the app **cheap to run at scale and
profitable**: every metered call is attributed and budgeted, every guest-initiated expensive
action is capped server-side, and the app **degrades to a cheaper path before it overspends**
instead of producing a surprise invoice.

**Mount point:** the cost console ships as a section of the System health module at
`/admin/health/costs` (see [`../in-progress/super-admin-system-health.md`](../in-progress/super-admin-system-health.md)
Phase 6). Add it to `HEALTH_SECTIONS` in `ui/.../super-admin/lib/systemHealth/healthSections.ts`.

## Non-negotiables (the cost contract)

1. **Attribution** — every metered external call (email, AI token, voice minute, map load,
   payment) records `organization_id` + `property_id` so spend maps to the tenant causing it.
2. **Server-side caps** — every guest-initiated expensive action has a hard per-actor **and**
   per-tenant cap enforced in an edge function, never only in the client.
3. **Degrade before overspend** — when a service crosses its budget the app automatically
   switches to a cheaper path (static map, cached AI, queued email, sampled analytics) and
   alerts; it never silently 429s a guest flow and never blows past a paid ceiling unwatched.
4. **One control plane** — every limit is a super-admin-editable row, not a hard-coded
   constant. Changing a plan or a provider tier is an `UPDATE`, not a deploy.
5. **Cost follows the plan** — each metered service maps to a plan entitlement; a tenant that
   exceeds its allowance hits an upgrade hook or draws down purchased credits (the AI credit
   wallet already does this — generalize it).

## Pre-implementation review — binding amendments (2026-09-06)

The plan below was reviewed against the codebase before implementation. These amendments
**override** the corresponding sections. Read them first.

### Blockers (the section below is wrong without these)

- **A1 · Runtime config delivery.** `app-settings` and `platform-settings` are both
  admin / super-admin gated — a public property page and `ui/src/lib/posthog/client.ts` at
  boot **cannot read them**. Therefore:
  - `maps_mode` is returned in the response body of `get-public-property`,
    `get-public-showcase`, and `get-public-host` (the map components already call these).
    `PropertyLocationPicker` (admin) reads it from `app-settings` as normal.
  - `analytics_mode` + `realtime_scope` + `dashboard_poll_seconds` are served by a **new
    public `get-public-app-config`** edge fn (`verify_jwt = false`, 5-min CDN cache,
    returns a tiny JSON blob). The SPA fetches it once on boot, writes to `localStorage`;
    `posthog/client.ts` reads `localStorage` **synchronously with a safe hard-coded
    default** (`sampled` in prod), then the async fetch updates the value for the next
    load. Never block init on the network.
  - Every runtime flag has a compiled-in default so a missing/broken row or a failed fetch
    can never brick a guest page.

- **A2 · Voice cost ceiling is cooperative, not enforced.** After `voice-receptionist-start`
  mints the ephemeral token the session is browser ↔ Google directly and the token is
  **not revocable**. Replace "per-session USD watchdog that force-ends the call" with:
  1. Hard stop = the ephemeral token TTL, already derived from `maxSessionSeconds` (keep).
  2. When the property or platform is near its voice budget, `enforceVoiceReceptionistCaps`
     mints the **next** session with a shorter `maxSessionSeconds` and/or a lower
     `maxSessionsPerGuestPerDay` (dynamic tightening).
  3. Client `useVoiceSession.ts` runs its own countdown to `maxSessionSeconds`, plays a
     spoken "I have to wrap up", and closes the socket.
  4. Optional: client POSTs `voice-receptionist-heartbeat` every 30s; if the response says
     "over budget" the client tears down. Cooperative — a hostile client can ignore it, but
     the token TTL still bounds the blast radius.

- **A3 · Raw-event retention is a first-class task, not a footnote.**
  `platform_service_usage_events` is append-only on an 8 GB Pro DB.
  - The **daily rollup is the source of truth** for the console and `serviceGuard`; raw
    events are audit/debug only.
  - New nightly `platform-service-events-retention` cron purges raw events older than
    **60 days** (rollup kept indefinitely).
  - The Google Maps beacon is **client-sampled** (default 1-in-5, sample rate in
    `get-public-app-config`) so map loads do not write 1:1; the console scales the sampled
    count back up.
  - Add monthly `RANGE` partitioning on `platform_service_usage_events` only if observed
    volume exceeds ~1M rows/month (note as a follow-up, not P2).

- **A4 · `emailClass` is optional, default `'transactional'`.** Making it required risks a
  missed call site among the 11 `emailService` senders + `workflowOrchestrator`. Default to
  the always-sends class so a missed site fails safe. Add a CI grep that **warns** (not
  errors) on a send call without an explicit class. Migrate call sites incrementally in D2.

### Should-fix (fold into the phase that touches them)

- **A5 · Metering + enforcement kill switches.** New singleton flags
  `platform_service_metering_enabled` and `platform_service_enforcement_enabled` (default
  metering **on**, enforcement **off**). `recordServiceUsage` no-ops when metering is off;
  `serviceGuard` returns `allow` when enforcement is off. Ship P2–P3 with enforcement off.
- **A6 · Seed every `platform_service_limits` row `on_hard = 'alert_only'`.** A documented
  per-service promotion checklist moves a row to `degrade`, then `block`, only after N days
  of clean data at real traffic. P4 wires the mechanism; it stays passive until deliberately
  promoted.
- **A7 · All metering windows are UTC**, matching the existing AI metering
  (`new Date().toISOString().slice(0,10)`, `getUTC*`). The `notes` column on each
  `platform_service_limits` row records the provider's real reset TZ (Maps = Pacific,
  PostHog = account TZ, Resend ≈ UTC) so the end-of-period projection can offset. Do not
  introduce `Asia/Manila` into metering.
- **A8 · Environment guard.** `recordServiceUsage`, `service-health-alert-cron`,
  `service-metrics-sync`, `platform-service-events-retention`, and `email-outbox-drain` all
  early-return unless `Deno.env.get('ENVIRONMENT') === 'production'`. Local/staging write and
  call nothing.
- **A9 · `service-metrics-sync` credentials are sensitive.** Supabase Management API token
  (full account), PostHog personal API key, Vercel token. Least-privilege / read-only tokens
  where the provider allows; store only in that one function's secrets; never log; document
  rotation in the migration runbook.
- **A10 · `serviceGuard` on hot read paths.** For read-mostly flags (`maps_mode`) resolve
  from a settings row the handler already loads, **not** a separate guard call. Reserve the
  live-rollup read for enforceable write paths (email send, AI call, voice mint). The guard's
  rollup read has a 50 ms timeout → fail-open. Cache the rollup in an isolate-level memo
  keyed by `(service, metric, scopeKey)` with a 60 s TTL (accepting a low hit rate on
  recycled isolates — correctness does not depend on the cache).
- **A11 · Parking is a first-class scope.** Add `per_parking` to `platform_service_limits.scope`
  and `platform_service_tenant_limits`; the by-tenant drill-down is org → (property | parking);
  Part G maps parking plan entitlements too. `parking_id` is already on the event table.
- **A12 · Backfill on ship.** One-time: AI from `ai_platform_usage_events`, PayMongo from
  `parking_payment_transactions` + `org_subscription_events`, Resend from the Resend API
  (last 30 d) if the endpoint allows. Maps / PostHog / Vercel start at ship date (note the
  gap in the console).
- **A13 · Alert escalation.** Re-send a `hard` / `over` alert every 8 h while still breached
  (not only on tier change); `soft` stays once per period; send a "recovered" note on drop
  below `soft_pct`.
- **A14 · PayMongo `fee_php` is primary** (rail-derived, deterministic); `fee_usd` is derived
  via a super-admin-editable monthly FX constant row. Console labels PayMongo cost
  "indicative".
- **A15 · D6 bundle split is its own PR.** `ui/vite.config.ts` has custom Polotno plugins
  (`patchOpenPolotnoHighlighter`, `buildScopedPolotnoBlueprintCss`) + `VitePWA` with a
  precache budget. `manualChunks` must land with a committed before/after bundle report,
  the Polotno blueprint CSS scoping re-verified, and `scripts/pwa/check-precache-budget.mjs`
  green in the same PR — nothing else bundled in.
- **A16 · `realtime_scope: open_thread_only` is a degrade mode only**, never the default. It
  kicks in at the Supabase realtime soft threshold; the default stays today's behaviour.
  Document the operator-facing tradeoff (inbox list falls back to a 30 s poll).

### Rollback levers (per risky change)

| Change                              | Instant revert                                                                          |
| ----------------------------------- | --------------------------------------------------------------------------------------- |
| Metering writes cause load/incident | `platform_service_metering_enabled = false`                                             |
| A degrade/block misfires            | `platform_service_enforcement_enabled = false`, or set the row `on_hard = 'alert_only'` |
| Maps Embed/Static regresses a page  | `maps_mode = interactive`                                                               |
| Analytics change loses needed data  | `analytics_mode = full`                                                                 |
| Realtime scope hurts operators      | it is off by default; clear the degrade override                                        |
| Bundle split breaks build/PWA       | revert the single D6 PR                                                                 |
| `emailClass` path missed            | default is `transactional` → still sends; no revert needed                              |

## Cost exposure at scale (audit recap)

| Service            | Cost driver at scale                                        | Worst case if unmanaged                                       | Strategy                                                              |
| ------------------ | ----------------------------------------------------------- | ------------------------------------------------------------- | --------------------------------------------------------------------- |
| Resend email       | 3–6 emails per booking lifecycle × every tenant             | Free cap (100/day, 3k/mo) → transactional email 429s silently | Meter + per-tenant cap + queue non-critical + Pro upgrade gate        |
| Gemini / Groq AI   | 14 features, some guest-triggered; bulk import mapping      | Rotated free keys banned → all AI down; runaway tokens        | One paid key + platform USD ceiling + per-tenant caps (exist) + cache |
| Voice receptionist | Gemini Live native audio, guest-initiated, ~10–40× text/min | One long call ≈ a day's free budget; abuse loop               | Off by default + minute/USD caps + shorter token TTL near budget (A2) |
| Google Maps        | Dynamic Map load per guest view on public property pages    | 1k views/day ≈ 30k loads/mo ≈ ~$140/mo + exposed key          | Embed/Static API on public pages + key lock + quota cap               |
| PayMongo           | % + flat fee per transaction                                | Margin erosion if fee not priced in                           | Track only; steer to cheap rails; decide pass-through                 |
| Supabase Pro       | DB compute, egress, realtime messages, edge invocations     | Compute add-on forced by polling + realtime firehose          | Widen polls, scope realtime, retention jobs, cron tuning              |
| PostHog            | Session replay + autocapture on every visitor               | 5k recording cap → per-recording billing                      | `analytics_mode` flag, replay sample 0 in prod                        |
| Vercel             | Static bandwidth from a heavy bundle                        | Hobby commercial-use ToS + 100GB egress                       | Bundle split + Cloudflare Pages / Vercel Pro                          |
| Meta Graph API     | Inbox + publish call volume                                 | Rate-limit → dropped guest replies                            | Backoff + queue + header metering                                     |

---

## Part A — Per-service control matrix (super admin)

Every service gets: a **metered metric + window**, a **super-admin knob**, an **enforcement
point in code**, a **soft-degrade** behaviour at ≥ `soft_pct` (default 75%), and a **hard
action** at ≥ 100%. Knobs live in `platform_service_limits` (global) +
`platform_service_tenant_limits` (per org/property override) unless noted.

| Service                  | Metric · window                                                                                                                                            | Super-admin knob(s)                                                                                                                                                                                                                 | Enforcement point                                                                                                                                                                                  | Soft-degrade (≥ soft %)                                                                                                                                                                                   | Hard action (≥ 100 %)                                                                                                                                                                               |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Resend**               | `email_sent` · day + month; `email_sent` · month per-org                                                                                                   | global day/month rows; per-plan monthly email allowance; per-org override; `email_class` allowlist (transactional / operational / marketing)                                                                                        | new `emailGuard()` in `_shared/emailService.ts`, before every `fetch('api.resend.com/emails')`                                                                                                     | stop **marketing** + second-nudge **operational** email; keep **transactional** (payment instructions, refund form, check-in, OTP)                                                                        | queue non-critical to `email_outbox` for next window; still send transactional + fire a **critical** alert ("upgrade Resend"); per-org breach → block that org's non-critical only                  |
| **Gemini / Groq (text)** | `calls` · day + month, `usd` · day — per org + per property (exist); `usd` · month — platform (new)                                                        | `ai_platform_global_settings` (`enforce_quotas`, `allowed_features`, default limits); `ai_platform_org_settings`; `ai_platform_property_settings`; new platform monthly USD ceiling row                                             | `aiUsageService.ts#assertWithinQuota` (exists) + new platform-ceiling check in the same path                                                                                                       | non-critical features (`marketing_*`, `import_column_map`, `inbox_suggest`) route `flash → flash_lite`, shorter `maxOutputTokens`, cache TTL 1h → 24h; `inbox_auto_reply` disabled (suggest stays manual) | `AiFeatureDisabledError` for non-critical features; transactional-adjacent (`receipt_validation`, `booking_ai_summary_*`) keep running until the platform ceiling, then global soft-disable + alert |
| **Voice receptionist**   | `session_count` · guest/day (exists), `concurrent` (exists), `session_minutes` · property/day + month (new), `usd` · property/month + platform/month (new) | global enable, per-property enable, `maxSessionSeconds`, `maxSessionsPerGuestPerDay`, `maxConcurrentSessions` (exist); new per-property daily-minute cap, per-property + platform monthly USD cap, near-budget token-TTL tightening | `voiceReceptionistService.ts#enforceVoiceReceptionistCaps` (extend) + cooperative cost ceiling per amendment A2 (dynamic next-mint tightening + client self-end + token TTL — no server force-end) | shorten `maxSessionSeconds`, lower `maxConcurrentSessions`, trim grounding-facts prompt                                                                                                                   | refuse new sessions for the property (`503` upgrade hook); platform USD ceiling → global disable + critical alert                                                                                   |
| **Google Maps**          | `map_load`, `places_session`, `geocode` · month — platform + per property                                                                                  | global `maps_mode` (`interactive` \| `static` \| `embed` \| `off`); per-property "allow interactive"; quota + budget cap in Google Cloud (P0)                                                                                       | `get-public-property` / `get-public-showcase` return `mapsMode`; `useGoogleMapsLoader.ts` + `PropertyMapEmbed` honour it                                                                           | force `static` / `embed` on all public pages; interactive only for the admin location picker                                                                                                              | `off` → hide map, show address text + "Open in Google Maps" link                                                                                                                                    |
| **PayMongo**             | `txn`, `gmv_php`, `fee_usd` · month — per org/property (track only)                                                                                        | enabled rails (`platform_payment_settings`, exists); new default preferred rail order; new guest-fee pass-through toggle + %                                                                                                        | checkout builder in `paymongoClient.ts` orders `payment_method_types`; fee line added at checkout                                                                                                  | n/a — more transactions is more revenue                                                                                                                                                                   | alert only: fee-rate drift or a failed-payment spike                                                                                                                                                |
| **Supabase (platform)**  | `db_gb`, `storage_gb`, `egress_gb`, `edge_invocations`, `realtime_messages`, `mau` · month                                                                 | alert threshold rows; new runtime flags: `realtime_scope` (`firehose` \| `open_thread_only`), `dashboard_poll_seconds`, storage retention on/off                                                                                    | flags served by `get-public-app-config` (amendment A1); consumed pulled by `service-metrics-sync` cron                                                                                             | `dashboard_poll_seconds` → target; `realtime_scope` → `open_thread_only` (**degrade only**, A16); pause non-critical crons                                                                                | critical alert to add compute / storage; run emergency retention job                                                                                                                                |
| **PostHog**              | `events`, `recordings`, `exceptions` · month                                                                                                               | global `analytics_mode` (`full` \| `sampled` \| `errors_only` \| `off`) + replay sample rate                                                                                                                                        | `posthog/client.ts` reads `localStorage` synchronously (safe default), refreshed from `get-public-app-config` for next load (amendment A1); `_shared/posthog.ts` reads an edge env override        | replay sample → 0, autocapture off, pageviews + exceptions kept                                                                                                                                           | `errors_only`                                                                                                                                                                                       |
| **Vercel**               | `bandwidth_gb`, `build_minutes` · month                                                                                                                    | alert thresholds only                                                                                                                                                                                                               | n/a at runtime — mitigated by bundle split (Part D)                                                                                                                                                | alert                                                                                                                                                                                                     | alert to move static hosting to Cloudflare Pages                                                                                                                                                    |
| **Meta Graph API**       | `rate_limit_pct` (from `X-App-Usage` / `X-Page-Usage`)                                                                                                     | alert threshold; new backoff aggressiveness                                                                                                                                                                                         | `_shared/metaGraph*.ts` response-header read                                                                                                                                                       | increase backoff, pause `publish-to-meta` batch, queue sends                                                                                                                                              | pause outbound Meta calls for a cooldown window + alert                                                                                                                                             |

**`email_class`** is a new **optional** argument on every `emailService` send, **default
`'transactional'`** (see amendment A4 — a missed call site must still send):
`transactional` (guest-blocking: payment, refund form, check-in, OTP, approval),
`operational` (host digests, reminders, staff alerts — mostly already on Telegram; max
queue delay 2 h then send anyway), `marketing` (announcements, review nudges, broadcasts;
max queue delay 24 h then drop + dead-letter). Only `operational` and `marketing` are
subject to soft-degrade / queueing; `transactional` always sends.

---

## Part B — Instrumentation & metering console

### Data model (mirror the AI metering tables)

```sql
-- append-only event log (generalized from ai_platform_usage_events)
CREATE TABLE public.platform_service_usage_events (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service            TEXT NOT NULL,      -- 'resend' | 'google_maps' | 'paymongo' | 'gemini' | 'groq' | 'voice' | 'supabase' | 'posthog' | 'vercel' | 'meta_graph'
  metric             TEXT NOT NULL,      -- 'email_sent' | 'map_load' | 'places_session' | 'geocode' | 'txn' | 'gmv_php' | 'fee_usd' | 'session_minutes' | ...
  quantity           NUMERIC NOT NULL DEFAULT 1,
  estimated_cost_usd NUMERIC NOT NULL DEFAULT 0,
  organization_id    UUID REFERENCES public.organizations (id) ON DELETE SET NULL,
  property_id        UUID REFERENCES public.properties (id) ON DELETE SET NULL,
  parking_id         UUID REFERENCES public.parkings (id) ON DELETE SET NULL,
  actor_type         TEXT NOT NULL DEFAULT 'system',  -- 'guest' | 'staff' | 'system' | 'cron'
  email_class        TEXT,              -- resend only: 'transactional' | 'operational' | 'marketing'
  source_ref         TEXT,              -- booking id, page path, message id, checkout session id
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_psue_service_created ON public.platform_service_usage_events (service, created_at DESC);
CREATE INDEX idx_psue_org_created     ON public.platform_service_usage_events (organization_id, created_at DESC);
-- amendment A3: `platform-service-events-retention` cron purges rows WHERE created_at < now() - 60d.
-- The daily rollup below is the source of truth for the console + serviceGuard.

-- daily rollup — mutated ONLY via the atomic SECURITY DEFINER fn
-- `increment_platform_service_usage_daily(...)` (clone increment_ai_platform_usage_daily —
-- INSERT ... ON CONFLICT DO UPDATE SET quantity = existing + excluded, ...), no read-modify-write.
-- usage_date is UTC (amendment A7), matching the existing AI metering. NULL org row = platform total.
CREATE TABLE public.platform_service_usage_daily (
  usage_date         DATE NOT NULL,
  service            TEXT NOT NULL,
  metric             TEXT NOT NULL,
  organization_id    UUID,
  property_id        UUID,
  parking_id         UUID,
  quantity           NUMERIC NOT NULL DEFAULT 0,
  estimated_cost_usd NUMERIC NOT NULL DEFAULT 0,
  event_count        INT NOT NULL DEFAULT 0,
  UNIQUE (usage_date, service, metric, organization_id, property_id, parking_id)
);
CREATE INDEX idx_psud_service_date ON public.platform_service_usage_daily (service, usage_date DESC, organization_id);

-- global limits (super-admin editable — the control plane)
CREATE TABLE public.platform_service_limits (
  service        TEXT NOT NULL,
  metric         TEXT NOT NULL,
  window         TEXT NOT NULL CHECK (window IN ('day','month','rolling_30d')),
  scope          TEXT NOT NULL DEFAULT 'platform' CHECK (scope IN ('platform','per_org','per_property','per_parking')),  -- A11
  limit_value    NUMERIC NOT NULL,
  unit           TEXT NOT NULL,          -- 'emails' | 'loads' | 'USD' | 'GB' | 'events' | 'minutes'
  soft_pct       INT NOT NULL DEFAULT 75,
  hard_pct       INT NOT NULL DEFAULT 90,
  on_hard        TEXT NOT NULL DEFAULT 'alert_only' CHECK (on_hard IN ('alert_only','degrade','block')),  -- A6: seed passive
  reset_tz       TEXT,                   -- A7: provider's real billing-reset TZ, for the projection offset
  alert_email    BOOLEAN NOT NULL DEFAULT true,
  alert_telegram BOOLEAN NOT NULL DEFAULT true,
  notes          TEXT,
  updated_by     TEXT,
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (service, metric, window, scope)
);

-- per-tenant overrides (raise a big customer's ceiling, or hard-block an abuser)
CREATE TABLE public.platform_service_tenant_limits (
  service         TEXT NOT NULL,
  metric          TEXT NOT NULL,
  window          TEXT NOT NULL,
  organization_id UUID NOT NULL,
  property_id     UUID,                  -- NULL = org-wide
  parking_id      UUID,                  -- A11
  limit_value     NUMERIC,               -- overrides the global row for this tenant
  on_hard         TEXT CHECK (on_hard IN ('alert_only','degrade','block')),
  reason          TEXT,
  updated_by      TEXT,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (service, metric, window, organization_id, property_id, parking_id)
);

-- kill switches (amendment A5) — singleton row, super-admin editable
CREATE TABLE public.platform_service_metering_settings (
  id                        BOOLEAN PRIMARY KEY DEFAULT true CHECK (id),
  metering_enabled          BOOLEAN NOT NULL DEFAULT true,   -- recordServiceUsage no-ops when false
  enforcement_enabled       BOOLEAN NOT NULL DEFAULT false,  -- serviceGuard returns allow when false; ship false
  fx_php_per_usd            NUMERIC NOT NULL DEFAULT 58,     -- A14: PayMongo fee_usd derivation
  maps_beacon_sample_rate   NUMERIC NOT NULL DEFAULT 0.2,    -- A3
  updated_by                TEXT,
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- alert dedupe (one notify per tier per period)
CREATE TABLE public.platform_service_alert_state (
  service TEXT NOT NULL, metric TEXT NOT NULL, window TEXT NOT NULL,
  scope_key TEXT NOT NULL,        -- 'platform' | org_id | property_id
  period_key TEXT NOT NULL,       -- '2026-09' (month) | '2026-09-06' (day)
  tier TEXT NOT NULL CHECK (tier IN ('soft','hard','over')),
  first_notified_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_notified_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  PRIMARY KEY (service, metric, window, scope_key, period_key)
);
```

Seed `platform_service_limits` from the audit's caps (Resend 100/day + 3,000/mo, Google Maps
≈10,000/mo per SKU — verify each, Gemini monthly USD budget, PostHog 5,000 recordings,
Supabase Pro quotas, voice per-property minutes), **every row `on_hard = 'alert_only'`**
(amendment A6). Set `reset_tz` per provider. Every row editable in the console; promote to
`degrade` / `block` per the checklist only after clean data at real traffic.

### Instrumentation — where events are written

Every write is **fire-and-forget** (`EdgeRuntime.waitUntil` / non-awaited) so metering never
adds latency to a send or a payment.

| Service                         | Where                                                                                       | How                                                                                                                                                                                                            |
| ------------------------------- | ------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Resend**                      | `_shared/emailService.ts`, after a 2xx from `api.resend.com/emails` (all 11 send paths)     | `recordServiceUsage('resend','email_sent',1,{ organizationId, propertyId, emailClass, sourceRef })`                                                                                                            |
| **PayMongo**                    | `paymongo-webhook` on `payment.paid`                                                        | `txn`=1, `gmv_php`=amount, `fee_usd`=rail-based estimate; tag `org` / `property` / `booking`                                                                                                                   |
| **AI text**                     | none — already in `ai_platform_usage_events`; console reads it and maps `feature → service` | —                                                                                                                                                                                                              |
| **Voice receptionist**          | already recorded on session end (`voiceReceptionistService.ts#endVoiceReceptionistSession`) | console reads `ai_platform_usage_events` where `feature = voice_receptionist`; **add** the cooperative cost ceiling (amendment A2) + `voice-receptionist-voice-preview` cache + rate-limit                     |
| **Google Maps**                 | new public edge fn `service-usage-beacon`                                                   | client posts a small beacon on map init / autocomplete session / geocode, tagged with the page's `?property=` slug or admin org; rate-limited + sampled; reconcile monthly against Google Cloud billing export |
| **Supabase / PostHog / Vercel** | new daily cron `service-metrics-sync`                                                       | pull Supabase Management API `GET /v1/projects/{ref}/usage`, PostHog usage API, Vercel usage API → platform-level daily rows; split Supabase storage per bucket where the path encodes org/property            |
| **Meta Graph API**              | `_shared/metaGraph*.ts` response headers                                                    | `rate_limit_pct` = max(`X-App-Usage`, `X-Page-Usage`); tag connection `org`                                                                                                                                    |

`recordServiceUsage(service, metric, quantity, opts)` — one new helper in
`_shared/serviceUsageService.ts`, modelled on `aiUsageService.ts#recordAiUsage`: writes the
event and upserts both the tenant-scoped and the `NULL` platform-level daily rollup rows.

### Alert cron — `service-health-alert-cron`

`serveCronPost` + `SERVICE_HEALTH_CRON_SECRET`, every 30 min via hosted `pg_cron` + `pg_net`
(same migration shape as `20261301130000_sd_refund_cron_secret_schedule.sql`).

Each run: for every `platform_service_limits` row (and any `platform_service_tenant_limits`
override), compute current-window consumption from `platform_service_usage_daily` + today's
live events; `pct = consumed / limit`; tier = `over` (≥100) / `hard` (≥ hard_pct) / `soft`
(≥ soft_pct). Notify only when the tier is **new or escalated** vs `platform_service_alert_state`:

- **Email** — `emailService` (`email_class: operational`, exempt from its own degrade) →
  `SUPPORT_TEAM_EMAIL` + `SUPER_ADMIN_EMAILS`, template `service-limit-alert.html` (service,
  consumed / limit, pct, projected end-of-period, top 3 tenants, link to `/admin/service-health`).
- **Telegram** — `_shared/telegramAdmin.ts` → admin chat, one line:
  `⚠️ Resend email 82% of monthly cap (2,460 / 3,000). Top: Sunrise Villas 41%, Bayview 22%. → /admin/service-health`
- Upsert alert state. New `period_key` resets automatically; stamp `resolved_at` + send a
  "recovered" note when consumption falls back under `soft_pct`.

### Read API — `super-admin-service-health`

`serveSuperAdmin`, GET, `?range=30d|90d|12mo&service=<id>`:

- `services[]` — `{ service, metric, window, scope, consumed, limit, pct, tier, onHard, projectedEndOfPeriod, unit }`
- `costTrend[]` — `{ date, [service]: usd }` for the stacked area
- `byTenant[]` (when `service=`) — `{ organizationId, orgName, propertyId?, propertyName?, quantity, estimatedCostUsd, pctOfTotal }`, top 20
- `alerts[]` — active soft/hard/over breaches with top contributing tenants
- `limits[]` + `tenantLimits[]` — the editable registry rows
- `degradeState[]` — which degrade modes are currently active and why

Mutations: `super-admin-service-limits` (upsert a global or tenant limit row, `logSuperAdminAction`),
`super-admin-service-degrade` (manually force / clear a degrade mode), `super-admin-service-alert-test`.

### UI — `/admin/service-health`

- `superAdminPaths.serviceHealth = '/admin/service-health'`; add to `SUPER_ADMIN_NAV_GROUPS`
  (Platform group, next to "AI usage"); route guide `docs/guides/routes/admin/service-health.md`.
- Reuse the console scaffold (`SuperAdminPage`, `SuperAdminSettingsCard`,
  `SuperAdminSecondaryNav`); clone `SuperAdminAiCostChart.tsx` (Recharts + console theme).
- Sections: (1) **status strip** — one tile per service, gauge bar green/amber/red +
  projection marker + active degrade badge; (2) **cost trend** — stacked area USD/day by
  service; (3) **by tenant** — horizontal bar, top 10 orgs for the selected service, stacked
  by metric, with an est-cost column, drill to properties; (4) **limits & degrade** — editable
  `platform_service_limits` + `platform_service_tenant_limits` rows, per-row soft/hard %,
  `on_hard` mode, email/Telegram toggles, "force degrade now" / "clear", "send test alert";
  (5) **active alerts** — current breaches + "mute until next period".
- Hooks: `useServiceHealth(range)`, `useServiceHealthByTenant(service)`, `useUpdateServiceLimit()`,
  `useForceServiceDegrade()`.

---

## Part C — Enforcement & degrade engine

`_shared/serviceGuard.ts` — one function every expensive entry point calls **before** doing
the work:

```ts
type GuardDecision = { mode: 'allow' | 'degrade' | 'block'; reason?: string; tier?: 'soft'|'hard'|'over' };

serviceGuard(service: string, metric: string, ctx: {
  organizationId?: string; propertyId?: string; actorType: ActorType; window?: 'day'|'month';
}): Promise<GuardDecision>
```

Logic: first check `platform_service_metering_settings.enforcement_enabled` — if false,
return `allow` immediately (amendment A5). Otherwise read the applicable
`platform_service_limits` row (+ any tenant override) and the current rollup from
`platform_service_usage_daily` under a **50 ms timeout** (amendment A10); on timeout or any
error return `allow` and log. Isolate-level memo keyed `(service, metric, scopeKey)`, 60 s
TTL — correctness does not depend on the hit rate. Then compute `pct` and return:

- `pct < soft_pct` → `allow`
- `soft_pct ≤ pct < 100` → `degrade` (caller applies its `DEGRADE_PRESETS[service]` behaviour)
- `pct ≥ 100` and `on_hard = 'block'` → `block` (caller returns a `503` upgrade hook / queues)
- `pct ≥ 100` and `on_hard = 'degrade'` → `degrade`
- `on_hard = 'alert_only'` → `allow` (cron still alerts)

`DEGRADE_PRESETS` is a code-side map (not admin-editable — behaviour stays consistent):
`{ resend: {...}, gemini: {...}, voice: {...}, google_maps: {...}, meta_graph: {...} }` with
the soft-degrade / hard-action rows from Part A. Manual overrides come from
`super-admin-service-degrade` writing a short-lived row read by `serviceGuard`.

**Call sites to wire:**

| Entry point                                                       | Guard call                                                                                                                                                                                        |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `_shared/emailService.ts` send wrapper                            | `serviceGuard('resend','email_sent',{ org, property, actorType })` — `degrade` skips `marketing` + second-nudge `operational`; `block` → `email_outbox` for non-transactional                     |
| `aiUsageService.ts#assertWithinQuota`                             | already enforces per-tenant; **add** `serviceGuard('gemini','usd',{ window:'month' })` for the platform ceiling + degrade routing (`flash → flash_lite`, TTL bump)                                |
| `voice-receptionist-start`                                        | `serviceGuard('voice','session_minutes',{ property })` before minting the token; near-budget → mint with shorter `maxSessionSeconds` (amendment A2); client self-ends, token TTL is the hard stop |
| `get-public-property` / `get-public-showcase` / `get-public-host` | **no `serviceGuard` call** (amendment A10) — the handler resolves `mapsMode` from the metering-settings row it already loads and returns it in the body; the alert cron watches the Maps rollup   |
| `meta-inbox-send` / `publish-to-meta`                             | `serviceGuard('meta_graph','rate_limit_pct')` → back off / queue                                                                                                                                  |

Fail-open: any `serviceGuard` error or timeout returns `allow` and logs — metering must never
take down a guest flow. Enforcement is also globally disableable
(`platform_service_metering_settings.enforcement_enabled`, ships `false`).

---

## Part D — Optimization workstream (executable tasks)

Each task: **change · files · acceptance criteria · est**. Grouped; sequencing in Part E.

### D1 — Provider billing caps & key hardening (config only, day 1)

| #    | Change                                                                                                 | Acceptance                                                                           | Est |
| ---- | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------ | --- |
| D1.1 | Google AI Studio: hard budget + email alert on the paid Gemini key                                     | Screenshot: budget set, alerts on                                                    | 15m |
| D1.2 | PostHog project: billing limit → "stop ingesting at cap"; replay sampling 0 in prod                    | `posthog` project settings show limit; prod bundle ships `disable_session_recording` | 20m |
| D1.3 | Supabase: spend cap / disable overages on the project                                                  | Dashboard shows cap                                                                  | 10m |
| D1.4 | Google Cloud: per-API quota caps (Maps JS, Places, Geocoding, Static) + billing budget alert           | Quotas set below "surprise" level; budget alert on                                   | 20m |
| D1.5 | Restrict `VITE_GOOGLE_MAPS_API_KEY` — HTTP-referrer allowlist (prod + preview domains) + API allowlist | Key rejected from an unlisted referrer (curl test)                                   | 20m |
| D1.6 | Confirm voice receptionist `enabled=false` global + every property                                     | `super-admin` shows global off; SQL check on `ai_platform_property_settings`         | 10m |
| D1.7 | Set Gemini + Groq to one paid key each; free keys move to `GEMINI_MODEL_OVERRIDE` fallback only        | `supabase secrets` list; a forced-quota test falls back cleanly                      | 30m |

**Exit gate P0:** a screenshot / SQL check for every row above.

### D2 — Email (Resend)

| #    | Change                                                                                                                             | Files                                        | Acceptance                                                                                                     |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| D2.1 | Add required `emailClass` arg to every `emailService` send fn                                                                      | `_shared/emailService.ts` + 11 callers       | type-check fails if a caller omits it                                                                          |
| D2.2 | `emailGuard()` + `serviceGuard('resend', …)` in the send wrapper                                                                   | `emailService.ts`, `serviceGuard.ts`         | with a seeded 100%-day limit, a `marketing` send is skipped, a `transactional` send goes through, both metered |
| D2.3 | `email_outbox` table + `email-outbox-drain` cron (every 15m, respects the guard)                                                   | new migration + fn                           | queued non-critical email sends on the next window when under cap                                              |
| D2.4 | Collapse the booking lifecycle to the minimum transactional set; move host-facing notices to Telegram-only where it already exists | `workflowOrchestrator.ts`, `emailService.ts` | emails per booking ≤ 3 in the common path (payment → confirm → check-in)                                       |
| D2.5 | Runbook: when to upgrade to Resend Pro (per-tenant month cap trending to breach)                                                   | `docs/archive/operations/…`                  | documented                                                                                                     |

### D3 — AI (text features)

| #    | Change                                                                                                                                                                          | Files                                                         | Acceptance                                                                                                  |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| D3.1 | Platform monthly USD ceiling row + check in `assertWithinQuota`                                                                                                                 | `aiUsageService.ts`, seed                                     | with ceiling at 100%, non-critical features throw `AiFeatureDisabledError`, `receipt_validation` still runs |
| D3.2 | Degrade routing: `flash → flash_lite` + shorter `maxOutputTokens` + cache TTL 1h→24h for `marketing_*`, `import_column_map`, `inbox_suggest` when `serviceGuard` says `degrade` | `aiModelRouter.ts`, `aiQuotaCache.ts`                         | forced degrade → model string + TTL change visible in `ai_platform_usage_events`                            |
| D3.3 | `inbox_auto_reply` default OFF platform-wide; `inbox_suggest` (manual) stays                                                                                                    | `ai_platform_global_settings` seed, `socialInboxAiService.ts` | new orgs: auto-reply off                                                                                    |
| D3.4 | Raise deterministic-cache hit rate: normalize prompts (trim, lowercase keys) before fingerprint; log hit %                                                                      | `aiQuotaCache.ts`, `super-admin-ai-usage`                     | cache hit % surfaced on `/admin/ai-usage`; measurably > 0 for repeat receipts/imports                       |
| D3.5 | Bulk import column-map: one AI call per file, not per column; cap file size / row sample                                                                                        | `importColumnMappingAi.ts`                                    | a 40-column file = 1 AI call                                                                                |

### D4 — Voice receptionist

| #    | Change                                                                                                                                                                                                                                                                                                                              | Files                                                                                                                      | Acceptance                                                                                                    |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| D4.1 | Per-property daily-minute cap + per-property + platform monthly USD cap in `enforceVoiceReceptionistCaps`                                                                                                                                                                                                                           | `voiceReceptionistService.ts`                                                                                              | exceeding the minute cap → `429` before a token is minted                                                     |
| D4.2 | **Cooperative** cost ceiling (see amendment A2 — no server force-end possible). Dynamic next-mint tightening in `enforceVoiceReceptionistCaps` when near budget + client countdown to `maxSessionSeconds` with a spoken "I have to wrap up" + optional `voice-receptionist-heartbeat` the client obeys. Token TTL is the hard stop. | `voiceReceptionistService.ts`, `voice-receptionist-start`, new `voice-receptionist-heartbeat`, client `useVoiceSession.ts` | near-budget property mints shorter sessions; client self-ends at the limit; token TTL bounds a hostile client |
| D4.3 | Cache + rate-limit `voice-receptionist-voice-preview` (voice+line → cached clip; 5/min/user)                                                                                                                                                                                                                                        | `geminiLiveVoicePreview.ts`, `voice-receptionist-voice-preview`                                                            | second identical preview served from cache, no new token spend                                                |
| D4.4 | Trim the locked grounding prompt to a hard char budget                                                                                                                                                                                                                                                                              | `voice-receptionist-start`                                                                                                 | prompt ≤ N chars; measured setup cost drop                                                                    |
| D4.5 | Keep global + per-property opt-in OFF until D1.7 done; document the switch-on checklist                                                                                                                                                                                                                                             | route guide                                                                                                                | documented                                                                                                    |

### D5 — Google Maps

| #    | Change                                                                                                                                                                                                                                         | Files                                             | Acceptance                                                                                    |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| D5.1 | `maps_mode` (`interactive`/`static`/`embed`/`off`) stored super-admin-side; **returned in the body** of `get-public-property` / `get-public-showcase` / `get-public-host` (amendment A1); `PropertyLocationPicker` reads it via `app-settings` | those 3 public edge fns, `useGoogleMapsLoader.ts` | flipping the flag changes the public page on next load, no deploy                             |
| D5.2 | `PropertyMapEmbed` → **Maps Embed API** iframe (free) or Static Maps image + click-to-interact                                                                                                                                                 | `PropertyMapEmbed.tsx`, `useGoogleMapsLoader.ts`  | public property page issues **0** Dynamic Map JS loads in `static`/`embed` mode (network tab) |
| D5.3 | Persist `lat`/`lng` on the property at save; guests never call Geocoding                                                                                                                                                                       | `propertyLocation.ts`, save path                  | no `geocode` beacon from a guest session                                                      |
| D5.4 | Places Autocomplete: session tokens + load `places` only on field focus (already gated) + debounce                                                                                                                                             | `LocationSearchInput.tsx`                         | one `places_session` per address entry, not per keystroke                                     |
| D5.5 | `service-usage-beacon` public fn (sampled, rate-limited) for map/autocomplete/geocode                                                                                                                                                          | new fn                                            | beacons visible in `platform_service_usage_events` tagged to the property                     |

### D6 — Frontend bundle & runtime

| #    | Change                                                                                                                                | Files                                   | Acceptance                                                                        |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- | --------------------------------------------------------------------------------- |
| D6.1 | `build.rollupOptions.manualChunks` — split vendor (react, radix, charts) from app                                                     | `ui/vite.config.ts`                     | `bun run build` output: no single chunk > 400 KB gz                               |
| D6.2 | Lazy-load the marketing design editor (`openpolotno`, `konva`, `fabric`) + Remotion + `pdfjs`/`jspdf` behind route-level `React.lazy` | marketing + pdf route modules           | guest booking route transfers < 300 KB gz JS (measure with `vite build --report`) |
| D6.3 | Audit the 11 existing `lazy()` calls; add splits for admin-only heavy routes (finance, marketing, super-admin)                        | `routes/*`                              | admin bundles don't ship on the guest entry                                       |
| D6.4 | Confirm PWA precache budget still passes after splits                                                                                 | `scripts/pwa/check-precache-budget.mjs` | CI green                                                                          |

### D7 — Supabase (DB / realtime / storage / cron)

| #    | Change                                                                                                                                                                                                                                                                      | Files                                                           | Acceptance                                                                                                    |
| ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| D7.1 | `dashboard_poll_seconds` from `get-public-app-config` (default 120; tune up under load); `useDashboardStats` / `useOrgDashboardStats` / `useParkingDashboardStats` read it + pause on `document.hidden`                                                                     | 3 hooks                                                         | with 3 tabs hidden for 1h: ~0 stats refetches (was ~1,440); active tab still fresh via `refetchOnWindowFocus` |
| D7.2 | `realtime_scope` from `get-public-app-config`, **degrade mode only** (default `firehose` = today's behaviour, A16); at the Supabase realtime soft threshold → `open_thread_only`: inbox realtime subscribes to the open conversation only, list backed by a 30s unread poll | `useInbox.ts`                                                   | flag flip drops connected channels per admin tab from N to 1–2; default unchanged                             |
| D7.3 | Tear down realtime channels on tab blur / idle (all 3 realtime hooks)                                                                                                                                                                                                       | `useInbox.ts`, `useNotificationsRealtime.ts`, `useGuestChat.ts` | channels closed within 60s of blur                                                                            |
| D7.4 | Widen Telegram `*/5` dispatchers → `*/15`; gate `calendar-sync` to properties with a live channel connection + a changed-since check                                                                                                                                        | 2 cron migrations                                               | `cron.job` shows `*/15`; `calendar-sync` skips unconnected properties                                         |
| D7.5 | Storage retention: nightly `storage-retention-cron` — purge `ai-assistant-attachments` > 90d, orphaned `payment-receipts`, expired `sd-refund-receipts`                                                                                                                     | new fn + cron                                                   | dry-run count logged; real run frees space; documented in migration runbook                                   |
| D7.6 | Cap `property-media` video on upload (size + dimension) or route video to Cloudflare Stream/R2 if public pages use it                                                                                                                                                       | `uploadLimits.ts`, upload fns                                   | a 50 MB 4K upload is rejected or transcoded down                                                              |
| D7.7 | `push-fanout` trigger: batch multiple notifications per fan-out where possible                                                                                                                                                                                              | `push_fanout_trigger` migration, `push-fanout` fn               | N notifications in a burst → 1 fan-out call                                                                   |

### D8 — Analytics (PostHog)

| #    | Change                                                                                                                                                                                                                                                   | Files                                       | Acceptance                                                                                   |
| ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- | -------------------------------------------------------------------------------------------- |
| D8.1 | `analytics_mode` (`full`/`sampled`/`errors_only`/`off`) — `posthog/client.ts` reads `localStorage` synchronously with a safe compiled-in default, refreshed from `get-public-app-config`; `_shared/posthog.ts` reads an edge env override (amendment A1) | `get-public-app-config`, both posthog files | flipping to `errors_only` stops replay + autocapture on the **next** load; never blocks init |
| D8.2 | Prod default = `sampled` (replay 0, autocapture allowlist, pageviews + exceptions on)                                                                                                                                                                    | env / seed                                  | prod session shows no replay in PostHog                                                      |
| D8.3 | Exception capture keeps source-map upload resilient (already handled) — verify                                                                                                                                                                           | `vite.config.ts`                            | build warns-and-continues on upload failure                                                  |

---

## Part E — Phasing & sequencing

| Phase                                  | Scope                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | Entry gate | Exit gate                                                                                                                                                                                                                                                                         | Est      |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| **P0 — Caps & keys**                   | D1 (all)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | —          | every D1 row has a screenshot / SQL proof                                                                                                                                                                                                                                         | 0.5 day  |
| **P1 — Kill the cost drivers in code** | D5.1–D5.4, D6 (all — own PR, amendment A15), D7.1, D7.2, D7.3, D7.4; `get-public-app-config` + `analytics_mode` (A1) + D8.1, D8.2; `maps_mode` via public property responses (A1)                                                                                                                                                                                                                                                                                                                        | P0 done    | guest booking route < 300 KB gz; 0 Dynamic Maps on public pages; dashboard poll ≥ target + hidden-pause; Telegram dispatchers `*/15`; prod PostHog `sampled`; `check-precache-budget.mjs` green                                                                                   | 1.5–2 wk |
| **P2 — Metering + console**            | new singleton kill-switch flags (A5, seed enforcement **off**); Part B schema + atomic `increment_platform_service_usage_daily` (reuse the AI pattern); `serviceUsageService.ts` (env-guarded, A8); Resend + PayMongo + AI-read instrumentation; `platform-service-events-retention` cron (A3); backfill AI + PayMongo (A12); `super-admin-service-health` read API (date-bounded, paginated — **not** the `LIMIT 100_000` pattern); status strip + cost chart; by-tenant for AI + email + parking (A11) | P1 done    | every service tile shows real consumed/limit; per-tenant + per-parking drill works; retention purge runs in a dry-run                                                                                                                                                             | 1.5–2 wk |
| **P3 — Limits registry + alerts**      | `platform_service_limits` (seed **all** `on_hard = 'alert_only'`, A6) + `platform_service_tenant_limits` (incl. `per_parking`, A11) + `service-health-alert-cron` (env-guarded, escalation re-alert every 8 h, A13) + email/Telegram + management UI + active-alerts panel                                                                                                                                                                                                                               | P2 done    | test alert fires both channels; escalation re-fires while breached; editing a limit takes effect with no deploy                                                                                                                                                                   | 1 wk     |
| **P4 — Enforcement + degrade engine**  | `serviceGuard.ts` (50 ms timeout, fail-open, isolate memo — A10) + `DEGRADE_PRESETS` + wire into email / AI / voice / maps / meta; `realtime_scope` + `dashboard_poll_seconds` as **degrade modes** (A16); D2.1–D2.4, D3.1–D3.3, D4.1–D4.4. Promote `on_hard` per-service off `alert_only` only after N clean days (A6).                                                                                                                                                                                 | P3 done    | with enforcement flag ON + a seeded 100% row: Resend → non-critical queues, transactional sends, alert fires; Maps 100% → public pages render static; AI ceiling → non-critical features disable; toggling `platform_service_enforcement_enabled` off restores baseline instantly | 1.5–2 wk |
| **P5 — External metric sync**          | `service-metrics-sync` cron (least-privilege tokens, isolated fn — A9); D7.5, D7.6, D7.7, D3.4, D3.5, D4.5, D5.5                                                                                                                                                                                                                                                                                                                                                                                         | P4 done    | platform tiles populated daily; retention job keeps `platform_service_usage_events` flat; storage trending flat                                                                                                                                                                   | 1 wk     |
| **P6 — Monetization alignment**        | map each metered service (incl. parking, A11) to a plan entitlement; per-tenant monthly allowance rows; overage → upgrade hook (reuse `jsonUpgradeHook`) or credit-wallet debit (reuse `aiCreditLedger`); super-admin "grant override" flow                                                                                                                                                                                                                                                              | P5 done    | an org over its email/AI allowance sees an upgrade prompt; SA can raise its ceiling from the console                                                                                                                                                                              | 1 wk     |

**Minimum viable for launch:** P0 + P1 + P2 + P3 (metering + alerts, enforcement still off).
P4 makes it self-protecting; P5–P6 make it scale profitably. Do not onboard paying tenants
before P0 + P1. Ship P2–P3 with `platform_service_enforcement_enabled = false` and every
limit `alert_only` — observe real traffic for at least one full billing period before
promoting any service to `degrade` / `block` in P4.

---

## Part F — Pre-launch load & cost checklist

- [ ] P0 caps verified on every provider (screenshots in the runbook)
- [ ] Google Maps key restricted; `curl` from an unlisted origin is rejected
- [ ] Load test: 500 concurrent guest sessions on a property page → Google Maps loads = 0
      (static/embed mode), Supabase realtime connections bounded, edge invocation rate within Pro
- [ ] Load test: 50 bookings/hour through the full workflow → emails/hour projected under the
      Resend day cap, or `email_outbox` absorbs the overflow
- [ ] Voice receptionist left OFF; switch-on checklist documented
- [ ] AI: forced platform-ceiling test → non-critical features disable, receipt validation survives
- [ ] `/admin/service-health` shows a realistic projection for every service at the tested load
- [ ] Cost model: projected monthly bill at target MoM active tenants documented and signed off
- [ ] Alert cron test: soft + hard alert delivered to email + Telegram within one cron cycle

---

## Part G — Profit alignment (cost ↔ plan)

Each metered service maps to a plan entitlement so heavy use pays for itself:

| Service            | Free / base plan allowance                               | Overage behaviour                                                                                     |
| ------------------ | -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Email              | monthly transactional allowance per plan tier            | soft cap → operational email throttled; upgrade hook                                                  |
| AI text            | monthly credit allowance (wallet exists)                 | draw down purchased credits, then upgrade hook (`AiQuotaExceededError` already carries `upgradeHook`) |
| Voice receptionist | paid add-on only; per-property monthly minute bundle     | over bundle → disabled until next period or top-up                                                    |
| Google Maps        | interactive maps = higher tier; base tier = static/embed | n/a (cost already near-zero on static/embed)                                                          |
| Storage            | per-plan GB                                              | over → prompt to archive or upgrade                                                                   |

`platform_service_tenant_limits` doubles as the "we sold this org a bigger bundle" record.
The super-admin console is where support raises a ceiling or blocks an abuser.

---

## Non-goals / cautions

- **Not a billing system of record.** All figures are estimates; reconcile monthly against
  real provider invoices. Show a "last reconciled" date per service.
- **`serviceGuard` fails open.** A metering/DB error must never block a guest flow — return
  `allow`, log, let the cron alert.
- **Transactional email is never degraded.** Payment instructions, refund forms, check-in
  details, OTP, and approval emails always send; only `operational` / `marketing` classes queue.
- Maps beacon is client-side, sampled, best-effort — a leading indicator, not the bill.
- Event writes are fire-and-forget only; raw events are purged at 60 days (amendment A3).
- These tables are service-role-only, read exclusively through `serveSuperAdmin` edge functions.
- Runtime flags each have a compiled-in default so a missing/broken row or failed
  `get-public-app-config` fetch can never brick a guest page (amendment A1).
- All metering is inert outside `ENVIRONMENT === 'production'` (amendment A8).
- Metering / enforcement each have a one-flip kill switch (amendment A5); enforcement ships off.

## Coverage check — services confirmed in / out of scope

**In scope (metered):** Resend, Gemini, Groq, voice receptionist (Gemini Live), Google Maps
Platform, PayMongo, Supabase Pro (DB / storage / egress / edge / realtime / MAU), PostHog,
Vercel, Meta Graph API.

**Checked, nothing to meter:** Supabase image transformations (not used — client-side
`browser-image-compression` + custom optimizer); Telegram Bot API (free); Cloudflare
Turnstile (free); Web Push / VAPID (free, self-served); pg_cron / pg_net (Supabase compute,
covered under edge). Supabase Auth OTP / magic-link email: free on the built-in mailer;
**counts under Resend** if custom SMTP is ever wired — add an `email_class: transactional`
meter there when that happens.

**Confirmed absent from the codebase:** Twilio / any SMS, SendGrid / Mailgun, Cloudinary /
imgix, Mapbox, Algolia, Sentry, Datadog / LogRocket, OpenAI / Anthropic, ElevenLabs /
Deepgram, Stripe, Firebase / FCM, AWS S3 / CloudFront, any paid CDN.

**Licensing (not a runtime bill — track, don't meter):** Remotion Company License at 4+
people; Jamendo content licensing for commercially published marketing video.

## Testing strategy (no automated suite in this repo)

- **Edge functions:** Deno test runner for `serviceUsageService.ts` (rollup math, env guard,
  fail-open), `serviceGuard.ts` (tier boundaries, timeout → allow), the alert cron
  (dedupe + escalation), the FX / fee helpers.
- **Migrations:** `bun run db:migrate` locally; verify the atomic `increment_*` function
  under concurrent writes with a small load script.
- **Enforcement / degrade:** integration test per service — seed a `platform_service_limits`
  row at 100%, flip `platform_service_enforcement_enabled = true`, assert the degrade
  behaviour and that transactional email / receipt validation still pass; flip the switch
  off and assert baseline restored.
- **UI:** drive `/admin/service-health` with Playwright MCP (`verify` skill) — status strip
  renders, limit edit round-trips, "send test alert" delivers.
- **Load:** Part F checklist — 500 concurrent property-page loads, 50 bookings/hour.
- Every phase PR runs `bun run lint && type-check && check:filenames && build` (CI) plus the
  phase's acceptance criteria manually verified and noted in the PR.

## Docs to update when this ships

- `docs/PROJECT.md` — new tables + kill-switch flags, `/admin/service-health` route,
  `service-health-alert-cron`, `email-outbox-drain`, `service-metrics-sync`,
  `storage-retention-cron`, `platform-service-events-retention` cron,
  `SERVICE_HEALTH_CRON_SECRET`, `service-usage-beacon`, `get-public-app-config`,
  `voice-receptionist-heartbeat`, the runtime config flags (served via `get-public-app-config`
  - public property responses, not `app-settings`)
- `docs/guides/routes/admin/service-health.md` — new route guide (invoke `route-guides`)
- `.cursor/rules/admin-auth.mdc` — new `serveSuperAdmin` endpoints
- `.cursor/rules/supabase-edge-functions.mdc` — new crons + the public beacon JWT policy
- `.cursor/rules/booking-workflow.mdc` — email-class change touches `workflowOrchestrator` sends
- `docs/architecture/plans-feature-matrix.md` + `plans-and-permissions` skill — Part G entitlements
- `docs/archive/operations/scheduled-jobs-and-testing.md` + `migration-runbook.md` — new crons + retention job
- `.cursor/rules/performance.mdc` / `performance` skill — bundle-split + poll/realtime defaults
