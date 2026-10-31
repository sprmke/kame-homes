---
stage: done
title: 'AI Platform Hardening + Dashboard Assistant Foundation — Handoff'
status: v1 complete — minor polish remains
tags: [workflow, done, ai, infrastructure, handoff]
updated: 2026-08-15
---

# AI Platform Hardening + Dashboard Assistant Foundation — Handoff

This doc is a **handoff snapshot** for the work on the AI platform hardening and the dashboard-assistant foundation — now the full v1 build log, session by session. For a plain-language summary of what shipped, see [`ai-dashboard-assistant-features.md`](./ai-dashboard-assistant-features.md); for manual test flows, see [`docs/guides/testing/ai-dashboard-assistant-manual.md`](../../guides/testing/ai-dashboard-assistant-manual.md).

**Canonical plans**

- Foundation: [`./ai-platform-hardening.md`](./ai-platform-hardening.md)
- Full assistant: [`./ai-dashboard-assistant.md`](./ai-dashboard-assistant.md)

## What is now in the working tree

### Phase A — Foundation hardening (complete)

- Migration `supabase/migrations/20260814130000_ai_platform_hardening.sql` adds:
  - `allowed_features` allowlist, default quotas, and `enabled = false` default on `ai_platform_global_settings`.
  - `ai_platform_property_settings`, `ai_platform_property_usage_daily`, `ai_platform_response_cache`.
  - Atomic `increment_ai_platform_property_usage_daily(...)` RPC.
  - RLS + service-role grants.
  - Legacy `voice_receptionist_global_settings` is left in place; a follow-up migration should drop it after the transition is verified.
- Shared services updated to use the new foundation:
  - `aiModelRouter.ts` — `flash_lite` tier, `dashboard_assistant` feature, `ai_integration_verify` feature.
  - `aiUsageService.ts` — global allowlist, per-property quotas, property usage summary, cache integration.
  - `aiQuotaCache.ts` — deterministic SHA-256 prompt cache.
  - `aiGeminiKeys.ts` — minimal `probeAiProviderMinimal` verify, no key-count exposure.
  - `receiptValidationService.ts`, `socialInboxAiService.ts`, `marketingCaptionAi.ts`, `importColumnMappingAi.ts`, `marketingTemplateGenerationAi.ts`, `bookingAiReviewService.ts`, `polishVoiceUtterance.ts`, `voiceReceptionistService.ts` — all now use unified quotas, caching, and token-optimized model configs.
- Edge endpoints:
  - `ai-platform-global-settings` (super-admin) — kill switch, allowlist, default quotas.
  - `ai-platform-settings` (org) — owner/org-admin edit.
  - `ai-platform-usage` (org) — usage breakdown.
  - `ai-platform-property-settings` (property) — per-property overrides.
  - `app-settings` — minimal AI provider verify.
  - `voice-receptionist-global-settings` **deleted**; its behavior merged into `ai-platform-global-settings`.
  - All generation endpoints pass `propertyId` and use unified quota/assertion functions.
- UI:
  - `AiPlatformKillSwitchCard.tsx` — per-feature toggles + default quotas.
  - `OrgAiPlatformSection.tsx` — org quota config (read-only when platform AI off).
  - `PropertyAiPlatformSection.tsx` — per-property enable + override quotas.
  - `useAiPlatformSettings.ts`, `useAiPlatformGlobalSettings.ts` extended.
  - `AiIntegrationCard.tsx` / `useAiIntegration.ts` no longer map `geminiKeysCount`.
  - `VoiceReceptionistKillSwitchCard.tsx` and `useVoiceReceptionistGlobalSettings.ts` removed.
  - `SuperAdminSettingsPage.tsx` now only shows the unified AI card.
- `supabase/config.toml` — added `[functions.ai-platform-property-settings]` and `[functions.dashboard-assistant]`; removed `[functions.voice-receptionist-global-settings]`.
- Docs updated: `docs/PROJECT.md`, `docs/architecture/edge-functions.md`, `docs/archive/operations/ai-platform-billing.md`, `docs/guides/routes/admin/settings.md`, `docs/guides/routes/org/settings.md`, `docs/guides/routes/org/property/settings.md`.

### Phase B — Assistant-ready infrastructure (complete)

- `supabase/functions/_shared/geminiToolCallClient.ts` — generic Gemini tool-calling + structured-output client that reuses key rotation, quota, and cache.
- `supabase/functions/_shared/dashboardAssistantContext.ts` — RBAC-scoped org/property/booking/usage context builder for the assistant.
- `supabase/functions/_shared/dashboardAssistantRiskClassifier.ts` — message-intent risk classifier (`safe`/`sensitive`/`disallowed`).
- `supabase/functions/_shared/dashboardAssistantSafetyGuard.ts` — post-generation response safety guard + quick regex scan.
- `supabase/functions/dashboard-assistant/index.ts` — minimal `POST` endpoint (`org:dashboard:view`) that wires classifier → context → Gemini → guard. It returns a plain text reply today, not the full assistant blocks.
- `dashboard_assistant` is already registered in `AI_FEATURES` / `aiModelRouter.ts`.

## What is NOT yet built

The full v1 scope of the **AI Dashboard Assistant** plan ([`./ai-dashboard-assistant.md`](./ai-dashboard-assistant.md)) is now built — migration, backend foundation, tool catalog, chat/confirm endpoints, frontend, admin config UI, audit viewer, and hardening (exhaustive risk walk + expiry cron). See the "Phase 2" and "Phase 3-6" sections below for the full build log. What's left is genuinely deferred, not missing:

- The plan's own **explicit non-goals**: SSE token streaming, parking-scoped tools, real Stripe billing, cross-org actions, autonomous/scheduled runs, custom/fine-tuned models, shared/team-visible conversations.
- **No Playwright/browser verification** — everything was proven via curl + real Gemini calls against the real DB, never through the actual rendered UI. Do a real browser pass before shipping.
- **Conversation-history browsing UI** — backend supports it (`dashboard-assistant-conversations`), frontend only has "New conversation", no history list/resume.
- **Mobile + accessibility deep pass** on the slide-over (focus trap, full keyboard walkthrough) — not done.
- **Cron not scheduled anywhere** — `dashboard-assistant-expire-pending-actions` exists and works but no `pg_cron` job calls it yet on any environment.
- The older `dashboard-assistant` (singular, Phase-B) endpoint is **not** deleted — it still exists as a separate, simpler, plain-text-only endpoint alongside the new `dashboard-assistant-chat`. Consider whether to retire it once the frontend fully replaces its use, if anything still calls it.

## Verification already done

- `bun run type-check && bun run lint && bun run build && bun run check:filenames` passes.
- `bun run db:migrate` — local DB is up to date.
- Local Supabase edge functions are reachable; all AI endpoints return `401` with the anon key (no `500` runtime errors):
  - `ai-platform-global-settings`
  - `ai-platform-settings`
  - `ai-platform-usage`
  - `ai-platform-property-settings`
  - `app-settings`
  - `generate-marketing-caption`
  - `generate-marketing-template`
  - `import-ai-map-columns`
  - `social-inbox-ai-suggest`
  - `booking-ai-review`
  - `voice-receptionist-start`
  - `dashboard-assistant`
- The deprecated `voice-receptionist-global-settings` endpoint returns `404`.

## Verification — done (2026-08-14, second session)

All items below were run locally against the full stack (`./dev.sh`) using a self-minted local JWT (HS256, signed with the local `JWT_SECRET`) for `sprmke.dev@gmail.com` (super-admin + owner of org `kame-home`, `9d0bacb6-…`), plus a temporary `property_members`-only row (created and deleted) to test the 403 path.

1. **Super-admin `ai-platform-global-settings`** — GET/PATCH ✅, persists `enabled`/`allowedFeatures`/quotas correctly.
2. **Org-owner `ai-platform-settings`** — GET/PATCH ✅ after a schema fix (see Bugs below). Property-only member correctly gets `403 Access restricted` on PATCH.
3. **AI call end-to-end** — verified via `dashboard-assistant` (not marketing caption — see Bugs below). Usage rows land in `ai_platform_usage_events` and `ai_platform_usage_daily`; `ai_platform_property_usage_daily` increments when `propertyId` is passed.
4. **Cache hit** — confirmed working: identical prompt fingerprint reuses the exact cached token counts at `estimated_cost_usd = 0`. Note: a cache hit **still** inserts a new `ai_platform_usage_events` row and increments `call_count` (at zero cost) — this is `aiUsageService.ts#recordAiUsage`'s actual (reasonable) design, not a bug, but it differs from this doc's original wording ("does not create a new row").
5. **Quota enforcement** — ✅ after a fix (see Bugs below): lowering `dailyCallLimit` to `1` now correctly returns `429` with `upgradeHook: true` from `dashboard-assistant`.
6. **Voice allowlist** — ✅: removing `voice_receptionist` from the global allowlist makes `voice-receptionist-start` return `503`; re-adding it clears that gate (a separate property-level opt-in is a distinct, unrelated 503 — not tested further, out of scope here).
7. **Dashboard assistant endpoint** — ✅: real org-member JWT + `org_id` classifies the message, builds context, returns a reply, records `dashboard_assistant` usage (3 Gemini calls per turn: risk classify, generate, safety guard). Disallowed message ("delete all bookings…") correctly returns the refusal path with `risk.risk: "disallowed"`.

### Bugs found and fixed this session

- **Migration gap**: `ai_platform_org_settings` was missing `daily_cost_usd_limit` even though `aiUsageService.ts` read/wrote it — the Phase A migration added the column to `ai_platform_global_settings` and `ai_platform_property_settings` but not the org table. This broke `ai-platform-settings` GET/PATCH entirely. Fixed in a new migration: `supabase/migrations/20261017140000_ai_platform_org_settings_cost_limit.sql`.
- **`geminiToolCallClient.ts` malformed request body**: `thinkingBudget` was a top-level `generationConfig` key instead of nested under `thinkingConfig: { thinkingBudget }` (the pattern every other AI service file uses correctly). Broke every caller of `callGeminiToolCall`/`callGeminiStructured`, including `dashboard-assistant`, with a hard `400` from Gemini. Fixed.
- **Missing import**: `aiUsageService.ts#recordAiUsage` calls `estimateTokenCostUsd` (from `aiModelRouter.ts`) but never imported it — threw `estimateTokenCostUsd is not defined` on every call that doesn't pass an explicit `estimatedCostUsd` (i.e. most real callers, since `callGeminiToolCall` doesn't pass one). Fixed the import.
- **`dashboard-assistant/index.ts` quota/disabled errors not classified**: unlike every other AI generation endpoint (e.g. `generate-marketing-caption`), the catch block called generic `handleEdgeError`, which doesn't recognize `AiQuotaExceededError`/`AiPlatformDisabledError` and always returns `400`. Fixed to mirror the established pattern: `429` + `upgradeHook: true` for quota, `503` for platform-disabled.

## Flash-lite replacement (2026-08-15, third session)

`gemini-2.0-flash-lite` was deprecated by Google — fixed by switching the 6 `flash_lite`-tier `AI_FEATURES` (`inbox_suggest`, `inbox_auto_reply`, `marketing_caption`, `import_column_map`, `voice_polish`, `ai_integration_verify`) to **`gemini-3.1-flash-lite`** in `aiModelRouter.ts`, with pricing updated to `$0.25`/`$1.50` per 1M input/output tokens (was `$0.15`/`$0.60` under the old model — no cheaper lite tier is currently offered).

- Rejected `gemini-3.5-flash-lite`: confirmed available, but priced identically to the `flash` tier (`$0.30`/`$2.50`) — defeats the purpose of a cheap tier.
- Rejected `gemini-2.5-flash-lite` / `gemini-flash-lite-latest`: returned `404` ("no longer available to new users") on this project's keys.
- `gemini-3.1-flash-lite` confirmed working via direct API call and via all 3 affected edge functions (`generate-marketing-caption`, `generate-marketing-template`, `social-inbox-ai-suggest`).
- Also fixed a third hardcoded `gemini-2.0-flash-lite` reference in `aiGeminiKeys.ts#probeAiProviderMinimal` (the `app-settings` verify-key probe used by `ai_integration_verify`), and updated the model tiering table in `docs/archive/operations/ai-platform-billing.md`.

### Bigger bug found while testing the model swap: 5 files had a broken cache API signature

Testing `generate-marketing-caption` after the model swap surfaced `TypeError: Cannot read properties of undefined (reading 'provider')` in `aiQuotaCache.ts#setCachedAiResponse` — the actual signature is `(feature, fingerprint, entry, ttlMinutes?)`, but 5 shared AI service files were still calling it with the **old, pre-Phase-A convention** `(cacheKey, text, ttlSeconds)`. Same mismatch on `getCachedAiResponse` (now `(feature, fingerprint)`, was called with just `(cacheKey)`) and `buildCacheInputs` (now `(systemPrompt, userPrompt, extras?)`, was called with a leftover `feature` as the first arg). On top of that, `computePromptFingerprint` returns a `Promise<string>` and every one of these call sites was missing `await`, so `cacheKey` was actually a `Promise` object, not a string.

None of this is caught by `bun run type-check` — that only runs `tsc` inside `ui/`; the Deno edge functions have no local type-checking (per this repo's known gap, "No Deno CLI is installed locally"). The bug was invisible until an actual HTTP call hit the code path.

**Fixed in all 5 files** (`marketingCaptionAi.ts`, `socialInboxAiService.ts`, `importColumnMappingAi.ts`, `marketingTemplateGenerationAi.ts`, `polishVoiceUtterance.ts`) — corrected the call signatures, added `await`, and built proper `AiCacheEntry` objects (`provider`, `model`, `responseText`, `inputTokens`, `outputTokens`, `estimatedCostUsd`) at every `setCachedAiResponse` call site. Also fixed 2 read-side bugs this exposed: `getCachedAiResponse` returns `AiCacheEntry | null`, not a string, so 3 call sites were treating the returned object as a raw string (`cached.slice(...)` → now `cached.responseText.slice(...)`).

Verified end-to-end post-fix via real edge function calls: `generate-marketing-caption`, `generate-marketing-template`, `social-inbox-ai-suggest` all return `200` with real Gemini output. `import-ai-map-columns` and `polishVoiceUtterance` (voice transcript cleanup) were fixed identically but not exercised end-to-end this session — the former needs a seeded import batch fixture, the latter needs a live voice session; both are lower-risk since they follow the exact same corrected pattern proven working in the other 3.

Also removed a silent `catch {}` in `marketingCaptionAi.ts` that was swallowing the real Gemini error during debugging (replaced with `console.warn`) — this is what made the original `gemini-2.0-flash-lite` 404s and the cache-signature crash invisible in the API response (both surfaced only as the generic "AI caption unavailable" message). Worth checking whether the other 4 files' equivalent silent catches are hiding anything similar; not audited further this session.

## Phase 2 — Assistant data model + backend foundation (2026-08-15, fourth session)

Started [`./ai-dashboard-assistant.md`](./ai-dashboard-assistant.md) Phase 2 ("Data model + backend foundation"). Built and verified locally:

- **Migration** `supabase/migrations/20261018120000_ai_dashboard_assistant.sql` — all 8 tables from plan §4 (`ai_dashboard_assistant_global_settings`, `_org_settings`, `_conversations`, `_messages`, `_pending_actions`, `_usage_daily`, `_action_audit`, `_knowledge_base`), RLS + `user_can_access_ai_dashboard_assistant_org()` SECURITY DEFINER helper (mirrors `user_can_access_org_inbox`), `updated_at` triggers, service-role grants. Applied cleanly via `bun run db:migrate`.
- **`_shared/dashboardAssistantContext.ts`** — added `buildHostSafeGroundingFacts(orgId, propertyId, permissions[])` + `hostSafeGroundingFactsToPrompt()`: permission-gated (no finance facts without `finance:view`, no maintenance facts without `maintenance:view`), capped to 5 properties for inline finance/maintenance aggregation (loops `computeFinanceSummary`/`computeMaintenanceSummary` per property — beyond that it reports "not available" rather than doing an unbounded per-turn fan-out). The Phase-B `buildDashboardAssistantContext`/`contextToPrompt` stub is untouched and still used by the plain-text `dashboard-assistant` endpoint.
- **`_shared/dashboardAssistantRiskClassifier.ts`** — added the deterministic `classifyActionRisk()` (plan §5): reads `statusMachine.ts#canTransition()` with `manual:false`/`manual:true` to distinguish primary-graph vs override-only edges (never a stored/asserted value), the exact `FINANCIAL_PAYLOAD_FIELDS` list from `TransitionPayload`, cross-scope (`pageContext` mismatch) and bulk-action escalation. The pre-existing model-assisted `classifyDashboardMessage` (message-intent, not action-intent) is untouched — the two are independent concerns per the file's new header comment.
- **`_shared/dashboardAssistantSafetyGuard.ts`** — added the `ChatBlock` discriminated-union type (plan §3), `assertBlocksGrounded()` (rejects unknown block types + any numeric field that doesn't trace back to the grounding-facts text), and `assertActionSafeToExecute()` — re-fetches the booking's **current** status directly from `guest_submissions` and re-runs `classifyActionRisk()`, hard-throwing on any tier disagreement. Not yet wired into a tool executor (that's Phase 3 — no tools exist yet to call it from).
- **`_shared/dashboardAssistantSettings.ts`** (new) — global/org settings CRUD + the soft-cap quota check/increment logic (`checkDashboardAssistantQuota`, `incrementDashboardAssistantUsage`, `isDashboardAssistantAccessible`). Not yet called by `dashboard-assistant/index.ts` (that endpoint still uses the older `ai_platform_*` quota path from Phase A) — wiring it in is part of Phase 3's `dashboard-assistant-chat` rewrite.
- **`get-booking`** edge function (new) — fills the confirmed gap from the plan; supports `?property_id=` or `?org_id=`/`?org_slug=` scope, returns the minimal `booking_card`-shaped fields (`bookingId`, `guestName`, `status`, `checkIn`, `checkOut`, `propertyId`, `propertyName`, `balanceDue` via `computeTotalGuestBalanceFromBooking`).
- **`dashboard-assistant-settings`** (org GET/PATCH) and **`dashboard-assistant-global-settings`** (super-admin GET/PATCH) edge functions (new) — same shape as the `ai-platform-*` settings endpoints but against the new independent tables.
- **`scripts/sync-ai-knowledge-base.ts`** (new) — parses the "Host-facing knowledge" Q&A sections out of all 67 `docs/guides/routes/**` guides and upserts into `ai_dashboard_assistant_knowledge_base`. Ran it against local Supabase: **219 Q&A entries synced**. Hit and fixed a real bug while writing it: a JSDoc comment containing the literal glob `**/*.md` breaks Bun's parser (`**/ ` closes the block comment early) — reworded the comment, not a functional issue but worth remembering for any future doc comment with a recursive-glob example. Also hit and fixed a regex bug: `content.match(/^## Host-facing knowledge\n([\s\S]*?)(?=\n## |\n---\n|$)/m)` — the `m` flag makes `$` match end-of-line, not just end-of-string, so the lookahead's `$` alternative matched immediately on the blank line right after the heading and the whole section always captured empty. Replaced with manual `indexOf`/`slice` instead of a single `m`-flagged regex spanning multiple semantics.
- **`supabase/config.toml`** — added `[functions.dashboard-assistant-settings]`, `[functions.dashboard-assistant-global-settings]`, `[functions.get-booking]` (all `verify_jwt = false`, matching every other admin function).

**Verified this session**: `bun run type-check && bun run lint && bun run build && bun run check:filenames` all pass; migration applies cleanly to local Supabase; `dashboard-assistant-settings`/`dashboard-assistant-global-settings`/`get-booking` all return `401` with no auth (booted correctly, no `500`s); the knowledge-base sync script ran end-to-end against local Supabase and rows are queryable via PostgREST.

**Not done in this session** (still open from the plan's Phase 2/3 scope):

- `dashboard-assistant-confirm` endpoint (Tier-2 execution against `ai_dashboard_assistant_pending_actions`) — Phase 3.
- The full `_shared/dashboardAssistantTools.ts` tool catalog (§2) — nothing calls `classifyActionRisk`/`assertActionSafeToExecute`/`assertBlocksGrounded` yet since there are no tools to gate. Phase 3.
- `dashboard-assistant-chat` (the real chat endpoint with the bounded tool-calling loop) — today's `dashboard-assistant/index.ts` stub is still the plain-text Phase-B endpoint and does **not** use any of this session's new modules. Phase 3.
- No owner/VIEWER-role curl matrix like the Phase-A/B sessions did (would need a self-minted local JWT) — only auth-boundary (`401`) verification was done. Do that before trusting the RBAC re-check claims end-to-end.
- Exhaustive `TRANSITION_GRAPH`/`MANUAL_OVERRIDE_GRAPH` walk against `classifyActionRisk()` (plan's phase 6 hardening item, but worth doing early given how load-bearing this classifier is) — not done, spot-checked only by reading the graph definitions.
- Frontend (`ui/src/features/dashboard/ai-assistant/**`) — nothing started. Phase 4.

## Phase 3-6 — Full assistant build-out (2026-08-15, fifth session)

Completed the rest of [`./ai-dashboard-assistant.md`](./ai-dashboard-assistant.md) end to end: tool catalog, real chat/confirm endpoints, full frontend (launcher, panel, blocks), admin config UI, booking-detail audit viewer, exhaustive risk-classifier verification, and the pending-action expiry cron. This is the full v1 scope from the plan — the only remaining items are the plan's own explicit non-goals (SSE streaming, parking-scoped tools, real billing, conversation-history browsing UI beyond "New conversation").

**Phase 3 — Tool catalog + real chat/confirm endpoints:**

- `_shared/dashboardAssistantTools.ts` (new) — implements every tool from plan §2 except `sync_booking_integrations`, which was **dropped**: grep confirmed `sync-booking-integrations`/`backfill-calendar-event-dates` are empty stub directories with no `index.ts` and no Google Calendar/Sheets integration exists anywhere in this codebase. Do not resurrect that tool without first building the backend it would wrap. Every tool independently re-verifies RBAC via `verifyPropertyAccess`/`verifyOrgAccess` against the original request's JWT (not a pre-resolved context), then for write tools calls `classifyActionRisk()` — Tier 2 returns a `proposed` result without executing; Tier 0/1 call `assertActionSafeToExecute()` immediately before running.
- `_shared/geminiToolCallClient.ts` extended with an optional `history: GeminiContent[]` field on `GeminiToolCallOptions` (+ `GeminiContent`/`GeminiContentPart` types) so a multi-round tool-calling loop can pass accumulated function-call/response turns — the previous single-`userPrompt`-turn shape only supported one-shot calls. Backward compatible; every existing caller is unaffected.
- `dashboard-assistant-chat/index.ts` (new) — the real turn endpoint: `verifyOrgAccess` → kill-switch + quota checks (`dashboardAssistantSettings.ts`) → `buildHostSafeGroundingFacts` → up to 4 tool-calling rounds against `TOOL_DECLARATIONS` → a final `callGeminiStructured` pass to synthesize `ChatBlock[]` → `assertBlocksGrounded` + `quickSafetyScan` + `guardDashboardAssistantResponse` → persists conversation/messages/pending-actions/audit rows → increments usage. A Tier-2 tool call short-circuits the loop immediately (never executes inline). The older `dashboard-assistant/index.ts` Phase-B stub is untouched and still exists as a separate, simpler endpoint.
- `dashboard-assistant-confirm/index.ts` (new) — executes or denies a pending action; only the proposing `user_id` may confirm; re-derives risk tier from current DB state before executing; a repeat call on an already-resolved action returns `{ alreadyResolved: true }` instead of re-executing (verified: does not double-cancel).
- `dashboard-assistant-conversations/index.ts` (new, not in the original plan's endpoint list but needed for the frontend) — GET a user's own conversation list (`?org_slug=`) or a single conversation's messages (`?conversation_id=`), private-per-user.
- `dashboard-assistant-settings/index.ts` — GET relaxed to no permission gate (any org/property member, not just `org:settings:view` holders) since the launcher button needs it to decide whether to render for every member, not just settings-page-capable admins; now also returns `platformEnabled` (the global kill switch, read-only) so the frontend doesn't need super-admin access to know if the assistant is available at all.

**Local end-to-end verification (real Gemini calls, self-minted local JWT for `sprmke.dev@gmail.com`, org `kame-home` / `9d0bacb6-…`):**

1. Tier-0 read (`"How many bookings are pending review right now?"`) → real tool call, correct answer, conversation/messages/usage rows all persisted correctly.
2. Tier-1 write (`propose_transition_booking` READY_FOR_CHECKIN→READY_FOR_CHECKOUT, empty payload) → correctly auto-executed once conditions were clean (verified fast via the pre-existing `transition-booking` endpoint directly); when the target booking's receipt was actually invalid, `WorkflowOrchestrator.transition()`'s own validation correctly rejected it and the tool surfaced that as a clean text block, not a crash — "a wrong AI-proposed call fails safely" per the plan's design intent.
3. Tier-2 propose → confirm (`propose_cancel_booking`) → returned a `proposed` action_confirmation block, confirmed via `dashboard-assistant-confirm`, booking flipped to `CANCELLED`, single `ai_dashboard_assistant_action_audit` row written. **Confirming twice** returned `{"status":"executed","alreadyResolved":true}` on the second call — no double-cancel.
4. One test hung for ~15+ minutes on a first attempt (Gemini API latency/rate-limit under repeated local test calls, not a code bug) — a retry of the identical request completed normally in seconds. If a chat turn seems stuck locally, it's very likely Gemini latency, not the tool loop; the loop is hard-capped at 4 rounds either way.

**Phase 4 — Frontend (`ui/src/features/dashboard/ai-assistant/**`, all new):**

- `lib/aiAssistantApi.ts` — `ChatBlock` union (mirrors the backend type in `dashboardAssistantSafetyGuard.ts` — two independent copies by design, matching how the block schema needs to exist on both sides), fetch wrappers for all 6 assistant edge functions.
- `hooks/useAiAssistantAccess.ts`, `useAiAssistantChat.ts`, `useAiAssistantConversations.ts`, `useAiDashboardAssistantSettings.ts` (+ global-settings variant) — same `useQuery`/`useMutation` + `scopedOrgFunctionsUrl` shape as `useAiPlatformSettings.ts`.
- `components/blocks/{TextBlock,BookingCardBlock,StatListBlock,DataTableBlock,LinkListBlock,ActionConfirmationBlock}.tsx` + `ChatBlockRenderer.tsx` — reuses the existing `StatusBadge`/`Table` primitives; `ActionConfirmationBlock` renders Confirm/Cancel buttons only when `status === 'proposed'`, otherwise an inert "done automatically"/"cancelled"/"expired" state.
- `components/{ChatThread,ChatComposer,AiAssistantPanel,AiAssistantLauncherButton}.tsx` — right-side `Sheet` slide-over (shadcn `sheet.tsx`, not the mobile `BottomSheet`), floating launcher button, mounted in `AdminLayout.tsx` gated on `{!superAdmin && <AiAssistantLauncherButton />}` — the button itself renders `null` until `useAiAssistantAccess` confirms both kill-switch layers are on, so it's naturally invisible on super-admin routes (no org context) and disabled orgs alike.
- `type-check`/`lint`/`build` all pass after this phase; one real bug caught and fixed: `lucide-react` in this repo's version has no `CircleAlert` export (only `AlertCircle`).

**Phase 5 — Admin config UI:**

- `OrgAiDashboardAssistantSection.tsx` (new) — mirrors `OrgAiPlatformSection.tsx`'s manual-draft-state pattern exactly; enable toggle, per-property disable checkboxes (from `useProperties`), 3 quota inputs. Mounted in `OrgSettingsPage.tsx` right after `OrgAiPlatformSection`, new `ai-assistant` nav section id.
- `AiDashboardAssistantKillSwitchCard.tsx` (new) — single-boolean card mirroring `AiPlatformKillSwitchCard.tsx`'s shape but far simpler (no feature allowlist — this product has no sub-features to gate). Mounted in `SuperAdminSettingsPage.tsx` alongside the existing platform-AI card.
- `get-booking-ai-assistant-audit/index.ts` (new edge function) + `BookingAiAssistantAuditCard.tsx` (new, reuses `BookingDetailCard` primitive) — mounted in `BookingDetailPage.tsx`'s "overview" tab right after `BookingMetaCard`, as a **compact card**, not a new tab (kept the risk surface small — `BookingDetailTabs`/`BookingViewTab`/`resolveBookingViewTab` is a more invasive piece of state to extend for what's fundamentally an optional read-only trail). Renders nothing when a booking has no assistant-audit rows.

**Phase 6 — Hardening:**

- **Exhaustive risk-classifier walk** — done against the **real, running code**, not a hand-duplicated copy: added a temporary local-only debug edge function that walked every `BookingStatus × BookingStatus` pair through the actual `canTransition()`/`classifyActionRisk()` from the live modules, captured all 35 real graph edges (`?manual=false` primary + `?manual=true`-only override edges) with their computed tiers, verified 5 invariants programmatically (any `→CANCELLED` is tier2; every override-only edge is tier2; adding a financial-payload field always escalates to tier2 regardless of edge; `PENDING_SD_REFUND→COMPLETED` is tier2 even though it's a primary-graph edge; every other primary/non-cancel/non-refund-finalize edge with an empty payload is tier1) — **all held across all 35 edges, zero failures**. The debug function and its `config.toml` entry were deleted immediately after (not part of the shipped catalog); rerun by temporarily recreating a similar walk function if the graph or classifier ever changes.
- **Pending-action expiry sweep** — `_shared/dashboardAssistantExpireCron.ts` + `dashboard-assistant-expire-pending-actions/index.ts` (mirrors `parkingBroadcastExpireCron.ts`'s exact shape: `serveCronPost`, optional `X-*-Cron-Secret` header check, guarded `UPDATE ... WHERE status = 'pending'`). `supabase/snippets/dashboard-assistant-expire-pending-actions-cron.sql` added with the same 3-option (no-secret / secret / local-docker) `pg_cron`+`pg_net` reference block as the parking one. **Not yet scheduled** on any environment — needs a `select cron.schedule(...)` run against the hosted DB (or local, for testing) plus optionally `DASHBOARD_ASSISTANT_EXPIRE_CRON_SECRET` set. Verified locally: `POST` returns `{"success":true,"expired":0}` cleanly.
- **Tool-loop runaway protection** — already built into `dashboard-assistant-chat` from Phase 3 (`MAX_TOOL_ROUNDS = 4`), not a separate hardening pass.
- **Quota-exceeded UX** — `dashboard-assistant-chat` returns a normal `{success:true}` response with a `text` block plus `upgradeHook: true` on quota exhaustion (mirrors the `ai-platform-*` 429 convention but as a 200 since it's still a valid, renderable chat turn); the panel shows a small warning line. Not e2e-tested this session (would need lowering `dailyMessageLimit` to 1 and re-testing, same as the Phase-A session did for the older quota path).
- **Mobile + accessibility pass** — **not done**. The Sheet slide-over is `sm:max-w-md` / full-width on mobile by shadcn's defaults, buttons hit the 44×44px target, but no dedicated pass (focus trap verification, ARIA live-region correctness beyond `aria-live="polite"` on the thread, keyboard-only confirm/cancel walkthrough) was done. Do this before shipping to real users.

**What's genuinely deferred (plan's own explicit non-goals — not gaps):** SSE token streaming, parking-scoped tools, real Stripe billing, cross-org actions, autonomous/scheduled assistant runs, custom/fine-tuned models, shared/team-visible conversations.

**Not done this session, worth doing before wider rollout:**

- No Playwright/browser pass — everything was verified via curl + real Gemini calls, not through the actual UI in a browser. The panel/blocks/composer have never been visually confirmed to render correctly.
- No VIEWER-role negative-path curl test against the new tool executors specifically (the Phase-A/B sessions did this for the older endpoints; Phase 3's RBAC re-check logic is exercised by the passing owner-role tests but not proven to reject a low-permission member).
- Conversation-history browsing UI (list past conversations, resume one) — backend (`dashboard-assistant-conversations`) supports it; frontend only has "New conversation", no history list/resume UI.

## Important gotchas / notes for the next session

- **Local Supabase edge runtime may not start** after `db:reset` or partial restart. The documented fix is `bun run stop:supabase` then `./dev.sh` (full stack). Do not rely on `bun run start:supabase` alone if functions are returning `502`.
- **Do not drop `voice_receptionist_global_settings`** until a follow-up migration seeds the new platform switch from the old table on hosted environments.
- **Per-property limits are hard-enforced.** Existing properties inherit `NULL` from org settings, so default behavior is preserved unless an admin explicitly sets overrides.
- **The `dashboard-assistant` endpoint currently returns plain text.** The full assistant chat/confirm endpoints and block UI are the next major chunk of work.
- **No Deno CLI** is installed locally; edge functions are verified by running the local Supabase stack and curl-ing endpoints, not by `deno check`.

## File map

| Concern                   | Path                                                                                                                 |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Foundation plan           | `docs/workflow/done/ai-platform-hardening.md`                                                                        |
| Assistant plan            | `docs/workflow/done/ai-dashboard-assistant.md`                                                                       |
| This handoff              | `docs/workflow/done/ai-platform-hardening-handoff.md`                                                                |
| Feature list              | `docs/workflow/done/ai-dashboard-assistant-features.md`                                                              |
| Manual test guide         | `docs/guides/testing/ai-dashboard-assistant-manual.md`                                                               |
| Migration                 | `supabase/migrations/20260814130000_ai_platform_hardening.sql`                                                       |
| Model routing             | `supabase/functions/_shared/aiModelRouter.ts`                                                                        |
| Usage/quota               | `supabase/functions/_shared/aiUsageService.ts`                                                                       |
| Key rotation              | `supabase/functions/_shared/aiGeminiKeys.ts`                                                                         |
| Prompt cache              | `supabase/functions/_shared/aiQuotaCache.ts`                                                                         |
| Tool-call client          | `supabase/functions/_shared/geminiToolCallClient.ts`                                                                 |
| Assistant context         | `supabase/functions/_shared/dashboardAssistantContext.ts`                                                            |
| Assistant risk classifier | `supabase/functions/_shared/dashboardAssistantRiskClassifier.ts`                                                     |
| Assistant safety guard    | `supabase/functions/_shared/dashboardAssistantSafetyGuard.ts`                                                        |
| Assistant settings/quota  | `supabase/functions/_shared/dashboardAssistantSettings.ts`                                                           |
| Assistant migration       | `supabase/migrations/20261018120000_ai_dashboard_assistant.sql`                                                      |
| Assistant tool catalog    | `supabase/functions/_shared/dashboardAssistantTools.ts`                                                              |
| Assistant expiry cron     | `supabase/functions/_shared/dashboardAssistantExpireCron.ts`, `dashboard-assistant-expire-pending-actions/`          |
| Assistant endpoint stub   | `supabase/functions/dashboard-assistant/index.ts` (Phase-B plain-text — still exists, separate)                      |
| Assistant chat/confirm    | `supabase/functions/dashboard-assistant-chat/`, `dashboard-assistant-confirm/`, `dashboard-assistant-conversations/` |
| Assistant settings edges  | `supabase/functions/dashboard-assistant-settings/`, `dashboard-assistant-global-settings/`                           |
| Single-booking read       | `supabase/functions/get-booking/index.ts`                                                                            |
| Booking audit read        | `supabase/functions/get-booking-ai-assistant-audit/index.ts`                                                         |
| Knowledge-base sync       | `scripts/sync-ai-knowledge-base.ts`                                                                                  |
| Expiry cron snippet       | `supabase/snippets/dashboard-assistant-expire-pending-actions-cron.sql`                                              |
| AI platform endpoints     | `supabase/functions/ai-platform-*/`                                                                                  |
| Assistant frontend        | `ui/src/features/dashboard/ai-assistant/**` (lib, hooks, components incl. blocks/)                                   |
| Org assistant settings UI | `ui/src/features/dashboard/org/components/org-settings/OrgAiDashboardAssistantSection.tsx`                           |
| Super-admin assistant UI  | `ui/src/features/dashboard/super-admin/components/AiDashboardAssistantKillSwitchCard.tsx`                            |
| Booking audit card        | `ui/src/features/dashboard/ai-assistant/components/BookingAiAssistantAuditCard.tsx`                                  |
| UI kill switch            | `ui/src/features/dashboard/super-admin/components/AiPlatformKillSwitchCard.tsx`                                      |
| Org AI settings           | `ui/src/features/dashboard/org/components/org-settings/OrgAiPlatformSection.tsx`                                     |
| Property AI settings      | `ui/src/features/dashboard/org/components/property-settings/PropertyAiPlatformSection.tsx`                           |
| AI settings hooks         | `ui/src/features/dashboard/org/hooks/useAiPlatformSettings.ts`                                                       |
| Status machine            | `supabase/functions/_shared/statusMachine.ts`                                                                        |
| Workflow orchestrator     | `supabase/functions/_shared/workflowOrchestrator.ts`                                                                 |

## Suggested next actions

1. **Real browser/Playwright pass** — every check so far has been curl + DB queries; nobody has opened the assistant panel in an actual browser yet. Open a dashboard, click the launcher, send a message, click Confirm on a Tier-2 proposal, and watch it render.
2. **Schedule the expiry cron** — `dashboard-assistant-expire-pending-actions` works but nothing calls it yet. Run the appropriate block from `supabase/snippets/dashboard-assistant-expire-pending-actions-cron.sql` against the target environment.
3. **VIEWER-role negative-path test** — mint a JWT for a low-permission property member and confirm the tool executors in `dashboardAssistantTools.ts` actually reject (not just the owner-role happy path already proven).
4. **Conversation-history UI** — the backend (`dashboard-assistant-conversations`) already supports listing/resuming past conversations; the frontend only has "New conversation" today.
5. If you want to **drop the legacy voice table**, write a follow-up migration that copies `voice_receptionist_global_settings.enabled` into `ai_platform_global_settings.enabled` + `allowed_features`, then drop the old table.
