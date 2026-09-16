---
title: 'QA batch — for-testing modules'
status: active
tags: [workflow, for-testing, qa]
updated: 2026-09-15
stage: for-testing
kind: reference
---

# QA batch — for-testing modules

**Goal:** Run manual verification on every module in [`./`](./README.md), then `/workflow-done <slug>` each one. No code changes unless QA finds bugs — move the module back to [`../in-progress/`](../in-progress/) if it does.

**Before you start:** `bun run ci:quality` green on the branch you are testing.

---

## Recommended order

| #   | Module                                                                    | Effort  | Blockers                                                                     | Done when                                                                        |
| --- | ------------------------------------------------------------------------- | ------- | ---------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| 1   | [Superhost program](./superhost-program.md)                               | ~30 min | None — no deploy config                                                      | [`20-superhost.md`](../qa/property-dashboard/20-superhost.md) passes             |
| 2   | [Onboarding verification simplify](./onboarding-verification-simplify.md) | ~45 min | Local or dev stack + test org                                                | Plan § Verify passes                                                             |
| 3   | [Host verification tiers](./host-verification-tiers.md)                   | ~30 min | Same + admin access                                                          | Phase 3 admin-queue checklist passes (search boost stays deferred)               |
| 4   | [CAPTCHA & anti-spam](./captcha-anti-spam-hardening.md)                   | ~45 min | Cloudflare Turnstile keys per env                                            | Plan § FOR TESTING — pass + fail test keys                                       |
| 5   | [PWA install / offline / push](./pwa-installable-offline-push.md)         | ~2 h    | Dev Supabase deploy + VAPID secrets + UI rebuild                             | Plan § Manual QA + real-device push                                              |
| 6   | [Org granular team permissions](./org-granular-team-permissions.md)       | ~45 min | Local or dev stack + org with 2+ listings + invitee email                    | Plan § Phase 5 — QA (5 checks) passes                                            |
| 7   | [Super Admin step-up OTP](./super-admin-step-up-otp.md)                   | ~30 min | Super-admin login + reachable inbox for that email                           | Plan § Manual QA (4 checks) passes                                               |
| 8   | [Org Activity & Audit Log](./org-activity-audit-log.md)                   | ~60 min | Dev stack + org with 2+ listings + a paid + a Free org + 2 browser tabs      | § 8 smoke path passes; then **prod deploy** (`kamewave`) before `/workflow-done` |
| 9   | [Pre-production launch audit](./pre-production-launch-audit.md)           | ~45 min | Hosted **dev** DB URL + backup/rollback scripts; do **not** run prod restore | Residual checks in the plan pass; `cd-prod.yml` stays gated                      |

---

## 1. Superhost program

**Checklist:** [`../qa/property-dashboard/20-superhost.md`](../qa/property-dashboard/20-superhost.md)

**Smoke path:**

- Org Settings → **Trust** — four criteria + next assessment date visible
- Public property listing shows Superhost badge when `organizations.settings.superhost.earned === true`
- Cron path optional locally — trust UI + badge wiring is the sign-off

---

## 2. Onboarding verification simplify

**Checklist:** [`onboarding-verification-simplify.md`](./onboarding-verification-simplify.md) § Verify

**Smoke path:**

- New org onboarding: Step 2 Property/Parking Rights required
- Step 3: Valid ID + Facebook Page only — Finish setup succeeds on Free
- Listing Verification does **not** show ownership proof as "missing" immediately after onboarding
- `/admin/approvals`: approve host ID + FB + listing rights → listing `ACTIVE`
- Get Verified Recommended requires selfie with ID (Facebook Page stays on Tier 1)

---

## 3. Host verification tiers

**Checklist:** [`host-verification-tiers.md`](./host-verification-tiers.md) § Phase 3 testing checklist

**Smoke path:**

- Host: Verified + Recommended upload flows; admin dialog tabs
- `/admin/approvals`: Recommended-pending org sorts **above** Verified-only pending (same filter)
- **Do not block done on:** Explore/search boost (deferred until public listings API)

---

## 4. CAPTCHA & anti-spam hardening

**Checklist:** [`captcha-anti-spam-hardening.md`](./captcha-anti-spam-hardening.md) § FOR TESTING

**Ops first (one environment):**

1. Cloudflare Turnstile widget → `VITE_TURNSTILE_SITE_KEY` (UI) + `TURNSTILE_SECRET_KEY` (edge)
2. Optional: `CAPTCHA_MODE=monitor` before enforce
3. Enable `[auth.captcha]` locally or Attack Protection on hosted Auth

**Smoke path:**

- Auth OTP: Continue + Resend both work with widget mounted
- Guest form / SD form / guest review: submit succeeds with real user timing (>1.5 s on page)
- Cloudflare **fail** test keys → human-verification error, not silent 500
- Rate limit: rapid team-invite resend → 429 with friendly copy

**Note:** Without keys, the layer is inert — safe for local dev, but QA cannot sign off until keys exist.

---

## 5. PWA installable / offline / push

**Checklist:** [`pwa-installable-offline-push.md`](./pwa-installable-offline-push.md) § FOR TESTING

**Ops first (dev):**

1. `bun run deploy:supabase:dev` — push migrations + `push-*` functions
2. VAPID keys + `PUSH_FANOUT_SECRET` + Vault secret (see plan config table)
3. Vercel: `VITE_VAPID_PUBLIC_KEY` → **redeploy UI**

**Smoke path:**

- `bun run build && cd ui && bun run preview` — SW registered, manifest valid
- Install on desktop + one mobile browser
- Offline read on Bookings / Inbox / Notifications
- Offline inbox text reply → sync when back online
- Push: host notification → device banner (requires deployed stack + real subscription)

---

## 6. Org granular team permissions

**Checklist:** [`org-granular-team-permissions.md`](./org-granular-team-permissions.md) § Phase 5 — QA

**Smoke path:**

- After the access-preserving migration, an existing org Admin still sees every property + parking (no regression)
- Invite a new org Admin scoped to a subset of listings with a chosen template (Full Access / Operations / Read Only) → accept → both the `organization_members` row and the assigned `property_members` / `parking_members` rows exist
- Sign in as the scoped Admin: org bookings, org dashboard, and the listing switcher show only the assigned listings
- That member appears on the assigned property's Team page with the **Org** badge
- Plan seat cap / plan-limited listings still enforce (org assignment does not silently add seats)

---

## 7. Super Admin step-up OTP

**Checklist:** [`super-admin-step-up-otp.md`](./super-admin-step-up-otp.md) § Manual QA

**Smoke path:**

- With no sudo token in `sessionStorage`, trigger each gated mutation (e.g. change a plan in `org-subscriptions-admin`, edit platform payment settings, grant an AI credit) → `SuperAdminOtpDialog` opens and the mutation does not run; read-only pages and GETs are untouched
- Click **Send OTP** → 6-digit code arrives at the signed-in super admin's own login email; wrong code, expired code, 5 failed attempts, and >3 sends per 15 min all show friendly errors
- After verify, the original action completes; further gated actions within 15 min do not re-prompt; after 15 min the prompt returns
- Host payment-settings OTP flow and all non-super-admin (host) surfaces behave exactly as before

---

## 8. Org Activity & Audit Log

**Checklist:** [`org-activity-audit-log.md`](./org-activity-audit-log.md) § Implementation status (Phases 0–6) + § Open questions (all resolved)

**Smoke path (dev stack):**

- **Feed** — open `/org/:slug/activity`, `/org/:slug/property/:pslug/activity`, `/org/:slug/parking/:kslug/activity`: newest-first, scrolls/loads more, filters (category chips, destructive-only, date range, search) narrow correctly; a row opens the detail sheet (actor, changes diff, ip_prefix, metadata). Property/parking pages show only that listing's rows.
- **Listing-scoped member** — sign in as a member assigned to one listing: they see only that listing's rows, never `scope='org'` rows.
- **Entity panels** — the **Activity** section on org / property / parking **Settings**, the org **Manage Member** dialog, and the finance / maintenance **edit** modals each show recent rows for that entity.
- **Super-admin toggle** — `/admin/orgs/:slug` → Activity: **Platform actions** (unchanged) vs **Org activity** (that org's `activity_log`, every row visible).
- **Realtime** — two tabs on the same org's Activity page; perform a mutation (cancel a booking, edit a setting) in tab A → tab B's feed refreshes within ~1–2s without a manual reload.
- **Virtualization** — on an org with 200+ events, scroll the full feed top-to-bottom: no blank gaps, no jump-back, detail sheet still opens on the right row.
- **Export + plan gate** — as owner/org-admin on a **paid** org: **Export CSV** downloads the filtered view. On a **Free** org: the button opens the upgrade modal (no download). As a listing-scoped member: export is not offered / 403.
- **Retention (optional)** — in SQL: `SELECT public.purge_activity_log(6, 100);` runs without error and only deletes rows older than 6 months; a plain `DELETE FROM activity_log` still raises `activity_log is append-only`.

**Then:** `bun run deploy:supabase` (needs `kamewave`) for migrations `20261315120000` / `120100` / `120200` + the `activity-log-retention-cron` function; provision `ACTIVITY_LOG_RETENTION_CRON_SECRET` + Vault `activity_log_retention_cron_secret` and run `SELECT public.sync_activity_log_retention_cron_job();`.

---

## 9. Pre-production launch audit

**Checklist:** [`./pre-production-launch-audit.md`](./pre-production-launch-audit.md) residual launch risk.

**Smoke path:**

- `bun run check:edge-types` and `bun run test:edge` green on the branch.
- Mobile Playwright: guest form + `/for-hosts/pricing` at 375px (no page-level horizontal scroll).
- On hosted **dev** only: take a backup, then a `--fresh-target` restore rehearsal. Do not restore into live production.
- Confirm `cd-prod.yml` is still gated (`CUTOVER_ENABLED` unset) until mt-prod exists.

---

## After QA

| Result               | Action                                                                                                       |
| -------------------- | ------------------------------------------------------------------------------------------------------------ |
| All checklists pass  | `bash scripts/dev/workflow-move.sh done <slug>` for each module                                              |
| Bug needs code       | Fix → re-run QA → then done                                                                                  |
| Product defers a gap | Document in [`../planned/`](../planned/) or GitHub Issue → still OK to done if gap was never in module scope |

Back to [for-testing index](./README.md) · In-progress disposition: [`../in-progress/README.md`](../in-progress/README.md)
