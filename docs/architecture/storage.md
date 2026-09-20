---
title: 'Storage'
status: active
tags: [architecture, storage]
updated: 2026-09-11
---

# Storage

Part of the [`docs/PROJECT.md`](../PROJECT.md) architecture split.

---

## 7. Storage

Buckets and MIME types are declared in `supabase/config.toml` (e.g. `payment-receipts`, `pet-vaccinations`); additional buckets appear in SQL migrations (`pet-images`, etc.). `UploadService` uploads via service role and stores canonical public-format paths in Postgres. **Guest PII buckets** (`payment-receipts`, `valid-ids`, `pet-vaccinations`, `pet-images`, `parking-endorsements`) are **private** after `20261310120100_guest_doc_storage_private_reads.sql`; reads use short-lived signed URLs from `_shared/storageSignedUrl.ts` (`get-form` for guests, `get-booking-asset-url` for admin).

### 7.1 Media optimization (images + upload ceilings)

Plan: [`docs/workflow/done/image-video-upload-optimization.md`](../workflow/done/image-video-upload-optimization.md).

**Client-side compression.** Every image uploader routes the picked file through `prepareUpload` (`ui/src/lib/media/prepareUpload.ts`) before building its request body. `prepareUpload` validates video / PDF against the ceiling untouched, and sends images through `prepareImageForUpload` → `optimizeImage`: re-encode/downscale in a Web Worker (`browser-image-compression`), then re-validate the result against the ceiling. The library is **dynamically `import()`-ed** (only once a re-encode is actually needed) so it never lands in the initial/vendor bundle — CI enforces this via `scripts/media/assert-lazy-optimizer.mjs` (wired into `.github/workflows/ci.yml` + `scripts/dev/ci-quality-gate.sh`). The worker loads a self-hosted copy of the lib (`?url` asset), never a CDN. Per-optimization telemetry (surface, preset, path, byte ratio, duration) flows through `ui/src/lib/media/mediaTelemetry.ts`. Quality-first presets (`ui/src/lib/media/imageOptimizationPlan.ts`):

| Preset         | Long edge  | Output                                                                      | Used for                                                                          |
| -------------- | ---------- | --------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `PHOTO_MASTER` | 3840px     | WebP q0.82                                                                  | property/parking/development gallery, showcase hero, marketing backgrounds        |
| `CONTENT`      | 2048px     | WebP q0.82                                                                  | in-page/template/stay-guide images, guest review + chat images                    |
| `AVATAR`       | 512px      | WebP q0.85 (PNG if alpha)                                                   | guest profile photo, org/app/parking logos                                        |
| `DOCUMENT`     | 3000px cap | keep source format, near-lossless; pass through untouched under the ceiling | valid ID, receipts, vaccination, signatures, QR, verification/authorization proof |
| `NONE`         | —          | pass through                                                                | PDF, SVG, animated, undecodable (e.g. HEIC on Chrome)                             |

The optimizer **never upscales, never returns a larger file, bakes EXIF orientation, and preserves alpha.** It never throws — any failure falls back to the untouched original.

**Rollout controls.** Global kill switch: build with `VITE_DISABLE_IMAGE_OPTIMIZATION=1` → no-op everywhere. Per-surface staged rollout (`ui/src/lib/media/optimizationSurfaces.ts`): `VITE_IMAGE_OPT_SURFACES` — **unset** enables every group **except `guest-documents`** (guest booking-form IDs/receipts + guest review media), which stays a ceiling-only pass-through until the §9.7 OCR-regression gate is run; `all` enables everything; `none` disables all re-encoding; a CSV of rollout groups (`settings` → `galleries` → `marketing` → `guest-profile` → `guest-documents`, lowest blast radius first) / surface ids enables just those. A gated-off surface still runs the ceiling check — only the re-encode is skipped. Widen to `all` (or add `guest-documents`) once that gate and the §9.4 blind-A/B pass — see [`../guides/testing/image-upload-optimization-manual.md`](../guides/testing/image-upload-optimization-manual.md).

**Unified server ceilings** — `supabase/functions/_shared/uploadLimits.ts` (`assertWithinUploadLimit`), mirrored by `ui/src/lib/media/uploadLimits.ts` (parity unit test). These replace ~7 per-function hardcoded limits:

| Kind                            | Ceiling |
| ------------------------------- | ------- |
| image (photo/gallery/marketing) | 10 MB   |
| avatar / logo                   | 5 MB    |
| document image / PDF            | 12 MB   |
| video                           | 50 MB   |

Ceilings are a **bypass safety net**, not the mechanism — set generously so a legitimate photo is never rejected. Every `upload-*` / `submit-*` function calls `assertWithinUploadLimit`; every media bucket's `allowed_mime_types` includes `image/webp` (client output) + `image/heic`/`heif` (pass-through), and `file_size_limit` is `>=` the matching ceiling. Bucket updates: migration `20261213120600_media_optimization_bucket_limits.sql` + `supabase/config.toml`.

**Marketing Studio exports** (Polotno / calendar builder) render as a **bounded JPEG q0.92** (`exportPolotnoStoreImage`, `ui/.../lib/polotno/polotnoStore.ts`) instead of a raw 2× PNG data URL, and `PublishDialog` rejects a still-oversized image payload with a friendly message before it reaches the Meta Graph API.

Backfill of already-stored images is **out of scope** (originals are not retained; the pre-rollout quality gate is the safeguard). Delivery-time variants (Supabase Image Transformation) are deferred — see the plan §16 Phase 4.

### 7.2 Upload `cacheControl` and signed-URL disposition (production-readiness doc 16 / 20)

Every `.upload()` call site in `supabase/functions/**` now sets an explicit `cacheControl` (shared helpers plus handler-level uploads). CI: `node scripts/dev/check-storage-cache-control.mjs`. Previously several handler sites fell back to the Supabase Storage default (3600s):

- **Content-addressed paths** (`upsert: false`, `crypto.randomUUID()` in the path — org verification, listing authorization, property media, support ticket attachments, AI assistant attachments, inbox chat assets) → `cacheControl: '31536000'` (1 year). The object is never replaced in place, so a long cache is safe.
- **Replace-in-place paths** (`upsert: true`, fixed slug — org/team logos, app settings assets, GCash QR, marketing exports, property templates, generic `uploadService`/`storageUpload` helpers) → `cacheControl: '300'` (5 min). A long cache here would serve stale bytes after a re-upload to the same key.

**Magic-byte MIME (doc 20):** `_shared/sniffMime.ts` (`assertMimeMatchesBytes`) is required on guest-document uploads (`uploadService.ts`) and booking-asset uploads (`bookingAssetUpload.ts`). Client `Content-Type` that does not match the file bytes is rejected.

**SVG:** `image/svg+xml` is not an allowed property-gallery type (`propertyMedia.ts` server + client). Existing objects already in `property-media` are unchanged; new SVG uploads are rejected.

**Signed-URL `Content-Disposition`**: `_shared/bookingDocumentShareToken.ts` (approved GAF/Pet PDFs, guest-facing durable share links) now passes `{ download: true }` to `createSignedUrl`, since these are always finished PDFs handed to guests as proof and never rendered inline.

Deliberately **not** applied to `_shared/storageSignedUrl.ts` (`createSignedStorageUrlIfPrivate`, used by `get-form`), `get-booking-asset-url`, `get-org-verification-assets`, or `get-listing-authorization-assets`: these feed admin/guest UI that renders images and PDFs **inline** for review (`BookingDetailAssetPreviewModal.tsx`, `VerificationDocPreview.tsx`, `GuestAvatar.tsx`) — forcing `download: true` there would break that preview UX. A blanket disposition policy is wrong for this bucket set; any future change needs a per-consumer UI check first, not a mechanical sweep.

**New-flow buckets (Phase 0):** `parking-endorsements`, `approved-gafs`, `approved-pet-forms`, `sd-refund-receipts`. Guest doc buckets + parking endorsements are private (cost-abuse Phase 2); admin PDF buckets were always private. Defined in `20260501000006`–`20260501000008` + `20261310120000` / `20261310120100`. See [[NEW_FLOW_PLAN|New Booking Flow — Implementation Plan]] §2 and **[[migration-runbook|Migration Runbook — New Booking Flow]] §1.1**.

**Import uploads (Smart AI Data Importer):** **`import-uploads`** — private bucket, **`text/csv`** only, 15 MB file limit. Created in **`20261007120000_import_batches.sql`**. Objects at `{orgId}/{batchId}/{filename}`; written by **`import-parse-file`**, deleted by **`import-cancel`**. Service-role policy only — no guest or anon access.

**Marketing AI generation (Generate tab):** no new bucket — two prefixes inside the existing public **`property-media`** bucket (50 MB, `image/*` + `video/*` + `audio/*`), so no bucket migration and no `config.toml` change.

| Prefix                                       | Written by                               | Retention                                                                                                                                                                       |
| -------------------------------------------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `marketing-ai-refs/{propertyId}/{uuid}{ext}` | `upload-marketing-generation-reference`  | Pruned 90 days after `COALESCE(last_used_at, created_at)` (sweeper pass, Phase 2)                                                                                               |
| `marketing-ai/{propertyId}/{jobId}{ext}`     | `generate-marketing-media` (and sweeper) | **Never auto-pruned** — host assets that may be live on Meta; pruning would break the gallery                                                                                   |
| `marketing-uploads/{propertyId}/{uuid}{ext}` | `upload-marketing-asset`                 | **Never auto-pruned, no DB row** — Design canvas uploads (collage cell photos, Polotno Upload panel); a saved design's `design_json.polotno` references these URLs indefinitely |

Outputs are keyed by **job id**, and the upload is `upsert: true`, so a retried finalize overwrites rather than orphaning a duplicate — the upload step is idempotent by construction. References are magic-byte sniffed (`_shared/marketingGenerationStorage.ts#sniffVisualMime`) and rejected when the sniffed family disagrees with the declared mime, before anything reaches a public bucket. `marketing-uploads/` uses the same sniffing helper, image-only.

**AI dashboard assistant attachments:** **`ai-assistant-attachments`** — private bucket, JPEG/PNG/WebP/PDF, 4 MB. Created in **`20261019120000_ai_assistant_attachments.sql`**. Objects at `{orgId}/{userId}/{conversationId}/{uuid}-{filename}`; written by **`dashboard-assistant-chat`**. Metadata on **`ai_dashboard_assistant_messages.attachments`** (`[{ name, mimeType, size, path }]`). Service-role policy only — bytes are not stored in Postgres and are not logged. **`DELETE dashboard-assistant-conversations?conversation_id=`** removes that conversation's folder (best-effort) before cascading the DB row.
