# Marketing video editor (multi-track) and media library

Videos tab of Marketing Studio. Replaces the scene slideshow with a CapCut-style timeline: photos, video, text and audio each sit on their own track. Hosts upload media to a per-property library with plan quotas. Plan and history: [`../workflow/in-progress/marketing-video-editor-multitrack.md`](../workflow/in-progress/marketing-video-editor-multitrack.md).

## Rollout and flags

| Flag                        | Effect                                                                                                                                                                        |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `VITE_VIDEO_EDITOR_V2`      | On unless set to `false`. `false` opens the old scene editor (rollback, kept one release). Saved projects are data: v1 rows open in either editor (v2 upgrades them on open). |
| `VITE_REMOTION_LICENSE_KEY` | `free-license` (3 people or fewer) or a company key, passed to `renderMediaOnWeb`. Unset logs Remotion's licence reminder. Open decision T0.1.                                |

The loader (`marketingEditorPreload.ts`) picks the editor, so hover-preload warms the right chunk.

## Project model v2

`ui/src/features/dashboard/marketing/lib/video/v2/`

- `videoProjectV2Types.ts`: `VideoProjectV2 { version: 2, tracks[] }`. `tracks[0]` is the single **main** track; others are `overlay`, `text`, `audio`. Order is bottom to top and is the render order (the web renderer ignores z-index).
- Items: `MediaItem` (image or video), `LayerItem` (text, CTA, slots, logo; same payload as v1 layers so templates look identical), `AudioItem`.
- **Main track is magnetic**: contiguous from frame 0; insert, move, delete and trim ripple later clips; `transitionIn` overlaps the previous clip. Free tracks never overlap; a clash makes a new track.
- Limits (`VIDEO_V2_LIMITS`, mirrored server-side in `_shared/marketingVideoProject.ts`): 60 s, 10 tracks, 150 clips, 3 visible videos, `design_json` 512 KB, own-storage media URLs only.
- `timelineOps.ts` holds every edit as a pure function returning `OpResult` (`ok`, `reason`, `clamped`, `itemIds`). `timelineTiming.ts` derives time and active items. `timelineDrag.ts` / `timelineScale.ts` are drag and zoom math. All have Vitest coverage (randomized invariant tests for ops).
- `editorCommands.ts` builds items from library payloads, text presets, duplicate and clipboard helpers. `canvasPatch.ts` applies canvas drags. `shortcuts.ts` maps keys to commands.

### v1 to v2

`migrateVideoProjectV1` is lossless for timing. `parseVideoProjectV2` accepts either version; v1 rows migrate on load and autosave writes v2. Known difference: v1 `sceneStartFrame` drifted after the second transition; v2 uses the correct cumulative math. Migrated text ends where the next transition begins and fades over 6 frames.

Default music: a v1 template's music cue has no file until the editor resolves the Joystock track. `projectLoad.ts` returns it as `pendingMusic`; `useResolveDefaultVideoMusic` resolves it and `withResolvedMusic` adds the looping `music` audio clip (a later cached copy only updates it if the clip still exists).

AI-built videos are saved as v1 scene projects and upgrade on open. The builder draws scene media from the host's recent uploads first (`aiLibraryMedia.ts`), then the property gallery.

## Composition and export

- `VideoCompositionV2.tsx`: `TransitionSeries` for main, `Sequence` per other item, `Video`/`Audio` from `@remotion/media` (the only ones the web renderer supports). Contain fit uses a blurred backdrop. A missing file shows a striped placeholder; during export `strictMedia` makes it fail instead.
- `exportVideoV2.ts`: blockers (empty, over 60 s) → `canRenderMediaOnWeb` → reachability probe of every media URL (`exportPreflight.ts`) → `renderMediaOnWeb` with an `AbortSignal` (Cancel) and progress. Muted when nothing can make sound (`projectHasAudio`). Jamendo stream clips are cached to Storage first (`exportAudio.ts`); a clip that cannot be cached is dropped from the export with a notice.
- Verified in Chromium only. Safari and Firefox need a manual matrix. `maxCanvasSinkFrameSize` is not exposed by the installed `@remotion/media`, so preview decode load is limited by the 3-visible-videos warning and `premountFor`.
- Thumbnails: `renderVideoProjectThumbnailV2` (audio tracks dropped) renders a still at 60% into the first main-track clip; the Library card and template stills use it for v2 rows, the v1 renderer for legacy ones.

## Editor UI

`components/video-editor/VideoEditorV2.tsx` with `v2/` pieces: preview with canvas overlay (move, resize, rotate, snap, safe-area guide), timeline, inspectors, transport, export dialog.

- Desktop timeline: ruler, zoom, track headers (hide, mute, lock), drag, trim, snap, split, copy and paste, marquee. Shortcuts: Space, S, Delete, Shift+Delete (ripple), Cmd/Ctrl+D, C, V, A, Z, arrows (Shift = 1 s). A focused slider does not swallow them.
- Phone (`max-lg`): fixed centre playhead, scrolling the lanes scrubs, pinch zooms, long-press (320 ms) arms a clip drag, 44 px trim handles. A selected clip swaps the dock for an action bar (Edit, Split, Replace, Copy, Delete).
- Left rail: Media (library), Text presets, Templates, Reviews, AI. The Media panel starts open only at 1536 px and wider. Replace opens the library filtered to the clip's kind.
- Autosave only; there is no manual Save, so no unsaved-changes guard applies.

## Media library

Bucket `marketing-media` (public, 150 MiB, MIME allowlist, no SVG). Table `marketing_media_assets`; quota and reserve RPCs; `marketing-media` edge function (list, usage, used-in, reserve, finalize, abandon, delete, restore); `marketing-media-sweeper` cron. Bytes go straight to Storage over signed upload URLs; the function only reserves and finalizes. Details: [`storage.md`](storage.md), [`edge-functions.md`](edge-functions.md), [`data-model.md`](data-model.md).

Client (`lib/media/`): sniff, probe, local limit check, image optimize, video re-encode to H.264 1080p when needed (Mediabunny, lazy), poster, audio peaks, chunked SHA-256, upload queue (2 at a time, 3 retries, cancel). TUS resumable is not possible with signed upload URLs, so uploads are a single PUT; hosted Supabase needs its global file size limit at 150 MB or more (Free plan caps at 50 MB).

Quota per property comes from the plan feature `marketingMediaLibrary` (see [`plans-feature-matrix.md`](plans-feature-matrix.md)). Nothing is deleted on downgrade; over quota only blocks new uploads. Deleting asks first and shows how many saved designs use the file (`used-in`); delete is soft for 7 days with Undo.

Team RBAC: `marketing.media:add` (reserve / finalize / abandon) and `marketing.media:delete` (delete / restore), split out of `marketing.content:add` / `:edit` by `20261318140000_marketing_media_permissions.sql`.

Only the Videos rail reads this library today. The Posts (Polotno) Upload panel and the `marketing-music` upload still use `upload-marketing-asset` against `property-media`, and `marketing-templates` does not yet validate a v2 project on save; those three integrations are open tasks T2.7, T1.11 and T1.13 in the plan.

`marketing-templates` saves stamp `last_used_at` on referenced assets (best effort, for a future retention policy). Activity: `marketing.media_deleted`, `marketing.media_restored`; uploads and the `last_used_at` stamp are `activity-log: N/A` (high-volume bookkeeping).

## Super-admin

`/admin` overview shows total media storage; the org hub shows storage per property (`get-organization-admin`, `super-admin-overview`). Plan limits are edited in the pricing plan dialog.

## Tests

Vitest for all pure modules; Deno for the edge helpers; live local `functions/tests/marketingMedia.integration_test.ts` (`LOCAL_MEDIA_LIVE=1`); Playwright `ui/e2e/features/marketing/video-editor/` (desktop and phone). CI asserts Mediabunny stays lazy (`scripts/media/assert-lazy-mediabunny.mjs`).
