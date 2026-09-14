---
stage: for-testing
title: 'Super Admin step-up OTP for sensitive actions'
status: in-progress
tags: [planning, security, super-admin, admin, auth, otp]
updated: 2026-09-09
---

# Super Admin step-up OTP for sensitive actions

**Status:** In progress — v1 implemented 2026-09-06.

## Goal

Add a second factor to every critical / money / global-config action in the Super Admin
console (`/admin/*`). Even with a stolen super-admin session, an attacker cannot change a
subscription, move money, or flip a platform-wide switch without a one-time code emailed
to the **acting super admin's own login email**.

Reuse the exact UX + crypto model already shipped for host payment-settings changes
(`settings-verification` + `SensitiveSettingsOtpDialog`).

## Model — "sudo window" (step-up auth)

Chosen over per-change tokens because super-admin actions are heterogeneous (some have no
clean diff, e.g. "run billing cron") and an admin typically does several in one sitting.
This mirrors the standard pattern (GitHub sudo mode, AWS console re-auth, Stripe).

1. Super admin triggers any gated mutation.
2. The edge function returns `401 { code: 'SUPERADMIN_OTP_REQUIRED', action }` — the
   mutation does not run.
3. The client's edge wrapper catches that code and opens `SuperAdminOtpDialog` — the same
   two-phase modal as the host payment-settings flow. It does **not** auto-send; the admin
   clicks **Send OTP** first (confirmation step), then:
   - `send_otp` → 6-digit code (hashed, 10-min TTL) emailed to `user.email`, rate-limited
     3 / 15 min per user.
   - `verify_otp` → returns a signed **sudo token** (HMAC-SHA256, 15-min TTL, bound to
     `user.id`).
4. Token is stored in `sessionStorage` and sent as `x-superadmin-otp` on every edge call.
5. The wrapper retries the original request once. For the next 15 min, no further prompts.
6. On expiry the server 401s again and the cycle repeats.

## Surface — gated actions

Server-side gate = `requireSuperAdminStepUp(req, user, action)` at the top of every
mutating branch of these `serveSuperAdmin` functions (GET/OPTIONS always pass):

| Function                              | Action key                            | What it protects                                                            |
| ------------------------------------- | ------------------------------------- | --------------------------------------------------------------------------- |
| `org-subscriptions-admin`             | `org_subscription`                    | assign/change plan, price override, extend billing period, run billing cron |
| `platform-payment-settings`           | `platform_payment_settings`           | PayMongo rails + dunning config                                             |
| `platform-parking-settings`           | `platform_parking_settings`           | parking commission % + guest rates                                          |
| `parking-payouts`                     | `parking_payout`                      | mark disbursed / record clawback                                            |
| `ai-platform-credit-wallet`           | `ai_credit_wallet`                    | manual AI-credit grant / adjustment                                         |
| `ai-platform-global-settings`         | `ai_global_settings`                  | AI kill switch + quota enforcement                                          |
| `dashboard-assistant-global-settings` | `dashboard_assistant_global_settings` | assistant kill switch                                                       |
| `pricing-plans`                       | `pricing_plans`                       | subscription tier catalog CRUD                                              |
| `platform-settings`                   | `platform_settings`                   | signups, maintenance mode, default plan, rate-limit ceiling                 |
| `update-platform-host-settings`       | `platform_host_settings`              | platform host announcements (broadcast blast radius)                        |
| `decide-contract-consideration`       | `contract_consideration`              | grant / deny listing contract                                               |
| `ai-platform-generation-overrides`    | `ai_generation_overrides`             | per-property Generate credit caps + Premium image/video hatch               |

**Not gated** (low-risk, keeps support flow fast, trivial to add later via the registry):
support tickets (`reply-support-ticket-admin`, `update-support-ticket-status`), Help Center
FAQ CRUD.

**Follow-up:** the approval-queue functions (`approve-org-verification`,
`approve-listing-authorization`, …) run on `serveAuthenticated` with an internal
super-admin check, not `serveSuperAdmin`. Gating those needs the same one-liner but is
out of scope for v1.

## Files

**New**

- `supabase/migrations/20261305140000_super_admin_verification_challenges.sql` — platform-
  scoped challenge table (no org/property FK), RLS on, service-role grant.
- `supabase/functions/_shared/superAdminVerification.ts` — action registry, OTP challenge
  CRUD, sudo-token sign/verify, `requireSuperAdminStepUp`.
- `supabase/functions/_shared/superAdminStepUpEmail.ts` — branded OTP email to the acting
  super admin (`renderBrandedEmailShell` + `RESEND_FROM_EMAIL`).
- `supabase/functions/super-admin-verification/index.ts` — `serveSuperAdmin`; POST
  `send_otp` / `verify_otp`.
- `ui/src/features/dashboard/super-admin/hooks/useSuperAdminVerification.ts`
- `ui/src/features/dashboard/super-admin/components/SuperAdminOtpDialog.tsx`
- `ui/src/features/dashboard/super-admin/components/SuperAdminStepUpProvider.tsx`

**Changed**

- `supabase/functions/_shared/cors.ts` — allow `x-superadmin-otp` request header.
- `supabase/config.toml` — register `super-admin-verification` (`verify_jwt = false` +
  email `static_files`).
- The 12 gated functions above — add the guard.
- `ui/src/features/dashboard/org/lib/edgeClient.ts` — sudo-token storage helpers,
  `registerSuperAdminStepUp`, 401-`SUPERADMIN_OTP_REQUIRED` catch + single retry, attach
  `x-superadmin-otp`.
- `ui/src/features/dashboard/super-admin/components/SuperAdminShell.tsx` — wrap in
  `SuperAdminStepUpProvider`.

## Env vars

- `SUPER_ADMIN_VERIFICATION_SECRET` (optional) — HMAC key for the sudo token. Falls back
  to `SETTINGS_VERIFICATION_SECRET` → `SUPABASE_SERVICE_ROLE_KEY` → a local-dev constant.
- Reuses existing `RESEND_API_KEY` + `RESEND_FROM_EMAIL`.

## Audit

`super-admin-verification` writes `super_admin.step_up_requested` and
`super_admin.step_up_verified` to `super_admin_audit_events` via `logSuperAdminAction`.
Each gated mutation keeps its own existing audit entry.

## Manual QA

- [ ] With no sudo token, every gated mutation returns the OTP dialog; read-only pages and
      GETs are untouched.
- [ ] Code arrives at the signed-in super admin's email; wrong code / expired / 5 failed
      attempts / >3 sends per 15 min all handled.
- [ ] After verify, the original action completes and further gated actions in the next
      15 min do not re-prompt; after 15 min they do.
- [ ] Non-super-admin (host) surfaces and the host payment-settings OTP are unaffected.
