---
title: 'Compress images'
status: active
tags: [workflow, planned, production-readiness, media, storage]
updated: 2026-09-17
stage: planned
kind: plan
---

# 09 — Compress images

## Implementation status (2026-09-17)

**Phase 9.6 (CI size guard): done (review pass 2026-09-17).** `scripts/dev/check-public-asset-size.sh` fails images over 512 KiB and other `ui/public` files over 2.5 MiB unless allowlisted. Wired into `ci.yml`, `cd-dev.yml`, and `bun run ci:quality`. Would have caught the 2.27 MB hero banner.

**Phase 9.5 (static assets): done.** Audited `ui/public/**` by file size. Found and removed `ui/public/images/hero-banner.png` — a 2.27 MB, 1554×670 PNG with **zero references anywhere in `ui/src`** (grepped `.tsx`/`.ts`/`.css`/`.html`/`.json`, confirmed dead), shipped in every build for no reason. Everything else in `ui/public` (logo at 1500×1500 for high-DPI, PWA/favicon icon set, the guest-facing GCash QR payment JPEG, avatar art) is sized appropriately for its actual display use — not re-encoded, since none are outliers and re-encoding without a measured before/after risks a visible-quality regression on brand assets for a marginal byte saving.

**Phase 9.2 (responsive delivery via Supabase Storage transforms): explicitly NOT done this pass — deferred, not skipped silently.** Reasons:

1. **Image transformations are a paid Supabase add-on**, and this repo has no config flag or existing usage confirming it is enabled/billed-for on the hosted project (`supabase/config.toml` has no `image_transformation` entry; grepped for any `/render/image/` usage anywhere in `ui/src`/`supabase/functions` — zero hits). Wiring `srcset` against an endpoint that may not be provisioned would silently 404 or fail closed in production.
2. **The doc's own edge case requires this land alongside cost tracking** ("Restrict to a fixed allowlist of widths... belongs in the service-cost matrix"). That matrix is [`super-admin-service-cost-monitoring.md`](../super-admin-service-cost-monitoring.md) — itself still in `planned`, not built. Shipping a billable, always-on transform feature with no cost guard in front of it is exactly the kind of blind commitment this pass is trying to avoid.
3. `ui/src/features/guest/marketing/shared/components/MarketingImage.tsx` already declares a `sizes` prop in its interface (unused by every current caller — confirmed via grep) — this is the natural hook point for `srcset` once transforms are confirmed enabled and cost-bounded. Left as-is rather than wired to a fake/unverified endpoint.

**Phase 9.1 (OCR-regression gate for `guest-documents`), 9.3 (AVIF), 9.4 (backfill): not attempted**, per the original scoping decision — each needs either a real fixture set + manual test pass, a live before/after measurement, or production bucket access, none of which are safe to fake or skip in a blind code-only pass. Re-confirmed the gate is still active and intentional in `docs/architecture/storage.md` §7.1 (unchanged from the prior audit).

## Measured before / after

| Metric                             | Before                                     | After                                                                    | Difference                                                      |
| ---------------------------------- | ------------------------------------------ | ------------------------------------------------------------------------ | --------------------------------------------------------------- |
| `ui/public/images/hero-banner.png` | 2.27 MB, 1554×670, **zero references**     | Deleted                                                                  | **−2.27 MB on every build**                                     |
| Largest remaining public raster    | Hero banner                                | `avatars/receptionist-turtle-idle.png` (402 KB)                          | Dead PNG gone; talking-avatar MP4 (2.0 MB) is a justified video |
| Upload pipeline                    | Already shipped (Web Worker, WebP presets) | Unchanged                                                                | Not re-built                                                    |
| `ui/public` size CI                | None                                       | `scripts/dev/check-public-asset-size.sh` (images 512 KiB, other 2.5 MiB) | A second 2 MB PNG cannot land unnoticed                         |
| Storage transforms / `srcset`      | Not enabled                                | Still not wired                                                          | Blocked on paid add-on + cost guard                             |
| `guest-documents` OCR gate         | Still off                                  | Still off                                                                | Highest-risk win remains gated                                  |

## Remaining work to finalize

Dead hero PNG + `ui/public` size CI are shipped. Upload pipeline was already done in a prior plan. Everything that needs **Storage transforms, OCR, or a cost guard** is still open.

| #   | Work                                                                                                                   | Blocker                         |
| --- | ---------------------------------------------------------------------------------------------------------------------- | ------------------------------- |
| 1   | Turn on the `guest-documents` OCR size/type gate with real fixtures.                                                   | OCR fixtures + product decision |
| 2   | Enable Storage image transforms + `srcset` only after the paid add-on and a cost matrix / cap are documented (doc 25). | Paid feature + cost guard       |
| 3   | AVIF (or next-gen) output in the client pipeline if the cost/quality tradeoff is accepted.                             | Depends on 2 / product          |
| 4   | Backfill existing Storage objects that are still uncompressed originals.                                               | Hosted Storage + 2              |
| 5   | Compress / replace remaining email and marketing raster assets that are not in `ui/public`.                            | Asset inventory                 |
| 6   | `mediaTelemetry` panel (or equivalent) so oversized uploads are visible.                                               | Code                            |

## Prior art — this item is largely SHIPPED

[`image-video-upload-optimization.md`](../../done/image-video-upload-optimization.md) (done 2026-08-30) already built a complete client-side pipeline. Documented in `docs/architecture/storage.md` §7.1. **Do not rebuild any of this:**

| Shipped                        | Detail                                                                                                              |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------- |
| Client re-encode before upload | `prepareUpload` → `prepareImageForUpload` → `optimizeImage`, Web Worker, `browser-image-compression`                |
| Quality-first presets          | `PHOTO_MASTER` (3840px WebP q0.82), `CONTENT` (2048px), `AVATAR` (512px), `DOCUMENT` (near-lossless), `NONE`        |
| Lazy library load              | Dynamically imported; CI-asserted by `scripts/media/assert-lazy-optimizer.mjs`                                      |
| Self-hosted worker asset       | No CDN dependency                                                                                                   |
| Unified server ceilings        | `_shared/uploadLimits.ts` + client mirror + parity unit test (image 10 MB, avatar 5, document 12, pdf 12, video 50) |
| Safety properties              | Never upscales, never returns a larger file, bakes EXIF orientation, preserves alpha, never throws                  |
| Kill switch + staged rollout   | `VITE_DISABLE_IMAGE_OPTIMIZATION`, `VITE_IMAGE_OPT_SURFACES`                                                        |
| Telemetry                      | `mediaTelemetry.ts` records surface, preset, byte ratio, duration                                                   |
| Tooling                        | `media:storage-audit`, `media:ab-compare`, `test:media:quality`                                                     |

## Remaining gaps — this is the actual work

### Gap 1 — `guest-documents` is still ceiling-only

Per `docs/architecture/storage.md`, the `guest-documents` rollout group (guest booking-form IDs, receipts, vaccination docs, guest review media) is **deliberately excluded** from re-encoding pending an **OCR-regression gate**. These are exactly the images AI receipt validation and GAF/pet document flows read.

This is the single largest remaining compression win _and_ the highest-risk one. It stays gated until the regression run proves OCR/AI extraction accuracy does not drop.

### Gap 2 — No server-side / delivery-time resizing

Compression happens **once, at upload**. Delivery still serves one full-resolution file per image regardless of the viewport. A 3840px `PHOTO_MASTER` gallery original is sent to a 375px phone. Already noted in [`performance-optimization-production-readiness.md`](../../for-testing/performance-optimization-production-readiness.md) §D.5.

### Gap 3 — No modern-format negotiation at delivery

Everything is stored WebP. AVIF is meaningfully smaller and now broadly supported, but there is no negotiation path since files are static objects in Storage.

### Gap 4 — Pre-existing stored media was never reprocessed

Images uploaded before the pipeline shipped, and anything uploaded while a surface was gated off, are stored unoptimized.

## Phases

### Phase 9.1 — Close the `guest-documents` gate

Run the §9.7 OCR-regression procedure in `docs/guides/testing/image-upload-optimization-manual.md`:

- Fixture set of real-shaped documents: PH IDs, GCash receipts, bank transfer screenshots, vaccination cards, handwritten signatures.
- Run AI extraction (`receiptValidationService`, GAF/pet document flows) against original vs `DOCUMENT`-preset output.
- Pass condition: **zero** regressions in extracted field accuracy across the fixture set.
- On pass, widen `VITE_IMAGE_OPT_SURFACES` to include `guest-documents`; on fail, keep the gate and record which preset parameter caused it.

**Edge case:** the `DOCUMENT` preset is already near-lossless and passes files through untouched under the ceiling, so the realistic risk is confined to oversized scans that get downscaled to the 3000px cap. Test specifically at that boundary.

### Phase 9.2 — Responsive delivery (biggest remaining win)

Add width-variant delivery via Supabase Storage image transformations (or an equivalent transform layer), then:

- Extend `MarketingImage` to emit `srcset` + `sizes` for a fixed width ladder (e.g. 320/640/960/1280/1920).
- Apply to gallery, listing cards, hero, marketing previews, avatars.
- Keep the stored original as the master; transforms are a delivery concern.

**Edge case — cost.** Transform requests are billable and can be triggered by arbitrary query params. Restrict to a fixed allowlist of widths, and cache hard (doc 16). An unbounded transform endpoint is a cost-amplification vector and belongs in the [`super-admin-service-cost-monitoring.md`](../super-admin-service-cost-monitoring.md) matrix.

**Edge case — private buckets.** Guest PII buckets are private and read through short-lived signed URLs (`_shared/storageSignedUrl.ts`). Signed URLs plus transforms plus `srcset` interact badly: each variant needs its own signed URL, and they expire. For private media, prefer a single appropriately sized variant over a full `srcset`.

### Phase 9.3 — AVIF where it pays

Only after 9.2. Emit AVIF in a `<picture>` source with WebP fallback for the largest surfaces (hero, gallery). Measure: AVIF encode is slow and the win is small on already-optimized WebP at q0.82. **Skip if the measured saving is under ~15%** — this is the phase most likely to be net-negative.

### Phase 9.4 — Backfill stored media

- Use `bun run media:storage-audit` to inventory bucket contents by size, format, and upload date.
- Identify pre-pipeline and gated-off objects.
- Write a one-shot backfill script that re-encodes in place, preserving the DB path (no path churn), idempotent, resumable, and dry-run first.
- Document it in `docs/archive/operations/migration-runbook.md` per repo convention.

**Edge case:** never re-encode a `DOCUMENT`-class object during backfill until 9.1 passes. Never re-encode PDFs, SVGs, or animated images (the `NONE` preset exists for exactly this).

**Edge case:** in-place rewrite of an object that a signed URL currently points to can serve a truncated file mid-write. Write to a temp path, verify, then swap.

### Phase 9.5 — Non-upload images

The pipeline covers **uploads**. Also audit:

- Static assets in `ui/public/**` (icons, favicons, `og:` images, template previews, `ui/public/templates`) — compress at build time; these bypass the upload pipeline entirely.
- AI-generated marketing imagery — confirm it routes through the same storage + optimization path.
- Email template images (`_shared/email-assets`) — email clients do not support AVIF and often not WebP. **Keep JPEG/PNG for email**, compressed. Getting this wrong shows broken images in Gmail.
- PDF-embedded images (`pdfService.ts`) — compression affects printed document quality; leave near-lossless.

### Phase 9.6 — Guard

- Add a CI check that fails if any file in `ui/public/**` exceeds a size threshold without justification.
- Keep `test:media:quality` in the quality gate.
- Add a telemetry-backed dashboard panel (via existing `mediaTelemetry`) for median byte-ratio per surface, so a preset regression is visible.

## Edge cases

- **HEIC from iPhones** — Chrome cannot decode it, so it falls to `NONE` pass-through and uploads at full size. Real-world guests upload HEIC constantly. Measure how often this happens via telemetry; consider a server-side conversion path if it is common.
- **EXIF stripping is a privacy win** — re-encoding removes GPS coordinates from guest-uploaded photos. Confirm this is happening for guest media and state it in the privacy docs; a `NONE` pass-through retains GPS.
- **Screenshots of receipts** — text-heavy images compress badly with lossy WebP and lose legibility precisely where a human reviewer needs it. This is why `DOCUMENT` is near-lossless; keep it that way.
- **Double compression** — a file that was compressed client-side and then transformed at delivery is compressed twice; artifacts compound. Transform from the master, never from an already-degraded variant.
- **Storage cost vs egress cost** — storing multiple variants trades storage for egress. Measure both before committing (doc 25).

## Exit gate

- [ ] OCR-regression gate run; `guest-documents` either enabled with zero accuracy regression, or the failure documented with the specific preset parameter at fault.
- [ ] Responsive `srcset` live on gallery/listing/hero, with a fixed width allowlist and cache headers.
- [ ] Private-bucket media deliberately excluded from `srcset`, using a single sized variant.
- [ ] Transform cost bounded and added to the service-cost matrix.
- [ ] AVIF shipped only where it measured a ≥15% win, or explicitly declined with numbers.
- [ ] Storage audit complete; backfill run dry-run-first, idempotent, with before/after totals.
- [ ] `ui/public/**` and email assets compressed; email images stay JPEG/PNG.
- [ ] Median byte-ratio telemetry visible per surface.

## Docs / Plans / activity-log

- **Docs:** `docs/architecture/storage.md` §7.1 (mandatory), `docs/guides/testing/image-upload-optimization-manual.md`, `docs/archive/operations/migration-runbook.md` for the backfill.
- **Plans / Team RBAC:** N/A — no new host capability. If transform cost becomes plan-gated, revisit with `plans-and-permissions`.
- **activity-log:** N/A for delivery changes. A storage backfill that rewrites org media should log a `system`-tier event or be explicitly marked `activity-log: N/A — one-shot operator migration, recorded in the runbook`.
