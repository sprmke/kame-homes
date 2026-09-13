---
stage: in-progress
title: 'AI image & video generation (Marketing Studio "Generate" tab)'
status: in-progress
tags:
  [
    planning,
    planned-modules,
    ai,
    marketing,
    gemini,
    veo,
    plans-and-permissions,
    audit-logging,
    storage,
  ]
updated: 2026-09-14
---

# AI Image & Video Generation — Marketing Studio "Generate" tab

## Implementation status

**Phase 1 (images) — shipped 2026-09-12.** Everything below is in the repo and passes `type-check` / `lint` / `build` / `test:edge` / `vitest`; the four migrations were verified against the real local schema inside a rolled-back transaction.

**Phase 2 (video) — code-complete 2026-09-13, not yet live-verified.** Veo 3.1 async job lifecycle, cron sweeper, permission leaf, plan key, and UI wiring are all in the repo and pass `type-check` / `lint` / `check:filenames` / `test:edge` / `test:edge:handlers` / `vitest`. The two new migrations were verified the same way as Phase 1 (applied + rolled back against the real local schema via `docker exec ... psql`, not the CLI, since `bun run db:migrate` remains blocked — see the still-open item below). **No real Veo API call has been made** — there is no way to exercise `:predictLongRunning` / operation polling / the sweeper without live Gemini keys and real cost, so the request/response envelope (verified against Google's current REST reference, ai.google.dev/gemini-api/docs/veo, 2026-09) and the whole finalize/CAS/billing chain are implemented and internally consistent but not proven against the live API.

| Piece                | What landed                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Migrations           | `20261316120300` cron wiring (1-minute pg_cron sweep) · `20261316120500` `aiMarketingVideoGeneration` plan key (pro/managed/business_plus)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| Shared modules       | `marketingVideoGenerationAi.ts` (`startMarketingVideoJob`, `pollAndFinalizeMarketingVideoJob` — single function used by both the poller and the sweeper so the double-finalize CAS guard lives in exactly one place) · `marketingGenerationSweeper.ts` (5 passes) · `marketingGenerationJobs.ts` gained the CAS/sweeper-query helpers (`markMarketingVideoJobProcessing`, `bumpMarketingVideoJobPoll`, `claimMarketingGenerationJobForFinalize`, `reclaimStaleFinalizingJobs`, `listMarketingVideoJobsDueForPoll`, `expireStaleMarketingGenerationJobs`, `listMarketingGenerationJobsNeedingBillingRepair`, reference-prune helpers) · `marketingGenerationStorage.ts` gained `fetchGeneratedVideoBytes` (the `x-goog-api-key` download, mirroring `marketingMusicStorage.ts`'s precedent) |
| Edge functions       | `generate-marketing-media` now branches on `mediaType` (video submits to `:predictLongRunning` and returns a `processing` row instead of the old 400) · `get-marketing-generation-job` re-polls Google inline behind the 10s floor · new `marketing-generation-sweeper` (cron, `X-Marketing-Generation-Cron-Secret`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| Plans / RBAC / audit | `aiMarketingVideoGeneration` (pro+) in both mirrors, gate copy, matrix row, tier-card bullet · new permission leaf `marketing.generate.video:add` (server allowlist + UI catalog + Operations/Full Access seeded templates, not Read Only) · `marketing.video_generation_started` + `marketing.video_generated` actions                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| UI                   | Composer: Image/Video → Prompt → Photos → Generate; Quality/Shape/Size (or video Shape/Resolution/Length) under collapsed **Advanced**. Plan-gated Video opens the upgrade modal instead of a permanent helper line; RBAC-blocked Video stays disabled. Gallery + `AiStudioVideoProgress` unchanged.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |

**Deviations from the plan as written (Phase 2)**

- Veo's request shape was **verified against the live docs** rather than assumed from the plan's illustrative JSON: the correct field for reference guidance is `instances[0].referenceImages` (array, up to 3, each `{ image: { inlineData }, referenceType: 'asset' }`), not a bare `instances[0].image`. `durationSeconds` is sent as a **string** in the request body (Google's own reference example quotes it), matching what's shown at ai.google.dev/gemini-api/docs/veo.
- The plan describes the finalize sequence as steps the "single winner" runs; implemented as one function (`pollAndFinalizeMarketingVideoJob`) called identically by both the poller and the sweeper, returning a `kind` enum (`still_processing` / `operation_failed` / `claimed_by_other` / `not_finalized` / `completed`) that each caller uses only to decide whether to activity-log — billing (`recordAiUsage`) happens inside the shared function itself since the job row already carries every field needed (org/property/model/duration/cost), so it doesn't need the caller's request/actor context.
- A download failure after winning the claim leaves the row at `finalizing` rather than immediately failing it — sweeper pass 1 reclaims it after 2 minutes and pass 2 retries, exactly as the plan's failure table specifies, rather than a shortcut immediate `failed`.
- No dedicated unit test for `marketingVideoGenerationAi.ts` itself (same precedent as Phase 1's `marketingImageGenerationAi.ts` — the actual provider-calling code isn't meaningfully unit-testable without live keys; the deterministic pricing/validation math it depends on already has full coverage).

**Playwright coverage added and two real bugs caught by it (2026-09-13):** `ui/e2e/features/marketing/marketingAiGenerate.spec.ts` gained 2 more `@ci` cases — Video toggle enabled + shows video options on Business+, and Video toggle disabled-with-reason + Image still works below Business (needed a new `videoPlanAllowed` opt on the shared property-team RBAC harness, plus `aiMarketingVideoGeneration` + `marketing.generate.video:add` added to that harness's fixtures — both were missing entirely, a gap from earlier in this session). Running the new tests live caught two real bugs before they shipped:

1. The harness's `videoPlanAllowed` option was defined but never threaded into the actual mocked API response — the override silently did nothing.
2. `AiStudioComposer`'s disabled-reason text only rendered when the Video tab was already active — but a _disabled_ tab can never become active by clicking, so the host had no way to ever see why Video was locked. Fixed to show the reason regardless of which tab is selected.

Both fixed and reverified; full marketing + team + plans `@ci` suite (28 tests) passes.

**Host-facing errors (2026-09-13).** Provider dumps (Gemini quota text, model ids, docs URLs) are never shown to hosts. `toHostFacingError` sanitizes `marketing_generation_jobs.error_message` and the Generate JSON `error` field; `installFriendlyToasts` intercepts every `toast.error` / `toast.warning` in the app. A quota dump becomes "This is busy right now. Try again in a moment."

## Hardening pass — 8-angle code review (2026-09-13)

Ran a full multi-angle review (correctness, efficiency, simplification, reuse, root-cause depth, removed-behavior, cross-file tracing, CLAUDE.md conventions) against every file this feature touches. Real, in-scope findings and their fixes:

| #   | Finding                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Fix                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Double-billing race, both media types.** `recordAiUsage` was called, then a separate `recordMarketingGenerationJobUsage` stamped `usage_recorded_at` — a crash (or a failed stamp write, which `recordMarketingGenerationJobUsage` swallows and only warns on) between the two left a `completed` row with `usage_recorded_at IS NULL`, which the sweeper's billing-repair pass would re-bill on its next tick. The plan's claim that billing is "at-least-once then deduped, never double" was **not actually true** as implemented. | New `claimMarketingGenerationJobBilling` — an atomic CAS on `usage_recorded_at` taken _before_ `recordAiUsage` runs, in all three call sites (image branch, video finalize, sweeper repair pass). `credits_consumed` (not `usage_recorded_at`) is now the real "billed successfully" signal; the repair pass re-claims a stale, still-unbilled claim rather than treating "claimed" as "billed." Migration `20261316120600` fixes the now-mismatched partial index. |
| 2   | Missing super-admin kill switch for video. `AiPlatformKillSwitchCard.tsx` had a toggle for `marketing_image_generate` but not `marketing_video_generate`, even though both are registered `AiFeature`s the quota gate checks — video had no per-feature off switch.                                                                                                                                                                                                                                                                     | Added the missing toggle row.                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| 3   | Wrong upgrade-feature attribution on a video quota 429. `generationFetch`/`handleGenerationError` hardcoded `aiMarketingImageGeneration`, so hitting the video sub-cap (which triggers far more easily — a clip is 7-50x an image's credits) opened the wrong upgrade modal.                                                                                                                                                                                                                                                            | `generationFetch` now takes a `feature` argument; `useGenerateMarketingMedia` passes the real one based on `mediaType`.                                                                                                                                                                                                                                                                                                                                             |
| 4   | Stuck-job detection could never fire for video. `isStuckMarketingGeneration` compared against `updatedAt`, but `bumpMarketingVideoJobPoll` touches that same column on every ~10s poll tick — so a job that's alive but never truly progressing would never look "stuck," and the 8-minute client-side backoff was dead code for that failure mode.                                                                                                                                                                                     | Switched to `createdAt` (total time alive) — the actually-correct signal, independent of routine polling touches.                                                                                                                                                                                                                                                                                                                                                   |
| 5   | `readMonthCreditsForFeature` used PostgREST `.sum()` — fails everywhere aggregates are off (default local + hosted: "Use of aggregate functions is not allowed"), so Generate crashed the budget gate.                                                                                                                                                                                                                                                                                                                                  | Fetch `credits_consumed` and reduce in JS (same pattern as `sumMonthCreditsConsumed`), paginated past `max_rows` so a busy org cannot undercount the feature sub-cap. Index `idx_ai_platform_usage_events_org_feature_created` still backs the filter.                                                                                                                                                                                                              |
| 6   | `assertMarketingGenerationBudget` re-derived "org credits consumed this month" with its own query, duplicating (and risking drift from) `aiUsageService.ts`'s own `sumMonthCreditsConsumed`, and ran 5 reads sequentially.                                                                                                                                                                                                                                                                                                              | Exported and reused `sumMonthCreditsConsumed`; batched all 5 independent reads into one `Promise.all`.                                                                                                                                                                                                                                                                                                                                                              |
| 7   | `loadReferenceInlineData` downloaded up to 14 reference images one at a time.                                                                                                                                                                                                                                                                                                                                                                                                                                                           | `Promise.all` — concurrent downloads.                                                                                                                                                                                                                                                                                                                                                                                                                               |
| 8   | `touchGenerationReferences` + `logAssetActivity` awaited sequentially in both branches, despite being independent.                                                                                                                                                                                                                                                                                                                                                                                                                      | `Promise.all` in both.                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| 9   | `MARKETING_GENERATION_REFERENCES_QUERY_KEY` was exported but never imported — the delete-reference hook hardcoded the same string literal instead, a silent-drift landmine.                                                                                                                                                                                                                                                                                                                                                             | Hook now imports and uses the constant.                                                                                                                                                                                                                                                                                                                                                                                                                             |

**Findings surfaced but deliberately not touched** (real, but outside this feature's files — unrelated pre-existing/concurrent work sitting in the same uncommitted working tree): a double-auth-check inefficiency in `AdminListViewMenu.tsx`, a disabled-action-filtering bug in `ResponsiveOverflowMenu.tsx`, an invisible-Turnstile-challenge layout bug, a removed host-access gate in `GuestAccountMenu.tsx`, and three components that hand-roll a responsive menu pattern instead of the shared primitive. None are in files this feature created or modified.

**Findings considered and accepted as-is:** the client/server pricing-table duplication (self-documented, parity-tested, matches this repo's existing hand-synced-twin convention e.g. PDF templates); the separate marketing-only budget ledger instead of extending `aiUsageService.ts` into a general reservation-aware quota primitive (a bigger, riskier refactor of a load-bearing shared file, out of proportion to this review); the stuck-job-polling pattern duplicated from `bookingAiReviewProgress.ts` rather than extracted into a shared hook (touching the already-shipped booking review feature isn't worth the risk here); `marketing.generate.video:add` seeded onto the "Operations" template by default (a real cost-bearing permission, but Operations is this repo's closest analog to "Manager" and already holds `marketing.generate:add`).

Full `bun run ci:quality` and the marketing + team + plans `@ci` Playwright suite (28 tests) re-verified green after every fix in this pass.

**Not done / still open**

- **Migration collision, still blocking, still not mine to fix.** Two already-committed migration files share version `20261231140100` (`org_team_template_role_ids` vs `platform_host_settings_rls_fix`), unrelated to this feature. `bun run db:migrate` fails on it before reaching any of this work's 6 migrations. Every SQL file in both phases has been verified correct via a manual rolled-back transaction against the real local schema instead — but no `functions serve` + real click-through has happened, and can't until this clears. This needs your call (rename one file, or tell me it's handled elsewhere) since it touches two shipped migrations neither of which I wrote.
- **Zero live Veo calls.** Submitting a real job, watching the operation poll, and confirming the sweeper actually finalizes a closed-tab job all require a funded Gemini key and real minutes of wait — not exercised.
- Phase 3 (hardening: admin sub-cap surface, reference-library drawer, retry-with-same-settings, allowance revisit) not started.

| Piece                | What landed                                                                                                                                                                                                                                                                                                |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Migrations           | `20261316120000` jobs · `20261316120100` references · `20261316120200` usage-event feature index · `20261316120400` plan key + allowance bumps (incl. `business_plus` 20,000 → **50,000**, a judgment call)                                                                                                |
| Router               | `marketing_image_generate` + `marketing_video_generate` in `AI_FEATURES`; `MARKETING_IMAGE_MODELS` / `MARKETING_VIDEO_MODELS`, `geminiPredictLongRunningUrl`, `geminiOperationUrl`, `estimateVideoCostUsd`                                                                                                 |
| Edge functions       | `generate-marketing-media` (image branch, inline) · `get-marketing-generation-job` · `marketing-generations` · `upload-marketing-generation-reference`                                                                                                                                                     |
| Shared modules       | `marketingGenerationPricing.ts` (+ `_test.ts`, 8 tests) · `marketingImageGenerationAi.ts` · `marketingGenerationStorage.ts` · `marketingGenerationBudget.ts` · `marketingGenerationJobs.ts`                                                                                                                |
| UI                   | 4th **Generate** tab + `components/ai-studio/` (8 components) · 5 hooks · 4 lib modules · client price mirror with a parity test that re-derives the tables from the edge source                                                                                                                           |
| Plans / RBAC / audit | `aiMarketingImageGeneration` (growth+) in both mirrors, gate copy, matrix row, tier-card bullet, `TierBadge` on the tab · RBAC reuses `marketing.generate:add` · `marketing.image_generated` + `…generated_asset_deleted`                                                                                  |
| Docs                 | Route guide §Generate tab · `edge-functions.md` · `data-model.md` · `storage.md` · `plans-feature-matrix.md` · `validation-and-env.md` · `PROJECT.md` · migration runbook §11d                                                                                                                             |
| Tests                | Deno unit (`marketingGenerationPricing_test.ts`, 8 cases) + Vitest client/edge price-table parity (3 cases) + Playwright `@ci` journey (`marketingAiGenerate.spec.ts`, 2 cases: composer usable on Pro+, composer gated but gallery/Download stay visible below Pro) — all pass under `bun run ci:quality` |

**Deviations from the plan as written**

- `recordAiUsage` now also returns `usageEventId` (additive) so the job row's `usage_event_id` is populated. No behavior change for existing callers.
- The pure pricing/validation module is named `marketingGenerationPricing.ts` rather than `marketingGenerationModels.ts`, to match the test file name the plan specified and the client mirror.
- The gallery cursor is a **full keyset** on `(created_at, id)` (`"<created_at>|<id>"`), not `created_at` alone — the concurrency cap allows two jobs in flight per property, and a `created_at`-only cursor can skip a tie.
- `generationFetch` (client) branches on 429: `upgradeHook` → AI-quota toast, otherwise a plain retryable toast. `parseEdgeJsonOrQuota` treats every 429 as a quota error, which would have mislabeled the rate limit and the concurrency cap as "upgrade your plan".
- Premium image tier exists server-side but is **not** offered in the composer (3x the cost, no meaningful gain for social posts).
- The plan's `<RequirePropertyFeature feature="aiMarketingImageGeneration">` wrapper around the whole tab was **not** used — it would have hidden the gallery from a downgraded org, contradicting the view-past-output rule the same plan specifies. The composer gates inline instead; the gallery and poller stay open.

**Testing infra note (2026-09-12):** a formal Vitest/Deno/Playwright pyramid landed in the repo after Phase 1 shipped (`08552146 sync cursor claude testing rules agents and skills`). Brought Phase 1 into line with it: added `aiMarketingImageGeneration` to the two E2E plan-feature fixtures that were missing it (`ui/e2e/features/plans/shared/orgPlanHarnessShared.ts`, `ui/e2e/features/team/shared/propertyTeamRbacHarness.ts`, which also gained mock cases for the four new edge functions), and added the Generate-tab Playwright journey. Ran the full `bun run ci:quality` gate (type-check, lint, filenames, Vitest, Deno `_shared` + handler tests, `servePublic` rate-limit scan, Playwright `@smoke`, build, lazy-optimizer assertion) — all green, including the pre-existing `marketingStudioSmoke.spec.ts`.

**Phase 1 leftover notes (superseded by the status block at the top)**

- Live E2E is still outstanding. `bun run db:migrate` is blocked by **pre-existing** local drift: two migration files share version `20261231140100` (`org_team_template_role_ids` is recorded, `platform_host_settings_rls_fix` can never be). Unrelated to this work, needs `/fix-migration-issues`. Until it clears, the 9 local scenarios in §10 have not run against a migrated local stack.
- ~~`bun run test:edge` has a pre-existing failure...~~ **Resolved upstream** — the script now passes `--allow-read`; `bun run test:edge` is 240/240 green.
- Phase 2 video later landed 2026-09-13 (code-complete, not live-verified). Phase 3 hardening is still open.

---

## Context

Marketing Studio today has three surfaces, and all three generate **structure**: the calendar builds a styled availability grid, the design editor builds Polotno/Konva canvas layers, the video editor builds a Remotion `VideoProject` timeline. AI is used only to produce _tokens_ that those editors compile. Every pixel is rendered client-side from a template a host has to configure.

What's missing is the thing hosts actually expect from an AI tool in 2026: upload a few photos of the unit, type "sunset shot of the balcony, warm golden hour, cinematic", and get back a finished image or a short reel. No template, no canvas, no timeline. That capability has no home in the current architecture, and it deliberately should not be bolted onto one of the existing editors — it shares none of their data model.

This plan adds a fourth Marketing Studio tab, **Generate**, that does exactly that, and wires it end to end through the existing plan entitlements, AI quota/credit governance, RBAC, and audit logging so there are no gaps. It ships in two phases: **images first** (synchronous, near-zero new infrastructure), **video second** (async, needs a job lifecycle).

### Decisions already made

| Question               | Decision                                                                                                                                    |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Video tier & packaging | **Veo 3.1 Fast** default + raise `aiMonthlyCreditAllowance`: growth 1,000 → **5,000**, pro 10,000 → **25,000**, managed 30,000 → **60,000** |
| Sequencing             | **Phase 1 images, Phase 2 video.** Job table and async lifecycle designed up front so phase 2 is additive                                   |
| Placement & gating     | **4th Studio tab**, new plan keys, new permission leaf. Images on growth+, video on pro+                                                    |
| Provider               | Left to this plan — see below                                                                                                               |

---

## 1. Provider strategy

**Stay on `generativelanguage.googleapis.com/v1beta`: Gemini image models for images, Veo 3.1 for video. Build a thin seam so a second provider is a one-file swap, but do not build a provider registry now.**

This is the cost-effective _and_ the maintainable choice, and it still produces best-in-class output:

- **Zero new vendor surface.** `_shared/aiGeminiKeys.ts` (`getGeminiApiKeys()`, `shouldTryNextProvider(status)`, `nextGeminiKeyStartIndex`) works unchanged for `:generateContent` and `:predictLongRunning`. No new secret, no new billing relationship, no webhook receiver, no signature verifier.
- **Images meter themselves.** Gemini image models bill in **tokens** ($0.50/1M in, $60/1M out for `gemini-3.1-flash-image`). The existing pipeline — `extractGeminiUsage` → `estimateTokenCostUsd` → `recordAiUsage` — works verbatim.
- **Video meters itself too.** Verified in `_shared/aiUsageService.ts`: `recordAiUsage` derives `const costBasis = typeof input.durationSeconds === 'number' ? 'duration' : 'tokens'`, and the `ai_platform_usage_events_cost_basis_check` constraint already allows `'duration'` (added in `20261022140000_ai_credit_foundation.sql` for `voice_receptionist`). **Passing `durationSeconds` is all that's needed — no change to `recordAiUsage` and no migration on that constraint.**
- **Quality.** `gemini-3.1-flash-image` (Nano Banana 2) is current state of the art for reference-image-conditioned generation, and Veo 3.1 generates **native audio** — which matters a lot for reels and which most cheaper video models do not do.

**Alternatives considered and rejected:**

- **Self-hosting (ComfyUI + SDXL/Flux/Wan).** Break-even against a managed API is roughly **70,000 generations/month**, plus 8–24GB VRAM GPUs and a serving stack to operate. This app will do hundreds. Wrong at this scale, and it adds an entire ops surface.
- **fal.ai / Replicate.** fal.ai is genuinely cheaper (Seedream V4 ~$0.03/image vs $0.045; Wan 2.5 ~$0.05/s vs Veo Fast's $0.10/s) and has native webhooks that would remove the polling problem. But it costs a new vendor, new secrets, and new billing to save ~$0.015/image, for a feature with zero users today. **Keep it as a documented escape hatch**, not day-one work.

**The seam that makes that escape hatch cheap:** all model IDs and prices live in `_shared/aiModelRouter.ts`, and each media type has exactly one generation module (`marketingImageGenerationAi.ts`, `marketingVideoGenerationAi.ts`) exporting 2–3 functions. Swapping video to fal.ai later means rewriting one module and one price table — no caller, no UI, no schema change. Do not abstract further than that.

**API shape:** use the classic `models/{model}:generateContent` for images, **not** the newer `/v1beta/interactions`. `geminiGenerateContentUrl(model)` already builds that URL and `extractGeminiUsage` already parses `usageMetadata` from that envelope; `/interactions` would need a parallel usage extractor for no benefit. Video needs two new URL builders since `:predictLongRunning` has no existing helper.

### Tiers exposed

| UI tier                | Image model                                          | Video model                                        | 8s/720p credits |
| ---------------------- | ---------------------------------------------------- | -------------------------------------------------- | --------------- |
| Draft                  | `gemini-3.1-flash-lite-image` (1K only, ≤14 refs)    | `veo-3.1-lite-generate-preview`                    | 400             |
| **Standard (default)** | `gemini-3.1-flash-image` (10 obj + 4 char + 3 style) | **`veo-3.1-fast-generate-preview`**                | **800**         |
| Premium                | `gemini-3-pro-image` (6 obj + 5 char)                | `veo-3.1-generate-preview` — **not exposed in v1** | 3,200           |

`gemini-2.5-flash-image` is not wired at all (sunsets 2026-10-02).

Premium video is reachable only via a super-admin per-property escape hatch (`ai_platform_property_settings.feature_configs.marketing_video_generate.allow_premium_tier`), for managed accounts where we are knowingly absorbing $3.20/clip.

---

## 2. Data model

All migrations sort after the current latest, `20261315120200_activity_log_retention_cron.sql`.

### `20261316120000_marketing_generation_jobs.sql`

One row per generation request. v1 produces exactly one output per request (Veo caps at 1; we cap images at 1 for cost predictability), so the output lives inline on the job row. If N-up image grids are added later, add a child table and keep this as the header — do not design for it now.

```sql
CREATE TABLE IF NOT EXISTS public.marketing_generation_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  property_id     UUID NOT NULL REFERENCES public.properties (id) ON DELETE CASCADE,

  media_type TEXT NOT NULL,
  CONSTRAINT marketing_generation_jobs_media_type_check
    CHECK (media_type IN ('image','video')),

  job_status TEXT NOT NULL DEFAULT 'pending',
  CONSTRAINT marketing_generation_jobs_job_status_check
    CHECK (job_status IN ('pending','processing','finalizing','completed','failed','cancelled')),

  prompt TEXT NOT NULL,
  CONSTRAINT marketing_generation_jobs_prompt_len_check
    CHECK (char_length(prompt) BETWEEN 1 AND 2000),
  negative_prompt TEXT,

  model        TEXT NOT NULL,
  quality_tier TEXT NOT NULL DEFAULT 'standard',
  CONSTRAINT marketing_generation_jobs_quality_tier_check
    CHECK (quality_tier IN ('draft','standard','premium')),
  aspect_ratio TEXT NOT NULL DEFAULT '1:1',
  image_size   TEXT,   -- image only: '512px'|'1K'|'2K'|'4K'
  resolution   TEXT,   -- video only: '720p'|'1080p'
  duration_seconds INT,
  CONSTRAINT marketing_generation_jobs_duration_check
    CHECK (duration_seconds IS NULL OR duration_seconds IN (6,8)),

  reference_paths TEXT[] NOT NULL DEFAULT '{}',
  reference_urls  TEXT[] NOT NULL DEFAULT '{}',

  provider                TEXT NOT NULL DEFAULT 'gemini',
  provider_operation_name TEXT,
  provider_poll_count     INT NOT NULL DEFAULT 0,
  last_provider_poll_at   TIMESTAMPTZ,

  finalize_claim_token UUID,
  finalize_claimed_at  TIMESTAMPTZ,

  output_storage_path TEXT,
  output_url          TEXT,
  output_mime_type    TEXT,
  output_bytes        BIGINT,
  output_width        INT,
  output_height       INT,

  estimated_credits  INT NOT NULL DEFAULT 0,
  credits_consumed   INT,
  estimated_cost_usd NUMERIC(12,6),
  usage_event_id     UUID,
  usage_recorded_at  TIMESTAMPTZ,

  error_code    TEXT,
  error_message TEXT,

  expires_at   TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  triggered_by UUID REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

Three column choices worth calling out:

- **`duration_seconds` excludes 4.** Meta Reels requires 5–90 seconds. A 4s Veo clip is unpublishable to the exact surface this feature exists to serve, so removing the option removes the whole bug class.
- **`'finalizing'` is in the CHECK from phase 1** even though only video uses it, to avoid an `ALTER ... DROP CONSTRAINT` in phase 2.
- **`estimated_credits` vs `credits_consumed`.** The first is the gate-time reservation (a table constant, used for in-flight accounting); the second is the actual post-call charge from `recordAiUsage`. They differ for images (real token counts) and match for video (per-second price is deterministic).

Indexes:

```sql
CREATE UNIQUE INDEX IF NOT EXISTS uq_mgj_provider_operation
  ON public.marketing_generation_jobs (provider_operation_name)
  WHERE provider_operation_name IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_mgj_property_created
  ON public.marketing_generation_jobs (property_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mgj_org_created
  ON public.marketing_generation_jobs (organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mgj_sweeper
  ON public.marketing_generation_jobs (expires_at)
  WHERE job_status IN ('pending','processing','finalizing');
CREATE INDEX IF NOT EXISTS idx_mgj_inflight
  ON public.marketing_generation_jobs (organization_id, property_id)
  WHERE job_status IN ('pending','processing','finalizing');
CREATE INDEX IF NOT EXISTS idx_mgj_billing_repair
  ON public.marketing_generation_jobs (completed_at)
  WHERE job_status = 'completed' AND usage_recorded_at IS NULL;
```

Then mirror `20261011120001_booking_ai_reviews.sql` exactly: `COMMENT ON TABLE` + `COMMENT ON COLUMN` for `job_status` / `finalize_claim_token` / `estimated_credits` / `provider_operation_name` / `expires_at`; `DROP TRIGGER IF EXISTS` then `CREATE TRIGGER update_marketing_generation_jobs_updated_at BEFORE UPDATE ... EXECUTE FUNCTION update_updated_at_column()` (pre-existing global function — reference, don't redefine); `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` with **no policies** (service-role-only, same as `booking_ai_reviews`); `GRANT ALL ... TO service_role`.

### `20261316120100_marketing_generation_references.sql`

A reference **library**, not per-job blobs — uploading the property hero shot once and reusing it across 20 prompts is the core UX of this kind of tool.

```sql
CREATE TABLE IF NOT EXISTS public.marketing_generation_references (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  property_id     UUID NOT NULL REFERENCES public.properties (id) ON DELETE CASCADE,
  media_type TEXT NOT NULL,
  CONSTRAINT marketing_generation_references_media_type_check
    CHECK (media_type IN ('image','video')),
  storage_path TEXT NOT NULL UNIQUE,
  public_url   TEXT NOT NULL,
  mime_type    TEXT NOT NULL,
  file_name    TEXT,
  byte_size    BIGINT NOT NULL,
  width INT, height INT, duration_seconds NUMERIC(6,2),
  uploaded_by  UUID REFERENCES auth.users (id) ON DELETE SET NULL,
  last_used_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_mgr_property_created
  ON public.marketing_generation_references (property_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mgr_prune
  ON public.marketing_generation_references (COALESCE(last_used_at, created_at));
```

Same comments / trigger / RLS / grant block.

### `20261316120200_ai_platform_usage_events_feature_index.sql`

```sql
CREATE INDEX IF NOT EXISTS idx_ai_platform_usage_events_org_feature_created
  ON public.ai_platform_usage_events (organization_id, feature, created_at DESC);
```

Needed by the per-feature monthly sub-cap query (§5). Its own file so it can be applied independently.

### `20261316120300_marketing_generation_cron.sql` _(phase 2)_

`sync_marketing_generation_cron_job()`, structure lifted verbatim from `20261311120000_analytics_ai_review_cron.sql`: `SECURITY DEFINER SET search_path = public, cron, vault, pg_temp`; `IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname='pg_cron') THEN RETURN jsonb_build_object('ok', false, ...)`; unschedule-then-`cron.schedule('marketing-generation-sweeper', '* * * * *', ...)`; `net.http_post` to `<project_url>/functions/v1/marketing-generation-sweeper` with `Authorization: Bearer <anon_key>` and `X-Marketing-Generation-Cron-Secret: <marketing_generation_cron_secret>`, all three from `vault.decrypted_secrets`; `EXCEPTION WHEN OTHERS`; `REVOKE ALL ON FUNCTION ... FROM PUBLIC` + `GRANT EXECUTE ... TO service_role`; self-invoked at the bottom. **No `schedule` key in `config.toml`** — hosted pg_cron only.

### `20261316120400_marketing_generation_plan_features.sql`

Sets the new plan booleans per tier and bumps `aiMonthlyCreditAllowance` (§5), following `20261315120100_activity_log_plan_feature.sql`.

### No storage changes

`property-media` is already public, 50MB, `image/*` + `video/*` + `audio/*`. An 8s 720p Veo MP4 lands ~3–6MB; 50MB reference videos already match `UPLOAD_MAX_BYTES.video`. **No bucket migration and no `config.toml` change.** Two new prefixes only:

- `marketing-ai-refs/{propertyId}/{uuid}.{ext}` — uploaded references, pruned 90 days after `COALESCE(last_used_at, created_at)`.
- `marketing-ai/{propertyId}/{jobId}.{ext}` — generated outputs, **never auto-pruned** (they are host assets that may be live on Meta; pruning would violate the view-past-output rule).

---

## 3. Edge functions

Five new functions, all `verify_jwt = false` in `config.toml` (Kong's HS256 rejects ES256; the handler check is the real gate).

### A. `upload-marketing-generation-reference`

`POST` multipart / `DELETE` json — dual-method shape mirroring `upload-property-media/index.ts`.

- **Gate:** `resolveScopedPropertyAccess(req, 'marketing.generate:add')` → `requirePropertyPermissionAndFeature(req, propertyId, 'marketing.generate:add', 'aiMarketingImageGeneration')` → `rateLimitGate(req, { scope:'marketing-gen-ref', identity: user.id, limit: 30, windowSec: 300 })`.
- **Validation:** declared mime must start `image/` or `video/`; enforce `UPLOAD_MAX_BYTES` (10MB image / 50MB video) from `_shared/uploadLimits.ts`; magic-byte sniff via new `sniffVisualMime(bytes)` in `_shared/marketingGenerationStorage.ts` (same structure as `sniffAudioMime` in `marketingMusicStorage.ts`) and reject when sniffed family ≠ declared. Images additionally go through `validateImageUpload` from `_shared/storageUpload.ts`.
- **Write:** `uploadPublicStorageObject` → `property-media` at `marketing-ai-refs/{propertyId}/{uuid}.{ext}`, then insert the reference row.
- **DELETE** `{ referenceId }` → verify `property_id` match → `storage.remove` → delete row.

### B. `generate-marketing-media`

`POST` json. Request:

```ts
{
  mediaType: 'image' | 'video';
  prompt: string;                  // <=1000 chars image, <=800 chars video (Veo 1024-token cap)
  negativePrompt?: string;
  qualityTier?: 'draft' | 'standard' | 'premium';   // default 'standard'
  aspectRatio?: string;            // image: 1:1|3:2|2:3|3:4|4:3|4:5|5:4|9:16|16:9|21:9
                                   // video: 16:9|9:16 only
  imageSize?: '512px' | '1K' | '2K' | '4K';         // image only; draft => '1K' only
  resolution?: '720p' | '1080p';   // video only, default '720p'
  durationSeconds?: 6 | 8;         // video only, default 8
  referenceIds?: string[];
}
```

**Gate order** — copied from `generate-marketing-template/index.ts`, extended:

1. `resolveScopedPropertyAccess(req, 'marketing.generate:add')`
2. `requirePropertyPermissionAndFeature(req, propertyId, mediaType === 'video' ? 'marketing.generate.video:add' : 'marketing.generate:add', mediaType === 'video' ? 'aiMarketingVideoGeneration' : 'aiMarketingImageGeneration')`
3. `rateLimitGate` — image 20/5min, video 5/5min, keyed on `user.id`
4. Validate options against the resolved model config (reference-count caps, allowed aspect ratios/sizes). Resolve `referenceIds` → rows, assert every row's `property_id` matches.
5. `assertOrgAndPropertyAiQuota(organizationId, propertyId, feature)` — feature is `'marketing_image_generate'` or `'marketing_video_generate'`
6. **New:** `assertMarketingGenerationBudget({ organizationId, propertyId, feature, estimatedCredits })` — §5
7. Insert job row (`pending`, `estimated_credits`, `expires_at = NOW() + interval '45 minutes'` for video)
8. Branch:
   - **image → inline.** `generateMarketingImage()` — images complete in 5–15s, comfortably inside the edge timeout, and this is the repo's canonical pattern (`generate-marketing-template` runs inline). On success: upload → `recordAiUsage({ feature, provider:'gemini', model, inputTokens, outputTokens, estimatedCostUsd, propertyId, organizationId, actorUserId, actorType:'staff' })` → update row `completed` with `credits_consumed`/`usage_recorded_at` → `logAssetActivity('marketing.image_generated')` → return the completed row in **one round trip**.
   - **video → async.** `startMarketingVideoJob()` posts to `:predictLongRunning`, stores `provider_operation_name`, flips to `processing`, logs `marketing.video_generation_started`, returns immediately.
9. **Error mapping**, identical to `generate-marketing-template`: `isAiQuotaError` → 429 `{ upgradeHook: true }`; `isAiPlatformDisabledError` / `isAiFeatureDisabledError` → 503; `catchPlanFeatureError(req, err)` for `PlanFeatureRequiredError`.

Response is `{ success: true, data: { job: MarketingGenerationJobDto } }` for **both** branches, so the client always just hands the row to the poller.

### C. `get-marketing-generation-job`

`GET ?jobId=` — the hot poller, mirroring `get-booking-ai-review`.

- **Gate:** `resolveScopedPropertyAccess(req, 'marketing:view')` + `requirePropertyPermissionAndFeature(req, propertyId, 'marketing:view')` — **deliberately no plan-feature argument.** This is the view-past-output path: a downgraded org must still watch an in-flight job finish and read past results.
- If `media_type='video' AND job_status='processing' AND provider_operation_name IS NOT NULL AND (last_provider_poll_at IS NULL OR last_provider_poll_at < NOW() - interval '10 seconds')` → `pollAndFinalizeMarketingVideoJob(job)`, then re-read. The 10s server-side floor honors Google's recommended minimum poll interval while letting the client poll _us_ every 3s for a responsive UI.

### D. `marketing-generations`

`GET` (list, gate `marketing:view`, keyset pagination on `created_at DESC, id DESC`, limit capped 50, `?mediaType=&limit=&cursor=`) / `DELETE` (gate `marketing.generate:add`, `{ jobId }` → verify property → `storage.remove` → delete row → `logAssetActivity('marketing.generated_asset_deleted')`).

### E. `marketing-generation-sweeper` _(phase 2)_

`serveCronPost('marketing-generation-sweeper', verifySecret, run)`, header `X-Marketing-Generation-Cron-Secret`, env `MARKETING_GENERATION_CRON_SECRET`. Five passes:

1. **Reclaim stale claims** — `finalizing` older than 2 min → CAS back to `processing`, null the token.
2. **Finalize** — up to 25 `processing` jobs with an operation name and `last_provider_poll_at` older than 10s. _This is the pass that makes the feature correct when the user closes the tab._
3. **Expire** — in-flight past `expires_at` → `failed`, `error_code='timeout'`, no charge.
4. **Billing repair** — `completed AND usage_recorded_at IS NULL AND completed_at < NOW() - interval '5 minutes'` → `recordAiUsage`, stamp. Covers a crash between the completion CAS and the usage write.
5. **Reference prune** — 50 rows older than 90 days by `COALESCE(last_used_at, created_at)`.

Returns `{ ok: true, reclaimed, finalized, expired, repaired, pruned }`.

### New `_shared` modules

| File                            | Exports                                                                                                                                                 |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `marketingGenerationModels.ts`  | `assertValidImageOptions`, `assertValidVideoOptions`, per-model reference caps                                                                          |
| `marketingImageGenerationAi.ts` | `generateMarketingImage(...)` → `{ bytes, mimeType, width, height, inputTokens, outputTokens, model }`                                                  |
| `marketingVideoGenerationAi.ts` | `startMarketingVideoJob(job)`, `pollAndFinalizeMarketingVideoJob(job)`                                                                                  |
| `marketingGenerationStorage.ts` | `sniffVisualMime`, `extensionForVisualMime`, `marketingGenerationStoragePath`, `uploadGeneratedMarketingAsset`, `fetchGeneratedVideoBytes(uri, apiKey)` |
| `marketingGenerationBudget.ts`  | `estimateGenerationCredits`, `assertMarketingGenerationBudget`, concurrency constants                                                                   |
| `marketingGenerationJobs.ts`    | DB CRUD + `claimJobForFinalize`, `completeClaimedJob`, `failJob`, `toMarketingGenerationJobDto`                                                         |

Both AI modules wrap their request in the existing key-rotation loop: iterate `getGeminiApiKeys()` from `nextGeminiKeyStartIndex`, advance on `shouldTryNextProvider(res.status)`.

### Changes to `_shared/aiModelRouter.ts`

```ts
export const AI_FEATURES = [ ..., 'marketing_image_generate', 'marketing_video_generate' ] as const;

export type AiImageModelConfig = AiModelConfig & {
  maxReferenceImages: number;
  allowedSizes: readonly string[];
};
export type AiVideoModelConfig = {
  model: string;
  usdPerSecondByResolution: Record<'720p' | '1080p', number>;
  maxReferenceImages: number;
  allowedDurations: readonly number[];
  allowedAspectRatios: readonly string[];
};

export const MARKETING_IMAGE_MODELS: Record<'draft'|'standard'|'premium', AiImageModelConfig>;
export const MARKETING_VIDEO_MODELS: Record<'draft'|'standard'|'premium', AiVideoModelConfig>;

export function geminiPredictLongRunningUrl(model: string): string; // `${BASE}/models/${model}:predictLongRunning`
export function geminiOperationUrl(operationName: string): string;  // `${BASE}/${operationName}`
export function estimateVideoCostUsd(config, resolution, durationSeconds): number;
```

Also add two `FEATURE_MODELS` entries for the new keys (pointing at the standard-tier models) so `getModelConfig()` never throws. Callers always pass an explicit `estimatedCostUsd` to `recordAiUsage`, so those entries never drive real billing.

**Veo per-second prices live in `MARKETING_VIDEO_MODELS` (code), not `ai_platform_global_settings`.** Voice got a `voice_receptionist_cost_per_minute_usd` column because there is exactly one scalar; Veo has 3 tiers × 2 resolutions = 6 prices, which a scalar column cannot express. These are model facts of the same kind as `inputUsdPer1M`, which already lives in the router.

---

## 4. Async lifecycle (phase 2)

### Why client-poll + cron sweeper, and not `EdgeRuntime.waitUntil`

`booking-ai-review` runs inline precisely because local `supabase functions serve` exposes `waitUntil` but **drops background work after the response**, leaving rows stuck at `processing`. That constraint still holds, and inline cannot hold Veo's 11s–6min window either. So:

- **Client poll is the primary driver** — identical behavior local and hosted, no background-runtime dependency, sub-second UI feedback.
- **The cron sweeper is not optional.** Google retains generated videos for only **2 days**, so a user who closes the tab would otherwise lose an already-paid-for render. Running every minute puts the worst-case gap between Google's `done` and our download at ≤60s — three orders of magnitude inside the retention window.
- Locally the sweeper is invoked by hand with `curl`, which doubles as the test harness for the closed-tab path.

### Happy path

```
POST generate-marketing-media
  gates → insert job(pending, estimated_credits=800, expires_at=+45m)
  → POST {BASE}/models/veo-3.1-fast-generate-preview:predictLongRunning
      { instances:[{ prompt, image?:{ inlineData:{ mimeType, data } } }],
        parameters:{ aspectRatio:'9:16', resolution:'720p', durationSeconds:8,
                     personGeneration:'allow_adult' } }
  → store provider_operation_name, job_status='processing'
  → logAssetActivity('marketing.video_generation_started') → 200 { job }

client polls GET get-marketing-generation-job?jobId= every 3s
  server re-polls Google only when last_provider_poll_at is older than 10s:
    GET {BASE}/{operation_name}   (x-goog-api-key)
    done:false → bump provider_poll_count + last_provider_poll_at, return row
    done:true  → FINALIZE
```

`personGeneration: 'allow_adult'` is sent unconditionally — it is required in EU/UK/CH/MENA and harmless elsewhere, and we cannot reliably infer the caller's region server-side.

### FINALIZE and the double-finalize race

Two tabs polling, or a poller racing the sweeper, can both see `done: true` in the same second. Guard with a compare-and-swap claim **before** any billable or storage work:

```sql
UPDATE public.marketing_generation_jobs
   SET job_status='finalizing', finalize_claim_token=$token, finalize_claimed_at=NOW()
 WHERE id=$id AND job_status='processing'
RETURNING id;
```

Zero rows → someone else owns it → the loser re-reads and returns the row unchanged. The single winner then:

1. `fetchGeneratedVideoBytes(response.generateVideoResponse.generatedSamples[0].video.uri, apiKey)` — **the download requires the `x-goog-api-key` header**, so it must happen server-side (exactly the `marketing-music` precedent). Follow redirects; `Content-Length` pre-check plus a post-read check against a 50MB cap, structure lifted from `fetchRemoteAudioBytes`.
2. `uploadGeneratedMarketingAsset` → `marketing-ai/{propertyId}/{jobId}.mp4` with **`upsert: true`**. The path derives from the job id, so a reclaimed retry overwrites rather than duplicating — the upload step is idempotent.
3. Completion CAS: `UPDATE ... SET job_status='completed', completed_at=NOW(), output_* =…, finalize_claim_token=NULL WHERE id=$id AND job_status='finalizing' AND finalize_claim_token=$token RETURNING id`. Zero rows → the claim was reclaimed mid-flight → **skip billing entirely** and return.
4. Only on a winning completion CAS: `recordAiUsage({ feature:'marketing_video_generate', provider:'gemini', model, durationSeconds, estimatedCostUsd, propertyId, organizationId, actorUserId: job.triggered_by, actorType:'staff' })` → stamp `credits_consumed`, `usage_event_id`, `usage_recorded_at`.
5. `logAssetActivity('marketing.video_generated')`.

**`recordAiUsage` is therefore called at most once per job**, gated by two CASes. A crash between steps 3 and 4 leaves `completed` with a null `usage_recorded_at`, which sweeper pass 4 repairs — billing is at-least-once then deduped by the null check, never double.

### Failure, timeout, orphan

| Condition                           | Handling                                                                                                                 | Charged?                                                                                                                                       |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Operation returns `error`           | `failed`, `error_code='provider_error'`                                                                                  | No                                                                                                                                             |
| Safety filter / memorization block  | `failed`, `error_code='safety_blocked'`, copy: "That prompt was blocked. Try rephrasing."                                | No — Google does not bill blocked generations                                                                                                  |
| `:predictLongRunning` 4xx at submit | never leaves `pending` → immediate `failed`, surfaced in the POST response                                               | No                                                                                                                                             |
| Download fails / >50MB              | `failed`, `error_code='download_failed'`                                                                                 | **Yes by Google, no by us** — the completion CAS never wins, so we under-bill ourselves. Rare, and in the user-favourable direction. Accepted. |
| Past `expires_at` (45 min)          | sweeper pass 3 → `failed`, `error_code='timeout'`                                                                        | No                                                                                                                                             |
| Stuck `finalizing` >2 min           | sweeper pass 1 reclaims → pass 2 retries                                                                                 | Once, on eventual success                                                                                                                      |
| User closes tab                     | sweeper pass 2 finalizes within ~60s                                                                                     | Yes, normally                                                                                                                                  |
| Client sees stuck `processing`      | `STUCK_PROCESSING_MS = 8 * 60_000` stops the poll (mirrors `bookingAiReviewProgress.ts`'s 60s, scaled to Veo's 6min p99) | n/a                                                                                                                                            |

Images have no async surface: an inline failure returns 4xx/5xx directly and the row is written `failed` before the response.

---

## 5. Metering & credits

At `credit_unit_usd = 0.001`, `credits = isCacheHit ? 0 : max(1, ceil(costUsd / 0.001))`.

**Images** (token-billed; actual charge uses real `usageMetadata`, these are typical):

| Tier     | Model                         | Size  | USD     | Credits |
| -------- | ----------------------------- | ----- | ------- | ------- |
| Draft    | `gemini-3.1-flash-lite-image` | 1K    | $0.0336 | **34**  |
| Standard | `gemini-3.1-flash-image`      | 1K    | $0.045  | **45**  |
| Standard | `gemini-3.1-flash-image`      | 2K    | $0.151  | **151** |
| Premium  | `gemini-3-pro-image`          | 1K    | $0.134  | **134** |
| Premium  | `gemini-3-pro-image`          | 2K/4K | $0.24   | **240** |

**Video** (per-second, deterministic):

| Tier                   | Model              | Res                | 6s    | 8s      |
| ---------------------- | ------------------ | ------------------ | ----- | ------- |
| Draft                  | `veo-3.1-lite`     | 720p ($0.05/s)     | 300   | **400** |
| Draft                  | `veo-3.1-lite`     | 1080p ($0.08/s)    | 480   | 640     |
| **Standard (default)** | **`veo-3.1-fast`** | **720p ($0.10/s)** | 600   | **800** |
| Standard               | `veo-3.1-fast`     | 1080p ($0.30/s)    | 1,800 | 2,400   |
| Premium                | `veo-3.1`          | 720p ($0.40/s)     | 2,400 | 3,200   |

1080p is offered only on `pro`/`managed`, with its 2,400-credit cost shown before the click. Draft (Lite, 400) stays exposed as the budget option.

### `cost_basis`

- Images → **`'tokens'`**: pass `inputTokens`/`outputTokens` from `extractGeminiUsage` plus explicit `estimatedCostUsd = estimateTokenCostUsd(...)`.
- Video → **`'duration'`**: pass `durationSeconds` plus explicit `estimatedCostUsd = estimateVideoCostUsd(...)`.

**Verified:** `recordAiUsage` derives the basis from the presence of `durationSeconds`, and the CHECK constraint already permits `'duration'`. No change to either.

### Reservation semantics

`assertOrgAndPropertyAiQuota` is assert-then-charge. For **images** that is fine — the assert→charge gap is 5–15s and the worst-case overdraft is one image (45 credits). Keep it.

For **video** it is not: a user could fire 20 jobs in 10 seconds and overdraw by 16,000 credits before the first bills. Fix with **in-flight job accounting** — the job table _is_ the hold ledger, so there's no new table and no compensating-release logic. `assertMarketingGenerationBudget()` runs after `assertOrgAndPropertyAiQuota` and enforces in order:

1. **Concurrency cap.** `COUNT(*) WHERE job_status IN ('pending','processing','finalizing')` against `MAX_CONCURRENT_PER_PROPERTY = 2`, `MAX_CONCURRENT_PER_ORG = 5`. Exceeded → 429 `{ retryable: true }`, _not_ an `AiQuotaExceededError` (this is not an upgrade prompt).
2. **Reservation.** `SUM(estimated_credits)` over the same in-flight set; if `monthConsumed + inFlight + estimate > monthlyAllowance + walletBalance` → `AiQuotaExceededError` (429, `upgradeHook: true`).
3. **Per-feature monthly sub-cap.** `SUM(credits_consumed) FROM ai_platform_usage_events WHERE organization_id=$1 AND feature=$2 AND created_at >= date_trunc('month', now())` (uses the new index) against `feature_configs[feature].monthly_credit_cap`, defaulting to **60% of the org monthly allowance** per media feature. This is what stops a video spree from starving Inbox auto-reply and the Dashboard Assistant for the rest of the month.

The residual race — two simultaneous POSTs reading the same in-flight sum — is bounded by the concurrency cap at one extra job, i.e. ≤800 credits of overdraft worst case. A row-locked ledger hold would need a compensating release on every failure path including the sweeper's expire and reclaim passes; that complexity isn't worth 800 credits of tail risk. **Chosen deliberately — document it in the module header.**

### `aiMonthlyCreditAllowance` changes

Per the decision above (migration `20261316120400`):

| Plan             | Now    | New        | Buys at defaults                  | Max Google spend/org/mo |
| ---------------- | ------ | ---------- | --------------------------------- | ----------------------- |
| `free`           | 0      | **0**      | —                                 | $0                      |
| `starter`        | 0      | **0**      | —                                 | $0                      |
| `growth` (Pro)   | 1,000  | **5,000**  | ~111 standard images; video off   | **$5**                  |
| `pro` (Business) | 10,000 | **25,000** | ~31 Fast 8s videos, or 555 images | **$25**                 |
| `managed`        | 30,000 | **60,000** | ~75 Fast 8s videos                | **$60**                 |

Those right-hand figures are the **hard ceiling** on incremental Google spend per org per month — the wallet gate makes overrun impossible without a purchased top-up. Worth a conscious look before shipping: **$25/mo of AI COGS on Business** is the number to sanity-check against current PHP pricing. If it's too rich, the lever is `pro: 18,000` (~$18, still 22 videos) rather than shipping allowances so low that video feels broken.

Note `20261107120000_org_portfolio_bundling.sql` also carries a 20,000 allowance for the portfolio bundle — decide whether that moves in the same migration.

### Plan-tier placement

- `aiMarketingImageGeneration`: growth ✅, pro ✅, managed ✅ — free/starter ❌
- `aiMarketingVideoGeneration`: pro ✅, managed ✅ — free/starter/growth ❌

---

## 6. UI

**A fourth lazy tab in `MarketingStudioPage.tsx`, not a separate route.** The publish handoff (`openPublishWithBlob` → `<PublishDialog media={...} />`) is already wired at page level and `PublishMedia` already accepts `{ blob, mediaType, templateId }`; a separate route would duplicate all of that plus need a router entry, a sidebar item, and its own route guide. Append (do not reorder) in `MarketingStudioModeTabs.tsx`: `Calendar | Design | Video | Generate`.

```tsx
const AiStudioSection = lazy(() =>
  import('@/features/dashboard/marketing/components/ai-studio/AiStudioSection').then((m) => ({
    default: m.AiStudioSection,
  }))
);

const handleGeneratePublish = (payload: { blob: Blob; mediaType: 'image' | 'video' }) =>
  openPublishWithBlob(payload.blob, payload.mediaType, 'ai-generated');

<SlidingTabsContent value="generate" className="mt-0 flex min-h-0 flex-1 flex-col">
  <Suspense fallback={<StudioTabFallback />}>
    <AiStudioSection onPublish={handleGeneratePublish} />
  </Suspense>
</SlidingTabsContent>;
```

**`MarketingAiGeneratePanel.tsx` is not reused.** That 1,271-line 3-step wizard exists to produce design _tokens_ for an editable canvas; this surface is single-shot prompt → finished asset. Sharing it would force a step model onto a one-step flow.

### New components — `ui/src/features/dashboard/marketing/components/ai-studio/`

| File                                                     | Role                                                                                                                                       |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `AiStudioSection.tsx`                                    | Tab root. Results-first: gallery / generating stage hero; composer rail. Image plan gate on composer only so downgrades keep past assets.  |
| `AiStudioComposer.tsx`                                   | Media toggle → prompt → photo drop zone → shape chips → Generate (credits on button). Quality/size/length under Advanced.                  |
| `AiStudioAspectPicker.tsx`                               | Visual shape radiogroup (always visible).                                                                                                  |
| `AiStudioReferenceUploader.tsx`                          | Full dashed drop zone + thumbs + Library. `prepareUpload` then multipart POST. **Must not statically import `browser-image-compression`**. |
| `AiStudioOptionsBar.tsx` / `AiStudioVideoOptionsBar.tsx` | Advanced only: quality + size (image) or resolution + length (video).                                                                      |
| `AiStudioGeneratingStage.tsx`                            | Aurora / orbit / status-ladder loading (hero + card variants).                                                                             |
| `AiStudioResultsGrid.tsx`                                | Gallery + pending card / empty hero.                                                                                                       |
| `AiStudioJobCard.tsx`                                    | Preview + Download / Publish / Delete; in-flight image uses generating stage.                                                              |
| `AiStudioVideoProgress.tsx`                              | Video elapsed timer + status ladder.                                                                                                       |
| `AiStudioEmptyState.tsx`, `AiStudioQuotaBanner.tsx`      | Empty state; credits banner that swaps to the upgrade CTA on 429.                                                                          |
| `AiStudioReferenceLibraryDrawer.tsx`                     | Reuse a previous upload.                                                                                                                   |

### New hooks — `ui/src/features/dashboard/marketing/hooks/`

- **`useMarketingGenerationJob.ts`** — the poller, structurally identical to `useBookingAiReview.ts`:
  ```ts
  refetchInterval: (query) => {
    const d = query.state.data;
    if (!d) return false;
    if (d.job_status === 'completed' || d.job_status === 'failed' || d.job_status === 'cancelled') return false;
    if (isStuckMarketingGeneration(d)) return false;
    return d.media_type === 'video' ? 3000 : 1000;
  },
  refetchIntervalInBackground: true,
  staleTime: 0,
  ```
  `refetchIntervalInBackground: true` matters here — video takes minutes and users will switch tabs.
- **`useGenerateMarketingMedia.ts`** — `scopedFunctionsUrl('generate-marketing-media', propertyId)`, `Authorization: Bearer ${await getSessionJwt()}`, `parseEdgeJsonOrQuota()` (429 → AI-quota toast + upgrade hook), exactly as `useGenerateMarketingTemplate.ts`. `onMutate` prepends an optimistic `pending` card (mirroring `useBookingAiReviewTrigger.ts`); `onSuccess` replaces it and **seeds the per-job query cache** so the poller starts hot instead of firing a redundant GET.
- **`useMarketingGenerations.ts`** — keyset `useInfiniteQuery`.
- **`useUploadMarketingGenerationReference.ts`**, **`useDeleteMarketingGeneration.ts`**.
- **`useMarketingPermissions.ts`** — add `canGenerateVideo`.

### New lib — `ui/src/features/dashboard/marketing/lib/`

- `marketingGenerationPricing.ts` — client mirror of the server price tables + `estimateCredits(opts)`, **parity-tested** against the edge copy (same pattern as `ui/src/lib/media/uploadLimits.ts` ↔ `_shared/uploadLimits.ts`).
- `marketingGenerationProgress.ts` — `STUCK_PROCESSING_MS = 8 * 60_000`, `isStuckMarketingGeneration`, `expectedDurationMs`, status copy.
- `marketingGenerationOptions.ts` — option lists with plan requirements (style follows `calendarAiGenerateOptions.ts`).
- `types.ts` — `MarketingGenerationJob`, `MarketingGenerationReference` DTOs.

### Publish handoff

```ts
const blob = await (await fetch(job.output_url)).blob();
onPublish({ blob, mediaType: job.media_type });
```

CORS is a non-issue — `property-media` is public and the URL goes through the same `formatPublicUrl` path as the rest of marketing. **`PublishDialog.tsx` needs no changes.** Two Meta guards live on the Generate side instead:

1. **Reels duration** — 4s is never offered (schema CHECK is `(6,8)`), so every clip clears the 5–90s Reels floor. 9:16 is the default video aspect.
2. **Reels file size** — some Reels paths report an 8MB ceiling while the bucket allows 50MB. Default to 720p (typically 3–6MB for 8s) and show a warning chip when `output_bytes > 8 * 1024 * 1024`, before a publish Meta would reject.

Per the repo's always-on mobile rule, every screen must work at 375/768/1024px with native bottom sheets on phone — invoke the `mobile-responsive` skill on this work.

---

## 7. Plans / RBAC / audit wiring

### Two new `PlanFeatures` keys

`aiMarketingImageGeneration`, `aiMarketingVideoGeneration` — two keys, not one, because the chosen tier split puts images on growth+ and video on pro+. Existing `aiMarketingGeneration` is **left untouched** (it still gates captions and template tokens).

1. `supabase/functions/_shared/planFeatures.ts` — add to the `PlanFeatures` type, to `FREE_PLAN_FEATURES` (both `false`), and two `asBool(obj.X, base.X)` lines in `normalizePlanFeatures`.
2. `ui/src/features/dashboard/plans/lib/planFeatures.ts` — **byte-for-byte identical** edit; diff the two files afterward.
3. `ui/src/features/dashboard/plans/lib/featureGateCopy.ts` — two `FEATURE_GATE_COPY` entries beside the existing `aiMarketingGeneration` block.
4. `ui/src/features/dashboard/plans/lib/planPresentation.ts` — two `boolRow(...)` entries in the `'marketing'` group; check `PLAN_TIER_CARD_GAINS` for tier-card bullets. Shared with the public `/for-hosts/pricing` page via `list-public-pricing-plans` — verify both render.
5. `supabase/migrations/20261316120400_marketing_generation_plan_features.sql` — booleans per tier + the allowance bumps.
6. `docs/architecture/plans-feature-matrix.md` — new rows, allowance changes, and an explicit note that the GET endpoints gate on `marketing:view` only, per the view-past-output rule.

### One new permission leaf: `marketing.generate.video:add`

An owner must be able to let a marketing assistant make 45-credit images without letting them burn 800 credits a click. The repo's 5-step procedure:

1. `supabase/functions/_shared/propertyTeamPermissions.ts` — add to `TEAM_PERMISSION_IDS` right after `'marketing.generate:add'`.
2. `ui/src/features/dashboard/team/lib/propertyTeamConstants.ts` — `TEAM_PERMISSIONS` entry ("Generate AI video", marketing group).
3. `ui/src/features/dashboard/team/lib/propertyPermissionCatalog.ts` — `COARSE_PLAN_FEATURES` → `aiMarketingVideoGeneration`.
4. Same file — `SEEDED_TEMPLATE_PERMISSIONS`: grant to Owner and Manager, **not** Marketing/Staff by default.
5. `supabase/functions/generate-marketing-media/index.ts` — required when `mediaType === 'video'`.

Plus `canGenerateVideo` in `useMarketingPermissions.ts`.

### Four new activity actions (category `marketing`)

`marketing.image_generated`, `marketing.video_generation_started`, `marketing.video_generated`, `marketing.generated_asset_deleted`.

Files: `supabase/functions/_shared/activityLog.ts` (`ACTIVITY_ACTION_CATALOG`), `ui/src/features/dashboard/activity/lib/activityCatalog.ts` (mirror), `supabase/functions/_shared/activityLog_test.ts`. All emitted via `logAssetActivity({ req, user, action, propertyId, organizationId, targetType: 'marketing_generation', targetId, metadata })` — after the DB write succeeds, before the HTTP response, never throwing into the caller. Failures aren't catalogued (they live on the job row); the catalog records successful operator actions.

### AI feature keys + admin console

- `_shared/aiModelRouter.ts` — `AI_FEATURES` += `'marketing_image_generate'`, `'marketing_video_generate'` (this is the global kill-switch allowlist source).
- `ui/src/features/dashboard/super-admin/components/AiPlatformKillSwitchCard.tsx` — two `AI_FEATURE_TOGGLES` rows.
- `ui/src/features/dashboard/super-admin/components/super-admin-overview/SuperAdminAiCostChart.tsx` — two label-map entries.
- Per-property toggles in `ai_platform_property_settings.feature_configs`: `marketing_image_generate: { enabled, monthly_credit_cap }`, `marketing_video_generate: { enabled, monthly_credit_cap, allow_premium_tier }`, read via `getAiPlatformPropertySettings` — the same JSONB pattern `voiceReceptionistService.ts` already uses.

**Full chain, end to end:** global kill switch → `allowed_features` allowlist → org enabled → org call/USD limits → property enabled + `feature_configs` → credit allowance → wallet balance → per-feature sub-cap → in-flight reservation → concurrency cap.

---

## 8. Docs to update

| File                                                        | What                                                                                                                                                    |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `docs/guides/routes/org/property/marketing.md`              | The Generate tab: upload, prompt, options, credit costs, publish, plan/permission requirements. Update `## Implementation map` + `## Progress overview` |
| `docs/architecture/edge-functions.md`                       | 5 new functions, contracts, gate order                                                                                                                  |
| `docs/architecture/data-model.md`                           | Both new tables                                                                                                                                         |
| `docs/architecture/storage.md`                              | `marketing-ai/` + `marketing-ai-refs/` prefixes and retention                                                                                           |
| `docs/architecture/plans-feature-matrix.md`                 | 2 new rows, allowance changes, view-past-output note                                                                                                    |
| `docs/architecture/integrations.md`                         | Veo LRO flow, 2-day retention, `x-goog-api-key` download requirement                                                                                    |
| `docs/PROJECT.md`                                           | Routes, env vars, API, data model                                                                                                                       |
| `docs/architecture/validation-and-env.md` + `deployment.md` | Vault `marketing_generation_cron_secret`, `MARKETING_GENERATION_CRON_SECRET`, post-deploy `SELECT public.sync_marketing_generation_cron_job();`         |
| `docs/archive/operations/scheduled-jobs-and-testing.md`     | §1 table row for the sweeper                                                                                                                            |

Mandatory skill gates before claiming done: `documentation-maintenance`, `route-guides`, `mobile-responsive`, `audit-logging`, `plans-and-permissions`.

---

## 9. Build order

### Phase 1 — Images only (independently shippable)

Migrations `…120000` (jobs), `…120100` (references), `…120200` (usage index), `…120400` (plan features — image key + allowance bump only). Router image models + `marketing_image_generate`. Functions: `upload-marketing-generation-reference`, `generate-marketing-media` (image branch, **inline**), `get-marketing-generation-job` (row read only, no Google poll), `marketing-generations`. UI: Generate tab, composer, uploader, results grid, publish handoff. Plan key `aiMarketingImageGeneration` on growth+. Activity: `marketing.image_generated`, `marketing.generated_asset_deleted`.

**Zero async machinery.** Images run inline exactly like `generate-marketing-template`. This validates uploads, storage paths, credit metering, the whole gate chain, the gallery, and the publish handoff with none of the lifecycle risk. If phase 2 slips, phase 1 is still a real feature.

### Phase 2 — Video

Migration `…120300` (cron). `marketing-generation-sweeper`. Video branch in `generate-marketing-media`, Google operation polling in `get-marketing-generation-job`, the claim CAS, `marketingVideoGenerationAi.ts`. Permission leaf `marketing.generate.video:add`. Plan key `aiMarketingVideoGeneration` on pro+. UI: video options, `AiStudioVideoProgress`, 3s cadence, Reels size warning. Activity: `marketing.video_generation_started`, `marketing.video_generated`.

### Phase 3 — Hardening

Per-feature sub-caps surfaced in the admin AI console. Reference library drawer + "use this output as a reference" chaining. Retry-with-same-settings. Reference prune. Premium-tier escape hatch. Revisit allowances against real burn data.

---

## 10. Verification

No broad automated suite exists in this repo, so: targeted unit tests plus real exercise.

**Unit tests to add**

- `supabase/functions/_shared/marketingGenerationPricing_test.ts` — asserts the exact credit table: 34/45/151/134/240 (images), 300/400/480/640/600/800/1800/2400/3200 (video). This table is the thing most likely to silently drift.
- Client↔edge parity test for `marketingGenerationPricing.ts`, modeled on the `uploadLimits` parity test.
- Extend `_shared/activityLog_test.ts` with the 4 new actions.

**Static**

- `bun run type-check`, `bun run lint`, `bun run check:filenames`, `bun run build`; `deno check` on each new function.
- `node scripts/media/assert-lazy-optimizer.mjs` must still pass.
- Diff `_shared/planFeatures.ts` against `ui/.../plans/lib/planFeatures.ts` — must be byte-identical.

**Local (`./dev.sh`, then `bun run dev:api`)**

1. **Image end-to-end.** POST with `mediaType:'image'`. Assert an `ai_platform_usage_events` row with `cost_basis='tokens'`, `credits_consumed ≈ 45`, and that both `ai_platform_usage_daily` and `ai_platform_property_usage_daily` moved.
2. **Video happy path** (real Veo call — no emulator exists). Assert the row reaches `processing` with a `provider_operation_name`, and that `get-marketing-generation-job` re-polls Google only at ≥10s intervals (compare `provider_poll_count` growth to wall clock).
3. **Closed-tab path.** Fire a video job, kill the client, then loop `curl -X POST .../marketing-generation-sweeper -H 'X-Marketing-Generation-Cron-Secret: …'` and confirm the job reaches `completed` with the MP4 in `property-media` and usage recorded — with no client involved.
4. **Double-finalize.** Fire two concurrent GETs at the moment the operation flips `done`. Assert exactly one usage event, one non-null `usage_recorded_at`, one storage object.
5. **Timeout.** Hand-set `expires_at` into the past on a `processing` row, run the sweeper, assert `failed` / `error_code='timeout'` and **no** usage event.
6. **Reservation.** Set the org monthly credit limit to 500, fire two video jobs. The second must 429 with `upgradeHook: true` _before_ calling Google — assert `provider_operation_name IS NULL` and no `predictLongRunning` in the logs.
7. **Concurrency.** Fire three video jobs on one property; the third must 429 as rate-limited, not quota-exceeded.
8. **Kill switch.** Set `ai_platform_global_settings.allowed_features = ARRAY['marketing_caption']`; both new features must 503.
9. **Downgrade (view-past-output rule).** Flip the org to `starter`. The Generate composer shows the plan gate, but `marketing-generations` GET and `get-marketing-generation-job` still return past assets, the gallery renders, Download works, and no read path 402s.

**Real UI** — Playwright MCP: upload a reference, prompt, generate an image, publish it through `PublishDialog`, then generate a video and watch the progress component through completion. Check 375/768/1024px.

**Deploy** — dev only (`bun run deploy:supabase:dev`). Production requires the `kamewave` unlock, which is not in scope here. After a hosted deploy, run `SELECT public.sync_marketing_generation_cron_job();` and confirm the Vault secret exists.

---

## Open pricing decision

**$25/mo of AI COGS per Business org** is the practical ceiling this plan creates (25,000 credits). It's a pricing decision, not an engineering one, and it's easy to change later by editing one migration. Worth a sanity check against current PHP plan pricing before phase 2 ships — phase 1 (images only) only exposes ~$5–25 of image generation, so there's time.
