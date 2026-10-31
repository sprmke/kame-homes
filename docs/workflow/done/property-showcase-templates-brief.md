---
title: 'Property Showcase — Templates Brief'
status: done
tags: [workflow, showcase, design]
updated: 2026-08-28
stage: done
kind: reference
---

# Property Showcase — Templates Brief

Locked in Phase 0 for implementation. Keys match `custom_pages.template_key`.

## Decisions (open questions — locked)

| #   | Decision                       | Lock                                                                                                          |
| --- | ------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| 1   | Entitlement `propertyShowcase` | **Growth+** (and higher). Free/Starter: locked gallery card + upgrade CTA.                                    |
| 2   | Permission                     | New leaf **`publicPages.showcase:edit`** (owner/admin/manager defaults).                                      |
| 3   | Deps                           | Add **`lenis`** + **`embla-carousel-react`** (MIT, lazy per showcase route). `framer-motion` already present. |
| 4   | Template count                 | **3** firm: Aurora / Monolith / Editorial.                                                                    |
| 5   | Publish default                | **`published: false`** (Draft) until host toggles.                                                            |
| 6   | Parking                        | **Property-only v1**; parking showcase = later plan.                                                          |
| 7   | Images                         | Slots pick from existing `properties.settings.media` only.                                                    |

## Shared section set (all templates)

Order default (host may reorder / hide in editor):

1. `hero`
2. `gallery`
3. `about`
4. `amenities`
5. `highlights`
6. `location`
7. `testimonials`
8. `houseRules`
9. `cta`

Required always-visible for guest UX when published: `hero`, `cta` (normalize may force these on).

## Template A — `showcase-aurora`

| Aspect                         | Spec                                                                                         |
| ------------------------------ | -------------------------------------------------------------------------------------------- |
| Label                          | Aurora                                                                                       |
| Language                       | Cinematic parallax — full-bleed imagery, layered depth, tracking-tight editorial sans        |
| Palette mode                   | Light canvas; brand teal accents; soft mesh overlay (not purple)                             |
| Display type                   | Plus Jakarta Sans oversized / tracking-tight (Google Fonts: optional **Outfit** for display) |
| Nav                            | Translucent sticky bar + scroll-spy + magnetic links; mobile drawer                          |
| Hero                           | Multi-layer parallax over `ShowcaseCanvas variant="mesh"`; scroll cue                        |
| Signature motion               | Horizontal gallery scroll; sticky section progress rail; hover lift amenities                |
| Footer                         | Minimal: property name, share CTA, legal links                                               |
| Embed/`prefers-reduced-motion` | Static gradient hero; no canvas; no parallax                                                 |

## Template B — `showcase-monolith`

| Aspect               | Spec                                                                                    |
| -------------------- | --------------------------------------------------------------------------------------- |
| Label                | Monolith                                                                                |
| Language             | Brutalist-lux — high contrast, oversized type, visible grid rules, film grain           |
| Palette mode         | Dark-default (ink canvas, bone text); accent = brand primary (teal) — **not** gold neon |
| Display type         | Google Fonts **Instrument Serif** or **Fraunces** for headlines; Plus Jakarta body      |
| Nav                  | Index-number links (`01 Hero`) + hairline grid                                          |
| Hero                 | Monument type over `ShowcaseCanvas variant="grain"`; cursor spotlight (pointer only)    |
| Signature motion     | Scroll-pinned reveals; amenity marquee; animated counters                               |
| Footer               | Grid colophon                                                                           |
| Embed/reduced-motion | No spotlight, no pin scrub; static grain CSS                                            |

## Template C — `showcase-editorial`

| Aspect               | Spec                                                                             |
| -------------------- | -------------------------------------------------------------------------------- |
| Label                | Editorial                                                                        |
| Language             | Warm hospitality magazine — serif display, asymmetric collage, muted grain       |
| Palette mode         | Warm off-white canvas (`background` + soft cream tint via overlay); espresso ink |
| Display type         | Google Fonts **Cormorant Garamond** display; Plus Jakarta body                   |
| Nav                  | “Chapters” labels + soft underline scroll-spy                                    |
| Hero                 | Asymmetric image collage + soft grain canvas @ low opacity; stagger fade-in      |
| Signature motion     | Embla testimonial carousel; map pin pulse; chapter scroll-fade                   |
| Footer               | Magazine colophon + CTA                                                          |
| Embed/reduced-motion | Static collage; carousel becomes snap list                                       |

## Perf / a11y budget

| Metric             | Target                                                                         |
| ------------------ | ------------------------------------------------------------------------------ |
| LCP (4G mid-tier)  | < 2.5s                                                                         |
| CLS                | < 0.1                                                                          |
| Canvas instances   | ≤ 1 per viewport; pause off-screen                                             |
| Motion             | All gated by `prefers-reduced-motion`                                          |
| Embed (`?embed=1`) | No canvas, no heavy parallax/pin                                               |
| A11y               | WCAG 2.1 AA; canvas `aria-hidden`; 44px touch; keyboard nav                    |
| Bundle             | Templates + lenis + embla via lazy `import()` — marketing main chunk unchanged |

## Spike notes

- Aurora mesh canvas + framer `useScroll` parallax validated conceptually; implement in shared `ShowcaseCanvas` with DPR clamp (max 2) and `IntersectionObserver` pause.
- `lenis` + framer: Lenis drives scroll; framer reads `scrollY` / Lenis scroll — disable Lenis when reduced-motion or embed.

Parent plan: [`./property-showcase-landing-pages.md`](./property-showcase-landing-pages.md).
