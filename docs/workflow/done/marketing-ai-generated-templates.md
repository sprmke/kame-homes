---
stage: done
title: 'Marketing 4: AI-Generated Marketing Calendar, Design & Video Templates — Implementation Plan'
status: done
tags: [planning, planned-modules, marketing, templates]
updated: 2026-08-27
---

# Marketing 4: AI-Generated Marketing Calendar, Design & Video Templates — Implementation Plan

**Status:** Done — calendar, design, and video AI generate shipped; generate modal UX polished (2026-08-27 stepper + validation).

### Video AI generate (2026-08-13)

- Modal reuses the Design-style **Content** then **Look** grouping: category chips (6 `VideoCategory` ids), **Content** textarea (category default), **Include** toggles (property photo, org logo, property name, CTA). Look: Suggestions, Look prompt, and video-specific pickers — **Duration**, **Type** (4 allow-listed font pairings), **Motion** (Auto/Calm/Energetic/Cinematic, overrides every scene's motion from a mood pool)
- Token schema (`VideoTemplateTokens`, mirrored client/edge): `category`, `scenes: Array<{kind, durationSec, transition, motion}>` (3-5 scenes), `fontPairing`, one flat `copy` bundle (`headline`/`subheadline`/`promoLine`/`slotLabels`/`ctaLine`/`rulesLine`), `label`. The AI is not asked for per-scene copy or narrative role — `videoAiProjectBuilder.ts` deterministically assigns each scene a role by position (first = hook, last = cta, middle = broll/offer by kind), derives `textBeats`/overlay from that role, and distributes the flat copy bundle onto scenes exactly like the hand-authored storyboard recipes do. This keeps the LLM schema small while guaranteeing a valid hook → body → CTA arc every time.
- Reuses the existing per-scene `VideoScene.motion` override and `VideoTransition`/`VideoSceneKind` enums directly — no new rendering path. AI-generated projects render through the exact same `VideoCompositions.tsx` path as hand-authored templates.
- `VideoProject.templateId` is one of 4 synthetic ids (`ai-editorial-serif` / `ai-cinematic-serif` / `ai-modern-sans` / `ai-warm-serif`) registered in `videoTemplateTypography.ts`'s font-pairing map, so the existing typography/thumbnail/export pipeline resolves the AI-picked font pairing with zero special-casing — each id also carries its own scrim/pill/CTA-chrome look (not just a different font) so the 4 choices read as genuinely different templates. When a Look suggestion is picked, its mood gradient is stamped onto `VideoProject.palette` (accent + cream) so scrims/CTA chrome follow that vibe instead of always falling back to org brand teal; hand-authored templates stay brand-driven.
- Property photo/video randomization matches Design/Calendar: each of the 3 saved formats (Story/Post/Landscape) gets a different rotation offset into the property media list.
- Saves fan out to 3 `marketing_templates` rows (Story/Post/Landscape) sharing an `aiGenerationId`, each with a headlessly-rendered thumbnail (`renderVideoProjectThumbnail`) captured eagerly at save time — no live-store gymnastics needed (unlike Design's Polotno thumbnail capture), since Remotion stills render directly from an arbitrary `VideoProject`.

### Video AI generate hardening (2026-08-14)

- Root cause of cutoff/overflowing on-screen text: `VideoLayerBody` hard-coded `whiteSpace: 'nowrap'` for any text without a literal `\n` — hand-authored captions are always short enough to never hit it, but AI copy routinely was. Now always wraps (`pre-wrap` + `break-word`); no visual change for existing short captions. AI copy limits also tightened (headline 40 / subheadline & promo 46 / CTA 24 / footer 32 chars) so lines read as punchy single lines.
- Replaced the scene-count **Length** picker (Quick/Standard/Extended) with a **Duration** picker (Auto/8/10/12/15/20/25s) backed by `fitVideoAiSceneDurations()`, which rescales every AI-picked scene proportionally to hit the target total exactly. Auto only ever stretches up to a 12s floor (never shrinks an already-generous result) — fixes generated clips that were previously well under 10s. Edge system prompt also corrected: it previously told the model to keep scenes to 1-6s / prefer 3-4 scenes, biasing toward too-short totals.
- **Suggestions were conflating Look with Category** — clicking a Look suggestion silently overwrote the host's Category selection (e.g. picking "Flash Deal Punch" while on "Fully booked" would flip Category to `flash-deal`), and the suggestion set itself was just the 6 categories renamed. Fixed to match Calendar/Design: suggestions never touch Category/Content. Rewrote all 8 suggestions to be pure look/motion vibes with a mood-gradient preview. **Follow-up (2026-08-14):** suggestion mood colors were preview-only and the live video still used brand teal — now each suggestion stamps `lookMood` → `VideoProject.palette`, soft-locks Motion/Type when picked, and Duration/Type/Motion Auto no longer send `"auto"` into the edge prompt.

### Calendar polish (2026-08-06)

- Empty prompt blocked client + edge (`400`)
- Modal: outcome line for three formats, Look label, Check on include chips, reset on close, dismiss locked while generating, `Generating…` busy state
- Saves use `Promise.allSettled` with partial-success toast; undo snapshots pre-AI styles
- Impeccable audit/critique: detector clean; remaining Marketing 4 work is Design/Video

### Calendar readability (2026-08-09)

- Root cause of washed-out AI calendars: pastel recolor remapped day-number ink onto light fills with no contrast check
- Client compiler (`calendarAiTokens.ts`) now sanitizes primary/secondary/accent roles and runs `ensureReadableCalendarContrast` (≥4.5:1 date numbers, ≥3:1 meta) after recolor
- Edge prompt updated: mid-depth primary, near-white secondary, punchy accent; readability called out as non-negotiable

### Generate modal UX (2026-08-09)

- 12 pastel Instagrammable suggestions (`calendarAiGenerateOptions.ts`); modal shows 4 by default with **View more** / **Show less**; each card has a mini calendar-card preview (two-week bubble grid tinted by the theme palette)
- **Suggestion preview redesign (2026-08-27):** Calendar/Design/Video Look cards no longer use abstract palette swatches — each renders a realistic mini mock of the output (calendar bubble grid; Quiet Coast editorial promo with scrim/eyebrow/headline/CTA; video frame with bottom scrim + scene filmstrip). Components: `CalendarAiGenerateVisuals.tsx`, `DesignAiGenerateVisuals.tsx`, `VideoAiGenerateVisuals.tsx`.
- **Three-step wizard (2026-08-27):** Calendar, Design, and Video share `MarketingAiGeneratePanel` with **Content → Look → Settings** steps. Header uses Import-style segmented progress + `1/3` counter (`SegmentedStepProgress`); scroll body shows step title + description (`WizardStepHeading` / `marketingAiGenerateStepCopy`). Look step labels cards **Templates**; footer: Cancel | Back + Next (Settings: Generate). **Next** gated per step (Content message for design/video; Look template or prompt). Include toggles use bordered card list + visible switch tracks.
- Layout / Type / Background use visual choice buttons (layout/background thumbnails, type sample glyph) with Auto default; prefs sent to edge + applied as token locks client-side
- Include chips always visible; unavailable photo/amenities disabled with title hint
- Header: “Creates beautiful AI generated calendars you can edit.” (Design: “…designs you can edit.”)
- Advanced settings (collapsed): show/hide calendar chrome + optional context (photo/amenities/availability); element toggles apply via `applyCalendarAiElementsToStyles`
- AI saves share `aiGenerationId`; removing one Custom card deletes Square/Portrait/Landscape siblings

### Design AI generate (2026-08-13)

- Org logos render as a **1×1 circle** (center cover-crop + full corner radius) on AI designs, Elements drops, and video logo layers
- Modal grouped **Content** then **Look**. Content first: category chips (`promo`, `slots`, `giveaway`, `fully-booked`, `custom` last / blank copy), **Content** textarea (category default), **Include** toggles (property photo, org logo, property name, CTA — disabled with a hint). Look: Suggestions, Look prompt, Layout / Type / Background
- Backend token schema and prompt updated to use `category`, `content`, and `includeContext` (`propertyPhoto`, `orgLogo`, `propertyName`, `cta`)
- New design layout archetypes (`gradient-frame`, `photo-bottom`, `left-stack`) in a shared compiler (`polotnoAiCampaignDocuments.ts`) that renders from the same primitives as hand-authored templates
- Readability hardening: high-contrast text panels, bottom gradient overlays for text-over-image layouts, clamped WCAG-safe panel colors, and forced light-on-dark primary text
- Property photo randomization: for both calendar and design, when the property photo include is enabled, each of the three generated formats (Square/Portrait/Landscape or Instagram Post/Story/Facebook Post) gets a randomly selected property image instead of always using the cover photo
- Design compiler always applies the included property photo (full-bleed image + page background, or a photo-bottom image node) even when the model returns a non-photo `backgroundMood`
- Design sidebar thumbs are captured from the mounted Polotno Workspace at generate/select time (`designJson.thumbnailDataUrl`) — headless `toBlob` was snapshotting the live canvas for every custom card because compiled docs shared `page-1`
- Generated design campaigns save under **Custom** as Square/Portrait/Landscape like other campaigns

## Calendar MVP decisions (session 2026-08-04)

- **UX:** Modal from **Generate with AI** in Custom (`ResponsiveModal` — centered dialog on desktop, bottom sheet below `lg`) — prompt + vibe chips + removable context → Generate → custom templates (not a 3-variation picker).
- **Orientations without 3× AI cost:** one Gemini/Groq call returns design tokens; client compiles once and saves **three** `marketing_templates` rows (square / portrait / landscape) with format-specific `canvasFrame` defaults.
- **Persistence:** `sourcePresetId: custom` + `aiGenerated` / `aiTokens` in `designJson`; loads into store and autosaves like other custom calendars.

## Context

`docs/planning/CLAUDE_TO_PLAN.md` (lines 97-105) asks for an AI feature that generates calendar, design, and video marketing templates "from scratch" — beautiful, elegant, Instagrammable, with wow factor — configurable via prompts/suggestions, informed by research into how popular AI media editors do this, and mindful of free/low-cost APIs. It explicitly leaves open whether the AI should generate fully from scratch/its own way, or read and build on our existing templates/tech/settings.

Marketing 1/2/3 just finished hand-redesigning each tab's preset library — 14 calendar presets (pastel style-tree system), 12 design campaigns (the "Quiet Coast" editorial system: serif/tracked-caps type, gradient scrims, no shapes/stars/rotation), 12 video templates (per-baseId motion profiles + font pairings + transitions). Any AI output must stay visually consistent with this recently-established language, not regress to generic AI-slop.

Marketing 2 explicitly evaluated and **rejected Polotno's paid AI-image/icon-search addon ($199-399/mo)** purely on cost — the direct precedent for how this plan treats paid generative-media APIs.

**Competitive research (Canva Magic Design, 2026):** users start from an objective/prompt rather than picking a template first; AI assembles from templates/brand kit automatically; output stays fully editable; guided quick-fill chips accompany the free-text prompt. This shaped Decision 5 below — a prompt + chips + a small set of picks, not a chat-style iterative flow.

**Cost research:** full AI image synthesis (Imagen 4, Flux 1.1 Pro, Recraft v3, Ideogram v3) runs **$0.02-0.09/image**; full AI video synthesis (Veo 3.1, Kling 3.0, Runway Gen-4.5, Sora 2) runs **$0.045-2+ per few-second clip**, meaning a single generated marketing video (multiple scenes, likely regenerated a few times) could cost several dollars per attempt. Against that, **Gemini 2.5 Flash Image has a free tier (~500 requests/day)**, and this repo already calls Gemini (2.0/2.5 Flash) with Groq fallback for captions (`_shared/marketingCaptionAi.ts`), receipt/ID validation (`_shared/receiptValidationService.ts`), and inbox AI replies — no new provider, no new billing relationship needed.

## Decisions made (do not re-litigate)

1. **Structured generation, not raw media synthesis.** Gemini generates a small, schema-constrained JSON payload of design _tokens_ (palette, typography, layout choice, motion, copy). A deterministic client-side compiler expands those tokens into the same typed structures the existing editors already render (`CalendarStyles`, `PolotnoDesignDocument`, `VideoScene[]`/`VideoProject`). This guarantees output is always valid, on-brand, and fully editable, and costs effectively nothing beyond the Gemini/Groq spend already budgeted — directly consistent with Marketing 2's rejection of the paid Polotno addon.
2. **Hybrid stretch for Design only:** optionally call Gemini 2.5 Flash Image (free tier) to generate a stylized background photo when no suitable property photo exists and the prompt asks for an illustrated/stylized look. Everything else (layout, type, copy, motion) stays structured/token-driven. Additive, not required for MVP — build after the structured path works.
3. **One plan, all three tabs** — a shared AI edge function/service and a shared prompt UI component, with tab-specific token schemas and compilers (Decisions 2-4 below).
4. **Novel generation within schema, not preset remix.** The AI is not limited to picking one of the existing 12-14 hand-authored presets per tab; it fills in the same design tokens the presets are built from, validated/clamped the same way the hand-authored presets already are, so results are always renderable and on-brand but genuinely new combinations, not "preset #7 with different copy."
5. **Property/booking context auto-included, removable.** Property name, cover photo, amenity highlights, and (for calendar) current availability window are pulled in automatically — matching the existing property-photo-aware pattern from Marketing 1 (`calendarPropertyPhoto.ts`) — and shown as removable chips in the prompt UI so the host can exclude any of them per generation.
6. **No new persistence model.** Generated output loads into the existing per-tab store (Calendar/Polotno/Video) exactly like selecting an existing preset does today. Saving continues through the existing `marketing-templates` edge function / `marketing_templates` table (`content_type`: calendar|design|video). No new DB table, no new columns.

## Decision 1 — Shared AI generation edge function + service

New `supabase/functions/generate-marketing-template/index.ts` (uses `serveAdmin` + `resolveAdminPropertyId`, mirrors `supabase/functions/generate-marketing-caption/index.ts`'s shape exactly), backed by a new `supabase/functions/_shared/marketingTemplateGenerationAi.ts` mirroring `_shared/marketingCaptionAi.ts`'s Gemini-primary/Groq-fallback fetch pattern (`GEMINI_API_KEYS`/`GEMINI_API_KEY`/`GROQ_API_KEY` env vars — already configured, no new secrets).

- Request body: `{ contentType: 'calendar'|'design'|'video', prompt: string, includeContext: { propertyPhoto?: boolean, amenities?: boolean, availability?: boolean }, format/aspectPreset, variationCount? }` (default `variationCount = 3` — cost/complexity tradeoff vs. Canva's 50; MVP scope, easy to raise later).
- `resolveAdminPropertyId` + a `properties`/booking lookup (same shape as `generate-marketing-caption/index.ts:26-34`) resolves the auto-included context fields server-side before prompting, so the client never has to assemble raw property data itself.
- The service builds a contentType-specific system prompt describing the exact JSON token schema to emit — same structured-output approach `_shared/receiptValidationService.ts` already uses for Gemini (`responseMimeType: 'application/json'`); Groq fallback uses its OpenAI-compatible `response_format: json_object`.
- Response: an array of `variationCount` token payloads, typed per tab (Decisions 2-4) — small payloads (a few hundred bytes each), not full scene graphs, keeping generation cheap and fast.
- Errors follow the existing `jsonError` 503 pattern: `"AI generation unavailable — configure GEMINI_API_KEYS or GROQ_API_KEY"`.

## Decision 2 — Calendar tab: token schema + compiler

Token schema is a constrained subset of the `CalendarStyles` primitives (`components/calendar-builder/types/index.ts`): a `layoutArchetype` enum matching the six families the 14 hand presets already fall into per `CALENDAR_PRESET_CATEGORIES` (`lib/calendarPresets.ts:18`) — bubble/widget, type-forward, geo-pattern, botanical, photo-wash, dusk-gradient — plus a 2-3 hex palette (contrast-validated the way `designBrandColors.ts#foregroundFor` validates), a background/pattern choice, and a font pick from an allow-listed set.

New `resolveAiGeneratedCalendarStyles(tokens): CalendarStyles` added to `lib/calendarPresets.ts`, sibling to the existing `resolveCalendarPresetStyles` (`calendar-builder-store.ts:100-128`) — reuses the identical per-section deep-merge onto `createDefaultStyles()`, plus the existing `applyBrandAccentToCalendarStyles` and `applyPropertyPhotoToCalendarStyles` (`calendarPropertyPhoto.ts`) helpers. The picked variation is applied via `useCalendarBuilderStore.setStyles()` (`stores/calendar-builder-store.ts:27`) directly, bypassing `applyPreset`'s presetId lookup.

Entry point: a "Generate with AI" affordance added to `CalendarTemplateSidebar.tsx`, opening the shared prompt panel (Decision 5).

## Decision 3 — Design tab: token schema + new layout compiler (largest net-new piece)

Today's Polotno documents come from **hand-authored per-`baseId` builder functions** (`BUILDERS[baseId]` inside `lib/polotno/polotnoCampaignDocuments.ts`, driven by `buildPolotnoCampaignDocument(templateId, binding, options)` at line 1083) — there is no generic "fill in these tokens" path yet, unlike Calendar. Genuinely novel (not baseId-selection) AI output therefore requires a **new generic layout compiler**: a small library (3-4 to start) of parameterized layout archetypes — hero-photo-with-caption-band, split-panel-promo, centered-badge-announcement — built from the same primitives already exposed in that file (`createCampaignLayout`, `photoScrim`, `campaignPageBackground`, and the existing text/badge node helpers), each accepting tokens instead of being bespoke per template. This is the single largest engineering item in the plan — flag it as such when scoping implementation effort.

Token schema: `layoutArchetype` (new enum above), palette fed through the existing `resolveCampaignPalette()` (`designBrandColors.ts:80`, unchanged — keeps contrast/brand-accent rules identical to hand-authored templates), a typography pairing from an allow-listed Quiet-Coast-compatible font list (serif/tracked-caps; explicitly excludes shapes/stars/rotation per the Marketing 2 redesign rules), copy fields, and the existing `CampaignCategory` type. New `buildAiGeneratedCampaignDocument(tokens, binding): PolotnoDesignDocument` in a new `lib/polotno/polotnoAiCampaignDocuments.ts`, returning the same `PolotnoDesignDocument` shape (`polotnoCampaignDocuments.ts:1070`) the existing builder returns, so the rest of the Polotno pipeline (store loading, thumbnailing, autosave) needs zero changes.

Optional hybrid: when `includeContext.propertyPhoto` is off or no property photo exists and the prompt implies an illustrated background, call Gemini 2.5 Flash Image (free-tier) for a background image URL to feed into `campaignPageBackground()` in place of a property photo. Ship after the structured path is verified — do not block MVP on this.

Entry point: "Generate with AI" affordance in the design template picker (`MarketingTemplatesPage.tsx` / campaign picker), alongside the 12 existing campaign presets.

## Decision 4 — Video tab: token schema + compiler

`VideoProject`/`VideoScene[]` (`lib/video/videoProjectTypes.ts:74-123`) is already close to data-driven per scene, so this is lighter than Design. Token schema: scene count + `kind` sequence (existing `VideoSceneKind`), per-scene `durationSec` (clamped to `VIDEO_SCENE_DURATION.min/max`, `videoProjectTypes.ts:129`), `transition` (existing `VideoTransition` enum), a motion selection from the existing `VIDEO_MOTION_OVERRIDES` enum (`videoMotionProfiles.ts:283`) rather than inventing new motion math, a font pairing built from an allow-listed font list per `VideoFontRole` (mirroring the `DEFAULT_VIDEO_FONT_PAIRING` shape in `videoTemplateTypography.ts:19`), and per-scene copy (`VideoSceneTextFields`).

New `resolveAiGeneratedVideoProject(tokens, binding): VideoProject` in a new `lib/video/videoAiProjectBuilder.ts`, reusing `resolveSceneMotionProfile` (`videoMotionProfiles.ts:300`) and `resolveVideoFontPairing`-equivalent helpers so AI-selected scenes render through the exact same Remotion composition path (`VideoCompositions.tsx`) as hand-authored templates.

Entry point: "Generate with AI" affordance in the video template picker.

## Decision 5 — Shared prompt UI

One new component, `MarketingAiGeneratePanel.tsx` under `components/shared/`, parameterized by `contentType` and reused across all three tabs: free-text prompt input, a handful of vibe/occasion quick-fill chips (per the Canva Magic Design pattern of pairing free text with guided shortcuts), removable chips for each auto-included context field (property photo / amenities / availability — Decision 5 above), a "Generate" button with loading state, and a 3-card variation picker (MVP `variationCount = 3`, not Canva's 50-variation batch — cost and review-effort tradeoff). Picking a variation runs the relevant compiler (Decision 2/3/4) and loads the result into the current editor's store exactly like selecting an existing preset — no new save path, autosave (`useMarketingAutoSave.ts`) picks it up unchanged.

## Docs to update

- `docs/guides/routes/org/property/marketing.md` — document the "Generate with AI" entry point per tab, the prompt/context-chip UI, and that generated results land as fully editable, un-saved drafts (not auto-committed).
- `docs/PROJECT.md` — add `generate-marketing-template` to the edge functions table, near the existing `generate-marketing-caption` row.

## Verification

- `bun run type-check`, `bun run lint`, `bun run build`.
- `bun run dev:api` — curl `generate-marketing-template` locally for all three `contentType`s with `GEMINI_API_KEYS`/`GROQ_API_KEY` set in `supabase/.env.local`; confirm the Groq fallback path explicitly by temporarily blanking the Gemini keys.
- Manual QA in the running UI (`./dev.sh`) per tab: enter a prompt, generate 3 variations, confirm each renders without validation/layout errors, pick one, confirm it loads as a fully editable draft, confirm manual edits + autosave still work afterward, confirm removing a context chip changes what's generated.
- Spot-check AI-picked palettes stay contrast-safe (reuse `designBrandColors.ts#foregroundFor` / the calendar equivalent) and that Design output obeys the Quiet Coast rules (no shapes/stars/rotation) by generating ~10 variations and eyeballing them against `marketing-design-templates.md`'s design rules.

## Critical files

- `supabase/functions/generate-marketing-template/index.ts` (new) — modeled on `supabase/functions/generate-marketing-caption/index.ts`
- `supabase/functions/_shared/marketingTemplateGenerationAi.ts` (new) — modeled on `supabase/functions/_shared/marketingCaptionAi.ts`
- `ui/src/features/dashboard/marketing/lib/calendarPresets.ts` — add `resolveAiGeneratedCalendarStyles`
- `ui/src/features/dashboard/marketing/lib/polotno/polotnoAiCampaignDocuments.ts` (new) — the layout compiler from Decision 3
- `ui/src/features/dashboard/marketing/lib/video/videoAiProjectBuilder.ts` (new)
- `ui/src/features/dashboard/marketing/components/shared/MarketingAiGeneratePanel.tsx` (new)
- `ui/src/features/dashboard/marketing/components/calendar-builder/components/CalendarTemplateSidebar.tsx` — new entry point
- `ui/src/features/dashboard/marketing/components/design-editor/` template picker — new entry point
- Video template picker (video-editor components) — new entry point
- `docs/guides/routes/org/property/marketing.md`, `docs/PROJECT.md` — doc updates
