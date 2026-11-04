---
stage: in-progress
title: 'AI Studio example gallery: generate the photo and clip sample assets'
status: in-progress
tags: [workflow, in-progress, marketing, ai-studio]
updated: 2026-11-03
kind: plan
---

# AI Studio example gallery: generate the photo and clip sample assets

**Split out from:** [`../done/ai-studio-example-gallery.md`](../done/ai-studio-example-gallery.md) (Phase 2), 2026-11-02. That plan shipped — the full gallery, detail view, form wiring, catalog, and asset pipeline are code-complete, tested and QA'd. **Post** examples are live today. This follow-up is only the remaining step: run the already-built pipeline to produce real photo and clip assets.

**Blocked on:** a paid Gemini/Veo API key. The local key is confirmed free-tier — `generate.ts` fails with `Quota exceeded ... generativelanguage.googleapis.com/generate_content_free_tier_requests, limit: 0, model: gemini-3.1-flash-image` ("Generate content requests per day limit exceeded on Free Tier"). Reproduced twice (2026-11-02, ~04:52 and ~09:05 UTC), and confirmed via the shared transport's key-rotation code (`supabase/functions/_shared/ai/llmTransport.ts#withRetries`) that all 5 configured `GEMINI_API_KEYS` were tried, not just one — every one hit the identical hard cap. `limit: 0` is a billing setting, not a quota that refills; retrying without a change to that setting will keep failing. Someone with access to the Google Cloud project(s) behind those keys needs to enable billing (or a different already-billed key needs to be supplied) before this can proceed.

## What's already built (nothing to do here)

- `scripts/marketing/ai-studio-samples/generate.ts` (Deno) — calls the real production image/video generation pipeline against a local seeded org/property (`SAMPLES_ORG_ID` / `SAMPLES_PROPERTY_ID` in `.cache/env.sh`, gitignored) for all 6 photo and 4 clip samples in the catalog.
- `scripts/marketing/ai-studio-samples/export.ts` (Bun + sharp + ffmpeg) — `sources` mode optimizes the Pexels "before" stills (already done, shipped); `samples` mode will read a hand-picked `picks.json`, write the before/after/poster/mp4 files, write `shipped.json`, and rewrite `READY_SAMPLE_IDS` in `ui/src/features/dashboard/marketing/lib/aiStudioSampleAssets.ts`.
- The full catalog (`ui/src/features/dashboard/marketing/lib/aiStudioSamples.ts`) already has all 10 photo/clip recipes defined, typed, and unit-tested — nothing to add there.
- The gallery, detail view and readiness gating (`READY_SAMPLE_IDS`) already correctly hide photo/clip examples until their files exist — confirmed via a live QA pass, no broken or blank states today.

## Tasks

- [ ] Billing enabled on the Google Cloud project behind `GEMINI_API_KEYS` (or a different already-billed key supplied) — **not an engineering task, needs the user**.
- [ ] Run `deno run -A --no-check --sloppy-imports --config scripts/marketing/ai-studio-samples/deno.json scripts/marketing/ai-studio-samples/generate.ts` for all 10 samples (6 photo, 4 clip), a few attempts each per the original plan's quality bar (Standard quality, never edit pixels after generation).
- [ ] Review each candidate against the `social-creative` "does not look AI-generated" checklist (straight verticals, no warped furniture, no gibberish text, no extra limbs/objects, correct light direction; clips: no morphing/flicker/cut).
- [ ] Hand-pick the best take per sample into `scripts/marketing/ai-studio-samples/.cache/picks.json` (gitignored, not committed).
- [ ] Run `bun scripts/marketing/ai-studio-samples/export.ts samples` — ships the files and rewrites `READY_SAMPLE_IDS`.
- [ ] Verify in the app: photo and clip examples appear in the gallery, detail view shows before/after and start-frame/clip correctly, `Use this example` fills the form correctly for each.
- [ ] Local stack compare-to-sample: generate one real photo and one real clip from an applied example and sanity-check the result resembles what the example promised.
- [ ] `bun run test` (marketing suite) stays green; the catalog test's readiness/file-path checks now cover real files instead of the empty `READY_SAMPLE_IDS` case.
- [ ] Update `docs/guides/routes/org/property/marketing.md`'s Progress overview row and `docs/workflow/done/ai-studio-example-gallery.md`'s status line once this ships, noting photo/clip examples are live.

**Estimated cost:** ~$8-10 in Gemini/Veo API usage (per the original plan's estimate: ~6 photos × 3 attempts × ~120 credit-equivalent + 4 clips × 3 attempts × 800 credit-equivalent, on whichever billing account is used).
