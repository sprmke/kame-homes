---
title: 'Native mobile brand hero reskin'
status: done
tags: [workflow, planned, mobile, ui]
updated: 2026-08-05
stage: done
kind: plan
---

# Native mobile reskin (brand hero + floating layers)

## Goal

Make property admin on phone/tablet feel native: **brand color on the top third**, **white floating panels overlapping that header**, soft canvas below, pill tab bar already in place. Desktop (`lg+`) unchanged.

## Phase A (shipped)

1. Shared mobile shell chrome — `MobileBrandHero`, `MobileHeroOverlap`, `AdminMobilePage` (`ui/src/components/mobile/`)
2. `AdminLayout` — hide frosted mobile header when a page registers hero ownership via `AdminMobileHeroProvider`; on-primary tenant switcher variant
3. Reskinned **Property Dashboard**, **Bookings list**, **Finance** to use hero + overlap composition
4. CSS token `.mobile-brand-hero` in `ui/src/index.css` (max-lg only)

## Design thesis

- Teal brand hero with first white panel overlapping lower edge (negative margin)
- On-hero: tenant switcher + page title (light-on-primary)
- Below hero: floating toolbars/metrics/lists on soft canvas
- No new fonts or marketing copy; desktop chrome untouched at `lg+`

## Follow-up (later phases)

- Reuse shell on Settings, Templates, Inbox, Maintenance, Team, parking/org variants
- Guest / marketing / portal surfaces (deferred)

## Related

- In-progress tracker: [`../in-progress/mobile-native-redesign.md`](../in-progress/mobile-native-redesign.md)
- Route guides: [`docs/guides/routes/org/property/dashboard.md`](../../guides/routes/org/property/dashboard.md), [`bookings.md`](../../guides/routes/org/property/bookings.md), [`finance.md`](../../guides/routes/org/property/finance.md)
