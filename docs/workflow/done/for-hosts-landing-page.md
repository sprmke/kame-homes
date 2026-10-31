---
stage: done
title: 'Redesign /for-hosts landing page + host-mode header nav'
status: done
tags: [planning, planned-modules]
updated: 2026-08-01
---

# Redesign `/for-hosts` landing page + host-mode header nav

## Context

`/for-hosts` (`ui/src/features/guest/marketing/pages/ForHostsPage.tsx`) is currently a thin, generic 3-section marketing page (hero, a static 6-icon feature grid with placeholder copy, closing CTA) that doesn't reflect what the platform actually does. The dashboard has grown into a genuinely rich product (automated booking workflow, AI receipt validation, Gmail auto-approval, unified guest inbox with AI replies, a full marketing/content studio, finance & maintenance tracking with Telegram alerts, multi-tenant org/property/parking, etc.), and none of that shows up here. There's also no reviews/social-proof section, and the header (`MarketingNav.tsx`) shows the same guest-oriented links (Developments/Properties/Parkings/Services) regardless of whether you're in guest or host mode — irrelevant once you're on `/for-hosts`.

Goal: make `/for-hosts` a stunning, professional, animated showcase of the real dashboard feature set, add a mock host-reviews section, and give host mode its own header nav. Confirmed via exploration: `/for-hosts` is the _only_ host-mode route rendered inside `MarketingLayoutShell` (host auth pages use a separate `AuthLayout`), so in-page anchor nav links are always safe here. There are unused ("orphaned") components in `guest-landing/components/` (`HowItWorks`, `TrustIndicators`, `Testimonials`) with good visual patterns to imitate — but we build new host-specific components rather than repurposing them, since their copy is guest-stay flavored and something else may still want them later.

## Decisions already made (via clarifying questions — final, do not re-litigate)

1. **Feature showcase = one 54-second dashboard film with nine interactive chapters.** The later implementation request superseded the original passive 6-slide carousel: the tour now auto-plays and loops, but hosts can pause, restart, or jump directly to a chapter. Remotion Player drives one continuous 16:9 dashboard timeline:
   1. Command center — KPIs, cash flow, and today queue
   2. Automated booking flow — status pipeline, receipt validation, Gmail approval, calendar sync
   3. Unified Guest Inbox — guest message + AI-assisted reply
   4. Finance & reporting — KPI counters, cash-flow chart, and ledger rows
   5. Pricing — nightly-rate calendar and saved rate settings
   6. Marketing Studio — content calendar → design → video timeline → schedule
   7. Maintenance — recurring work queue and completion
   8. Telegram notifications — module settings and phone alerts
   9. AI assistant — receipt validation, Gmail approval, reply drafting, and calendar sync
2. **Reviews section = single-quote carousel WITH dots + prev/next arrows** (same interaction pattern as orphaned `Testimonials.tsx`) — deliberately different interaction model from the no-controls feature carousel above. Mock host data, initials-avatar badges (gradient-circle first-initial, matching `PropertyReviews.tsx`'s exact pattern), not fake stock photos.
3. **Host-mode header nav = in-page anchor links**: `Features` / `How It Works` / `Reviews`, replacing the guest `navLinks` only when in host mode. Needs a `scrollIntoView` handler (not default hash-link behavior) plus `scroll-mt-*` on target sections so the fixed header doesn't cover them.
4. **Keep the existing aspirational SaaS CTA copy** ("Get Started Free", "Start Free Trial", "No credit card required", "Free forever for 1 property", "Cancel anytime") as-is — explicitly chosen even though no real billing system exists. Do fix the literal bug where the hero's "View Pricing" button links to `/for-hosts` itself (a no-op): repoint it to smooth-scroll to the closing CTA section (renamed `id="pricing"`), keep the "View Pricing" label since it still reads sensibly once it lands on the free-tier bullets.

A **"How It Works" section doesn't exist yet** and is being added (short host-onboarding steps: add property → configure form/pricing → automation runs the workflow → get paid) so the nav has something to point at — this keeps nav-link order matching DOM order (Hero → Features → How It Works → Reviews → CTA), avoiding "click a link, scroll backwards."

Content is locked to real, shipped features only (verified against `ui/src/features/dashboard/*`) — do not market WIP items (super-admin moderation, Instagram DM full sync/scheduled publishing, org granular permission matrix, voucher config UI) as done.

## File/folder structure

New sibling folder next to `guest-landing/`, following its `components/` + `data/` convention:

```
ui/src/features/guest/marketing/for-hosts/
├── components/
│   ├── HostDashboardTour.tsx          # Remotion Player + chapter controls
│   ├── HostDashboardFilm.tsx          # 54-second, nine-scene dashboard composition
│   ├── HostHowItWorks.tsx             # id="how-it-works", numbered-card pattern (own copy)
│   ├── HostReviews.tsx                # id="reviews", dots+arrows carousel (own mock data)
│   └── HostCapabilityStrip.tsx        # capability-framed stats
├── data/
│   ├── hostTourChapters.ts            # chapter metadata + timeline + narration copy
│   └── hostTestimonials.ts            # mock reviews: name, role, quote, rating
└── lib/
    └── scrollToSection.ts             # shared scrollIntoView(id, reducedMotion) helper

ui/public/marketing/for-hosts/narration/
├── {chapterId}.mp3                    # Edge TTS output (planned)
└── {chapterId}.words.json             # optional word timings (planned)

scripts/marketing/
└── generate-host-tour-narration.*     # Edge TTS generator (planned)
```

Note: `ui/src/features/guest/marketing/hosts/` already exists but is unrelated (an individual host's _public listing page_ components — `HostPublicHero` etc.). Don't confuse it with the new `for-hosts/` folder, which matches the `/for-hosts` acquisition-page route.

`ForHostsPage.tsx` stays where it is (routing convention) and just composes the new components.

**Reuse, don't duplicate:** add `usePrefersReducedMotion()` to `ui/src/hooks/useMediaQuery.ts` (alongside `useIsBelowMd`/`useIsBelowLg`, same `useMediaQuery('(prefers-reduced-motion: reduce)')` pattern already ad-hoc-duplicated in `useSwipeCarousel.ts` and `VoucherReveal.tsx` — consolidating avoids a third copy). Reuse `scroll-mt-24` (precedent: `ChatMessageList.tsx:37`) on anchor target sections. Reuse `AbstractBackground`, `Button`, `cn()` as-is.

## Product-tour mechanics (feature showcase)

- `@remotion/player` renders a 1280×720 composition at 30 fps. Each chapter lasts 180 frames (6 seconds), for 1,620 frames / 54 seconds total.
- Chapter buttons call `PlayerRef.seekTo()` and resume playback; active chapter and per-chapter progress follow the Player frame.
- **Pause mechanism (WCAG 2.2.2):** dedicated pause/play and restart buttons plus hover/focus pause on the tour region.
- `prefers-reduced-motion` disables autoplay and looping and starts on a static populated frame. The surrounding hero background also stops its animation loop.
- A visually hidden `aria-live="polite"` node announces chapter changes.

## Visual mockups — what each one shows

`HostDashboardFilm.tsx` owns all nine scenes inside one consistent dashboard shell. It animates real workflow concepts—KPIs and ledgers, booking status advancement, AI reply typing, rate-calendar selection, Marketing Studio stages, maintenance completion, Telegram phone alerts, and the final AI-assistant summary. Content is hardcoded marketing mock data and performs no API calls.

## Header nav (`MarketingNav.tsx`)

- Split the single `navLinks` array (currently lines 27–32) into `guestNavLinks` (`{href, label}`, unchanged) and `hostNavLinks` (`{id, label}` — `features`/`how-it-works`/`reviews`). Select via the already-computed `isExploreMode`.
- Add a `handleHostNavClick(id)` using `scrollToSection` (shared lib) — `preventDefault`, close mobile menu, `scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'start' })`.
- Both link-rendering blocks need the branch: desktop nav has **two** near-identical `navLinks.map(...)` blocks (the `scrollSearchEnabled` and non-`scrollSearchEnabled` variants, ~lines 159–200) plus the mobile menu block (~line 243) — all three need `isExploreMode ? <Link ...> : <a href={"#"+id} onClick={handleHostNavClick(id)}>`, keeping existing className logic (`headerSolid` styling) unchanged.
- Everything else in the file (CTA button, `HostAccountMenu`/`GuestAccountMenu` branching) is already correct — out of scope.

## `ForHostsPage.tsx` composition

Full rewrite of the body (hero shell + `AbstractBackground`, with the selected CTA promises retained):

1. Hero copy + primary CTA + **Watch Product Tour**
2. `<HostDashboardTour />` — `id="features" scroll-mt-24`, visually part of the hero
3. `<HostHowItWorks />` — `id="how-it-works" scroll-mt-24`
4. `<HostReviews />` — `id="reviews" scroll-mt-24`
5. Closing CTA (existing bullets, kept) — `id="pricing" scroll-mt-24`

Static 6-icon feature grid is removed entirely, replaced by `HostDashboardTour`. The hero's no-op "View Pricing" link becomes **Watch Product Tour** and scrolls to `features`; the closing CTA retains the selected free-tier copy.

## Capability strip after hero

Included as `HostCapabilityStrip.tsx` with capability-framed values rather than fabricated traction: nine connected modules, one booking workflow, AI-assisted operations, and 24/7 background automation.

## Planned follow-up: chapter voice narration (TTS)

**Goal:** while each dashboard chapter animates, a short voiceover narrates what the host is seeing — like a guided product demo, not a silent film.

### Recommended approach (free, no API key)

**Primary: Microsoft Edge TTS (`edge-tts`) → pre-generated MP3 assets → Remotion `<Audio>`.**

| Option                                   | Cost                      | Quality                          | Sync with Remotion                                                          | Notes                                                                                                           |
| ---------------------------------------- | ------------------------- | -------------------------------- | --------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| **`edge-tts` (Microsoft neural voices)** | Free, no API key          | High (Aria / Guy / Sonia Neural) | Excellent — bake MP3 + optional word-timing JSON, play via Remotion `Audio` | **Choose this.** Generate offline/build-time; commit or cache under `ui/public/marketing/for-hosts/narration/`. |
| **Web Speech API (`speechSynthesis`)**   | Free, built into browsers | Uneven (OS/voice dependent)      | Weak — hard to keep in frame lock with the film                             | OK as a **dev fallback** only; not the product path.                                                            |
| **Piper / ONNX in-browser**              | Free / OSS                | Good once loaded                 | Medium                                                                      | Heavy first download (~tens of MB); avoid on a marketing hero.                                                  |
| ElevenLabs / OpenAI / Google Cloud TTS   | Paid / quota              | Excellent                        | Excellent                                                                   | Skip unless product later budgets paid voice.                                                                   |

Why Edge TTS wins here: the tour is already Remotion-driven, Remotion already supports local audio (`Audio` + `staticFile` / public assets), and Edge TTS can emit MP3 + word timestamps without keys — the same pattern used for Remotion voiceovers elsewhere in the ecosystem.

### Playback UX (required)

1. **Muted by default.** Browser autoplay policies block unmuted audio. Mute at the **composition** level (`inputProps.narrationMuted` → `<Audio muted>`), not via `Player.initiallyMuted`: a Player that mounts muted and unmutes later recreates Remotion's shared audio tag refs and crashes with `No audio ref found` (Remotion issue #9475, fixed in 4.0.498 — this repo runs ≥ 4.0.501). Show a clear **Unmute / Narration** control next to pause/play.
2. **Narration follows the Player transport.** Pausing the film pauses narration with it; seeking restarts the chapter line.
3. **Chapter seek restarts that chapter’s line.** Jumping to Finance should not keep speaking Bookings.
4. **`prefers-reduced-motion`:** no autoplay of film **or** narration; if the user presses play with narration on, allow audio (motion preference ≠ silence preference). Add an explicit mute toggle regardless.
5. **Accessibility:** do not rely on voice alone — keep visible chapter title/description and the existing `aria-live` announcement. Optional captions strip under the film can reuse word-timing JSON later.

### Narration content model

Extend `hostTourChapters.ts` with a short `narration` string per chapter (~8–18 words, ~4–6 seconds spoken so it fits the 6s chapter window). Example direction (copy TBD in implementation):

| Chapter     | Narration intent                                                   |
| ----------- | ------------------------------------------------------------------ |
| Overview    | See stays, revenue, and today’s work in one command center.        |
| Bookings    | Watch the booking pipeline move from review to ready for check-in. |
| Inbox       | Guest messages land here — AI drafts a reply you can send.         |
| Finance     | Track income, expenses, and net profit as stays settle.            |
| Pricing     | Tune weekday, weekend, and date rates on the calendar.             |
| Marketing   | Plan, design, edit, and schedule content from one studio.          |
| Maintenance | Recurring upkeep stays scheduled and marked done.                  |
| Alerts      | Telegram routes the right reminder to the right team.              |
| AI          | Receipts, approvals, and replies — AI handles the repetition.      |

Keep copy sparse (matches `ui-minimal-copy`); voice carries the explanation the UI intentionally omits.

### Asset pipeline

```
scripts/marketing/generate-host-tour-narration.ts   # or .mjs / Python one-shot
  → calls edge-tts per chapter
  → writes ui/public/marketing/for-hosts/narration/{chapterId}.mp3
  → optional {chapterId}.words.json (startMs / durationMs)

ui/src/features/guest/marketing/for-hosts/
  ├── data/hostTourChapters.ts          # + narration text + audio path
  ├── components/HostDashboardFilm.tsx  # <Sequence><Audio src=… /></Sequence> per chapter
  └── components/HostDashboardTour.tsx  # mute toggle + unmute affordance
```

Generation is a **dev/CI script**, not a runtime dependency — no Edge TTS in the browser bundle. Re-run the script when narration copy changes. Commit the MP3s so production deploys do not need network TTS.

Voice default: `en-US-AriaNeural` (clear product-demo tone); allow override via script flag. Rate slightly above default (e.g. `+5%`–`+10%`) so lines finish inside each 6s chapter.

### Sync rules

- One MP3 per chapter, mounted inside that chapter’s Remotion `Sequence` at frame `0` of the chapter (absolute frame = `index * HOST_TOUR_CHAPTER_FRAMES`).
- If a line runs longer than 6s after generation, either shorten the copy or extend that chapter’s frame budget (prefer shorten).
- Looping the film restarts narration with chapter 1; unmute state can persist across loops for the session.

### Out of scope for v1

- Live streaming TTS in the browser
- Multi-language voices (English only first)
- Background music bed (can layer later under narration with ducking)
- Paid voice cloning

## Docs to update

`docs/guides/routes/for-hosts.md` (required — CLAUDE.md: docs are source of truth):

- Overview: replace "3 sections, static content" with Hero → 54-second interactive dashboard tour → host onboarding steps → host testimonial carousel → closing CTA.
- Implementation map: change `Sections` row to point at `ui/src/features/guest/marketing/for-hosts/**`; add a row for the host-mode nav anchors (`MarketingNav.tsx` branch + `scrollToSection` helper).
- Add a note that `/for-hosts` is the only host-mode route rendering these anchors, so a future host-mode page addition needs to account for that.
- When narration ships: document mute-default, unmute control, Edge TTS asset path, and regenerate script.

## Verification

```bash
bun run lint
bun run type-check
bun run build
```

Manual browser check (dev server, `/for-hosts`) at 375px / 768px / 1024px+:

- Dashboard tour runs for 54 seconds across all nine chapters, loops, and supports pause/play, restart, and chapter seeking; hovering or tabbing into the region pauses it.
- `prefers-reduced-motion: reduce` (Chrome DevTools → Rendering) — tour does not auto-advance and the hero background does not loop.
- Desktop and mobile nav on `/for-hosts` show `Features / How It Works / Reviews`; clicking each smooth-scrolls to the right section, not obscured by the fixed header, in both transparent (top) and solid (scrolled) header states; mobile menu closes after the click.
- Switching to a guest route (e.g. `/properties`) still shows the original guest nav links, unaffected.
- Hero **Watch Product Tour** scrolls to the dashboard film without a route change/reload.
- Reviews carousel dots + arrows work independently of the feature showcase.
- Pull in the `mobile-responsive` and `accessibility` skills during implementation for the standard checklist (44×44px touch targets, focus states, contrast).

### Narration verification (when implemented)

- Tour starts muted; unmute starts the current chapter’s line.
- Pause/play and chapter seek keep audio aligned with the visible scene.
- Mute toggle works; reduced-motion still allows unmuted play when the user starts the tour.
- Production build includes MP3 assets; no runtime Edge TTS network call from the SPA.

## Status

**Visual tour + narration shipped** — Remotion film, Edge TTS chapter MP3s, mute-default unmute control, host nav, how-it-works, reviews, capability strip, and route guide are in place. Re-run `bun scripts/marketing/generate-host-tour-narration.ts` when narration copy changes.
