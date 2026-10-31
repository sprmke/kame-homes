---
title: 'Mobile sticky chrome morph'
stage: done
status: done
updated: 2026-08-05
---

# Sticky header morph (safe scroll approach)

## Goal

On `max-lg`, when the user scrolls so the floating toolbar meets the top of the viewport, morph it into a **full-width sticky header** that also brings back the **property switcher + hero actions**, with a smooth ~200–280ms transition. Heavy toolbars collapse to **one primary row + More**. Pages without a float make **switcher + actions** sticky instead.

## Shipped (2026-08-04)

| Piece                                   | Path                                                                                |
| --------------------------------------- | ----------------------------------------------------------------------------------- |
| Pin hook (main scrollport + hysteresis) | `ui/src/hooks/useMobileStickyChrome.ts`                                             |
| Fixed morph bar + More sheet            | `ui/src/components/mobile/MobileStickyChrome.tsx` — brand teal + compact float pill |
| `AdminMobilePage` API                   | `stickyPrimary`, `stickyMore`, sentinels in `MobileBrandHero.tsx`                   |
| Bookings split                          | `BookingsListPage`, `ParkingBookingsPage` — date in sticky row; filters in More     |

## Interaction model

**Rest** — hero + inset float on arc; title/arc parallax via `useMobileHeroCollapseProgress`.

**Pin** — sentinel at float top (or hero chrome when no float) leaves scrollport top → fixed bar (`z-40`) with switcher + actions + compact primary.

**Heavy toolbars** — `stickyPrimary` (one row) + `stickyMore` (bottom sheet via More button).

**No float** — switcher + `heroTrailing` only when pinned.

## Constraints preserved

- Single scrollport (`main`) — no `fillMain` / nested scroll.
- Hero stays in flow (parallax only); sticky is a separate fixed layer.
- Float remains sibling above hero (`z-20`); crossfade via `invisible` while pinned.
- `prefers-reduced-motion`: snap pin/unpin (no morph tween in hook; framer-motion duration 0).

## Out of scope

- Re-sticky of the full brand hero / title band.
- Desktop `lg+` behavior.
- Redesigning filter UX beyond More while pinned.
