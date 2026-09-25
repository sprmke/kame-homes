---
title: 'AI platform: gateway, prompts, safety, evals'
status: active
tags: [architecture, ai, gemini, security, evals]
updated: 2026-09-24
---

# AI platform: gateway, prompts, safety, evals

Part of the [`docs/PROJECT.md`](../PROJECT.md) architecture split. How every LLM call in the app is made, validated, metered and tested. Cost/quota policy lives in PROJECT.md § Platform AI metering; the assistant's tool catalog lives in [`ai-dashboard-assistant.md`](ai-dashboard-assistant.md). Plan of record: [`workflow/for-testing/ai-llm-best-practices-hardening.md`](../workflow/for-testing/ai-llm-best-practices-hardening.md).

## 1. Layering

```
edge handler (thin: auth → rate limit → zod body → service)
  → feature service (_shared/<feature>.ts: context + business rules)
    → prompt module (_shared/ai/prompts/*.ts or definePrompt in the service)
      → gateway (_shared/ai/llmClient.ts / llmTools.ts)
        → transport (_shared/ai/llmTransport.ts: HTTP, keys, retries)
  ← schema validation (zod) → business-rule validation → guards → response
```

The browser never holds a provider key. Gemini Live uses a server-minted, single-use ephemeral token (`_shared/geminiLiveEphemeral.ts`).

**CI guard:** `bun run check:ai-gateway` (`scripts/dev/check-ai-gateway.mjs`, wired into `ci.yml`, `cd-dev.yml` and `ci-quality-gate.sh`) fails if `generativelanguage.googleapis.com` or `api.groq.com` appears outside `_shared/ai/`, or if a key is sent as `?key=`.

## 2. Gateway modules (`supabase/functions/_shared/ai/`)

| Module               | Role                                                                                                                                                                                                                                                                                                                                                                                          |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `llmTransport.ts`    | Only file that talks HTTP to providers. Per-feature timeout (router `timeoutMs`) merged with the caller's `AbortSignal`; jittered exponential backoff that honors `retry-after`; key rotation across `GEMINI_API_KEYS`; key in the `x-goog-api-key` header. 400 fails fast (except `API_KEY_INVALID`, which rotates); 401/403 rotate to the next key; 429/5xx retry. Typed `AiProviderError`. |
| `llmClient.ts`       | `generateText` / `generateStructured`. Order: quota gate → response cache → Gemini → optional Groq fallback (priced at Groq rates) → metering + trace row. `generateStructured` = `responseSchema` + zod `safeParse` + one repair retry, then `AiOutputValidationError`. Failed calls are recorded too (`recordAiFailure`).                                                                   |
| `llmTools.ts`        | `generateWithTools` / `generateStructuredViaTool` for multi-round function calling (assistant). Uses real `systemInstruction`, abort signal, same metering.                                                                                                                                                                                                                                   |
| `prompt.ts`          | `definePrompt({ id, version })`. Every call carries a `PromptRef`; id + version land on `ai_platform_usage_events` so regressions are attributable. Bump `version` (`YYYY-MM-DD.n`) on any prompt text or schema change.                                                                                                                                                                      |
| `prompts/*.ts`       | Prompt modules for the larger prompts: dashboard assistant (+ blocks schema), inbox reply, document validation, marketing caption. Smaller features declare `definePrompt` next to their builder.                                                                                                                                                                                             |
| `untrusted.ts`       | Prompt-injection isolation: `wrapUntrusted`, `withUntrustedDataRule`, `inlineUntrusted` (see §4).                                                                                                                                                                                                                                                                                             |
| `toolArgs.ts`        | Server-side validation of model-proposed tool args against the tool's declared schema (types, enums, size caps). Rejects instead of coercing.                                                                                                                                                                                                                                                 |
| `contextBudget.ts`   | Assistant context budget: tool results capped at 12k JSON chars for the model (lists trimmed with an "N more items omitted" marker), prior history fit to 8k tokens, whole turn capped at 60k tokens. Grounding still uses the full data.                                                                                                                                                     |
| `redact.ts`          | `redactSensitiveFields` before persisting assistant `tool_calls`.                                                                                                                                                                                                                                                                                                                             |
| `requestInput.ts`    | `boundedText` / `requiredText` / `parseAiRequestBody` zod helpers for AI request bodies.                                                                                                                                                                                                                                                                                                      |
| `aiErrorResponse.ts` | Maps gateway errors to HTTP: quota → 429 + `upgradeHook`, provider unavailable → 503, invalid output → 502, aborted → 499.                                                                                                                                                                                                                                                                    |
| `providerHealth.ts`  | `probeAiProviders`, memoized 5 minutes, for the super-admin integration check.                                                                                                                                                                                                                                                                                                                |

`_shared/aiModelRouter.ts` stays the single source for feature → model, price, tier, `timeoutMs`, `groqFallback`, plus the Groq fallback model and TTS preview models.

## 3. Structured output and advisory verdicts

- Receipt / valid-ID validation and booking AI review use `responseSchema` + zod. ID results are keyed by guest slot, never matched by array position.
- Smart pricing clamps `suggestedMin/Max` to the base-rate bounds (`clampSuggestedBounds`).
- **AI verdicts are advisory.** An `invalid` document verdict still blocks a workflow transition by default, but a human host (`org_owner`, `team_member`, `super_admin`) can pass `override_ai_verdict: true` (`_shared/aiVerdictOverride.ts`). The server answers a blocked transition with a 409 coded `ai_verdict_blocked`; the booking detail UI offers **Proceed anyway**. Overrides are recorded as `aiVerdictOverridden` in the transition's activity metadata. Canonical rules: `.cursor/rules/booking-workflow.mdc`.

## 4. Prompt injection and input safety

- Guest messages, attachment names, pinned labels, OCR text, CSV headers and review text are fenced with `wrapUntrusted` / `inlineUntrusted`, and every system prompt that receives them includes `UNTRUSTED_DATA_RULE`. This lowers risk; the real boundaries are authz, output validation and human confirmation.
- **Assistant:** once a turn reads guest-written content (`UNTRUSTED_CONTENT_TOOL_NAMES`), every later write in that turn needs host confirmation. Tool results that carry guest text are marked `dataOrigin: contains_guest_written_text`. Max 8 tool calls per round, 4 rounds per turn, daily write cap enforced (`dailyWriteActionLimit`, atomic counter RPC).
- **Confirm** (`dashboard-assistant-confirm`) claims the pending action atomically (`pending → executing`), so a double click never executes twice; failures are stored as `failed`.
- **Guards fail closed:** the assistant LLM safety guard returns a refusal on error. The inbox reply guard (`inboxAiSafetyGuard.ts`) is deterministic: pricing values, bare amounts, account numbers and other guests' names must be grounded in the property facts.
- **Links:** assistant `link_list` hrefs must be internal app paths (`isSafeInternalHref`). Knowledge-base citations ("Related pages") are built server-side from KB rows, never written by the model.
- **Input caps:** assistant message and guest chat text 4,000 chars (`MAX_MESSAGE_CHARS`, UI `CHAT_MESSAGE_MAX_CHARS`); attachments are size-checked from base64 length before decoding and MIME-sniffed from magic bytes; import mapping caps headers and masks sample values.

## 5. Authorization and rate limits

- Assistant `pageContext.propertyId` must belong to the chat's org before any plan gate or insert. Inbox suggest checks conversation scope (`loadInboxConversationInScope`). Finance/maintenance row writes check row scope (`assertAssetRowInScope`). The upload vision path checks the `aiValidations` entitlement.
- AI crons fail closed via `verifyCronSecret`.
- Rate limits (per user): `dashboard-assistant-chat` 30/10 min, `dashboard-assistant-confirm` 30/10 min, `booking-ai-review` 20/10 min, `validate-booking-receipts` 20/10 min, `import-ai-map-columns` 20/hour.
- **Inbox auto-reply** (`_shared/inboxAutoReplyPolicy.ts`): 90 s cooldown and at most 10 AI replies per conversation per hour. Drafts the guard flags, and the canned fallback line, are **not** sent; the thread stays pending for the host. Meta webhook and web chat run the AI step after responding (`runAfterResponse`, §7).
- Org-editable AI limits in `ai-platform-settings` are capped at the platform defaults.

## 6. Observability

Every call writes one `ai_platform_usage_events` row (success or failure) with `prompt_id`, `prompt_version`, `latency_ms`, `status`, `error_code`, `request_id`, `cache_hit`, `fallback_used`, plus a structured `ai-gateway` log line with the same fields. No prompt or response bodies are logged; receipt/ID logs show the verdict only. Super-admin **AI usage** shows a **Feature health** table (calls, error rate, fallback rate, p50/p95 latency per feature).

## 7. Privacy and retention

| Feature                                     | Sent to the provider                                                                     | Minimization                                                   |
| ------------------------------------------- | ---------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| Receipt / valid-ID check                    | Uploaded image                                                                           | Verdict + amount/date stored; no model output logged           |
| Booking AI review                           | Guest IDs, pet docs, pricing fields for one booking                                      | Scoped to the booking being reviewed                           |
| Inbox suggest / auto-reply                  | Last 12 messages (each clipped to 1,000 chars), participant display name, property facts | Other guests' names used only by the local guard, never sent   |
| Dashboard assistant                         | Host message, attachments, tool results for the host's own scope                         | Tool results size-capped; `tool_calls` redacted before storage |
| Import column mapping                       | CSV headers + a few sample values                                                        | Emails and 7+ digit numbers masked                             |
| Analytics review / smart pricing            | Aggregated metrics                                                                       | No guest-level rows                                            |
| Marketing (caption, template, image, video) | Property listing content                                                                 | No guest data                                                  |
| Voice polish / receptionist                 | Transcript / live audio                                                                  | Session-scoped                                                 |

`run_ai_data_retention()` (SECURITY DEFINER, service role only) runs nightly via `pg_cron` job `ai-data-retention-nightly` (`41 3 * * *`, hosted only): purges expired `ai_platform_response_cache` rows, clears assistant `tool_calls` older than 30 days, and deletes resolved pending actions older than 30 days.

**Env switches:** `AI_RESPONSE_CACHE_DISABLED=1` bypasses the response cache (used by live evals). `EDGE_INLINE_BACKGROUND_TASKS=1` runs `runAfterResponse` work inline (local dev, where `EdgeRuntime.waitUntil` is unavailable or you want deterministic logs).

## 8. Evals

| Tier    | Command                                                                                 | What it covers                                                                                                                                                                                                                               |
| ------- | --------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Offline | `bun run test:edge:handlers` (CI)                                                       | `tests/evals/aiEvalsOffline.test.ts`: prompt builders, zod contracts, guards, injection red-team strings, tool-arg validation, registry sync. Deterministic, no network.                                                                     |
| Live    | `bun run eval:ai [-- --suite inbox\|import\|assistant\|documents] [-- --threshold 0.9]` | `tests/evals/runLiveEvals.ts` runs the golden JSONL datasets against real models with production prompt builders. Gates: inbox 85%, import 90%, assistant 80%, documents 75%. Exits 1 on a miss. Manual / nightly on dev, never CI-blocking. |

- Datasets: `supabase/functions/tests/evals/datasets/*.jsonl`. Synthetic OCR corpus: `tests/evals/fixtures/ocr/` (regenerate with `generateSyntheticDocuments.ts`; all fabricated data). The specimen-marked ID must be rejected.
- Reports land in `tmp/ai-evals/report-<timestamp>.json` (gitignored) with pass rate and p50/p95 latency per suite. Compare runs by prompt version.
- Live evals need `GEMINI_API_KEY(S)` (and optionally `GROQ_API_KEY`) in the environment or `supabase/.env.local`. They bill no org and write nothing to the database, but they do spend provider tokens.
- Baseline (2026-09-24, dev keys): inbox 8/8, import 3/3, assistant 6/6, documents 4/4.

**When you change a prompt:** bump its `version`, run `bun run eval:ai -- --suite <feature>`, and add a dataset row for any bug you fixed.

## 9. Deliberate decisions

- **No vector DB.** Knowledge search is Postgres FTS (`search_ai_assistant_knowledge_base`: all-terms, then any-term, then escaped ILIKE, top 10). Revisit pgvector only if the KB outgrows a few hundred entries or evals show poor recall.
- **No token streaming of the final assistant answer.** The answer passes the grounding check and the safety guard before the host sees it, and either can replace it; streaming raw tokens would show unvalidated text. Turns stream live phase / plan / tool events instead, and Stop aborts the in-flight model request.
- **No per-page tool subsetting yet.** Tools enforce their own permissions and have no declarative permission map; a wrong subset would silently break cross-page requests. The static system-prompt prefix and tool declarations come first in every request, so Gemini implicit prefix caching applies. Explicit context caching is not worth its storage cost at current volume.
- **Atomic quota reserve/settle** is deferred to Phase 2 of `ai-paid-provider-and-production-quotas.md`. Overshoot is bounded by per-user rate limits and the platform cap.
- **Chat turn loop stays in the handler.** The prompt, schema, tool registry, guards, context budget and deferred writes are shared modules; the loop itself is bound to ~20 pieces of per-turn state and extracting it would add indirection without reuse.
