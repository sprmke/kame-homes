---
stage: for-testing
title: 'Marketing — Multi-track video editor, media library and upload quotas'
status: for-testing
tags: [workflow, for-testing, marketing, video, remotion, storage, plans, quotas]
updated: 2026-11-01
kind: plan
---

# Marketing — Multi-track video editor, media library and upload quotas

## Progress (2026-11-04)

- **Done:** the track model, migration, renderer, editor UI (desktop + phone), media library (bucket, table, quota RPCs, edge functions, sweeper cron, upload pipeline, UI), plan quotas and RBAC leaves, and the automated suites (Vitest for every pure module, Deno for the edge helpers, Playwright for the editor).
- **Wired 2026-11-04:** the multi-track editor is reachable again — `loadMarketingVideoEditor()` picks `VideoEditorV2` unless `VITE_VIDEO_EDITOR_V2=false`, and the Videos rail mounts the media library. Before this, both existed as unreachable modules.
- **Fixed 2026-11-04:** undo/redo was swallowed while a slider had focus (`useVideoProjectHistoryShortcuts` treated every input as text entry), so Split → Undo did nothing. Non-text inputs no longer block the shortcut.
- **Still open (was marked done too early):** T1.10 (`upload-marketing-asset` through the reserve RPC), T1.11 (`marketing-music` quota + library row), T1.13 (server-side v2 project validation on save), T2.7 (Polotno Upload panel through the library). Those four integrate the library into the Posts/Music paths and are not in this tree yet.
- **Pending manual:** export matrix (Safari, Firefox), iPhone HEVC and 150 MB uploads, hosted file limit, Remotion licence, `property-dashboard-qa` pass, security review follow-ups. Deferred: delete the v1 editor, spanning-text recipes (T7.1).

**Goal.** Turn the Videos editor in Marketing Content Studio from a scene slideshow into a simple, CapCut-style **multi-track editor**. Images, videos, text and audio each live on their own layer and can span any time range. A real **media library** lets hosts upload images, videos and audio. **Per-plan quotas** stop storage abuse and runaway cost.

**Non-goal.** This is not a pro NLE. No keyframe curves, masking, chroma key, multicam, color grading, reverse playback, motion tracking or server-side rendering. See [§12 Out of scope](#12-out-of-scope).

**Related:** [`../done/marketing-video-templates.md`](../done/marketing-video-templates.md) · [`../done/marketing-video-quiet-coast-motion.md`](../done/marketing-video-quiet-coast-motion.md) · [`../done/image-video-upload-optimization.md`](../done/image-video-upload-optimization.md) · [`../planned/marketing-meta-publishing-gaps.md`](../planned/marketing-meta-publishing-gaps.md) (Reels publish) · [`../in-progress/marketing-studio-mobile-and-dashboard-responsive.md`](../in-progress/marketing-studio-mobile-and-dashboard-responsive.md) · [`../planned/super-admin-service-cost-monitoring.md`](../planned/super-admin-service-cost-monitoring.md) (storage retention) · `docs/architecture/storage.md` · `docs/architecture/plans-feature-matrix.md` · `docs/guides/routes/org/property/marketing.md`.

---

## 1. Current state (verified in code, 2026-11-01)

| Area            | What exists today                                                                                                                                                                                                                                                                         | Where                                                                                     |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Data model      | `VideoProject` v1 = ordered `scenes[]`. Each scene has a duration (1 to 12 s), a transition, motion, a scrim overlay and its **own** `layers[]` (background, image, logo, text, cta, slots). Text and overlays **cannot span more than one scene.** One global `music` track.             | `ui/.../marketing/lib/video/videoProjectTypes.ts`, `videoSceneLayers.ts`                  |
| Rendering       | Remotion `TransitionSeries`, one `Sequence` per scene; layers rendered absolutely inside the scene; single `<Audio>` for music.                                                                                                                                                           | `components/video-editor/VideoCompositions.tsx`                                           |
| Video media     | Types allow `backgroundMediaType: 'video'`, and the property gallery can contain videos. They render through `Video` from `remotion` (`loop muted`): no trim, no volume, no speed, no placement other than full-bleed background.                                                         | `VideoCompositions.tsx#SceneBackground`                                                   |
| Export          | `@remotion/web-renderer` `renderMediaOnWeb` → MP4 in the browser. The web renderer **only supports `<Video>` / `<Audio>` from `@remotion/media`**. `Html5Video` / `Html5Audio` (the `remotion` exports) are listed as unsupported, so exporting a video clip is at risk today. No cancel. | `lib/exportVideoMedia.ts`                                                                 |
| Timeline        | Horizontal filmstrip of scene thumbnails, dnd-kit reorder, delete, "+" add photo scene. No tracks, no trim handles, no split, no playhead-on-timeline, no zoom.                                                                                                                           | `components/video-editor/VideoTimeline.tsx`                                               |
| Media sources   | Picker shows **property gallery only** (`propertyGalleryMediaItems(publicProperty.media)`). No upload in the video editor.                                                                                                                                                                | `VideoEditor.tsx` ~L307, `shared/PropertyImagePicker.tsx`                                 |
| Uploads (Posts) | `upload-marketing-asset`: **image only**, 10 MB, `property-media/marketing-uploads/{propertyId}/{uuid}`. **No DB row, never pruned, no quota.** Only a rate limit of 60 per 5 min per user (about 7 GB/hour possible per user).                                                           | `supabase/functions/upload-marketing-asset/index.ts`, `docs/architecture/storage.md` §7.1 |
| Uploads (music) | `marketing-music` multipart upload: 15 MB audio cap, **no rate limit, no quota, no DB row.**                                                                                                                                                                                              | `supabase/functions/marketing-music/index.ts`, `_shared/marketingMusicStorage.ts`         |
| Saved projects  | `marketing_templates.design_json` (autosave). **No size cap or URL allowlist** on the video payload.                                                                                                                                                                                      | `supabase/functions/marketing-templates/index.ts`                                         |
| Bucket          | `property-media` is public, `file_size_limit = 50MiB`, allows image, video and audio MIME types.                                                                                                                                                                                          | `supabase/config.toml` L112                                                               |
| Plans           | `marketingStudio` (Pro+) unlocks download without watermark; Free and Starter can explore and autosave. No storage or media entitlement exists. Plan features live in `_shared/planFeatures.ts` (mirror `ui/.../plans/lib/planFeatures.ts`).                                              | `docs/architecture/plans-feature-matrix.md`                                               |
| Already good    | Templates and storyboard recipes, AI project builder, guest-review seeding, themes and typography, transitions (9), Ken Burns motion profiles, undo/redo history, formats (9:16, 1:1, 16:9), Jamendo music import, mobile toolbar and bottom sheets, autosave, thumbnails.                | `lib/video/*`, `hooks/useVideoProjectHistory.ts`                                          |

**Bottom line.** The scene model is the root limitation. A caption cannot span several images, video clips cannot be trimmed or layered, and only one audio track exists. Uploads are image-only and outside any quota. The fix is a **track-based project model (v2)** with a backwards-compatible migration from v1, a shared **media library** with quotas, and a new **timeline UI**.

---

## 2. Competitive research: core features in popular editors

Benchmarked against CapCut (web and mobile), Canva Video, Adobe Express, Clipchamp, InShot and Kapwing, all of which are short-form social editors. ✅ = we have it, 🟡 = partial, ❌ = missing. **In scope** = this plan builds it.

| #   | Core feature                                                                                                                                                 | Us  | In scope           | Notes                                                                                 |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | --- | ------------------ | ------------------------------------------------------------------------------------- |
| F1  | **Media library** with tabs (Uploads, property photos, AI results, audio), upload of images, video and audio, drag onto timeline                             | ❌  | ✅ Phase 2         | Every competitor has this as the left-panel default.                                  |
| F2  | **Multi-track timeline**: a main track plus overlay, text and audio tracks                                                                                   | ❌  | ✅ Phase 3–4       | CapCut model: magnetic main track and free overlay tracks.                            |
| F3  | **Video clips** on the timeline: trim in and out, split at playhead, speed (0.5× to 2×), volume and mute                                                     | ❌  | ✅ Phase 4–5       | `@remotion/media` `<Video>` supports `trimBefore`, `playbackRate`, `volume`, `muted`. |
| F4  | **Text as its own clip** that spans any range (one caption over many photos); text presets                                                                   | ❌  | ✅ Phase 4–5       | The user's headline request.                                                          |
| F5  | **Text animations** in and out (fade, slide, pop, typewriter, rise)                                                                                          | 🟡  | ✅ Phase 5         | Today only a per-scene spring entry.                                                  |
| F6  | **Overlays / picture-in-picture**: image, video, logo, sticker on top tracks                                                                                 | 🟡  | ✅ Phase 4–5       | Logo and image layers exist but are scene-bound.                                      |
| F7  | **Multiple audio clips**: music, voiceover, SFX; trim, volume, fade in and out                                                                               | 🟡  | ✅ Phase 4–5       | One global music track today.                                                         |
| F8  | Use the **audio of a video clip** (keep or mute original sound)                                                                                              | ❌  | ✅ Phase 5         |                                                                                       |
| F9  | **Transitions** between main-track clips                                                                                                                     | ✅  | keep               | 9 presentations; reuse.                                                               |
| F10 | **Motion / Ken Burns** on photos                                                                                                                             | ✅  | keep, per clip     | Move from per-scene to per-media-clip.                                                |
| F11 | **Canvas direct manipulation**: drag, resize, rotate, snap guides, safe-area guides                                                                          | 🟡  | ✅ Phase 5         | Text position overlay exists; add resize, rotate, guides.                             |
| F12 | Timeline basics: playhead scrub, **zoom**, **snapping** (playhead, clip edges), multi-select, duplicate, copy and paste, delete, ripple delete on main track | 🟡  | ✅ Phase 4         |                                                                                       |
| F13 | **Keyboard shortcuts** (Space, S split, Del, Cmd+D, Cmd+C/V, Cmd+Z/Shift+Z, arrows nudge)                                                                    | 🟡  | ✅ Phase 4         | Undo/redo shortcuts exist.                                                            |
| F14 | **Track controls**: hide, mute, lock, reorder tracks                                                                                                         | ❌  | ✅ Phase 4         | z-order = track order (web renderer ignores `z-index`, draws in DOM order).           |
| F15 | **Fit / fill / crop** per media clip, background color or blurred fill for mismatched aspect                                                                 | ❌  | ✅ Phase 5         | `objectFit` + `crop*` props on `@remotion/media` `<Video>`.                           |
| F16 | **Adjustments**: brightness, contrast, saturation, opacity                                                                                                   | ❌  | ✅ Phase 5 (small) | CSS filters are supported by the web renderer (not in Safari export).                 |
| F17 | Format / resize (9:16, 1:1, 16:9)                                                                                                                            | ✅  | keep               |                                                                                       |
| F18 | Templates and AI-generated starts                                                                                                                            | ✅  | migrate            | Recipes keep emitting v1 and go through the v1 → v2 migration (Phase 7).              |
| F19 | Export MP4 with progress and **cancel**, duration warnings for Reels                                                                                         | 🟡  | ✅ Phase 8         |                                                                                       |
| F20 | **Undo / redo** across all edits                                                                                                                             | ✅  | keep               | `useVideoProjectHistory` already snapshots the whole project.                         |
| F21 | **Storage meter and limits** (Canva "x of 5 GB used")                                                                                                        | ❌  | ✅ Phase 1–2       |                                                                                       |
| F22 | Missing-media handling (deleted asset still referenced)                                                                                                      | ❌  | ✅ Phase 5         | Placeholder clip plus a **Replace** action.                                           |
| F23 | Voiceover recording in browser                                                                                                                               | ❌  | later (§11)        | MediaRecorder → audio asset. Cheap follow-up.                                         |
| F24 | Auto captions (speech to text)                                                                                                                               | ❌  | later (§11)        | Needs paid STT; AI-credit gated.                                                      |
| F25 | Beat sync, keyframes, masks, chroma key, freeze frame, reverse                                                                                               | ❌  | out of scope       | Advanced.                                                                             |

---

## 3. Research: how popular apps limit uploads and storage

| App           | Free tier                                                                 | Paid tier                           | Per-file caps                        | Pattern                                                              |
| ------------- | ------------------------------------------------------------------------- | ----------------------------------- | ------------------------------------ | -------------------------------------------------------------------- |
| Canva         | 5 GB total uploads (official help)                                        | Pro 100 GB (official help)          | Video about 1 GB (secondary sources) | Total storage quota; every upload counts, including converted files. |
| Adobe Express | 5 GB storage                                                              | Premium 100 GB                      | Video about 1 GB (secondary)         | Total storage quota.                                                 |
| Kapwing       | 250 MB per upload, 1-minute watermarked export                            | 6 GB per upload, 120-minute exports | Per-file size plus export length     | Per-file cap plus duration cap is the main lever.                    |
| CapCut        | **0 GB** cloud for new free spaces (official help, 2026); previously 1 GB | Pro 100 GB                          | 500 MB single file (secondary)       | Paid-only cloud storage; free users edit locally.                    |
| Clipchamp     | Media stays local on the device by default (no cloud cost)                | Cloud backup on paid plans          | —                                    | Avoid server storage for free users.                                 |

**Patterns we adopt.** All of them are configurable per plan by super-admin:

1. **Total storage quota** per property (bytes): the primary cost control.
2. **File count cap**: limits row and object spam even with tiny files.
3. **Per-file size cap** by kind (image, video, audio).
4. **Video duration cap per upload**: keeps files short-form and bounds export work.
5. **Daily upload cap** plus the existing short-window `rateLimitGate`: stops upload, delete, re-upload churn.
6. **Client-side optimization before upload**: images already go through `prepareUpload`. Add video re-encode to at most 1080p H.264 with **Mediabunny** (already a transitive dependency of `@remotion/web-renderer`). A typical 60 s 4K phone clip drops from about 400 MB to about 45 MB.
7. **Content-hash dedupe** within a property: the same file uploaded twice reuses one object.
8. **Never delete on downgrade**: over-quota hosts keep every asset working read-only and are only blocked from new uploads. This matches the Phase 11 policy in `plans-feature-matrix.md`.

### 3.1 Proposed limits (seed values, tunable in `/admin` plan editor)

Per **property**. Rationale for per-property rather than org-pooled: the library is property-scoped, which keeps it predictable for hosts, and storage cost scales with properties billed. Org pooling is an open question (§13).

| Plan (`code` → name) | Library storage | Max files | Image / file | Video / file (after optimization) | Video length / upload | Audio / file | Uploads / day |
| -------------------- | --------------- | --------- | ------------ | --------------------------------- | --------------------- | ------------ | ------------- |
| `free` → Free        | 100 MB          | 30        | 10 MB        | 50 MB                             | 30 s                  | 15 MB        | 20            |
| `starter` → Starter  | 500 MB          | 100       | 10 MB        | 100 MB                            | 60 s                  | 15 MB        | 50            |
| `growth` → **Pro**   | 3 GB            | 500       | 10 MB        | 150 MB                            | 60 s                  | 25 MB        | 150           |
| `pro` → **Business** | 10 GB           | 2,000     | 10 MB        | 150 MB                            | 60 s                  | 25 MB        | 300           |
| `managed` → Managed  | 25 GB           | 5,000     | 10 MB        | 150 MB                            | 60 s                  | 25 MB        | 500           |

**Cost sanity check** (Supabase Pro: 100 GB storage included, then about $0.021/GB-month; 250 GB egress included, then $0.09/GB, or $0.03/GB cached). A Business property at a full 10 GB costs about **$0.21/month** in storage, against a 1,439 PHP/month plan (about $25). Even 1,000 Pro properties at a full 3 GB is about 3 TB, roughly **$63/month**. **Egress is the bigger risk**, because the library grid would stream videos. Mitigations: poster JPEGs in the grid (never the video), lazy `preload="none"`, and long `cacheControl` on content-addressed paths so CDN-cached egress applies.

**Project limits** (abuse and performance, enforced client- and server-side): max **60 s** total duration (hard cap on every tier, matching the short-form social target and well inside Reels, TikTok and Stories limits; an uploaded clip can never be longer than the video it goes into, so the per-upload length cap is 60 s as well, 30 s on Free), max **10 tracks**, max **150 items**, max **3 simultaneously visible video items**, `design_json` max **512 KB**, media URLs only from our Storage origin or the cached Jamendo prefix (no `data:` or `blob:` URLs, no third-party hotlinks).

---

## 4. Research: libraries and technologies

| Need                               | Option                                                                                                                                                | License / cost                                                                                                                                                                          | Verdict                                                                                                                                                                                                                                                                                                                             |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Rendering and preview engine       | **Remotion 4** (`remotion`, `@remotion/player`, `@remotion/transitions`, `@remotion/web-renderer`)                                                    | Already in use. Free for individuals and companies of **up to 3 people**; 4+ need a Company License ($25/seat/month "Creators" or $0.01/render with a $100/month minimum "Automators"). | **Keep.** Rewriting the engine is not justified. **Action:** confirm license status (§13). It applies today regardless of this plan.                                                                                                                                                                                                |
| Video and audio in compositions    | **`@remotion/media`** `<Video>` / `<Audio>`                                                                                                           | Remotion License                                                                                                                                                                        | **Adopt.** Required by the web renderer. Gives `trimBefore`, `durationInFrames`, `playbackRate`, `volume`, `muted`, `loop`, `objectFit`, `crop*`, and `premountFor`. Client-side render has **no fallback**, so a source the browser cannot decode fails the export. Hence the transcode step below.                                |
| Timeline UI                        | **Remotion Timeline** (paid component, integrates with Player)                                                                                        | One-time purchase for small companies; Company License otherwise                                                                                                                        | **Spike in Phase 0.** Multi-track, drag between tracks, zoom slider, keyboard shortcuts, Tailwind theming. Docs do not confirm trim, split or snapping; check before buying.                                                                                                                                                        |
|                                    | **Remotion Editor Starter** (full editor template)                                                                                                    | One-time purchase per project (about $600, per a third-party source)                                                                                                                    | **Reject as base.** It overlaps our existing studio shell, themes, autosave and templates; merging would cost more than it saves. Worth reading for patterns if bought.                                                                                                                                                             |
|                                    | `@xzdarcy/react-timeline-editor` (and its Keplar fork)                                                                                                | MIT                                                                                                                                                                                     | Fallback. Row and action model maps to tracks and items; supports drag, resize and grid snap. Weak touch support; styling fights Tailwind. The fork is alpha.                                                                                                                                                                       |
|                                    | DesignCombo `react-video-editor`, Twick                                                                                                               | Unclear or custom license                                                                                                                                                               | **Reject.** Full app-style editors with their own state and render stack, and unclear licensing.                                                                                                                                                                                                                                    |
|                                    | **Custom** (pointer events + existing `@dnd-kit` + pure TS timeline math)                                                                             | Free                                                                                                                                                                                    | **Default recommendation.** Our needs are narrow (move, trim, split, snap, zoom, playhead), and repo rules require native mobile parity (CapCut-style fixed center playhead, pinch zoom, bottom action bar), which no library above provides. All timing math lives in pure `.ts` modules unit-testable in Vitest.                  |
| Video probe, thumbnails, transcode | **Mediabunny** (WebCodecs; reads duration, dimensions, rotation without loading the whole file; frame sinks for thumbnails; conversion, resize, trim) | MPL-2.0; already a transitive dependency of `@remotion/web-renderer`                                                                                                                    | **Adopt** (pin as a direct dependency, lazy-loaded). Use for: probe before reserve, poster frame, timeline filmstrip, and optional 1080p H.264 re-encode before upload.                                                                                                                                                             |
|                                    | `ffmpeg.wasm`                                                                                                                                         | LGPL / GPL builds, about 30 MB wasm                                                                                                                                                     | **Reject.** Heavy, slower than WebCodecs, and conflicts with the PWA precache budget.                                                                                                                                                                                                                                               |
| Audio waveform                     | Web Audio `decodeAudioData` → downsampled peaks (or Mediabunny audio sink)                                                                            | Built-in                                                                                                                                                                                | **Adopt.** Compute about 1,000 peaks once per asset, cache in IndexedDB and store on the asset row (`meta.peaks`, small).                                                                                                                                                                                                           |
| Large uploads                      | Supabase Storage **signed upload URLs** (`createSignedUploadUrl` + `uploadToSignedUrl`), resumable **TUS** for files over 6 MB                        | Included                                                                                                                                                                                | **Adopt.** Bytes go straight from the browser to Storage, never through an edge function (avoids memory and body limits). The edge function only reserves quota and finalizes. Global file size limit: Free plan 50 MB, Pro plan up to 500 GB, so the hosted project must be on Pro and the global limit raised to at least 150 MB. |
| Canvas transform handles           | Custom on the existing `VideoTextPositionOverlay` approach                                                                                            | Free                                                                                                                                                                                    | **Adopt.** Moveable-style libraries add weight for one gesture set.                                                                                                                                                                                                                                                                 |

---

## 5. Target design

### 5.1 Project model v2 (track-based)

`ui/src/features/dashboard/marketing/lib/video/v2/videoProjectV2Types.ts`:

```ts
export type VideoProjectV2 = {
  version: 2;
  templateId: string;
  campaignCategory: string;
  format: VideoFormat;
  fps: number; // 30
  palette?: CampaignPalette;
  sourceReviewId?: string | null;
  background: { color: string; fill: 'color' | 'blur' }; // shows behind letterboxed media
  /** Bottom → top. Render order = array order (web renderer ignores z-index). */
  tracks: VideoTrack[];
};

export type VideoTrackKind = 'main' | 'overlay' | 'text' | 'audio';

export type VideoTrack = {
  id: string;
  kind: VideoTrackKind; // exactly one 'main'; at most 1 per kind is NOT required
  name?: string;
  hidden?: boolean; // visual tracks
  muted?: boolean; // audio-capable tracks
  locked?: boolean;
  items: VideoItem[]; // sorted by `from`
};

type ItemBase = {
  id: string;
  from: number; // frames; on 'main' it is DERIVED (magnetic), stored for convenience
  durationInFrames: number;
  label?: string;
};

export type MediaRef = {
  url: string;
  assetId?: string | null; // marketing_media_assets.id when from library
  source: 'property' | 'library' | 'ai' | 'jamendo';
  width?: number;
  height?: number;
  durationMs?: number; // video / audio source length
};

export type VisualTransform = {
  x: number;
  y: number; // % of frame, center anchor
  widthPct: number; // % of frame width; height from aspect
  rotation: number; // deg
  opacity: number; // 0..1
};

export type MediaItem = ItemBase & {
  type: 'image' | 'video';
  media: MediaRef;
  fit: 'cover' | 'contain';
  crop?: { left: number; right: number; top: number; bottom: number }; // 0..1
  transform: VisualTransform; // main track: full-frame defaults
  motion?: VideoMotionOverride; // Ken Burns on images
  adjust?: { brightness: number; contrast: number; saturation: number };
  overlay?: VideoOverlayMode; // scrim, kept from v1
  transitionIn?: { type: VideoTransition; durationInFrames: number }; // main track only
  // video only
  trimBeforeFrames?: number;
  playbackRate?: number; // 0.5 | 0.75 | 1 | 1.25 | 1.5 | 2
  volume?: number; // 0..1 (source audio)
  muted?: boolean;
};

export type TextItem = ItemBase & {
  type: 'text' | 'cta' | 'slots';
  text?: string;
  lines?: string[];
  textStyle?: VideoTextStyle;
  typography?: VideoLayerTypography;
  transform: VisualTransform;
  animationIn?: TextAnimation; // 'none'|'fade'|'slide-up'|'pop'|'typewriter'|'rise'
  animationOut?: TextAnimation;
};

export type AudioItem = ItemBase & {
  type: 'audio';
  media: MediaRef;
  trimBeforeFrames?: number;
  volume: number;
  fadeInFrames?: number;
  fadeOutFrames?: number;
  loop?: boolean;
  title?: string;
  artist?: string;
  trackId?: string; // Jamendo
};

export type VideoItem = MediaItem | TextItem | AudioItem;
```

**Rules (pure functions in `v2/timelineOps.ts`, all unit-tested):**

- **Main track is magnetic.** Items are contiguous from frame 0. Insert, move, delete and trim ripple the following items. A `transitionIn` overlaps the previous clip by its duration, which reproduces today's `TransitionSeries` timing exactly.
- **Overlay, text and audio tracks are free.** Items sit at any `from` and cannot overlap within the same track. A drop that would overlap creates a new track (CapCut behavior).
- **Project duration** = max end frame across tracks, clamped to the 60-second cap (1,800 frames at 30 fps). Overlay items past the main track's end are allowed, with a black (or `background.color`) frame.
- **Video item duration** ≤ `(sourceDuration − trimBefore) / playbackRate`.
- **Ops:** `insertItem`, `moveItem` (time and track), `trimStart`, `trimEnd`, `splitAt(frame)`, `duplicate`, `deleteItems`, `rippleDelete`, `setTransition`, `addTrack`, `removeEmptyTracks`, `reorderTrack`, `snapCandidates(frame, ctx)`, `clampProject` (limits from §3.1).
- **Legacy `music`** becomes an `AudioItem` on an `audio` track that spans the whole project with `loop: true`.

### 5.2 v1 → v2 migration (`v2/migrateVideoProjectV1.ts`)

Lossless for rendering:

- Each `scene` becomes a `MediaItem` on `main`: background layer → `media`, `scene.transition` → `transitionIn` (except the first scene), `motion`, `overlay`.
- Each non-background scene layer becomes a `TextItem` or an overlay `MediaItem` spanning **that scene's frame range** on a text or overlay track. Placement uses greedy track assignment: layers with the same role go to the same track when they don't overlap.
- `music` becomes an `AudioItem`.
- `parseVideoProject` returns v2 always. Old rows migrate on load; autosave writes v2. **Golden test:** for every built-in recipe × 3 formats, migrated v2 frame timings equal v1 `sceneDurationInFrames` / `transitionDurationInFrames` math, and a still render of selected frames matches (pixel diff run manually, not in CI).
- The scene `kind` (`photo`, `promo`, `slots`, `cta`) becomes item metadata used only by the template typography resolver, so themes still look identical.

### 5.3 Composition v2 (`components/video-editor/VideoCompositionV2.tsx`)

```
<AbsoluteFill background>
  for track of tracks (bottom → top, skip hidden):
    main     → <TransitionSeries> of MediaClip with transitions
    overlay  → <Sequence from durationInFrames premountFor=fps> MediaClip (transformed box)
    text     → <Sequence ...> TextClip (existing VideoLayerBody + animation wrapper)
    audio    → <Sequence ...> <Audio from @remotion/media trimBefore volume={fade curve}>
```

- Switch every `Video` and `Audio` import to **`@remotion/media`** (fixes the web-renderer gap). Images keep `<Img>`.
- Video `volume` × track mute × global preview mute; fades are a computed number per frame. The callback form is discouraged, so prefer a static volume per `Sequence` slice, or a constant volume plus `interpolate` on a wrapping audio component. Verify in the Phase 0 spike.
- `fit: 'contain'` + `background.fill: 'blur'` renders a blurred, scaled copy behind the clip (`filter: blur()` is supported by the web renderer).
- Keep `CampaignVideoComposition` v1 until Phase 3 lands, then delete it (thumbnails, AI preview and template browser all switch to v2).

### 5.4 Media library (backend)

**Bucket.** New public bucket **`marketing-media`** (not `property-media`, so its 50 MB limit and MIME list stay untouched and quota accounting has one place). `file_size_limit = 150MiB`; MIME allowlist: `image/jpeg|png|webp|heic|heif|avif|gif`, `video/mp4|quicktime|webm`, `audio/mpeg|mp4|aac|wav|ogg|webm`. **No SVG.** Paths are content-addressed: `{propertyId}/{assetId}/original.{ext}` and `{propertyId}/{assetId}/poster.jpg`, with `cacheControl: '31536000'`. Public is acceptable because this is marketing content meant to be published, and public URLs keep saved projects and Player streaming working without expiring signed URLs. Paths contain UUIDs, so they are not enumerable.

**Table** `public.marketing_media_assets` (RLS enabled, service-role only; edge functions are the access layer, per CLAUDE.md):

| column                                                                                | notes                                                                                     |
| ------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `id uuid pk`                                                                          |                                                                                           |
| `org_id`, `property_id` (FK, cascade)                                                 | scope                                                                                     |
| `kind text check (image, video, audio)`                                               |                                                                                           |
| `status text check (pending, ready, failed, deleted)`                                 |                                                                                           |
| `source text check (upload, ai, legacy_upload, music_upload)`                         | `ai` rows link generation outputs (not counted, see below)                                |
| `bucket`, `storage_path unique`, `poster_path`                                        |                                                                                           |
| `file_name`, `mime_type`                                                              |                                                                                           |
| `reserved_bytes bigint`, `size_bytes bigint`                                          | reserved at reserve time, actual size from `storage.objects` at finalize                  |
| `width`, `height`, `duration_ms`                                                      | client probe; `duration_ms` re-checked server-side from the MP4 `mvhd` box when parseable |
| `content_hash text`                                                                   | SHA-256 from the client; unique per property where `status = 'ready'` (dedupe)            |
| `meta jsonb`                                                                          | `{ peaks?: number[] }` for audio, max 8 KB                                                |
| `created_by`, `created_at`, `updated_at`, `last_used_at`, `deleted_at`, `purge_after` |                                                                                           |

Indexes: `(property_id, status, created_at desc)`, `(property_id, kind, status)`, `(status, purge_after)`, `(status, created_at) where status = 'pending'`.

**Quota accounting.** `quota bytes = sum(coalesce(size_bytes, reserved_bytes))` and `quota files = count(*)` over `status in ('pending','ready')` and `source in ('upload','legacy_upload','music_upload')`. AI outputs (`marketing-ai/`) are billed by AI credits and are **not** counted. Jamendo caches are platform-curated and not counted. Deleted items stop counting immediately; the daily upload cap bounds churn.

**RPC** `reserve_marketing_media_upload(p_property_id, p_kind, p_bytes, p_duration_ms, p_hash, p_limits jsonb)`: `pg_advisory_xact_lock(hashtext(property_id))`, recompute usage, check every limit (storage, files, per-file, duration, daily count), insert a `pending` row, and return id or a typed error code. The advisory lock prevents parallel tabs from over-reserving.

**Plan features.** New object key in `PlanFeatures` (both mirrors), modeled on `teamManagement`:

```ts
marketingMediaLibrary: {
  storageMb: number; // per property
  maxFiles: number;
  maxImageMb: number;
  maxVideoMb: number;
  maxVideoSec: number;
  maxAudioMb: number;
  dailyUploads: number;
}
```

Seeded per §3.1 in a new migration. Editable in super-admin `EditPricingPlanDialog`. `planFeaturePermissions.ts` coverage maps it to the upload leaf. Compare-matrix row: "Media library storage" (Marketing group). `planTierGolden.ts` and expectations get updated.

**Edge function** `marketing-media` (`servePropertyScoped`-style auth: `resolveScopedPropertyAccess` + `requirePropertyPermissionAndFeature`). Feature gate: entitled to `marketingMediaLibrary` (every tier has an allowance; the gate is the quota itself).

| Route                       | Permission                   | Behavior                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| --------------------------- | ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET ?kind=&q=&cursor=`     | `marketing:view`             | Paged list of `ready` assets (poster URLs, size, duration, dimensions, `usedIn` count on request).                                                                                                                                                                                                                                                                                                                                                             |
| `GET /usage`                | `marketing:view`             | `{ usedBytes, files, limits, uploadsToday }` for the meter.                                                                                                                                                                                                                                                                                                                                                                                                    |
| `POST /reserve`             | `marketing.templates:add`    | Body `{ kind, mime, bytes, durationMs?, width?, height?, hash, fileName }`. Dedupe hit returns the existing asset (no upload). Otherwise the reserve RPC runs, then the function returns `{ assetId, uploadUrl, token, posterUploadUrl? }` (signed upload URLs, 2 h). `rateLimitGate` 30 per 5 min per user. Over limit returns 403 with `upgradeHook: true` and a code (`storage_full`, `too_many_files`, `file_too_large`, `video_too_long`, `daily_limit`). |
| `POST /finalize`            | `marketing.templates:add`    | Reads `storage.objects` size and mime for the path; downloads the first 64 KB (Range) and runs `assertUploadMatchesBytes`; parses the MP4 `mvhd` duration when present. If anything is missing, oversized (> reserved or > plan cap) or mismatched, it **deletes the object** and marks the row `failed`. Otherwise it marks the row `ready`, saving the size.                                                                                                 |
| `DELETE` `{ ids[] }`        | `marketing.templates:delete` | Soft delete (`status = deleted`, `purge_after = now() + 7 days`). Returns `usedIn` counts so the UI can warn first.                                                                                                                                                                                                                                                                                                                                            |
| `POST /restore` `{ ids[] }` | `marketing.templates:delete` | Only if still within the window and the quota allows it.                                                                                                                                                                                                                                                                                                                                                                                                       |

**Sweeper** (`marketing-media-sweeper`, hosted `pg_cron` + `pg_net`, every 30 min, `serveCronPost`):

1. Expire `pending` rows older than 3 h: remove the object if present, mark `failed`.
2. Purge `deleted` rows past `purge_after`: remove original and poster objects, then hard-delete the row.
3. Orphan scan (daily): objects under `marketing-media/` with no row are removed.

**Fold existing uploads in** (closes the current cost holes):

- `upload-marketing-asset` (Posts canvas): keep the endpoint for compatibility but route through the same reserve RPC and quota. It writes a `marketing_media_assets` row (`source: 'upload'`) and stores into `marketing-media`. The Polotno Upload panel then lists the library.
- `marketing-music` multipart upload: same quota (`source: 'music_upload'`, kind audio), and add `rateLimitGate`.
- **Backfill migration:** insert `legacy_upload` rows from `storage.objects` under `property-media/marketing-uploads/` and the music upload prefix. Objects are not moved; rows point at the existing bucket and path. They count toward quota, but over-quota legacy hosts are never blocked from reading, only from new uploads.

**Saved-project validation** (in `marketing-templates` save for `content_type = 'video'`): `design_json` ≤ 512 KB, `version` 1 or 2, track and item counts and duration within caps, and every media URL must be in the allowlist (our Supabase Storage public origin for `marketing-media`, `property-media`, or the Jamendo cache prefix). Reject `data:` and `blob:` URLs.

**Activity log** (`audit-logging` skill): emit `marketing.media_deleted` (bulk-aware: one event with count and names) and `marketing.media_restored`. Uploads stay **N/A** (consistent with the existing `upload-marketing-asset` decision: staging artifacts, high volume). A blocked over-quota attempt is not logged; it is a 403.

### 5.5 Media library (UI)

Shared component `features/dashboard/marketing/components/media-library/MarketingMediaLibrary.tsx`, used by the Video editor rail (new **Media** section, first and default) and the Posts (Polotno) Upload panel.

- **Tabs:** **Uploads** · **Property** (gallery photos and videos) · **AI** (generation outputs) · **Audio** (uploads plus Jamendo browse, moved from `VideoMusicSettings`).
- **Upload:** button plus drag-and-drop onto the panel **or onto the timeline or canvas**. Multiple files. Per-file progress rows with cancel and retry.
- **Pipeline** (`lib/media/prepareMarketingMedia.ts`, lazy-loaded Mediabunny):
  1. Sniff type and reject unsupported files early.
  2. Probe dimensions and duration, then pre-check limits locally from `/usage`. This gives instant errors with no network call.
  3. Images go through the existing `prepareUpload` `PHOTO_MASTER` preset.
  4. Video: re-encode if longer edge > 1920, codec ≠ H.264/AAC, or bitrate > 10 Mbps. Target H.264 1080p about 8 Mbps with AAC audio. Skip when already compliant. Fall back to the original when WebCodecs is missing (Safari < 16.4), and the server caps still apply.
  5. Generate poster JPEG (frame at 0.5 s); audio gets a peaks array.
  6. SHA-256 hash (stream in chunks), then reserve, TUS or standard upload to the signed URL, then finalize.
- **Grid:** poster thumbnails only (never autoplay video); hover or long-press shows a muted preview with `preload="none"`. Duration badge, kind icon, "Used in N" on demand. Multi-select delete with a warning when an asset is in use.
- **Storage meter** under the tabs: "1.2 GB of 3 GB used · 120 of 500 files". It turns amber at 80% and red at 100%, with an **Upgrade** button (existing `openUpgradeModal`) when over.
- **Error copy** (via `human-copy` skill, no em dashes): "This video is longer than 60 seconds. Trim it or upgrade for longer clips.", "You've used all 500 MB of media storage. Delete files or upgrade.", "You can upload 50 files a day on your plan. Try again tomorrow."
- Hooks: `useMarketingMediaLibrary` (infinite query), `useMarketingMediaUsage`, `useUploadMarketingMedia` (queue, concurrency 2), `useDeleteMarketingMedia`. TanStack Query keys scoped by property.

### 5.6 Timeline UI (desktop, `lg+`)

`components/video-editor/timeline/`:

- `VideoTimelineV2.tsx` (container): ruler with time labels, zoom slider (fit, 25% to 800%), track headers (name, hide, mute, lock, drag handle to reorder), and track lanes.
- `TimelineItem.tsx`: clip block with filmstrip (video), single thumb (image), waveform (audio) or text preview. Left and right trim handles, selection ring, transition chip between main-track clips.
- `TimelinePlayhead.tsx`: draggable, synced with `useVideoPlayerTransport` (seek on drag, follow during playback with auto-scroll).
- **Interactions** (pointer events, pure ops from §5.1): drag to move (snaps to playhead, clip edges, 0, and the 0.5 s grid; Alt disables snapping), drag between tracks, drag onto an empty lane to create a track, trim from edges (respects source length for video and audio), **split** at playhead, marquee and Shift multi-select, duplicate, copy and paste (at playhead), delete or ripple delete.
- **Toolbar** above lanes: Undo · Redo · Split · Delete · Duplicate · Snap toggle · Zoom − / + / Fit, plus **Add**: Text · Media · Audio.
- **Keyboard:** Space play and pause, S split, Delete or Backspace delete, Shift+Delete ripple, Cmd/Ctrl+D duplicate, Cmd/Ctrl+C/V, Cmd/Ctrl+Z / Shift+Z, ←/→ step 1 frame (Shift: 1 s), Cmd/Ctrl+A select all on track. Ignored while typing in inputs.
- **Performance:** virtualize item rendering by visible time window. Filmstrip frames come from Mediabunny at the zoom-dependent density, cached in IndexedDB by `assetId + frame`. The ruler and lanes are DOM, with a canvas only for waveforms.

### 5.7 Inspector (right panel) by selection

- **Media clip:** Replace, Fit (cover or contain), Crop, Position, Size, Rotation, Opacity, Adjust (brightness, contrast, saturation), Motion (existing profiles), Overlay scrim, Transition in (main), Duration. Video only: Speed, Volume, Mute original sound, "Trim in source" scrubber.
- **Text:** existing `VideoTextStyleControls` plus text presets (Headline, Caption, Lower third, CTA pill), Animation in and out with duration, Duration.
- **Audio:** Replace, Volume, Fade in and out, Trim, Loop to end.
- **Nothing selected:** project settings: format, background color and fill, theme, total duration, and the existing template, AI and review controls.
- **Canvas** (`VideoCanvasTransformOverlay.tsx`, extends `VideoTextPositionOverlay`): select by click (topmost visible at the playhead), drag move, corner resize (Shift keeps aspect), rotate handle, center and edge snap guides, and a toggleable 9:16 safe-area guide (IG UI zones). Selection syncs both ways with the timeline.

### 5.8 Mobile (`max-lg`), required by `mobile-native-ui.mdc`

CapCut mobile pattern:

- Preview on top. The timeline below has a **fixed center playhead**, and the content scrolls horizontally under it. Pinch to zoom. Track lanes are compact (main 56 px, others 36 px); track headers collapse to icons.
- Tap a clip to select it. A **bottom action bar** replaces the editor dock: Split · Speed · Volume · Animation · Duplicate · Delete · More. Each opens a bottom sheet (`MarketingEditorMobilePanel`).
- Long-press and drag moves a clip; trim handles are 44 px targets. No keyboard shortcuts.
- **Add** button opens a sheet: Media library (full-height sheet with tabs), Text, Audio.
- Uploads use the native file picker with `accept="image/*,video/*,audio/*"` and `multiple`, with the same pipeline. The transcode runs on device with progress, and a "Keep the app open" note during long jobs.
- Verify at 375, 768 and 1024 px.

---

## 6. Phases and tasks

Each phase ends shippable behind the existing editor. A feature flag `VITE_VIDEO_EDITOR_V2` (default **off** until Phase 6 is done) lets v1 keep running in production while v2 is built. The migration makes the switch one-way per project once v2 autosaves, so the flag gates **opening in v2**, not the data.

### Phase 0: Decisions and spikes (2 to 3 days)

- [ ] **T0.1** Confirm the Remotion license position (company size ≤ 3 → free; otherwise Company License). Record it in `docs/architecture/overview.md` → third-party licenses. _Open: product decision (pass `free-license` via `VITE_REMOTION_LICENSE_KEY` if 3 people or fewer)._
- [ ] **T0.2** Spike: swap `Video`/`Audio` to `@remotion/media` in the current composition; export a project with a video background, trimmed via `trimBefore`, plus music, through `renderMediaOnWeb` in Chrome, Edge, Firefox and Safari. Record pass and fail and export time for a 30 s 1080×1920 clip. _Chromium verified (export with video, overlay, text, audio). Safari and Firefox: manual._
- [ ] **T0.3** Spike: Mediabunny probe, poster and 1080p transcode of a 60 s iPhone HEVC `.mov` and a 4K Android MP4 on a mid-range phone and a laptop. Record time, output size and failures. _Chromium verified (4K cut 34 to 5.9 MB, HEVC/VP9 to H.264)._
- [ ] **T0.4** Spike: Supabase signed upload URL + TUS resumable on local and hosted dev with a 150 MB file. Confirm hosted project plan and global file size limit (raise to ≥ 150 MB; Free plan caps at 50 MB). _Signed single PUT with 3 retries; TUS is not possible with signed URLs. Hosted global limit must be 150 MB or more (runbook)._
- [x] **T0.5** Timeline buy-vs-build: evaluate Remotion Timeline (trim, split, snapping, touch, theming, bundle size) against a 1-day custom prototype of move, trim and snap with pointer events. **Default: custom** unless Remotion Timeline covers trim, split, snap **and** touch.
- [x] **T0.6** Volume-fade approach in `@remotion/media` `<Audio>` under the web renderer (static vs per-frame).
- [x] **T0.7** Product sign-off on §3.1 limits and §13 open questions.

### Phase 1: Media library backend and quotas (4 to 5 days)

- [x] **T1.1** Migration: `marketing-media` bucket (150 MiB, MIME allowlist, public) plus `supabase/config.toml` entry.
- [x] **T1.2** Migration: `marketing_media_assets` table, indexes, RLS on (service role only), `updated_at` trigger.
- [x] **T1.3** Migration: `reserve_marketing_media_upload` RPC (advisory lock, limit checks, typed error codes) and `marketing_media_usage(property_id)` SQL function.
- [x] **T1.4** Migration: `marketingMediaLibrary` seeded into `pricing_plans.features` per §3.1 (all active tiers, plus the inactive ones for safety).
- [x] **T1.5** `planFeatures.ts` (edge + UI mirror) parse and default for `marketingMediaLibrary`; parity test; `planTierGolden.ts`, `planTierExpectations.ts`, `GATE_COVERAGE`, `PLAN_FEATURE_PERMISSION_COVERAGE` (+ the Compare row and review-dialog gain). `bun run check:plan-catalog` needs a fresh local DB.
- [x] **T1.6** `_shared/uploadLimits.ts` + client mirror: add `audio` and `marketingVideo` kinds (plan caps come from features; the static ceiling stays the bypass net).
- [x] **T1.7** `_shared/marketingMediaStorage.ts`: path builders, signed upload URL creation, Range read of the first 64 KB, `assertUploadMatchesBytes`, MP4 `mvhd` duration parser (pure, with `_test.ts`), object removal.
- [x] **T1.8** Edge function `marketing-media` (list, usage, reserve, finalize, delete, restore) with `rateLimitGate`, `upgradeHook` envelopes, and `config.toml` `verify_jwt = false` per the repo JWT convention.
- [x] **T1.9** (also purges `failed` rows after 7 days, partial index in `20261316128940`) Edge function `marketing-media-sweeper` plus the `pg_cron` schedule migration (hosted only, per `scheduled-jobs-and-testing.md`).
- [ ] **T1.10** Route `upload-marketing-asset` through the reserve RPC and library rows (store into `marketing-media`); keep the response shape. _Not in this tree: the function still writes straight to `property-media`._
- [ ] **T1.11** `marketing-music` upload: quota plus library row plus `rateLimitGate`. _Not in this tree: uploads do not reserve or write a library row yet._
- [x] **T1.12** Backfill migration: `legacy_upload` rows from `storage.objects` (`property-media/marketing-uploads/%` and the music upload prefix).
- [ ] **T1.13** `marketing-templates` save validation for video (size, version, counts, duration, URL allowlist) with friendly 400s. _Not in this tree: `_shared/marketingVideoProject.ts` is missing, so saves are not validated server-side._
- [x] **T1.14** Activity events `marketing.media_deleted` / `marketing.media_restored` via `_shared/activityLog.ts`, plus the event catalog and UI label mapping.
- [x] **T1.15** Deno tests (pure: `marketingMediaStorage_test.ts`, `marketingMediaSweeper_test.ts`, `marketingVideoProject_test.ts`; live local: `functions/tests/marketingMedia.integration_test.ts`, run with `LOCAL_MEDIA_LIVE=1`; a long-running `functions serve` must be restarted to register `marketing-media`): reserve limits (each error code), concurrency (two parallel reserves at the edge of quota), finalize rejects oversize and mismatched MIME, dedupe, delete/restore window, sweeper expiry and purge, downgrade (over quota → reserve blocked, list still works).

### Phase 2: Media library UI and upload pipeline (4 to 5 days)

- [x] **T2.1** Add `mediabunny` as a pinned direct dependency, **dynamic-import only**. Extend `scripts/media/assert-lazy-optimizer.mjs` (or a sibling check) so it never enters the initial or vendor bundle; check the PWA precache budget (see the Polotno chunk note in memory).
- [x] **T2.2** `lib/media/prepareMarketingMedia.ts`: sniff, probe, local limit pre-check, image optimize, video transcode decision and run, poster, audio peaks, chunked SHA-256. Pure decision helpers in `.ts` with Vitest tests (`shouldTranscode`, `limitErrorFor`).
- [x] **T2.3** `useUploadMarketingMedia` queue: concurrency 2, progress, cancel (AbortController plus a TUS abort), retry, and finalize-failure cleanup.
- [x] **T2.4** `useMarketingMediaLibrary`, `useMarketingMediaUsage`, `useDeleteMarketingMedia`, `useRestoreMarketingMedia` (TanStack Query, invalidation on upload, delete and restore).
- [x] **T2.5** `MarketingMediaLibrary` component: tabs, grid with posters, drag source (dnd-kit draggable carrying a `MediaRef`), drop zone, multi-select delete with in-use warning, storage meter, upgrade CTA, empty states.
- [x] **T2.6** Move Jamendo browse from `VideoMusicSettings` into the **Audio** tab.
- [ ] **T2.7** Posts editor: Polotno Upload panel lists and uploads through the library (shared quota). _Not in this tree: the Polotno upload panel still uses the legacy asset endpoint._
- [x] **T2.8** Copy pass with the `human-copy` skill for every new string.
- [ ] **T2.9** Playwright mocked E2E (`ui/e2e/features/marketing/`): upload success, over-quota error and upgrade modal, video-too-long error, delete with in-use warning, restore. _Partly done: `videoEditorV2.spec.ts` covers library pick, storage meter, split, delete and phone flows. Upload success, over-quota and restore are covered by the live Deno suite, not mocked E2E._

### Phase 3: Project model v2, migration and renderer (5 to 6 days)

- [x] **T3.1** `v2/videoProjectV2Types.ts` (§5.1) plus limits constants.
- [x] **T3.2** `v2/timelineOps.ts`: all ops and invariants from §5.1, with extensive Vitest coverage (magnetic ripple, transitions overlap, split mid-video keeps `trimBefore` continuity, trim bounds by source length and speed, no overlap on free tracks, track auto-create, clamp to caps).
- [x] **T3.3** `v2/timelineTiming.ts`: frame ↔ time, main-track derived `from`, project duration, the item active at a frame (for canvas selection).
- [x] **T3.4** `v2/migrateVideoProjectV1.ts` plus golden tests across every recipe in `videoStoryboardRecipes.ts` × 3 formats.
- [x] **T3.5** `parseVideoProject` returns v2; `buildDefaultVideoProject`, `videoAiProjectBuilder`, `applyGuestReviewToVideoProject` and recipes emit v1 and migrate (or emit v2 directly where simple).
- [x] **T3.6** `VideoCompositionV2` (§5.3) using `@remotion/media`; text animation wrappers; contain plus blur fill; adjustments; fades.
- [ ] **T3.7** Switch preview Player, export, scene/project thumbnails (`renderMarketingVideoThumbnail`, `captureVideoProjectThumbnail`), template browser stills and AI preview to v2. Delete the v1 composition. _Done for thumbnails, library stills and preview/export. The v1 composition stays only inside the rollback editor (`VITE_VIDEO_EDITOR_V2=false`); delete it with the v1 UI next release._
- [x] **T3.8** Missing-media placeholder clip (asset 404 or deleted), with a hook for the **Replace** action.
- [ ] **T3.9** Manual frame-diff check of 6 representative templates, v1 vs v2 (screenshots in the PR). _Manual frame-diff of 6 templates v1 vs v2 not done; export of the default template verified in Chromium._

### Phase 4: Multi-track timeline UI, desktop (6 to 8 days)

- [x] **T4.1** Timeline shell: ruler, zoom, track headers (hide, mute, lock, reorder), lanes, horizontal scroll, virtualization.
- [x] **T4.2** Items: thumbnails, filmstrip (Mediabunny frames plus IndexedDB cache), waveform canvas, text preview, transition chips.
- [x] **T4.3** Playhead sync with `useVideoPlayerTransport`: scrub, follow, auto-scroll, click-to-seek on the ruler.
- [x] **T4.4** Pointer interactions: move, cross-track move, new-track drop, trim, snapping (playhead, edges, grid; Alt bypass), marquee and Shift multi-select.
- [x] **T4.5** Commands: split, delete, ripple delete, duplicate, copy and paste, add text, media and audio at the playhead, all through `timelineOps` and recorded in `useVideoProjectHistory`.
- [x] **T4.6** Keyboard shortcuts (§5.6) with input-focus guard; extend `useVideoProjectHistoryShortcuts`.
- [x] **T4.7** Drop from the media library onto a lane (inserts at the drop time) and onto the canvas (inserts on a new overlay track at the playhead).
- [x] **T4.8** Replace `VideoTimeline.tsx` usage behind `VITE_VIDEO_EDITOR_V2`.
- [x] **T4.9** Accessibility: items are focusable buttons with `aria-label` "Clip, 0:03 to 0:07"; keyboard move and trim with arrows when focused (`accessibility` skill).

### Phase 5: Inspectors and canvas manipulation (4 to 5 days)

- [x] **T5.1** Media clip inspector (§5.7) including video speed, volume, mute and source trim scrubber.
- [x] **T5.2** Text inspector: presets, animations in and out, duration; reuse `VideoTextStyleControls`.
- [x] **T5.3** Audio inspector: volume, fades, trim, loop.
- [x] **T5.4** Project inspector: format, background color and fill, duration readout against caps, template, AI and reviews.
- [x] **T5.5** `VideoCanvasTransformOverlay`: select topmost at playhead, move, resize, rotate, snap guides, safe-area toggle, two-way selection sync.
- [x] **T5.6** Missing-media **Replace** flow (opens the library filtered to the same kind).
- [ ] **T5.7** Retire `VideoSceneSettings` / `VideoSceneElementsPanel` once parity is confirmed. _Deferred with T6.6: the scene panels remain only for the rollback editor._

### Phase 6: Mobile editor (4 to 5 days)

- [x] **T6.1** Fixed-center-playhead timeline variant: horizontal scroll drives the seek, pinch zoom, compact lanes.
- [x] **T6.2** Bottom action bar for the selected item, plus bottom sheets for each inspector group.
- [x] **T6.3** Long-press drag, 44 px trim handles, haptics-free feedback (visual only).
- [x] **T6.4** Add sheet: full-height media library, text, audio; native multi-file picker; transcode progress UI.
- [x] **T6.5** Invoke `mobile-responsive` skill gates; verify 375, 768 and 1024 px in Playwright screenshots.
- [ ] **T6.6** Turn `VITE_VIDEO_EDITOR_V2` on by default; keep the flag one release for rollback, then delete the v1 UI code. _Flag is on by default. Deleting the v1 UI is deferred one release for rollback._

### Phase 7: Templates, AI and reviews on v2 (2 to 3 days)

- [ ] **T7.1** Storyboard recipes: text beats that should span scenes (for example, one headline across the opening photos) become single spanning `TextItem`s, so templates show off the new model. _Not done: recipes still emit per-scene text. A headline spanning several scenes is a follow-up._
- [x] **T7.2** AI project builder: allow uploaded library media as candidate clips (photos plus short videos), not only the gallery.
- [x] **T7.3** Guest review seeding writes to the right text items in v2.
- [x] **T7.4** "Copy to size" and format change: re-layout transforms per format (keep relative positions; main track stays full-frame).

### Phase 8: Export, publish and performance hardening (2 to 3 days)

- [x] **T8.1** Export: progress modal with **Cancel** (abort signal if `renderMediaOnWeb` supports it, otherwise a worker-stop guard; verify), keep-tab-visible note (background tabs throttle rendering), and a preflight that checks every media URL is reachable and decodable before starting.
- [x] **T8.2** Duration guard: the timeline cannot extend past 60 s (insert, move, trim and paste clamp at 1,800 frames, with a short notice when content is cut off), export blocks anything longer as a server-checked backstop, and the duration readout shows "0:42 / 1:00". Align with the Reels publish work in `marketing-meta-publishing-gaps.md`.
- [ ] **T8.3** Player performance: `premountFor` on media sequences, a cap of 3 concurrently visible videos (inspector warns), and `maxCanvasSinkFrameSize` for preview on low-tier devices (`marketingDeviceTier`). _Done: `premountFor`, 3-video warning. `maxCanvasSinkFrameSize` is not exposed by the installed `@remotion/media`._
- [x] **T8.4** Update `last_used_at` for referenced assets on save (batched, best-effort) to support future retention policy.
- [x] **T8.5** Super-admin: per-org and per-property media usage on the org detail page plus a total on `/admin` overview (reads `marketing_media_usage`). Link to `super-admin-service-cost-monitoring.md`.

### Phase 9: Docs, plans UI and QA (2 days, plus docs in every phase)

- [x] **T9.1** `docs/architecture/storage.md`: new bucket, table, quota model, sweeper, backfill, folded-in endpoints.
- [x] **T9.2** New `docs/architecture/marketing-video-editor.md`: v2 model, ops invariants, composition, migration, limits. Link from `overview.md` and `PROJECT.md` (new edge functions, env, bucket).
- [x] **T9.3** `docs/architecture/plans-feature-matrix.md`: `marketingMediaLibrary` row per tier, gate coverage, downgrade behavior.
- [x] **T9.4** `planPresentation.ts` Compare row ("Media library storage") plus tier card bullets; check `/for-hosts/pricing` and `/org/:orgSlug/plans`.
- [x] **T9.5** Route guide `docs/guides/routes/org/property/marketing.md` (`route-guides` skill): Videos editor (tracks, timeline, shortcuts, mobile), Media library, limits, host Q&A ("How much can I upload?", "What happens if I downgrade?", "Why was my video converted?").
- [x] **T9.6** `docs/archive/operations/migration-runbook.md`: migration order, backfill, hosted global file-size limit change.
- [x] **T9.7** `.cursor/rules` / `.claude` skill notes if new conventions emerge (for example, "all marketing uploads go through `marketing-media` reserve").
- [ ] **T9.8** QA pass with the `property-dashboard-qa` skill on Marketing across 5 tiers × 3 viewports; `bun run ci:quality`. _Partly done: `ci:quality` pieces run green (Vitest, Deno, Playwright @ci, budgets, lazy checks). The 5 tiers x 3 viewports `property-dashboard-qa` pass is manual QA._
- [ ] **T9.9** Move this plan to `in-progress/` on start and `done/` on finish (`workflow` skill), and update the README rows. _Moved to `for-testing/`; move to `done/` after QA._

**Rough total:** about 35 to 45 working days for one engineer. Phases 1–2 and 3 can run in parallel with two people.

---

## 7. Data migration and rollout order

1. Deploy Phase 1 migrations (bucket, table, RPC, plan features, backfill), then the edge functions, then the sweeper cron. **Production deploy needs the `kamewave` unlock** (`no-prod-deploy.mdc`).
2. Ship the Phase 2 UI (library in Posts and the v1 Video editor rail). Quotas are live from this point for **all** marketing uploads.
3. Ship Phases 3–5 with `VITE_VIDEO_EDITOR_V2=false` in production and `true` on dev and preview.
4. Phase 6 flips the flag on. v1 rows migrate on open; no bulk rewrite of `design_json` is needed (lazy migration, never destructive, since v1 parsing stays forever).
5. Rollback: flag off restores v1 UI for projects not yet saved as v2. A v2-saved project opened with the flag off is converted down to a **read-only "open in new editor" notice**, not silently broken.

---

## 8. Plans and permissions (`plans-and-permissions` skill)

- **Plan:** new `marketingMediaLibrary` object (§5.4). No new boolean gate: every tier gets an allowance; Download and Publish gates are unchanged (`marketingStudio` Pro+, `marketingPublishLimitPerGroup` Business+).
- **Team RBAC:** reuse existing leaves. Upload → `marketing.templates:add`; delete and restore → `marketing.templates:delete`; list and usage → `marketing:view`. No new leaves, which keeps the role editor unchanged. Revisit if hosts ask to separate "can upload" from "can edit".
- **Downgrade:** nothing deleted; over-quota blocks reserve with `upgradeHook`; the banner in the library explains.

## 9. Security and abuse checklist

- [ ] Bytes never pass through edge functions; signed upload URLs are path-bound, single-use, and 2 h TTL.
- [ ] Magic-byte sniff at finalize; stored content type is the sniffed one; no SVG or HTML.
- [ ] Size is authoritative from `storage.objects`, not the client; oversize is deleted.
- [ ] Advisory-locked reservation prevents race-based quota bypass.
- [ ] `rateLimitGate` plus daily cap; dedupe; pending expiry; orphan sweep.
- [ ] Saved-project URL allowlist (no third-party hotlinks, no `data:` or `blob:`), size and count caps.
- [ ] No PII in logs (file names are host content, so log ids only).
- [x] `security-auditor` subagent review (see findings handling in the PR) of `marketing-media` before production.

## 10. Testing strategy (`testing` skill)

- **Vitest** (pure `.ts` only, since `.test.tsx` component tests do not run in this repo): `timelineOps`, `timelineTiming`, `migrateVideoProjectV1` goldens, limit and transcode decisions, URL allowlist, plan feature parse and parity.
- **Deno:** `marketingMediaStorage_test.ts` (mvhd parser, path builders), `functions/tests/marketingMedia.test.ts` (reserve, finalize, delete, restore, limits, downgrade), sweeper.
- **Playwright mocked E2E** (`ui/e2e/features/marketing/video-editor/`): add media to timeline, split and trim, caption spanning 3 clips, audio fade, delete in-use asset warning, over-quota upgrade modal, mobile 375 px add-and-split flow, plan tier gates via `tierGateMocks`.
- **Manual:** export matrix (Chrome, Edge, Firefox, Safari × 9:16, 1:1, 16:9), iPhone HEVC upload, 150 MB upload on slow network (TUS resume), v1 template frame-diffs.

## 11. Later (not in this plan, small follow-ups)

- Voiceover recording (MediaRecorder → audio asset; same quota).
- Auto captions (STT, AI-credit gated) into a text track.
- Audio ducking (music volume drops under voiceover) and a beat marker grid.
- Retention policy for long-unused assets on Free (notify, then archive), tied to `last_used_at`.
- Server-side render (Remotion Lambda) for long or 4K exports, if client export proves too slow.
- Org-pooled storage (if chosen in §13).

## 12. Out of scope

Keyframe animation curves, masks, chroma key, blend modes, color grading or LUTs, reverse playback (unsupported by `@remotion/media`), freeze frame, multicam, motion tracking, stabilization, 4K or 60 fps export, collaborative real-time editing, a stock media marketplace beyond Jamendo.

## 13. Open questions (decide in T0.7)

1. **Remotion license:** is the company at most 3 people (free), or do we need the Company License? This already applies today.
2. **Free tier uploads:** Free cannot download or publish (watermarked preview only). Keep a small 100 MB trial allowance (recommended, matches Canva and Kapwing letting free users try), or set Free to 0 like CapCut?
3. **Per-property vs org-pooled quota:** recommended per-property for v1.
4. **Timeline:** buy Remotion Timeline or build custom (recommended custom unless the T0.5 spike shows full trim, split, snap and touch support)?
5. ~~**Max project length**~~ **Decided 2026-11-01: 60 seconds** for every tier (project and per-upload clip length; Free uploads stay at 30 s).

## Sources

- Canva upload limits: [canva.com/help/upload-media](https://www.canva.com/en_gb/help/upload-media/), [canva.com/help/manage-uploads](https://www.canva.com/help/manage-uploads/)
- Adobe Express free plan: [helpx.adobe.com/express/.../free.html](https://helpx.adobe.com/nz/express/web/adobe-express-subscription/free.html), [adobe.com/express/pricing](https://www.adobe.com/express/pricing.html)
- Kapwing limits: [kapwing.com/help/is-kapwing-free](https://kapwing.com/help/is-kapwing-free)
- CapCut storage: [capcut.com/help/web-cloud-storage-explain](https://www.capcut.com/help/web-cloud-storage-explain), [capcut.com/help/capcut-pro-cloud-storage-full](https://www.capcut.com/help/capcut-pro-cloud-storage-full), [TechCrunch, Jul 2024](https://techcrunch.com/2024/07/12/capcut-will-stop-offering-free-cloud-storage-from-august-5)
- Remotion license and pricing: [remotion.dev/docs/license](https://remotion.dev/docs/license), [remotion.dev/terms](https://www.remotion.dev/terms)
- Remotion web renderer and limitations: [remotion.dev/docs/web-renderer](https://www.remotion.dev/docs/web-renderer/), [client-side-rendering/limitations](https://www.remotion.dev/docs/client-side-rendering/limitations)
- `@remotion/media` Video: [remotion.dev/docs/media/video](https://www.remotion.dev/docs/media/video)
- Remotion Timeline and Editor Starter: [remotion.dev/docs/timeline](https://www.remotion.dev/docs/timeline), [remotion.dev/docs/editor-starter](https://remotion.dev/docs/editor-starter), [buy a video editor](https://www.remotion.dev/docs/buy-a-video-editor)
- Mediabunny: [mediabunny.dev](https://mediabunny.dev/), [github.com/Vanilagy/mediabunny](https://github.com/Vanilagy/mediabunny)
- react-timeline-editor: [react-timeline-editor docs](https://react-timeline-editor-flax.vercel.app/docs/timeline-editor)
- Supabase limits and pricing: [storage file limits](https://supabase.com/docs/guides/storage/uploads/file-limits), [supabase.com/docs/pricing](https://supabase.com/docs/pricing)
- Instagram Reels API: [developers.facebook.com, IG User Media](https://developers.facebook.com/documentation/instagram-platform/instagram-graph-api/reference/ig-user/media)

## Security review (2026-11-01)

Fixed: `/used-in` route was unregistered; posters are now sniffed as JPEG and capped at 2 MB; video length needs a server or client value; every `*Url` key in a saved project is allowlisted; `used-in` takes at most 10 ids; width and height are clamped.

Open follow-ups (none critical): move `/restore` into a locked RPC (race with reserve); scope the saved-project URL allowlist to the property and reject `..`; rate-limit `finalize`, `restore` and `used-in`; fail the sweeper closed when its cron secret is unset; recompute `content_hash` at finalize; sweep orphan uploads more often than daily; check `Content-Length` before buffering in `upload-marketing-asset` and `marketing-music`.
