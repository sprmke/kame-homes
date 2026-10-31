---
stage: done
title: 'AI Usage Metering & Credits Foundation'
status: done
tags: [planning, planned-modules, ai, billing]
updated: 2026-08-30
---

# AI Usage Metering & Credits Foundation

## Shipped so far

**Phase 1 (Attribution + credit shadow-ledger) is done** — additive, non-breaking, no enforcement change:

- Migration `supabase/migrations/20261022140000_ai_credit_foundation.sql`: `actor_user_id`/`actor_type`/`duration_seconds`/`cost_basis`/`credits_consumed` on `ai_platform_usage_events`; `credits_consumed` rollup on `ai_platform_usage_daily`, `ai_platform_property_usage_daily`, `ai_dashboard_assistant_usage_daily`; `credit_unit_usd`/`voice_receptionist_cost_per_minute_usd` on `ai_platform_global_settings`; new (inert) `ai_platform_org_credit_wallet` + `ai_platform_org_credit_ledger` tables; RPCs re-declared with `p_credits_consumed`. Applied and verified locally (RPC accumulation, RLS enabled, advisor-equivalent checks via direct SQL).
- New `supabase/functions/_shared/aiCreditLedger.ts` — `estimateCreditsFromCostUsd()`, `getOrgCreditWalletBalance()`, `insertCreditLedgerEntry()`.
- `_shared/aiUsageService.ts` — `recordAiUsage()` computes and persists `credits_consumed` + `actorUserId`/`actorType`; usage summaries expose `todayCreditsConsumed`/`monthCreditsConsumed`; global settings get/set `creditUnitUsd`/`voiceReceptionistCostPerMinuteUsd`.
- `voiceReceptionistService.ts` — per-minute rate now reads the configurable global setting instead of a hardcoded constant; records `cost_basis: 'duration'` + `duration_seconds`.
- Actor attribution (`actorUserId`/`actorType`) threaded through all AI call sites: dashboard assistant (`geminiToolCallClient.ts` + `dashboard-assistant-chat`), voice receptionist, receipt/valid-ID validation, inbox suggest + auto-reply, marketing caption + template generation, import column mapping, booking AI review (guests/pets/pricing sections).
- Informational UI: `OrgAiPlatformSection.tsx` shows "Credits used this month"; `AiPlatformKillSwitchCard.tsx` adds super-admin-only editable "Credit unit (USD)" and "Voice cost/min (USD)" fields.

**Phase 2 (Fragmentation fixes) is done:**

- `dashboardAssistantSettings.ts#checkDashboardAssistantQuota()` docstring reframed as the spam/abuse guard it actually is — the authoritative billing check remains the shared `ai_platform_*` credit/cost quota, already invoked every round via `callGeminiToolCall()`.
- `recordAiUsage()` now returns `{ creditsConsumed }`; `geminiToolCallClient.ts`'s `GeminiToolCallResult`/`GeminiStructuredResult` and `dashboardAssistantSafetyGuard.ts`'s `SafetyCheckResult` propagate it per call.
- `dashboard-assistant-chat/index.ts` sums `creditsConsumed` across every `dashboard_assistant`-feature call in a turn (tool-loop rounds + final structured-block synthesis + the safety-guard check) and passes the total into `incrementDashboardAssistantUsage()`, which now upserts `ai_dashboard_assistant_usage_daily.credits_consumed` alongside `message_count`/`write_action_count`. Verified locally: a simulated 3-call turn produced matching totals (`ai_dashboard_assistant_usage_daily.credits_consumed` = `SUM(ai_platform_usage_events.credits_consumed WHERE feature='dashboard_assistant')` for the same day) — the exact equality the plan's Phase 2 verification step calls for.
- New `getDashboardAssistantUsageSummary()` + opt-in `?includeUsage=true` on `dashboard-assistant-settings` GET (kept off the hot launcher-visibility path); `OrgAiDashboardAssistantSection.tsx` now shows monthly messages/write-actions/credits.
- `voiceReceptionistService.ts` — added the top-of-file reconciliation pointer (detailed quarterly-reconciliation note already lived on `endVoiceReceptionistSession()` from Phase 1).

**Phase 3 (Credit-based enforcement + host-facing credit UI) is done, with one deliberate scope call:**

- **`default_daily_credit_limit`/`default_monthly_credit_limit` are shipped as generous working defaults (100,000/day, 1,000,000/mo), not real pricing numbers** — confirmed with the user rather than guessed, since the plan flags these as "do not invent." At `credit_unit_usd: 0.001`, both sit ~10x above what the existing $10/day cost cap would ever produce, so this enforcement path is inert under today's real usage and only needs a settings change (no code/schema change) once pricing is confirmed.
- Migration `supabase/migrations/20261022150000_ai_credit_limits.sql`: `daily_credit_limit`/`monthly_credit_limit` on `ai_platform_org_settings` and `ai_platform_property_settings` (nullable overrides), `default_daily_credit_limit`/`default_monthly_credit_limit` on `ai_platform_global_settings`. Applied and verified locally.
- `aiCreditLedger.ts` — new `adjustOrgCreditWallet()` (read-modify-write balance + ledger entry, non-atomic by design per the plan) and `getRecentCreditLedgerEntries()`.
- `aiUsageService.ts#assertOrgAndPropertyAiQuota()` — after the existing call/cost checks, a credit check (org + property, property inherits org unless overridden): once daily or monthly credits consumed reach the limit, checks the org's wallet balance — positive balance allows the call (drawing from the wallet), empty wallet throws `AiQuotaExceededError` with `upgradeHook: true`.
- `recordAiUsage()` — once an org's (or property's) credit allowance was already exceeded before this call, debits that call's credits from the wallet and records a `usage_debit` ledger entry linked to the usage event.
- New super-admin edge function `ai-platform-credit-wallet` (GET balance + ledger, POST manual adjustment) — registered in `supabase/config.toml`.
- UI: `OrgAiPlatformSection.tsx`'s credits line is now a real progress bar against `monthlyCreditLimit` with wallet balance shown once non-zero; new `AiCreditWalletCard.tsx` on the super-admin AI Management page (org lookup by ID or slug, balance, manual adjustment form, recent ledger); `toastAiQuotaExceeded()` now shows credit-specific "Buy credits" copy when the error message mentions credits.

**Post-review hardening pass** (multi-angle code review before pushing surfaced 5 real issues, all fixed and re-verified locally):

- **Wallet debit didn't match the enforcement gate** — `assertOrgAndPropertyAiQuota()` admits a call via the wallet on 4 conditions (org-daily/org-monthly/property-daily/property-monthly credit exhaustion), but `recordAiUsage()`'s debit logic originally only re-checked org-monthly, so calls admitted via daily-only or property-level exhaustion were never actually debited — a real billing leak. Fixed with a shared `creditAllowanceExceeded()` helper used by both the gate and the debit decision, so they can't drift apart again. Verified with a targeted SQL simulation of the exact leak scenario (tight daily limit, loose monthly limit) — confirmed the wallet now debits correctly.
- **`recordAiUsage()` had an unguarded throw** — a `getAiPlatformGlobalSettings()` call added in Phase 1 could throw on a transient DB error, breaking this function's established "never blocks an already-successful AI response over telemetry infra hiccups" contract (RPC has a fallback, other errors are warn-only). A transient failure here could have discarded an already-generated valid AI response. Fixed: wrapped in try/catch with a fallback to the default credit unit.
- **`CREATE OR REPLACE FUNCTION` didn't replace the RPCs** — Postgres identifies functions by name **and** parameter list, so adding `p_credits_consumed` as a 7th argument created a second overload instead of replacing the original 6-arg functions (confirmed via `pg_proc`). New migration `20261022160000_ai_credit_foundation_hardening.sql` explicitly drops the stale 6-arg versions.
- **Wallet balance write was non-atomic** — `adjustOrgCreditWallet()` did a plain read-then-upsert, risking lost updates under concurrent debits on the one field in this feature closest to real money; its ledger entries also recorded the raw requested delta rather than the actually-applied (clamped) delta, so the ledger could diverge from real balance history. Fixed in the same migration: new `adjust_ai_platform_org_credit_wallet` RPC does a row-locked read-clamp-write and returns the real applied delta, which `adjustOrgCreditWallet()` now uses for the ledger entry. Verified the clamping math directly (a debit larger than the balance correctly applies only the clamped amount).
- **Voice-receptionist double-recording race** — `endVoiceReceptionistSession()`'s guarded `UPDATE ... WHERE ended_at IS NULL` never checked whether it actually affected a row, so two concurrent end-session calls (a retry racing a timeout handler) could both fall through to `recordAiUsage()`, double-recording cost/credits/wallet debits for one session. Pre-existing race (cost double-recording was already possible before this plan); Phase 1/3's credit and wallet additions made it more consequential. Fixed by checking the update's returned row and skipping usage recording when another call already ended the session.

Known non-blocking gaps surfaced by the same review, intentionally left as-is (reported to the user, not billing/security risks): `OrgAiDashboardAssistantSection.tsx`'s "credits used" figure only counts `dashboard_assistant`-feature calls, not the sub-feature cost of tools the assistant invokes (e.g. drafting a marketing caption) — org-level totals are unaffected, this is a per-surface reporting completeness gap only; `toastAiQuotaExceeded()` picks its CTA copy by matching the word "credit" in the error message rather than a typed field; the `{organizationId, propertyId, actorUserId?, actorType?}` attribution shape is redeclared in a few places instead of one shared type; a few small duplicated query/class-string patterns. None of these affect correctness or billing.

**Not started:** Phase 4 (payment provider wiring, deferred by design — `adjustOrgCreditWallet()` is the exact code path its webhook will call into). Open product decisions (§ Open product decisions requiring human input) are still unresolved — `credit_unit_usd: 0.001` and the new credit-limit defaults remain working defaults, not confirmed prices.

## Context

The goal is to accurately track AI usage per feature/action across the whole app, decide the right limit granularity (user vs org vs property), and lay groundwork for a future paid AI-credits upsell — because the next product phase will let hosts pay for extra AI credits, and that can't be priced or metered correctly without first knowing exactly what each AI action costs and how usage is tracked today.

**The critical discovery from this research: this is not greenfield.** The repo already has a mature, centralized AI metering system (`_shared/aiUsageService.ts`, `_shared/aiModelRouter.ts`, the `ai_platform_*` tables) that gates and records all 13 AI features by organization and property, with daily/monthly call limits and a daily USD cost cap. Verified by direct reads of `aiUsageService.ts` and `aiModelRouter.ts` (not just agent summaries). This plan is therefore a **hardening/extension pass**, not a new system — its job is to (1) close three concrete gaps in what already exists, and (2) introduce a "credits" abstraction that reconciles the draft pricing doc's vague "1000 credits" language with the $-cost tracking already in production, so a future paid-top-up phase can plug in without re-architecting anything.

**Do not confuse with `docs/workflow/for-testing/host-verification-tiers.md`** — that's the Verified/Recommended host-trust-badge system, a completely different feature that happens to share the word "tier." This plan is about AI pricing tiers from the draft in `docs/workflow/intake/_to-plan.md` (lines ~509–563), not host verification.

## Current state (confirmed by direct code/schema reads this session)

**Centralized AI metering already live**, routing all of: `receipt_validation`, `inbox_suggest`, `inbox_auto_reply`, `marketing_caption`, `marketing_template`, `import_column_map`, `voice_polish`, `ai_integration_verify`, `booking_ai_summary_guests`, `booking_ai_summary_pets`, `booking_ai_summary_pricing`, `voice_receptionist`, `dashboard_assistant` (the full `AiFeature` enum in `supabase/functions/_shared/aiModelRouter.ts`).

- `_shared/aiModelRouter.ts` — `FEATURE_MODELS: Record<AiFeature, AiModelConfig>` maps each feature to a Gemini model, a tier (`flash_lite` | `flash` | `live`), and `inputUsdPer1M`/`outputUsdPer1M` rates. `estimateTokenCostUsd(config, inputTokens, outputTokens)` computes cost. Rates: flash_lite = $0.25/$1.5 per 1M in/out (inbox_suggest, inbox_auto_reply, marketing_caption, import_column_map, voice_polish, ai_integration_verify); flash = $0.3/$2.5 per 1M in/out (receipt_validation, marketing_template, booking_ai_summary_*, dashboard_assistant); `voice_receptionist` is tier `'live'` with nominal $0.3/$2.5 rates that are **not actually used** for its cost estimation (see gap below).
- `_shared/aiUsageService.ts` — `assertOrgAndPropertyAiQuota(organizationId, propertyId, feature)` checks, in order: global kill switch → global per-feature allowlist → org enabled → org daily call count → org monthly call count → org daily cost USD → (if propertyId given) property enabled → property daily call count → property monthly call count → property daily cost USD. Fails closed (throws `AiPlatformDisabledError` / `AiFeatureDisabledError` / `AiQuotaExceededError`, the last carrying `code: 'AI_QUOTA_EXCEEDED'` and `upgradeHook: true`). `recordAiUsage({organizationId, propertyId, feature, provider, model, inputTokens, outputTokens, estimatedCostUsd, cacheHit})` writes org-daily and property-daily rollups via atomic RPCs (`increment_ai_platform_usage_daily`, `increment_ai_platform_property_usage_daily`) plus an append-only audit row in `ai_platform_usage_events`. Defaults: 200 calls/day, 5000 calls/month, $10/day cost cap — globally configurable, org/property can override (property `NULL` = inherit org).
- `_shared/aiQuotaCache.ts` — SHA-256 prompt-fingerprint response cache (`ai_platform_response_cache`, 1hr TTL, keyed by `(feature, fingerprint)` only — shared across orgs). Cache hits are recorded as a call but at **$0 cost** (`recordAiUsage`'s `cacheHit: true` short-circuits `estimatedCostUsd` to 0). This is a deliberate existing incentive and must be preserved by the credit formula (cache hit = 0 credits, not just $0).
- Tables (verified via migrations `20260814130000_ai_platform_hardening.sql`, `20261009120000_ai_platform_usage.sql`, `20261017140000_ai_platform_org_settings_cost_limit.sql`, `20261018120000_ai_dashboard_assistant.sql`): `ai_platform_global_settings` (singleton: `enabled`, `enforce_quotas`, `allowed_features[]`, `default_daily_call_limit=200`, `default_monthly_call_limit=5000`, `default_daily_cost_usd_limit=10`), `ai_platform_org_settings` (per-org overrides + `plan_tier TEXT DEFAULT 'included'` — a bare label with **zero billing backing**), `ai_platform_property_settings` (per-property override, nullable = inherit org), `ai_platform_usage_daily` / `ai_platform_property_usage_daily` (rollup counters: `call_count`, `input_tokens`, `output_tokens`, `estimated_cost_usd`), `ai_platform_usage_events` (append-only audit: `feature`, `provider`, `model`, `input_tokens`, `output_tokens`, `estimated_cost_usd`, `created_at` — **no `user_id` column**), `ai_platform_response_cache`.
- Existing `upgradeHook` stub UI convention (already shipped — reuse, don't reinvent): edge functions catch quota errors and return `{ success: false, error, upgradeHook: true }` at HTTP 429 (`social-inbox-ai-suggest`, `generate-marketing-caption`, `generate-marketing-template`, `dashboard-assistant-chat`). Frontend: `ui/src/features/dashboard/org/lib/aiQuotaToast.ts` generically handles any `upgradeHook: true` response with a stub "billing is coming soon" toast — **this is the exact hook a future "buy more credits" flow extends**, no new frontend error-handling paradigm needed.
- No subscription/billing/Stripe/PayMongo infrastructure exists anywhere in the repo (confirmed by grep). `ai_platform_org_settings.plan_tier` is the only hint of tiering, with no payment backing.

### Three concrete gaps this plan closes

1. **No per-user attribution.** `user_id` does not exist on any metering table (`ai_platform_usage_daily`, `ai_platform_property_usage_daily`, `ai_platform_usage_events`, `ai_platform_response_cache`) or any `aiUsageService.ts` function signature. The only `user_id` columns near AI features are on the AI Dashboard Assistant's _conversation ownership_ tables (`ai_dashboard_assistant_conversations`, `_messages`, `_pending_actions`, `_action_audit`) — for RLS/audit ("who sent this message"), not usage-cost attribution. Per confirmed decision below, this plan adds attribution only, not enforcement.
2. **Dashboard Assistant runs a second, parallel, unreconciled metering system.** `dashboardAssistantSettings.ts#checkDashboardAssistantQuota()` hard-stops on `ai_dashboard_assistant_usage_daily.message_count` (org-only, unit = messages/day) _before_ the tool-calling loop starts. Independently, `geminiToolCallClient.ts#callGeminiToolCall()` calls `assertOrgAndPropertyAiQuota()` + `recordAiUsage()` on **every round**, up to `MAX_TOOL_ROUNDS = 4` per user message (unit = $/calls, org+property). A single 4-round message is "1" in one system and up to "4" in the other, with zero reconciliation.
3. **Voice receptionist cost is not token-based.** `voiceReceptionistService.ts#endVoiceReceptionistSession()` computes `estimatedCostUsd = (durationSeconds/60) * ESTIMATED_COST_PER_MINUTE_USD` (hardcoded `0.023`, not configurable) and passes it directly into `recordAiUsage()` with **no** `inputTokens`/`outputTokens` recorded — bypasses `estimateTokenCostUsd()` and `FEATURE_MODELS` entirely. The code's own comment admits real Gemini Live billing "re-bills prior turns each round-trip," so long calls are underestimated.

## Business context — the draft pricing ladder this plan must reconcile

`docs/workflow/intake/_to-plan.md` (lines ~509–563, status still open/unplanned — the **only** copy of this list anywhere in `docs/`) proposes a 5-tier pricing ladder priced **per property listing**, not per user or per seat:

- Level 1: Free — basic features.
- Level 2: ₱349/mo — automated booking flow, verified badge, Telegram notif, team members.
- Level 3: ₱499/mo — + recommended badge, top-20 search visibility, "AI validations", **"AI tokens: 1000 credits"**, marketing features, custom pages.
- Level 4: ₱1499/mo — + top-10 search visibility, AI dashboard assistant, AI receptionist, AI marketing generation, AI chat auto-reply, **"AI tokens: x10"** (ambiguous — 10× Level 3's credit count, or 10× its dollar value; same thing at a flat rate, but the doc doesn't say which).
- Level 5: ₱3499/mo — org fully managed by the platform's own team (not self-serve AI usage). **"Extra AI token in org: PXXX/1000 credits"** — an explicit top-up/overage SKU.

These "credits" are placeholder shorthand with **no defined conversion to tokens/cost/calls** — defining that conversion is a core deliverable of this plan.

## Confirmed decisions (from planning session)

1. **Limit granularity: org + property remain the only enforcement axes.** Per-user is attribution-only (a `user_id`/`actor_type` column for visibility/support/abuse-triage), not a hard quota. Reasoning: the pricing ladder bills per property listing, not per user; org-pooled quotas are the standard multi-tenant B2B pattern; the one plausible abuse vector (dashboard assistant's agentic loop) is already bounded by `MAX_TOOL_ROUNDS = 4` plus per-tool RBAC plus the shared org pool already failing closed for the whole org. Revisit true per-user _limits_ only if the new visibility this plan adds surfaces an actual observed abuse pattern — not built speculatively.
2. **The future paid-credits phase is documented in this plan as an explicitly deferred Phase 4** (not built now), so the roadmap lives in one place. Phases 1–3 build the credit ledger, wallet, and manual-adjustment path now so Phase 4's payment wiring (Stripe/PayMongo, per the separate backlog item) plugs into already-shipped code instead of triggering a re-architecture later.

## Recommendation — credit conversion formula

### Per-feature cost baseline (estimates from current token-usage patterns and prompt sizes; no request-level telemetry exists yet to measure exactly — Phase 1's attribution work will let this be recalibrated with real data)

| Feature                     | Tier                                 | Est. input tokens           | Est. output tokens | Est. cost/call (USD)                    |
| --------------------------- | ------------------------------------ | --------------------------- | ------------------ | --------------------------------------- |
| `receipt_validation`        | flash (vision)                       | ~1,500                      | ~300               | ~$0.0012                                |
| `inbox_suggest`             | flash_lite                           | ~800                        | ~150               | ~$0.0004                                |
| `inbox_auto_reply`          | flash_lite                           | ~900                        | ~150               | ~$0.0005                                |
| `marketing_caption`         | flash_lite                           | ~600                        | ~200               | ~$0.0005                                |
| `marketing_template`        | flash                                | ~1,200                      | ~700               | ~$0.0021                                |
| `import_column_map`         | flash_lite                           | ~2,000                      | ~500               | ~$0.0013                                |
| `voice_polish`              | flash_lite                           | ~300                        | ~150               | ~$0.0003                                |
| `ai_integration_verify`     | flash_lite                           | ~100                        | ~10                | ~$0.00004                               |
| `booking_ai_summary_*` (×3) | flash                                | ~1,500                      | ~300               | ~$0.0012 each                           |
| `voice_receptionist`        | live, per-minute                     | n/a                         | n/a                | ~$0.023/min (~$0.12 for a 5-min call)   |
| `dashboard_assistant`       | flash, per round, up to 4 rounds/msg | ~2,500 (grows with history) | ~400               | ~$0.0018/round → ~$0.003–$0.007/message |

Cost-per-call varies **~50x** across features (`ai_integration_verify` at $0.00004 vs. a multi-round `dashboard_assistant` message at up to $0.007). This is why the formula below derives credits from actual cost rather than a flat per-feature schedule — a flat schedule would either overcharge cheap features or undercharge expensive ones. A flat, host-facing display schedule can be layered on top of this later purely for UX simplicity, without changing the underlying accounting.

### Formula

```
credits_consumed = cache_hit ? 0 : max(1, ceil(estimated_cost_usd / credit_unit_usd))
```

- `credit_unit_usd` is a single platform-wide config value (new column on `ai_platform_global_settings`), not hardcoded — matches the existing convention of storing default quota numbers as configurable settings.
- `max(1, ...)` prevents very cheap calls (e.g. `ai_integration_verify` at $0.00004) from rounding to 0 and becoming permanently free — every non-cached call costs at least 1 credit.
- Cache hits stay 0 credits (not just $0 cost) — preserves the existing cache-reuse incentive.
- `voice_receptionist`'s per-minute-derived `estimatedCostUsd` feeds the same formula unchanged — this is exactly why formalizing that estimate (gap #3 above) matters: it has to produce a defensible USD figure for the credit formula to convert fairly.

### Two credit pools (reconciling the pricing doc's language)

The draft doc conflates two different things under "credits" — split cleanly, matching the GitHub Copilot / Cursor pattern (included monthly allowance + separately purchasable overage):

1. **Included monthly allowance** — "AI tokens: 1000 credits" / "x10". Not a persisted balance — enforced the same way `dailyCallLimit`/`monthlyCallLimit` already are: sum this calendar month's `credits_consumed` and compare against `ai_platform_org_settings.monthly_credit_limit`. Resets naturally every month, same mechanism as the existing monthly call-count check — no cron needed.
2. **Purchased top-up wallet** — "Extra AI token in org: PXXX/1000 credits" (Level 5's explicit overage SKU). A real persisted, non-resetting balance: `ai_platform_org_credit_wallet.balance_credits`. Only drawn down once the monthly allowance is exhausted. This is the piece the deferred Phase 4 wires a payment provider into.

### Default `credit_unit_usd` — proposed $0.001/credit (1,000 credits = $1.00 USD), NOT final

Working default only, to sanity-check the formula against the draft doc's numbers:

- Level 3 (₱499/mo, "1000 credits" ≈ $1.00 of usage) ≈ ~800 `receipt_validation` calls, or ~150–300 `dashboard_assistant` messages — plausible for a small property's monthly AI-validation + marketing-generation allowance.
- Level 4 (₱1499/mo, "x10" read as 10,000 credits ≈ $10.00) covers heavier daily use across dashboard assistant, receptionist, auto-reply, marketing — also plausible.

This ratio directly sets gross margin on every paid tier — **must be confirmed by whoever owns pricing before Phase 3 ships real enforcement defaults** (see Open Decisions).

## Phase breakdown

Each phase is independently shippable. Phase 4 is explicitly deferred — described for roadmap completeness, not required to build now.

### Phase 1 — Attribution + credit shadow-ledger (additive, non-breaking, no enforcement change)

Goal: get accurate telemetry and the credit abstraction live and _visible_ before anything is gated on it, so `credit_unit_usd` can be sanity-checked against real usage before it becomes a hard limit.

**New migration** `supabase/migrations/<timestamp>_ai_credit_foundation.sql`:

- `ALTER TABLE ai_platform_usage_events ADD COLUMN actor_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL, ADD COLUMN actor_type TEXT CHECK (actor_type IN ('staff','guest','system')), ADD COLUMN duration_seconds NUMERIC, ADD COLUMN cost_basis TEXT NOT NULL DEFAULT 'tokens' CHECK (cost_basis IN ('tokens','duration')), ADD COLUMN credits_consumed NUMERIC(12,3);`
- `ALTER TABLE ai_platform_usage_daily ADD COLUMN credits_consumed NUMERIC(12,3) NOT NULL DEFAULT 0;`
- `ALTER TABLE ai_platform_property_usage_daily ADD COLUMN credits_consumed NUMERIC(12,3) NOT NULL DEFAULT 0;`
- `ALTER TABLE ai_platform_global_settings ADD COLUMN credit_unit_usd NUMERIC(12,6) NOT NULL DEFAULT 0.001, ADD COLUMN voice_receptionist_cost_per_minute_usd NUMERIC(12,6) NOT NULL DEFAULT 0.023;` (placeholder defaults — see Open Decisions)
- `ALTER TABLE ai_dashboard_assistant_usage_daily ADD COLUMN credits_consumed NUMERIC(12,3) NOT NULL DEFAULT 0;`
- New table `ai_platform_org_credit_wallet`: `organization_id UUID PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE, balance_credits NUMERIC(12,3) NOT NULL DEFAULT 0 CHECK (balance_credits >= 0), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`. Created empty for every org — inert until Phase 3.
- New table `ai_platform_org_credit_ledger` (append-only, mirrors `ai_platform_usage_events`' convention): `id UUID PK, organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE, entry_type TEXT NOT NULL CHECK (entry_type IN ('usage_debit','purchase_credit','manual_adjustment')), credits_delta NUMERIC(12,3) NOT NULL, related_usage_event_id UUID REFERENCES ai_platform_usage_events(id) ON DELETE SET NULL, description TEXT, created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`. Index `(organization_id, created_at DESC)`.
- Re-declare (`CREATE OR REPLACE`, new migration file — never edit a shipped migration) `increment_ai_platform_usage_daily` / `increment_ai_platform_property_usage_daily` with an added `p_credits_consumed NUMERIC` parameter.
- RLS/grants for the two new tables following the exact pattern every other `ai_platform_*` table uses (`ENABLE ROW LEVEL SECURITY` + `GRANT ALL ... TO service_role`; no client-facing SELECT policy needed yet — nothing reads these client-side until Phase 3).

**New** `supabase/functions/_shared/aiCreditLedger.ts`:

- `estimateCreditsFromCostUsd(costUsd: number, creditUnitUsd: number, isCacheHit: boolean): number` — implements the formula above.
- `getOrgCreditWalletBalance(organizationId): Promise<number>`
- `insertCreditLedgerEntry(input: { organizationId, entryType, creditsDelta, relatedUsageEventId?, description?, createdBy? }): Promise<void>`

**Modify** `_shared/aiUsageService.ts`:

- `recordAiUsage()` — compute `credits_consumed` via `estimateCreditsFromCostUsd()` using the global `creditUnitUsd`, write it onto the `ai_platform_usage_events` row, pass `p_credits_consumed` into both RPCs. Accept new optional `actorUserId`/`actorType` fields on `RecordAiUsageInput`, persist onto the event row. **No wallet debit and no enforcement change in this phase** — credits recorded for visibility only.
- `getOrgAiUsageSummary()` / `getPropertyAiUsageSummary()` — add `todayCreditsConsumed`/`monthCreditsConsumed` (informational).
- `getAiPlatformGlobalSettings()` / `setAiPlatformGlobalSettings()` — add `creditUnitUsd`/`voiceReceptionistCostPerMinuteUsd` get/set.

**Modify call sites** (mechanical — thread the requesting user's id, already available at every call site via `verifyPropertyAccess`/`verifyOrgAccess`/`resolve*Context`, into `recordAiUsage`'s new `actorUserId`/`actorType`): `geminiToolCallClient.ts` (`'staff'`), `_shared/receiptValidationService.ts`, `_shared/socialInboxAiService.ts` (`'staff'` for suggest, `'system'` for auto-reply), `_shared/marketingCaptionAi.ts`, `_shared/marketingTemplateGenerationAi.ts`, `_shared/importColumnMappingAi.ts`, `_shared/polishVoiceUtterance.ts`, `_shared/bookingAiReviewService.ts`. `voiceReceptionistService.ts` passes `actorType: 'guest'`, `actorUserId: guestUserId`, plus now sets `cost_basis: 'duration'` + `duration_seconds`, reading `voiceReceptionistCostPerMinuteUsd` from global settings instead of the hardcoded constant.

**Modify UI** (read-only additions, no gating UX yet):

- `ui/src/features/dashboard/org/hooks/useAiPlatformSettings.ts` — extend the usage summary DTO with `todayCreditsConsumed`/`monthCreditsConsumed`/`walletBalance`.
- `ui/src/features/dashboard/org/components/org-settings/OrgAiPlatformSection.tsx` — show "~N credits used this month" next to existing $ and call-count figures, framed as informational.
- `AiPlatformKillSwitchCard.tsx` + `useAiPlatformGlobalSettings.ts` — add editable `Credit unit (USD)` and `Voice cost/min (USD)` fields, super-admin only.
- `supabase/functions/ai-platform-usage/index.ts` — include the new fields in its response.

**Verification** (no automated test suite exists per CLAUDE.md — manual, per this repo's convention):

1. `bun run type-check`, `bun run lint`, `bun run build`.
2. Local Supabase: apply migration, run `mcp__supabase__get_advisors` on the two new tables.
3. `bun run dev:api`; trigger each of the 13 features once (at minimum: `receipt_validation`, `dashboard_assistant`, `voice_receptionist`, `inbox_auto_reply` for the `'system'` actor case), confirm `credits_consumed`/`actor_user_id`/`actor_type` populate correctly on `ai_platform_usage_events`.
4. Confirm a cache-hit call (repeat an `inbox_suggest` request with identical inputs) records `credits_consumed = 0`.
5. Manual Playwright pass on `OrgAiPlatformSection.tsx` and `AiPlatformKillSwitchCard.tsx` confirming the new fields render/save.

### Phase 2 — Fragmentation fixes

**Dashboard Assistant reconciliation** (do not delete `ai_dashboard_assistant_usage_daily` — `message_count`/`write_action_count` are legitimate product metrics independent of cost; stop treating `message_count` as an unreconciled _billing_ gate):

- `dashboardAssistantSettings.ts#checkDashboardAssistantQuota()` keeps its message/day and message/month checks, but redefined in its docstring as a **spam/abuse guard** (prevents burst chat-turn spam), not the billing-relevant limit.
- The **authoritative, billing-relevant limit is the shared `ai_platform_*` credit/cost check**, already invoked every round via `callGeminiToolCall()` → `assertOrgAndPropertyAiQuota()` — no new call site needed.
- `dashboard-assistant-chat/index.ts` — after the tool-calling loop, sum the turn's per-round `credits_consumed` (prefer threading the per-round costs through the loop's return value directly over re-querying `ai_platform_usage_events`) and pass into `incrementDashboardAssistantUsage()`, which upserts alongside `message_count`.
- `OrgAiDashboardAssistantSection.tsx` — show `credits_consumed` next to `message_count`/`write_action_count`.

**Voice Receptionist formalization** (already updated in Phase 1 for `cost_basis`/`duration_seconds`/configurable rate; this phase documents the process):

- Add a header-comment note in `voiceReceptionistService.ts` describing a **quarterly manual reconciliation process**: compare `SUM(estimated_cost_usd)` for `voice_receptionist` against the actual Gemini Live invoice line-item for the same period, adjust `voiceReceptionistCostPerMinuteUsd` if drifting. Intentionally manual, not automated (see Open Decisions for ownership).
- **Fast-follow, not required now**: if/when the Gemini Live SDK exposes real input/output audio token counts for a completed session, switch `cost_basis` to `'tokens'` and compute via `estimateTokenCostUsd()` like everything else.

**Verification**:

1. Send a multi-round dashboard assistant message (2+ tool rounds); confirm `ai_dashboard_assistant_usage_daily.credits_consumed` for that day equals the sum of the corresponding `ai_platform_usage_events.credits_consumed` rows for `feature='dashboard_assistant'` in that window (manual SQL cross-check).
2. Confirm `voice_receptionist_sessions.estimated_cost_usd` still populates and produces a corresponding `ai_platform_usage_events` row with `cost_basis='duration'` and non-null `duration_seconds`.

### Phase 3 — Credit-based enforcement + host-facing credit UI

**New migration** `supabase/migrations/<timestamp>_ai_credit_limits.sql`:

- `ALTER TABLE ai_platform_org_settings ADD COLUMN daily_credit_limit NUMERIC(12,3), ADD COLUMN monthly_credit_limit NUMERIC(12,3);` (nullable = inherit global default).
- `ALTER TABLE ai_platform_global_settings ADD COLUMN default_daily_credit_limit NUMERIC(12,3) NOT NULL DEFAULT <TBD>, ADD COLUMN default_monthly_credit_limit NUMERIC(12,3) NOT NULL DEFAULT <TBD>;` (defaults are a business decision — schema ships now, real enforcement defaults need confirmation first, see Open Decisions).
- `ALTER TABLE ai_platform_property_settings ADD COLUMN daily_credit_limit NUMERIC(12,3), ADD COLUMN monthly_credit_limit NUMERIC(12,3);` (nullable override, same pattern as existing property overrides).

**Modify** `_shared/aiUsageService.ts`:

- `assertOrgAndPropertyAiQuota()` — after existing cost checks, add a credit check (new `sumMonthCreditsConsumed`, mirroring `sumMonthCallCount`/`sumMonthCostUsd`): if `monthCreditsConsumed >= monthly_credit_limit`, check `getOrgCreditWalletBalance()` — if `> 0`, allow the call (draws from wallet); if `<= 0`, throw `AiQuotaExceededError('Monthly AI credit allowance used — top up credits to continue')` (already carries `upgradeHook: true`). Same for daily credit limit and property-level credit limits (inherited from org unless overridden, matching the existing cost-limit inheritance pattern).
- `recordAiUsage()` — after computing `credits_consumed`, if this month's _prior_ consumption had already exceeded `monthly_credit_limit`, debit `credits_consumed` from `ai_platform_org_credit_wallet.balance_credits` and insert a `usage_debit` ledger entry referencing this event. Mirrors the existing non-atomic check-then-write pattern already used for call-count limits (an accepted tradeoff in this codebase, not a new risk).
- New `adjustOrgCreditWallet(organizationId, creditsDelta, description, adjustedBy)` — inserts a `manual_adjustment` ledger entry and updates the wallet balance. **This is the super-admin manual top-up/comp path that ships now**, ahead of any real payment integration, and is the exact code path Phase 4's payment webhook will call into (`entry_type: 'purchase_credit'` instead of `'manual_adjustment'`) — nothing gets rebuilt later.

**New edge function** `supabase/functions/ai-platform-credit-wallet/index.ts` — super-admin only (mirrors `ai-platform-global-settings`'s access pattern): `GET` returns an org's wallet balance + recent ledger entries; `POST` calls `adjustOrgCreditWallet()`.

**Modify UI**:

- `OrgAiPlatformSection.tsx` — Phase 1's informational "credits used" line becomes a real progress bar against `monthly_credit_limit`, wallet balance shown once non-zero; the existing `upgradeHook`/`toastAiQuotaExceeded` path fires exactly as it already does today (no new frontend error-handling code needed).
- New super-admin page/section: org credit wallet viewer + manual adjustment form, following `AiPlatformKillSwitchCard.tsx`'s card layout convention.
- `toastAiQuotaExceeded()` copy — update from generic "Upgrade" to credit-specific stub copy ("Buy more AI credits — coming soon") once credits are the user-facing unit; still a stub, not a real purchase flow.

**Verification**:

1. Set a test org's `monthly_credit_limit` very low, exhaust it via repeated calls, confirm `assertOrgAndPropertyAiQuota()` throws with `upgradeHook: true` and the frontend shows the existing quota-exceeded toast.
2. Use `adjustOrgCreditWallet()` to top up that org's wallet, confirm subsequent calls succeed and `ai_platform_org_credit_ledger` shows both the `manual_adjustment` credit and subsequent `usage_debit` rows correctly decrementing the wallet.
3. `mcp__supabase__get_advisors` after the new migration.
4. Manual Playwright pass on the new super-admin wallet page.

### Phase 4 — Payment provider wiring (explicitly deferred, documented for roadmap completeness only)

Not built as part of this plan. When picked up: a new edge function (e.g. `ai-credit-checkout` + `ai-credit-webhook`) integrating PayMongo (per the separate intake backlog item "Integrate paymongo for payment transactions"), which on a successful payment calls the **already-shipped** `adjustOrgCreditWallet()` with `entry_type: 'purchase_credit'` instead of `'manual_adjustment'`, plus a host-facing "Buy credits" UI replacing the Phase 3 stub toast with a real checkout flow. Nothing in Phases 1–3's schema changes when this lands.

## Explicit non-goals

- No per-user quota _enforcement_ — attribution only, per confirmed decision. Revisit only if abuse is observed.
- No real payment/Stripe/PayMongo integration in this plan (Phase 4 is deferred).
- No flat per-feature credit schedule replacing the derived-from-cost formula — may be layered on top later purely for host-facing display simplicity.
- No automated monthly-allowance "grant" cron — the allowance is enforced by summing current-month usage against a limit, not by crediting a resetting balance.
- No change to `ai_platform_response_cache`'s cache-hit-is-free behavior.
- No real-time Gemini Live token-count capture for `voice_receptionist` — the per-minute estimate is formalized as a documented, configurable exception, not replaced (fast-follow noted in Phase 2).
- No automated test suite addition — this repo has none; verification is manual Supabase + Playwright per phase, per CLAUDE.md.

## Open product decisions requiring human input (do not invent these numbers)

1. **`credit_unit_usd`** (actual USD value of 1 credit) — this plan proposes $0.001 as a working default to sanity-check the formula, but it directly sets gross margin on every paid tier and must be confirmed by whoever owns pricing before Phase 3 ships real enforcement defaults.
2. **Exact per-tier monthly credit allowances** — the draft doc's "1000 credits" (Level 3) is explicit; "x10" (Level 4) is ambiguous and needs a literal number confirmed.
3. **Whether purchased top-up credits (wallet) expire or roll over indefinitely** — schema supports either (no expiry column yet; add one if "expires" is the answer) — needed before Phase 4's purchase-flow copy/behavior ships.
4. **Whether unused monthly _allowance_ credits roll over** — this plan assumes "use it or lose it" (matching how the existing call/cost limits already behave — reset monthly, no carryover), but should be explicitly confirmed.
5. **Level 5 ("fully managed by platform team") credit policy** — not self-serve, so needs an explicit `plan_tier` value with either a very high or effectively unlimited internal allowance, and a decision on who administers it (super-admin manual adjustment, per the Phase 3 tooling already built) — an operational question, not technical.
6. **PHP vs. USD display** — this plan does all cost math internally in USD (matching the existing `ai_platform_*` cost columns). Whether/how to display a PHP-denominated credit price to Philippine hosts (fixed vs. live FX rate) is a separate product/finance decision not resolved here.
7. **`voice_receptionist_cost_per_minute_usd` reconciliation cadence and owner** — this plan proposes a manual quarterly check against actual Gemini Live invoices; who runs that check is unassigned.

## Critical files

- `supabase/functions/_shared/aiUsageService.ts` — `assertOrgAndPropertyAiQuota()`, `recordAiUsage()`, `AiQuotaExceededError` — the central enforcement/recording point every phase extends. (Read in full this session — 783 lines, confirmed no `user_id` anywhere, confirmed exact quota-check order and RPC fallback behavior.)
- `supabase/functions/_shared/aiModelRouter.ts` — `FEATURE_MODELS`, `estimateTokenCostUsd()` — the cost baseline the credit formula converts from. (Read in full this session — confirmed exact per-feature rates.)
- `supabase/functions/_shared/geminiToolCallClient.ts` and `supabase/functions/_shared/dashboardAssistantSettings.ts` — the two systems Phase 2 reconciles.
- `supabase/functions/_shared/voiceReceptionistService.ts` — the per-minute cost exception Phase 1 formalizes.
- `supabase/migrations/20261009120000_ai_platform_usage.sql`, `20260814130000_ai_platform_hardening.sql`, `20261017140000_ai_platform_org_settings_cost_limit.sql`, `20261018120000_ai_dashboard_assistant.sql` — existing schema/RPC/RLS conventions every new migration in this plan mirrors exactly (never edit these files — add new migrations, per this repo's hook-enforced rule).
- `ui/src/features/dashboard/org/lib/aiQuotaToast.ts` — the existing `upgradeHook` stub UI convention Phase 3's quota-exceeded UX reuses without modifying its core mechanics.

## Verification summary (whole plan)

No automated test suite exists in this repo (per CLAUDE.md — Vitest/Deno test runner would be the future addition if one is ever added). Each phase above lists its own manual verification steps; in aggregate: `bun run type-check && bun run lint && bun run build` after each phase, `mcp__supabase__get_advisors` after every new migration, targeted curl/UI triggers of the affected edge functions against a local Supabase stack, manual SQL cross-checks for reconciliation correctness (Phase 2), and Playwright passes for any new/changed admin UI surfaces.
