---
title: 'Image & Video Upload Optimization — manual QA'
status: active
tags: [guides, testing, media, storage, performance, uploads]
updated: 2026-08-30
---

# Image & Video Upload Optimization — manual QA

Client-side compression + unified upload ceilings. Architecture: [`storage.md`](../../architecture/storage.md) §7.1.
Plan + open items: [`../../workflow/done/image-video-upload-optimization.md`](../../workflow/done/image-video-upload-optimization.md).

Code entry points:

- `ui/src/lib/media/prepareUpload.ts` — front door every uploader calls.
- `ui/src/lib/media/imageOptimizationPlan.ts` — pure decision core (Vitest: 30 cases across 3 files, `bun run test`).
- `ui/src/lib/media/imageOptimization.ts` — Web Worker orchestrator, lazy library load.
- `supabase/functions/_shared/uploadLimits.ts` + `ui/src/lib/media/uploadLimits.ts` — mirrored ceilings.

## Unified ceilings

| Kind                 | Ceiling | Error string                    |
| -------------------- | ------- | ------------------------------- |
| image                | 10 MB   | `File must be 10 MB or smaller` |
| avatar / logo        | 5 MB    | `File must be 5 MB or smaller`  |
| document image / PDF | 12 MB   | `File must be 12 MB or smaller` |
| video                | 50 MB   | `File must be 50 MB or smaller` |

## Presets by surface

| Preset         | Surfaces (host)                                                                                                                   | Surfaces (guest)                                         |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| `PHOTO_MASTER` | property media, parking media, development media                                                                                  | —                                                        |
| `CONTENT`      | property template section/inline images, app-settings review images, support-ticket image attachments                             | guest review media, guest web-chat images                |
| `AVATAR`       | org / app / parking logos, org-settings logo                                                                                      | guest profile photo                                      |
| `DOCUMENT`     | booking assets (IDs/receipts/GAF/vaccination), gcash QR, listing-authorization + org-verification proofs, onboarding verification | guest-form valid IDs / payment receipt / pet vaccination |
| (no re-encode) | PDF, SVG, animated PNG/WebP/GIF, undecodable source (HEIC on Chrome), pet photo passes through `CONTENT`                          | same                                                     |

## 1. Functional pass (every surface)

For each surface above:

1. Upload a large (>12 MP) JPEG/PNG. Expect: fast preview, upload succeeds, stored file is smaller, and — for non-`DOCUMENT` presets — the stored file is `.webp`.
2. Upload a file **over** the kind's ceiling. Expect the exact error string above (client-side, before any request).
3. Upload a HEIC from an iPhone. On Safari it should re-encode; on Chrome it should pass through **untouched** (never an error).
4. Upload an animated GIF / APNG. Expect pass-through untouched.
5. Rapidly re-pick a different file before the first finishes. Expect no stale upload, no crash.
6. Build with `VITE_DISABLE_IMAGE_OPTIMIZATION=1`. Expect every upload to pass through untouched (ceiling checks still apply).

## 2. Quality gate (§9.2 / §9.4 — human sign-off, blocks prod enablement)

Per surface / preset, on a calibrated display (ideally 4K+):

- **Metrics (automated)** — `bun run test:media:quality` (§5) asserts SSIM ≥ 0.98, flat-region ΔE ≤ 3, median byte reduction ≥ 50%, never-larger, long-edge floor. Add real photos to `fixtures/media/` first.
- **Blind A/B (human)** — `bun run media:ab-compare -- --fixtures docs/guides/testing/fixtures/media --preset PHOTO_MASTER --out tmp/ab.html` generates a randomized, label-hidden compare page (100% + fit). ≥ 2 reviewers open it on a 4K+ display, answer every pair, export the CSV. **Gate:** no reviewer reliably identifies the optimized image, zero "degraded" marks. Record verdict + reviewers + date below before enabling the surface.

| Surface / preset              | Metrics | Blind A/B | Reviewer | Date | Prod-enabled |
| ----------------------------- | ------- | --------- | -------- | ---- | ------------ |
| property media / PHOTO_MASTER | ☐       | ☐         |          |      | ☐            |
| content images / CONTENT      | ☐       | ☐         |          |      | ☐            |
| avatars / AVATAR              | ☐       | ☐         |          |      | ☐            |
| guest-form docs / DOCUMENT    | ☐       | ☐         |          |      | ☐            |
| marketing export (JPEG q0.92) | ☐       | ☐         |          |      | ☐            |

## 3. OCR / approval regression (§9.7 — blocks `DOCUMENT` prod enablement)

Harness: `supabase/functions/tests/ocrRegression.test.ts`. Provide a corpus dir of receipt / ID images (**synthetic or sample — never real guest PII**) + optional `expected.json`, then against a local or staging stack:

```
OCR_CORPUS_DIR=./tmp/ocr-corpus GEMINI_API_KEY=… GROQ_API_KEY=… \
  deno test --allow-read --allow-env --allow-net supabase/functions/tests/ocrRegression.test.ts
```

It runs the real `validateReceiptFile` / `validateValidIdFile` on each image raw and again after the `DOCUMENT` re-encode, and fails if any `has_amount` / `has_date` / `has_reference` flag, extracted value, or verdict regresses. **Gate: ±0 regressions.** Because `DOCUMENT` is pass-through under 3000px + 12 MB, most of a real corpus won't be re-encoded — this mainly guards the over-cap branch. Also spot-check the manual GAF/pet approval email flow.

## 4. Performance budgets (§10 — measure on the reference device)

- Main thread stays responsive during a 9-image multi-select (no long tasks > 50 ms attributable to optimization).
- `browser-image-compression` is **not** in the initial bundle — `node scripts/media/assert-lazy-optimizer.mjs` after `bun run build` (also runs in `.github/workflows/ci.yml` and `bun run ci:quality`).
- Concurrency cap: at most 2–3 parallel optimizations (`ui/src/lib/media/optimizeQueue.ts`).
- Guest form with 3–4 images submits within budget vs. the pre-change baseline.

## 5. Automated quality gate (§9.2 — encode-loss half)

`node scripts/media/quality-check.mjs` (`bun run test:media:quality`; `--json` for machine output; `--fixtures <dir>` to point elsewhere). Runs each photo preset over a synthetic trap corpus + any real images in `docs/guides/testing/fixtures/media/`, in real Chromium, and asserts SSIM ≥ 0.98, flat-region ΔE ≤ 3, "never larger", long-edge floor, and median byte reduction ≥ 50%. Requires the repo's Playwright Chromium. This covers **encode loss only** — the blind A/B (§2 above) and OCR regression (§3) still need human / endpoint sign-off.

## 6. Staged rollout (§12)

`VITE_IMAGE_OPT_SURFACES` gates which surfaces re-encode (ceiling checks always run).

**Shipped default (env unset):** `settings`, `galleries`, `marketing`, and `guest-profile` optimize; **`guest-documents` is a ceiling-only pass-through** until §3 (OCR regression) passes — those surfaces upload the untouched original today, so there is zero AI-extraction risk from shipping now.

**To finish the rollout:** run §5 (automated) + §2 (blind A/B) on the four live groups to confirm no visible loss, then run §3 (OCR) and set `VITE_IMAGE_OPT_SURFACES=all` to bring guest booking-form documents + guest review media into optimization.

To dial _back_ instead (e.g. a regression report on one group), set an explicit CSV, e.g. `settings,galleries`. Canary each change on the team's own org first; abort criterion: `error + passthrough` rate > 15% on a surface, or any confirmed "blurry/degraded" report.

## 7. Storage baseline

`bun run media:storage-audit` (read-only; `--json` for machine output) before rollout and at the +6-week review to confirm the per-bucket size reduction.
