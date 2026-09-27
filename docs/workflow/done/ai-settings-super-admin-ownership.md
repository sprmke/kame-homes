---
stage: done
title: 'AI settings: super-admin ownership + host toggle-only'
status: done
tags: [planning, planned-modules, ai, cost, quotas, super-admin, rbac, plans-and-permissions, audit]
updated: 2026-09-27
---

# AI settings: super-admin ownership + host toggle-only

## TL;DR

1. **Hosts lose every AI number.** Org admins and property managers keep exactly two things: an **on/off toggle per AI feature** and a **read-only usage panel**. Every limit — call, cost, credit, message, write-action, session, generation cap — becomes super-admin-only.
2. **Limits stop being free-form per tenant.** They move to **named AI limit profiles** (`ai_limit_profiles`) that a super admin authors once and assigns to many orgs/properties, with plan tier as the default binding. A per-tenant numeric override still exists but is the exception, super-admin-only, and always shown as "overridden from profile X".
3. **One console owns it.** `/admin/ai-usage` and the platform AI cards merge into **`/admin/ai`** with tabs Usage · Limits · Profiles · Wallets, driven by one bulk-capable endpoint so budget changes hit N orgs in one action instead of N visits.
4. **This plan is about ownership and manageability, not the numbers.** The actual quota values, cost-based enforcement and per-feature sub-caps stay in [`ai-paid-provider-and-production-quotas.md`](./ai-paid-provider-and-production-quotas.md); the wider multi-service budget console stays in [`super-admin-service-cost-monitoring.md`](./super-admin-service-cost-monitoring.md). This plan gives both of those a single place to write into.

## Problem

AI spend lands on one paid Gemini/Groq billing project owned by the platform, but the people who can raise the dials are the hosts. Today an org admin or a property member with the right leaf can edit:

- daily / monthly AI **call** limits and the daily **USD cost** limit (org and per property),
- per-property **image / video monthly credit caps**,
- assistant **daily/monthly message** limits and the **daily write-action** limit,
- voice receptionist **max session seconds**, **max sessions per guest per day**, **max concurrent sessions**,
- and they can **copy all of the above onto other properties** in one action via Settings → Copy settings (`aiOverrides` / `voiceReceptionist` clone groups).

The only brake is a ceiling check in `ai-platform-settings` against the platform defaults — and it exists on the org endpoint only. `ai-platform-property-settings` has **no ceiling check at all**, so a property member can set a per-property `dailyCostUsdLimit` above the org's and above the platform default, and property limits win over org limits in `aiUsageService.ts`. The assistant and voice endpoints have no ceiling either.

Two more structural gaps:

- **Plan tier only gates, it does not size.** `aiMonthlyCreditAllowance` is read as a boolean (`> 0`) for feature gating (`planFeatures.ts`), and `syncAiCreditsFromPlan` writes it to `ai_platform_org_settings.monthly_credit_limit` — but call limits, cost limits and every assistant/voice limit ignore the plan entirely and fall back to one global default for every tenant.
- **No bulk administration.** Adjusting the budget across the portfolio means editing one org row at a time in the DB or walking each org hub. There is no "apply to all orgs on Starter", no development-level axis, no preview of what a change would cost.

## Current AI configuration surface (verified inventory)

| #   | Surface                                                            | Scope                   | Who can change it today                                         | Fields                                                                                                                            | Target                                                                                                                   |
| --- | ------------------------------------------------------------------ | ----------------------- | --------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| 1   | `OrgAiPlatformSection` → `ai-platform-settings`                    | Org                     | `org.settings.aiPlatform:edit`                                  | `enabled`, `dailyCallLimit`, `monthlyCallLimit`, `dailyCostUsdLimit`                                                              | Keep `enabled`; **remove** 3 limits from host                                                                            |
| 2   | `PropertyAiPlatformSection` → `ai-platform-property-settings`      | Property                | `settings.aiOverrides:edit`                                     | `enabled`, `dailyCallLimit`, `monthlyCallLimit`, `dailyCostUsdLimit`, `imageMonthlyCreditCap`, `videoMonthlyCreditCap`            | Keep `enabled`; **remove** 5 limits from host                                                                            |
| 3   | `OrgAiDashboardAssistantSection` → `dashboard-assistant-settings`  | Org                     | `org.settings.aiAssistant:edit`                                 | `enabled`, `disabledPropertyIds`, `dailyMessageLimit`, `monthlyMessageLimit`, `dailyWriteActionLimit`                             | Keep `enabled` + `disabledPropertyIds` (a scoping toggle, not a limit); **remove** 3 limits                              |
| 4   | `PropertyVoiceReceptionistSection` → `voice-receptionist-settings` | Property                | `settings.voiceReceptionist:edit`                               | `enabled`, `voiceId`, `personaPrompt`, `maxSessionSeconds`, `maxSessionsPerGuestPerDay`, `maxConcurrentSessions`                  | Keep `enabled` + voice + persona (brand content); **remove** 3 session limits                                            |
| 5   | `InboxAutomationTab` → `social-inbox-settings`                     | Property / parking      | inbox `automation` access                                       | `autoReplyEnabled`, `autoReplyMode`, per-platform auto-send, `aiSystemPrompt`                                                     | **No change** — toggles + brand persona only, no numbers. Confirm `aiSystemPrompt` stays host-owned (see Open decisions) |
| 6   | Smart pricing `aiRationaleEnabled`                                 | Property                | pricing edit                                                    | boolean                                                                                                                           | **No change** — toggle only                                                                                              |
| 7   | Copy settings clone groups `aiOverrides`, `voiceReceptionist`      | Property → N properties | `settings.aiOverrides:edit` / `settings.voiceReceptionist:edit` | all of #2 and #4                                                                                                                  | **Narrow to toggles + persona**; limits must not be copyable                                                             |
| 8   | `ai-platform-global-settings`                                      | Platform                | super admin + OTP step-up                                       | kill switch, `enforce_quotas`, `allowed_features`, default call/cost/credit limits, credit unit USD, voice cost/minute, rollout % | Keep; becomes the **profile fallback**, not the only layer                                                               |
| 9   | `ai-platform-credit-wallet`, `ai-platform-generation-overrides`    | Org / property          | super admin + OTP step-up                                       | wallet balance + ledger; per-property image/video caps + premium hatch                                                            | Keep; fold into the new console                                                                                          |
| 10  | `dashboard-assistant-global-settings`                              | Platform                | super admin + OTP step-up                                       | assistant kill switch                                                                                                             | Keep; gains the assistant limit defaults removed from #3                                                                 |
| 11  | `/admin/ai-usage`                                                  | Platform                | super admin                                                     | read-only spend, calls, feature health, top orgs, breaches                                                                        | Becomes the **Usage** tab of `/admin/ai`                                                                                 |

Enforcement precedence today (`_shared/aiUsageService.ts`): property override → org setting → global default, for calls, cost and credits — which is why an unbounded property field is the sharpest edge in the list.

## Target model

### Three layers, one owner

```
ai_platform_global_settings        ← platform floor/ceiling + kill switch (super admin)
  └─ ai_limit_profiles             ← named, reusable limit sets (super admin)      ← NEW
       ├─ bound by default to a plan tier (pricing_plans.ai_limit_profile_id)      ← NEW
       └─ assigned to orgs / properties / developments (ai_limit_assignments)      ← NEW
            └─ per-tenant numeric override (super admin only, exception path)
                 └─ host: enabled / disabled toggle only
```

- **A host toggle can only ever tighten.** `enabled = false` at org or property short-circuits; the host can never widen anything.
- **A profile is the unit of budget management.** Changing "Starter" from 5,000 → 3,000 monthly credits repoints every org on that profile in one write, with a preview of affected orgs and last-30-day spend before it applies.
- **Assignment axes**: organization, property, and **development** (matched through `properties.residence_name` / `parkings.residence_name`, the same soft join `developments` already uses — no FK work required, and `multi-residence-config-decoupling.md` will harden it later).
- **Precedence** (most specific wins): per-tenant override → property assignment → development assignment → org assignment → plan-tier profile → global defaults.

### Why profiles rather than per-tenant numbers

Per-tenant numbers are what exist now and they are the reason a budget change is unmanageable: there is no way to ask "which orgs are on the cheap settings", no way to change 40 orgs at once, and no way to tell an intentional override from a leftover. A named profile gives a stable answer to all three, matches how the plan catalog already works (super admin edits `pricing_plans`, orgs inherit), and keeps the override escape hatch for the one org that negotiated something different.

## Data model changes

**Migration A — profiles and assignments** (new file under `supabase/migrations/`, never edit a shipped one):

- `ai_limit_profiles` — `id`, `code` (unique, e.g. `starter`, `growth`, `internal`), `name`, `description`, `is_default BOOLEAN`, plus the full limit set: `daily_call_limit`, `monthly_call_limit`, `daily_cost_usd_limit`, `daily_credit_limit`, `monthly_credit_limit`, `assistant_daily_message_limit`, `assistant_monthly_message_limit`, `assistant_daily_write_action_limit`, `voice_max_session_seconds`, `voice_max_sessions_per_guest_per_day`, `voice_max_concurrent_sessions`, `image_monthly_credit_cap`, `video_monthly_credit_cap`, `updated_by`, `updated_at`. NULL on any column = inherit the global default.
- `ai_limit_assignments` — `id`, `scope TEXT CHECK (scope IN ('organization','property','development'))`, `scope_id UUID`, `profile_id`, `assigned_by`, `assigned_at`, `note`, `UNIQUE (scope, scope_id)`.
- Seed one profile per existing plan tier from today's `ai_platform_global_settings` defaults so behavior is byte-identical on day one.
- `pricing_plans.ai_limit_profile_id UUID REFERENCES ai_limit_profiles(id)` — the plan-tier binding.
- RLS on (deny-by-default, service_role grants only), matching the other `ai_platform_*` tables.

**Migration B — lock the tenant rows**: add `override_reason TEXT` and `overridden_by UUID` to `ai_platform_org_settings` and `ai_platform_property_settings` so a non-NULL limit is self-documenting. Do **not** drop the limit columns — they stay as the override layer, just with a new writer.

**Migration C — assistant + voice parity**: move `ai_dashboard_assistant_org_settings` message/write-action limits and `voice_receptionist_settings` session limits behind the same resolver (columns stay; the host write path goes away).

## Phases

### Phase 0 — close the hole first (ship independently, no schema change)

Small, high-value, no dependency on the rest. Worth shipping on its own before anything else.

- [ ] Add a platform-ceiling clamp to `ai-platform-property-settings` PATCH mirroring the one in `ai-platform-settings` (property limit may not exceed the resolved org limit, which may not exceed the platform default).
- [ ] Add the same clamp to `dashboard-assistant-settings` PATCH (message + write-action limits) against `ai_dashboard_assistant_global_settings`.
- [ ] Add the same clamp to `voice-receptionist-settings` PATCH (session seconds / per-guest / concurrent) against the platform voice defaults.
- [ ] Unit tests (Deno) for each clamp: at ceiling ok, above ceiling 400, unchanged field untouched.
- [ ] `activity-log`: these PATCHes already log `ai.config_changed` / `integrations.config_changed`; add the rejected-ceiling case to the metadata so an attempted raise is visible.

### Phase 1 — resolver + profiles (server)

- [ ] Migration A (profiles, assignments, `pricing_plans.ai_limit_profile_id`, seed from current defaults).
- [ ] New `_shared/aiLimitResolver.ts` — one function `resolveAiLimits({ organizationId, propertyId?, feature? })` returning the fully resolved limit set **plus its provenance** (`{ value, source: 'override' | 'property' | 'development' | 'org' | 'plan' | 'global', profileCode }`). Provenance is what makes the console explainable and the host copy honest.
- [ ] Rewire `aiUsageService.ts` (`getAiPlatformOrgSettings`, `getAiPlatformPropertySettings`, `getOrgAiUsageSummary`, `checkAiQuota`) to read through the resolver instead of the two-level fallback. Behavior must be identical while every org sits on its seeded profile — assert this with a golden test before and after.
- [ ] Rewire `dashboardAssistantSettings.ts` and `voiceReceptionistService.ts` limit reads through the same resolver.
- [ ] Extend `syncAiCreditsFromPlan` → `syncAiLimitProfileFromPlan`: on plan assign/change/downgrade/reward, set the org's plan-tier profile binding instead of writing one number. Keep the existing `monthly_credit_limit` write during the transition, behind the resolver, so a rollback is a one-line revert.
- [ ] Cache: `aiQuotaCache.ts` keys must include the profile id + `updated_at` so a profile edit invalidates in-flight quota decisions.
- [ ] Deno tests: precedence matrix (all 6 sources), profile edit propagates, assignment delete falls back, plan change repoints, cache invalidation.

### Phase 2 — remove host write paths

- [ ] `ai-platform-settings` PATCH: accept `enabled` only. Reject `dailyCallLimit` / `monthlyCallLimit` / `dailyCostUsdLimit` with a 403 coded `ai_limit_platform_managed` (not a silent drop — a silent drop makes a stale client look successful).
- [ ] `ai-platform-property-settings` PATCH: accept `enabled` only; same 403 for the 3 limits + `imageMonthlyCreditCap` / `videoMonthlyCreditCap`.
- [ ] `dashboard-assistant-settings` PATCH: accept `enabled` + `disabledPropertyIds` only; same 403 for the 3 message/write limits.
- [ ] `voice-receptionist-settings` PATCH: accept `enabled`, `voiceId`, `personaPrompt`; same 403 for the 3 session limits.
- [ ] `propertySettingsCloneGroups.ts`: shrink `aiOverrides` to `{ enabled }` and `voiceReceptionist` to `{ enabled, voiceId, personaPrompt }`. Both `read` and `write` — a copy must not be able to launder a limit onto another property. Update `hasNonDefault` accordingly.
- [ ] RBAC: retire `org.settings.aiPlatform:edit` → `org.settings.aiEnabled:edit` and `settings.aiOverrides:edit` → `settings.aiEnabled:edit` (keep the old ids as aliases in `orgLegacyPermissionExpansion.ts` / `settingsPermissionExpansion.ts` so existing custom roles don't break). Update `orgTeamConstants.ts`, `propertyTeamConstants.ts`, `propertyPermissionCatalog.ts`, `propertyPermissions.ts` and the edge mirrors.
- [ ] `plans-and-permissions`: re-point `propertyPermissionCatalog.ts`'s `settings.aiOverrides:edit → aiMonthlyCreditAllowance` gate to the renamed leaf; confirm no plan tier needs to gate the toggle itself (toggle should be available on every tier that has any AI feature).
- [ ] `audit-logging`: every super-admin limit write emits `ai.limits_changed` (org scope) with before/after + profile code; host toggles keep emitting `ai.assistant_toggled` / `ai.config_changed`.
- [ ] Deno tests: each endpoint rejects each removed field; toggle still works; clone groups no longer carry numbers.

### Phase 3 — host UI becomes usage + toggle

- [ ] `OrgAiPlatformSection` — drop the 3 inputs and the Save button. Keep: usage grid, credits progress, wallet balance, plan tier, the `enabled` switch, and the upgrade link. Add one line naming the source of the limits ("Limits are set by Kame on the Growth plan"). Section title stays **AI usage**.
- [ ] `PropertyAiPlatformSection` — drop all 5 inputs. Keep the `enabled` switch. Add a small **per-property usage** readout (calls / credits / est. cost this month) using the property breakdown `ai-platform-usage` already returns, so the section still earns its place. Retitle **AI overrides** → **AI**.
- [ ] `OrgAiDashboardAssistantSection` — drop the 3 inputs. Keep `enabled`, the per-property disable checkboxes, and the usage grid; show the message allowance as `used / limit` text instead of an editable field.
- [ ] `PropertyVoiceReceptionistSection` — drop the 3 session inputs. Keep enable, voice, persona, voice test, usage panel.
- [ ] `minimal-ui-copy` + `human-copy`: one short line per section at most, no em dashes, no explanation of the profile mechanism to hosts.
- [ ] `mobile-responsive`: all four sections at 375 / 768 / 1024; each loses a 3-column input grid, so re-check vertical rhythm and that the remaining switch keeps a 44px target. Update the matching `SettingsFormSkeleton` shapes so the skeleton stops promising fields that no longer exist.
- [ ] `accessibility`: removed inputs must not leave orphan `aria-label`s or a dangling section nav id.
- [ ] Vitest: sections render read-only for a member without the toggle leaf; no limit input is in the tree.

### Phase 4 — the `/admin/ai` console

- [ ] New route `/admin/ai` with tabs **Usage · Limits · Profiles · Wallets**. `/admin/ai-usage` redirects to `/admin/ai/usage`; the three existing platform AI cards move out of `/admin/platform-settings` into this console (leave a cross-link behind).
- [ ] **Profiles tab** — CRUD over `ai_limit_profiles`. Each row shows the limit set, how many orgs/properties/developments are on it, and last-30-day spend for that cohort. Editing shows the affected-tenant count and cohort spend **before** save; OTP step-up (`requireSuperAdminStepUp`) on every write.
- [ ] **Limits tab** — the assignment matrix: filter by plan tier / development / org / breach status, multi-select rows, **Assign profile** or **Set override** in bulk. Every row shows resolved value + provenance badge. Overrides require a `note`.
- [ ] **Usage tab** — today's `SuperAdminAiUsagePage` plus two additions the budget job needs: **cost per org per property per day**, and a **projected month-end spend** line against the platform ceiling.
- [ ] **Wallets tab** — existing `AiCreditWalletCard` + ledger, now portfolio-wide rather than one org at a time.
- [ ] New edge function `super-admin-ai-limits` (GET matrix, POST bulk assign, PATCH profile, PATCH override) — `requireSuperAdminStepUp` on every mutating method, `ai.limits_changed` activity per affected tenant, bulk write in a single transaction with a cap on batch size.
- [ ] Deep links: `/admin/orgs/:slug#section-ai` keeps working and now shows resolved limits + profile, read-only, with a link into the Limits tab.
- [ ] `mobile-responsive` on the console (the matrix needs a card layout below `md`).
- [ ] Playwright mocked E2E: super admin edits a profile and sees the affected-count preview; bulk assign updates N rows; a non-super-admin gets 403.

### Phase 5 — plan catalog binding

- [ ] `EditPricingPlanDialog` / `SuperAdminPricingPlanCard`: add the **AI limit profile** selector next to `aiMonthlyCreditAllowance`, so the plan catalog and the AI budget stop being two disconnected knobs.
- [ ] Decide and implement whether `aiMonthlyCreditAllowance` stays as the plan-facing number (host-visible, marketing copy on `/for-hosts/pricing`) with the profile holding everything else, or is absorbed into the profile. Recommendation: **keep it on the plan** as the one number hosts see, and have the seeded profile read it — one host-visible number, one internal profile.
- [ ] Downgrade path (`apply-org-plan-downgrade`): repoint the profile binding, preserve an explicit override if one exists, log it.
- [ ] Update `docs/architecture/plans-feature-matrix.md` + `/for-hosts/pricing` copy if the host-visible number changes.

### Phase 6 — verification + cleanup

- [ ] `bun run ci:quality` green.
- [ ] Migration applied locally via `bun run db:migrate`; no shipped migration edited.
- [ ] Manual pass: host account cannot reach any AI number in org settings, property settings, assistant settings, voice settings, or Copy settings; super admin can change a profile and see it take effect on the next AI call (quota cache invalidation).
- [ ] Backfill check: every org has a resolvable profile; no org's effective limits changed during the migration (compare a snapshot of `resolveAiLimits` for all orgs before/after).
- [ ] Remove the transitional `monthly_credit_limit` dual-write from `syncAiCreditsFromPlan` once the resolver has run clean for a release.

## Docs to update (same change, non-negotiable)

| Doc                                            | What changes                                                                                                                         |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `docs/PROJECT.md` § Platform AI metering       | Tables (profiles + assignments), edge functions (`super-admin-ai-limits`), UI row (host = toggle + usage), quota-behavior precedence |
| `docs/PROJECT.md` § AI Dashboard Assistant     | Org settings no longer hold message/write limits                                                                                     |
| `docs/architecture/ai-platform.md` § 5         | Replace "Org-editable AI limits … are capped at the platform defaults" with the profile/assignment precedence chain                  |
| `docs/architecture/data-model.md`              | `ai_limit_profiles`, `ai_limit_assignments`, `pricing_plans.ai_limit_profile_id`                                                     |
| `docs/architecture/edge-functions.md`          | New `super-admin-ai-limits`; narrowed contracts on the 4 host endpoints                                                              |
| `docs/architecture/plans-feature-matrix.md`    | Plan → profile binding                                                                                                               |
| `docs/guides/routes/org/settings.md`           | AI usage + AI assistant sections: fields removed, permission renamed                                                                 |
| `docs/guides/routes/org/property/settings.md`  | AI overrides → AI; voice receptionist limits removed                                                                                 |
| `docs/guides/routes/admin/settings.md`         | Platform AI cards moved to `/admin/ai`                                                                                               |
| `docs/guides/routes/admin/` **new** `ai.md`    | The new console: tabs, profiles, bulk assign, step-up                                                                                |
| `docs/guides/routes/admin/orgs.md`             | `#section-ai` now read-only resolved limits                                                                                          |
| `.cursor/rules/admin-auth.mdc`                 | New super-admin endpoint + step-up action id                                                                                         |
| `docs/archive/operations/migration-runbook.md` | Migrations A–C + the effective-limits snapshot check                                                                                 |

Skills to run before claiming done: `documentation-maintenance`, `route-guides`, `mobile-responsive`, `audit-logging`, `plans-and-permissions`, `human-copy`, `minimal-ui-copy`, `testing`.

## Open decisions

1. **`aiSystemPrompt` (inbox) and `personaPrompt` (voice)** — brand voice, or AI configuration? Recommendation: host keeps them. They shape tone, not spend, and the inbox safety guard already constrains what can be said. Flagging because the stated goal is "no AI configuration on the host side".
2. **`disabledPropertyIds`** on the assistant — treated here as a scoping toggle (which properties the toggle applies to), not a limit. Confirm.
3. **Development axis** — worth shipping in Phase 1, or defer until `multi-residence-config-decoupling.md` adds the real FK? Recommendation: ship it on the `residence_name` soft join now; the console is the main reason the axis was asked for.
4. **Whether host toggles should tighten anything at all** beyond on/off — e.g. should an org be able to disable _one_ AI feature rather than all of them? Not in scope here; would be a per-feature toggle matrix on top of the same model.
5. **Hard platform circuit breaker** (a single daily USD ceiling that halts all AI) lives in `ai-paid-provider-and-production-quotas.md` Phase 2 — this plan should not duplicate it, but the Usage tab's projected-spend line should read from it once it exists.

## Non-goals

- Re-tuning the actual limit values, cost-based enforcement, per-feature sub-caps, guest/staff split — [`ai-paid-provider-and-production-quotas.md`](./ai-paid-provider-and-production-quotas.md).
- Multi-service (Resend, Maps, PayMongo, Supabase) budget control — [`super-admin-service-cost-monitoring.md`](./super-admin-service-cost-monitoring.md).
- Host-purchasable credit top-ups — [`ai-credits-topup-purchase.md`](./ai-credits-topup-purchase.md).
- Adding or removing AI features; changing any model, prompt or provider.

## Related

- [`ai-paid-provider-and-production-quotas.md`](./ai-paid-provider-and-production-quotas.md) — the numbers this plan's profiles will hold
- [`super-admin-service-cost-monitoring.md`](./super-admin-service-cost-monitoring.md) — the wider cost console this fits inside
- [`ai-credits-topup-purchase.md`](./ai-credits-topup-purchase.md) — what happens when a profile's allowance runs out
- [`module-status-management.md`](./module-status-management.md) — overlapping "super admin turns features on/off" registry; the toggles here should not become a third mechanism
- [`docs/workflow/done/ai-usage-metering-credits-foundation.md`](../done/ai-usage-metering-credits-foundation.md) — the shipped foundation being re-owned

## Implementation notes (shipped 2026-09-27)

Migration `20261316124000_ai_limit_profiles.sql`; resolver `_shared/aiLimitResolver.ts`; console `/admin/ai`; guide [`docs/guides/routes/admin/ai.md`](../../guides/routes/admin/ai.md). Deliberate differences from the plan above:

- **Phase 0 clamps skipped.** Phase 2 removes the host write paths entirely, which closes the unclamped property limit; adding clamps first would have been throwaway work.
- **RBAC ids kept, labels changed.** `org.settings.aiPlatform:edit` and `settings.aiOverrides:edit` are persisted in custom roles, so renaming was risk with no host-visible benefit. They now read **Toggle AI**.
- **No quota cache existed** (the only AI cache is the response cache). A 5 s per-isolate memo (`withAiLimitCache`) now collapses the several resolver lookups per AI call; writers clear it, other isolates catch up within the TTL.
- **Plan binding** is managed in the console Profiles tab (Plans section), not inside the pricing plan dialog. `aiMonthlyCreditAllowance` stays on the plan and feeds the resolver as the `plan_allowance` layer.
- **Console tabs** are Usage, Limits, Profiles, Wallets and **Controls** (the kill switches moved out of the old AI Management page).
- Persona prompts (inbox `aiSystemPrompt`, voice `personaPrompt`) and assistant `disabledPropertyIds` stay host-owned. Development axis ships on the `residence_name` soft join.
- **Plans and permissions:** the host toggle needs no plan gate (turning AI off is always allowed, and a plan with no allowance is already blocked by the quota gate). Host access stays on the existing leaves, relabeled **Toggle AI**. The console and every limit write are super-admin only, so no new team permission is needed (N/A).
- **Known limits:** bulk override writes are sequential (validated up front, not transactional); the Limits tab resolves the first 1,000 organizations; `ai_limit_assignments.scope_id` is polymorphic, so rows for deleted tenants are inert and never cleaned up.
