---
stage: planned
title: 'AI paid provider selection + production-safe quota tuning'
status: planned
tags: [planning, planned-modules, ai, gemini, cost, quotas, super-admin, plans-and-permissions]
updated: 2026-09-06
---

# AI paid provider selection + production-safe quota tuning

## TL;DR

1. **Provider: stay on Google Gemini.** Move from free multi-key rotation to **one paid pay-as-you-go `GEMINI_API_KEY` per environment**, keep a **paid `GROQ_API_KEY` as text-only fallback**. Gemini is the only single provider that covers our whole surface — vision, schema-enforced JSON, tool calling, **and** real-time voice (Live API native audio). No code rewrite: `_shared/aiModelRouter.ts` already centralises every model string and the key loader already reads a single paid key.
2. **The "marketing designs and video" feature is not image/video generation.** It produces structured JSON design tokens that a client-side Polotno canvas + Remotion video editor render. It needs cheap text + JSON only — no diffusion/video model, no second vendor.
3. **Before switching billing on, re-tune the quota defaults.** Today's defaults are call-count-based, under-price voice by ~10x in the cost estimator, and have no per-feature or platform-wide ceiling. Phase 2 replaces them with **cost-based enforcement + per-feature sub-caps + a guest/staff split + a platform circuit breaker**, with the numbers computed below.

## Problem

We currently run AI on **rotated free-tier Gemini keys + rotated free Grok/Groq keys** (`GEMINI_API_KEYS` comma list, `getGroqApiKey()`). That is fine for a handful of internal users and will break the moment we open production:

- Free-tier 429s cascade across every key → AI features fail for everyone at once.
- No contractual data-handling terms for guest PII flowing through the model.
- Multi-account free-tier rotation is against provider ToS at scale.

We need a **single, cheap, capable paid provider** that works for **every** AI feature we ship, and we need the **usage limits re-computed** so that opening the paid tap to "many users" cannot produce a surprise invoice.

## Current AI surface (what actually calls a model)

Everything routes through the hardened stack: `_shared/aiModelRouter.ts` (feature→model + price metadata), `_shared/aiGeminiKeys.ts` (key rotation + Groq fallback), `_shared/aiUsageService.ts` (kill switch, quotas, metering, credit wallet), `_shared/aiQuotaCache.ts` (1h deterministic-prompt cache).

| Feature (`AiFeature`)                              | Code                                                                                | Model today                                                                                             | Capability needed                                    | Trigger                        |
| -------------------------------------------------- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- | ------------------------------ |
| `receipt_validation`                               | `receiptValidationService.ts`                                                       | `gemini-2.5-flash`                                                                                      | vision + JSON                                        | staff / workflow               |
| `booking_ai_summary_guests` / `_pets` / `_pricing` | `bookingAiReviewService.ts`                                                         | `gemini-2.5-flash` (3 vision calls/booking)                                                             | vision + JSON                                        | staff                          |
| `dashboard_assistant`                              | `dashboard-assistant-chat`, `geminiToolCallClient.ts`, `dashboardAssistantTools.ts` | `gemini-2.5-flash`                                                                                      | tool calling + multi-turn + JSON                     | staff                          |
| `voice_receptionist`                               | `voiceReceptionistService.ts`, `geminiLiveEphemeral.ts`                             | `gemini-2.5-flash-native-audio-preview-12-2025` (Live API, browser connects direct via ephemeral token) | **real-time speech-to-speech** + server-locked tools | **guest**                      |
| `voice_polish`                                     | `polishVoiceUtterance.ts`                                                           | `gemini-3.1-flash-lite`                                                                                 | text                                                 | system (post-call)             |
| voice preview                                      | `geminiLiveVoicePreview.ts`                                                         | `gemini-2.5-flash-preview-tts` / `gemini-3.1-flash-tts-preview`                                         | TTS                                                  | staff (voice picker)           |
| `inbox_suggest` / `inbox_auto_reply`               | `socialInboxAiService.ts`, `social-inbox-ai-suggest`                                | `gemini-3.1-flash-lite`                                                                                 | text + grounding                                     | staff / **guest** (auto-reply) |
| `marketing_template` (design / video / calendar)   | `marketingTemplateGenerationAi.ts`                                                  | `gemini-2.5-flash`                                                                                      | **structured JSON only**                             | staff                          |
| `marketing_caption`                                | `marketingCaptionAi.ts`                                                             | `gemini-3.1-flash-lite`                                                                                 | text                                                 | staff                          |
| `smart_pricing`                                    | `smartPricingAi.ts`                                                                 | `gemini-2.5-flash`                                                                                      | JSON schema                                          | staff + cron                   |
| `import_column_map`                                | `importColumnMappingAi.ts`                                                          | `gemini-3.1-flash-lite`                                                                                 | JSON                                                 | staff                          |
| `ai_integration_verify`                            | `aiGeminiKeys.ts#probeAiProviderMinimal`                                            | `gemini-3.1-flash-lite`                                                                                 | tiny text                                            | admin health check             |

Text-only features already have a **Groq `meta-llama/llama-4-scout-17b-16e-instruct` fallback** wired.

### Key finding — no generative image/video anywhere

Grep for `imagen|veo|dall-e|stable-diffusion|nano-banana|flux|replicate|fal.ai|runway|sora|:predict` across `supabase/` and `ui/src/` returns **nothing**. Marketing Studio's "design" and "video" generation returns token objects (`layoutArchetype`, `palette`, `fontPairing`, `copy`, scene list with transitions/motion) — see `marketingTemplateGenerationAi.ts` `DESIGN_RESPONSE_SCHEMA` / `VIDEO_RESPONSE_SCHEMA`. Rendering is 100% client-side (Polotno, Remotion). **This removes the only thing that would force an expensive multimodal provider.** The single non-text capability we depend on is the real-time voice receptionist.

## Provider evaluation

| Provider                          | Vision       | Schema-enforced JSON        | Tool calling | **Real-time voice**                              | TTS  | Cheap-tier text ($/1M in / out)              | Guest-PII terms  | Verdict                                                      |
| --------------------------------- | ------------ | --------------------------- | ------------ | ------------------------------------------------ | ---- | -------------------------------------------- | ---------------- | ------------------------------------------------------------ |
| **Google Gemini**                 | strong       | **best** (`responseSchema`) | yes          | **yes** (Live API native audio)                  | yes  | Flash-Lite ~0.10 / 0.40 · Flash ~0.30 / 2.50 | enterprise terms | **Recommended — covers 100% of surface, already integrated** |
| OpenAI                            | strong       | strict schema               | best         | Realtime API exists, **audio tokens ~4x Gemini** | yes  | GPT-5 mini ~0.25 / 2.00 · nano ~0.05 / 0.40  | enterprise terms | Viable but pricier voice + full rewrite of every REST call   |
| Anthropic Claude                  | strong       | via tools                   | excellent    | **none**                                         | none | Haiku pricier than Gemini Lite               | enterprise terms | Cannot do the receptionist — needs a 2nd vendor              |
| Groq                              | Llama-4 only | JSON mode (not schema)      | ok           | none                                             | none | Llama 3.1 8B ~0.05 / 0.08                    | US               | **Keep as text-only fallback only**                          |
| DeepSeek                          | none         | weak                        | weak         | none                                             | none | ~0.27 / 0.40                                 | **China-hosted** | Disqualified for guest PII                                   |
| OpenRouter / Together / Fireworks | routed       | varies                      | varies       | none                                             | none | varies                                       | varies           | Text/vision only — no voice                                  |

**Decision: Google Gemini, single paid key, Groq paid fallback for text.** Rationale: only provider that also does the voice receptionist without a second vendor; cheapest capable multimodal tier; `responseSchema` is the strongest guarantee for our ~6 JSON features; zero migration because `aiModelRouter.ts` is the single choke point for model IDs and `getGeminiApiKeys()` already handles a lone `GEMINI_API_KEY`.

## Cost model & computation

Assumptions: paid Gemini, `credit_unit_usd = $0.001` (1,000 credits = $1). Token sizes are estimates from the prompts in each service; **verify against `ai_platform_usage_events` after 2 weeks of real traffic** (Phase 4).

### Per-call cost

| Feature                                       | Tier             | ~in tok      | ~out tok     | ~$/call                                      | ~credits/call |
| --------------------------------------------- | ---------------- | ------------ | ------------ | -------------------------------------------- | ------------- |
| `inbox_suggest` / `auto_reply`                | flash-lite       | 1,500        | 200          | $0.0007                                      | 1             |
| `marketing_caption`                           | flash-lite       | 800          | 200          | $0.0005                                      | 1             |
| `voice_polish`                                | flash-lite       | 2,000        | 500          | $0.0013                                      | 2             |
| `import_column_map`                           | flash-lite       | 2,000        | 800          | $0.0017                                      | 2             |
| `receipt_validation`                          | flash + image    | 1,500        | 250          | $0.0011                                      | 2             |
| `booking_ai_summary_*` (×3/booking)           | flash + image    | 2,000        | 400          | $0.0016 ea                                   | 2 ea          |
| `smart_pricing`                               | flash            | 2,500        | 500          | $0.0020                                      | 2             |
| `marketing_template`                          | flash            | 1,200        | 700          | $0.0021                                      | 3             |
| `dashboard_assistant` (per multi-tool turn)   | flash            | 4,000        | 800          | $0.0032                                      | 4             |
| **`voice_receptionist` (per ~5-min session)** | **native audio** | audio ~9,600 | audio ~4,500 | **$0.08–0.25** (turn re-billing inflates it) | **80–250**    |

### ⚠️ Cost-estimator bug that must be fixed first

`aiModelRouter.ts` gives `voice_receptionist` `inputUsdPer1M: 0.3, outputUsdPer1M: 2.5` — that is the **text** Flash rate. Real Gemini Live **native-audio** rates are ~**$3 / $12 per 1M** (audio in / out). So `estimateTokenCostUsd()` under-prices every voice session by ~10x, which means **the `$10/day` org cost cap will not actually stop a runaway voice bill.** The voice path does have `cost_basis: 'duration'` with `voice_receptionist_cost_per_minute_usd = $0.023`, but a 5-min session at $0.023/min = $0.115 still ignores that Gemini re-bills prior turns each round-trip. **Phase 1 fixes this** (raise the per-minute basis to ~$0.06 and/or add real audio token rates).

### Projected spend — one "typical active property" per month

| Feature                            | calls/mo        | $/mo                   |
| ---------------------------------- | --------------- | ---------------------- |
| receipts (30 bookings)             | 30              | $0.03                  |
| booking AI review (30 × 3)         | 90              | $0.14                  |
| dashboard assistant (5/day)        | 150             | $0.48                  |
| inbox suggest/auto-reply (10/day)  | 300             | $0.21                  |
| marketing caption + template       | 20              | $0.03                  |
| smart pricing (mostly cron/cached) | 10              | $0.02                  |
| voice polish                       | 60              | $0.08                  |
| **voice receptionist (2/day)**     | **60 sessions** | **~$12.00**            |
| **Total / property / month**       | **~690**        | **~$13** (≈ 92% voice) |

Scale-out (voice dominates; text is rounding error):

| Active properties | Est. $/month | Notes         |
| ----------------- | ------------ | ------------- |
| 50                | ~$650        | soft launch   |
| 150               | ~$2,000      | launch target |
| 500               | ~$6,500      | growth        |

Per org (avg 3 properties): **~$40/month**.

## Current limitation analysis

Defaults in `aiUsageService.ts` + migration `20261022150000`:

| Limit                                     | Default today                           | Problem for production                                                                                                                                                                                                                                                                                 |
| ----------------------------------------- | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `DEFAULT_DAILY_LIMIT`                     | 200 calls/org/day                       | Call-count ignores that a $0.0005 caption and a $0.20 voice session both count as "1". 200 calls could be $0.10 or $40.                                                                                                                                                                                |
| `DEFAULT_MONTHLY_LIMIT`                   | 5,000 calls/org/month                   | A 10-property org does ~6,900 legit calls/month → hits the wall mid-month and **all AI stops**, bluntly.                                                                                                                                                                                               |
| `DEFAULT_DAILY_COST_USD_LIMIT`            | $10/org/day                             | (a) Too high per-org at scale ($10 × many orgs = no real ceiling). (b) **Relies on the broken voice cost estimate above**, so it won't catch the one feature that can actually run up a bill.                                                                                                          |
| Monthly cost cap                          | **none**                                | Only a monthly _call_ cap exists. A slow leak under the daily cap accrues unbounded across a month.                                                                                                                                                                                                    |
| `default_daily_credit_limit` / `_monthly` | 100,000 / 1,000,000                     | Deliberately set ~10x above the $10/day cost cap → **the credit gate is currently inert.** Fine as shipped, but it means today only call-count + the (broken) $10 cost cap actually bite.                                                                                                              |
| Per-feature caps                          | **none**                                | A dashboard-assistant loop bug, or a guest hammering the voice receptionist, drains the whole org allowance.                                                                                                                                                                                           |
| Guest vs staff                            | **not separated**                       | `actor_type` is _recorded_ but not an enforcement axis. A guest-triggered feature (voice, inbox auto-reply) shares the same pool as staff features — a guest can starve staff AI. Voice has its own session caps (300s, 3/guest/day, 3 concurrent — good); inbox auto-reply has only the keyword gate. |
| Platform-wide ceiling                     | **none** beyond the boolean kill switch | 1,000 orgs × $10/day = $10k/day theoretical exposure with no automatic circuit breaker.                                                                                                                                                                                                                |
| Cache                                     | 1h TTL, exact-prompt only               | Good for `smart_pricing` cron and `ai_integration_verify`; near-useless for `dashboard_assistant` / `marketing_template` where prompts are rarely identical. Not a lever we can lean on for the expensive features.                                                                                    |

## Proposed balanced limits

Principle: **cost-based primary enforcement, call-count as a secondary guardrail, per-feature sub-caps for the dangerous ones, a guest/staff split, and a platform circuit breaker.** All values are new _defaults_ — every one is already overridable per-org / per-property, or becomes so in Phase 2.

### Platform (global — `ai_platform_global_settings`)

| Setting                                  | Proposed                | Why                                                                                                       |
| ---------------------------------------- | ----------------------- | --------------------------------------------------------------------------------------------------------- |
| Platform daily hard ceiling (new)        | **$150/day**            | ~3x projected launch spend (150 properties ≈ $65/day). Crossing it auto-flips `enabled=false` + pages us. |
| Platform soft alert (new)                | **$90/day (60%)**       | Feeds the cron in [`super-admin-service-cost-monitoring.md`](./super-admin-service-cost-monitoring.md).   |
| `voice_receptionist_cost_per_minute_usd` | **$0.06** (from $0.023) | Covers turn re-billing; makes the duration-based estimate roughly honest.                                 |
| `enforce_quotas`                         | stays `true`            | —                                                                                                         |

### Per-org defaults

| Setting                           | Today     | Proposed              | Why                                                                                                                                                                                         |
| --------------------------------- | --------- | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Daily cost cap                    | $10       | **$3/day**            | ≈ one active 5-property org's typical daily voice+text. Bigger orgs get a raised override at onboarding.                                                                                    |
| Monthly cost cap                  | none      | **$50/month** (new)   | Stops slow leaks; ≈ typical 3–4 property org.                                                                                                                                               |
| Daily call cap                    | 200       | **1,000** (secondary) | Keep as a loop-bug backstop, not the primary lever.                                                                                                                                         |
| Monthly call cap                  | 5,000     | **25,000** or retire  | Cost cap is the real limit; this just stops pathological loops.                                                                                                                             |
| `daily_credit_limit` / `_monthly` | 100k / 1M | **3,000 / 50,000**    | Align credits with the $3/$50 caps so the credit gate and cost cap agree, and overage cleanly draws `ai_platform_org_credit_wallet` (paid top-up path already built — `aiCreditLedger.ts`). |

### Per-feature sub-caps (new layer — `ai_platform_property_settings` + a small feature-scoped table or JSONB)

| Feature               | Cap                                                                      | Why                                                    |
| --------------------- | ------------------------------------------------------------------------ | ------------------------------------------------------ |
| `voice_receptionist`  | **$1.50/day/property** (≈ 8–12 sessions) on top of existing session caps | The one feature that can actually run up a bill.       |
| `dashboard_assistant` | **150 turns/day/org**                                                    | Loop-bug / abuse protection.                           |
| `inbox_auto_reply`    | **50/day/property**, hard (guest-triggered)                              | Independent of the org pool so a guest can't drain it. |
| others                | inherit org cap                                                          | Cheap enough not to need their own.                    |

### Guest vs staff split

- Use the already-recorded `actor_type` as an enforcement axis: **guest-attributed spend capped at 30% of the org daily cost cap** ($0.90/day at the $3 default). A guest attack degrades to "guest AI paused", staff AI untouched.

## Phases (implementation — no code in this doc)

### Phase 0 — provider cutover (infra only, no code)

1. Create one paid Google AI Studio / Vertex project per environment (dev Supabase `fwor…`, legacy prod `zftt…` — never share keys). Enable Cloud Billing + a GCP budget alert.
2. Set a single `GEMINI_API_KEY` + one paid `GROQ_API_KEY` in each env's Supabase Edge secrets. Keep `GEMINI_API_KEYS` (multi-key) **only** in `ui/.env.development` for local dev.
3. Smoke-test every feature against `ai_integration_verify` + a manual run of each edge function locally (`bun run dev:api`).
4. Update `docs/archive/operations/ai-platform-billing.md` with the final project IDs + budget-alert thresholds.

### Phase 1 — fix the cost estimator (blocking for Phase 2)

1. In `aiModelRouter.ts`: correct `voice_receptionist` rates to real native-audio pricing (or add `audioInputUsdPer1M` / `audioOutputUsdPer1M` and have the voice path use them).
2. Raise `voice_receptionist_cost_per_minute_usd` default to `$0.06` (migration + `getAiPlatformGlobalSettings` default).
3. Re-check `estimateTokenCostUsd()` and the `cost_basis: 'duration'` branch in `recordAiUsage()` agree within ~20% of a real 5-min session on the GCP invoice.
4. Consider demoting `dashboard_assistant`, `smart_pricing`, `marketing_template` from `gemini-2.5-flash` to a Flash-Lite tier and A/B the output quality — receipts, booking-doc vision, and guest-ID review **stay on full Flash**.

### Phase 2 — quota model changes

1. Migration: add `platform_daily_cost_ceiling_usd` + `platform_daily_cost_soft_usd` to `ai_platform_global_settings`; add `monthly_cost_usd_limit` to `ai_platform_org_settings` (+ property override, NULL = inherit).
2. Migration: lower the shipped defaults per the tables above (`default_daily_cost_usd_limit` 10 → 3; new `default_monthly_cost_usd_limit` 50; credit defaults 3,000 / 50,000; call defaults 1,000 / 25,000).
3. `aiUsageService.ts`: add the platform-ceiling check at the top of `assertOrgAndPropertyAiQuota()` (fail-closed + fire an alert row); add the monthly-cost check alongside the existing daily-cost check; add per-feature sub-cap lookups; add the `actor_type`-scoped guest cap.
4. Extend `getOrgAiUsageSummary` / `getPropertyAiUsageSummary` DTOs with the new remaining values so the existing `/admin/ai-usage` + org settings UI can render them.
5. Wire the platform ceiling breach into the same email + Telegram alert path proposed in [`super-admin-service-cost-monitoring.md`](./super-admin-service-cost-monitoring.md) — do not build a parallel alerter.
6. **Atomic quota (handed off from [`ai-llm-best-practices-hardening.md`](../for-testing/ai-llm-best-practices-hardening.md) Phase 4):** today `assertOrgAndPropertyAiQuota` reads usage, the call runs, then usage is written, so concurrent calls can overshoot a cap. Replace with a reserve-then-settle RPC (reserve estimated credits before the call inside the AI gateway `_shared/ai/llmClient.ts`, settle actual usage or release on failure). Overshoot is currently bounded by per-user rate limits and the platform cap.

### Phase 3 — UI surfacing (route guides required)

1. `/admin/ai-usage` (`super-admin-ai-usage`): show platform-ceiling gauge + per-feature spend split + guest-vs-staff split.
2. Org AI settings card: show monthly cost cap + per-feature caps + "credits remaining / top up" (the wallet already exists).
3. `plans-and-permissions` pass: decide whether per-feature caps and the monthly cost cap vary by plan tier, or are flat platform defaults (recommend: flat defaults now, plan-scaled later). Mark the Team-RBAC axis N/A (these are org-level).

### Phase 4 — calibrate from real data (2 weeks after launch)

1. Query `ai_platform_usage_events` for real p50/p95 tokens per feature and real voice session cost vs the GCP invoice.
2. Adjust the Phase 1 token estimates and Phase 2 default caps to the real numbers.
3. Document the reconciliation in `docs/archive/operations/ai-platform-billing.md` (the file already asks for a quarterly voice reconciliation).

## Open decisions

1. **Vertex AI vs AI Studio key.** Vertex gives VPC-SC / data-residency controls and a formal DPA; AI Studio is simpler. Recommend Vertex for prod once volume justifies the setup.
2. **Retire the monthly _call_ cap entirely** in favour of the monthly _cost_ cap, or keep both? (Leaning: keep call cap as a cheap loop backstop only.)
3. **Per-feature caps storage** — a new `ai_platform_feature_limits` table vs a JSONB column on `ai_platform_property_settings`. (Leaning: JSONB now, table if it grows.)
4. **Do per-feature / monthly caps scale with plan tier** at launch, or stay flat? (Leaning: flat now.)
5. **Groq fallback for voice?** No — Groq has no speech-to-speech. If Gemini Live is down, voice degrades to the existing text web-chat. Confirm that's acceptable product behaviour.
6. **credit_unit_usd** stays $0.001, or move to a round "1 credit = $0.01" for a cleaner future top-up SKU? (Affects the Plans "buy more AI credits" intake item.)

## Docs to update (in the same change)

- `docs/PROJECT.md` — AI provider/env-var section, new global/org settings columns.
- `docs/archive/operations/ai-platform-billing.md` — paid project IDs, budget alerts, new default caps, voice reconciliation.
- `.cursor/rules/supabase-edge-functions.mdc` — if any JWT/env conventions change.
- `docs/guides/routes/admin/*` — `/admin/ai-usage` changes (invoke `route-guides`).
- Org AI settings route guide — new caps (invoke `route-guides`).
- `docs/architecture/plans-feature-matrix.md` — only if caps end up plan-scaled.

## Related plans / intake

- [`super-admin-service-cost-monitoring.md`](./super-admin-service-cost-monitoring.md) — generalises `/admin/ai-usage` to every paid service + threshold alerting. **This plan's Phase 2 alerts must reuse that cron, not fork it.**
- [`ai-opportunities-roadmap.md`](./ai-opportunities-roadmap.md) — any _new_ AI feature added there inherits this cost model.
- Intake `_to-plan.md`: "Manage how to give free AI credits to new users / discounts for events"; "Support to buy more AI credits on Plans" — both consume `ai_platform_org_credit_wallet` from this plan.
- `docs/workflow/done/ai-usage-metering-credits-foundation.md` — the metering/credit foundation this tunes.

## Non-goals

- Building a paid credit **checkout** flow (separate Plans intake item; the wallet + ledger already exist).
- Adding a generative image or video model (not used; Polotno/Remotion render client-side).
- Migrating off Gemini or rewriting the provider abstraction.
- Changing the voice receptionist's per-session caps (300s / 3-per-guest-per-day / 3 concurrent are already sane).

Back to [planned index](./README.md).
