---
stage: in-progress
title: 'Marketing AI Poster Studio: from AI photo to postable designed posts'
status: in-progress
tags: [workflow, planned, marketing, ai, image-generation, polotno, design]
updated: 2026-09-29
kind: plan
---

## Implementation status (2026-09-28, pass 2: hardening)

- **4:5 Portrait** (`instagram-portrait`, 1080×1350) added; it's the AI Post default. Opens in Design; the preset picker shows it only while a 4:5 design is open.
- **Plan default:** AI Post only when `aiMarketingGeneration` is on; otherwise Photo & video.
- **Panel robustness:** stale-run guards (generate / format / shuffle), compile-time format, per-property remount, all-renders-failed message, delayed object-URL revoke.
- **Server:** 12 MB combined photo budget (Gemini inline limit), exported and tested `sanitizeVariant`.
- **Client:** director response shape validation before use.
- **Dead code removed:** the unused `handle` fact and include flag.
- **Tests added:** enum parity (UI↔edge), `generatePosters` fallback matrix, audit and edge-case suite, 3 more Deno tests, a Playwright AI Post spec (5 tests). The 8 existing Generate specs were updated for the new default mode.
- **Results:**
  - 3,996 UI unit tests, 558 edge tests and 135 marketing/plans/team E2E tests pass
  - type-check, lint (changed files) and production build pass; the Generate chunk is 108 KB, lazy
- **Visual QA:** all 6 archetypes re-rendered at 4:5 with the production renderer.

**Shipped in this slice (local, uncommitted):**

- **Phase 2 (design system), complete for the six reference archetypes:**
  - `ui/src/features/dashboard/marketing/lib/poster/`: 8 type systems incl. script faces; one Lucide line-icon family with amenity keyword mapping and curated short labels; modules (pills, icon rows, info bar, glass panels, sticker, organic wave masks, ornaments, logo); WCAG-guarded palettes.
  - Archetypes: `wave-duo`, `sky-headline`, `night-glass`, `minimal-title`, `magazine-cover`, `feature-sticker`, each working in Post, Story (reply-bar safe zone) and Facebook.
- **Phase 4 (director):** `generate-marketing-template` `contentType: 'poster'` → `_shared/marketingPosterDirector.ts`.
  - The model sees up to 6 allow-listed property photos.
  - Amenities are grounded against facts and the host prompt; stock phrases are stripped server-side.
  - Reuses feature `marketing_template` (quota, kill switch, credits, `aiMarketingGeneration`, `marketing.generate:add`).
- **Phase 5 (compiler):**
  - `posterCompiler.ts`, with real-font canvas measurement (`posterFontLoader.ts`), balanced fitting and a legibility floor.
  - Optional slots drop instead of overflowing; stack-sized scrims; `fitPosterTextSlots` post-render pass.
- **Phase 7.1 (deterministic QA):** `posterAudit.ts` (bounds, overlap, small text, overflow), used in tests and to rank variants.
- **Phase 8 (UX), core:**
  - The Generate tab opens on **AI Post** when entitled: goal, format, message → 4 variants.
  - Actions: Edit (saves under "AI posts" and opens the Design tab), Shuffle (no AI call), Download, Post. A format switch re-lays out the variants without an AI call.
  - Rule-based fallback on non-quota errors.
- **Tests:** 49 Vitest tests (all archetypes × formats × rich/sparse facts pass the audit), 6 Deno director tests; full suites green (3952 UI, 555 edge).

**Verified by eye:** real renders of every archetype and format, plus one live Gemini run (4 specs, photo-aware choices) compiled and reviewed. Defects found that way (clipped pills, mid-phrase truncation, unprotected text on busy photos, label chopping, story crowding) were fixed at the root.

**Local note:** the `marketing_template` AI feature is disabled in the local DB (kill switch). The app correctly fell back to rule-based posters; the live director check ran through `directPosterSpecs` with no billing.

**Still open:**

- 0.x: the blind eval against the benchmark posts (the ship gate, judged by the product owner).
- 1.x: brand kit fields (mascot, handles, tone).
- 3.2: cached photo analysis.
- 6: structure-locked photo enhancement.
- 7.2: vision critic.
- 8.3: carousel sets; 8.5: "Save as my style".
- 9.5: server-side render.
- A 4:5 format (the best-performing IG feed shape) needs a new `DesignTemplateFormat`.

# Marketing AI Poster Studio: from "AI photo" to postable designed posts

## Context

The user wants Marketing Studio to produce finished social posts on par with 7 reference posts from a PH staycation Facebook page (Kame Home "Coffee • View • You time", "Slow mornings", "Game on, stay in", Four J's Cabin "Bali" day and night, "The Upper Room"). The output has to be beautiful, easy to read, believable and ready to post without manual editing.

**Why we can't get there today.** The references are **designed posters**: a _real photo of the property_, plus layered typography, badges, amenity icons, an info bar and brand marks. Our pipelines produce either:

1. **Generate tab** (`generate-marketing-media` → `marketingImageGenerationAi.ts`): one Gemini image. `IMAGE_SYSTEM_INSTRUCTION` (`_shared/marketingImagePromptBuilder.ts`) says "look like a real photo" and "no text, signage". The result is a _made-up photo of a room that doesn't exist_, with no copy, layout or brand. It can never match the references. It's also a trust problem, since guests book the real unit.
2. **Design tab** (`generate-marketing-template` → `marketingTemplateGenerationAi.ts` → `ui/.../lib/polotno/polotnoAiCampaignDocuments.ts`): the AI picks tokens (7 archetypes, 4 font pairings, 3-color palette, 5 copy strings), and those compile into an editable Polotno document. This is the **right architecture**, but it's too shallow:
   - It works blind. The LLM never sees the photo, so it can't pick a photo, place text in empty space, or pull a palette from the image.
   - One photo only (`primaryBindingPhoto`). No multi-photo compositions, masks or wave splits.
   - It has no vocabulary for the parts that make the references work: script accent fonts, chunky outlined display type, pill chips, amenity icon rows, check-in/out/deposit info bars, a location pin, social handle, sticker badges, glass panels, mascot/logo placement, and ornaments like sparkles, leaf flourishes and "burst" dashes.
   - Only 4 font pairings (Fraunces/Jost/Plus Jakarta/Space Grotesk/Nunito) and **no script face**, which is the signature of 5 of the 7 references.
   - It makes one attempt with no visual QA. Overflow, low contrast or text over a face ships as-is.
   - Copy isn't tied to real facts we already store (`checkInTime`, `checkOutTime`, `securityDeposit`, `logo_url`, `tagline`, `facebookUrl`/`instagramUrl`, amenities, nearby landmarks).

**Core decision (recommended): hybrid "AI art director + deterministic layout engine".** Use real property photos. Vision AI analyses them. An LLM picks a layout from a hand-designed library and fills slots with grounded copy. Text, icons and shapes are rendered as **vectors** in Polotno, so they're crisp, correctly spelled and editable. The image model is used only to _enhance_ photos (relight, extend to aspect ratio, upscale), never to invent the property or render the text. We then render, auto-QA and rank several variants and show the best. This is what agencies and Canva's "Magic Design" do, and it's the only way to get zero typos, true-to-life listings and consistent branding.

---

## Part A: What the references do (the design rubric)

| #   | Reference                       | Transferable techniques                                                                                                                                                                                                                                                                                                                                                   |
| --- | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Kame "Coffee • View • You time" | 2 real photos joined by an **organic wave mask**; cream brand field; chunky rounded display with drop shadow + **script subtitle**; brand pill with • separators; small-caps tagline; **3-icon benefit row** (line icons, brand color); **location pill with pin**; mascot top-left                                                                                       |
| 2   | Four J's "Bali" (day)           | Full-bleed photo; headline placed in the **sky/empty space**; tracked small caps eyebrow + huge script word + bold sans sub; handle banner; property name in script over the pool; tracked "RELAX \| UNWIND \| RECONNECT" bar; **5 amenity icons in white**; **bottom info bar** (check-in, check-out, deposit, icons in circles); footer split script + CTA \| FB handle |
| 3   | Four J's "Bali" (night)         | Same content, **palette follows the photo** (navy + gold); **frosted glass** description card; name in a pill; 7-icon amenity grid; **glass check-in/out card**; location pin + list of nearby landmarks; closing CTA                                                                                                                                                     |
| 4   | The Upper Room                  | **Restraint**: photo with a centered title only. Elegant high-contrast serif, tracked caps subtitle, tiny leaf ornament. Proves "minimal" is a valid archetype                                                                                                                                                                                                            |
| 5   | = 2 (duplicate)                 |                                                                                                                                                                                                                                                                                                                                                                           |
| 6   | Kame "Slow mornings"            | Magazine cover: big serif + script overlap, "at KAME HOME" with a brand wordmark, thin rule, subtitle; **glass amenity strip** with 4 icon+label items; footer tagline; mascot sticker bottom-right                                                                                                                                                                       |
| 7   | Kame "Game on, stay in"         | Feature spotlight (PS5): two-tone chunky headline with a **white outline stroke** and brand green; **circular sticker badge** with sparkle; "Perfect for" card with 4 icons; script "Good vibes, great games!" + heart doodle; location pill + tagline footer                                                                                                             |

**Shared rules we'll encode:**

1. **Real photo, graded warm, bright and crisp.** Never AI-invented rooms.
2. **Three or four type voices at most:** display (chunky or serif), script accent, tracked caps label, clean sans body.
3. **Text sits only in empty space** (sky, wall, blank field) or on a scrim, glass panel or solid field. It never covers faces or the hero subject.
4. **Palette comes from the photo and the brand color.** Cream, caramel, navy or gold rather than generic saturated colors.
5. **Facts turn into modules:** amenities become an icon row, times and deposit become an info bar, location becomes a pin pill, socials become a handle.
6. **Brand presence:** logo or mascot in a consistent corner, wordmark in the headline.
7. **Hierarchy:** one hero line, one supporting line, one module band, one footer. Plenty of margin and consistent spacing.
8. **Ornaments are small and sparse:** sparkles, leaf flourish, doodle dashes, hearts.

---

## Part B: Target architecture

```
Host picks: goal (promo / vibe / amenity spotlight / feature / info / reviews), photos (or "auto"), format (1:1, 4:5, 9:16), optional prompt
  → [1] Photo intelligence (vision)        gemini-3.x-flash, structured JSON per photo, cached by storage path + hash
  → [2] Fact pack                          property facts + brand kit (deterministic, no LLM)
  → [3] Art director (LLM, structured)     chooses archetype(s), photos, palette, font pairing, copy, modules, ornaments → PosterSpec × N
  → [4] Optional photo enhancement         gemini image edit: relight / outpaint to aspect / upscale (structure-locked)
  → [5] Layout engine (deterministic)      PosterSpec + archetype → PolotnoDesignDocument (vectors, masks, icons)
  → [6] Render + QA                        headless render → deterministic checks + vision critic → auto-fix or drop
  → [7] Rank & present                     top 3–4 variants → open any in the Polotno editor, export, publish
```

**Where it runs:**

- Steps 1–4 run in a new edge function, `generate-marketing-poster`, reusing the existing job/billing/budget/rate-limit pipeline from `generate-marketing-media`: `marketingGenerationJobs.ts`, `marketingGenerationBudget.ts`, `claimMarketingGenerationJobBilling`, sweeper, activity log.
- Step 5 is **shared TypeScript** so it runs in the UI (Polotno) and, later, server-side.
- Step 6: **the client renders first** (Polotno `store.toDataURL`, already in-app), then POSTs the thumbnails to a `poster-qa` step. Server-side render (Satori + resvg-wasm in Deno, or a small Playwright render worker) is a later phase for autopilot/Telegram cron posting with no browser open.

---

## Part C: Task list

### Phase 0: Ground truth and evaluation (do first)

- [ ] 0.1 Save the 7 references (6 unique) as a private benchmark set under `docs/workflow/assets/poster-benchmarks/` with a written teardown per image (Part A).
- [ ] 0.2 Define a **postability rubric** scored 1–5: legibility, hierarchy, fit with the photo, brand consistency, factual accuracy, "looks AI-made" (inverse), and "would post as-is" (yes/no).
- [ ] 0.3 Build a **golden property fixture set**: Kame Home (condo, cozy), a resort/villa (pool), a minimal studio, a property with a weak phone photo, and one with no brand kit.
- [ ] 0.4 Baseline: run today's Design tab AI and Generate tab on the fixtures and score them blind. This is the number to beat.
- [ ] 0.5 Ship gate: mean ≥ 4.0 on every rubric axis, ≥ 70% "would post as-is", 0 factual or spelling errors, no regression vs baseline on any axis.

### Phase 1: Brand kit and fact pack (data foundation)

- [ ] 1.1 **Brand kit per property, with org fallback:** logo, mascot/sticker (transparent PNG), primary/secondary/accent colors, preferred font pairing, social handles, tagline, "tone" (cozy / luxe / playful / minimal). Reuse `propertyBranding.ts`, `orgBrandColor.ts`, `loadResolvedBrandColorByPropertyId`. Add fields only where missing (migration). Add a settings card with `useUnsavedChangesGuard`.
- [ ] 1.2 **Fact pack builder** `_shared/marketingPosterFacts.ts`: name, type, residence/city, check-in/out times, security deposit, max guests, amenities (via `amenitiesFromPropertySettings`), nearby landmarks, FB/IG handle, booking link, current promo/voucher (vouchers module), review snippets (`marketingGuestReviews.ts`). Every string the poster shows must trace back to a fact or to host input.
- [ ] 1.3 Background removal for mascot/logo uploads, so a JPEG logo becomes a clean sticker (client-side `@imgly/background-removal` or Gemini edit). Optional.

### Phase 2: Design system for posters (the biggest quality lever)

- [ ] 2.1 **Font library expansion** (self-host Google Fonts, register in Polotno):
  - Script: Great Vibes, Allura, Sacramento, Alex Brush, Parisienne
  - Chunky/rounded display: Fredoka, Baloo 2, Lilita One, Chewy
  - Elegant serif: Cormorant Garamond, Playfair Display, DM Serif Display (keep Fraunces)
  - Tracked caps and sans: Montserrat, Poppins (keep Jost, Plus Jakarta)
- [ ] 2.2 **Curated font pairings (~10)** replacing today's 4, each named after a mood. Examples: "Cozy Café" (Fredoka + Allura + Poppins), "Tropical Script" (Montserrat caps + Great Vibes + Poppins), "Editorial Calm" (Cormorant + Jost caps), "Magazine Cover" (Playfair + Sacramento + Jost), "Playful Pop" (Lilita One + Chewy + Poppins). Pairings are **hand-picked**; the AI chooses one and never invents fonts.
- [ ] 2.3 **Type styles as tokens:** each pairing defines `display`, `script`, `eyebrow` (caps, +20–30% tracking), `body` and `chip`, each with size ramp, line-height, weight, stroke (outline), shadow and case. This lets us reproduce the "KAME HOME with white outline + drop shadow" look.
- [ ] 2.4 **Amenity icon set:** one consistent line icon family (Lucide or Phosphor) as SVG with a fixed stroke width. Map every `AMENITY_LABELS` id (`_shared/publicPropertyAmenities.ts`) and custom-amenity keyword to an icon. Reuse the mapping in `ui/src/features/guest/marketing/properties/components/property-detail/PropertyAmenities.tsx` if it exists. Also add icons for the info bar (clock, shield, pin, calendar, car, people) and for "perfect for" items.
- [ ] 2.5 **Poster modules**, each a pure function returning Polotno children in `ui/.../lib/polotno/modules/`:
  - `pillBadge` (with • / \| separators)
  - `iconRow` (3–7 items, auto grid, light/dark)
  - `infoBar` (check-in / check-out / deposit)
  - `locationPill`, `handleBanner`, `ctaFooter`
  - `glassCard` (semi-opaque fill + border + shadow; true backdrop blur is approximated by a blurred cropped copy of the photo under the card)
  - `stickerBadge` (circle + sparkle)
  - `nearbyList`, `reviewQuote`, `priceTag`, `ornament` (sparkle, leaf, burst dashes, heart doodle, birds)
- [ ] 2.6 **Photo treatments:** organic **wave/blob masks** (SVG `clipSrc`), rounded frames, 2–3 photo split/collage, gradient scrims (top/bottom/radial), and a warm/bright color grade (Polotno filters: brightness, contrast, sepia/warm tint).
- [ ] 2.7 **Archetype library v2 (~12), hand-designed from the references**, defined as constraint layouts (relative anchors, safe zones, min/max font sizes) rather than fixed coordinates, so they adapt to 1:1, 4:5 and 9:16:
  1. `wave-duo` (ref 1)
  2. `sky-headline-full-bleed` (ref 2)
  3. `night-glass` (ref 3)
  4. `minimal-title` (ref 4)
  5. `magazine-cover` (ref 6)
  6. `feature-spotlight-sticker` (ref 7)
  7. `split-panel-facts`
  8. `collage-grid-3`
  9. `review-quote`
  10. `promo-price-tag`
  11. `slots-calendar-strip` (reuse calendar tokens)
  12. `fully-booked-waitlist`

  Each declares its required and optional slots and which photo traits it needs (e.g. `sky-headline` needs ≥ 25% calm area at the top).

- [ ] 2.8 A designer pass: hand-build each archetype in the Polotno editor on the fixture photos, and don't accept an archetype until it scores ≥ 4.5 with _manual_ copy. If the template isn't beautiful by hand, AI won't fix it.

### Phase 3: Photo intelligence (vision)

- [ ] 3.1 `_shared/marketingPhotoAnalysis.ts`: a Gemini Flash vision call with a strict JSON schema per photo:
  - scene type (bedroom/pool/balcony view/amenity/exterior/food/people) and hero subject bbox
  - faces/people bboxes
  - **calm regions** (bboxes suitable for text, with the dominant luminance under each)
  - horizon/sky region, time of day and mood
  - dominant palette (5 hex) plus a suggested accent
  - quality score (sharpness, exposure, tilt, clutter) and a crop suggestion per aspect
- [ ] 3.2 Cache the analysis per `storage_path` + content hash (table `marketing_photo_analysis`, migration). Photos are analysed once, not on every generation. Bill as platform cost like the prompt enhancer (Decision 2 in the existing hardening doc).
- [ ] 3.3 Cross-check the palette deterministically. Sample pixels client-side (extend `marketingAiPhotoPalette.ts`) and prefer measured colors over LLM-reported hex.
- [ ] 3.4 **Smart crop:** compute per-aspect crops that keep the subject and calm region inside the frame (from 3.1 bboxes). Fallback is center-weighted.
- [ ] 3.5 **Photo ranking:** for "auto" photo selection, pick hero plus supporting photos by quality, scene diversity and goal match (e.g. "coffee" goal → balcony plus coffee station photos).

### Phase 4: Art director (LLM → PosterSpec)

- [ ] 4.1 Define the **PosterSpec** schema, shared between edge and UI:
  - `archetype`, `format`, `photos[]` with crop + treatment, `fontPairing`
  - `palette` {field, ink, accent, onAccent}
  - `copy` {eyebrow, headline, headlineAccent (script), subhead, chips[], tagline, cta, footer}
  - `modules[]` (typed: iconRow items from facts, infoBar from facts, …), `ornaments[]`, `logoPlacement`, `textZone` (which calm region)
- [ ] 4.2 Replace the `design` branch of `marketingTemplateGenerationAi.ts` with the poster director. Keep the old token path only as the offline fallback (D1: one engine, not two). The model receives the fact pack, brand kit, **photo analyses (plus low-res thumbnails as inline images)**, the goal, the host prompt (wrapped with `wrapUntrusted`), and the archetype catalog with each one's slot rules. It returns **N = 4 diverse specs** (different archetypes and pairings).
- [ ] 4.3 **Copywriting rules** in the prompt and enforced in the parser:
  - headline ≤ 5 words; script accent ≤ 3 words; chips are 3 items of 1–2 words each; tagline like "Sip slow. Breathe deep."
  - No em dashes, no AI tells (reuse the `human-copy` rules)
  - Taglish allowed when the host writes that way
  - Facts only from the fact pack: amenities must exist, times and prices come verbatim
- [ ] 4.4 **Normalizer/validator** (like today's `normalizeDesignTemplateTokens`): enum allow-lists, copy clamps per slot capacity, and dropping any module whose facts are missing (e.g. no deposit → the info bar shows only times). Refusal or partial output falls back to rule-based defaults per goal.
- [ ] 4.5 Model choice: `gemini-3.x-flash` with thinking on (multimodal plus structured output, cheap). `gemini-3-pro` for the premium tier. Configured in `aiModelRouter.ts` as a new feature `marketing_poster_director`.

### Phase 5: Layout engine (deterministic compiler)

- [ ] 5.1 `ui/.../lib/polotno/posterCompiler.ts`: PosterSpec + archetype → `PolotnoDesignDocument`, built from Phase 2 modules plus the existing primitives in `polotnoCampaignDocuments.ts` (`text`, `photoImage`, `photoScrim`, `logoImage`, `band`, `thinRule`, `textBoxHeight`).
- [ ] 5.2 **Auto-fit text:** binary-search the font size per slot within the pairing's min/max until the text fits its box. Balanced line breaks with no orphans. Reuse `syncPolotnoTextBounds.ts`.
- [ ] 5.3 **Contrast guard:** for every text box, sample the background under it (photo pixels plus overlays). If WCAG contrast is < 4.5 (body) or < 3 (display), escalate: flip ink → add local scrim → move to glass card → switch archetype variant.
- [ ] 5.4 **Collision guard:** text never overlaps subject or face bboxes, and modules stay inside platform safe zones (9:16: top 14% / bottom 20% quiet). Extend `resolvePlatformIntent` data.
- [ ] 5.5 Keep the output a normal editable Polotno doc, so hosts can tweak anything in `PolotnoDesignStudio.tsx`.

### Phase 6: Photo enhancement (optional, structure-locked)

- [ ] 6.1 "Enhance photo" uses the Gemini image _edit_ path (reusing `generateMarketingImage` with the real photo as the reference) with a strict system instruction: "Keep geometry, furniture and layout identical. Adjust only exposure, white balance, sky and sharpness." Offer it as a toggle on each variant rather than applying it silently.
- [ ] 6.2 **Outpaint to aspect:** extend a 4:3 photo to 4:5 or 9:16 so the full-bleed archetypes work without awkward crops.
- [ ] 6.3 **Upscale** low-res phone photos (2K output on the standard/premium tier).
- [ ] 6.4 **Honesty guard:** a vision diff check that the enhanced photo keeps the same objects (no added pool, furniture or view). Fall back to the original if it fails. Add a "Photo enhanced" note in the job card for transparency.
- [ ] 6.5 Rewrite the existing Generate tab's `IMAGE_SYSTEM_INSTRUCTION` use case as "lifestyle/mood B-roll" only (coffee cup, bedding detail, ambience) and label it clearly. Hosts should not use it as a stand-in for the listing.

### Phase 7: QA loop and ranking

- [ ] 7.1 **Deterministic checks** after compile: text overflow, min font px at export size, contrast, collisions, safe zones, spelling of fact strings (exact match to the fact pack), and no empty modules.
- [ ] 7.2 **Vision critic:** render each variant (client `store.toDataURL` at 1080px) → Gemini Flash grades it against the Part A rubric and returns structured issues (e.g. "headline overlaps pool edge", "chips feel crowded"). Issues map to deterministic fixes (shift zone, reduce items, change scrim). At most one repair pass.
- [ ] 7.3 Rank by critic score plus diversity. Show the top 3–4 and silently drop anything below threshold. If everything fails, fall back to the safest archetype (`minimal-title` or `split-panel-facts`).
- [ ] 7.4 Log scores per job (`marketing_generation_jobs` metadata) so we can watch quality over time and A/B prompt versions (`definePrompt` versions already exist).

### Phase 8: UX in Marketing Studio

- [ ] 8.1 **"AI Post" becomes the default mode of the Generate tab** (Decision D1). The current photo generator moves behind a secondary "Lifestyle photo" mode. The Design tab's "Generate with AI" button calls the same poster pipeline, so there is only one AI design engine.
  - Flow: **Goal** chips (Vibe, Promo, Amenity spotlight, New feature, Check-in info, Guest review, Slots left) → **Photos** (auto-picked from property media, swappable) → **Format** (1:1 / 4:5 / 9:16) → optional prompt → Generate.
- [ ] 8.2 Results grid of 4 posters with a progressive reveal via the job polling in `useMarketingGenerationJob`. Actions per card: **Edit** (opens Polotno), **Shuffle style** (same copy, different archetype/pairing, no new LLM call when possible), **Rewrite copy**, **Enhance photo**, **Publish** (existing Meta publish), Download.
- [ ] 8.3 Carousel-ready: "Make a set" generates 3–5 consistent posts (same pairing and palette, different photos/modules) for an IG carousel.
- [ ] 8.4 Mobile: bottom-sheet goal/photo pickers, full-width results (`mobile-responsive` skill). Minimal UI copy (`minimal-ui-copy`, `human-copy`).
- [ ] 8.5 "Save as my style": pin a favourite archetype + pairing + palette to the brand kit, so future generations stay on-brand.

### Phase 9: Platform, cost and ops

- [ ] 9.1 Credits: director + vision + critic are Flash calls (~$0.002–0.01 per poster set). Price the set as one generation. Enhancement uses the existing image tier pricing (`marketingGenerationPricing.ts` + client mirror parity test).
- [ ] 9.2 Plans and permissions: gate by the existing marketing AI entitlement. Update `docs/architecture/plans-feature-matrix.md` (`plans-and-permissions` skill).
- [ ] 9.3 Activity log `marketing.poster_generated` (`audit-logging` skill).
- [ ] 9.4 Rate limits, kill switch and budget via the existing `rateLimitGate`, `marketingGenerationFeatureConfig.ts` and `checkQuotaAndBudget`.
- [ ] 9.5 Later: a server-side renderer (Satori + resvg-wasm, or a render worker) so Telegram cron / scheduled posts can generate without a browser.

### Phase 10: Tests and docs

- [ ] 10.1 Unit tests for the PosterSpec normalizer, auto-fit, contrast guard, collision guard, the icon mapping and each module (Vitest `.test.ts`; note that `.test.tsx` component tests are ignored).
- [ ] 10.2 Deno tests for photo analysis parsing, the fact pack and director fail-open.
- [ ] 10.3 Snapshot the compiled docs per archetype × format on the fixtures; add a Playwright mocked E2E for the AI Post flow.
- [ ] 10.4 Blind human eval (Phase 0 rubric) before shipping. The user is the judge.
- [ ] 10.5 Docs: `docs/architecture/overview.md`, `docs/PROJECT.md`, a new `docs/architecture/marketing-poster-studio.md`, the marketing route guide (`route-guides`), `migration-runbook.md`, and superseding notes in `marketing-ai-image-quality-hardening.md`.

---

## Technology and model recommendations

| Need                                    | Recommendation                                                                                       | Why                                                                                                                                                                                                            |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Layout/render                           | **Keep Polotno** (`openpolotno`, already integrated)                                                 | Editable, has masks/filters/stroke/shadow, and exports PNG client-side                                                                                                                                         |
| Server render (later)                   | Satori + `@resvg/resvg-wasm` in Deno, or a Playwright render worker                                  | Autopilot posting without a browser                                                                                                                                                                            |
| Vision / art direction / critic         | Gemini 3.x Flash (multimodal + structured output); Pro for premium                                   | Already our provider; key rotation and billing already built                                                                                                                                                   |
| Photo enhance / outpaint / upscale      | Gemini 3.1 Flash Image / 3 Pro Image **edit mode** with the real photo as reference                  | Already wired (`generateMarketingImage`)                                                                                                                                                                       |
| Icons                                   | Lucide or Phosphor SVG (one family)                                                                  | Consistent stroke, MIT, easy to embed                                                                                                                                                                          |
| Fonts                                   | Self-hosted Google Fonts (list in 2.1)                                                               | Free, and adds the script faces we're missing                                                                                                                                                                  |
| Background removal                      | `@imgly/background-removal` (client WASM)                                                            | For logos/mascots; no server cost                                                                                                                                                                              |
| **Not recommended as the primary path** | Letting an image model (Nano Banana Pro, Ideogram 3, Recraft) render the whole poster including text | Newer models spell better but still hallucinate the property and facts. Not editable, off-brand from post to post. At most, trial later as a "wild card" 5th variant behind a flag, gated by the vision critic |

## Decisions (recommended defaults, change if you disagree)

- **D1: Where it lives (decided).** One poster pipeline, one entry point, one editor.
  - **Generate tab defaults to "AI Post".** Hosts go there expecting a finished image, so that's where the finished poster belongs. Today it gives them a photo with no text, which is the gap you're seeing.
  - **"Lifestyle photo" becomes a secondary mode.** That's today's image generation, relabelled for mood and B-roll shots only.
  - **Every poster opens in the existing Polotno Design editor.** Hosts can change a word, swap a photo or move an element without starting over. A flat PNG from an image model can't be edited like that, and editing is what makes a result postable instead of almost postable.
  - **The Design tab's "Generate with AI" uses the same poster director.** The current shallow token generator is retired, apart from an offline fallback. Two AI design engines would mean two quality levels, and hosts would keep landing on the weaker one.
  - **Why not a separate new tab?** It would split discovery, and it would leave the weak Generate output live as the first thing hosts try.
- **D2: Real photos only by default.** An AI-invented listing photo is never the hero. Enhancement is opt-in and structure-locked.
- **D3: Text is always vector** (never baked into pixels), so it's editable and never misspelled.
- **D4: Archetypes are hand-designed.** The AI selects and fills them; it never free-places elements.

## Suggested delivery order

1. Phase 0 + Phase 2 (design system + 6 reference archetypes, done by hand first). Biggest visible jump.
2. Phases 1, 3, 4 and 5 (facts, vision, director, compiler). End-to-end "AI Post" with 4 variants.
3. Phase 7 (QA loop) and Phase 8 (UX polish, carousel sets).
4. Phase 6 (photo enhancement), then Phase 9.5 (server render).

## Critical files

- Reuse/extend:
  - `supabase/functions/_shared/marketingTemplateGenerationAi.ts`
  - `ui/src/features/dashboard/marketing/lib/polotno/polotnoAiCampaignDocuments.ts`
  - `.../polotno/polotnoCampaignDocuments.ts` (primitives, fonts)
  - `.../lib/designAiTokens.ts`
  - `supabase/functions/_shared/marketingImagePromptBuilder.ts` (property context, platform framing)
  - `marketingImageGenerationAi.ts` (edit path)
  - `aiModelRouter.ts`
  - `marketingGenerationJobs.ts` / `Budget.ts` / `Pricing.ts`
  - `publicPropertyAmenities.ts`
  - `propertyBranding.ts`
  - `marketingGuestReviews.ts`
  - `marketingAiPhotoPalette.ts`
  - `propertyBindingMedia.ts`
  - `components/ai-studio/*`, `components/design-editor/PolotnoDesignStudio.tsx`
- New:
  - `generate-marketing-poster/index.ts`
  - `_shared/marketingPosterFacts.ts`, `_shared/marketingPhotoAnalysis.ts`, `_shared/marketingPosterDirector.ts`
  - `ui/.../lib/polotno/posterCompiler.ts`, `ui/.../lib/polotno/modules/*`, `ui/.../lib/posterSpec.ts`
  - Migrations for the brand kit fields and `marketing_photo_analysis`

## Verification

- `bun run ci:quality` (lint, type-check, Vitest, Deno, smoke E2E, build).
- Local stack (`./dev.sh`): generate AI Posts for each fixture property in 1:1, 4:5 and 9:16. Export PNGs and check them at 375px on a phone and at 1080px full size.
- Blind side-by-side against the 6 reference posts and the Phase 0 baseline using the rubric. Ship only when the Phase 0.5 gate passes.
- Spot-check facts: every time, price and amenity on a poster matches property settings exactly.
