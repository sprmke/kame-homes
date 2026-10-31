---
title: 'Services Coming Soon Implementation Plan'
status: archived
tags: [superpowers, archive]
updated: 2026-08-02
---

# Services Coming Soon Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a polished public `/services` listing route whose search-led shell matches Properties and Developments while its content announces that services are coming soon.

**Architecture:** Register `ServicesPage` in the existing marketing route tree and opt `/services` into the shared listing-search defaults and hero-to-nav morph. Keep the page self-contained because it has no data, state, API, or reusable business behavior; render a semantic central message with decorative Framer Motion category chips.

**Tech Stack:** Vite, React, TypeScript, React Router 6, Tailwind CSS, Framer Motion, Lucide React.

## Global Constraints

- Use the existing `MarketingLayoutShell`, `ListingHeroSearch`, semantic theme tokens, and Plus Jakarta Sans.
- Support light and dark themes and widths 375 px, 768 px, 1024 px, and 1440 px.
- Respect `prefers-reduced-motion` through Framer Motion's `useReducedMotion`.
- Add no packages, backend calls, forms, countdowns, or fake bookable inventory.
- Keep copy to `Services`, `Coming Soon`, and one short supporting line.
- Do not commit unless the user explicitly asks.

---

## File Map

- Create `ui/src/features/guest/marketing/pages/ServicesPage.tsx` — listing hero plus coming-soon constellation.
- Modify `ui/src/features/guest/marketing/routes/index.tsx` — public route registration.
- Modify `ui/src/features/guest/marketing/shared/lib/listingSearchDefaultLocation.ts` — Services search default.
- Modify `ui/src/features/guest/marketing/shared/lib/listingScrollSearchPaths.ts` — hero-to-nav morph configuration.
- Create [[services|Services (guest marketing) — operator guide]] — route behavior and implementation map.
- Modify [[guides/routes/README|Route-based operator guides]] — public route index.
- Modify [[PROJECT|Guest Form Management — Project Documentation]] — current route inventory.
- Modify [[project-structure|UI project structure]] — marketing module route list.

### Task 1: Route and listing-search integration

**Files:**

- Modify: `ui/src/features/guest/marketing/routes/index.tsx`
- Modify: `ui/src/features/guest/marketing/shared/lib/listingSearchDefaultLocation.ts`
- Modify: `ui/src/features/guest/marketing/shared/lib/listingScrollSearchPaths.ts`
- Create: `ui/src/features/guest/marketing/pages/ServicesPage.tsx`

**Interfaces:**

- Consumes: `ListingHeroSearch({ redirectTo?: string })`, `MarketingLayoutShell`.
- Produces: named component `ServicesPage(): JSX.Element` and route `/services`.

- [ ] **Step 1: Add the route import and registration before the page exists**

Add:

```tsx
import { ServicesPage } from '@/features/guest/marketing/pages/ServicesPage';
```

Register inside the `MarketingLayoutShell` route:

```tsx
<Route path="services" element={<ServicesPage />} />
```

- [ ] **Step 2: Run the type-check and confirm the missing page fails**

Run: `bun run type-check`

Expected: FAIL with `Cannot find module '@/features/guest/marketing/pages/ServicesPage'`.

- [ ] **Step 3: Add Services to the shared listing-search configuration**

In `listingSearchDefaultLocation.ts`, add:

```ts
if (pathname === '/services') return 'Services';
```

In `LISTING_SEARCH_PATHS`, add:

```ts
'/services': { redirectTo: '/services' },
```

- [ ] **Step 4: Create the self-contained Services page**

Create `ServicesPage.tsx` with:

```tsx
import { motion, useReducedMotion } from 'framer-motion';
import { CarFront, ChefHat, MapPinned, Sparkles } from 'lucide-react';

import { ListingHeroSearch } from '@/features/guest/marketing/shared/components/ListingHeroSearch';

const servicePreviews = [
  { label: 'Airport pickup', icon: CarFront, position: 'left-2 top-8 sm:left-[8%] sm:top-12' },
  { label: 'Prepared meals', icon: ChefHat, position: 'right-1 top-4 sm:right-[9%] sm:top-10' },
  {
    label: 'Local experiences',
    icon: MapPinned,
    position: 'bottom-5 left-1 sm:bottom-10 sm:left-[14%]',
  },
  {
    label: 'Stay essentials',
    icon: Sparkles,
    position: 'bottom-2 right-1 sm:bottom-8 sm:right-[13%]',
  },
] as const;

export function ServicesPage() {
  const reduceMotion = useReducedMotion();

  return (
    <div className="bg-background min-h-screen">
      <section className="border-border bg-background border-b pt-20">
        <div className="container mx-auto px-4 py-6 sm:px-6 lg:px-8">
          <ListingHeroSearch redirectTo="/services" />
        </div>
      </section>

      <main className="relative isolate flex min-h-[34rem] items-center overflow-hidden px-4 py-16 sm:min-h-[40rem] sm:px-6 lg:px-8">
        <div
          className="bg-primary/10 pointer-events-none absolute left-1/2 top-1/2 -z-10 h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl sm:h-[30rem] sm:w-[30rem]"
          aria-hidden
        />
        <div
          className="border-primary/10 pointer-events-none absolute left-1/2 top-1/2 -z-10 h-[22rem] w-[22rem] -translate-x-1/2 -translate-y-1/2 rounded-full border sm:h-[34rem] sm:w-[34rem]"
          aria-hidden
        />

        <div className="relative mx-auto h-[28rem] w-full max-w-5xl sm:h-[32rem]">
          {servicePreviews.map(({ label, icon: Icon, position }, index) => (
            <motion.div
              key={label}
              className={`border-border bg-card/90 text-card-foreground absolute ${position} flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold shadow-lg backdrop-blur sm:px-4 sm:py-3 sm:text-sm`}
              initial={reduceMotion ? false : { opacity: 0, scale: 0.85, y: 12 }}
              animate={
                reduceMotion
                  ? { opacity: 1, scale: 1, y: 0 }
                  : { opacity: 1, scale: 1, y: [0, -5, 0] }
              }
              whileHover={reduceMotion ? undefined : { y: -7, scale: 1.03 }}
              transition={{
                opacity: { delay: 0.18 + index * 0.1, duration: 0.45 },
                scale: { delay: 0.18 + index * 0.1, duration: 0.45 },
                y: {
                  delay: 0.7 + index * 0.15,
                  duration: 3.8 + index * 0.35,
                  repeat: Number.POSITIVE_INFINITY,
                  ease: 'easeInOut',
                },
              }}
              aria-hidden
            >
              <Icon className="text-primary h-4 w-4" />
              {label}
            </motion.div>
          ))}

          <motion.section
            className="absolute left-1/2 top-1/2 w-[min(100%,32rem)] -translate-x-1/2 -translate-y-1/2 text-center"
            initial={reduceMotion ? false : { opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55 }}
            aria-labelledby="services-title"
          >
            <span className="text-primary text-xs font-bold uppercase tracking-[0.28em]">
              Services
            </span>
            <h1
              id="services-title"
              className="text-foreground mt-4 text-4xl font-bold tracking-tight sm:text-6xl"
            >
              Coming Soon
            </h1>
            <p className="text-muted-foreground mx-auto mt-4 max-w-sm text-sm leading-6 sm:text-base">
              Thoughtful extras for every part of your stay.
            </p>
          </motion.section>
        </div>
      </main>
    </div>
  );
}
```

- [ ] **Step 5: Run focused static verification**

Run: `bun run type-check && bun run lint`

Expected: both commands exit 0 with no new errors.

### Task 2: Route documentation

**Files:**

- Create: [[services|Services (guest marketing) — operator guide]]
- Modify: [[guides/routes/README|Route-based operator guides]]
- Modify: [[PROJECT|Guest Form Management — Project Documentation]]
- Modify: [[project-structure|UI project structure]]

**Interfaces:**

- Consumes: shipped `/services` behavior from Task 1.
- Produces: current route inventory and operator reference.

- [ ] **Step 1: Add the route guide**

Create `services.md` documenting:

```markdown
# Services (guest marketing) — operator guide

Route: `/services`

> **Status:** Documented — UI-only coming-soon page.

## Overview

Public preview for future guest services. Uses `MarketingLayoutShell` and the same listing search and scroll morph as `/properties` and `/developments`.

## Behavior

- Search submits back to `/services` with the shared listing query parameters.
- No filters, inventory, booking actions, API calls, or persistence.
- Service chips are decorative previews and are not interactive.
- Motion respects the user's reduced-motion preference.

## Implementation map

| Concern      | Path                                                                     |
| ------------ | ------------------------------------------------------------------------ |
| Page         | `ui/src/features/guest/marketing/pages/ServicesPage.tsx`                 |
| Route        | `ui/src/features/guest/marketing/routes/index.tsx`                       |
| Search morph | `ui/src/features/guest/marketing/shared/lib/listingScrollSearchPaths.ts` |

## Related docs

- [Properties](./properties.md)
- [Developments](./developments.md)
- [Route index](./README.md)
```

- [ ] **Step 2: Update route indexes**

Add `/services` with guide `services.md` and status `Documented — UI-only coming soon` to the public marketing table in [[guides/routes/README|Route-based operator guides]].

Add `/services`, `ServicesPage`, public access, and a UI-only description to the Routes table in [[PROJECT|Guest Form Management — Project Documentation]].

Extend the marketing module route list in [[project-structure|UI project structure]] to include `/services`.

- [ ] **Step 3: Check documentation references**

Run:

```bash
rg -n "/services|ServicesPage" docs/guides/routes/services.md docs/guides/routes/README.md docs/PROJECT.md docs/archive/reference/project-structure.md
```

Expected: all four documentation locations report the new route.

### Task 3: Production and responsive verification

**Files:**

- Verify only; fix Task 1 or Task 2 files if a check exposes an issue.

**Interfaces:**

- Consumes: complete `/services` route and documentation.
- Produces: verified production-ready change.

- [ ] **Step 1: Run the production checks**

Run:

```bash
bun run type-check && bun run lint && bun run build
```

Expected: all commands exit 0.

- [ ] **Step 2: Check IDE diagnostics**

Read diagnostics for:

```text
ui/src/features/guest/marketing/pages/ServicesPage.tsx
ui/src/features/guest/marketing/routes/index.tsx
ui/src/features/guest/marketing/shared/lib/listingSearchDefaultLocation.ts
ui/src/features/guest/marketing/shared/lib/listingScrollSearchPaths.ts
```

Expected: no new diagnostics.

- [ ] **Step 3: Verify in the browser**

Open `/services` and check 375 px, 768 px, 1024 px, and 1440 px in both light and dark themes.

Expected:

- shared navigation, listing search, coming-soon constellation, and footer render;
- no horizontal overflow or clipped central copy;
- service chips do not suggest click behavior;
- scrolling morphs the hero search into the fixed navigation;
- reduced-motion emulation removes entrance movement;
- search remains keyboard accessible.
