---
title: 'Parking ↔ property production parity'
stage: for-testing
status: in-progress
updated: 2026-09-09
tags: [workflow, in-progress, parking, property]
---

# Parking ↔ property production parity

**Status: v1 parity shipped (2026-08-23). Org-level entitlement blocker RESOLVED (2026-09-09) — see [Org-level entitlements](#org-level-entitlements--resolved-2026-09-09) below. Only manual QA remains before close.**

**2026-08-25 update:** [`org-level-billing-migration.md`](../done/org-level-billing-migration.md) shipped org-level billing — `property_subscriptions` is gone entirely and `resolvePropertyEntitlements` now _always_ resolves via the org's subscription (never a per-property fallback). It added `getActiveOrgSubscription(organizationId)` — a property-independent subscription lookup — as a building block, but didn't wire it up for parking (out of scope for that migration).

## Org-level entitlements — RESOLVED (2026-09-09)

Built the property-independent org entitlement gate the note above called for:

- **`requireOrgFeature(organizationId, feature)`** — new export in `_shared/planEntitlements.ts`, on top of the already-existing `resolveOrgEntitlements(organizationId)` (which itself already existed, unused, built on `getActiveOrgSubscription`). Mirrors `requirePropertyFeature` exactly, just against org entitlements instead of property entitlements — no property proxy, works for an org with **zero** properties.
- **`dashboard-assistant-chat/index.ts`** — the parking-only branch (`pageContext.parkingId && !pageContext.propertyId`) now calls `requireOrgFeature(orgCtx.org.id, 'aiDashboardAssistant')` instead of skipping the check entirely.
- **`dashboard-assistant-confirm/index.ts`** — the Tier-2 re-check (guards against a downgrade between propose and confirm) now also re-verifies org/parking-scoped conversations via `requireOrgFeature`, not just property-scoped ones.
- **`telegramSettingsHttp.ts#gateTelegramEnabledPatch`** — the parking branch now resolves the parking's org id (`resolveOrganizationIdForParking`) and calls `requireOrgFeature(organizationId, 'telegramNotifications')` instead of `if (asset.kind === 'parking') return null;`.
- **`useFeatureGate.ts`** (client) — `PARKING_INTERIM_UNGATED_FEATURES` removed entirely. Parking routes (any route with no `propertyId`) now resolve real org entitlements via the same `useOrgPlan`/`deriveOrgEntitlementsFromPlan` path an org-only page already used — turns out that path already had correct Free-tier fallback; the interim allowlist was the only thing overriding it. `useAiAssistantAccess` needed no separate change — it already delegated its plan check entirely to `useFeatureGate`.

**Live-verified against local Supabase** (not just read): a parking-only conversation (`pageContext.parkingId` set, no `propertyId`) on a real paid ("pro"/Business-tier) org correctly got real tool answers from the AI assistant; the same request, with that org's subscription temporarily flipped to `canceled` (Free-tier fallback), correctly returned the upgrade-hook error (`aiDashboardAssistant`) instead of silently allowing it — then reverted and re-verified allowed again. Same pass/fail/pass cycle for the Telegram-enable PATCH (`telegramNotifications`) on a parking asset. `dashboard-assistant-confirm`'s parking-scoped re-check uses the identical `requireOrgFeature` call already proven correct above — not separately live-tested (would need a queued Tier-2 action from a parking conversation to set up).

Docs updated in the same change: `docs/architecture/plans-feature-matrix.md` (`PARKING_INTERIM_UNGATED_FEATURES` section + 3 stale references), `docs/architecture/ai-dashboard-assistant.md` (§1 parking-routes paragraph), `docs/guides/routes/org/parking/notifications.md` (plan-gating note), `docs/workflow/planned/parking-e2e-production-readiness.md` (blocker table row + detail section + checklist item).

Align parking with property for production readiness without copying stay-specific product (Meta inbox, GAF/SD, Marketing, Maintenance, public page editors, voice receptionist).

**Original plan:** Cursor plan `parking_property_parity` (do not edit the plan file in `.cursor/plans/`).

---

## Shipped (v1)

| #   | Workstream                                            | Status | Notes                                                                                                           |
| --- | ----------------------------------------------------- | ------ | --------------------------------------------------------------------------------------------------------------- |
| 1   | Interim ungating (Telegram + AI Assistant on parking) | ✅     | `useFeatureGate`, `telegramSettingsHttp`, `dashboard-assistant-chat` skip property plan when `parkingId` only   |
| 2   | Guest parking web chat                                | ✅     | `guest-web-chat-start` / `resume` + `parkingSlug`; Contact Host on listing; Stays hub threads; Telegram inbound |
| 3   | Archive / restore                                     | ✅     | Settings danger zone; `update-parking` `{ status }`; public APIs **ACTIVE** only                                |
| 4   | Date blocks on Pricing                                | ✅     | `parking_blocked_dates` migration; pricing UI block/unblock; broadcast candidate filter                         |
| 5   | Email automation toggles                              | ✅     | Settings **Email** section; `parking_settings.automation_toggles`; gated broadcast + expire cron                |
| 6   | Live dashboard stats                                  | ✅     | `dashboard-stats?parking_id=`; `ParkingDashboardPage` wired                                                     |
| 7   | Route guides + edge-functions                         | ✅     | Parking inbox/settings/notifications/dashboard/pricing/parkings; AI assistant org-plan note                     |

**Follow-up polish (same initiative, 2026-08-24):**

| Item                                                                                                | Status |
| --------------------------------------------------------------------------------------------------- | ------ |
| Property + parking Settings section descriptions (short, matched)                                   | ✅     |
| Guest + parking registration form stepper **`title`** = section heading; shared **`hint`** subtitle | ✅     |

---

## Pending — do not forget

Only manual QA remains — see below. The org-plan dependency that used to block close is resolved
(see [Org-level entitlements](#org-level-entitlements--resolved-2026-09-09) above).

### Blocked on org-level plans (RESOLVED — kept for history)

| Task                                                                                                                             | Owner / when                                                                                                                                                                   | Touch points                                                                                                                                                                                 |
| -------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Replace **interim parking ungating** with real **org entitlement** checks for `telegramNotifications` and `aiDashboardAssistant` | ✅ Done 2026-09-09 — `requireOrgFeature(organizationId)` on top of `getActiveOrgSubscription` (see [`org-level-billing-migration.md`](../done/org-level-billing-migration.md)) | `ui/.../plans/hooks/useFeatureGate.ts`, `supabase/functions/_shared/telegramSettingsHttp.ts`, `supabase/functions/dashboard-assistant-chat/index.ts`, `dashboard-assistant-confirm/index.ts` |
| Remove interim-un gate comments/docs; document final org-plan matrix in notifications + AI assistant guides                      | ✅ Done 2026-09-09                                                                                                                                                             | `docs/guides/routes/org/parking/notifications.md`, `docs/architecture/ai-dashboard-assistant.md`                                                                                             |

**For the record — do not re-wire this:** parking entitlements are **org-scoped** per locked decision; never wire parking to `property_subscriptions` / `usePropertyEntitlements` as a "simpler" fix.

### Deploy / migration (when shipping to hosted env)

| Migration                                             | Purpose                                                         |
| ----------------------------------------------------- | --------------------------------------------------------------- |
| `20261103130000_telegram_chat_parking_scope.sql`      | Parking-scoped Telegram chat settings                           |
| `20261104120000_parking_blocked_dates_automation.sql` | `parking_blocked_dates` + `parking_settings.automation_toggles` |

Run via normal dev → prod cutover (`bun run deploy:supabase:dev` first; prod only with team unlock). Local: `bun run db:migrate`.

### Verify in QA (manual)

- [ ] Parking listing **Contact Host** → thread in parking Inbox + optional Chat Telegram alert
- [ ] Guest **Stays** lists parking threads with correct name/image
- [ ] Archive parking → hidden on `/parkings/:slug`; restore reverses
- [ ] Pricing **Block** dates → slot excluded from broadcast candidates
- [ ] Email toggles off → no host request / confirmed / no-host emails for that slot
- [ ] Parking dashboard KPIs non-zero when bookings exist in range
- [x] Telegram enable + AI assistant on parking routes gate on the **org's real plan** (not unconditionally allowed) — live-verified 2026-09-09 against local Supabase: allowed on a paid org, blocked with an upgrade hook when that org's subscription is inactive, then re-verified allowed once restored

---

## Explicitly out of scope (do not expand this plan)

- Org-level / portfolio subscription implementation itself ([`org-level-billing-migration.md`](../done/org-level-billing-migration.md))
- Thick parking booking detail (claim-only stays)
- Meta Channels on parking
- Marketing, Maintenance, Templates, Public Pages editor, Voice Receptionist, stay-guide / SD / GAF on parking
- Property→parking auto-search ([`parking-e2e-later-phases.md`](../planned/parking-e2e-later-phases.md) Phase 2b)

---

## Implementation map (shipped)

| Area              | Paths                                                                                                                                                                                  |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Guest web chat    | `supabase/functions/_shared/webGuestChatService.ts`, `guest-web-chat-start/`, `guest-web-chat-resume/`, `ui/.../ContactHostSheet.tsx`, `ParkingDetailPage.tsx`, `GuestMessagesHub.tsx` |
| Archive           | `ui/.../parking/components/ParkingSettingsCard.tsx`, `update-parking`                                                                                                                  |
| Date blocks       | `supabase/functions/_shared/parkingBlockedDates.ts`, `parking-pricing/`, `ParkingPricingPage.tsx`                                                                                      |
| Email automations | `parkingAutomationToggles.ts`, `ParkingEmailAutomationSection.tsx`, `parkingBroadcast*.ts`                                                                                             |
| Dashboard stats   | `dashboard-stats/`, `dashboardService.ts`, `useParkingDashboardStats.ts`                                                                                                               |
| Interim ungate    | `useFeatureGate.ts`, `telegramSettingsHttp.ts`, `dashboard-assistant-chat/index.ts`                                                                                                    |
| Form step labels  | `guestFormSteps.ts`, `parkingRegistrationSteps.ts`, `GuestFormStepper.tsx`                                                                                                             |

---

## Route guides (updated)

- [`docs/guides/routes/org/parking/inbox.md`](../../guides/routes/org/parking/inbox.md)
- [`docs/guides/routes/org/parking/settings.md`](../../guides/routes/org/parking/settings.md)
- [`docs/guides/routes/org/parking/notifications.md`](../../guides/routes/org/parking/notifications.md)
- [`docs/guides/routes/org/parking/dashboard.md`](../../guides/routes/org/parking/dashboard.md)
- [`docs/guides/routes/org/parking/pricing.md`](../../guides/routes/org/parking/pricing.md)
- [`docs/guides/routes/parkings.md`](../../guides/routes/parkings.md)
- [`docs/guides/routes/form.md`](../../guides/routes/form.md)
- [`docs/architecture/edge-functions.md`](../../architecture/edge-functions.md)
- [`docs/architecture/ai-dashboard-assistant.md`](../../architecture/ai-dashboard-assistant.md)

---

## Close criteria (`/workflow-done`)

**Criterion 1 met 2026-09-09** — org-level plan entitlements shipped and interim ungating is
removed + docs updated (see [Org-level entitlements](#org-level-entitlements--resolved-2026-09-09)
above). Moved to [`../for-testing/`](../for-testing/) — the remaining "Verify in QA (manual)"
checklist is standard manual verification, not open code work. Move to [`../done/`](../done/)
once that checklist passes.

---

Back to [in-progress index](./README.md).
