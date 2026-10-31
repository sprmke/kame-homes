---
title: 'Services Coming Soon — Design'
status: archived
tags: [superpowers, archive]
updated: 2026-08-02
---

# Services Coming Soon — Design

## Goal

Add a public `/services` route that feels consistent with the existing `/properties` and `/developments` listing pages while clearly communicating that service bookings are not available yet.

## Experience

- Reuse `MarketingLayoutShell`, including the fixed marketing navigation, theme controls, account controls, and footer.
- Reuse the listing-style hero search and its scroll-to-navigation morph.
- Replace filters, toolbars, and listing results with one responsive “Service constellation” section.
- Center the hierarchy on `Services` and `Coming Soon`, followed by one short supporting line.
- Surround the message with decorative service-category chips for airport pickup, prepared meals, cleaning, and local experiences.
- Keep category chips non-actionable so they cannot be mistaken for bookable inventory.

## Visual Direction

The page is minimal, refined, and optimistic. It uses semantic theme tokens, a restrained emerald glow, Lucide icons, layered surfaces, and subtle staggered motion. Category chips gently float or lift while preserving a clear central focal point. Motion is disabled or reduced when the user prefers reduced motion.

## Responsive and Accessible Behavior

- Design mobile-first for 375 px, then scale through tablet and desktop breakpoints.
- Keep all text readable in light and dark themes with WCAG AA contrast.
- Decorative icons and chips remain hidden from assistive technology where they add no meaning.
- No horizontal overflow.
- The existing search remains keyboard accessible; the coming-soon region uses semantic headings.

## Architecture

- Add `ServicesPage.tsx` under `ui/src/features/guest/marketing/pages/`.
- Add a focused services component folder only if the page would otherwise become difficult to scan.
- Register `/services` in the existing marketing route tree.
- Add `/services` to listing search defaults and scroll-search configuration so the hero behaves like the other listing roots.
- Use existing Framer Motion and Lucide dependencies; add no packages and no backend calls.

## Documentation

- Add a `/services` route guide under `docs/guides/routes/`.
- Add the route to the route-guide index, project route inventory, and public marketing module map.

## Verification

- Run UI type-check, lint, and production build.
- Verify the route at 375 px, 768 px, 1024 px, and 1440 px.
- Confirm light/dark rendering, reduced-motion behavior, no horizontal overflow, and correct hero-to-nav morph.
