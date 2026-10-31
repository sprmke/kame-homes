---
title: 'PayMongo subscription billing (host → platform)'
status: active
tags: [workflow, done, billing, paymongo]
updated: 2026-08-18
stage: done
kind: plan
---

# PayMongo subscription billing (host → platform)

> **Shipped 2026-08-18 (property-scoped adaptation).** Implemented on **`property_subscriptions`** / **`pricing_plans`**: PayMongo checkout + webhook fulfillment, renewal/dunning cron, super-admin payment settings + manual cron trigger, host Plans billing UX, **`RequirePropertySubscriptionAccess`** suspension gate. **Requires env setup** before live use — [`docs/archive/operations/paymongo-billing-setup.md`](../../archive/operations/paymongo-billing-setup.md). **Intentionally not built:** org Settings Billing tab (billing on Property Plans), org-scoped subscription tables, AI credit PayMongo top-up (separate plan).

> **Plan catalog alignment (2026-08-18):** Property-scoped tier catalog and assignments live in **`pricing_plans`** / **`property_subscriptions`** from **[`host-plans-and-pricing-tiers.md`](../in-progress/host-plans-and-pricing-tiers.md)** (shipped). When implementing PayMongo checkout, attach payment/transaction tables to **`property_subscriptions`** by **`property_id`** — do **not** re-derive parallel **`platform_subscription_plans`** / org-scoped plan catalogs from this doc's original draft.

## Goal

Let organizations (hosts) pay **GFM** a recurring subscription fee to use the platform, via **PayMongo**. This is billing collected _from_ hosts _by_ GFM — not a payment gateway offered _to_ hosts for collecting guest payments (that stays the existing manual bank/GCash `app_settings.payment_methods` flow, untouched). Super-admin gets a new **Billing** area to manage plans, enabled payment rails, and org subscription status; org owners get a **Billing** settings tab to subscribe, see status, and pay. The design must support variable/changing pricing, handle payment failure with a defined fallback (retry → grace period → restriction), and be secure (no card data touches our servers, webhook signatures verified, secrets never in DB or git).

## Scope

**In scope**

- New DB tables: subscription plans, org subscriptions, payment transaction ledger, platform payment settings (enabled rails), webhook event dedupe.
- Super-admin UI: **Billing** nav item — Plans (CRUD), Payment Settings (enabled PayMongo payment methods + banks), Subscriptions (org list, status, manual override for support cases).
- Org-facing UI: **Org Settings → Billing** tab — current plan, status, next billing date, "Subscribe" / "Change plan" / "Pay now" via a PayMongo-hosted checkout link, transaction history.
- Edge functions: plan CRUD, payment settings CRUD, checkout-link creation, PayMongo webhook receiver, billing-cycle cron (renewal + dunning + grace period + suspension).
- PayMongo integration via **Payment Links** (hosted checkout — no card fields on our servers), restricted to low-fee rails: **QRPH**, **Maya**, and **online banking (Dob)** for specific banks — cards explicitly deprioritized (not built in v1).
- Idempotent, signature-verified webhook handling; audit ledger of every transaction.
- Fallback behavior when payment fails: automatic retry link, grace period, then dashboard restriction (not guest-facing booking flow disruption).
- Step-by-step PayMongo account setup guide (sandbox + live), written as a new ops doc.

**Out of scope (explicitly not built now)**

- Card payments / embedded card checkout (PCI scope) — Payment Links avoids this entirely; revisit only if a host segment specifically needs cards.
- Hosts using PayMongo to accept _guest_ payments — confirmed non-goal per the request; existing manual bank/GCash flow (`app_settings.payment_methods`) is unaffected.
- Proration, mid-cycle upgrades/downgrades, coupons/discounts — v1 is subscribe → renew → cancel only.
- Multi-currency — PHP only, matching the rest of the app.
- Automated card-on-file recurring charges — PayMongo doesn't offer native Stripe-style subscription billing; this plan's cron generates a fresh Payment Link each cycle instead (see Approach).
- The separate, already-deferred **Phase 4** of [`ai-usage-metering-credits-foundation.md`](../done/ai-usage-metering-credits-foundation.md) (buying AI credit top-ups). That plan explicitly names PayMongo as the future provider for credit purchases and says Phases 1–3's schema doesn't need to change when it lands. This plan should build the **shared PayMongo plumbing** (`_shared/paymongoClient.ts`, webhook verification, secrets, checkout-link helper) in a way that AI-credit-purchase can reuse later without re-deriving it — but wiring that specific flow is still deferred, not part of this plan.

## Approach

### Why Payment Links, not Payment Intents + embedded fields

PayMongo has no native recurring-billing engine (no Stripe-Billing equivalent). Two ways to charge a host each cycle:

1. **Payment Intents + saved payment method** — requires PCI-relevant card tokenization/storage and a client-side Elements-style integration; more moving parts, more security surface.
2. **Payment Links** — server creates a hosted-checkout link scoped to an amount; host pays on PayMongo's own page (QRPH, Maya, or online banking); webhook confirms. No card data, no PCI scope, minimal client code.

Given cards are explicitly deprioritized and the 3 target rails (QRPH, Maya, bank/Dob) are all redirect-based anyway, **Payment Links is the right fit** — it also mirrors this repo's existing bias toward hosted/redirect flows (Meta OAuth, Google OAuth) over embedding third-party payment UI.

### Billing-cycle model (no native recurring charge)

Since PayMongo can't auto-charge on file, the **billing cron generates a new Payment Link a few days before each `current_period_end`**, emails it to the org owner, and shows it in the Billing tab. This is the same shape as the existing `sd-refund-cron` / `contract-expiry-cron` jobs (`pg_cron` + `pg_net`, `sync_<job>_cron_job()` migration convention, optional `X-<Name>-Cron-Secret` header) — reuse that pattern exactly rather than inventing a new scheduling mechanism.

### Fallback when payment fails (explicit, as requested)

1. **Link created** (`platform_payment_transactions.status = 'pending'`) N days before period end (configurable, default 5).
2. **Paid** → webhook `link.payment.paid` → `platform_subscriptions` rolls `current_period_start/end` forward, status stays `active`. Receipt email sent.
3. **Unpaid at period end** → status → `past_due`, `grace_period_ends_at` set (default **+5 days**, super-admin configurable in Payment Settings). Reminder email + in-app banner with a **fresh** Payment Link (links can expire; never reuse a stale one).
4. **Still unpaid after grace period** → status → `suspended`. Dashboard access for that org's admin/host users is restricted to a read-only "past due" screen + the Billing tab (to pay). **Guest-facing booking flows for that org's properties are NOT blocked** — an org going past-due must not break live guests mid-stay. This mirrors the AI-quota pattern of failing closed only for the _feature in question_, never for the guest-facing core loop.
5. **Manual reconciliation escape hatch**: super-admin Subscriptions page can mark a subscription paid/extended manually (e.g., bank transfer received outside PayMongo, or goodwill extension) — same "ops override" shape as the AI credit wallet's manual adjustment path.
6. **Webhook `payment.failed`** (e.g., an attempted online-banking payment that the bank declined) → transaction marked `failed` with `failure_reason`, immediate email, but subscription status doesn't change until the period-end/grace logic above fires — a single failed attempt isn't a policy violation, non-payment by the deadline is.

This restriction severity (dashboard-only, guests untouched) is a judgment call — flagged in Open Questions for confirmation since it's a product decision, not a technical one.

### Data model

New tables (new migration file(s), timestamp per convention, e.g. `supabase/migrations/<ts>_platform_subscription_billing.sql`):

- **`platform_subscription_plans`** — `id`, `code` (unique slug), `name`, `description`, `price_php` (numeric), `billing_interval` (`month` | `year`, TEXT+CHECK per this repo's enum convention), `is_active`, `sort_order`, `metadata JSONB DEFAULT '{}'`, `created_at`, `updated_at`. Super-admin CRUD. Deactivating a plan (not deleting) keeps existing subscribers on it — supports "pricing may vary" without breaking active subscriptions, since `platform_subscriptions` snapshots the price at subscribe/renew time (see next).
- **`platform_subscriptions`** — `id`, `organization_id` (FK, **unique partial index** `WHERE status IN ('trialing','active','past_due')` so an org can only have one live subscription), `plan_id` (FK), `price_amount_snapshot` (numeric — captured at subscribe/renew so a later plan price change doesn't retroactively alter an in-flight period), `currency DEFAULT 'PHP'`, `status` (TEXT+CHECK: `trialing`/`active`/`past_due`/`suspended`/`canceled`/`incomplete`), `current_period_start`, `current_period_end`, `cancel_at_period_end BOOLEAN DEFAULT false`, `grace_period_ends_at`, `created_at`, `updated_at`.
- **`platform_payment_transactions`** — `id`, `organization_id`, `subscription_id`, `provider DEFAULT 'paymongo'`, `provider_reference` (PayMongo link id), `checkout_url`, `payment_method_type` (nullable until paid — PayMongo reports which rail was used), `amount`, `currency`, `status` (TEXT+CHECK: `pending`/`paid`/`failed`/`expired`/`cancelled`/`refunded`), `failure_reason`, `raw_webhook_payload JSONB`, `created_at`, `paid_at`. Full audit ledger — never deleted.
- **`platform_payment_settings`** — singleton row (pattern matches `ai_platform_global_settings`): `enabled_payment_methods JSONB DEFAULT '[]'` (e.g. `['qrph','paymaya','dob']`), `enabled_banks JSONB DEFAULT '[]'` (bank codes surfaced for the `dob`/online-banking rail — see Open Questions on which banks PayMongo actually offers under this account), `renewal_link_lead_days INT DEFAULT 5`, `grace_period_days INT DEFAULT 5`, `updated_at`, `updated_by`.
- **`processed_paymongo_events`** — `id`, `event_id UNIQUE`, `event_type`, `created_at`. Dedupe table mirroring `processed_emails` — PayMongo webhooks can be redelivered.

### Edge functions

Following `_shared/serveEdge.ts` helpers already in the codebase:

| Function                       | Helper                                              | Purpose                                                                                                                                                                                                                                                                                                                                                                                                |
| ------------------------------ | --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `platform-subscription-plans`  | `serveSuperAdmin`                                   | CRUD `platform_subscription_plans`.                                                                                                                                                                                                                                                                                                                                                                    |
| `platform-payment-settings`    | `serveSuperAdmin`                                   | GET/PUT `platform_payment_settings` (enabled methods/banks, grace period, lead days).                                                                                                                                                                                                                                                                                                                  |
| `platform-subscriptions-admin` | `serveSuperAdmin`                                   | List/search all org subscriptions + manual override (mark paid, extend, cancel).                                                                                                                                                                                                                                                                                                                       |
| `get-org-subscription`         | `serveAuthenticated` (org owner)                    | Current plan/status/next billing date/transaction history for the Billing tab.                                                                                                                                                                                                                                                                                                                         |
| `create-subscription-checkout` | `serveAuthenticated` (org owner)                    | Creates a PayMongo Payment Link for a chosen plan (new subscription) or the current plan (manual "Pay now" / retry), inserts a `pending` `platform_payment_transactions` row, returns `checkout_url`.                                                                                                                                                                                                  |
| `paymongo-webhook`             | `servePublic` (`verify_jwt=false` in `config.toml`) | Verifies PayMongo signature, dedupes via `processed_paymongo_events`, handles `link.payment.paid` / `payment.paid` / `payment.failed`, delegates all state changes to `_shared/subscriptionOrchestrator.ts` (never inline — same rule as `workflowOrchestrator.ts` for bookings).                                                                                                                      |
| `platform-billing-cron`        | `serveCronPost`                                     | Daily (or every few hours) job: find subscriptions needing a renewal link (`current_period_end - renewal_link_lead_days <= now()`), generate+email them; find `past_due` subscriptions whose grace period expired → `suspended`; mirrors `sd-refund-cron`/`contract-expiry-cron` scheduling via a `sync_platform_billing_cron_job()` migration function and optional `X-Platform-Billing-Cron-Secret`. |

### Shared modules (`supabase/functions/_shared/`)

- **`paymongoClient.ts`** — thin wrapper over PayMongo's REST API (`POST /links`, `GET /links/:id`) using `PAYMONGO_SECRET_KEY` (Basic-auth base64, per PayMongo's API convention). No SDK dependency needed — mirrors this repo's pattern of hand-rolled fetch wrappers in `_shared/`.
- **`paymongoWebhookVerify.ts`** — HMAC-SHA256 signature verification, structured exactly like `_shared/resendWebhookVerify.ts` (decode secret, timing-safe compare, timestamp tolerance window). **Confirm the exact `Paymongo-Signature` header format against PayMongo's current webhook docs at implementation time** — flagged in Open Questions since API details can drift from what's assumed here.
- **`subscriptionOrchestrator.ts`** — single place that mutates `platform_subscriptions` + `platform_payment_transactions` on webhook events or cron actions (renew, mark past-due, suspend, reactivate) + triggers the matching Resend email (`_shared/emailService.ts`) — mirrors `workflowOrchestrator.ts`'s "no side effects inline in the handler" rule from `CLAUDE.md`.

### Payment rail selection (QRPH / Maya / bank)

Architecture is **data-driven**, not hardcoded to 3 specific rails: `platform_payment_settings.enabled_payment_methods` is passed straight into PayMongo's `payment_method_types` array when creating a Payment Link. Super-admin picks whichever rails are actually cheapest/available on the live PayMongo account via the Payment Settings page — no code change needed to add/remove a rail later. This sidesteps needing to hardcode "Maribank" (unclear reference — see Open Questions) into the schema.

### Access restriction on suspension

New `_shared/subscriptionAccess.ts#assertOrgSubscriptionActive(organizationId)` — called from admin-dashboard-facing edge functions (not guest-facing ones) once wired; v1 ships the check itself plus wiring it into the top-level admin shell data fetch (`RequireAdmin`-equivalent for org context) rather than every single endpoint, to keep the blast radius contained and reviewable.

## Implementation tasks

Per `CLAUDE.md`'s "Docs are the source of truth" rule, each phase below ships its doc updates **in the same change** as that phase's code — not deferred to a final "docs phase." Every phase ends with its own `Docs:` line(s); Phase 6 is a final audit pass to confirm nothing was missed, not the first time docs get touched.

### Phase 0 — PayMongo account setup (do this first, no code)

1. Create a PayMongo account at the PayMongo dashboard with GFM's business details.
2. **Test/sandbox mode** is available immediately on signup — no approval needed. Get test keys from Dashboard → Developers → API Keys (toggle "Test mode").
3. Create a **test-mode webhook** endpoint pointing at the local/dev tunnel or the dev Supabase project's `paymongo-webhook` function URL; subscribe to `link.payment.paid`, `payment.paid`, `payment.failed`. Copy the per-endpoint signing secret.
4. Store test keys in `supabase/.env.local` (gitignored) as `PAYMONGO_SECRET_KEY` / `PAYMONGO_WEBHOOK_SECRET`; add placeholder entries to `supabase/.env.example`.
5. **Live mode** requires business verification (KYB): business registration docs (DTI/SEC), valid government ID of the authorized representative, proof of business address, and a settlement bank account. Submit via Dashboard → Business Profile / Activate live account. Approval timeline is PayMongo's, not ours — budget several business days.
6. Once live-approved, **explicitly request activation** for QRPH / Maya / online-banking (Dob) rails if they aren't enabled by default on the live account — PayMongo sometimes gates e-wallet/QRPH rails behind manual activation for new merchants. Confirm current per-rail fee % in the live dashboard (fee schedules are account/tier-specific and change over time — don't hardcode assumed percentages into product copy).
7. Create a **separate live-mode webhook** endpoint (prod project's `paymongo-webhook` URL) with its own signing secret. Store live keys as hosted secrets on the **prod** Supabase project only (`bun run deploy:supabase` target), never the dev project — same dev/prod secret-separation already used for every other integration in this repo.
8. Write up the exact dashboard steps + screenshots-if-useful as `docs/archive/operations/paymongo-billing-setup.md` (mirrors `docs/archive/operations/ai-platform-billing.md`'s format) so this is repeatable without re-deriving it.

**Docs (same change):**

- [ ] `docs/archive/operations/paymongo-billing-setup.md` — new file, sandbox + live account setup steps (step 8 above).
- [ ] `docs/architecture/validation-and-env.md` — add `PAYMONGO_SECRET_KEY` / `PAYMONGO_WEBHOOK_SECRET` to the Edge (`supabase/.env.local` / hosted secrets) section; add placeholder rows to `supabase/.env.example`.

### Phase 1 — Schema + super-admin plan management

- [ ] Migration: `platform_subscription_plans`, `platform_subscriptions`, `platform_payment_transactions`, `platform_payment_settings`, `processed_paymongo_events` (`supabase/migrations/<ts>_platform_subscription_billing.sql`).
- [ ] `supabase/functions/platform-subscription-plans/index.ts` (`serveSuperAdmin`).
- [ ] `ui/src/features/dashboard/super-admin/pages/SuperAdminBillingPlansPage.tsx` + `components/super-admin-billing/` (table + create/edit dialog, following `SuperAdminDevelopmentsPage.tsx`/`SuperAdminSupportPage.tsx` structure).
- [ ] Add `billing`/`billingPlans` to `superAdminPaths.ts`, route in `super-admin/routes/index.tsx`, nav entry in `SUPER_ADMIN_PLATFORM_DESTINATIONS` (`superAdminPlatformNav.ts`).

**Docs (same change):**

- [ ] `docs/architecture/data-model.md` — document all 5 new tables from this migration (even though some fields are only exercised by later phases — the schema lands here, so it belongs here).
- [ ] `docs/architecture/edge-functions.md` — add `platform-subscription-plans` row.
- [ ] `docs/PROJECT.md` — new "Platform subscription billing (PayMongo)" section stub (Tables + this phase's edge function only; expanded incrementally by later phases), same table format as the existing "Platform AI metering" section.
- [ ] `docs/README.md` — index row pointing at the new `docs/PROJECT.md` section (once it exists) and this plan doc.
- [ ] Invoke the `route-guides` skill for the new super-admin Billing Plans page — `docs/guides/routes/README.md` route→file mapping.

### Phase 2 — PayMongo plumbing + checkout

- [ ] `_shared/paymongoClient.ts`, `_shared/paymongoWebhookVerify.ts`.
- [ ] `supabase/functions/create-subscription-checkout/index.ts` (`serveAuthenticated`, org owner only — reuse `orgAuth.ts` ownership check).
- [ ] Add `create-subscription-checkout`, `paymongo-webhook` to `supabase/config.toml` (`verify_jwt = false` for the webhook only; add `static_files` only if email templates are involved in receipts — they are, via `emailService.ts`, so double-check).

**Docs (same change):**

- [ ] `docs/architecture/edge-functions.md` — add `create-subscription-checkout` row.
- [ ] `docs/PROJECT.md` — extend the Phase 1 section stub with the checkout flow.

### Phase 3 — Webhook + orchestrator + ledger

- [ ] `_shared/subscriptionOrchestrator.ts` (renew / mark-paid / mark-failed / suspend / reactivate).
- [ ] `supabase/functions/paymongo-webhook/index.ts` (`servePublic`, signature verify, dedupe via `processed_paymongo_events`, delegate to orchestrator).
- [ ] Email templates: subscription receipt, payment-failed/retry, grace-period reminder, suspended notice — under `_shared/email-templates/`, `static_files` entry in `config.toml`.

**Docs (same change):**

- [ ] `docs/architecture/edge-functions.md` — add `paymongo-webhook` row.
- [ ] `docs/architecture/integrations.md` — new "§9.x PayMongo webhook (subscription billing)" entry alongside the existing Resend/approval-email-inbound sections (`§9.2`), covering signature verification + dedupe + which events are handled.
- [ ] `docs/PROJECT.md` — extend the section with webhook/orchestrator behavior + the new email templates.

### Phase 4 — Billing cycle cron

- [ ] `supabase/functions/platform-billing-cron/index.ts` (`serveCronPost`).
- [ ] Migration: `sync_platform_billing_cron_job()` function + `pg_cron` schedule (daily), mirroring `sync_parking_broadcast_expire_cron_job()`'s Vault-secret self-activation pattern.
- [ ] Manual trigger button on the super-admin Subscriptions page (mirrors `useRunSdRefundCron`) for testing/support.

**Docs (same change):**

- [ ] `docs/archive/operations/scheduled-jobs-and-testing.md` — add `platform-billing-cron` to the §1 scheduled-jobs table (edge function, purpose, schedule) alongside `sd-refund-cron`/`contract-expiry-cron`.
- [ ] `docs/architecture/edge-functions.md` — add `platform-billing-cron` row.
- [ ] `docs/PROJECT.md` — extend the section with cron/renewal behavior.

### Phase 5 — Super-admin Payment Settings + Subscriptions pages, org Billing tab

- [ ] `supabase/functions/platform-payment-settings/index.ts`, `platform-subscriptions-admin/index.ts`, `get-org-subscription/index.ts`.
- [ ] `ui/src/features/dashboard/super-admin/pages/SuperAdminBillingSettingsPage.tsx` (enabled rails/banks toggles, grace period + lead days config).
- [ ] `ui/src/features/dashboard/super-admin/pages/SuperAdminBillingSubscriptionsPage.tsx` (org list, status, manual override actions).
- [ ] `ui/src/features/dashboard/org/components/org-settings/OrgBillingSection.tsx` + hook `useOrgSubscription.ts` (mirrors `OrgAiPlatformSection`/`useAiPlatformSettings.ts`), wired into `OrgSettingsPage.tsx` as a new **Billing** tab.
- [ ] `_shared/subscriptionAccess.ts#assertOrgSubscriptionActive` + wire into the admin-shell org data fetch for the "suspended → read-only" banner/gate.

**Docs (same change):**

- [ ] `docs/architecture/edge-functions.md` — add the remaining 3 endpoint rows.
- [ ] `docs/PROJECT.md` — finalize the section: full Tables/Edge functions/UI rows, matching the format of other completed modules (e.g. "Help & Support").
- [ ] Invoke the `route-guides` skill for: the org Billing settings tab (`docs/guides/routes/org/...`), and the two new super-admin Billing pages — per-page save-flow/validation/UX behavior, following `.cursor/rules/route-guides.mdc`'s mapping and Host-facing-knowledge rules.
- [ ] `docs/README.md` — update the index row if the section moved/renamed since Phase 1.

### Phase 6 — Docs consolidation & sign-off

Not the first time docs are touched (see note above) — this is a final audit before closing the plan:

- [ ] Re-read `docs/PROJECT.md`'s new section end-to-end for accuracy against what actually shipped (phase-by-phase edits can drift from the final implementation).
- [ ] Confirm every new table, edge function, and route from Phases 0–5 has a corresponding doc row (spot-check with `grep` for table/function names across `docs/architecture/`).
- [ ] Confirm `docs/archive/operations/paymongo-billing-setup.md` still matches the actual dashboard flow (PayMongo's UI can change between Phase 0 and shipping).
- [ ] Move this plan from `docs/workflow/planned/` to `docs/workflow/done/` (or `in-progress/` first, per the existing workflow lifecycle) via the `workflow` skill, and run `workflow-sync-scratchpads` so `docs/workflow/intake/_to-plan.md`'s status emoji reflects completion.

## Open questions

1. **"Maribank"** — not a PayMongo payment method I can confirm by name. Likely either (a) shorthand for Maya's banking arm, or (b) one of the specific banks under PayMongo's online-banking (Dob) rail (e.g. BPI, UnionBank, RCBC, Chinabank). Since the architecture is data-driven (Phase 5's enabled-rails toggle), this doesn't block building — confirm the actual name/fee once inside the live PayMongo dashboard (Phase 0, step 6) and enable it there.
2. **Grace period + suspension severity** — plan assumes 5-day link lead time, 5-day grace period, and "dashboard read-only, guests unaffected" as the suspension behavior. Confirm these numbers and that guest-facing flows should never be blocked by an org's billing status.
3. **Trial period** — plan includes a `trialing` status in the schema but no trial-granting flow (e.g., "first N days free" on signup). Confirm whether v1 needs this or whether every org starts `incomplete`/unsubscribed until they pay.
4. **Exact PayMongo webhook signature header format** — implementation should re-verify against PayMongo's current docs before writing `paymongoWebhookVerify.ts`, since this plan's description is based on the general shape (`Paymongo-Signature: t=...,te=...,li=...`, HMAC-SHA256) and API details can change.
