---
stage: done
title: 'Super Admin platform settings page'
status: in-progress
tags: [planning, planned-modules, super-admin, admin, settings]
updated: 2026-09-06
---

## Status (2026-09-05)

**Storage + UI shipped.** Migration `20261305130100_platform_settings.sql`, `platform-settings` GET/PUT edge fn, `/admin/platform-settings` page. GET/PUT round-trip verified end-to-end (saved values persist and reload correctly); writes are logged to the audit log.

**Remaining (the actual point of this plan):** wire the consumers — signup gate reading `signups_enabled`, a maintenance banner reading `maintenance_mode`/`maintenance_message`, `create-organization` defaulting to `default_plan_code`, public endpoints reading `public_rate_limit_per_min`. Saving a value today does not yet change guest-facing behavior.

---

# Super Admin platform settings page

**Spun out of** [`super-admin-console-overhaul.md`](./super-admin-console-overhaul.md) Phase 6.

## Problem

There is nowhere to configure platform-wide knobs. `platform_payment_settings` and
`platform_host_settings` (announcements) exist as one-off singletons; everything else (default
plan, whether self-serve signup is on, a maintenance-mode banner, the support email, legal URLs,
public rate-limit ceilings) is hardcoded or env-only.

## Approach

- **Migration** — `platform_settings` singleton row: `default_plan_code`, `signups_enabled` bool,
  `maintenance_mode` bool + `maintenance_message` text, `support_email`, `legal_terms_url`,
  `legal_privacy_url`, `public_rate_limit_per_min` int, `updated_at`.
- **Edge fn** `platform-settings` (`serveSuperAdmin`, GET/PUT) — mirror `platform-payment-settings`.
- **Consumers** — signup flow checks `signups_enabled`; a `<PlatformMaintenanceBanner>` reads
  `maintenance_mode`; `create-organization` / first checkout default to `default_plan_code`;
  public endpoints read `public_rate_limit_per_min` (fallback to current constant).
- **UI** — `/admin/platform-settings` (Platform nav group) using `SuperAdminPage` +
  `SuperAdminSettingsCard`/`Row` (`Switch` for the bools, `Input` for the rest).

## Phasing

- P1: migration + `platform-settings` fn + hook + page + nav entry.
- P2: wire the consumers (signup gate, maintenance banner, default plan, rate limit).
- P3: docs — `PROJECT.md`, `edge-functions.md`, route guide, `validation-and-env.md` (note which
  env vars this replaces).

## Notes

- Cache the singleton aggressively client-side; invalidate on PUT.
- Maintenance mode must never lock out `/admin/*` (super admins keep access).
