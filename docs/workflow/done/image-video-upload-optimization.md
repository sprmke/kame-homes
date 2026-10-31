---
stage: done
title: 'Image & Video Upload Optimization — client-side compression + unified limits'
status: done
tags: [planning, planned-modules, storage, media, performance, uploads]
updated: 2026-08-30
---

# Image & Video Upload Optimization

> **Shipped 2026-08-30.** Phases 0–3 + 5 implemented and wired end to end.
> `bun run type-check` / `lint` / `check:filenames` / `test` (30) / `build` all
> green; §10.6 CI bundle-lazy assertion + §9.2 automated encode-loss quality gate
> pass. Phase 4 (delivery-time variants) deferred per locked decision 3.
>
> **What is live on merge** (`VITE_IMAGE_OPT_SURFACES` unset = safe default):
> client-side downscale + WebP re-encode for the `settings`, `galleries`,
> `marketing` and `guest-profile` groups; the unified image/video/doc ceiling
> (`assertWithinUploadLimit`) on every `upload-*` / `submit-*` edge function and
> all client uploaders; bounded-JPEG Marketing Studio exports; video-limit parity.
> The optimizer library is lazy-`import()`-ed (CI-asserted out of the initial
> bundle) and has a never-throw + full-fallback contract, so no upload path can
> regress.
>
> **Deliberately held back — `guest-documents` group** (guest booking-form
> IDs/receipts + guest review media): ceiling-only pass-through until the §9.7 OCR
> regression is run (`supabase/functions/tests/ocrRegression.test.ts`), then set
> `VITE_IMAGE_OPT_SURFACES=all`. Also open for the operator: §9.4 blind-A/B
> visual sign-off on the four live groups (`scripts/media/build-ab-compare.mjs`),
> §10 perf-budget measurement, and the +6-week storage-baseline review
> (`bun run media:storage-audit`). Runbook:
> [`docs/guides/testing/image-upload-optimization-manual.md`](../../guides/testing/image-upload-optimization-manual.md).

Stop users from filling Supabase Storage with 12–24‑megapixel phone photos. Every image uploaded
anywhere in the app is **downscaled and re‑encoded on the client, in a Web Worker, before it
leaves the browser** — the guest/host sees an instant local preview, the network upload is
_smaller and faster_ than today, and Storage never receives the bloated original. Every uploader
(image **and** video) gets a single, consistent size ceiling instead of the ~7 different
hardcoded limits scattered across the codebase today.

The two hard constraints this plan is built around, both stated by the requester:

1. **No visible quality loss — ever, on any screen.** An optimized image must be
   indistinguishable from the original _to the naked eye_, including full‑screen on a 4K/5K
   display. §8–§9 define exactly how that is achieved and _proven_ before rollout.
2. **No new bugs, no performance regression, no blocked UX.** §10–§12 define the performance
   budgets, the correctness/fallback rules, and the staged rollout + kill switch that keep this
   safe.

> **The request, verbatim:** "auto optimize and reduce the image or video size upon upload …
> not blurry, still looks great on large screens … quality does not reduce, at least to the
> naked eye … don't block the user, do it in the background with an optimistic upload … make
> sure it will not cause any bugs or performance related issues." This plan keeps the optimistic
> feel but **moves the optimization to _before_ the upload on the client**, not a background
> server job — see §2 for why that is the better call.

---

## 1. TL;DR

| Question                                                         | Answer                                                                                                                                                                                                                                                                                                                                                                                                           |
| ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Is this worth doing?                                             | **Yes.** No compression exists anywhere today. A single iPhone photo of a valid ID is 3–8 MB; property galleries allow 9 images/property; nothing bounds it. Pure storage + egress cost, zero user benefit.                                                                                                                                                                                                      |
| Is the "optimistic + background _server_ optimize" design right? | **Half right.** Keep the optimistic preview. Drop the background server re‑optimization — compress on the client _before_ upload instead. Simpler, cheaper, faster, no new infra, Storage never holds the big original even briefly. (§2)                                                                                                                                                                        |
| Will it make users wait?                                         | **No.** Preview is a local `blob:` URL (< 50 ms). Compression runs in a Web Worker — the main thread never blocks. The upload that follows is _faster_ because the file is 50–85% smaller. (§10)                                                                                                                                                                                                                 |
| Will images look worse / blurry on large screens?                | **No, and this is enforced, not hoped.** Masters are sized from real display‑pixel math (§9.1): hero/gallery = **3840 px** long edge (covers 4K native), content = 2048 px, avatars = 512 px. Documents are near‑lossless pass‑through. Every preset has a numeric quality gate (SSIM ≥ 0.98 photos / ≥ 0.99 docs) + a blind A/B sign‑off (§9.2–§9.4) that must pass **before** that surface is enabled in prod. |
| Can a mistake permanently degrade someone's photos?              | Originals are not retained, so the safeguard is process: conservative defaults (§9.8), the pre‑enablement quality gate per surface (§9.4), staged rollout + one‑line kill switch (§12). Worst realistic outcome of a wrong knob is "files a bit larger than optimal", never "degraded images".                                                                                                                   |
| New third‑party dependency?                                      | One: **`browser-image-compression`** (~14 KB gz, own worker, Canvas‑based, bakes EXIF orientation). `@jsquash/*` (WASM MozJPEG/WebP + Lanczos) documented as a later upgrade. (§4)                                                                                                                                                                                                                               |
| Server changes?                                                  | Minimal. Edge functions keep a **hard‑ceiling reject only** (never trust the client), widen MIME allow‑lists to include WebP (§11), and move scattered constants into one shared module. No server‑side image processing.                                                                                                                                                                                        |
| Video?                                                           | **Limit only, no transcoding.** One consistent byte ceiling + clear error + "trim/compress first" guidance. ffmpeg.wasm transcoding is explicitly out of scope.                                                                                                                                                                                                                                                  |
| Backfill of already‑stored images?                               | **Out of scope.** Optional one‑off script noted in §17.                                                                                                                                                                                                                                                                                                                                                          |

---

## 2. Critique of the "optimistic upload + background optimization" idea

The instinct — "don't make the user wait" — is correct. The specific mechanism (upload the
original fast, then re‑optimize server‑side in the background and swap it) is where this plan
diverges, for six concrete reasons:

1. **It doesn't actually save storage on the hot path.** You still receive and write the full
   original. The saving only materialises _after_ the background job runs and _only if_ you then
   delete the original. Until then you've paid for the big write and are storing it.
2. **Swapping a stored file after the fact is expensive and racy.** The public URL is embedded
   in `properties.settings` JSONB / `guest_submissions` columns / chat messages / rendered
   `<img>` tags. A background swap means rewriting the DB reference, purging the CDN, and hoping
   no concurrent edit is in flight. Client‑side compression sidesteps all of it — the URL is
   correct the first time.
3. **Deno edge functions are the wrong place to resize images.** No native `sharp`. The only
   option is WASM (`wasm-vips` / `@jsquash`) — multi‑hundred‑KB cold‑start payloads, the ~256 MB
   function memory cap, CPU‑time limits. Decoding a 25 MB image server‑side is an OOM / timeout
   waiting to happen. The browser already has a hardware‑accelerated image decoder.
4. **It needs a retry queue.** Background job fails → you're stuck with the unoptimized original
   and need a `pg_cron` sweep + status column + observability to find and re‑process stragglers.
   A whole subsystem to avoid work the client can do synchronously.
5. **Double bandwidth.** Original upload + internal re‑download/re‑upload. Client compression
   uploads the small file once.
6. **This is not how the cited apps do it.** Instagram, Discord, Slack, Airbnb web, Notion all
   **downscale + re‑encode in the browser before upload** (Canvas / `OffscreenCanvas` in a
   worker). Cloudinary / Next.js `<Image>` / Supabase Smart CDN operate at _delivery_ time to
   produce per‑viewport variants — but the _stored master_ they receive is already a sanely
   sized upload. We should do both halves, in that order of priority.

**What we keep from the idea:** the optimistic UX. Show a preview the instant the file is picked;
compression + upload happen behind it. If compression is slow enough to notice (> ~400 ms) the
existing "Uploading…" affordance shows "Optimizing…" first. The user never waits on a blocked
thread and never stares at an empty spinner.

---

## 3. How popular apps handle this (research)

| App / tool                                             | Where optimization happens                                                             | Notes                                                                                                                                   |
| ------------------------------------------------------ | -------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Instagram / Discord / Slack web                        | **Client, before upload** — Canvas/`OffscreenCanvas` downscale + re‑encode in a worker | Optimistic local preview; upload is the already‑small file                                                                              |
| Airbnb (host photo upload, web)                        | Client downscale to a max long edge, then upload; server makes display variants        | Master is bounded on the way in                                                                                                         |
| Cloudinary / imgix / Next.js `<Image>`                 | **Delivery time** — transform per request (`w=`, `q=`, `f=auto`)                       | Complements, does not replace, a bounded master                                                                                         |
| Supabase Storage v2 (Smart CDN + Image Transformation) | Delivery time — `getPublicUrl(path, { transform })`                                    | **Pro plan+**, metered **$5 / 1 000 unique images**. Useful for galleries; not free, so not the primary lever for a _cost‑cutting_ goal |
| TinyPNG / Squoosh                                      | Offline / build step; Squoosh's codecs are the `@jsquash/*` WASM packages              | `@jsquash` gets within 2–3% of TinyPNG entirely in‑browser                                                                              |

**Takeaway:** the industry‑standard, zero‑infra, zero‑marginal‑cost move is **client‑side
right‑sizing of the stored master**. Delivery‑time variants are a separate, optional, _paid_
layer we can add later for gallery/showcase only (Phase 4, §16).

Sources:

- <https://cloudinary.com/guides/image-effects/best-ways-to-compress-images-before-upload-in-javascript>
- <https://blogs.halodoc.io/optimizing-for-speed-image-compression/>
- <https://dev.to/ramko9999/client-side-image-compression-on-the-web-26j7>
- <https://supabase.com/blog/storage-image-resizing-smart-cdn>
- <https://supabase.com/docs/guides/storage/serving/image-transformations>
- <https://supabase.com/docs/guides/platform/manage-your-usage/storage-image-transformations>
- <https://dev.to/linmingren/browser-based-image-compression-with-jsquash-a-pure-frontend-implementation-f3g>
- <https://medium.com/@AlixWang/building-an-enhanced-squoosh-high-performance-local-image-compression-with-libimagequant-wasm-514c578c2778>

---

## 4. Library evaluation

| Option                                                | Size                                            | Mechanism                                                             | Pros                                                                                                                                                                                    | Cons                                                                                                                                                                                              | Verdict                                                                                                                               |
| ----------------------------------------------------- | ----------------------------------------------- | --------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| **`browser-image-compression`** (v2.x)                | ~14 KB gz, lazy; worker chunk separate          | Canvas `toBlob` in a bundled Web Worker; stepwise (halving) downscale | Mature, `maxSizeMB` + `maxWidthOrHeight` + `initialQuality` + `fileType` in one call; bakes **EXIF orientation**; worker included; falls back to main thread; no WASM to self‑host; MIT | Canvas downscale is not Lanczos (mild softening vs a pro resampler); converts wide‑gamut → sRGB (correct, but not profile‑preserving); can't decode HEIC where the browser can't (Chrome/Firefox) | **Default. Use this for v1.**                                                                                                         |
| `@jsquash/jpeg` + `@jsquash/webp` + `@jsquash/resize` | ~100–300 KB WASM per codec, self‑hosted `.wasm` | MozJPEG / libwebp + **Lanczos** resize, compiled to WASM              | Best‑in‑class ratios; true Lanczos downscale; SIMD                                                                                                                                      | Must self‑host + serve `.wasm`; bigger bundle; more wiring                                                                                                                                        | **Documented upgrade path.** Adopt only if the §9.4 blind test or §9.2 metrics flag Canvas quality as inadequate.                     |
| `compressorjs`                                        | ~4 KB                                           | Canvas `toBlob`                                                       | Tiny                                                                                                                                                                                    | No built‑in worker (main‑thread)                                                                                                                                                                  | Rejected — worker matters.                                                                                                            |
| `heic2any` / `libheif-wasm`                           | ~1–2 MB WASM                                    | libheif                                                               | Decodes HEIC anywhere                                                                                                                                                                   | Large; only the Chrome/Firefox‑HEIC edge case                                                                                                                                                     | **Conditional** — add behind a dynamic import only if telemetry shows a material HEIC pass‑through rate on the guest form (§13, §15). |
| Server‑side (`wasm-vips` in Deno)                     | —                                               | —                                                                     | —                                                                                                                                                                                       | Cold starts, 256 MB cap, CPU limits, retry queue (§2)                                                                                                                                             | Rejected.                                                                                                                             |

---

## 5. How this maps onto the existing codebase

| Need                                                       | Existing pattern to mirror                                                                                                                                |
| ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Client media constants kept in sync with an edge mirror    | `ui/src/features/dashboard/org/lib/propertyMedia.ts` ↔ `supabase/functions/_shared/propertyMedia.ts` (already cross‑referenced by comment)                |
| Shared edge image validation                               | `supabase/functions/_shared/storageUpload.ts#validateImageUpload(file, name, allowedMime, { maxBytes })` — closest thing to a choke point; extend it      |
| Per‑bucket hard ceiling already enforced by the platform   | `supabase/config.toml` `[storage.buckets.*].file_size_limit` (`property-media = 25MiB`, global `50MiB`) — a real backstop even if an edge check is missed |
| Client upload flow (FormData → edge fn → `storage.upload`) | `ui/src/features/dashboard/org/hooks/useUploadPropertyMedia.ts` + `supabase/functions/upload-property-media/index.ts`                                     |
| Data‑URL upload path (canvas exports)                      | `supabase/functions/_shared/marketingMediaUpload.ts#parseDataUrl` / `uploadMarketingMediaBytes`                                                           |
| Scattered client file validation to replace                | `ui/src/utils/text/helpers.ts` (`addFileToFormData`, `validateImageFile`, `handleFileUpload` — the guest form path), `ui/.../org/lib/propertyMedia.ts`    |
| Shared upload UI to instrument                             | `ui/src/components/forms/ImageUploadDropzone.tsx` (+ `…Contained`), `ImagePreviewUploadButton.tsx`, `DocumentUploadDropzone.tsx`                          |
| Worker‑friendly build                                      | Vite; `browser-image-compression` ships its own worker                                                                                                    |
| Accessibility for status text                              | existing `Loader2` + "Uploading…" affordance in the three shared components; add an `aria-live` "Optimizing…" state                                       |
| Client analytics/telemetry channel (for §13)               | identify in Phase 0 — check `ui/src/lib` for an existing analytics util; if none, log via a thin wrapper we can point at one later                        |

**No image/video compression code exists today** — `grep` for `browser-image-compression`,
`squoosh`, `jsquash`, `createImageBitmap`, `OffscreenCanvas`, `canvas.toBlob` is clean except
`SignaturePad.tsx` (unrelated). No Supabase image‑transformation usage anywhere.

---

## 6. Current state — the mess this replaces

### 6.1 Size limits are hardcoded and inconsistent

| Surface                                                                                                     | Limit today  | Source                                                                                         |
| ----------------------------------------------------------------------------------------------------------- | ------------ | ---------------------------------------------------------------------------------------------- |
| Guest form (valid ID, receipts, pet vax/photo)                                                              | 5 MB         | `ui/src/utils/text/helpers.ts` `maxSizeMB = 5`; `_shared/storageUpload.ts` `DEFAULT_MAX_BYTES` |
| Property / development gallery image                                                                        | 5 MB, max 9  | `_shared/propertyMedia.ts` `MAX_PROPERTY_IMAGE_BYTES`                                          |
| Property / development gallery video                                                                        | 25 MB, max 1 | `_shared/propertyMedia.ts` `MAX_PROPERTY_VIDEO_BYTES`                                          |
| Parking media                                                                                               | 5 MB         | `upload-parking-media/index.ts` `MAX_BYTES`                                                    |
| Guest chat asset                                                                                            | 10 MB        | `upload-guest-chat-asset/index.ts`                                                             |
| Org / app / parking settings assets, property template asset, guest profile, listing auth, org verification | 5 MB         | per‑function literal `5 * 1024 * 1024`                                                         |
| Support ticket attachment                                                                                   | 20 MB        | `upload-support-ticket-attachment/index.ts` `MAX_BYTES`                                        |
| AI assistant attachment                                                                                     | 4 MB         | `_shared/dashboardAssistantAttachments.ts`                                                     |
| Import CSV                                                                                                  | 15 MB        | `_shared/importUploadLimits.ts` (leave alone — not media)                                      |

### 6.2 ~30 client upload call sites, ~16 mutation hooks

Representative (full authoritative list produced in Phase 0):

- **Shared components:** `ImageUploadDropzone` / `…Contained`, `ImagePreviewUploadButton`, `DocumentUploadDropzone`
- **Guest (anon):** `GuestForm.tsx`, `GuestFormValidIdUpload.tsx`, `GuestReviewMediaUpload.tsx` (sd‑form), `GuestProfileForm.tsx`, `GuestChatThread.tsx`
- **Hosts:** `useUploadPropertyMedia`, `useUploadParkingMedia`, `useUploadDevelopmentMedia`, `useUploadOrgSettingsAsset`, `useUploadAppSettingsAsset`, `useUploadParkingSettingsAsset`, `useUploadBookingAsset`, `useUploadPropertyTemplateAsset`, `useListingAuthorization`, `useGuestProfile`, `useSupportTickets`, help‑support `TicketAttachmentDropzone`
- **Booking detail edit:** `GuestIdentityTab`, `PetsTab`, `StayDetailsTab`, `ParkingRequestForm`, `SdRefundForm`, `GafOwnerSignatureUploadField`, `GuestBalanceSettlementForm`, `BookingCompactAssetControl`, `AdminAdditionalGuestSlot`
- **Marketing Studio:** `PropertyMediaUploadButton` (Polotno), calendar‑builder `BackgroundControl` / `StatesPanel`, `TemplateSectionImageField`, `RichTextEditor` image insert
- **Org onboarding / property settings:** `OnboardingProofUpload`, `PropertyExternalReviewImageField`, `PropertyExternalReviewStayPhotosField`, `PropertySuperhostVerificationBlock`, `OrgSettingsImageField`, `PropertyPaymentMethodsSection` (QR)

### 6.3 Edge functions in scope

`upload-property-media`, `upload-development-media`, `upload-parking-media`,
`upload-parking-settings-asset`, `upload-org-settings-asset`, `upload-app-settings-asset`,
`upload-property-template-asset`, `upload-booking-asset`, `upload-guest-profile-asset`,
`upload-guest-chat-asset`, `upload-listing-authorization-asset`, `upload-org-verification-asset`,
`upload-support-ticket-attachment`, `submit-form`, `submit-sd-form`, `submit-guest-review`,
`submit-org-verification`, `submit-parking-booking-request`, `submit-pay-parking`,
`submit-listing-authorization`. Plus the data‑URL path in `_shared/marketingMediaUpload.ts`.

---

## 7. Target unified limits

Single source of truth, two mirrored files (client + edge), same error strings.

| Kind                                                       | Post‑compression expectation | **Hard ceiling (server reject)**                             | Rationale                                                                                                                                                       |
| ---------------------------------------------------------- | ---------------------------- | ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Image — photo / gallery / marketing                        | ~0.4–1.8 MB typical          | **10 MB**                                                    | Ceiling only bites when client compression was bypassed / skipped (HEIC pass‑through, old cached JS). Roomy enough to never reject a legitimately large master. |
| Image — document (ID, receipt, vaccination, QR, signature) | ~0.5–3 MB                    | **12 MB**                                                    | Higher ceiling; near‑lossless handling; must stay legible for OCR / AI validation / human approval.                                                             |
| Image — avatar / logo / small icon                         | ~20–150 KB                   | **5 MB**                                                     | Never needs more.                                                                                                                                               |
| Video                                                      | unchanged (no transcode)     | **50 MB** everywhere (property/dev raised 25 → 50 MB, §19.1) | One number; matches the `50MiB` global bucket limit.                                                                                                            |
| PDF (documents only)                                       | untouched                    | **12 MB**                                                    | Not an image. No compression. Ceiling only.                                                                                                                     |

Per‑surface overrides remain possible (e.g. AI assistant attachment stays 4 MB) but default to
the table. `supabase/config.toml` per‑bucket `file_size_limit`s are raised to match (belt + braces).

> **Ceilings are the safety net, not the mechanism.** They are set _generously_ on purpose: the
> job of shrinking files is the client compressor's; the ceiling only exists to stop abuse and
> bypass. A tight ceiling that rejects a user's photo is a worse outcome than a slightly large file.

---

## 8. Quality presets — resolution, format, quality per use case

Defined once in `ui/src/lib/media/imageOptimization.ts`. `maxWidthOrHeight` = long edge; **never
upscales**. Resolutions are derived from real display‑pixel math in §9.1.

| Preset         | Long edge          | Quality                         | Output format                                                                                                                         | Applied to                                                                                                                                                                             |
| -------------- | ------------------ | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PHOTO_MASTER` | **3840 px**        | 0.82                            | WebP (JPEG fallback)                                                                                                                  | Property / development gallery, showcase hero, parking media, marketing background photos — anything that can render full‑bleed on a large screen                                      |
| `CONTENT`      | **2048 px**        | 0.82                            | WebP (JPEG fallback)                                                                                                                  | Stay‑guide / template section images, rich‑text inserts, marketing content images, external‑review stay photos — in‑page, column‑width, never full‑bleed                               |
| `AVATAR`       | **512 px**         | 0.85                            | WebP; **keep PNG if alpha**                                                                                                           | Guest profile photo, org / app / parking logos, small settings icons                                                                                                                   |
| `DOCUMENT`     | cap at **3000 px** | 0.90, **no chroma subsampling** | **keep source format**; **pass through untouched** if already ≤ 3000 px _and_ ≤ ceiling — re‑encode only when it exceeds one of those | Valid ID, payment receipts, pet vaccination, GAF / pet signatures, QR codes, SD‑refund receipts, listing‑authorization proof, org‑verification proof, support‑ticket image attachments |
| `NONE`         | —                  | —                               | pass‑through                                                                                                                          | PDFs, SVGs, animated GIFs, files the worker fails to decode                                                                                                                            |

Rules baked into `optimizeImage`:

- **Never upscale.** If the source long edge ≤ preset target, keep source dimensions; only
  re‑encode for format/size, and only if that _reduces_ bytes.
- **Skip‑if‑pointless.** If the source is already ≤ target dimensions **and** ≤ a per‑preset
  "already‑good" byte size (e.g. `PHOTO_MASTER` ≤ 900 KB, `CONTENT` ≤ 400 KB, `AVATAR` ≤ 120 KB),
  return it untouched. Re‑encoding tiny images can enlarge them.
- **Never grow a file.** If the optimized result is ≥ the input, discard it and keep the input.
- **Alpha preserved.** Detect an alpha channel before choosing output; PNG/logo with
  transparency → keep PNG or lossless WebP, never flatten to JPEG.
- **Animated images preserved.** Animated GIF/WebP/APNG → `NONE` (a Canvas re‑encode would
  freeze it to frame 1).
- **EXIF orientation baked into pixels; the rest of EXIF stripped** (privacy + bytes).
- **Colour → sRGB, correctly converted** (not profile‑stripped) — see §9.5.
- **`DOCUMENT` is deliberately near‑lossless** — it exists to enforce a _ceiling_, not to shrink.
  The common case (a 4–8 MP phone photo of an ID under 12 MB) passes through byte‑for‑byte.

### 8.1 Why larger masters than the storage‑minimal option

A storage‑minimal design would cap gallery masters at ~2048 px. This plan deliberately uses
**3840 px** because the requester's stated priority is _zero visible quality loss on large
screens_, and §9.1 shows 2048 px is visibly soft when a photo renders full‑screen on a 4K panel.
The cost of the larger master is real but modest: a 3840 px WebP q82 photo is ~0.7–1.8 MB vs a
typical phone JPEG of 4–8 MB — still a **50–80 % reduction**, plus the ceiling eliminates the
8–12 MB outliers entirely. We optimize for "provably invisible" over "absolute smallest".

---

## 9. Image‑quality guarantee — how we _prove_ "no visible loss, even on large screens"

This section is the contract. No surface is enabled in production until its presets clear every
gate here (§9.4 check + §9.2 metrics on the §9.3 corpus).

### 9.1 What "large screen" means (display‑pixel math)

The worst‑case viewing context is a full‑bleed image (gallery lightbox / showcase hero) on a
large high‑DPR panel:

| Display                      | Physical px (long edge) | Realistic maximised‑browser image width |
| ---------------------------- | ----------------------- | --------------------------------------- |
| 16" MacBook Pro              | 3456 (DPR 2, ~1728 CSS) | ~3000 px                                |
| 27" 4K / 32" 4K              | 3840 (DPR 1–1.5)        | ~3840 px                                |
| 27" 5K iMac / Studio Display | 5120 (DPR 2)            | up to ~5120 px                          |

- A **3840 px** master exactly matches 4K native and is a **1.33× upscale** on a fully‑maximised
  5K panel. For photographic content at normal viewing distance a ≤ 1.35× browser upscale is not
  perceptible; only a deliberate 100 % pixel‑peep on a maximised photo on a 5K panel shows mild
  softening. Going to 5120 px roughly doubles stored bytes for that narrow case — **rejected for
  v1**; a future `-xl` master or Phase‑4 delivery transform can serve it if a real complaint appears.
- `CONTENT` images render in a text column (≤ ~900 CSS px) → ≤ 1800 device px at DPR 2 →
  **2048 px** has headroom.
- Avatars/logos render ≤ ~256 CSS px → ≤ 512 device px → **512 px** is exact.
- **Guard in code:** `optimizeImage` refuses to produce a long edge below the surface's
  DPR‑derived minimum (a config value per preset); if the source is smaller, it passes through
  rather than "optimizing" into blur.

### 9.2 Objective metrics + thresholds

Measured on the §9.3 corpus, comparing the **decoded optimized image** against the **original
resampled to the same pixel dimensions** (so we isolate _encoding_ loss from the _intentional,
display‑justified_ resize):

| Metric                                        | Photo presets (`PHOTO_MASTER`, `CONTENT`, `AVATAR`) | `DOCUMENT`                  |
| --------------------------------------------- | --------------------------------------------------- | --------------------------- |
| SSIM (structural similarity)                  | **≥ 0.980**                                         | **≥ 0.995**                 |
| Butteraugli (if run)                          | ≤ 1.5                                               | ≤ 1.0                       |
| Max per‑pixel ΔE (sRGB) on flat regions       | ≤ 3 (no visible banding)                            | ≤ 2                         |
| Byte reduction (corpus median)                | **≥ 50 %**                                          | ≥ 0 % (pass‑through common) |
| Any image larger than input                   | **0** (skip‑guard)                                  | 0                           |
| Output long edge ≥ surface DPR minimum (§9.1) | **100 %**                                           | 100 %                       |

Thresholds are enforced by `scripts/media/quality-check.ts` (§18) and re‑checked whenever a
preset number changes.

### 9.3 Reference image corpus (checked into the repo)

`ui/src/lib/media/__fixtures__/` (or `docs/guides/testing/fixtures/media/`) — a fixed set so
every quality/perf run is comparable:

1. Bright landscape photo (24 MP) · 2. Indoor low‑light / noisy photo · 3. Portrait‑orientation
   phone photo (EXIF rotation) · 4. Photo with large flat sky (banding trap) · 5. Highly saturated
   reds/greens (gamut trap) · 6. Fine‑text screenshot · 7. Scanned document (dense text) ·
2. Phone photo of a paper receipt (skew, shadow) · 9. Photo of an ID card (small serials, holograms) ·
3. PNG logo with transparency · 11. Already‑small 60 KB JPEG (skip‑guard) · 12. HEIC from an iPhone ·
4. Animated GIF · 14. 50 MP DSLR JPEG (memory trap) · 15. Grayscale document.

### 9.4 Blind A/B acceptance protocol (human sign‑off, per surface, pre‑prod)

1. Run each in‑scope preset over the full corpus → produce `original` / `optimized` pairs.
2. Build a throwaway compare page: original and optimized shown **at 100 % zoom** and **at
   fit‑to‑screen**, on a 4K‑or‑better display, labels hidden, left/right randomized.
3. **≥ 2 reviewers** independently mark, for each pair: "can you tell which is the original?"
   and "does either look degraded / blurry / off‑colour?"
4. **Gate:** no reviewer reliably identifies the optimized image (≤ chance), and **zero**
   "degraded" marks. Any fail → adjust the preset (raise quality / raise long edge / switch that
   case to `@jsquash` Lanczos) and re‑run. Record the sign‑off in the manual‑test doc.
5. Re‑run this gate any time a preset constant changes.

### 9.5 Colour management

Canvas `drawImage` **converts** a wide‑gamut (Display P3) source into the canvas colour space
(sRGB) — it is gamut‑mapped, not blindly stripped, so colours stay visually faithful (a hair
less saturated only in extreme P3‑only greens/reds). Output is tagged sRGB. We explicitly **do
not** preserve a P3 profile in the output — an untagged‑P3 file renders _over‑saturated_ on
colour‑managed viewers. If true P3 preservation is ever needed → `@jsquash` + a
`{ colorSpace: 'display-p3' }` canvas (deferred). The §9.2 ΔE gate catches any real shift.

### 9.6 Downscale sharpness, chroma subsampling, banding

- **Downscale softness:** `browser-image-compression` does stepwise (halving) canvas downscaling
  — decent, slightly softer than Lanczos. The §9.4 blind test is the arbiter; if it flags
  softness on `PHOTO_MASTER`, switch _only that preset_ to `@jsquash/resize` (Lanczos) — the
  code is structured so this is a one‑function swap.
- **No post‑resize sharpening in v1.** An unsharp mask can hide softness but creates halos and
  looks worse when over‑applied; only revisit if §9.4 demands it.
- **Chroma subsampling:** 4:2:0 is fine for photographs (every camera does it). For `DOCUMENT`
  (red text on white, thin rules) 4:2:0 causes colour fringing → `DOCUMENT` forces **4:4:4** and,
  by pass‑through, usually no re‑encode at all.
- **Banding:** the flat‑sky and gradient corpus images + the ΔE gate (§9.2) catch banding from
  too‑low quality; q0.82 with WebP is comfortably above the banding threshold in testing.

### 9.7 Documents — OCR / approval‑accuracy gate

IDs and receipts feed `validate-booking-receipts` (AI) and human approval emails. Beyond §9.2:

- **Regression set:** 30–50 real (or realistic) document images with known‑correct expected
  extractions.
- **Gate:** run `validate-booking-receipts` (local/staging) on the set **before** and **after**
  `DOCUMENT` handling. Field‑level extraction accuracy must be **unchanged** (±0 regressions).
- Because `DOCUMENT` is pass‑through for the common case, most of the set won't even be
  re‑encoded — this gate mainly guards the > 12 MB / > 3000 px re‑encode branch.

### 9.8 Irreversibility & the conservative‑defaults rule

Originals are **not retained** (retaining them would defeat the cost goal). Therefore:

- Every preset ships at the **conservative end** (higher long edge, higher quality) that still
  gives a worthwhile reduction. The failure mode of a wrong knob is then "files larger than
  optimal", never "degraded images".
- A preset can only be made _more aggressive_ after a fresh §9.2 + §9.4 pass.
- The per‑surface prod enablement (§12) happens **only after** that surface's gate is green.
- Optional, rejected for v1: a temporary 14‑day `-originals/` retention with a cleanup cron
  during rollout. It doubles storage for the media surfaces during the very period we're trying
  to prove savings, and the pre‑enablement gate already covers the risk. Listed here only so the
  trade‑off is on record.

---

## 10. Performance budgets & guarantees

Every budget below is _measured_ (§10.7), not assumed. "Reference device" = Chrome with **4×
CPU throttle** + "Fast 3G" network (approximates a mid‑tier 2021 Android / older laptop).

| #     | Budget                                                          | Target                                                                                                         | Guardrail if exceeded                                                                                                                          |
| ----- | --------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| 10.1  | **Main‑thread blocking** from optimization                      | **0 ms** — all encode/decode in the Worker                                                                     | Library auto‑falls back to main thread only if Worker construction fails; that path is logged and still yields to the event loop between steps |
| 10.2  | File‑pick → preview visible                                     | **< 50 ms**                                                                                                    | Preview is just `URL.createObjectURL` + one state set; nothing else on that path                                                               |
| 10.3  | Compression wall‑time, single 12–24 MP image (reference device) | **p50 < 700 ms, p95 < 2.5 s**                                                                                  | Still non‑blocking; "Optimizing…" shown after 400 ms; upload proceeds when done                                                                |
| 10.4  | Multi‑select (gallery, up to 9 images)                          | Concurrency cap **2 (mobile) / 3 (desktop)**; p95 total **< 12 s**; per‑file progress                          | A bounded queue in `useOptimizedUpload`; user can leave the page, uploads continue (unchanged behavior)                                        |
| 10.5  | Added JS heap during optimization                               | **< ~150 MB on mobile** peak                                                                                   | Concurrency cap + `maxWidthOrHeight`; if `createImageBitmap` throws OOM → fallback to original                                                 |
| 10.6  | Bundle: `browser-image-compression`                             | **Not in any route's initial/vendor chunk**; loaded via `import()` on first uploader mount; ≤ ~16 KB gz        | CI assertion on the build manifest (§18); no effect on any route's LCP/TBT because nothing runs until a file is picked                         |
| 10.7  | Network upload time                                             | **≤ today**, typically **50–85 % faster** (smaller payload)                                                    | Measured before/after on "Fast 3G" for a gallery upload                                                                                        |
| 10.8  | `blob:` object‑URL lifecycle                                    | Every created URL is `revokeObjectURL`‑ed on preview replace / component unmount                               | Leak check in the manual doc; lint rule if feasible                                                                                            |
| 10.9  | Worker lifecycle                                                | Library manages its worker; our concurrency limiter caps simultaneous calls; no orphaned workers after a batch | Verified in DevTools during the multi‑select test                                                                                              |
| 10.10 | Rapid re‑pick (file A then file B before A finishes)            | A's compression is abandoned, A's `blob:` revoked, only B's result is used                                     | `AbortController` + a generation counter in the hook; stale results dropped                                                                    |

**Non‑regression guarantee for the rest of the app:** the compressor and its worker are
_lazy‑loaded on first uploader mount_ and idle until a file is picked. Routes without an uploader
never load it. No existing route's bundle, LCP, TBT, or hydration path changes. This is asserted
in CI (§18), not just claimed.

---

## 11. Bug‑prevention & correctness

The concrete ways this could break existing flows, and the rule that prevents each:

| Risk                                                                                                           | Rule / handling                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| -------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Format change breaks downstream extension logic** — user picks `photo.png`, we output WebP                   | `optimizeImage` returns a `File` whose **name is rewritten to the new extension** (`photo.png` → `photo.webp`) **and** whose `type` is `image/webp`, atomically. Audit every consumer that keys off name/extension: `extensionForMime` (`upload-property-media`), `sanitizeStorageFileName`, `prefixPropertyStorageKey`, client `generateFileName`, `classifyPropertyMediaFile` / `classifyPropertyMediaMime`, `DocumentUploadDropzone.isPdfFile`. |
| **Edge MIME allow‑list rejects our WebP** — user picks PNG, client sends WebP, edge fn only allows `image/png` | **Phase 0, before any compression ships:** widen `allowedMime` in `_shared/storageUpload.ts#validateImageUpload` and every `upload-*` / `submit-*` caller to include `image/webp` (and keep `image/heic`/`heif` for pass‑through). This is the single highest‑risk breakage — it is a Phase 0 gate item, verified per function.                                                                                                                    |
| **`accept=""` on the file input** doesn't advertise formats we now emit                                        | Inputs advertise _input_ formats (what the user may pick), unchanged. But audit all ~30 for `image/webp` + `image/heic` so re‑picking a previously‑optimized file still works.                                                                                                                                                                                                                                                                     |
| **`config.toml` bucket `file_size_limit` lower than the new ceiling** → platform‑level 413                     | Phase 0 raises each media bucket's `file_size_limit` to ≥ the §7 ceiling.                                                                                                                                                                                                                                                                                                                                                                          |
| **Rapid re‑pick / stale async result**                                                                         | §10.10 — `AbortController` + generation counter; stale results discarded, `blob:` revoked.                                                                                                                                                                                                                                                                                                                                                         |
| **React StrictMode double‑invoke (dev)**                                                                       | Compression is triggered from the `onChange` handler (an event), not a `useEffect`; the operation is abortable + idempotent, so a double‑fire is harmless.                                                                                                                                                                                                                                                                                         |
| **Idempotency** — optimizing our own output                                                                    | Skip‑guard (§8) returns it untouched; safe to run twice.                                                                                                                                                                                                                                                                                                                                                                                           |
| **Decode failure** (HEIC on Chrome/Firefox, corrupt file)                                                      | Caught → **upload the original**; server ceiling still applies; telemetry reason `passthrough-decode-fail`.                                                                                                                                                                                                                                                                                                                                        |
| **Encode failure / Worker unavailable**                                                                        | Fallback chain: Worker → main‑thread lib → original. Every branch logs a reason.                                                                                                                                                                                                                                                                                                                                                                   |
| **Result larger than input**                                                                                   | Discard, keep input (`passthrough-larger`).                                                                                                                                                                                                                                                                                                                                                                                                        |
| **Non‑image through an image input** (SVG, PDF via `DocumentUploadDropzone`)                                   | `NONE` — pass through untouched.                                                                                                                                                                                                                                                                                                                                                                                                                   |
| **Animated GIF frozen to frame 1**                                                                             | Detected → `NONE`.                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| **Preview flicker** when swapping original→optimized preview                                                   | Keep the **original** `blob:` as the preview for the component's lifetime (visually identical once the §9 gate holds); don't swap. Cheaper and flicker‑free.                                                                                                                                                                                                                                                                                       |
| **Guest form is one multipart submit** (`submit-form`)                                                         | Compress each image _before_ assembling the payload; Worker keeps the submit button responsive; per‑file "Optimizing…" if > 400 ms. Must not add seconds of blocking — covered by §10.3/§10.4 budgets.                                                                                                                                                                                                                                             |
| **Bypassed client** (curl, stale cached JS)                                                                    | Server `assertWithinUploadLimit` + bucket `file_size_limit` are the real guarantee; client compression is an optimization, never the enforcement.                                                                                                                                                                                                                                                                                                  |
| **Server contract unchanged**                                                                                  | Edge functions still accept the same multipart/JSON shape; only the allow‑list widens and the byte limit moves to a shared constant. No response‑shape change → no client breakage elsewhere.                                                                                                                                                                                                                                                      |
| **Type safety**                                                                                                | `optimizeImage(file, preset): Promise<File>` — always resolves to a `File` (never rejects for image problems; only for programmer error). Callers need no new error handling.                                                                                                                                                                                                                                                                      |

---

## 12. Rollout safety — flags, staged enablement, kill switch

- **Kill switch:** `VITE_DISABLE_IMAGE_OPTIMIZATION=1` (build‑time env) makes `optimizeImage` a
  pass‑through no‑op everywhere. A one‑line, one‑deploy hotfix if anything regresses in prod.
- **Per‑surface flag:** `imageOptimization.enabledSurfaces` config object. A surface is added
  only after its §9.4 + §9.7 (documents) gate is green. Dev/staging = all‑on; prod flips per
  phase.
- **Staged enablement order (lowest blast radius first):**
  1. Internal settings assets — org / app / parking logos, property template assets
  2. Host property / parking / development galleries
  3. Marketing Studio exports
  4. Guest profile photo + guest chat images
  5. **Guest booking‑form documents (last)** — gated on the §9.7 OCR regression pass
- **Canary:** enable each surface for the team's own org first (super‑admin layer already exists
  as precedent); watch §13 telemetry for a few days before widening.
- **Abort criterion:** on any surface, `error + passthrough` rate > 15 %, or a single confirmed
  "blurry / degraded" report → pause rollout, keep the kill switch handy, diagnose.

---

## 13. Observability & baseline

- **Baseline (before Phase 1):** one‑off `scripts/media/storage-audit.ts` (Node + service key) →
  per media bucket: total bytes, object count, p50 / p90 / p99 object size. Recorded in the
  implementation PR so the "after" curve is comparable.
- **Telemetry event** emitted by `optimizeImage` (via the channel identified in Phase 0):
  `{ surface, preset, inputBytes, outputBytes, ratio, inputMime, outputMime, inputWH, outputWH,
durationMs, path: 'optimized' | 'skipped' | 'passthrough-decode-fail' | 'passthrough-larger'
| 'passthrough-nonimage' | 'error', deviceMemory?, hardwareConcurrency? }`. No PII, no image bytes.
- **Review at +2 and +6 weeks:** aggregate reduction %, passthrough/error rates per surface,
  HEIC pass‑through rate (decides the `heic-to` question), storage growth vs baseline, and any
  support tickets mentioning image quality.

---

## 14. Recommended architecture

```
File picked
  │
  ├─▶ URL.createObjectURL(file)  ──▶  <img> preview shown immediately (optimistic, < 50 ms)
  │
  ├─▶ validateUploadFile(file, kind, ctx)   // type + generous pre-compression sanity cap
  │
  ├─▶ optimizeImage(file, PRESET)           // browser-image-compression, in its Web Worker
  │     ├─ non-image / SVG / animated / decode-fail ─▶ return original (reason logged)
  │     ├─ skip-guard (already small enough)         ─▶ return original
  │     ├─ result ≥ input                            ─▶ return original
  │     └─ else ─▶ downscaled + re-encoded File (name+type rewritten to output format)
  │
  ├─▶ existing FormData / data-URL POST to the existing upload-* edge function
  │     (spinner reflects the network POST; "Optimizing…" shown only if optimize > 400 ms)
  │
  └─▶ edge fn: assertWithinUploadLimit(file, kind)   // HARD ceiling, widened MIME allow-list
        └─ storage.upload(...)  (unchanged)
```

### New files

| File                                                                 | Responsibility                                                                                                                                                                                 |
| -------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ui/src/lib/media/imageOptimization.ts`                              | `optimizeImage(file, preset)`; preset table (§8); DPR‑minimum guard (§9.1); skip/alpha/animated/format/extension‑rewrite logic; fallback chain (§11); lazy worker import; telemetry emit (§13) |
| `ui/src/lib/media/uploadLimits.ts`                                   | `IMAGE_*` / `VIDEO_MAX_BYTES` / `DOC_*` constants; per‑kind `accept` strings; `validateUploadFile(file, kind, ctx)`; **single client source of truth**                                         |
| `ui/src/lib/media/useOptimizedUpload.ts`                             | hook: preview → validate → optimize (with the §10.4 concurrency queue + §10.10 abort) → hand `File` to the caller's mutation; exposes `optimizing` / `progress`                                |
| `supabase/functions/_shared/uploadLimits.ts`                         | mirror of the constants + `assertWithinUploadLimit(file, kind)` with **identical error strings**; header comment cross‑refs the client file                                                    |
| `scripts/media/storage-audit.ts`                                     | §13 baseline                                                                                                                                                                                   |
| `scripts/media/quality-check.ts`                                     | §9.2 metric gate over the §9.3 corpus (Playwright page or node‑canvas)                                                                                                                         |
| `ui/src/lib/media/imageOptimization.test.ts`, `uploadLimits.test.ts` | §18 pure‑logic unit tests (first Vitest files in the repo)                                                                                                                                     |

### Changed files (high level)

- `_shared/storageUpload.ts#validateImageUpload` → delegate the byte check to
  `assertWithinUploadLimit`; **widen `allowedMime` to include `image/webp`**.
- Every `upload-*` / `submit-*` edge fn → replace literal byte limits with
  `assertWithinUploadLimit`; **add `image/webp` to its MIME allow‑list** (§11).
- `_shared/propertyMedia.ts` + `ui/.../org/lib/propertyMedia.ts` → re‑export from the shared modules.
- `ui/src/utils/text/helpers.ts` → `addFileToFormData` / `handleFileUpload` call
  `validateUploadFile`; guest‑form path runs `optimizeImage` before assembling the multipart payload.
- The 3 shared upload components → optional `optimizePreset` prop; own the preview → optimize →
  `onFileSelect(optimizedFile)` sequence + an `aria-live` "Optimizing…" state.
- `_shared/marketingMediaUpload.ts` + Polotno export → export canvas as WebP/JPEG at bounded
  dimension/quality instead of raw PNG data URLs; route bytes through `assertWithinUploadLimit`.
- `supabase/config.toml` → per‑bucket `file_size_limit` raised to ≥ §7 ceilings.

---

## 15. Edge cases (remaining odds & ends)

| Case                                                                | Handling                                                                                                                                                                                                          |
| ------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **HEIC/HEIF from iPhone** — Canvas can't decode in Chrome/Firefox   | Pass through original; server ceiling (12 MB, docs) applies; telemetry counts it. Add `heic-to`/`libheif-wasm` behind a dynamic import only if the +2‑week review shows a material rate. Safari decodes natively. |
| **`deviceMemory` / `hardwareConcurrency` absent** (Safari, Firefox) | Assume the conservative branch: concurrency cap 2, don't parallelize.                                                                                                                                             |
| **User on a very old browser without Workers**                      | Library main‑thread fallback; still yields between steps; acceptable.                                                                                                                                             |
| **Extremely small viewport uploading a huge photo**                 | Same presets — dimensions are display‑need driven, not viewport driven; a phone uploading a gallery photo still gets a 3840 px master for the hosts' large screens.                                               |
| **Re‑upload / replace an existing gallery image**                   | Same path; skip‑guard makes an already‑optimized re‑upload a near‑no‑op.                                                                                                                                          |
| **`?property=` public guest endpoints (anon)**                      | Compression runs client‑side regardless of auth; anon edge functions get the same widened allow‑list + shared ceiling.                                                                                            |
| **Reduced motion / a11y**                                           | "Optimizing…" / "Uploading…" via `aria-live="polite"`; no animation added.                                                                                                                                        |

---

## 16. Phases — each with an explicit exit gate (Definition of Done)

### Phase 0 — Shared foundation (no user‑visible change)

- Add `browser-image-compression`; create `ui/src/lib/media/uploadLimits.ts` +
  `_shared/uploadLimits.ts` (mirrored, §7).
- Create `ui/src/lib/media/imageOptimization.ts` (presets, guards, fallback chain, telemetry) —
  **wired to nothing yet**.
- Re‑point `_shared/propertyMedia.ts` + client mirror at the shared constants.
- **Widen every `upload-*` / `submit-*` MIME allow‑list to include `image/webp`** and switch each
  to `assertWithinUploadLimit`.
- Raise `supabase/config.toml` bucket `file_size_limit`s.
- Add the `storage-audit.ts` baseline; identify the telemetry channel.
- **Exit gate:** unified limits live; `bun run type-check && lint && check:filenames && build`
  green; every edge fn manually confirmed to accept `image/webp`; baseline numbers recorded;
  **zero behavior change** for users.

### Phase 1 — Compression on shared components + host uploaders

- `optimizePreset` on the 3 shared components + the `useOptimizedUpload` hook (queue + abort).
- Adopt in host hooks (property/parking/development media, org/app/parking settings, booking
  asset, template asset, listing auth, guest profile, support ticket). Assign presets per §8.
- Run §9.2 metrics + §9.4 blind A/B for `PHOTO_MASTER` / `CONTENT` / `AVATAR` on the corpus.
- Measure §10 budgets (single + 9‑image multi‑select) on the reference device.
- **Exit gate:** §9.2 thresholds met; §9.4 sign‑off recorded; §10.1–§10.10 within budget;
  §10.6 CI bundle assertion added and green; staged prod enablement per §12 for surfaces 1–3.

### Phase 2 — Guest flows

- `GuestForm` / `GuestFormValidIdUpload` (→ `DOCUMENT`), `GuestReviewMediaUpload` (→ `CONTENT`),
  `GuestProfileForm` (→ `AVATAR`), `GuestChatThread` (→ `CONTENT`).
- Verify `submit-form` multipart stays snappy; per‑file progress copy.
- Run the §9.7 OCR/approval regression set (before/after) for `DOCUMENT`.
- **Exit gate:** §9.7 shows ±0 extraction regressions; §10.3/§10.4 budgets hold on the guest
  form with 3–4 images; prod enablement for surfaces 4–5 per §12.

### Phase 3 — Marketing Studio exports

- Polotno / calendar‑builder canvas exports → WebP/JPEG at bounded dimension + quality instead
  of raw PNG data URLs; route through `assertWithinUploadLimit`.
- **Exit gate:** exported assets visually unchanged in the editor + on Meta preview; byte size
  down; §9.4 spot‑check on a few exports.

### Phase 4 — (Optional, later) Delivery‑time variants

- Evaluate Supabase Image Transformation vs client‑generated `-thumb` (512 px) + `-display`
  (1280 px) derivatives, for gallery/showcase only. Decision driven by plan tier + the
  **$5 / 1 000 unique images** meter and the +6‑week storage review. Not required for the cost win.

### Phase 5 — Video limit parity

- Enforce `VIDEO_MAX_BYTES` consistently; add `accept` video where a surface should allow it;
  clear "trim/compress first" copy + help link. **No transcoding.**
- **Exit gate:** every video‑capable surface rejects > 50 MB with the same message; docs updated.

---

## 17. Non‑goals / out of scope

- **Background server‑side image processing / re‑optimization pipeline** — rejected (§2).
- **Backfill / re‑compression of already‑stored images** — out of scope. If wanted later: a
  one‑off `scripts/` job (Node + `sharp`, _not_ an edge fn) that lists each bucket, re‑encodes
  with the §8 presets, re‑uploads, updates the JSONB/columns. Track separately.
- **Video transcoding** (ffmpeg.wasm / server) — too heavy; limit + guidance only.
- **PDF / SVG optimization.**
- **Changing bucket visibility, storage paths, or RLS.**
- **Preserving Display‑P3 wide‑gamut output** — v1 outputs correctly‑converted sRGB (§9.5).
- **Retaining originals** (even temporarily) — §9.8.
- **Import CSV limits** — not media.

---

## 18. Testing

Repo has no suite today. This feature adds the first one, scoped tightly to the new modules
(justified: pure functions, high blast radius).

**Automated — unit (Vitest, new):**

- `imageOptimization.test.ts` — preset/dimension selection; DPR‑minimum guard; skip‑guard math;
  format decision (alpha→keep PNG, jpg/png→WebP, doc→pass‑through); **name+type extension
  rewrite**; fallback ordering with mocked Worker/decode/encode failures; "never grow" rule.
- `uploadLimits.test.ts` — ceiling checks per kind; **client ↔ edge error‑string parity**
  (import both, assert identical).
- Wire `bun run test` + add a CI job step (currently CI has none) scoped to `ui/src/lib/media/**`.

**Automated — quality gate:**

- `scripts/media/quality-check.ts` — runs each preset over the §9.3 corpus, asserts §9.2
  thresholds (SSIM via `image-ssim`/`pixelmatch` proxy, ΔE, byte reduction, dimension floor,
  "no image grew"). Runnable locally + optionally in CI (corpus committed).

**Automated — performance:**

- Playwright (CLI already set up) trace on a 4×‑CPU / Fast‑3G profile during a 9‑image gallery
  upload: assert **no main‑thread long task > 50 ms** attributable to optimization; capture
  `durationMs` from telemetry; assert p95 < budget (§10.3/§10.4).
- Build assertion: parse the Vite manifest, assert `browser-image-compression` is **not** in any
  entry/vendor chunk (§10.6).

**Manual — `docs/guides/testing/image-upload-optimization-manual.md`:**

- Corpus × preset matrix → expected {path taken, output format, rough size, dimension, legible?}.
- §9.4 blind A/B protocol + sign‑off table (reviewers, date, verdict) per surface.
- Portrait‑orientation phone photo → not sideways.
- iPhone HEIC on Chrome (pass‑through) **and** Safari (optimized) → both submit; receipts still validate.
- Property gallery upload → stored object size + 100 %‑zoom parity on a 4K+ screen.
- `blob:` leak check (DevTools memory) after repeated pick/replace.
- Kill switch (`VITE_DISABLE_IMAGE_OPTIMIZATION=1`) → verified no‑op.

**Always:** `bun run type-check && bun run lint && bun run check:filenames && bun run build`.

---

## 19. Decisions — locked

Do not re‑litigate during implementation.

1. **Video ceiling → 50 MB everywhere.** Raise property/development video 25 → 50 MB; matches the
   `50MiB` global bucket limit. Update `_shared/propertyMedia.ts` `MAX_PROPERTY_VIDEO_BYTES`, its
   client mirror, and `supabase/config.toml` (`property-media` → `50MiB`).
2. **Default non‑document output → WebP** (quality per §8); JPEG only as the automatic fallback
   when WebP encode is unavailable. `DOCUMENT` keeps source format.
3. **Delivery‑time variants (Phase 4) → deferred.** Ship Phases 0–3 + 5 first; revisit after the
   +6‑week storage review.
4. **`@jsquash` → not in v1.** `browser-image-compression` (Canvas) unless the §9.4 blind test or
   §9.2 metrics fail — then swap _only_ the failing preset to `@jsquash` Lanczos/MozJPEG.
5. **Master resolution → quality‑first (3840 / 2048 / 512).** Larger than storage‑minimal, on
   purpose (§8.1, §9.1); still a 50–80 % reduction.
6. **Originals not retained** (§9.8); safety comes from the pre‑enablement gate + staged rollout
   - kill switch (§12), not from a backup copy.

---

## 20. Docs to update on implementation (per `CLAUDE.md` "Docs are the source of truth")

- `docs/architecture/storage.md` — new "Media optimization" section: presets, DPR rationale,
  unified limits, server ceilings, kill switch env.
- `docs/PROJECT.md` — storage/limits summary + new `ui/src/lib/media/*`, `_shared/uploadLimits.ts`,
  `VITE_DISABLE_IMAGE_OPTIMIZATION`.
- `docs/architecture/validation-and-env.md` — unified upload‑limit constants + the new env var.
- `.cursor/rules/supabase-edge-functions.mdc` — "every `upload-*` fn calls `assertWithinUploadLimit`
  and accepts `image/webp`" convention.
- Route guides (`route-guides` skill) for any page whose upload helper text changes (property
  media, guest form, guest profile, support tickets, marketing).
- New `docs/guides/testing/image-upload-optimization-manual.md` (+ committed corpus).
- `docs/workflow/planned/README.md` row → move to `in-progress` on `/workflow-start`.

---

Back to [planned work index](./README.md).
