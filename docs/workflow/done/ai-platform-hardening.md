---
stage: done
title: 'AI Platform Hardening — Foundation for AI Dashboard Assistant'
status: shipped — see ../done/ai-platform-hardening-handoff.md for the build log
tags: [planning, ai, infrastructure, security, scaling, done]
updated: 2026-08-15
---

# AI Platform Hardening — Foundation for AI Dashboard Assistant

## Context

GFM already has a centralized AI core: usage/quota (`aiUsageService.ts`), model routing (`aiModelRouter.ts`), multi-key Gemini + Groq fallback (`aiGeminiKeys.ts`), and a guest-safe safety guard (`inboxAiSafetyGuard.ts`). The upcoming AI Dashboard Assistant and broader AI opportunity roadmap require a production-ready, cost-controlled, and security-hardened foundation.

This plan is **Phase A** — it does not build the assistant itself, but it makes the existing platform safe, scalable, and per-property observable before the assistant lands in Phase B.

## Decisions

| Decision                | Choice                                                                                                                                 |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Global kill switch      | One platform-wide `ai_platform_global_settings.enabled` gates every AI feature, including voice receptionist.                          |
| Per-feature kill switch | `allowed_features TEXT[]` on the global settings row; each feature checks membership.                                                  |
| Per-property quotas     | **Hard-enforced** daily/monthly call limits and estimated cost caps.                                                                   |
| Model optimization      | Low-risk text tasks move to `flash_lite`; cap `maxOutputTokens`; set `thinkingBudget: 0` for non-reasoning tasks.                      |
| Response caching        | Deterministic prompt-fingerprint cache with 1-hour TTL.                                                                                |
| Global default          | `ai_platform_global_settings.enabled` defaults to `false` on fresh deploy; super-admin must explicitly enable.                         |
| Auth hardening          | AI org/property settings require `org:settings:edit` / `settings:edit`. AI usage requires `org:dashboard:view` or `org:settings:view`. |

## Phase A: Foundation hardening — shipped

Status: **completed** (2026-08-14). All changes are in the working tree, migration applies locally, and the full CI quality gate passes (`type-check`, `lint`, `build`, `check:filenames`). Local Supabase edge-function smoke tests returned `401` for every AI endpoint (i.e., functions are reachable and auth middleware rejects anon keys; no `500` runtime errors).

### 1. Database migration

Create `supabase/migrations/20260814130000_ai_platform_hardening.sql`:

1. ✅ Extend `ai_platform_global_settings`:
   - `allowed_features TEXT[] NOT NULL DEFAULT '{}'`
   - `default_daily_call_limit INT NOT NULL DEFAULT 200`
   - `default_monthly_call_limit INT NOT NULL DEFAULT 5000`
   - `default_daily_cost_usd_limit NUMERIC(12,6) NOT NULL DEFAULT 10`
   - Change `enabled` default to `FALSE`.
   - Seed disabled by default.
2. ✅ Create `ai_platform_property_usage_daily` (per-property daily counters).
3. ✅ Create `ai_platform_property_settings` (per-property overrides, nullable limits = inherit from org).
4. ✅ Create `ai_platform_response_cache` (feature + fingerprint → response, 1-hour TTL).
5. ✅ Add `increment_ai_platform_property_usage_daily(...)` atomic RPC.
6. ✅ Enable RLS and grant service_role on all new tables.
7. ✅ Leave `voice_receptionist_global_settings` in place for now; the old global voice switch is read by the new platform switch, and a follow-up migration will drop it after the transition is verified.

> Production note: existing environments with `voice_receptionist_global_settings.enabled = true` are migrated by seeding the new platform switch enabled and adding `voice_receptionist` to `allowed_features`.

### 2. Shared service changes

- `aiModelRouter.ts`: add `flash_lite` tier; route `inbox_suggest`, `inbox_auto_reply`, `marketing_caption`, `import_column_map`, `ai_integration_verify`, `voice_polish` to `flash_lite`; keep vision/structured tasks on `flash`; add `voice_receptionist` and `dashboard_assistant` features.
- `aiUsageService.ts`: refactor to support global feature allowlist, per-property hard quotas, property-level usage summary, and cache integration. Add `isFeatureEnabled`, `assertOrgAndPropertyAiQuota`, `getAiPlatformPropertySettings`, `getAiPlatformPropertyUsageSummary`, `getCachedAiResponse`, `setCachedAiResponse`. Keep existing `assertOrgAiQuota` as a wrapper for backward compatibility.
- `aiQuotaCache.ts` (new): deterministic cache helpers keyed by feature + SHA-256 fingerprint.
- `aiGeminiKeys.ts`: remove `geminiKeysCount` from any client-facing verify result; keep key rotation internal.
- `receiptValidationService.ts`: replace `verifyGeminiIntegration` with a minimal `verifyAiProviders` that returns only `ok`/`error`/`latencyMs`; ensure `propertyId` is passed to usage recording.
- `socialInboxAiService.ts`: add `thinkingBudget: 0`, reduce `maxOutputTokens` to 256, add cache check, pass `propertyId`.
- `marketingCaptionAi.ts`: use `flash_lite`, add cache, reduce tokens.
- `importColumnMappingAi.ts`: use `flash_lite`, reduce `maxOutputTokens` to 1024, add cache.
- `marketingTemplateGenerationAi.ts`: add cache and `thinkingBudget: 0` for calendar/design tokens.
- `bookingAiReviewService.ts`: ensure `propertyId` is always recorded with usage.
- `voiceReceptionistService.ts`: remove global voice settings; check `isFeatureEnabled('voice_receptionist')` and per-property `ai_platform_property_settings.enabled`; record voice session cost into `ai_platform_usage_events`.

### 3. Edge endpoint changes

- `ai-platform-global-settings/index.ts`: accept/return `allowedFeatures`, default quotas, cost limit.
- `ai-platform-settings/index.ts`: enforce `org:settings:view` / `org:settings:edit`.
- `ai-platform-usage/index.ts`: enforce `org:dashboard:view` or `org:settings:view`; add per-feature and per-property breakdowns.
- `ai-platform-property-settings/index.ts` (new): per-property GET/PATCH, auth `settings:edit`.
- `app-settings/index.ts`: use minimal AI provider verify result.
- ✅ `voice-receptionist-global-settings/index.ts` (deleted): functionality merged into `ai-platform-global-settings`; UI card and hook removed.
- ✅ `voice-receptionist-start/index.ts`: checks platform feature flag + property-level enabled.
- ✅ `voice-receptionist-settings/index.ts`: returns merged property AI settings.
- ✅ All generation endpoints: pass `propertyId` and call the unified quota/assertion functions.

### 4. UI changes

- `AiPlatformKillSwitchCard.tsx`: add per-feature toggles and default quota fields.
- `useAiPlatformGlobalSettings.ts`: extend DTO types.
- `OrgAiPlatformSection.tsx`: enforce owner/org-admin-only editing; show inherited defaults.
- `PropertyAiPlatformSection.tsx` (new): per-property enable toggle + override quotas.
- `useAiPlatformSettings.ts`: add property settings hooks and usage breakdown.
- `useAiIntegration.ts`: remove `primaryKeysCount` mapping.

### 5. Config and docs

- `supabase/config.toml`: add `[functions.ai-platform-property-settings]`; remove `[functions.voice-receptionist-global-settings]`.
- `docs/PROJECT.md`: document new endpoints, switches, and env usage.
- `docs/workflow/planned/README.md`: add this plan row.

## Phase B: Assistant-ready extensions

After Phase A is merged and tested:

1. ✅ Build `geminiToolCallClient.ts` (tool declarations + structured output) reusing hardened key rotation, usage, and cache.
2. ✅ Build `dashboardAssistantContext.ts` (RBAC-scoped host facts).
3. ✅ Build `dashboardAssistantRiskClassifier.ts` and `dashboardAssistantSafetyGuard.ts`.
4. ✅ Add `dashboard_assistant` to `AI_FEATURES` (already present) and wire `dashboard-assistant` edge function with `org:dashboard:view` permission.
5. Implement chat/confirm endpoints and UI blocks from the existing `ai-dashboard-assistant.md` plan.

## Verification

1. ✅ `bun run type-check` / `lint` / `build` / `check:filenames` pass.
2. ✅ `bun run db:migrate` locally; database is up to date.
3. ✅ Curl `ai-platform-global-settings` returns `401` with anon key (auth gate works); function is reachable.
4. ✅ Curl `ai-platform-settings` returns `401` with anon key (auth gate works); function is reachable.
5. ✅ Smoke-tested all AI endpoints: `ai-platform-global-settings`, `ai-platform-settings`, `ai-platform-usage`, `ai-platform-property-settings`, `app-settings`, `generate-marketing-caption`, `generate-marketing-template`, `import-ai-map-columns`, `social-inbox-ai-suggest`, `booking-ai-review`, `voice-receptionist-start`, `dashboard-assistant` — all return `401` (no 500s).
6. Full end-to-end (super-admin toggles, org quota enforcement, property overrides, cache hit, voice allowlist) is pending authenticated/seeded tests.
7. Lower org daily limit to 1, run two AI calls, confirm second returns `AI_QUOTA_EXCEEDED`.
8. Enable `voice_receptionist` in allowlist, start/end a session, confirm `voice_receptionist` row in `ai_platform_usage_events`.
9. Disable `voice_receptionist` in allowlist, confirm `voice-receptionist-start` returns 503.

## Risks

- Dropping `voice_receptionist_global_settings` may disable voice on existing hosted environments. Mitigate by seeding the new platform switch with the old value before dropping.
- Per-property hard quotas could block existing properties if admins set overrides. Mitigate by defaulting to NULL (inherit org) so existing behavior is preserved.

## Non-goals

- Real Stripe/billing integration.
- Building the AI Dashboard Assistant itself.
- Changing AI safety-guard logic beyond making it reusable.
