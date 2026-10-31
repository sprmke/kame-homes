---
stage: planned
title: 'Buy more AI credits (paid top-up wallet — Phase 4 of AI metering)'
status: planned
tags: [planning, planned-modules, ai, billing, paymongo, plans, credits, plans-and-permissions]
updated: 2026-09-11
---

# Buy more AI credits when the monthly allowance runs out

> This is the deferred **Phase 4** of [`../done/ai-usage-metering-credits-foundation.md`](../done/ai-usage-metering-credits-foundation.md) — the paid top-up checkout that the wallet, ledger, enforcement gate, and `adjustOrgCreditWallet()` were all built to plug into. **No re-architecture** of the metering system: this plan only adds a SKU catalog, a PayMongo checkout, a webhook fulfilment path, and the host UI.

## TL;DR

1. A host whose plan **already includes AI** hits their monthly credit allowance mid-cycle. Today the AI call fails with `AiQuotaExceededError` (`upgradeHook: true`) and the toast shows a **stub** "Buy more AI credits (coming soon)" message (`ui/src/features/dashboard/org/lib/aiQuotaToast.ts`).
2. This plan makes that real: a **super-admin-configurable credit-pack catalog** (`ai_credit_packs`), a **one-time PayMongo Hosted Checkout Session** per purchase, a **webhook fulfilment** path that calls the already-shipped `adjustOrgCreditWallet({ entryType: 'purchase_credit' })`, and a **"AI credits" tab** on `/org/:orgSlug/plans` with pack cards + purchase history.
3. Purchased credits are a **persistent, non-resetting** balance in `ai_platform_org_credit_wallet.balance_credits`. They are drawn down **only after** the plan's monthly allowance (`ai_platform_org_settings.monthly_credit_limit`, kept in sync with the plan by `syncAiCreditsFromPlan()`) is exhausted — the exact behaviour `assertOrgAndPropertyAiQuota()` / `recordAiUsage()` already implement.
4. Credits **extend the volume allowance** of AI features the plan already grants. They **do not unlock plan-gated AI features** (`aiReceptionist`, `aiMarketingGeneration`, …) — those stay behind `requireOrgPropertyFeature`. Copy must say this plainly.
5. Reuses **all** existing PayMongo plumbing: `_shared/paymongoClient.ts`, `_shared/paymongoWebhookVerify.ts`, `paymongo-webhook` (dispatches by `metadata.kind`), `processed_paymongo_events` dedupe, `platform_payment_settings` rails, `PUBLIC_GUEST_APP_ORIGIN` return URLs, `getPaymongoProviderPaymentState()` reconciliation. No new secrets, no new webhook endpoint.

## Why this is not greenfield — what already exists

Confirmed by direct reads this session:

### Credit wallet + ledger + enforcement (all shipped — Phases 1–3)

| Piece                                                                                                             | Location                                                                                                                                                                         | Notes                                                                                                                                                                                                                                                                                                    |
| ----------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ai_platform_org_credit_wallet`                                                                                   | migration `20261022140000_ai_credit_foundation.sql`                                                                                                                              | `organization_id PK`, `balance_credits NUMERIC(12,3) CHECK >= 0`. One row/org, created empty.                                                                                                                                                                                                            |
| `ai_platform_org_credit_ledger`                                                                                   | same                                                                                                                                                                             | Append-only. `entry_type CHECK IN ('usage_debit','purchase_credit','manual_adjustment')`, `credits_delta`, `related_usage_event_id`, `description`, `created_by`, `created_at`. Index `(organization_id, created_at DESC)`.                                                                              |
| `adjust_ai_platform_org_credit_wallet(p_organization_id, p_credits_delta)` RPC                                    | `20261022160000_ai_credit_foundation_hardening.sql`                                                                                                                              | Row-locked read-clamp-write. Returns `(balance_credits, applied_delta)`. Clamps to `>= 0`.                                                                                                                                                                                                               |
| `adjustOrgCreditWallet({ organizationId, creditsDelta, entryType, description, createdBy, relatedUsageEventId })` | `supabase/functions/_shared/aiCreditLedger.ts`                                                                                                                                   | Calls the RPC, then writes a ledger row with the **post-clamp `applied_delta`**. **This is the exact function Phase 4's webhook calls — just with `entryType: 'purchase_credit'`.**                                                                                                                      |
| `getOrgCreditWalletBalance()`, `getRecentCreditLedgerEntries()`, `estimateCreditsFromCostUsd()`                   | same                                                                                                                                                                             | Reused by the host wallet GET.                                                                                                                                                                                                                                                                           |
| Enforcement                                                                                                       | `_shared/aiUsageService.ts#assertOrgAndPropertyAiQuota()` (~L790–806)                                                                                                            | Once `creditAllowanceExceeded()` is true for org **or** property (daily **or** monthly), it reads `getOrgCreditWalletBalance()`: **`> 0` → allow the call (draws from wallet)**; `<= 0` → throw `AiQuotaExceededError('… — top up credits to continue')`.                                                |
| Debit                                                                                                             | `_shared/aiUsageService.ts#recordAiUsage()` (~L960–1010)                                                                                                                         | After a call that ran while the allowance was already exceeded, debits `creditsConsumed` from the wallet via `adjustOrgCreditWallet({ entryType: 'usage_debit', relatedUsageEventId })`. Uses the shared `creditAllowanceExceeded()` helper so the gate and the debit can't drift. Non-fatal on failure. |
| Plan → allowance sync                                                                                             | `_shared/planEntitlements.ts#syncAiCreditsFromPlan(orgId, planCode, monthlyCreditAllowance, assignedBy)`                                                                         | On plan assign/change, sets `ai_platform_org_settings.monthly_credit_limit = plan.features.aiMonthlyCreditAllowance` (Free/Starter = 0, Growth = 1 000, Pro = 10 000, Managed = 30 000 — see `plans-feature-matrix.md`).                                                                                 |
| Super-admin manual top-up                                                                                         | `supabase/functions/ai-platform-credit-wallet/index.ts` (`serveSuperAdmin`, step-up-OTP gated) + `ui/.../super-admin/components/AiCreditWalletCard.tsx` + `useAiCreditWallet.ts` | GET balance + ledger, POST `manual_adjustment`. Already logs `ai_credit_wallet.adjust` to the super-admin audit. `ENTRY_TYPE_LABEL` already maps `purchase_credit → 'Purchase'`.                                                                                                                         |
| Host-facing surface today                                                                                         | `ui/.../org/components/org-settings/OrgAiPlatformSection.tsx`                                                                                                                    | Org Settings → **AI usage**: monthly credit progress bar vs `monthlyCreditLimit`, "Top-up wallet balance: N credits" line when `> 0`, stub "billing coming soon".                                                                                                                                        |
| Client toast                                                                                                      | `ui/.../org/lib/aiQuotaToast.ts#toastAiQuotaExceeded()`                                                                                                                          | Already branches on `/credit/i` in the message → shows a **"Buy credits"** action that currently only fires `toast.message('… coming soon …')`. **This is the hook Phase 4 makes real.**                                                                                                                 |

### PayMongo plumbing (shipped — org subscription billing, org-level)

| Piece                                                                                                                                                | Location                                                                                                                                                                          | Reuse                                                                                                                                                                                                           |
| ---------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `createPaymongoCheckoutSession({ amountCentavos, lineItemName, description, successUrl, cancelUrl, paymentMethodTypes, referenceNumber, metadata })` | `_shared/paymongoClient.ts`                                                                                                                                                       | Used verbatim. `metadata` flows into the webhook payload. Min charge ₱1.00 enforced.                                                                                                                            |
| `phpToCentavos()`, `isPaymongoTestMode()`, `getPaymongoProviderPaymentState(ref)` ('open'\|'paid'\|'expired'\|'unknown')                             | same                                                                                                                                                                              | Amount conversion + missed-webhook polling.                                                                                                                                                                     |
| `mapPlatformMethodsToPaymongoCheckout()`                                                                                                             | same                                                                                                                                                                              | Rail selection from `platform_payment_settings.enabled_payment_methods` (defaults `qrph`, `paymaya`, `gcash`).                                                                                                  |
| `verifyPaymongoWebhookSignature(rawBody, sig, secret, { livemode })`                                                                                 | `_shared/paymongoWebhookVerify.ts`                                                                                                                                                | Unchanged.                                                                                                                                                                                                      |
| `paymongo-webhook` edge fn                                                                                                                           | `supabase/functions/paymongo-webhook/index.ts`                                                                                                                                    | **Unchanged** — verifies, dedupes via `processed_paymongo_events`, calls `handlePaymongoWebhookEvent(eventType, payload)`. `config.toml` already has `verify_jwt = false` + `static_files` for email templates. |
| Dispatch by `metadata.kind`                                                                                                                          | `_shared/subscriptionOrchestrator.ts#handlePaymongoWebhookEvent()`                                                                                                                | Already routes `kind === 'parking_booking'` → `parkingPaymentOrchestrator.ts`. **Phase 4 adds `kind === 'ai_credit_topup'` → `aiCreditPurchaseOrchestrator.ts`.** Absent/`org_subscription` unchanged.          |
| `extractWebhookInner()`, `readMetadataString()`, `readWebhookKind()`                                                                                 | `_shared/paymongoWebhookMetadata.ts`                                                                                                                                              | Payload digging, shared.                                                                                                                                                                                        |
| Return URL builder                                                                                                                                   | `_shared/orgBillingUrls.ts#orgPlansBillingCheckoutUrl(orgSlug, 'success'\|'cancelled')`                                                                                           | Mirror as `orgPlansAiCreditsCheckoutUrl(orgSlug, result)` → `/org/:slug/plans?tab=ai-credits&topup=success                                                                                                      | cancelled`. |
| Pending-txn reconciliation on load                                                                                                                   | `_shared/orgPaymentReconcile.ts#reconcilePendingOrgPaymentTransaction()` + `recoverExpiredOrgPaymentIfPaidOnPaymongo()`                                                           | Mirror as `_shared/aiCreditPurchaseReconcile.ts`.                                                                                                                                                               |
| Renewal/dunning cron                                                                                                                                 | `_shared/subscriptionOrchestrator.ts#runPlatformBillingCycle()` via `platform-billing-cron`                                                                                       | Add a **stale-pending-purchase sweep** here (no new cron).                                                                                                                                                      |
| Super-admin rails/settings                                                                                                                           | `platform_payment_settings`, `platform-payment-settings` edge fn, `/admin/pricing/payment-settings`                                                                               | Reused as-is. Credit packs use the same enabled rails.                                                                                                                                                          |
| Tier catalog CRUD pattern                                                                                                                            | `pricing-plans` edge fn (`serveSuperAdmin` + `requireSuperAdminStepUp`) + `SuperAdminPricingPlansTable`/`EditPricingPlanDialog` + `superAdminPlatformNav.ts` (`/admin/pricing/*`) | Template for the `ai-credit-packs` edge fn + `/admin/pricing/credit-packs` page.                                                                                                                                |
| Env                                                                                                                                                  | `PAYMONGO_SECRET_KEY`, `PAYMONGO_WEBHOOK_SECRET`, `PUBLIC_GUEST_APP_ORIGIN`                                                                                                       | **No new env vars.**                                                                                                                                                                                            |

## Scope

### In scope

- New table `ai_credit_packs` — super-admin SKU catalog (credits, bonus credits, PHP price, active/default, sort, tagline). Seeded working defaults.
- New table `ai_credit_purchases` — one row per top-up attempt (pending → paid/failed/expired/refunded), the **finance ledger** for credit revenue, and the **idempotency anchor** for fulfilment.
- `ai_platform_org_credit_ledger` — add `related_credit_purchase_id UUID` column and extend `entry_type` CHECK with `promotional_grant` (forward-compat for the sibling "free credits / event discounts" plan — no UI here).
- New edge functions: `ai-credit-packs` (super-admin CRUD), `create-ai-credit-checkout` (org owner → PayMongo session), `ai-credit-wallet` (org member GET — balance, allowance, packs, purchase history, pending checkout).
- New shared modules: `_shared/aiCreditCheckout.ts`, `_shared/aiCreditPurchaseOrchestrator.ts`, `_shared/aiCreditPurchaseReconcile.ts`. Extend `_shared/orgBillingUrls.ts`, `_shared/subscriptionBillingEmail.ts`, `_shared/subscriptionOrchestrator.ts` (one `kind` dispatch line), `_shared/notificationService.ts`, `_shared/activityLog.ts`.
- Webhook fulfilment wired into the existing `paymongo-webhook` via the `metadata.kind` dispatch (no new endpoint).
- Missed-webhook reconciliation on `ai-credit-wallet` load + a stale-pending sweep inside `platform-billing-cron`.
- Host UI: new **"AI credits"** tab on `OrgPlansPage`, pack grid, purchase confirmation dialog, PayMongo redirect + return/poll handling, purchase history, owner-only Buy gating. Wire the real `aiQuotaToast` "Buy credits" action. Link from `OrgAiPlatformSection`.
- Super-admin UI: `/admin/pricing/credit-packs` page (table + edit dialog), nav entry; a read-only `ai_credit_purchases` list for support/finance/manual reconcile; keep `AiCreditWalletCard` as the manual-adjust/comp tool.
- Emails (receipt, payment-failed), in-app notifications, activity-log events.
- Docs in the same change (per `CLAUDE.md`).

### Out of scope (explicitly not built here)

- **Free / promotional credit grants + event discount codes** — the sibling intake item "Manage how to give free AI credits to new users, give discount for special events" (`_to-plan.md` line ~955). This plan only lands the `promotional_grant` ledger `entry_type` and keeps `adjustOrgCreditWallet()` generic so that plan plugs in without schema change.
- **Automated refunds** — PayMongo refunds stay manual in their dashboard; super-admin then records a negative `manual_adjustment` + flips `ai_credit_purchases.status = 'refunded'`. A one-click refund button is a follow-up.
- **Promo / discount codes on packs** — `bonus_credits` covers "buy 5 000, get 500 free"; coupon codes are future.
- **credit_unit_usd change** ($0.001 → $0.01 for rounder SKUs, floated in `super-admin-service-cost-monitoring.md` Open Decision #6). Independent; packs sell whole "credits" regardless of the internal USD unit. If it changes, pack `credits` values may want a one-time rescale — noted in Open Decisions, not done here.
- **Per-feature sub-caps / guest-vs-staff split / monthly cost cap / platform circuit breaker** — `ai-paid-provider-and-production-quotas.md`. That plan lowers `default_*_credit_limit` so the gate actually bites in production; this plan is correct regardless of those numbers.
- **Multi-currency** — PHP only, matching the rest of the app.
- **Card rails** — inherit whatever `platform_payment_settings.enabled_payment_methods` has (QRPH / Maya / GCash by default).
- **Subscription-style auto-renew of credits** — a top-up is one-time. "Auto-refill when balance drops below X" is a future enhancement (schema note below leaves room).

## Phase 0 — product decisions (blocking only the seed values)

Do not invent these — confirm with whoever owns pricing:

1. **Pack SKUs + PHP prices.** Proposal (working defaults, mirror GitHub Copilot / Cursor overage shape): `topup_small` = 1 000 credits / ₱149; `topup_medium` = 5 000 + 500 bonus / ₱649 (default / "Best value"); `topup_large` = 20 000 + 3 000 bonus / ₱2 299. At `credit_unit_usd = $0.001` (1 000 credits ≈ $1 of model spend ≈ ₱58), these carry a healthy gross margin; **confirm** before seeding.
2. **Do purchased credits expire?** Proposal: **no expiry** (they were paid for). Schema ships with **no `expires_at`** on the wallet. If "expires after N months" is chosen, the wallet must become lot-based (`ai_credit_wallet_lots`, FIFO consumption with per-lot expiry) — that is a materially bigger change; flagged, not built.
3. **Who can buy?** Proposal: **org owner or platform admin only** (`verifyOrgOwner`), matching `create-org-subscription-checkout`. Org admins / members with `org.plans:view` see the balance and packs but the Buy button is disabled with "Ask the org owner to purchase."
4. **Step-up OTP on host purchase?** Proposal: **no** — subscription checkout has none; `verifyOrgOwner` + the PayMongo hosted page is the control. (Super-admin manual wallet adjust keeps its step-up.)
5. **Can a Free / Starter org (no AI in plan) buy credits?** Proposal: **no** — hide the Buy CTA and reject server-side unless the plan grants at least one AI capability (`aiMonthlyCreditAllowance > 0` **or** any `plan.features.ai*` true). Show "Upgrade to a plan with AI to buy credits" instead. Prevents selling credits that can't be spent.
6. **Do unused monthly allowance credits roll over?** Unchanged from the foundation: **no** (allowance = summed usage vs limit, resets at calendar-month boundary). Only the **purchased wallet** persists. Confirm the host-facing copy states this.
7. **Minimum purchase interval / abuse guard.** Proposal: reject a new checkout if the org has **≥ 3 `pending` purchase rows created in the last 10 minutes**; expire pending rows older than 30 minutes on the next `ai-credit-wallet` load or cron sweep.
8. **PHP vs USD display.** Host sees **PHP** pack prices and a **credit count** (never USD). Internal accounting stays USD. No FX.

## Data model

New migration file(s), next timestamp (`~20261316120000_ai_credit_topup.sql`). Never edit a shipped migration.

### `ai_credit_packs`

```
id                 UUID PK DEFAULT gen_random_uuid()
code               TEXT NOT NULL UNIQUE           -- stable slug, e.g. 'topup_medium'
name               TEXT NOT NULL                  -- host-facing, e.g. '5,000 credits'
tagline            TEXT                            -- optional, e.g. 'Most popular'
credits            NUMERIC(12,3) NOT NULL CHECK (credits > 0)
bonus_credits      NUMERIC(12,3) NOT NULL DEFAULT 0 CHECK (bonus_credits >= 0)
price_php          NUMERIC(12,2) NOT NULL CHECK (price_php >= 20)   -- PayMongo min
currency           TEXT NOT NULL DEFAULT 'PHP' CHECK (currency = 'PHP')
sort_order         INT NOT NULL DEFAULT 0
is_active          BOOLEAN NOT NULL DEFAULT TRUE
is_default         BOOLEAN NOT NULL DEFAULT FALSE  -- the "Best value" highlight
metadata           JSONB NOT NULL DEFAULT '{}'::jsonb
created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
```

- Partial unique index `WHERE is_default` (one default max) — mirrors `pricing_plans_one_default_idx`.
- `updated_at` trigger (`update_updated_at_column`).
- RLS enabled; `GRANT ALL … TO service_role`. Host GET goes through the edge function (service role), so no client SELECT policy — same as `pricing_plans`.
- **Deactivate, never delete** a pack that has purchase rows (edge fn enforces; FK below is `ON DELETE SET NULL` anyway).
- Seed the Phase 0 SKUs `ON CONFLICT (code) DO NOTHING`, with a comment that prices are working defaults pending pricing-owner sign-off.
- Super-admin validator ceiling: `credits + bonus_credits <= 10_000_000` (sanity, keeps a fat-finger out of `NUMERIC(12,3)` overflow territory).

### `ai_credit_purchases`

```
id                    UUID PK DEFAULT gen_random_uuid()
organization_id       UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE
credit_pack_id        UUID REFERENCES ai_credit_packs(id) ON DELETE SET NULL
pack_code_snapshot    TEXT                              -- for history after a pack is renamed/deleted
credits_purchased     NUMERIC(12,3) NOT NULL CHECK (credits_purchased > 0)   -- snapshot at checkout
bonus_credits         NUMERIC(12,3) NOT NULL DEFAULT 0 CHECK (bonus_credits >= 0)  -- snapshot
price_php             NUMERIC(12,2) NOT NULL             -- snapshot
currency              TEXT NOT NULL DEFAULT 'PHP'
provider              TEXT NOT NULL DEFAULT 'paymongo'
provider_reference    TEXT                               -- PayMongo checkout session id (cs_…)
checkout_url          TEXT
payment_method_type   TEXT                               -- filled from webhook (qrph/gcash/…)
status                TEXT NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending','paid','failed','expired','cancelled','refunded'))
failure_reason        TEXT
fulfillment_error     TEXT                               -- set if payment landed but wallet credit threw
credit_ledger_entry_id UUID REFERENCES ai_platform_org_credit_ledger(id) ON DELETE SET NULL
raw_webhook_payload   JSONB
initiated_by          UUID REFERENCES auth.users(id) ON DELETE SET NULL
created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
paid_at               TIMESTAMPTZ
fulfilled_at          TIMESTAMPTZ
updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
```

- Indexes: `(organization_id, created_at DESC)`; partial `(organization_id) WHERE status = 'pending'` for the reconcile/abuse-guard lookups; `(provider_reference)` for webhook resolution.
- `updated_at` trigger. RLS enabled; `GRANT ALL … TO service_role`.
- **Never deleted** — it is the revenue audit trail (mirrors `org_payment_transactions`).
- `fulfilled_at` + `credit_ledger_entry_id` together are the **"already credited"** marker. Fulfilment is idempotent on this row, not just on the webhook event id.

### `ai_platform_org_credit_ledger` changes

```
ALTER TABLE ai_platform_org_credit_ledger
  ADD COLUMN IF NOT EXISTS related_credit_purchase_id UUID
    REFERENCES ai_credit_purchases(id) ON DELETE SET NULL;

ALTER TABLE ai_platform_org_credit_ledger DROP CONSTRAINT ai_platform_org_credit_ledger_entry_type_check;
ALTER TABLE ai_platform_org_credit_ledger ADD CONSTRAINT ai_platform_org_credit_ledger_entry_type_check
  CHECK (entry_type IN ('usage_debit','purchase_credit','manual_adjustment','promotional_grant'));
```

- `aiCreditLedger.ts#insertCreditLedgerEntry()` / `adjustOrgCreditWallet()` gain an optional `relatedCreditPurchaseId` param (additive; existing callers unaffected).
- `AiCreditLedgerEntryType` union + `ENTRY_TYPE_LABEL` in `AiCreditWalletCard.tsx` gain `promotional_grant → 'Promo grant'`.

### `notifications` type check

New migration `~20261316120100_ai_credit_notification_types.sql` — drop + re-add `notifications_type_check` **copying the full current list** (from `20261310120000_analytics_review_notification_type.sql` plus any added since — verify against the latest at implementation time) and appending:

```
'ai_credit_topup_succeeded',
'ai_credit_topup_failed'
```

Add both to the `NotificationType` union in `_shared/notificationService.ts` and to any client notification-rendering map (`ui/src/features/dashboard/notifications/**`).

### Advisors

Run `mcp__supabase__get_advisors` after each migration — expect RLS-enabled/no-policy notices on the two new tables (acceptable, matches every `ai_platform_*` / `pricing_plans` table; document the reason inline).

## Edge functions

All `verify_jwt = false` in `config.toml` (Kong HS256, per `CLAUDE.md`). Prefer the `serveEdge.ts` helpers.

| Function                    | Helper + auth                                                                                                                                          | Method(s)                                                                                                                              | Purpose                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ai-credit-packs`           | `serveSuperAdmin` + `requireSuperAdminStepUp(req, admin, 'ai_credit_packs')` on writes                                                                 | GET (list, incl. inactive), POST (create), PATCH (update), DELETE→soft (set `is_active=false`; hard-delete only if zero purchase rows) | Catalog CRUD. Mirror `pricing-plans/index.ts` exactly: serialize/parse helpers, `parsePageLimit`, `postgrestOrIlikeValue` search, one-default enforcement, `logSuperAdminAction('ai_credit_pack.<verb>')`.                                                                                                                                                                                                                                                                |
| `create-ai-credit-checkout` | `serveAuthenticated` → `verifyOrgOwner(req, organizationId)`                                                                                           | POST `{ organizationId, creditPackId }` → `{ checkoutUrl, purchaseId, reused }`                                                        | Validates plan grants AI (Phase 0 #5), pack is active, abuse guard (Phase 0 #7). Snapshots pack → `ai_credit_purchases` (`pending`). Creates a PayMongo Hosted Checkout Session (`metadata.kind = 'ai_credit_topup'`, `transaction_id = purchase.id`, `organization_id`, `credit_pack_id`, `initiated_by`). Persists `provider_reference` + `checkout_url`. On PayMongo error → mark row `failed` + return 502/503. `logActivity('billing.ai_credits_purchase_started')`. |
| `ai-credit-wallet`          | `serveAuthenticated` → `verifyOrgAccess(req, { orgId \| orgSlug })` (any member; needs `org.plans:view` to see — reuse the same guard `org-plan` uses) | GET `?orgId=` or `?orgSlug=`                                                                                                           | Returns `{ balanceCredits, monthlyAllowance, monthCreditsConsumed, allowanceResetAtIso, canBuy, packs: AiCreditPackDto[], purchases: AiCreditPurchaseDto[] (last 20), pendingCheckoutUrl }`. On load: reconcile any `pending` purchases via `_shared/aiCreditPurchaseReconcile.ts` (poll PayMongo, fulfil-if-paid, expire-if-expired), then read fresh. `canBuy` = caller is owner/platform-admin **and** plan grants AI.                                                 |

Host `ai-credit-wallet` is deliberately **separate** from super-admin `ai-platform-credit-wallet` (different auth tier, different DTO). Do not overload `org-plan` — the AI-credits tab is its own surface and `org-plan` is already large.

`config.toml`: add `[functions.ai-credit-packs]`, `[functions.create-ai-credit-checkout]`, `[functions.ai-credit-wallet]` with `verify_jwt = false`. **No `static_files`** on these three (they send no email). `paymongo-webhook` already has the email-template `static_files` entry and needs no change.

## Shared modules

### `_shared/aiCreditCheckout.ts`

`createAiCreditCheckoutSession({ organizationId, creditPackId, initiatedBy })` → `{ checkoutUrl, purchaseId, reused }`. Modelled on `orgSubscriptionCheckout.ts`:

1. Load org (`id, name, slug`) — 404 if missing, error if slug blank.
2. Load pack — reject if not found or `is_active = false`.
3. Load the org's live plan features (`getActiveOrgSubscription` → `pricing_plans.features` via `parsePlanFeatures`, else Free features). Reject with `AiCreditNotAvailableError` ("Your plan does not include AI — upgrade to buy credits") unless AI is granted (Phase 0 #5).
4. Abuse guard (Phase 0 #7): count `pending` rows in the last 10 min → reject `TooManyPendingPurchasesError` if ≥ 3.
5. **Reuse an open session** for the same `(organization_id, credit_pack_id, status='pending')` if `getPaymongoProviderPaymentState(provider_reference) === 'open'` → return `{ reused: true }`. If `'paid'` → run fulfilment then reject "Payment already received — refresh". If `'expired'`/`'unknown'` → mark that row `expired`, continue.
6. Insert `ai_credit_purchases` (`pending`) with **snapshots**: `credits_purchased = pack.credits`, `bonus_credits = pack.bonus_credits`, `price_php = pack.price_php`, `pack_code_snapshot = pack.code`, `initiated_by`.
7. `createPaymongoCheckoutSession({ amountCentavos: phpToCentavos(pack.price_php), lineItemName: pack.name, description: '<Org> — <pack.name> AI credit top-up', successUrl: orgPlansAiCreditsCheckoutUrl(slug,'success'), cancelUrl: …('cancelled'), paymentMethodTypes: (await getPlatformPaymentSettings()).enabledPaymentMethods, referenceNumber: purchaseId.replace(/-/g,'').slice(0,32), metadata: { kind: 'ai_credit_topup', transaction_id: purchaseId, organization_id, credit_pack_id, initiated_by } })`.
8. Persist `provider_reference = session.id`, `checkout_url`. On any throw after the row insert → update row `status='failed', failure_reason` and rethrow (mirror `orgSubscriptionCheckout.ts`).

### `_shared/aiCreditPurchaseOrchestrator.ts`

`handleAiCreditPurchaseWebhookEvent(normalizedEventType, payload)` → `{ handled, action? }`. Called from `subscriptionOrchestrator.ts#handlePaymongoWebhookEvent()` when `readWebhookKind(payload) === 'ai_credit_topup'` (add the dispatch line next to the existing `parking_booking` branch).

`fulfilAiCreditPurchase({ purchaseId, providerReference?, paymentMethodType?, paidAt?, rawPayload? })`:

1. Load the purchase row. `if (row.status === 'paid') return;` `if (row.status !== 'pending') return;` (guards redelivery + the "already fulfilled by the reconcile path" race).
2. **Guarded claim**: `UPDATE ai_credit_purchases SET status='paid', paid_at=…, payment_method_type=…, provider_reference=COALESCE(…), raw_webhook_payload=… WHERE id = :id AND status = 'pending' RETURNING id`. If no row returned → someone else already fulfilled → `return` (no double credit).
3. `const { balanceCredits } = await adjustOrgCreditWallet({ organizationId, creditsDelta: credits_purchased + bonus_credits, entryType: 'purchase_credit', description: '<pack_code_snapshot> top-up (<credits> + <bonus> bonus)', createdBy: initiated_by, relatedCreditPurchaseId: purchaseId })`.
   - `adjustOrgCreditWallet` returns the ledger entry — capture its id and write it back: `UPDATE ai_credit_purchases SET fulfilled_at=NOW(), credit_ledger_entry_id=:ledgerId WHERE id=:id`.
   - **If the wallet credit throws** (DB hiccup): catch, `UPDATE … SET fulfillment_error = :msg WHERE id=:id` (row stays `status='paid'` but `credit_ledger_entry_id IS NULL`), then rethrow so the webhook returns 500 and PayMongo retries — **and** the cron sweep (below) retries. The step-2 claim already flipped `status='paid'`, so retries take the `status !== 'pending'` early-return in step 1 — therefore the **retry path must be a distinct function** `retryAiCreditFulfilment(purchaseId)` that fulfils rows where `status='paid' AND credit_ledger_entry_id IS NULL`, guarded the same way (`… WHERE id=:id AND credit_ledger_entry_id IS NULL`). This is the only safe way to re-drive a paid-but-uncredited row without risking a double credit.
4. Side effects (all non-fatal, wrapped in try/catch like `sendOrgSubscriptionReceiptEmail`):
   - `sendAiCreditPurchaseReceiptEmail({ ownerId, orgName, credits, bonusCredits, amountPhp, newBalance, orgSlug })` — new helper in `_shared/subscriptionBillingEmail.ts`, HTML template under `_shared/email-templates/`.
   - `createNotification({ organizationId, type: 'ai_credit_topup_succeeded', title: 'AI credits added', body: '<N> credits are now in your wallet', dedupeKey: purchaseId })`.
   - `logActivity({ action: 'billing.ai_credits_purchased', organizationId, scope: 'org', targetType: 'subscription', metadata: { credits, bonus_credits, amount_php: price_php, pack: pack_code_snapshot } })`.

`payment.failed` for `kind === 'ai_credit_topup'`:

- Resolve the purchase row; if not `pending` → `{ handled: false }`.
- **Stale-failed-but-actually-paid** recovery: `if (getPaymongoProviderPaymentState(provider_reference) === 'paid')` → `fulfilAiCreditPurchase(...)`; return `action: 'fulfilled_after_stale_failed_event'` (mirror the subscription path).
- Else: `UPDATE … SET status='failed', failure_reason='Payment failed', raw_webhook_payload=… WHERE id=:id AND status='pending'`; send `ai_credit_topup_failed` notification + `sendAiCreditPurchasePaymentFailedEmail`; `logActivity('billing.ai_credits_purchase_failed', severity warning)`.

### `_shared/aiCreditPurchaseReconcile.ts`

`reconcilePendingAiCreditPurchase(purchaseId)` → `'fulfilled' | 'expired' | 'still_pending' | 'failed'`. Mirrors `orgPaymentReconcile.ts`:

- Load row; if not `pending` (but `paid` with `credit_ledger_entry_id IS NULL`) → call `retryAiCreditFulfilment(purchaseId)`.
- `getPaymongoProviderPaymentState(provider_reference)`: `'paid'` → `fulfilAiCreditPurchase({ purchaseId, providerReference, paidAt: now })` → `'fulfilled'`; `'expired'` → mark `expired` → `'expired'`; `'open'`/`'unknown'` → `'still_pending'`.
- `reconcileStalePendingAiCreditPurchases(cutoffMinutes = 30)` — batch version for the cron sweep: for every `pending` row older than `cutoffMinutes`, run the single-row reconcile; mark rows with no `provider_reference` and age > cutoff as `failed` ("checkout never started").

### `_shared/orgBillingUrls.ts`

Add `orgPlansAiCreditsCheckoutUrl(orgSlug, result: 'success' | 'cancelled')` → `${origin}/org/${slug}/plans?tab=ai-credits&topup=${result}`.

### `platform-billing-cron` / `runPlatformBillingCycle()`

Add one line at the end of `runPlatformBillingCycle()` (before the return): `counters.aiCreditPurchasesReconciled = await reconcileStalePendingAiCreditPurchases()` (wrapped in try/catch, `counters.errors++` on throw — same shape as the `expireHostVerificationRewards()` block). No new cron job, no schedule change; document the added counter in `scheduled-jobs-and-testing.md`.

## Enforcement / entitlement semantics (no code change to the gate — spelled out for reviewers)

- `assertOrgAndPropertyAiQuota()` and `recordAiUsage()` **already** consult `ai_platform_org_credit_wallet` once the allowance is exceeded. A successful purchase simply raises `balance_credits`; the next AI call over-allowance is admitted and `recordAiUsage()` debits it. **Nothing in the gate needs touching.**
- Purchased credits are spendable **only on AI features the plan already includes**. A Free org with a positive wallet still cannot call `aiReceptionist` etc. — those are gated by `requireOrgPropertyFeature` upstream of metering. Phase 0 #5 keeps Free/Starter from buying at all, so this is mostly moot, but the copy in the purchase dialog must still say: _"Credits are spent on the AI features in your plan, after your monthly allowance runs out. They don't add new AI features."_
- If an org **downgrades** while holding a wallet balance: `syncAiCreditsFromPlan()` drops `monthly_credit_limit` (to 0 for Free). The wallet balance is untouched and persists; because the allowance is now 0, _every_ AI call on a still-included feature draws from the wallet. This is acceptable (they paid for those credits) — but note it in the downgrade route-guide so support isn't surprised.
- Property-level credit overrides (`ai_platform_property_settings.monthly_credit_limit`) still work — the wallet is org-level and shared, exactly as the pool is today.

## Host UI — `/org/:orgSlug/plans` → new "AI credits" tab

`OrgPlansPage.tsx`: `type PlansTab = 'plans' | 'billing' | 'compare' | 'ai-credits'`. Add a `TabsTrigger` (icon: `Sparkles` or `Coins`). Deep-linkable via `?tab=ai-credits`.

Components (new, under `ui/src/features/dashboard/plans/`):

- `components/AiCreditsPanel.tsx` — the tab body:
  - **Usage card**: monthly allowance progress (`monthCreditsConsumed / monthlyAllowance`, reuse `Progress` + aria-label pattern from `OrgAiPlatformSection`), "Resets <date, Asia/Manila>" (from `allowanceResetAtIso` — first of next calendar month, UTC boundary → render in Manila), wallet balance big-number ("N credits available to top up your allowance").
  - **Pack grid**: `AiCreditPackCard` per active pack — credits (+ "＋N bonus"), price PHP, effective ₱ per 1 000 credits, `is_default` → "Best value" ring/badge. `Buy` button (disabled + tooltip when `!canBuy`; hidden entirely and replaced by an `<PlanUpgradeLink feature="aiMonthlyCreditAllowance">` CTA when the plan has no AI).
  - **Purchase history**: `AiCreditPurchaseHistory` — last 20 `ai_credit_purchases` rows: date (Manila), credits (+bonus), amount, status pill (`paid`/`pending`/`failed`/`expired`/`refunded`), method. `pending` rows show a "Resume payment" link to `checkout_url`.
  - **Confirming banner**: reuse `PlanCheckoutConfirmationBanner` shape — shown while `topup=success` returned and a `pending` purchase still exists (poll `ai-credit-wallet` every 3s, stop on `paid`/timeout ~2 min, then success toast + refreshed balance).
- `components/AiCreditPurchaseDialog.tsx` — confirm dialog: pack summary, total PHP, the "credits ≠ new features" copy, `Continue to payment` → `create-ai-credit-checkout` → `window.location.assign(checkoutUrl)` (same tab, mirrors `openOrgPlanCheckout`).
- `hooks/useAiCreditWallet.ts` (host — **do not** collide with the super-admin hook of the same name in `super-admin/hooks/`; this one lives in `plans/hooks/`), `hooks/useCreateAiCreditCheckout.ts`, `hooks/useAiCreditCheckoutConfirmation.ts` (return-param + poll, modelled on `useOrgPlanCheckoutConfirmation.ts`).
- `lib/aiCreditApi.ts` — `fetchAiCreditWallet(orgId)`, `createAiCreditCheckout(orgId, packId)`; DTO types `AiCreditPackDto`, `AiCreditPurchaseDto`, `AiCreditWalletResponse`. Use `parseEdgeJsonOrQuota` where relevant.
- `lib/orgPlanCheckoutParams.ts` — add `parseAiCreditTopupReturn(value): 'success' | 'cancelled' | null`.

Wire the **real** "Buy credits" action:

- `ui/src/features/dashboard/org/lib/aiQuotaToast.ts` — `toastAiQuotaExceeded()` credit branch: instead of the stub `toast.message(...)`, navigate to `/org/<orgSlug>/plans?tab=ai-credits`. The toast has no router/org context today → add an `openBuyCreditsFromBridge()` to a small `plans/lib/buyCreditsBridge.ts` (mirror `upgradeModalBridge.ts`) that `OrgPlansPage` / the org shell registers with the current `orgSlug`. Fallback to the existing stub text when no bridge is registered (e.g. on a property-scoped surface with no org slug handy).
- `OrgAiPlatformSection.tsx` — the "Top-up wallet balance" line becomes a link to `…/plans?tab=ai-credits`; when `showUpgradeStub` **and** the plan already grants AI, add a "Buy more credits" button next to the "Upgrade" link.

Mobile / a11y (`mobile-responsive`, `accessibility` skills): pack grid `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`, ≥44px Buy targets, dialog focus trap, `Progress` aria-labels, status pills not colour-only (text label + icon). Copy via `human-copy` (no em dash, short, plain).

## Super-admin UI

- `/admin/pricing/credit-packs` — `SuperAdminCreditPacksPage` + `super-admin-pricing/SuperAdminCreditPacksTable` + `EditCreditPackDialog` (clone `SuperAdminPricingPlansTable` / `EditPricingPlanDialog` structure — name, code, credits, bonus, price PHP, tagline, sort, active, default; client + server validation; "deactivate" instead of delete when purchases exist). Nav entry in `superAdminPlatformNav.ts` under Pricing (`superAdminPaths.pricingCreditPacks = '/admin/pricing/credit-packs'`), route in the super-admin router.
- Hooks: `useCreditPacks` / `useUpsertCreditPack` / `useDeleteCreditPack` calling `ai-credit-packs`.
- **Purchases list** (support/finance): a section on the existing super-admin AI management page (near `AiCreditWalletCard`) — read-only, filter by org, shows `ai_credit_purchases` rows with status, amount, credits, `fulfillment_error`, and a "Re-run fulfilment" button that calls a `POST ai-credit-wallet`-adjacent super-admin action (or extend `ai-platform-credit-wallet` with `?action=retry_purchase&purchase_id=`) hitting `retryAiCreditFulfilment`. Manual refund = negative `manual_adjustment` via the existing `AiCreditWalletCard` + set `status='refunded'` (add a small "mark refunded" control).
- `AiCreditWalletCard` / `ai-platform-credit-wallet`: no core change — ledger now naturally shows `purchase_credit` rows from real purchases; add `related_credit_purchase_id` to the ledger DTO so the card can link a ledger row to its purchase. Add `promotional_grant` to `ENTRY_TYPE_LABEL`.

## Emails, notifications, activity log

| Channel                                                               | Event                                                                                                                               | Detail                                                                                                                                                                                                                                                           |
| --------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Email (Resend, `_shared/subscriptionBillingEmail.ts`)                 | `sendAiCreditPurchaseReceiptEmail`                                                                                                  | To org owner. Credits + bonus, ₱ paid, new wallet balance, link to the AI credits tab. New HTML template in `_shared/email-templates/` (already covered by `paymongo-webhook`'s `static_files` glob). Non-fatal.                                                 |
| Email                                                                 | `sendAiCreditPurchasePaymentFailedEmail`                                                                                            | To org owner on `payment.failed`. "Your AI credit top-up didn't go through" + retry link. Non-fatal.                                                                                                                                                             |
| In-app notification (`_shared/notificationService.ts`)                | `ai_credit_topup_succeeded`                                                                                                         | org-scoped, `dedupeKey = purchaseId`.                                                                                                                                                                                                                            |
| In-app notification                                                   | `ai_credit_topup_failed`                                                                                                            | org-scoped, `dedupeKey = purchaseId`.                                                                                                                                                                                                                            |
| Activity log (`_shared/activityLog.ts` + client `activityCatalog.ts`) | `billing.ai_credits_purchase_started` (info), `billing.ai_credits_purchased` (info), `billing.ai_credits_purchase_failed` (warning) | category `plans_billing`, `targetType: 'subscription'`, metadata `{ credits, bonus_credits, amount_php, pack }`. Add all three to both the server catalog and the client mirror. This satisfies the `audit-logging` requirement for the new mutating capability. |
| Super-admin audit (`superAdminAudit.ts`)                              | `ai_credit_pack.created` / `.updated` / `.deactivated`                                                                              | from the `ai-credit-packs` writes; `ai_credit_purchase.retry_fulfilment` / `.marked_refunded` from the support actions.                                                                                                                                          |

## Edge cases (production-readiness checklist)

1. **Duplicate webhook delivery** — `processed_paymongo_events` unique insert in `paymongo-webhook` returns `{ duplicate: true }` before dispatch. Even if it slipped through, step-1/step-2 status guards in `fulfilAiCreditPurchase` make it a no-op.
2. **`checkout_session.payment.paid` and `payment.paid` both fire** — distinct event ids (both pass dedupe) but resolve the **same** purchase row; the guarded `UPDATE … WHERE status='pending'` claim means only the first credits the wallet.
3. **Webhook arrives before `provider_reference` is persisted** — resolution keys on `metadata.transaction_id` (= `purchase.id`, always set at session creation) first, `provider_reference` second (`resolveOrgTransactionFromWebhookPayload` pattern).
4. **Missed webhook** (local dev, wrong endpoint, PayMongo outage) — `ai-credit-wallet` GET reconciles pending rows on every load; `platform-billing-cron` sweeps stale pendings every run. `getPaymongoProviderPaymentState` is the source of truth.
5. **Payment captured but wallet credit throws** — row is `status='paid'`, `credit_ledger_entry_id IS NULL`, `fulfillment_error` set; webhook returns 500 → PayMongo retries; cron + reconcile also call `retryAiCreditFulfilment`, which credits **only** rows still missing a ledger entry, under a guarded update. **Never double-credits.**
6. **Race: reconcile and webhook fulfil the same row simultaneously** — both go through the same guarded `WHERE status='pending'` (or `WHERE credit_ledger_entry_id IS NULL`) update; the loser gets 0 rows and returns.
7. **Concurrent purchases by the same org** — two rows, two sessions, two webhooks; the wallet RPC (`SELECT … FOR UPDATE`) serialises the two `purchase_credit` deltas; both land. Ledger shows both.
8. **Pack edited (price/credits) after the purchase row is created** — the row's snapshots (`credits_purchased`, `bonus_credits`, `price_php`, `pack_code_snapshot`) are authoritative for fulfilment; the live pack is irrelevant post-checkout.
9. **Pack deactivated mid-checkout** — `create-ai-credit-checkout` rejects at session creation if `is_active=false`; an already-`pending` session still fulfils at its snapshots. Host UI hides inactive packs.
10. **Amount tampering** — client sends only `creditPackId`; server looks up and snapshots the price. No client-supplied amount is ever trusted.
11. **Below PayMongo minimum** — `price_php >= 20` CHECK on the pack + `createPaymongoCheckoutSession`'s own `< 100 centavos` guard.
12. **Org has no AI in plan** — Buy CTA hidden; `create-ai-credit-checkout` returns a typed 4xx ("upgrade to buy credits"). Prevents dead credits.
13. **Org downgraded / suspended after buying** — wallet persists; see "Enforcement / entitlement semantics". `suspended` orgs: still allow viewing the balance; **block new purchases** while `suspended` (pay the subscription first) — mirror the downgrade guard. `past_due`: allow purchase (they may want AI while sorting billing) — confirm in Phase 0 if that should also be blocked.
14. **Org deleted while a purchase is pending** — `ON DELETE CASCADE` drops the row; webhook finds nothing → `{ handled: false }`, 200.
15. **User who started checkout leaves the org** — `initiated_by` FK is `ON DELETE SET NULL`; fulfilment still works (org-scoped), `createdBy` on the ledger just goes null.
16. **PayMongo returns `cancelled`** — `?topup=cancelled` → info toast, leave the `pending` row (reconcile/cron will `expire` it), no wallet change.
17. **Stale `pending` rows piling up** — abuse guard caps 3 pending / 10 min; cron sweep expires anything > 30 min with no payment; `create-ai-credit-checkout` expires same-pack pendings it supersedes.
18. **Test mode vs live** — `isPaymongoTestMode()` / `paymongoLivemodeFromEnv()` already feed webhook verification; nothing new.
19. **Rail disabled on the PayMongo account** — `mapPlatformMethodsToPaymongoCheckout` falls back to `['qrph','paymaya','gcash']`; super-admin keeps `platform_payment_settings` in sync with the merchant account (existing ops note).
20. **`PUBLIC_GUEST_APP_ORIGIN` unset** — `createPaymongoCheckoutSession` throws "successUrl must be fully qualified" → `create-ai-credit-checkout` returns 503 with a clear message (mirror subscription checkout).
21. **Very large pack / overflow** — super-admin validator caps `credits + bonus_credits <= 10_000_000`; wallet `NUMERIC(12,3)` comfortably holds realistic lifetime balances.
22. **Allowance boundary flips mid-request** — the foundation's `creditAllowanceExceeded()` helper is shared by gate + debit; a call admitted via the wallet is always the one debited. Unchanged here.
23. **Refund after spend** — super-admin negative `manual_adjustment` clamps at 0 (RPC `GREATEST(0, …)`); `applied_delta` on the ledger reflects the real decrement, so the ledger never implies a negative balance. `status='refunded'` on the purchase row is bookkeeping only.
24. **Notification/email/activity failure** — every side effect is try/caught and non-fatal; a receipt-email outage never blocks the wallet credit or the webhook 200.
25. **Reconcile called on a `refunded`/`failed` row** — early-returns (`status` not `pending` and not `paid`-uncredited).
26. **Two browser tabs both click Buy** — each creates its own `pending` row unless the "reuse open session for same pack" branch returns the first tab's URL; either way at most one is paid (the other expires).
27. **Currency drift** — every amount is PHP; `currency` columns CHECK `= 'PHP'`. No FX, no rounding ambiguity.
28. **Month rollover during a purchase** — allowance is recomputed per call from `ai_platform_usage_daily`; the wallet credit is timestamp-independent. No special handling.

## Security

- Host checkout: `verifyOrgOwner` (or platform admin) only. Viewing balance/packs: `verifyOrgAccess` + `org.plans:view`.
- Catalog CRUD: `serveSuperAdmin` + step-up OTP on writes.
- Webhook: unchanged — signature-verified + deduped. The new orchestrator trusts only `metadata.transaction_id` → DB lookup; never credits from amounts in the payload.
- No card data touches our servers (Hosted Checkout Session). No new secret. No PII in metadata (org id + purchase id only).
- RLS enabled on both new tables; all reads/writes go through service-role edge functions (matches the repo's "RLS is not the access layer" reality — the edge checks are).
- `security-auditor` pass recommended on `create-ai-credit-checkout` + the webhook orchestrator branch before ship.

## Phase breakdown

Each phase is independently shippable and ships its own docs (per `CLAUDE.md` "Docs are the source of truth").

### Phase 1 — Catalog (schema + super-admin)

- Migration: `ai_credit_packs` (+ seed working-default SKUs), `ai_credit_purchases`, `ai_platform_org_credit_ledger` column + `entry_type` CHECK extension, `notifications_type_check` extension.
- `ai-credit-packs` edge fn (`serveSuperAdmin`) + `config.toml`.
- `/admin/pricing/credit-packs` page, table, edit dialog, hooks, nav, route.
- **Docs:** `docs/architecture/data-model.md` (3 tables/columns), `docs/architecture/edge-functions.md` (`ai-credit-packs`), `docs/PROJECT.md` (new "AI credit top-up" stub section), `route-guides` for `/admin/pricing/credit-packs`, `docs/README.md` index row.

### Phase 2 — Purchase backend

- `_shared/aiCreditCheckout.ts`, `_shared/aiCreditPurchaseOrchestrator.ts` (+ `retryAiCreditFulfilment`), `_shared/aiCreditPurchaseReconcile.ts`, `_shared/orgBillingUrls.ts` addition.
- `create-ai-credit-checkout` + `ai-credit-wallet` edge fns + `config.toml`.
- One `kind === 'ai_credit_topup'` dispatch line in `subscriptionOrchestrator.ts#handlePaymongoWebhookEvent()`.
- `sendAiCreditPurchaseReceiptEmail` / `…PaymentFailedEmail` + templates.
- `NotificationType` additions + client render map.
- `activityLog.ts` + `activityCatalog.ts` additions (3 actions).
- Stale-pending sweep line in `runPlatformBillingCycle()`.
- **Docs:** `docs/architecture/edge-functions.md` (2 rows), `docs/architecture/integrations.md` (PayMongo webhook — new `ai_credit_topup` kind), `docs/PROJECT.md` (expand the section — checkout + webhook + fulfilment + cron sweep), `docs/archive/operations/paymongo-billing-setup.md` (webhook now also carries `ai_credit_topup`; enable the same events), `docs/archive/operations/scheduled-jobs-and-testing.md` (`platform-billing-cron` new counter), `audit-logging` (events emitted).

### Phase 3 — Host UI

- "AI credits" tab on `OrgPlansPage` + `AiCreditsPanel`, `AiCreditPackCard`, `AiCreditPurchaseDialog`, `AiCreditPurchaseHistory`.
- `plans/hooks/useAiCreditWallet.ts`, `useCreateAiCreditCheckout.ts`, `useAiCreditCheckoutConfirmation.ts`; `plans/lib/aiCreditApi.ts`; `orgPlanCheckoutParams.ts` return parser.
- `buyCreditsBridge.ts` + real `toastAiQuotaExceeded` navigation; `OrgAiPlatformSection` link + "Buy more credits" button.
- **Docs:** `route-guides` for `docs/guides/routes/org/plans.md` (new tab — behaviour, poll, return params, owner gating, "credits ≠ features" copy) **and** `docs/guides/routes/org/settings.md` (AI usage section link); `docs/architecture/plans-feature-matrix.md` (note top-up availability, tiers that can buy); `competitive-ux-research` optional (Copilot/Cursor overage UX) before finalising the pack-card layout.

### Phase 4 — Ops hardening + consolidation

- Super-admin `ai_credit_purchases` list + "Re-run fulfilment" + "Mark refunded"; ledger DTO `related_credit_purchase_id`.
- `security-auditor` pass; PayMongo **test-mode** end-to-end (ngrok) run.
- **Docs:** re-read `docs/PROJECT.md` section end-to-end; confirm every table/fn/route has a doc row; update `docs/workflow/done/ai-usage-metering-credits-foundation.md` ("Phase 4 shipped — see `ai-credits-topup-purchase.md`"); move this plan `planned → in-progress → done` via the `workflow` skill; `workflow-sync-scratchpads` to flip `_to-plan.md` line ~967 (📋 → done).

## Verification (manual — no test suite in this repo)

Per phase: `bun run type-check && bun run lint && bun run build`; `mcp__supabase__get_advisors` after each migration.

End-to-end (Phase 2–3, local + PayMongo test mode via ngrok, `bun run dev:api`):

1. Super-admin creates a pack on `/admin/pricing/credit-packs`; confirm it appears in `ai-credit-wallet` GET for a Growth/Pro org and is hidden for a Free org.
2. Owner opens the AI credits tab, buys the default pack → redirected to PayMongo → pay in test mode → returns to `?tab=ai-credits&topup=success`.
3. Confirm exactly one `ai_platform_org_credit_ledger` row (`entry_type='purchase_credit'`, `credits_delta = credits + bonus`, `related_credit_purchase_id` set); `ai_platform_org_credit_wallet.balance_credits` up by the same; `ai_credit_purchases` row `paid` + `fulfilled_at` + `credit_ledger_entry_id`; receipt email + `ai_credit_topup_succeeded` notification + `billing.ai_credits_purchased` activity row.
4. **Idempotency:** replay the PayMongo webhook (same + both event types) → balance unchanged, no new ledger row.
5. **Missed webhook:** point the webhook at a dead URL, pay, then load the AI credits tab → reconcile fulfils it exactly once.
6. **Fulfilment failure:** temporarily break `adjust_ai_platform_org_credit_wallet` (bad grant) → row goes `paid` + `fulfillment_error`, no ledger row; restore, run cron / reconcile → `retryAiCreditFulfilment` credits once.
7. **Over-allowance spend:** set the org's `monthly_credit_limit` low, exhaust it, make one more AI call → it succeeds, `recordAiUsage` writes a `usage_debit` row, wallet drops. Exhaust the wallet → next call throws `AiQuotaExceededError`; the toast "Buy credits" action lands on the AI credits tab.
8. **Failed payment:** simulate `payment.failed` → row `failed`, failed-email + notification, wallet unchanged.
9. Playwright: AI credits tab (pack grid, dialog, return/poll, owner vs non-owner), `/admin/pricing/credit-packs` CRUD.
10. `security-auditor` on the checkout fn + webhook branch.

## Open decisions (carry from Phase 0 + new)

1. Pack SKUs + PHP prices (Phase 0 #1) — pricing owner.
2. Expiry vs no-expiry for purchased credits (Phase 0 #2) — if "expires", the wallet must go lot-based; re-scope.
3. Buyer role: owner-only vs `org.plans:manage` (Phase 0 #3).
4. Allow purchases while `past_due`? (edge case #13) — leaning yes, block only `suspended`.
5. `credit_unit_usd` staying $0.001 vs moving to $0.01 (`super-admin-service-cost-monitoring.md` #6) — if it moves, decide whether existing pack `credits` values rescale.
6. Show a running "≈ X marketing captions / Y assistant messages" estimate on pack cards? (nice-to-have; needs per-feature average from `ai_platform_usage_events`).
7. Auto-refill ("top up automatically when balance < X") — future; schema leaves room (`ai_credit_purchases.metadata`), not built.

## Critical files

- `supabase/functions/_shared/aiCreditLedger.ts` — `adjustOrgCreditWallet()` is the fulfilment target; add optional `relatedCreditPurchaseId`.
- `supabase/functions/_shared/aiUsageService.ts` — `assertOrgAndPropertyAiQuota()` / `recordAiUsage()` wallet interaction (read-only reference; no change).
- `supabase/functions/_shared/subscriptionOrchestrator.ts` — `handlePaymongoWebhookEvent()` `kind` dispatch (one added branch) + `runPlatformBillingCycle()` (one added sweep line).
- `supabase/functions/_shared/orgSubscriptionCheckout.ts` + `orgPaymentReconcile.ts` — structural templates for the new checkout + reconcile modules.
- `supabase/functions/_shared/paymongoClient.ts` / `paymongoWebhookMetadata.ts` — reused verbatim.
- `supabase/functions/pricing-plans/index.ts` + `ui/.../super-admin/components/super-admin-pricing/*` — template for `ai-credit-packs` + `/admin/pricing/credit-packs`.
- `ui/src/features/dashboard/plans/pages/OrgPlansPage.tsx` + `hooks/useOrgPlanCheckoutConfirmation.ts` + `lib/orgPlanCheckoutParams.ts` — tab + return/poll pattern.
- `ui/src/features/dashboard/org/lib/aiQuotaToast.ts` + `org/components/org-settings/OrgAiPlatformSection.tsx` — the stub CTA made real.
- `supabase/migrations/20261022140000_ai_credit_foundation.sql` / `…150000_ai_credit_limits.sql` / `…160000_..._hardening.sql` — the schema/RPC conventions every new migration mirrors (never edit).

## Related plans / intake

- [`../done/ai-usage-metering-credits-foundation.md`](../done/ai-usage-metering-credits-foundation.md) — Phases 1–3; this is its Phase 4.
- [`../done/paymongo-subscription-billing.md`](../done/paymongo-subscription-billing.md) + [`../done/org-level-billing-migration.md`](../done/org-level-billing-migration.md) — the PayMongo plumbing reused here (it explicitly names AI-credit top-up as the future consumer of `_shared/paymongoClient.ts` + webhook verification).
- [`./ai-paid-provider-and-production-quotas.md`](./ai-paid-provider-and-production-quotas.md) — lowers `default_*_credit_limit` so the allowance gate actually bites; independent of this plan but makes the top-up meaningful in production.
- [`./super-admin-service-cost-monitoring.md`](./super-admin-service-cost-monitoring.md) — credit-unit decision #6; platform cost ceiling.
- `_to-plan.md` line ~955 "Manage how to give free AI credits to new users / event discounts" — sibling; consumes the same wallet + the `promotional_grant` ledger `entry_type` this plan lands.

Back to [planned index](./README.md).
