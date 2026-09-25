---
title: 'Marketing AI image generation — quality hardening & production readiness'
status: in-progress
tags: [marketing, ai, image-generation, gemini, production-readiness]
updated: 2026-09-25
stage: in-progress
kind: plan
---

## Implementation status (2026-09-23)

Branch: `feature/marketing-ai-image-quality-hardening`.

- **Phase 1 (prompt enhancement) — done.** System instruction, structured fallback
  prompt, fail-open LLM rewrite (`marketing_image_prompt_enhance`, billed as platform
  cost per Decision 2), `negativePrompt` folded into the system instruction instead of
  "Avoid: X" prose, migration adding `enhanced_prompt`/`prompt_enhanced`.
- **Phase 2 (property context) — done.** `loadPropertyContextForPrompt` reads
  name/type/city/residence/capacity/amenities from `properties`, brand color via the
  existing `loadResolvedBrandColorByPropertyId` (not `properties.settings` — that was
  a wrong assumption caught during implementation; brand color lives on `app_settings`
  with an org → env fallback chain).
- **Phase 3 (platform framing + presets) — done.** Aspect-ratio → platform intent
  framing is live in the prompt builder. `IMAGE_STYLE_PRESETS` adds 10 curated,
  named photographic scene fragments (Golden Hour Interior, Bright Scandinavian
  Morning, Poolside Evening, etc.) — real fragments with lighting/framing direction,
  not shorthand — surfaced in the composer as 4 featured chips + a "More styles"
  toggle revealing the rest. Reuses the composer's existing chip pattern rather than
  the Design tab's separate wizard-modal component, which is not a fit for this
  composer's single-page layout.
- **Phase 4 (validation & retry) — done.** 4a (same-key retry on transient status)
  and 4c (45s timeout) in `marketingImageGenerationAi.ts`. 4b is now two layers:
  header-level checks (byte-size floor, aspect-ratio sanity, unchanged) plus a real
  **pixel-level** check via a new `pngPixelSampler.ts` — a narrow PNG decoder (IHDR
  parse, IDAT zlib-inflate via the Web-standard `DecompressionStream('deflate')`,
  scanline unfiltering, luminance sampling) built entirely from APIs already
  available in Deno, no new dependency. Catches a blank/near-uniform frame that
  header checks alone cannot see. Scoped to 8-bit, non-interlaced, non-palette PNG
  (what Gemini's endpoint actually returns); anything outside that scope reports
  "unsupported" and is skipped, never rejected — decode failures must never block a
  real generation. Verified against hand-built ground-truth PNGs (solid color =
  variance 0, checkerboard/gradient = high variance) before wiring in.
- **Phase 5 (tests) — done**, now covering all five new/changed modules:
  `marketingImageGenerationAi_test.ts` (13 tests), `marketingImagePromptBuilder_test.ts`
  (12 tests, including the fail-open case and 2 live-bug regression tests — see
  below), `pngPixelSampler_test.ts` (8 tests against ground-truth PNG fixtures). A
  shared `pngTestFixtures.ts` builds real, valid PNGs in-test so assertions are
  against ground truth, not another decoder's output. Full `bun run test:edge`
  (371 tests) and `ui` type-check both pass; lint 0 errors.
- **Phase 6 — done.** 6a (cache the enhancement via `aiQuotaCache`) done. 6c
  (SynthID disclosure) and the opt-out toggle (Decision 1) done in the composer.
  6b (reproducible re-roll): confirmed via live doc lookup that Gemini's image
  endpoint has **no `seed` parameter** — adding one to the request body would have
  been a fake, silently-ignored field. Built the real available substitute instead:
  a **Refine** action (`AiStudioSection.tsx#handleRefine`) that uploads the
  completed image as a reference and restores the composer draft in one step,
  pre-filled with the enhanced prompt when one exists — anchoring the next
  generation to what the host just got, via the same inline-image mechanism the
  reference-photo flow already uses in production. 6d done: `AiStudioJobCard.tsx`
  now shows the enhanced prompt (collapsed by default) with a copy action on any
  job where `promptEnhanced` is true.

**Corrected during implementation** (see inline comments at each site): the plan's
Phase 4b note said to "release the reservation" on a rejected image — there is no
explicit reservation to release; failing the job is sufficient since the budget
module derives in-flight spend from job status. The `retryable` field considered for
the 502 output-validation error was dropped — the client only reads it on 429
responses, so it would have been dead weight. Phase 6b's planned `seed` parameter
does not exist on Gemini's image API — see above.

**Live-key testing found and fixed a real production bug (2026-09-23).** A local
`GEMINI_API_KEYS` with 5 keys was available, so this session ran
`enhanceMarketingImagePrompt` for real instead of only against mocks.

- First pass: every call failed open. Root cause was **not** the keys — it was a
  bug in this session's own Phase 1 code. The per-key `AbortController` and its
  `setTimeout` were created **once, outside** the key-rotation `for` loop, so the
  entire rotation shared one deadline. Once that shared timeout fired (even
  mid-request on an earlier key), every subsequent `fetch` in the loop saw an
  already-aborted signal and failed instantly — a single dead or slow key could
  starve every valid key behind it of a real attempt. Fixed: each key attempt now
  gets its own controller and timeout, with a `try/catch` around each attempt so a
  thrown error (not just a non-ok response) also rotates to the next key instead
  of propagating out. Two regression tests added
  (`marketingImagePromptBuilder_test.ts`) proving rotation survives both a non-ok
  first key and a first key whose `fetch` throws.
- Second finding, surfaced by fixing the first one: `ENHANCE_TIMEOUT_MS` was `3000`
  on an untested estimate ("~400-800ms" in the original plan doc). Live sampling of
  the real `gemini-3.1-flash-lite` endpoint measured **2.2s-4.6s** for this exact
  system+user prompt shape — the 3s budget was failing the enhancement outright on
  a large share of genuinely healthy calls. Raised to `8000`, with the real
  measured numbers in the code comment instead of the old guess.
- Of the 5 configured keys, 2 were independently confirmed dead
  (`API_KEY_INVALID` / invalid auth credentials) and 3 valid — an unrelated,
  pre-existing housekeeping item for local dev keys, not a code bug.
- With both fixes in place, all 6 synthetic evaluation prompts (bare noun, short
  phrase, over-long rambling, conflicting styles, Taglish, with-references) were
  run for real and produced full, well-formed photographic scene descriptions
  (subject, setting, lighting, camera framing, correct platform framing per aspect
  ratio, property context woven in without forcing every field) — genuine evidence
  the Phase 1 mechanism works end to end, not just under mocks.

**Phase 2 follow-up (2026-09-24) — done.** Checking context injection against the
real property settings shape found two holes the earlier unit fixture hid:

- Amenities were read from `settings.amenities`, which is not a column the app
  writes. Saved amenities live on `enabledAmenities` (catalog ids) and
  `customAmenities` (`{ id, name }`). A fully filled property injected no amenity
  text. The loader now resolves those ids to labels via `resolveAmenityLabels`.
- The listing name and brand color were loaded and then dropped. Both are now in
  the property line. Brand color is a palette hint, not a recolor instruction.

Covered by `amenitiesFromPropertySettings` tests plus the structured-prompt
assertions for name, residence, city, amenity label, and brand hex.

**Still open — not closeable in code.** The 20-prompt blind **image** evaluation
(Evaluation protocol below). Six synthetic prompts already produced good enhanced
text. Still needed before this plan can move to done:

- 4 more synthetic prompts and 10 real prompts hosts have typed
- Image pairs at the same tier and aspect, scored blind by the user
- Ship gate: mean postability +1.0, no category down more than 0.3, no new safety blocks

Image runs spend credits. The user is the judge; a self-score is not evidence.
Kept examples of bad output remain useful and are not blocking. Per-property house
style stays deferred (Decision 4). Video quality stays out of scope.

# Marketing AI image generation — quality hardening & production readiness

Audit + plan for the Marketing Studio **Generate** tab image path. Scope is image
generation quality and robustness; video (Veo) is touched only where it shares code.

## TL;DR

The **plumbing is good** — credit metering, double-billing guards, job lifecycle,
sweeper repair, RBAC, plan gating, rate limiting, and activity logging are all solid
and better than most implementations of this size.

The **prompt layer does not exist**. `generate-marketing-media` takes whatever the host
typed and posts it verbatim to Gemini. There is no system instruction, no property
context, no photographic direction, and no platform framing. Every paid token is spent
on an under-specified prompt, which is the single biggest reason output does not look
Instagrammable.

**The fix is cheap.** A ~$0.0002 Flash-Lite prompt-enhancement call in front of a
$0.045–$0.24 image call is a <1% cost increase for a large quality gain. Phases 1–3 are
the ones that matter; Phases 4–6 are hardening.

## What we have today

### Call path

```
AiStudioComposer.tsx  (prompt textarea + 4 static starter chips)
  → useGenerateMarketingMedia
    → POST generate-marketing-media
      → resolveScopedPropertyAccess + requirePropertyPermissionAndFeature
      → rateLimitGate (20 image / 5 video per 5 min per user)
      → assertValidImageOptions (tier → model, aspect, size, ref count)
      → rejectPremiumIfDisabled → checkQuotaAndBudget (credit reservation)
      → insertMarketingGenerationJob
      → loadReferenceInlineData (parallel bucket downloads)
      → generateMarketingImage ......... raw prompt, no enrichment
      → uploadGenerationBytes → completeMarketingGenerationJob
      → claimMarketingGenerationJobBilling → recordAiUsage
      → logAssetActivity('marketing.image_generated')
```

### Genuinely well done — do not regress

- **Billing correctness.** `claimMarketingGenerationJobBilling` is claimed _before_
  `recordAiUsage` specifically so a crash between the two cannot double-bill on sweeper
  repair. The reasoning is in a comment. This is careful work.
- **Model/price centralization.** `MARKETING_IMAGE_MODELS` in `aiModelRouter.ts` is the
  only place model ids and prices live, with per-tier env overrides. Client mirror in
  `marketingGenerationPricing.ts` is parity-tested.
- **Multi-key rotation** with `nextGeminiKeyStartIndex` + `shouldTryNextProvider`.
- **Safety handling** distinguishes `promptFeedback.blockReason` and the three
  `finishReason` safety values, surfaced as a 400 rephrase hint rather than a 502.
- **Reference validation** — ownership-checked against `property_id`, capped, image-only.
- Credit reservation happens _before_ the provider call, so budget cannot be overrun.

### The gaps

| #   | Gap                                                                                                                                       | Where                                   | Impact                               |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- | ------------------------------------ |
| 1   | **No prompt enhancement.** Raw host text → model.                                                                                         | `marketingImageGenerationAi.ts:126-143` | **Critical** — primary quality cause |
| 2   | **No `systemInstruction`.** Model has no role/quality framing.                                                                            | same                                    | **Critical**                         |
| 3   | **Zero property context.** `name`, `type`, `city`, `residence_name`, `max_guests`, amenities, `brand_color` all exist and are all unused. | handler                                 | **High** — generic output            |
| 4   | **No platform intent.** Aspect ratio is a bare geometry arg; the model is never told this is an Instagram post.                           | handler                                 | **High**                             |
| 5   | **`negativePrompt` appended as `"Avoid: X"` prose.** Gemini has no negative-prompt channel; this can _add_ the unwanted concept.          | `:102-107`                              | Medium                               |
| 6   | **No retry on transient 5xx for the same key.** Rotation only advances keys.                                                              | `:149-168`                              | Medium                               |
| 7   | **No output validation.** Any returned bytes are stored and billed, including a near-black or degenerate frame.                           | handler                                 | Medium                               |
| 8   | **Zero tests** on the image path, while pricing/budget/feature-config all have them.                                                      | —                                       | Medium                               |
| 9   | **No prompt caching**, unlike `marketingCaptionAi` which caches. Identical re-submits pay full price.                                     | —                                       | Low–Medium                           |
| 10  | **SynthID not disclosed.** Every Gemini image is watermarked; hosts are never told.                                                       | UI                                      | Low (trust/legal)                    |
| 11  | **Only 4 static starter chips**, not property-aware.                                                                                      | `marketingGenerationOptions.ts:64-69`   | Low–Medium                           |
| 12  | **No seed / reproducibility**, so "same but tweak" is impossible.                                                                         | —                                       | Low                                  |

### The contrast that proves the point

`marketingCaptionAi.ts` — for _text_, which is ~100x cheaper — already does everything
the image path does not: a system prompt, structured property context (name, platform,
format, rate, availability), a cache, and a Groq fallback.

The expensive path got less prompt engineering than the cheap one.

## What the industry does

Research (Sept 2026) — sources at the end.

1. **Prompt enhancement before the image model is the production standard.** An LLM
   rewrites the user's short prompt into a full scene description first. This is what
   ChatGPT/DALL·E, Midjourney, Ideogram, Canva Magic Media and Adobe Firefly all do.
   CVPR 2026 `PromptEnhancer` and `APE` (arXiv 2606.00204) formalize it; both report
   large visual-alignment gains **with no change to the image model**.
2. **Google's own guidance: describe a scene in prose, not keywords.** The official
   template is: _"A photorealistic [shot type] of [subject] in [setting]. [Lighting].
   Shot from a [angle] with a [lens]."_ We send neither shot type, lighting, nor lens.
3. **Gemini 3 prefers direct, concise instruction** over verbose persuasion, and
   penalizes conflicting style tokens (`"Pixel art and 4k photorealistic"`).
4. **Texture modifiers prevent the plastic AI look** — `visible texture`, `subtle film
grain`, `natural global illumination`.
5. **Real-estate/hospitality convention**: wide-angle interiors (16–24mm), golden-hour or
   bright diffused daylight, level verticals, styled but lived-in.
6. **Competitors ship curated style presets**, not a blank textarea — Canva Magic Media,
   Later, Hootsuite Composer.
7. **SynthID disclosure** is standard practice for AI imagery going to social.

## Plan

Phases are independently shippable. **1–3 deliver nearly all the quality win.**

---

### Phase 1 — Prompt enhancement layer (highest impact)

New `supabase/functions/_shared/marketingImagePromptBuilder.ts`.

**1a. Deterministic system instruction.** Add `systemInstruction` to the
`generateContent` body — no extra token cost beyond its own length:

> You compose photographs for short-term-rental social marketing. Output must look like
> a real photo taken by a skilled property photographer: correct perspective, level
> verticals, natural global illumination, visible material texture, no plastic sheen, no
> distorted architecture, no gibberish text or fake signage.

**1b. Structured scene assembly.** Build the prompt from typed parts following Google's
template — shot type, subject, setting, lighting, lens, platform framing — instead of
passing a bare sentence.

**1c. LLM prompt rewriting** (the core change). One `gemini-3.1-flash-lite` call
(`marketing_image_prompt_enhance`, new `AiFeature`) expands the host's shorthand into a
full scene description before the image call.

- Cost: **~$0.0002** against a $0.045–$0.24 image. Under 1%.
- Latency: ~400–800ms against 10–20s. Negligible.
- Must be **fail-open** — if enhancement errors or times out (3s cap), fall through to
  the structured prompt from 1b. Never block a paid generation on the cheap call.
- Persist both `prompt` (host's words) and `enhanced_prompt` on the job; show the host
  what was actually sent, and let them opt out.

**1d. Fix `negativePrompt`.** Stop appending `"Avoid: X"`. Fold exclusions into the
system instruction as positive phrasing where possible, since a diffusion-style model
given `"Avoid: people"` may still render people.

**1e. Schema + registration** (small, but Phase 1 does not land without it):

- New migration adding to `marketing_generation_jobs`:
  - `enhanced_prompt TEXT` — nullable; null means enhancement was off, skipped, or failed
    open, which is exactly the signal we want for measuring fallback rate.
  - `prompt_enhanced BOOLEAN NOT NULL DEFAULT FALSE` — distinguishes "not enhanced" from
    "enhanced to something short". Do not infer this from `enhanced_prompt IS NULL`.
  - Note the existing `prompt` CHECK is `char_length BETWEEN 1 AND 2000`; an enhanced
    prompt is longer than the host's, so size the new column's constraint accordingly
    (suggest 4000) and confirm it clears `MAX_IMAGE_PROMPT_CHARS` (1000) comfortably.
  - New migration file only — never edit a shipped one.
- Add `marketing_image_prompt_enhance` to `AI_FEATURES` and `FEATURE_MODELS` in
  `aiModelRouter.ts` (Flash-Lite pricing row, `defaultMaxOutputTokens` ~512). Required or
  the kill-switch allowlist and `getModelConfig()` will not resolve for it.
- Extend `MARKETING_GENERATION_JOB_COLUMNS` + `toMarketingGenerationJobDto` so the new
  fields reach the client for 6d.

**Acceptance:** 20 fixed prompts generated pre/post, scored blind on realism, brand fit
and postability. Ship only on a clear win. See **Evaluation protocol** below.

---

### Phase 2 — Property context injection

Load the property row already reachable in the handler and pass it into the builder:
`name`, `type`, `city`, `residence_name`, `max_guests`, amenities, `brand_color`.

"Bright living room, morning light" should become a prompt that knows it is a 2-bedroom
Azure condo in Parañaque with a pool view — without the host retyping it every time.

- Respect `brand_color` as a palette hint, not a hard constraint.
- Never inject guest PII or booking data.
- Cache the property read per request; it is one query.

---

### Phase 3 — Platform-aware framing + style presets

**3a.** Map aspect ratio → explicit platform intent in the prompt (`1:1` → "Instagram
feed post, composed for a square crop, key subject centered, safe margins"; `9:16` →
"Instagram Story/Reel, vertical, top and bottom thirds clear for UI overlay"). Today the
ratio is pure geometry and the model is never told the destination.

**3b.** Ship 8–12 curated presets (Golden Hour Interior, Bright Scandinavian Morning,
Poolside Evening, Rainy Day Cozy, Editorial Wide, Detail/Texture…), each a tested
scene-description fragment. Mirror the `DESIGN_AI_SUGGESTIONS` pattern already proven in
`designAiGenerateOptions.ts`, which is well-built and the right precedent.

**3c.** Replace the 4 static chips with property-aware starters.

---

### Phase 4 — Output validation & retry

- **4a.** Retry the _same_ key on 429/500/503 with one backoff step before rotating.
- **4b.** Reject degenerate output before billing — near-uniform/near-black frames, or
  dimensions wildly off the requested aspect. Extend `readImageDimensions`. On reject,
  call `failMarketingGenerationJob` and return a retry hint rather than charging for
  garbage.
- **4c.** Enforce a wall-clock timeout on the image fetch (`AbortController`); there is
  none today, so a hung provider call holds the job open.

> **Note on "releasing" a reservation.** There is no explicit credit hold to release.
> `marketingGenerationBudget.ts` computes in-flight spend by summing `estimated_credits`
> over jobs in `('pending','processing','finalizing')` — so moving a job to `failed` via
> `failMarketingGenerationJob` frees the reservation implicitly, and billing is only
> claimed on the success path. 4b therefore needs no new ledger work: reject **before**
> `claimMarketingGenerationJobBilling`, and the accounting already does the right thing.
> An earlier draft of this plan said "release the reservation"; that was wrong.

---

### Phase 5 — Tests

First tests for this path. Mirror `marketingGenerationPricing_test.ts` style.

- `marketingImagePromptBuilder_test.ts` — deterministic assembly, context injection,
  platform framing, negative handling, no-PII assertion.
- `marketingImageGenerationAi_test.ts` — mocked `fetch`: safety block → `GenerationSafetyError`;
  no image part → `GenerationProviderError`; key rotation; usage extraction; base64 round-trip.
- Enhancement **fail-open** test — the single most important one; a broken cheap call
  must never break a paid generation.

---

### Phase 6 — Cost, caching, transparency

- **6a.** Cache enhanced prompts via the existing `aiQuotaCache` (reuse the
  `marketingCaptionAi` pattern). Cache the _enhancement_, not the image.
- **6b.** Optional `seed` for reproducible re-rolls, enabling "same shot, small change".
- **6c.** Disclose SynthID watermarking in the Generate tab and the route guide.
- **6d.** Show the enhanced prompt in the job card, with a copy action and an
  "use my exact wording" toggle.

## Evaluation protocol

Phase 1's whole justification is "the images get better", so this has to be measurable
rather than a vibe check. Without it we cannot tell enhancement from placebo.

**Corpus.** 20 prompts: 10 real ones hosts have actually typed (needed from the user),
10 synthetic covering the known shapes — bare noun (`"pool"`), short phrase
(`"bright living room morning light"`), over-long rambling, conflicting styles, a
non-English/Taglish prompt, and one with references attached.

**Method.**

- Generate each prompt pre- and post-enhancement at the **same tier, aspect, and seed**
  where seeds are available, so the prompt is the only variable.
- Present pairs **blind and order-randomized** to the reviewer. Self-scoring by the model
  that wrote the enhancement is not evidence.
- The **user is the judge** — "Instagrammable" is their taste and their market, not the
  implementer's.

**Score each image 1–5 on:** photorealism (no plastic/warped artifacts), brand fit,
postability (would you publish this as-is), prompt fidelity (did it honor what was asked).

**Ship gate.** Mean postability improves by **≥1.0** with no category regressing more
than 0.3, and zero new safety blocks across the corpus. If enhancement wins on realism
but loses on fidelity, that is a prompt-rewriting bug — fix before shipping, because a
beautiful image of the wrong thing is worse than a plain image of the right one.

**Also record**, since these gate Phases 4 and 6: enhancement p50/p95 latency, fail-open
rate, and measured cost per enhancement against the ~$0.0002 estimate.

## Sequencing

| Phase                   | Effort | Value         | Risk            |
| ----------------------- | ------ | ------------- | --------------- |
| 1 — Prompt enhancement  | M      | **Very high** | Low (fail-open) |
| 2 — Property context    | S      | **High**      | Low             |
| 3 — Platform + presets  | M      | **High**      | Low             |
| 4 — Validation & retry  | M      | Medium        | Low             |
| 5 — Tests               | S–M    | Medium        | None            |
| 6 — Cost & transparency | S      | Medium        | Low             |

Recommended: **1 → 2 → 3**, evaluate, then 5 → 4 → 6.

## Non-goals

- Swapping providers. Gemini 3 Pro Image is competitive; the gap is our prompt layer.
- Changing the credit/pricing model or the job/sweeper lifecycle — both are sound.
- Video generation quality (separate plan).
- Fine-tuning or a custom rewriter model — Flash-Lite is sufficient and far cheaper.

## Decisions (locked 2026-09-23)

These were open questions; all four are now settled and the phases above reflect them.
Reopening any of them is a plan change, not an implementation detail.

| #   | Decision                                                                             | Rationale                                                                                                                                                                                               | Binds     |
| --- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| 1   | **Enhancement on by default**, per-generation opt-out toggle in the composer         | Defaults drive quality; opt-in means most hosts never find it. The toggle serves the host who wrote a precise prompt and wants it sent verbatim                                                         | 1c, 6d    |
| 2   | **Absorb the enhancement cost as platform cost** — do not bill host credits          | At ~$0.0002 against a $0.045–$0.24 image, metering costs more in complexity and host confusion than the money. Billing it also means paying twice for one image, which is hard to explain on an invoice | 1c        |
| 3   | **Draft tier gets enhancement too** — no tier skips it                               | Draft is where weak prompts hurt most and where hosts decide if the feature is any good. Skipping saves $0.0002 and risks the first impression                                                          | 1c        |
| 4   | **Per-property house style deferred** to a Phase 3 extension, not in the first slice | Real feature, needs its own UI and settings surface; must not gate Phases 1–3                                                                                                                           | 3, future |

### What decision 2 means in code

Absorbing the cost is not "skip the accounting" — it means the enhancement call is
recorded but not charged:

- Still call `recordAiUsage` with `feature: 'marketing_image_prompt_enhance'` so platform
  cost stays observable in `super-admin-ai-usage` and the AI usage dashboards.
- Do **not** add its credits to the job's `credits_consumed`, and do **not** include it in
  `estimateGenerationCredits`. The host-facing credit number stays exactly what it is
  today — this is the property that must not regress.
- `checkQuotaAndBudget` is unchanged; the enhancement is not part of the reservation.
- Platform-level cost caps still apply, so a runaway enhancement loop is caught by the
  existing kill switch rather than by host billing.

## Docs to update when implemented

- `docs/guides/routes/org/` Marketing Studio route guide — Generate tab behavior,
  enhancement toggle, SynthID disclosure (`route-guides` skill).
- `docs/PROJECT.md` — new `marketing_image_prompt_enhance` AI feature + env vars.
- `docs/architecture/overview.md` — if the enhancement call changes the AI call graph.
- `plans-and-permissions` — no new gate expected (enhancement rides the existing
  Marketing Studio entitlement); confirm and record N/A at implementation time.
- `audit-logging` — **decided**: no new event. Add `prompt_enhanced` and the resolved
  preset to the existing `marketing.image_generated` metadata, which already carries
  model, tier, aspect, size, reference count, and credits.
- `mobile-responsive` — Phases 3c and 6d touch the composer UI; required before done.
- `human-copy` — the opt-out toggle, SynthID disclosure, and preset names are all
  user-facing strings.

## Still needed before this plan can move to done

1. **10 real host prompts** for the evaluation corpus, plus the image pairs and a
   blind score. Synthetic prompts alone flatter the enhancer. See the status note
   at the top.
2. **Fully-populated property context — closed 2026-09-24.** The real settings shape
   (`enabledAmenities` / `customAmenities`, listing name, brand color) is what the
   loader reads now, and the prompt-builder tests assert it.
3. **Examples of bad output**, if any were kept. Useful, not blocking.
4. **Confirmation of the ship gate** (mean postability +1.0) once the first image
   pairs exist. The threshold is a starting number, not a measured one.

## Known scope boundary

This audit covered the **image** path only. Video shares `generate-marketing-media` and
has the same missing prompt layer, but Veo's prompting model differs enough (motion,
camera movement, temporal consistency) that transferring these fixes untested would be a
guess. Worth a separate plan if video quality is also a concern.

## Sources

- [Gemini API — image generation docs](https://ai.google.dev/gemini-api/docs/image-generation)
- [Gemini 3 developer guide](https://ai.google.dev/gemini-api/docs/gemini-3)
- [Gemini 3 prompting best practices — Phil Schmid](https://www.philschmid.de/gemini-3-prompt-practices)
- [Gemini 3 Pro Image (Vertex AI)](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/models/gemini/3-pro-image)
- [PromptEnhancer: CoT prompt rewriting](https://arxiv.org/html/2509.04545v5) · [CVPR 2026 paper](https://openaccess.thecvf.com/content/CVPR2026/papers/Wang_PromptEnhancer_Taming_Your_Rewriter_for_Text-to-Image_Generation_via_Fine-Grained_Reward_CVPR_2026_paper.pdf)
- [APE: Agentic Prompt Enhancer](https://arxiv.org/html/2606.00204v1)
- [Input-side inference-time scaling for T2I](https://arxiv.org/html/2510.12041v2)
- [Master Gemini 3 Pro Image API for production visuals](https://iamdgarcia.medium.com/master-gemini-3-pro-image-api-for-production-visuals-practical-guidance-for-engineers-cc816a90cb82)
