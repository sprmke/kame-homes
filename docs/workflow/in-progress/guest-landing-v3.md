---
title: 'Guest landing V3 — guest-first redesign'
status: in-progress
tags: [workflow, in-progress, marketing, guest-landing]
updated: 2026-11-04
stage: in-progress
kind: plan
---

# Guest landing V3 — guest-first redesign

**Status 2026-11-04 (rev. 2):** the first build ("The Ascent" — pinned elevator-ride hero, split-flap developments board, ticket-stamp parking, fanned-card bundle moment, flip-page guestbook) was built, verified clean (type-check/lint/tests/build), and reviewed live. **Rejected.** Feedback: the hero's clipped window reads as a "box," type is too big/heavy throughout, and the guestbook flip animation looks bad. All code from that attempt has been reverted — `gsap`/`@gsap/react`/`lenis` uninstalled, `--marketing-amber` token removed, routes/precache-config changes reverted, `guest-landing-v3/` deleted. §5 below records what was tried and why it's set aside; §10 records the new direction. The diagnosis, research, and goals in §1–4 are unaffected by the rejection and still hold.

**Current direction (rev. 2):** see §10 — photography-led, restrained, no boxed/clipped hero shapes, no literal card-object gimmicks (no split-flap, no ticket-stamp, no flip-page), calmer type scale, `framer-motion` only (no new dependencies).

Route target: new review route (proposed `/v3`), replacing `/` once approved. Builds on, and is benchmarked against, the current `/v2` review page (`GuestLandingV2Page`).

## 0. Where things actually stand today

There are **three** unshipped/partially-shipped attempts at this page already — worth naming before adding a fourth:

| Route              | Component            | Status                                                                              | Direction                                                                                                                                                  |
| ------------------ | -------------------- | ----------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/` (live)         | `GuestLandingPage`   | **Live**                                                                            | Split hero + canvas, category chips, featured stays rail, 3 destination tiles, compact trust strip                                                         |
| `/v2`              | `GuestLandingV2Page` | Review-only                                                                         | "Aperture" — scroll-pinned hero window that opens to full-bleed, stay-journey phone mock, places index, parking ticket-stub band, teal closing search      |
| `/explore-preview` | `ExplorePreviewPage` | Review-only, **not linked from nav**, documented as "pending swap" since 2026-09-11 | "Cinematic arrival + editorial spine" — full-bleed destination hero, trust ribbon, destination mosaic, stay-journey strip, one guest voice, gradient close |

**Decision needed from you:** V3 should supersede `/v2` (the one you're reacting to) — but should it also retire `/explore-preview`, or is there anything in that attempt worth salvaging (it already has a trust ribbon and guest-voice section, which V2 lacks and this plan recommends adding back)? Default assumption below: **retire `/explore-preview`, fold anything useful from it into V3, keep one review route going forward.**

## 1. Diagnosis — why `/v2` reads "for hosts," even though its content is guest content

Read all six `/v2` components. The content is already guest-correct (live search, stay journey, parking, places browse) — the problem is craft and emotional register, not information architecture:

1. **One visual idea, repeated everywhere.** The "aperture" (clip-path window) is the only authored motion in the whole page. Once you've seen it open in the hero, every other section (stay journey phone, ticket stub, closing search) reuses the same soft-rise/fade vocabulary with no second idea. A page with one trick reads like a component demo, not a destination.
2. **Photography is rationed.** Exactly one real photo in the hero backdrop, thumbnail-sized photos in the stays rail, zero photography anywhere else (parking is icon+text, places index is text rows, developments aren't shown at all). Airbnb/Agoda win on _wanting to be there_ — that only comes from large, specific, well-chosen imagery, not from clip-path cleverness.
3. **Single flat teal, no warmth.** `--primary` teal on white, everywhere, is correct for the _brand_ but reads as operational (dashboards use the exact same token). Nothing in the page's palette says "vacation" vs "SaaS settings page."
4. **Zero trust / zero "why not just use Airbnb."** No reviews beyond a 1-line chip buried in the old V1 (not even in V2), no verified-host proof, no explanation of what guests give up or gain booking direct, no FAQ. Research below shows this is the #1 blocker for independent booking sites — bigger than design polish.
5. **Developments/buildings aren't shown at all.** You explicitly want parking **and** developments showcased; V2 only has stays + parking. The V1 route guide even has an open TODO: _"Re-introduce developments block when catalog API exists (secondary section)"_ — the catalog exists now (`DevelopmentsListPage`, `usePublicDevelopments`), so this is unblocked.
6. **Copy is correct but cold.** "Your stay, sorted before you arrive" / "One booking covers the whole stay" — accurate, under-selling. No line anywhere says why that's better than three separate Airbnb/Grab/building-office bookings.

## 2. Competitive research (guest-facing, not host dashboards)

**Airbnb** — search-first hero, no promo clutter blocking it; large icon+label category chips for discovery beyond search; "I'm flexible" default lets browsing start without committing to dates; results lean on a dense, photography-forward grid rather than narrative sections. [Airbnb's Search Field](https://baymard.com/ecommerce-design-examples/32-search-field/19295-airbnb) · [10 great UX features from the Airbnb website](https://www.clickz.com/10-great-ux-features-from-the-airbnb-website/94645/) · [Design System Analysis of Airbnb](https://getdesign.md/design-md/airbnb/preview.html)

**Agoda** — 2025 cautionary tale, not a model to copy: Singapore's competition regulator flagged Agoda's deal badges and countdown timers as potentially misleading, and Agoda had to remove them. [Agoda revamps sites after Singapore regulator expresses concerns](https://insideretail.asia/2025/06/23/agoda-revamps-sites-after-singapore-regulator-expresses-concerns/) Independent teardowns also note promos competing with the search bar for attention. [Landing Doctor — Agoda teardown](https://landingdoctors.com/teardowns/agoda-com) **Explicit anti-pattern for V3: no fake urgency, no countdown timers, no "3 people are looking at this" badges.** Kame's actual differentiator against OTA pressure tactics is calm, honest, direct booking — that's a feature, not a gap to fill with dark patterns.

**Direct/independent booking trust research** — the dominant finding across vendor and survey sources: **legitimacy doubt, not price, is the main reason guests bail back to Airbnb/Vrbo** even after reaching a direct site; one source estimates 20–40% of visitors who reach a direct property page still book elsewhere. The fixes that consistently show up: verified identity/listings, real (including imperfect) reviews, visible policies, a reachable human host, and a checkout experience that feels as safe as the platforms guests already trust. [Hostfully — Airbnb vs. direct booking](https://www.hostfully.com/blog/airbnb-vs-direct-booking-website/) · [The Guestbook — 2026 STR survey](https://www.theguestbook.com/homes-and-villas/what-3342-travelers-told-us-about-booking-short-term-rentals) · [Dtravel — vacation rental homepages that convert](https://dtravel.com/blog/less-is-more-vacation-rental-homepage-designs-that-convert-guests)

**What this means for V3:** the biggest lever isn't a prettier hero, it's _finally building the trust/differentiation section Kame has never shipped on any version of this page_, paired with real photography and one strong, product-true signature idea (not borrowed from Airbnb's grid, not Agoda's urgency tactics).

## 3. Goals for V3

1. **Guest-first, not host-first.** Nothing on this page should read as an internal tool. Judge every section by: "would a guest scrolling this on their phone, deciding where to stay this weekend, feel invited in?"
2. **Show the whole catalog, not just stays.** Stays, parking, **and developments/buildings** each get a real showcase — not an icon row.
3. **Answer "why not just Airbnb/Agoda" directly**, through the product's actual mechanism (one booking = home + parking + building pass + direct host line) and through trust proof (verified listings, real reviews, no booking-platform markup) — never through dark-pattern urgency.
4. **One strong signature idea, used once, well** — not a vocabulary applied uniformly to every section regardless of fit (the V2 mistake).
5. **Photography-led.** Real, specific, well-chosen images carry more of the page than any animation does.
6. Mobile-native (375/768/1024+), accessible (contrast, focus, reduced motion), and within the existing stack — no new frameworks/deps without asking.
7. Stays on-brand: Kame teal + Plus Jakarta Sans remain the identity (per root `DESIGN.md`); any _new_ accent is a durable brand decision we surface to you explicitly, not something a page silently invents.

## 4. Proposed section lineup (vs. what exists today)

| #   | Section                                       | Status                             | Notes                                                                                                                                                                                                   |
| --- | --------------------------------------------- | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Hero — search + mood                          | Evolve from V2                     | Keep search-first; replace the single-trick aperture with real photography + the chosen signature (§5)                                                                                                  |
| 2   | Browse by place                               | Reuse                              | V2's `V2PlacesIndex` works; carry forward, restyle to match new direction                                                                                                                               |
| 3   | Featured stays                                | Reuse                              | `V2StaysRail` logic is sound; restyle cards, keep live data hook                                                                                                                                        |
| 4   | **Parking showcase**                          | Evolve                             | Keep the ticket-stub card (it's genuinely distinctive and product-true) but give it a real section, not an icon+ticket pairing                                                                          |
| 5   | **Developments / buildings showcase**         | **New**                            | Currently missing from every version. Pull from `usePublicDevelopments` / `DevelopmentsListPage` catalog — tower cards with amenities, unit mix, "stay + parking + building pass in one booking" tie-in |
| 6   | **The bundle moment (signature)**             | **New**                            | The one idea that visualizes "one booking covers home, parking, building pass, host chat" — see direction options §5                                                                                    |
| 7   | **Why book direct (trust + differentiation)** | **New**                            | Verified listings/hosts, real reviews, no OTA markup, direct host line — the single highest-leverage addition per research in §2                                                                        |
| 8   | **Guest voice / reviews**                     | **New** (upgrade from 1-line chip) | Real reviews once available; honestly-labeled sample content until then, per `docs/workflow` conventions for unshipped data                                                                             |
| 9   | FAQ (optional, light)                         | New, scoped small                  | 3–4 answers max addressing legitimacy/payment/cancellation — minimal copy, not a wall of text                                                                                                           |
| 10  | Closing search                                | Reuse                              | V2's teal-field closing search works; restyle only                                                                                                                                                      |

## 5. First attempt (rejected 2026-11-04) — "The Ascent"

Kept for the record only — do not rebuild this. Rejected for: a clipped/boxed hero window ("box or square type"), oversized/heavy type throughout, and a guestbook flip animation that read as bad, not elegant. The underlying instinct (one idea per section, not the same trick everywhere) was right; the execution wasn't. §10 replaces this direction entirely.

You asked for fresh thinking, not a pick from a menu of safe options, and for the page to feel genuinely enjoyable to scroll through. Every booking site — Airbnb, Agoda, Kame's own `/`, `/v2`, and `/explore-preview` — opens the same way: a photo behind a search bar. "The Ascent" refuses that opener. Instead of _showing_ a guest a property, the scroll _moves_ them into one, using the one physical ritual every Metro Manila / Cebu condo-tower guest already knows by heart: arriving at the gate, reading the lobby directory, riding the elevator, and stepping out onto a view.

**THESIS.** Scroll is the elevator. The hero doesn't sit still behind a search bar — it _ascends_, and what the guest sees out the window changes as they go up.

**OWN-WORLD.** Kame teal stays the brand anchor. One new accent earns its place here, not as decoration: the backlit **amber of a lobby directory / elevator floor indicator** — the exact color of the indicator numerals you've seen in every Filipino high-rise lobby, used only in that chrome (floor counters, directory digits, the parking ticket stub), never splashed across body content. Charcoal glass + brushed-metal elevator interior for the hero's resting frame. Tabular numerals everywhere a real number appears (floor count, price, rating) — already established by V2's ticket stub, now load-bearing instead of decorative.

**STORY.** Scroll ascends through floors; each floor's "window" opens onto a different real stay (photography, not icons). The counter ticks in sync. Doors open at the top onto a skyline view with the search console waiting — the guest has _arrived_, now they search. Past the hero, the page stops pinning and becomes a normal scroll, but keeps borrowing the building's vocabulary once each, specifically:

- **Browse by place** — unchanged interaction (V2's hover-preview rows work), restyled into the directory's type.
- **Developments/buildings (new)** — a **split-flap directory board** reveal: each development's name/floor-count/unit-mix flips into place like an airport/lobby departure board, not a static card grid.
- **Parking (evolved)** — keep the ticket stub (it's genuinely good and already shipped); add one new beat: the ticket visibly **stamps** into place on scroll.
- **The bundle moment (new signature)** — the stay key card, the parking stub, and the building pass **physically assemble together** once, dramatizing "one booking, three passes" — this is Kame's actual unique mechanism and the honest answer to "why not Airbnb."
- **Why book direct (new)** — calm, confident, no urgency tactics: verified listings, real reviews, no OTA markup, a direct line to the host. Teal, quiet, text-led — deliberately the quietest section on the page, as a trust section should be.
- **Guest voice (new)** — a **guestbook page-turn**: real or honestly-labeled sample reviews turn like physical guestbook pages, not a generic testimonial carousel.
- **Closing search** — the elevator motif returns once, briefly: "Ready to go up?"

**FIRST VIEWPORT.** Dim lobby/gate scene, amber floor counter at rest on "G," headline + search console docked low. The scroll cue _is_ the invitation — no separate "scroll down" chevron needed once the first tick of the counter proves what's about to happen.

**FORM.** Exactly one pinned/scrubbed sequence on the whole page — the hero ascent. Every other section gets its own single authored motion idea (split-flap, stamp, assemble, page-turn) and otherwise scrolls normally. This is the direct fix for `/v2`'s actual flaw: one trick used everywhere, instead of several small, purposeful ones used once each.

**Alternates considered and set aside** (for the record, not reheated as a menu): a "golden-hour skyline photography" mood with no narrative device, and a "keycard/boarding-pass" motif applied to every section — both were weaker on their own than the ascent, which gives the page a reason to animate instead of animating because animation was asked for.

## 6. Animation system

Researched current practice for this kind of pinned/scrubbed scroll storytelling (GSAP + ScrollTrigger is the standard tool for exactly this — pin, scrub, parallax, staggered reveals; see sources below) against what's already in this codebase (`framer-motion` only, no GSAP, no Three.js, no smooth-scroll library).

**Technique catalogue for "The Ascent" (one idea per section, per §5 — not a style repeated everywhere):**

| Section         | Device                                                                                       | Trigger                                                                                                                                                                   |
| --------------- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Hero            | Pinned scroll-scrub: floor counter ticks, window-per-floor crossfades, doors open at the top | `scroll` (scrubbed, pinned once — the research is explicit that pinning more than 1-2 sections per page fights native scroll feel, so this is the _only_ pin on the page) |
| Browse by place | V2's existing hover-preview rows, restyled                                                   | hover / viewport enter                                                                                                                                                    |
| Developments    | Split-flap digit reveal per card                                                             | viewport enter, staggered                                                                                                                                                 |
| Parking         | Ticket "stamps" into place                                                                   | viewport enter                                                                                                                                                            |
| Bundle moment   | Three passes assemble together                                                               | viewport enter, once                                                                                                                                                      |
| Why book direct | Quiet fade/rise only — deliberately the least animated section                               | viewport enter                                                                                                                                                            |
| Guest voice     | Page-turn between reviews                                                                    | interaction (next/prev) + autoplay respecting reduced motion                                                                                                              |
| Closing search  | Short return to the elevator-door motif                                                      | viewport enter                                                                                                                                                            |

Every device above respects `prefers-reduced-motion` (resting-state fallback, no pin, no autoplay) and keeps body copy and interactive controls free of parallax, per the researched do/don't guidance.

**The one real open question: which animation library.** `framer-motion` (already a dependency) can do scroll-scrubbed work — V2's aperture hero proves it — but GSAP + ScrollTrigger (+ optionally Lenis for the smooth-scroll feel that sells an "elevator" ascent) is the more purpose-built, more performant tool for a pinned, multi-stage sequence like the hero. Root `DESIGN.md` explicitly flags new animation dependencies as something to ask about first, not add silently — see §9.

Sources: [GSAP ScrollTrigger pin/scrub/parallax guidance](https://blog.logrocket.com/how-to-use-the-gsap-scrolltrigger-plugin-in-react/) · [Lenis smooth-scroll pairing with GSAP](https://dev.to/schmowser/how-i-revamped-my-homepage-using-scroll-animations-with-gsap-4i2e) · [cinematic scroll-scrubbed hero push-in technique](https://dev.to/uianimation/build-premium-scroll-animations-with-gsap-3kf7) · [accessibility/reduced-motion fallback guidance for pinned sequences](https://claudeskills.info/skill/gsap-animations/)

## 7. Technical approach

- New folder `ui/src/features/guest/marketing/guest-landing-v3/` (mirrors `guest-landing-v2/` structure: `components/`, `data/`, `hooks/`, `lib/`).
- Reuse live hooks as-is: `useV2FeaturedStays` (rename/move if we retire v2), `usePublicParkings`, `usePublicPlaceGroups`, and newly wire `usePublicDevelopments` for the developments section.
- New review route `/v3` → `GuestLandingV3Page`, following the exact pattern `GuestLandingV2Page` uses (keeps the legacy `?property=` redirect, `usePageMeta({ canonicalPath: '/' })`).
- Do not touch `/` until V3 is approved at `/v3`. `/explore-preview` stays untouched per your call — not folded in, not retired.

## 7. Build phases

1. **Tooling lock — done 2026-11-04.** GSAP + ScrollTrigger + Lenis installed; `--marketing-amber` token and DESIGN.md update landed in the same working tree. See §9.
2. **Asset pass.** Source verified stock for hero/developments/parking (clearly labeled as placeholder in code comments and the route guide), ready to swap for real property/tower photography and real reviews later.
3. **Hero ascent sequence.** The highest-risk, highest-payoff piece, built and reviewed before anything else.
4. **Signature bundle section.** The second highest-payoff piece (stay key + parking stub + building pass assembling together).
5. **Remaining reused sections** (places, stays, parking, closing search) restyled into the ascent's directory/elevator type system.
6. **New sections**: developments split-flap showcase, why-book-direct trust block, guestbook reviews, FAQ.
7. **Responsive + motion + a11y pass**: 375/768/1024+, `prefers-reduced-motion`, focus states, contrast, and explicit mobile fallback for the pinned hero (pinning on small/low-power devices needs a resting-state fallback, not a forced scroll-jack).
8. **Doc + skill checklist** (below) before calling it done.
9. **Your review at `/v3`**, side-by-side with `/v2` and live `/`, before anything replaces `/`.

## 8. Docs/skills checklist for execution (per root `CLAUDE.md`)

- `mobile-responsive` skill — every new/changed section (mandatory, UI change in `ui/src/**`), plus explicit low-power/mobile fallback behavior for the pinned hero.
- `route-guides` skill — update `docs/guides/routes/index-landing.md` in the same change describing the new `/v3` route; `/v2` and `/explore-preview` stay documented as-is (untouched per your call).
- `human-copy` skill — all new copy (hero, trust section, FAQ, guestbook).
- `audit-logging` — N/A, no mutation introduced by this page.
- `unsaved-changes-guard` — N/A, no form/save flow.
- `documentation-maintenance` checklist — confirm `docs/architecture/overview.md` doesn't need updates (no new routes outside the guest marketing area; confirm when `/v3` route is added to router).
- Root `DESIGN.md` §2 Color Palette already carries the amber/brass directory-indicator accent and §7 the GSAP/Lenis exception (done 2026-11-04, before the first build commit).

## 9. Decisions already made, and the one still open

Resolved from your last round of answers:

- **Direction:** "The Ascent" (§5), not a pick from the earlier A/B/C menu.
- **New accent color:** approved — a warm amber/brass tone scoped to directory/elevator-indicator chrome only (floor counters, directory digits, the parking ticket). This is a durable `DESIGN.md` addition and ships in the same commit as the first build, per §8. Flag it for a look once built, since "approve in principle" and "approve this exact hex" are different reviews.
- **`/explore-preview`:** left alone — not retired, not folded into V3, not otherwise touched by this work.
- **Content:** proceeds with clearly-labeled verified stock photography and sample reviews for the first pass, since no real property photos or guest reviews were confirmed available. Swap-in path stays open — supplying real photography/reviews later is a straightforward content swap, not a rebuild.

- **Animation tooling:** ~~resolved — add GSAP + ScrollTrigger + Lenis~~ — **reverted 2026-11-04.** The pinned GSAP sequence was the "boxy" hero the user rejected. New direction (§10) needs no pin/scrub at all; back to `framer-motion` only, zero new dependencies.

## 10. Current direction (rev. 2, 2026-11-04) — "Quiet Arrival"

Replaces §5–9 entirely. The content/IA goals in §3–4 still hold (guest-first, show stays + parking + developments, answer "why not Airbnb," mobile-native); only the visual/motion execution changes.

**What was wrong, specifically, and the fix:**

| Complaint                              | Fix                                                                                                                                                                                                                                                                                                                                  |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Hero reads as "a box or square"        | No clip-path window of any kind. Full-bleed photography, uncropped by any frame — the photo _is_ the hero, not a porthole onto one.                                                                                                                                                                                                  |
| "A lot of big text"                    | Drop the page's default headline scale down a tier across every section (no more routine `text-5xl`/`text-6xl`). Smaller eyebrows, lighter weight where the layout allows it, far more negative space. Fewer headline words per section too — most sections get one short line, not a line-and-a-half.                               |
| Guestbook flip animation "sucks, ugly" | No flip/rotateY page-turn, no card-object metaphors anywhere (no split-flap board, no ticket "stamp," no fanned-card assembly). One calm, consistent motion vocabulary for the whole page: fade + small rise on scroll-in, a slow, barely-there image parallax/zoom in the hero. Nothing that looks like a UI trick being performed. |

**Direction:**

- **Palette:** Kame teal + neutral white/charcoal only. The amber/departure-board accent is dropped — it was tied to the rejected elevator concept and isn't worth defending on its own.
- **Hero:** one full-bleed, real-feeling photo (slow Ken Burns zoom, no cropping frame), a short headline (one line, moderate size), the search console docked near the bottom. No pin, no scroll-jacking — the page just scrolls.
- **Browse by place:** keep `/v2`'s elegant hover-preview row pattern (large type-as-navigation rows, cursor-follow photo preview on desktop) — this wasn't part of the complaint and is already quiet and confident.
- **Recommended stays:** keep the clean photo-card rail, unchanged in spirit.
- **Parking:** simplify. Keep the useful real data (tower, level, slot, rate) but drop the perforated-ticket novelty and the "stamp" entrance; plain, quiet cards that fade/rise in like everything else.
- **Developments:** same elegant hover-row pattern as places (not a literal lobby directory board), so the page has one consistent typographic index language instead of two different novelty devices.
- **Why book direct / bundle:** one calm editorial section — short headline, a plain three-item layout (icon + label + one line) stating stay + parking + building pass in one booking. No cards sliding together, no assembly animation.
- **Trust section:** unchanged — this one was never part of the complaint; it's already the quietest section on the page, which is correct.
- **Guest voice:** a single large pull-quote that cross-fades to the next one (opacity/slight-y only, ~600ms), small dot nav, no rotation/flip of any kind. Reads like an editorial pull-quote, not a "review card."
- **FAQ:** unchanged — native `<details>`, already minimal.
- **Closing:** one more full-bleed photo moment with the search console, no "doors" or elevator callback.

**Technical approach:** `framer-motion` only (already installed, already proven). No GSAP, no Lenis, no new dependencies, no new `DESIGN.md` accent. Same file layout convention (`guest-landing-v3/components|data|hooks|lib`), same `/v3` review route, same live data hooks.

**Status 2026-11-04 (rev. 2, built):** rebuilt end to end under `guest-landing-v3/` — `V3Hero`, `V3TypeIndex` (one reusable row-index component reused for both "Browse by place" and "The buildings behind the stays," replacing the two different novelty devices from rev. 1), `V3StaysRail`, `V3ParkingList`, `V3Bundle`, `V3Trust`, `V3GuestVoice`, `V3Faq`, `V3Closing`. All three complaints addressed directly: hero is now a full-bleed photo with no clip-path/frame; headline scale dropped a tier across every section (hero/closing cap out at `text-4xl`, section headings at `text-2xl`–`text-4xl`); the guestbook is a single pull-quote that cross-fades via `AnimatePresence mode="wait"` (opacity + small y only, no `rotateY`/flip). No new dependencies — `framer-motion` only, GSAP/Lenis fully uninstalled.

Verified clean: `bun run type-check`, `bun run lint`, `npx vitest run src/features/guest/marketing` (305 tests passed), `bun run build` (exit 0, `[precache-budget] OK` — `GuestLandingV3Page` lands in the on-demand tier, not shell/host). Spot-checked live at `/v3` via Playwright at 375px and desktop widths: hero/closing search fields no longer truncate ("Search destinations", "Anywhere" both render in full), `V3TypeIndex` rows meet touch-target floor, `V3Bundle`/`V3Closing` render cleanly on phone, no console errors. `V3ParkingList` returns `null` gracefully when local data has no seeded parking inventory — expected, not a bug.

Not yet done: route guide update for `/v3` (next), and this is still a review-only route — `/` has not been swapped.
