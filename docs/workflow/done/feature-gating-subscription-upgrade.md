---
title: 'Feature gating & subscription upgrade prompts'
status: active
tags: [workflow, in-progress, billing, pricing, paywall]
updated: 2026-08-19
stage: done
kind: plan
---

# Feature gating & subscription upgrade prompts

## Context

Hosts currently get every feature in the app for free — no plan-tier differentiation exists anywhere. This is intake item **#4** of the five-way pricing/plans split described in [`host-plans-and-pricing-tiers.md`](./host-plans-and-pricing-tiers.md)'s Context section ("Allow features based on subscription plan & show payment modal"): gate consequential actions behind plan tiers and show a subscription/upgrade modal at the right moment, with an explicit UX philosophy — **users can explore and play with a feature freely; only the final, consequential action (publish, send, enable) requires paying**. Marketing Studio is the reference example: template create/edit stays free, preview gets a watermark on non-paid plans, and clicking Publish is what triggers the upgrade modal.

**Dependency note — verified this session**: this plan is written **against the planned shape** of [`host-plans-and-pricing-tiers.md`](./host-plans-and-pricing-tiers.md) (still `stage: planned`, not yet built — no `pricing_plans`/`property_subscriptions` tables, `_shared/planFeatures.ts`, or `_shared/planEntitlements.ts` exist in the repo yet) and is **sequenced to execute after it ships**. It is a hard dependency, not built here. [`host-plans-pricing-page.md`](./host-plans-pricing-page.md)'s Context section previously stated this foundation had "already shipped" — that claim was incorrect and has been corrected there as part of landing this plan doc.

Scope: analyze **every** paid-feature candidate across the app in this one plan (not just marketing), using **one shared reusable gating mechanism** (hook + component + single modal) rather than bespoke per-module logic.

## Target `PlanFeatures` shape (from the prerequisite plan — not yet built, this plan gates against it)

```ts
interface PlanFeatures {
  automatedBookingFlow: boolean;
  verifiedBadgeEligible: boolean;
  recommendedBadgeEligible: boolean;
  telegramNotifications: boolean;
  teamManagement: { enabled: boolean; maxMembers: number | null };
  searchVisibilityTier: 'none' | 'top20' | 'top10' | null;
  marketingPublishLimitPerGroup: number | null;
  aiValidations: boolean;
  aiMonthlyCreditAllowance: number;
  marketingStudio: boolean;
  customPages: boolean;
  aiDashboardAssistant: boolean;
  aiReceptionist: boolean;
  aiMarketingGeneration: boolean;
  aiChatAutoReply: boolean;
  fullyManagedByPlatform: boolean;
}
```

Resolved per-property via a planned `resolvePropertyEntitlements(propertyId)` (merges `pricing_plans.features` + `property_subscriptions.feature_overrides`, override wins).

## Existing precedent to reuse (already shipped, do not reinvent)

- **AI cost-quota gating** — a separate, already-working mechanism (not plan-tier-based): `supabase/functions/_shared/aiUsageService.ts` throws an error with `readonly upgradeHook = true`; edge handlers catch it and return `{ success: false, error, upgradeHook: true }` at HTTP 429 (e.g. `generate-marketing-template/index.ts:139`, `generate-marketing-caption/index.ts:58`, `dashboard-assistant-chat/index.ts:203,560`, `social-inbox-ai-suggest/index.ts:62`).
- **Client side**: `ui/src/features/dashboard/org/lib/aiQuotaToast.ts` — `AiQuotaExceededClientError`, `parseEdgeJsonOrQuota<T>(res)` (throws on `upgradeHook`/429), `throwIfAiQuota`, `handleAiMutationError`. `toastAiQuotaExceeded()`'s "Upgrade" action currently just opens a **second stub toast** ("coming soon — contact support"). Consumed by `useGenerateMarketingTemplate.ts`, `marketingPublishApi.ts`, `InboxConversationView.tsx`, `useAiAssistantChat.ts`.
- No upgrade modal, `PlanGate`, or `FeatureGate` component exists anywhere today — only this toast stub.
- Modal primitive to build on: `ResponsiveModal`/`ResponsiveModalContent` (`ui/src/components/ui/responsive-modal.tsx`), already used by `PublishDialog.tsx`.
- Closest existing hook precedent for "boolean access derived from a settings fetch": `ui/src/features/dashboard/ai-assistant/hooks/useAiAssistantAccess.ts`.

## Marketing Studio (reference implementation)

Real module: `ui/src/features/dashboard/marketing/` (not `ui/src/features/guest/marketing/`, which is the unrelated public marketing website).

- **Create/edit/autosave — stays free**: `hooks/useMarketingAutoSave.ts`, `components/shared/SaveMarketingTemplateButton.tsx` → `hooks/useMarketingTemplates.ts` → `marketing-templates` edge function.
- **Preview — gets a plan-gated watermark**: `components/calendar-builder/components/CalendarPreview.tsx`/`CalendarPreviewScaledFrame.tsx` (calendar), Polotno's own canvas (design, `PolotnoDesignStudio.tsx`), `VideoPreviewWorkspace.tsx`/`VideoRemotionPlayer.tsx` (video). An existing `WatermarkPanel.tsx` + `styles.watermark` (`calendarBuilderStore.ts`) is a **user-configurable branding watermark**, calendar-only — unrelated to plan gating and must not be reused/conflated with the new plan-gate watermark (that one is host-controlled state, this one must be non-configurable and always-on for free-tier).
- **Publish — gated action**: `pages/MarketingStudioPage.tsx:26-41` → `components/publishing/PublishDialog.tsx` `handlePublish()` (~line 141) → `publish-to-meta` edge function via `lib/marketingPublishApi.ts` (`publishToMetaRequest`/`publishBatchToMeta`, confirmed at line ~51). This is where the upgrade modal triggers today.

## Shared gating primitives (new)

Location: `ui/src/features/dashboard/plans/` — the folder [`host-plans-pricing-page.md`](./host-plans-pricing-page.md) already establishes for the host-facing Plans page, so cross-cutting entitlement primitives live alongside it.

```
ui/src/features/dashboard/plans/
  lib/
    planFeatures.ts          # hand-mirrored copy of the Deno-side PlanFeatures type, comment pointing at source of truth
    entitlementsApi.ts       # GET wrapper for resolved entitlements
    featureGateCopy.ts       # per-FeatureKey title/description/CTA copy (minimal-ui-copy)
  hooks/
    usePropertyEntitlements.ts  # TanStack Query, mirrors useAiAssistantAccess.ts's shape (staleTime ~60s, enabled guard)
    useFeatureGate.ts            # given a PlanFeatures key -> { allowed, isLoading, entitlements }
  components/
    FeatureGate.tsx           # declarative wrapper; modes: "hide" | "disable" | "watermark" | "badge-only"
    SubscriptionUpgradeModal.tsx  # the ONE modal, built on ResponsiveModal, parameterized by feature key
    UpgradeModalProvider.tsx      # app-level context; useUpgradeModal().open(featureKey, context)
```

`UpgradeModalProvider` + `SubscriptionUpgradeModal` mount once at the dashboard shell root (next to wherever `<Toaster/>` is mounted) — exactly one modal instance app-wide, reused by every gate point.

**Two integration patterns**, matching the "explore freely, gate the action" intent:

1. **Imperative** (dominant pattern): call `useUpgradeModal().open('marketingStudio')` directly inside a button's `onClick`/mutation `onError` — used for Publish, toggles, submit actions.
2. **Declarative** `<FeatureGate>` (minority of cases): wraps a subtree that should be genuinely inert once a limit is hit (e.g. the team-invite form after `maxMembers` is reached).

**Server-side convention — reuse the existing `upgradeHook`/429 envelope verbatim**, so `aiQuotaToast.ts`'s `parseEdgeJsonOrQuota`/`throwIfAiQuota` need zero parsing changes:

```ts
// supabase/functions/_shared/planEntitlements.ts (extend, or add if the prerequisite plan didn't include it)
export class PlanFeatureRequiredError extends Error {
  readonly upgradeHook = true;
  constructor(
    readonly feature: keyof PlanFeatures,
    message?: string
  ) {
    super(message ?? `This feature requires a paid plan (${feature})`);
  }
}
export async function requirePropertyFeature(propertyId: string, feature: keyof PlanFeatures) {
  const entitlements = await resolvePropertyEntitlements(propertyId);
  if (!isFeatureEnabled(entitlements, feature)) throw new PlanFeatureRequiredError(feature);
  return entitlements;
}
```

Add an optional `feature?: string` field to the 429 JSON envelope so the client maps straight to `featureGateCopy.ts` without string-matching the message (unlike `aiQuotaToast.ts`'s current `/credit/i.test(message)` hack).

**New read-only edge function**: `supabase/functions/property-entitlements/index.ts` — GET-only, `resolveScopedPropertyAccess(req, 'settings:view', propertyId)`, thin wrapper returning `resolvePropertyEntitlements(propertyId)`. Add `[functions.property-entitlements]` `verify_jwt = false` to `supabase/config.toml`. Kept separate from `host-plans-pricing-page.md`'s bigger `property-plan` function since this one is read-only and consumed by many unrelated features.

**Retire the AI-quota toast's stub "Upgrade" action**: give `toastAiQuotaExceeded` an optional `openUpgradeModal` callback param (smallest diff, keeps it a plain lib file with no React-context dependency) so its "Upgrade" branch opens `SubscriptionUpgradeModal` instead of a second stub toast. Leave the "Buy credits" branch (`isCreditMessage`) untouched — credit top-up isn't part of `PlanFeatures`/this plan.

**Modal CTA target**: routes to `/org/:orgSlug/property/:propertySlug/plans` (**shipped** — see [`host-plans-pricing-page.md`](../in-progress/host-plans-pricing-page.md)).

## Per-feature gating map

| Feature                      | Stays free                          | Gated action                           | Client gate point                                                                                                                                    | Server gate point                                                                                                                                                      | `PlanFeatures` key                                                |
| ---------------------------- | ----------------------------------- | -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| Marketing Studio create/edit | Full editor, autosave, save         | —                                      | n/a                                                                                                                                                  | n/a                                                                                                                                                                    | n/a                                                               |
| Marketing Studio preview     | Preview renders                     | Non-paid: watermark overlay            | New `PlanGateWatermarkOverlay.tsx` conditionally rendered over `CalendarPreview.tsx`/Polotno canvas/`VideoPreviewWorkspace.tsx` via `useFeatureGate` | n/a (cosmetic nag, not an enforcement boundary)                                                                                                                        | `marketingStudio`                                                 |
| Marketing Studio publish     | —                                   | Publish blocked pre-flight             | `PublishDialog.tsx` `handlePublish()`; `usePublishToMeta()`'s `onError` swapped to route through the shared modal                                    | `publish-to-meta/index.ts` via `requirePropertyFeature` + `marketingPublishLimitPerGroup` count check                                                                  | `marketingStudio`, `marketingPublishLimitPerGroup`                |
| Marketing AI generation      | —                                   | Already gated (cost-quota)             | `MarketingAiGeneratePanel.tsx`                                                                                                                       | `generate-marketing-template/index.ts` (existing)                                                                                                                      | `aiMonthlyCreditAllowance` (existing axis, just rewire the modal) |
| Receipt validation AI        | Manual review free                  | AI-assisted validation call            | booking-detail trigger (locate call site)                                                                                                            | `validate-booking-receipts/index.ts` via `requirePropertyFeature`                                                                                                      | `aiValidations`                                                   |
| Inbox AI auto-reply          | Manual reply, quick replies free    | Enabling the auto-reply toggle         | `InboxAutomationTab.tsx` toggle                                                                                                                      | `social-inbox-settings/index.ts` write + runtime re-check in `_shared/metaInboxAutoReply.ts`/`_shared/webInboxAutoReply.ts` (so a downgrade silently stops auto-reply) | `aiChatAutoReply`                                                 |
| AI Dashboard Assistant       | —                                   | Whole-feature access                   | Extend `useAiAssistantAccess.ts` to AND against `useFeatureGate('aiDashboardAssistant')`                                                             | `dashboard-assistant-chat/index.ts` — add plan check ahead of the existing cost-quota check                                                                            | `aiDashboardAssistant`                                            |
| AI Receptionist (voice)      | Voice preview/demo free             | Enabling live call handling            | receptionist settings toggle                                                                                                                         | settings-write edge function via `requirePropertyFeature`                                                                                                              | `aiReceptionist`                                                  |
| Team management              | Viewing team free                   | Inviting beyond `maxMembers`           | invite dialog — live member-count check, not just boolean                                                                                            | team-invitations edge function enforcing the same count                                                                                                                | `teamManagement.enabled`/`.maxMembers`                            |
| Telegram notifications       | —                                   | Enabling integration                   | integrations settings toggle                                                                                                                         | settings-write edge function                                                                                                                                           | `telegramNotifications`                                           |
| Custom pages                 | Editing existing pages stays free   | Creating a **new** page                | create-new button/dialog                                                                                                                             | custom-pages creation edge function                                                                                                                                    | `customPages`                                                     |
| Verified/Recommended badges  | Viewing the apply flow              | Submitting below-eligible-tier         | "Get Verified"/"Get Recommended" CTA                                                                                                                 | verification submission edge function                                                                                                                                  | `verifiedBadgeEligible`/`recommendedBadgeEligible`                |
| Search visibility tier       | —                                   | No user action (passive ranking boost) | n/a                                                                                                                                                  | ranking query reads the field directly, no error path                                                                                                                  | `searchVisibilityTier`                                            |
| Automated booking flow       | Manual approval flow (default) free | Enabling full automation               | settings toggle                                                                                                                                      | settings-write edge function                                                                                                                                           | `automatedBookingFlow`                                            |

Out of scope for a gate: `fullyManagedByPlatform` (sales/ops process, not self-serve) and `aiMarketingGeneration` beyond what's already listed above (fully covered by the AI cost-quota mechanism plus Marketing Studio's own gate).

## Phase breakdown

### Phase 0 — Prerequisite check

- [x] Confirm `host-plans-and-pricing-tiers.md` has shipped: `pricing_plans`/`property_subscriptions`/`property_subscription_events` tables exist, `_shared/planFeatures.ts` and `_shared/planEntitlements.ts` exist with `resolvePropertyEntitlements`.
- [x] Confirm whether `host-plans-pricing-page.md` (the Plans page) has also shipped — affects the modal's CTA target (real route vs. stub-toast fallback).
- [x] Add `PlanFeatureRequiredError`/`requirePropertyFeature` to `planEntitlements.ts` if the prerequisite plan didn't already include an equivalent "throw on missing feature" helper — adopt theirs if present rather than duplicating.

### Phase 1 — Shared primitives

- [x] `supabase/functions/property-entitlements/index.ts` (new, GET-only) + `supabase/config.toml` entry.
- [x] `ui/src/features/dashboard/plans/{lib,hooks,components}` set described above.
- [x] Mount `UpgradeModalProvider`/`SubscriptionUpgradeModal` at the dashboard shell root.
- [x] Wire `toastAiQuotaExceeded`'s optional `openUpgradeModal` callback.

**Docs (same change):** `docs/architecture/edge-functions.md` new row; `docs/PROJECT.md` new "Feature gating (plan entitlements)" section.

### Phase 2 — Marketing Studio (reference implementation)

- [x] `PlanGateWatermarkOverlay.tsx` over the three preview surfaces.
- [x] `PublishDialog.tsx` pre-flight gate + `usePublishToMeta()` `onError` swap.
- [x] `publish-to-meta/index.ts` server check (`requirePropertyFeature` + `marketingPublishLimitPerGroup` count).
- [x] Rewire the marketing AI-generation "Upgrade" toast action to the shared modal.

**Docs (same change):** `route-guides` skill on the Marketing Studio route guide; `docs/PROJECT.md` marketing section update.

### Phase 3 — Remaining modules

One batch at a time, in this order (cheapest/most isolated first): custom pages → Telegram notifications → team management (validates the live-count pattern) → inbox AI auto-reply → AI Dashboard Assistant (validates composability with an existing hook) → receipt validation AI + AI receptionist (batched) → automated booking flow + verified/recommended badges (touch `.cursor/rules/booking-workflow.mdc`-adjacent surfaces, do last) → search visibility tier (server-only, bundle whenever the ranking query is touched).

- [ ] Custom pages create (deferred — create UI not built)
- [x] Telegram notifications — enable toggle + all `telegram-*-settings` PATCH (`gateTelegramEnabledPatch`)
- [x] Team management — invite pre-flight + `requireTeamInviteAllowed` on `property-team-invitations`
- [x] Inbox AI auto-reply — Automation tab toggle + `social-inbox-settings` PATCH + runtime in `metaInboxAutoReply` / `webInboxAutoReply`
- [x] AI Dashboard Assistant — `useAiAssistantAccess` + `dashboard-assistant-chat` plan check
- [x] Receipt validation AI — `BookingAiSummaryPanel` / `booking-ai-review` + `validate-booking-receipts`
- [x] AI receptionist — Property settings toggle + `voice-receptionist-settings` / `voice-receptionist-start`
- [ ] Automated booking flow toggle (deferred — settings UI not built)
- [x] Verified / Recommended badges — `GetVerifiedModal` enhanced submit + `ListingVerificationModal` recommended submit + matching edge functions
- [ ] Search visibility tier (server-only; bundle when ranking query is touched)

**Docs (same change, per module):** `route-guides` skill each time (CLAUDE.md requires this for every route/section change, no exceptions); `docs/PROJECT.md` per-module updates where sections exist.

### Phase 4 — Cleanup & production-readiness

- [x] **`useFeatureGate` `canUse`** — fail-closed while entitlements load (`!isLoading && entitlements && allowed`); client action gates updated to block during load.
- [x] **Org-scoped server gaps** — `social-inbox-settings` org-level auto-send gate; `metaInboxAutoReply` / `webInboxAutoReply` `orgHasPropertyWithFeature` when `propertyId` is null; `dashboard-assistant-chat` org-level assistant gate when no effective property.
- [x] **Verification tier gates** — base → `verifiedBadgeEligible`; enhanced → `recommendedBadgeEligible` (client + `submit-org-verification`).
- [x] **Hygiene** — duplicate `TelegramAssetScope` import removed; `countPropertyTeamSlotsUsed` skips invitations without a `status` field (current `TeamInvitation` type has none).
- [x] Grep for leftover ad-hoc "coming soon" upgrade stubs — **intentional stubs remain** for PayMongo checkout (`planStubPayToast`, `PlanReviewDialog`) and AI credit top-up (`toastAiQuotaExceeded` "Buy credits"); documented in review notes.
- [x] `docs/README.md` index row + route/architecture guides updated (see **Documentation inventory** below).

**Documentation inventory (2026-08-18):**

| Doc                                                                                                         | What was updated                                                 |
| ----------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| [`docs/PROJECT.md`](../../PROJECT.md)                                                                       | Host pricing tiers — edge gates, UI primitives, AI upgrade modal |
| [`docs/architecture/edge-functions.md`](../../architecture/edge-functions.md)                               | `property-entitlements`, plan-gated endpoints, helpers           |
| [`docs/architecture/ai-dashboard-assistant.md`](../../architecture/ai-dashboard-assistant.md)               | `aiDashboardAssistant` plan gate                                 |
| [`docs/guides/routes/org/property/marketing.md`](../../guides/routes/org/property/marketing.md)             | Watermark + publish gating                                       |
| [`docs/guides/routes/org/property/notifications.md`](../../guides/routes/org/property/notifications.md)     | Telegram enable gating (fixed merged paragraph)                  |
| [`docs/guides/routes/org/property/team.md`](../../guides/routes/org/property/team.md)                       | Team invite gating                                               |
| [`docs/guides/routes/org/property/inbox.md`](../../guides/routes/org/property/inbox.md)                     | Auto-send gating                                                 |
| [`docs/guides/routes/org/property/bookings-detail.md`](../../guides/routes/org/property/bookings-detail.md) | AI Summary gating                                                |
| [`docs/guides/routes/org/property/settings.md`](../../guides/routes/org/property/settings.md)               | Voice receptionist + listing verification plan notes             |
| [`docs/guides/routes/org/property/plans.md`](../../guides/routes/org/property/plans.md)                     | Upgrade modal CTA target                                         |
| [`docs/guides/routes/onboarding.md`](../../guides/routes/onboarding.md)                                     | Get Verified / Recommended submit gating                         |
| [`docs/README.md`](../../README.md)                                                                         | Workflow index — feature gating in-progress link                 |
| [`docs/workflow/in-progress/README.md`](../README.md)                                                       | Shipped summary                                                  |
| [`host-plans-pricing-page.md`](../host-plans-pricing-page.md)                                               | Modal CTA cross-link                                             |

**Shared UI (implementation map):** `ui/src/features/dashboard/plans/` — `useFeatureGate`, `usePropertyEntitlements`, `UpgradeModalProvider`, `SubscriptionUpgradeModal`, `PlanGateWatermarkOverlay`, `entitlementsApi.ts`, `featureGateCopy.ts`.

**Review notes (2026-08-18):**

- **Deferred — custom pages create:** create UI not built; gate not wired.
- **Deferred — automated booking flow toggle:** settings UI not built.
- **Deferred — search visibility tier:** passive ranking; bundle when ranking query is touched.
- **Deferred — PayMongo checkout:** `planStubPayToast.ts` / `PlanReviewDialog` still show "coming soon" for paid checkout; intentional until `paymongo-subscription-billing.md`.
- **Deferred — AI credit top-up:** `toastAiQuotaExceeded` "Buy credits" branch remains a stub (separate from plan-tier gating).
- **Known limitation — org-scoped gates:** `requireOrgPropertyFeature` / `orgHasPropertyWithFeature` pass if **any** active property in the org has the feature; org-level inbox/assistant contexts without a property id use that aggregate rule.
- **Known limitation — team slot count:** pending invitations are not counted toward `maxMembers` until `TeamInvitation` gains a `status` field aligned with the server invite query.

## Non-goals

- No work on `host-plans-and-pricing-tiers.md` itself (hard dependency, consumed read-only).
- No work on the Plans page (`host-plans-pricing-page.md`) beyond the modal's CTA link and the Phase 0 shipped-check.
- No PayMongo/payment collection (`paymongo-subscription-billing.md` territory).
- No changes to AI cost-quota mechanics (`aiUsageService.ts` limits/ledger/wallet) — only wiring its existing `upgradeHook` signal into the new modal.
- No super-admin plan-configuration UI.
- No commission-plan-specific UX — commission-plan properties are gated the same as subscription-plan properties per their `features` JSONB.

## Risks / open questions to flag during execution

1. If this plan starts before the Plans page ships, the modal CTA needs the stub-toast fallback (see "Modal CTA target" above).
2. `teamManagement.maxMembers` and `marketingPublishLimitPerGroup` need live-count queries that aren't fully specified by the prerequisite plan either — budget investigation time.
3. Toggle-based gates (auto-reply, receptionist) need a decision on real-time re-check vs. periodic (e.g. daily cron) re-verification after a plan downgrade.

## Verification

No automated test suite exists (per CLAUDE.md) — manual:

1. `bun run type-check && bun run lint && bun run build`.
2. `mcp__supabase__get_advisors` after Phase 1 (new function only, no new tables — expect no new advisories); re-run after each edge-function change in later phases.
3. Seed one test property on Free and one on a paid plan.
4. Marketing (reference implementation): as Free — create/edit templates freely (never prompted); preview shows watermark; click Publish → `SubscriptionUpgradeModal` opens, confirm via `mcp__playwright__browser_network_requests` that no POST to `publish-to-meta` fires. As paid — no watermark, Publish succeeds, real POST fires.
5. Repeat the same explore-freely/gate-the-action click-through per row in the feature table, on both Free and paid test properties, as each phase ships.
6. Confirm the AI-quota toast's "Upgrade" action now opens `SubscriptionUpgradeModal` instead of the old stub toast at one shipped AI call site.
7. Resize `SubscriptionUpgradeModal` to 375px at one trigger point (`mobile-responsive` skill).
