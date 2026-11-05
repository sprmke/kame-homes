---
stage: done
title: 'AI Studio: example gallery and one-tap recipes'
status: done
tags: [workflow, done, marketing, ai-studio, ux]
updated: 2026-11-02
kind: plan
---

# AI Studio: example gallery and one-tap recipes

**Intake:** `docs/workflow/intake/_to-dos.md` ("AI Studio: add existing samples of image generated and prompt settings the user can reuse").

**Goal.** A host opening AI Studio should know in under five seconds what each output looks like, pick one they like, and get something close to it on the first Generate. Today they meet a blank text box and three abstract cards.

**Out of scope.** Editor AI rails (Posts / Videos / Calendar tabs), Meta publishing, new plan entitlements, super-admin curation UI (follow-up, see the end).

**Status: shipped 2026-11-02.** Code-complete, unit + Deno + e2e + QA verified, docs updated (Phases 0-1, 3-8; see per-task checkmarks below). **Post** examples are live today, rendering through the real poster compiler with no pre-generated files needed. **Photo and clip examples are fully built end-to-end** (catalog, gallery, detail, form wiring, the whole asset pipeline) **but gated off** (`READY_SAMPLE_IDS` empty) because generating their real assets needs a paid Gemini/Veo key — the local key is confirmed free-tier (`Quota exceeded ... limit: 0` on `gemini-3.1-flash-image`, reproduced twice live), a billing decision only the user can make, not an engineering gap. Per explicit user decision on 2026-11-02, this is shipped now rather than held open for that; the remaining asset-generation work is split out to **[`ai-studio-sample-assets.md`](../in-progress/ai-studio-sample-assets.md)**, a small standalone follow-up.

---

## 1. What is confusing today (audit)

Read from `AiStudioHome.tsx`, `AiStudioCreate.tsx`, `AiStudioConversation.tsx`, `lib/aiStudioSessions.ts` and the route guide.

| #   | Problem                                                                                                                                                                                                                                                     | Where                                           |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| P1  | Home shows three output cards (Post / Photo / Clip) with a one-line hint. Nothing shows what a finished **photo** or **clip** looks like; the Photo card is just the host's cover photo with a sparkle badge, which reads as "your existing photo".         | `AiStudioHome.tsx` `OutputStartCard`            |
| P2  | Step 2 starts on an empty text box. The three example chips (`START_EXAMPLES`) are text only, short ("Pool at sunset"), and do not set any of the settings that actually shape the result (look, camera move, size, angle).                                 | `AiStudioCreate.tsx`, `aiStudioSessions.ts:215` |
| P3  | The desktop preview pane is a placeholder: a post shows `ThemePostArt` with the property name (not what Generate will make), a photo shows "Your photo will appear here", a clip shows the start frame with a play icon. It sets no expectation of quality. | `AiStudioCreatePreview`                         |
| P4  | The difference between the three outputs is not obvious. "Post" is a designed graphic with words; "Photo" is a new picture with no text; "Clip" is an 8s video from one photo. Hosts pick Photo expecting a poster and vice versa.                          | home cards, segment control                     |
| P5  | What you get is not stated up front: Post makes **4** designs and is fast, Photo makes **1** in 5-15s, Clip makes **1** and takes minutes. Cost shows only on the Generate button.                                                                          | `GenerateButton` label                          |
| P6  | Photo and clip results depend heavily on the reference photo, but nothing tells the host which photo to add for a given idea ("golden hour balcony" needs a balcony photo).                                                                                 | `AiStudioPhotoPicker`                           |
| P7  | The settings that matter most for a good clip (camera move) and a good photo (look) are hidden under Advanced, so the example chips can never reproduce a strong result.                                                                                    | Advanced collapsible                            |
| P8  | There is no path from "I saw a good result" to "make me one like that" except **Use these settings** on a host's own past job.                                                                                                                              | `AiStudioJobCard.tsx:124`                       |

## 2. Review of the proposed idea

**The idea:** show pre-generated sample media for each category; picking one loads its prompt and settings so the host knows what to expect.

**Verdict: yes, it is the right core move.** It is the "example-first" pattern used by Adobe Firefly (gallery → **Try prompt**), Canva Magic Media (style tiles), Midjourney Explore, Runway / Pika (preset motion cards) and Airbnb's onboarding (show the finished listing before asking for input). Recognition beats recall: a host who cannot describe a good photo can still point at one. It also does the job of a sales page, which matters because Photo and Clip are paid tiers.

**Where it needs changing to actually work:**

| Concern                                                                                                                                                                                                                                                                                                                                                                                                | Change                                                                                                                                                                                                                                                                      |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Posts do not need static samples.** A post is compiled in the browser from a spec (archetype + copy + photos + theme). We can render every post example **live, with the host's own photos, facts and theme, at zero AI cost** (`buildRuleBasedPosterSpecs` + `compilePosterDocument` + `renderPosterDocument`). That is strictly better than a stranger's property: what they see is what they get. | Post examples = live renders of the host's own listing. A static showcase render is only the instant placeholder and the fallback when the property has no photos.                                                                                                          |
| **Photo / clip examples cannot use the host's photos** without spending real generation credits per host per visit (Gemini image, Veo video).                                                                                                                                                                                                                                                          | Photo / clip examples are pre-generated once on a showcase property and shipped as static files. No per-host cost.                                                                                                                                                          |
| **A single output image hides the most important fact**: photo and clip results start from the host's photo.                                                                                                                                                                                                                                                                                           | Show photo examples as **before → after** (source photo, then result) and clips as **start frame → playing clip**. This teaches "bring a good photo of X".                                                                                                                  |
| **Picking should never spend credits.** Auto-generating on tap would surprise people and burn the budget.                                                                                                                                                                                                                                                                                              | Tap = load the recipe into the form. Generate stays an explicit, priced click.                                                                                                                                                                                              |
| **Expectation risk.** A polished sample can over-promise if the host's photos are weak.                                                                                                                                                                                                                                                                                                                | Every sample is labelled **Example**; detail view says "Results depend on your photo". Samples are made by the real production pipeline at **Standard** quality (never Premium, never retouched), and the exact settings are stored, so the recipe genuinely reproduces it. |
| **Choice overload.** Dozens of tiles turn into a second confusing page.                                                                                                                                                                                                                                                                                                                                | 6 posts, 6 photos, 4 clips. Grouped by what the host wants to say, not by technical setting.                                                                                                                                                                                |
| **Recipes must stay valid.** Look ids, camera moves, sizes and prompt limits change over time.                                                                                                                                                                                                                                                                                                         | The catalog is typed against the same enums and covered by a unit test that fails CI if any recipe goes out of range or any file is missing.                                                                                                                                |

**Rejected alternatives**

- _Generate a personalised photo/clip sample for each host on first visit._ Real cost per host (an 800-credit clip each), slow, and it fails for properties without good photos. Possible later as an opt-in "Try with my photo" at Draft quality, paid by the host.
- _Store samples in a DB table + storage bucket with a super-admin editor._ More moving parts than v1 needs (migration, per-environment seeding across legacy / mt-dev / mt-prod, RLS, an admin UI). A typed catalog in code plus files under `ui/public` works in every environment with no data step. Kept as a follow-up once the catalog needs editing without a deploy.
- _Only better text chips._ Cheaper, but does not solve P1, P3, P4 or P6.

## 3. Target experience

### 3.1 Home (empty and returning)

- Keep the start row (**New post · New photo · New clip**). Under each start card on the empty state, a one-line outcome: "4 designs with your words and photos" / "1 new photo of your place, no text" / "1 video, 8 seconds, from one photo". Same outcome line in the segment control tooltip on step 2. (P4, P5)
- New section **Start from an example** below the start row, on both the empty and the returning home:
  - Filter: **All · Posts · Photos · Clips** (same `SegmentedControl` as the Type filter).
  - Responsive grid of `AiStudioSampleCard`: media at its own shape, title ("Weekend promo"), output icon, plan `TierBadge`, credit cost.
  - Returning home: one horizontal row (scroll-snap) with **See all** opening the full grid, so **Your creations** is not pushed far down. Empty home: full grid, since there is nothing else to show.
  - Hidden in **Recently deleted** and **Recent publishes** views.
- Card behaviour: photo cards crossfade before → after on hover (desktop) or show a small **Before** chip that toggles on tap (touch). Clip cards show the poster frame and play muted inline when ≥60% visible **and** hovered on desktop; on touch they play only in the detail view. No autoplay under `prefers-reduced-motion` or `navigator.connection.saveData`.

### 3.2 Example detail

Tap a card → desktop `Dialog`, phone bottom `Sheet` (per `mobile-native-ui.mdc`):

- Large media. Photo: before / after toggle. Clip: plays with controls, muted by default (has sound toggle if the sample has audio).
- **Example** badge and "Results depend on your photo" (photo / clip only).
- The prompt in the host's words (not the enhanced prompt) and setting chips: e.g. `Golden hour · Portrait 4:5 · Standard`, `Push in · Ambient · 9:16`.
- **What you need**: e.g. "A photo of your balcony or view" (photo / clip), "Uses your listing photos" (post).
- Credits and time: "720 credits · about 3 min".
- Primary **Use this example**. Secondary arrows to step through examples of the same output (keyboard ← →).
- Gated: plan below the output's tier still shows everything; the button reads **Use this example** and the form opens (Generate already raises the upgrade modal). No permission: button disabled with "Ask the owner for access" (same copy as start cards).

### 3.3 Step 2 with an example applied

- URL: `?tab=generate&item=new&output=image&sample=<sampleId>`. Refresh and Back keep it. Unknown id, or id whose output differs from `output`: ignored silently (output wins), param removed with `replace`.
- The form loads the recipe: description, angle (post), size, look, camera move, sound, quality, resolution, image size, auto-improve. Advanced shows a summary so the host sees what was set (no need to open it).
- A slim banner at the top of the form: example thumbnail + "Using _Golden hour balcony_" + **Clear** (resets to defaults, removes `sample`).
- Photo / clip with no reference yet: the photo picker shows the recipe's need as its empty-state line ("Add a photo of your balcony or view") and a pulsing outline once; it does not auto-open the sheet. Generate stays allowed for photo (text-only works); for a clip recipe that is image-to-video, Generate with no start frame opens the photo sheet instead of submitting.
- Desktop preview pane (P3):
  - Nothing applied: a compact strip of examples for the current output ("Pick an example or describe your own") instead of the empty placeholder.
  - Example applied, no host photo yet: the example's result with **Example** badge.
  - Host photo added: their photo as "Your photo" with the example result small in the corner as "Aim", so they can compare.
  - Post: live render of the picked layout with their listing (see 4.4).
- Phone: examples appear as a horizontal strip above the description box when the box is empty; the applied banner replaces it.
- Editing after applying: free. If the host changes the text, the banner says "Based on _Golden hour balcony_" (still clearable). Switching output (Post / Photo / Clip) drops the recipe and the param, keeps the typed text (current behaviour).
- Applying an example over text the host typed: replace, toast **Example applied** with **Undo** (restores previous form state). No confirm dialog.
- Generate does exactly what it does today. The resulting conversation records which example it came from (4.6).

### 3.4 Post specifics

Each post example pins an **angle + archetype** (layout). Generate still makes 4 designs, but the picked layout is placed first and opens as V1 unless it fails layout QA (`auditPosterDocument`), in which case it is placed by QA rank like today. This keeps "what I picked is what I got" without removing variety.

## 4. Design and implementation

### 4.1 Catalog (single source of truth)

New `ui/src/features/dashboard/marketing/lib/aiStudioSamples.ts` (+ `aiStudioSamples.test.ts`). Pure data and pure functions only, so Vitest can cover it (component `.test.tsx` files are not run, see memory note).

```ts
type AiStudioSampleBase = {
  id: string; // stable, kebab-case, used in URLs and analytics
  output: AiStudioOutput;
  title: string; // "Golden hour balcony"
  need: string | null; // "A photo of your balcony or view"
  order: number;
};

type PostSample = AiStudioSampleBase & {
  output: 'post';
  goal: PosterGoal;
  archetype: PosterArchetypeId;
  format: DesignTemplateFormat;
  prompt: string; // optional host words, '' allowed
  placeholder: SampleMedia; // static showcase render, instant paint + fallback
};

type PhotoSample = AiStudioSampleBase & {
  output: 'image';
  prompt: string; // host words, no look suffix
  lookId: GenerationLookId | null;
  aspect: '1:1' | '4:5' | '9:16' | '16:9';
  tier: 'standard';
  imageSize: ImageSize;
  enhancePrompt: boolean;
  before: SampleMedia | null; // source photo (null = text-only sample)
  after: SampleMedia;
};

type ClipSample = AiStudioSampleBase & {
  output: 'video';
  prompt: string;
  cameraMove: VideoCameraMoveId;
  sound: VideoSoundMode;
  aspect: '9:16' | '16:9';
  tier: 'standard';
  resolution: VideoResolution;
  enhancePrompt: boolean;
  startFrame: SampleMedia;
  clip: { mp4: string; webm?: string; poster: SampleMedia; durationSeconds: number };
};

type SampleMedia = { src: string; srcSet?: string; width: number; height: number; alt: string };
```

Functions:

- `listSamples(output?)`, `findSample(id)`.
- `sampleToCreateState(sample, ctx)` → the exact `AiStudioCreate` state (goal, format, aspect, lookId, tier, imageSize, resolution, cameraMove, sound, enhance, text). `ctx` = `{ allowHighResolution, allowPremium }`; clamps resolution to 720p when 1080p is not allowed and never selects Premium.
- `sampleCredits(sample, ctx)` → uses `estimateGenerationCredits` (server parity already tested), so card cost always equals the Generate button.
- `sampleEtaLabel(sample)` → "A few seconds" / "About 15 seconds" / "About 3 minutes".

Unit tests (fail CI on drift):

- Every id unique, kebab-case, `order` unique per output.
- Every enum value valid: `POSTER_GOALS`, `POSTER_ARCHETYPE_IDS`, `GENERATION_LOOKS`, `VIDEO_CAMERA_MOVES`, `VIDEO_SOUND_MODES`, aspect lists, `POST_FORMATS`.
- Post archetype is one of `POSTER_GOAL_ARCHETYPES[goal]` (so the "pin first" logic can find it).
- Prompt length: post ≤ 500; photo ≤ `MAX_IMAGE_PROMPT_CHARS - MAX_LOOK_SUFFIX_CHARS`; clip ≤ `MAX_VIDEO_PROMPT_CHARS - MAX_LOOK_SUFFIX_CHARS`.
- `sampleToCreateState` round-trips into a payload the current `submit()` mapping accepts (extract the payload builder from `AiStudioCreate.submit` into `lib/aiStudioCreatePayload.ts` first, so the test covers the real mapping).
- Clamping: 1080p sample with `allowHighResolution=false` → 720p; credits change accordingly.
- Every media path exists under `ui/public` and is within its size budget (test reads the filesystem; Vitest runs in Node).
- Copy lint: no em dash in any `title` / `need` / `alt` / `prompt`.

### 4.2 Assets

Location: `ui/public/marketing/ai-studio/samples/{posts,photos,clips}/`. `marketing/**` is already in `globIgnores` of `scripts/pwa/precache-globs.json`, so nothing enters the PWA precache. Served by Vercel's CDN in every environment, no seeding.

| Kind                                 | Format                                                                                        | Budget each      |
| ------------------------------------ | --------------------------------------------------------------------------------------------- | ---------------- |
| Photo after/before, post placeholder | AVIF + WebP fallback, 2 widths (480, 960) via `<picture>` / `srcSet`                          | ≤ 120 KB at 960w |
| Clip                                 | H.264 MP4 720p, CRF ~26, `+faststart`, no audio track unless sound matters; optional WebM VP9 | ≤ 1.5 MB         |
| Clip poster                          | WebP 480w first frame                                                                         | ≤ 40 KB          |

Total budget ≤ 12 MB in git. Add a size check to the catalog test (above) and to `scripts/pwa/check-precache-budget.mjs` output as an informational line (not precached, but keeps the folder from growing silently).

### 4.3 Producing the photo and clip samples

The samples must come from the real pipeline, so the recipe genuinely reproduces them.

1. **Showcase property** on hosted mt-dev: an internal org (e.g. "Kame Showcase") with one property, Business plan, enough wallet credits, its own listing photos. No production data, no guests.
2. **Source photos.** Free stock photos of real units from Pexels or Unsplash (both licenses allow free commercial use with no attribution required; we still record photographer, page URL, license and download date in `samples/CREDITS.md`). Only photos of real interiors, never AI-made stock, so the "before" is honest. Download the original size and keep it out of git (only the optimised before/after ships). No people, no visible brand logos, no plates, no artwork that could be copyrighted. Philippines-relevant scenes: condo living room, balcony with skyline, pool deck, bedroom, kitchen, beach-side villa, rainy-season interior.
3. **Generate in the app** at Standard quality, the exact recipe settings, several attempts each. Keep the best; never edit pixels after generation.
4. **Review** each candidate with the `social-creative` "does not look AI-generated" checklist: straight verticals, no warped furniture, no gibberish text, no extra limbs / objects, correct light direction, clip has no morphing, flicker or cut. Two people sign off.
5. **Export** with a new script `scripts/marketing/export-ai-studio-samples.mjs <jobId...>` (run against hosted dev with a service key from env, never committed): downloads output + reference, reads `prompt`, `generation_options`, `aspect_ratio`, `quality_tier`, `image_size`, `resolution`, writes optimised files (sharp for images, ffmpeg for clips) and prints the catalog entry to paste. Script refuses a prod project ref.
6. **Post placeholders**: render each post recipe once with the showcase property through the same compiler (a tiny dev-only page or a Playwright script under `scripts/marketing/`), export WebP.

Credit estimate for production: ~6 photos × 3 attempts × ~120 = ~2k credits; 4 clips × 3 attempts × 800 = ~10k credits; on dev wallet. Google still bills failed clip renders, so cap attempts at 4 per clip.

### 4.4 Live post examples

New hook `hooks/useAiStudioPostSamples.ts`:

- Builds specs with `buildRuleBasedPosterSpecs(facts, goal)` and picks the spec whose archetype matches the sample; overrides `format` with the sample's.
- Renders with the existing `useAiPosterEngine().render` (already lazy-imports `posterRender`; must stay a dynamic import, never a static Konva / Polotno import, or the `config-*` chunk renames and the PWA budget fails, see memory note).
- Runs through `marketingThumbnailQueue` at idle priority, max 1 concurrent render, only for cards in view (`useVisibleThumbnailRequest`).
- Caches the data URL in `marketingPresetThumbnailStore` (IndexedDB) keyed by `ai-sample:{propertyId}:{sampleId}:{themeFingerprint}:{photosFingerprint}:{factsFingerprint}`; invalidates when theme, listing photos or facts change.
- Shows the static `placeholder` until the live render is ready, then crossfades (same reveal as AI Post tiles).
- Falls back to the placeholder (with a small "Example" badge) when: property has 0 listing photos, photos fail to load (CORS / 404), fonts fail, render throws, or IndexedDB is unavailable (render every time, no crash).
- Hide sample when its facts are missing and the layout would look broken: Stay info needs check-in or check-out time; Amenities / Feature need at least one amenity. Hidden samples do not leave a gap.

### 4.5 Pinning the picked layout (posts)

- Client: `generateBatch` gains optional `preferredArchetype`. After QA scoring, if a spec with that archetype has `issues === 0`, move it to index 0. No other change to ordering.
- Edge: `generate-marketing-template` poster director (`_shared/marketingPosterDirector.ts`) accepts optional `preferredArchetype` (validated against the mirrored enum, ignored if invalid) and the prompt asks for one variant in that archetype. Rule-based fallback already includes every archetype in `POSTER_GOAL_ARCHETYPES[goal]`, so it is always available.
- Deno test in `marketingPosterDirector_test.ts`: valid hint passes through; invalid is dropped; missing keeps today's behaviour.

### 4.6 Attribution

- Photo / clip: add optional `sampleId` to the `generate-marketing-media` payload. Server validates format (`^[a-z0-9-]{1,64}$`), stores it in the existing `generation_options` JSONB. No migration. Unknown ids are stored as-is (catalog lives in the client); invalid format is dropped, never a 400.
- Post: store `sampleId` in the session's post-version metadata through `marketing-ai-sessions` `post-versions` (same validation).
- PostHog (`captureAppEvent`): `ai_studio_sample_viewed` (detail open), `ai_studio_sample_applied`, `ai_studio_sample_cleared`, and add `sample_id` to the existing generate event if one exists (add `ai_studio_generate` if not). Properties: `output`, `sample_id`, `plan_allowed`. No PII.
- Success metric: share of first generations that start from an example, and first-generation refine rate (fewer immediate refines = closer to expectation).

### 4.7 UI components

All under `components/ai-studio/`, named exports, PascalCase:

| Component                   | Role                                                                                        |
| --------------------------- | ------------------------------------------------------------------------------------------- |
| `AiStudioSampleGallery.tsx` | Filter + grid / row; used on home and (strip mode) in step 2                                |
| `AiStudioSampleCard.tsx`    | Media, title, badges, cost; before/after; inline clip preview rules                         |
| `AiStudioSampleMedia.tsx`   | `<picture>` / `<video>` with lazy load, error fallback, reduced-motion and data-saver rules |
| `AiStudioSampleDetail.tsx`  | Dialog (desktop) / Sheet (phone), stepping, Use this example                                |
| `AiStudioSampleBanner.tsx`  | "Using X" / "Based on X" + Clear in step 2                                                  |

Wiring:

- `marketingStudioRoute.ts`: `SAMPLE_PARAM = 'sample'`, `readSampleId`, `applyStartAiSession(params, output, { sampleId })`, cleared by `clearItemParams` and on output switch. Unit tests in `marketingStudioRoute.test.ts`.
- `AiStudioConversation.tsx`: reads `sample`, resolves via `findSample`, passes `initialSample` to `AiStudioCreate`; drops it after the first save (`item=new` → id) so a refresh of the conversation does not re-apply.
- `AiStudioCreate.tsx`: accepts `initialSample`; applies `sampleToCreateState` on mount and when the id changes; keeps an undo snapshot; shows banner; passes `sampleId` through `onSubmit`. Remove the now-unused `ThemePostArt` placeholder path in `AiStudioCreatePreview`.
- `START_EXAMPLES` chips stay for hosts who prefer typing, but move below the gallery strip on phones.
- Every new string through `human-copy` (short, plain, no em dash).
- Accessibility: cards are buttons with an accessible name ("Golden hour balcony, photo example"); before/after toggle is a `aria-pressed` button; videos have `aria-label`, no autoplay with sound, controls in detail; focus returns to the card on close; detail stepping announces "Example 3 of 8".

### 4.8 Draft catalog (to validate during asset production)

Posts (live renders, each pins a layout):

| id                    | Title            | Angle     | Layout            | Size     | Words                                   |
| --------------------- | ---------------- | --------- | ----------------- | -------- | --------------------------------------- |
| `post-weekend-escape` | Weekend escape   | Vibe      | `magazine-cover`  | Portrait | ''                                      |
| `post-book-direct`    | Book direct deal | Promo     | `sky-headline`    | Portrait | 'Book direct and save on weekday stays' |
| `post-pool-day`       | Pool day         | Amenities | `feature-sticker` | Square   | ''                                      |
| `post-night-in`       | Night in         | Promo     | `night-glass`     | Story    | 'Late check-out this month'             |
| `post-standout`       | Standout feature | Feature   | `magazine-cover`  | Portrait | ''                                      |
| `post-check-in-guide` | Check-in guide   | Stay info | `minimal-title`   | Story    | ''                                      |

Photos (Standard, 1K, auto-improve on):

| id                     | Title               | Look            | Size | Need                         |
| ---------------------- | ------------------- | --------------- | ---- | ---------------------------- |
| `photo-golden-balcony` | Golden hour balcony | Golden hour     | 4:5  | Balcony or view photo        |
| `photo-bright-living`  | Bright living room  | Bright and airy | 4:5  | Living room photo            |
| `photo-ready-bedroom`  | Ready for guests    | Bright and airy | 1:1  | Bedroom photo                |
| `photo-city-lights`    | City lights         | Evening glow    | 9:16 | Window or balcony photo      |
| `photo-blue-hour-pool` | Pool at blue hour   | Blue hour       | 16:9 | Pool photo                   |
| `photo-rainy-cozy`     | Rainy day in        | Rainy and cozy  | 4:5  | Living room or bedroom photo |

Clips (Standard, 8s, start frame required):

| id                    | Title                   | Camera      | Sound   | Size | Need                                  |
| --------------------- | ----------------------- | ----------- | ------- | ---- | ------------------------------------- |
| `clip-living-push`    | Slow living room reveal | Push in     | Ambient | 9:16 | Living room photo                     |
| `clip-balcony-breeze` | Balcony breeze          | Still       | Ambient | 9:16 | Balcony photo with curtains or plants |
| `clip-pool-orbit`     | Pool sunset             | Orbit       | Music   | 9:16 | Pool photo                            |
| `clip-walkthrough`    | Walkthrough             | Walkthrough | Music   | 16:9 | Wide room photo                       |

Prompts are written during production (Phase 2) and copied verbatim from the winning job, since the catalog must match what produced the asset.

## 5. Edge cases and how each is handled

| Case                                                 | Handling                                                                                                  |
| ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Property has no listing photos                       | Post examples show static placeholders; photo picker shows Uploads tab first                              |
| Listing photo CORS / 404 during live render          | Placeholder, no error toast, logged once to Sentry breadcrumbs                                            |
| Missing facts (no amenities, no check-in time)       | Matching post samples hidden                                                                              |
| Very long property name / Filipino or accented text  | Covered by existing poster text fitting; add a test fixture with a 60-char name to the sample render test |
| Theme changes while gallery open                     | Cache key includes theme fingerprint; cards re-render through the queue                                   |
| Plan below Photo / Clip tier                         | Samples visible with tier badge; Use this example works; Generate opens upgrade modal (existing)          |
| No `marketing.generate.*:add` permission             | Gallery viewable; Use this example disabled with reason                                                   |
| `marketing.ai_studio` off (super-admin)              | Whole tab hidden (existing); gallery never renders                                                        |
| `marketing.ai_studio.generate` paused                | Gallery and apply work; Generate blocked by existing notice                                               |
| Premium not allowed / 1080p not allowed              | Recipes never use Premium; 1080p clamps to 720p, credits follow                                           |
| Host already typed text, then applies example        | Replace + **Undo** toast                                                                                  |
| Busy (a generation in flight)                        | Apply disabled like the rest of the form                                                                  |
| `?sample=` unknown, malformed, or for another output | Ignored, param removed with `replace`, no toast                                                           |
| Refresh after first save                             | `sample` dropped with `item=new`; conversation does not re-apply                                          |
| Back from step 2                                     | Returns to home, gallery filter and scroll restored (filter in `localStorage` per property, try/catch)    |
| Asset 404 (bad deploy)                               | Card hides itself on `onError`; catalog test should have caught it in CI                                  |
| Old Safari without AVIF                              | `<picture>` WebP fallback                                                                                 |
| Video codec unsupported / autoplay blocked           | Poster stays; play button in detail                                                                       |
| Reduced motion / Save-Data                           | No autoplay, no crossfade loop, static poster                                                             |
| Offline (PWA)                                        | Samples not precached; cards show neutral skeleton, no broken image icon                                  |
| Low-memory phone                                     | Live post renders: max 1 at a time, only in view, cancelled when scrolled out                             |
| Recently deleted / Recent publishes views            | Gallery hidden                                                                                            |
| Dark mode                                            | Media frames use tokens; check before/after chip contrast                                                 |
| Catalog prompt edited without regenerating the asset | Review rule in the catalog file header: prompt and asset change together                                  |

## 6. Phases and tasks

Each phase ends green on `bun run ci:quality`.

### Phase 0: Decisions and setup

- [x] Pick stock unit photos from Pexels (living room, bedroom, balcony with view, pool, rainy interior, city lights) and fill `samples/CREDITS.md`. _(Deviation: Unsplash dropped, Pexels only.)_
- [x] Showcase org + property — **local dev**, not hosted mt-dev (`SAMPLES_ORG_ID` / `SAMPLES_PROPERTY_ID` in `.cache/env.sh`). _(Deviation: a paid Gemini/Veo key is needed to actually generate against it — see Phase 2.)_

### Phase 1: Catalog and plumbing (no UI change visible)

- [x] Extract payload building from `AiStudioCreate.submit` into `lib/aiStudioCreatePayload.ts` (pure) + test; `AiStudioCreate` calls it. No behaviour change.
- [x] `lib/aiStudioSamples.ts` types, helpers, full catalog (6 posts, 6 photos, 4 clips) + test suite (4.1).
- [x] `SAMPLE_PARAM` and helpers in `marketingStudioRoute.ts` + tests.
- [x] `sampleId` accepted by `generate-marketing-media` (validate, store in `generation_options`); Deno tests for valid / invalid / missing. _(Deviation: not added to `marketing-ai-sessions` post-versions — post attribution is PostHog-only, see 4.6 below.)_
- [x] `preferredArchetype` in poster director + `generateBatch` reorder + tests (4.5).

### Phase 2: Asset production

- [x] Asset pipeline built as `scripts/marketing/ai-studio-samples/generate.ts` (Deno, real Gemini/Veo calls) + `export.ts` (Bun + sharp + ffmpeg, optimize + ship + rewrite `aiStudioSampleAssets.ts`), not the single `.mjs` script originally sketched; documented in `scripts/README.md`.
- [x] Post examples need no placeholder render step — they render live through the real compiler (4.4), so there is nothing to export for them.
- **Running the pipeline against real photo/clip samples split out to [`ai-studio-sample-assets.md`](../in-progress/ai-studio-sample-assets.md)** — blocked on a paid key, not an engineering task; tracked there instead of holding this plan open.
- [x] `samples/CREDITS.md` with every source photo's origin, photographer and license.
- [x] Catalog filled; catalog test passes (paths, sizes, enums, lengths, readiness).

### Phase 3: Gallery and detail

- [x] `AiStudioSampleMedia`, `AiStudioSampleCard`, `AiStudioSampleGallery`, `AiStudioSampleDetail`.
- [x] `useAiStudioPostSamples` live renders with cache (memory + IndexedDB), visibility-gated, showcase fallback on render failure (4.4).
- [x] Home: outcome lines on start cards; gallery on empty (grid) and returning (row, with **See all** / **Show less**); hidden in deleted / publishes views. Matches §7.3 as decided.
- [x] Mobile pass (375 / 768 / 1024): bottom sheet detail, 44px targets, verified via Playwright screenshots.

### Phase 4: Step 2 integration

- [x] `sample` prop in `AiStudioCreate`, apply / undo / clear, banner.
- [x] Photo picker `need` / `openRequest`; clip with no start frame opens photo sheet on Generate.
- [x] New preview pane states (3.3): example applied → `AiStudioCreateSamplePreview`; nothing applied (post, or no refs yet) → inline gallery pane with "Pick an example or describe your own".
- [x] Phone strip above the description when an example is applied.
- [x] `AiStudioConversation` passes / drops `sample` around the first save; `sampleId` sent on create.

### Phase 5: Analytics and copy

- [x] PostHog events: `ai_studio_sample_viewed`, `ai_studio_sample_applied`, `ai_studio_sample_cleared`, `ai_studio_generate_started` (carries `sample_id`).
- [x] `human-copy` pass on new strings (gallery, detail, banner, FAQ).

### Phase 6: Tests

- [x] Vitest: catalog, payload mapping, readiness gating, route param (`aiStudioSamples.test.ts`, `marketingStudioRoute.test.ts`).
- [x] Deno: `readPreferredArchetype` / `preferredArchetypeLine` / `preferArchetypeFirst` (`marketingPosterDirector_test.ts`), `readSampleId` (`marketingGenerationJobs_test.ts`).
- [x] Playwright mocked E2E `ui/e2e/features/marketing/marketingAiExamples.spec.ts` (`@ci`, 5 tests) + a screenshot-capture spec gated behind `PLAYWRIGHT_CAPTURE_SCREENS`: home shows examples and opening/stepping/closing generates nothing; Use this example fills form + URL, Clear resets both; picking an example over typed text can be undone; a post example sends `preferredArchetype` and stays a normal Generate; an unknown `sample` id is dropped quietly.
- [x] `bun run test` (marketing suite) and targeted Deno tests green; PWA precache budget unaffected (`ui/public/marketing/**` already ignored).

### Phase 7: Docs (same change)

- [x] `docs/guides/routes/org/property/marketing.md`: AI Studio home + step 2 sections, `sample` URL param, FAQ, implementation map rows, Progress overview row, Testing row.
- [x] `docs/architecture/marketing-poster-studio.md`: `preferredArchetype` flow and the live sample-render architecture.
- [x] `docs/PROJECT.md`: examples gallery + `sampleId` / `preferredArchetype` summary.
- [x] Plans and permissions: N/A — examples reuse existing entitlements and permissions, no new gate added.
- [x] Audit log: `activity-log: N/A — examples are read-only static/live-rendered content; generations already log marketing.image_generated / video_generated`.
- [x] Unsaved changes guard: N/A — step 2 is a generate form with no manual Save.
- [x] Workflow: moved to in-progress on start; intake line marked 🚧.

### Phase 8: Verification

- [x] `bun run lint` / targeted type-check on changed files clean (repo-wide `type-check`, `test:edge` and `build`'s `tsc` step have **pre-existing** unrelated failures in files this change never touched — `VideoEditorV2.tsx`, `MarketingMediaLibrary.tsx`, `planFeatures.ts`/`PlanMarketingMediaLibrary` drift, Sentry/PostHog client typings, `pwa/swErrorRelay.ts`, `publicAppOrigin_test.ts`; confirmed pre-existing by grepping the failure list against every file this change edited — none appear). `vite build` run directly (bypassing the broken `tsc` gate) succeeds; initial bundle budget and PWA precache budget both pass (`check-initial-bundle-budget.mjs`, `check-precache-budget.mjs`); `config-*` (Konva/Polotno) chunk correctly stays in the never-precached on-demand tier.
- [x] `property-dashboard-qa` scoped pass on the examples gallery (RBAC + plan gating, dark mode, reduced motion, no-eager-video network check) — see `docs/workflow/qa/property-dashboard/08-marketing.md` ("AI Studio examples gallery" section). No bugs found; one apparent gating gap (Operations template can use a post example) turned out to be correct behavior — posts are gated on the text leaf `marketing.generate:add`, which Operations has, not the image/video leaves.
- [x] Dark mode + reduced-motion pass (Playwright, `prefers-reduced-motion` + dark color-scheme emulation): gallery renders cleanly, no autoplay, 0 eager video byte requests on load.
- [x] **Lighthouse run for real, authenticated, against a production-style local build.** `lighthouse-routes.mjs` can't reach an authenticated host route (no session), so a one-off script was written: magic-link-authenticates as the local seed owner against local Supabase, injects the session into `localStorage` via `chromium.connectOverCDP`, then hands the same Chrome instance to `lighthouse()` pointed at `/org/kame-homes/property/kame-home/marketing` on a `vite build --mode development` + `vite preview` server (a real minified/chunked build, pointed at local Supabase — not the unbundled dev server, which gives meaningless multi-minute numbers under Lighthouse's network throttling). Mobile, throttled, 1 run each:

  | Variant                                            | Perf score | LCP     | TBT        | FCP    | Total bytes |
  | -------------------------------------------------- | ---------- | ------- | ---------- | ------ | ----------- |
  | Gallery removed (temporary local toggle, reverted) | 60         | 10616ms | 61.5ms     | 6190ms | 1,061,915   |
  | Gallery as shipped, **before** the fix below       | 34         | 10355ms | **1431ms** | 6059ms | 1,212,657   |
  | Gallery as shipped, **after** the fix below        | 60         | 10895ms | 68.5ms     | 5817ms | 1,061,913   |

  **Found a real regression and fixed it in this session:** a card entering the viewport on first paint (the `rootMargin: 240px` visibility gate means most/all of 4-6 cards count as visible immediately on a fresh, short home page) kicked off its live poster render — including the one-time dynamic `import()` of the Konva/Polotno chunk — synchronously on mount, with no yield to the browser. That added **~1.4s of Total Blocking Time** (23x) and dropped the Lighthouse performance score from 60 to 34, even though LCP itself barely moved (the TBT hit lands after LCP, during the interactivity window). Fixed in `hooks/useAiStudioPostSamples.ts`: `usePostSampleImage` now awaits the existing `waitForMarketingIdle()` helper (`lib/marketingIdle.ts`, already used elsewhere in Marketing for the same purpose) before calling `renderer.render()`, so the heavy work starts after first paint and a short idle window instead of racing it. Re-measured after the fix: TBT and performance score are statistically identical to the gallery being removed entirely — the gallery has no measurable cost to the route's Lighthouse score once render kick-off is deferred. Baseline (LCP ~10.3-10.9s even with the gallery off) reflects this admin SPA's pre-existing cold-start cost under heavy mobile throttling, not something this feature changed.

- **Local stack photo/clip compare-to-sample split out to [`ai-studio-sample-assets.md`](../in-progress/ai-studio-sample-assets.md)** along with the rest of Phase 2 — same billing blocker, tracked there.

## 7. Decisions (resolved 2026-11-02)

1. **Source photos:** free-to-use stock photos of real units (Pexels / Unsplash), licenses recorded in `samples/CREDITS.md`. No owner consent step needed.
2. **Sample count:** 6 posts, 6 photos, 4 clips. Posts cost nothing to show (live renders), so they keep the full set. Photos keep one per look that suits a rental (Golden hour, Bright and airy x2, Evening glow, Blue hour, Rainy and cozy); Magazine and Close-up are dropped because they depend most on the source photo and are the easiest to get wrong. Clips keep the four most reliable moves across both sizes (Push in, Still, Orbit, Walkthrough), which cuts Veo production cost by about a third. More can be added later without code changes beyond the catalog.
3. **Returning home:** the examples stay as one horizontal row above **Your creations**, always shown, with **See all**. No collapse toggle: a single row costs little space, keeps one predictable place to find ideas, and avoids a hidden state hosts forget they turned off. The full grid appears only on the empty home and behind **See all**.

## 8. Follow-ups (not in this plan)

- Super-admin catalog editor backed by a table + public bucket, so examples can change without a deploy.
- "Try with my photo": opt-in Draft generation of an example on the host's own photo.
- Seasonal / campaign examples (holidays, rainy season, long weekends) rotated by date.
- "Save as my recipe" from any of the host's own versions, alongside the global examples.
