---
name: frontend-design
description: Distinctive, production-grade frontend design for the guest form, calendar, success page, and new admin /bookings dashboard. Use when creating or elevating UI in ui/src/**.
---

# Frontend Design Skill

Create **distinctive, production-grade** frontend interfaces. Avoid generic AI aesthetics. Commit to a clear aesthetic direction and execute it with precision.

## Project-specific constraints (read these first)

- **Design system doc**: Root **`DESIGN.md`** is canonical (Stitch-style). Skill `design-md` explains inspiration refs under `.agents/design-md/` — never let those override project tokens.
- **Stack**: Vite + React 18 + React Router 6 + Tailwind CSS + shadcn/radix style primitives + Sonner for toasts + Lucide icons. No Next.js, no framer-motion pre-installed (use CSS or ask before adding the dep).
- **Branding**: Kame Homes, Monaco 2604. The guest-facing surfaces are **trust-first** (payment + ID collection) and mobile-heavy — design accordingly.
- **Theme**: Single light theme today. If you add dark-mode variants, do it for **every component in the change**, not half.
- **Semantic classes**: `bg-background`, `text-foreground`, `text-muted-foreground`, `border-border`, `bg-card` etc. Reach for the shadcn primitives in `ui/src/components/ui/**`; don't duplicate them.
- **Accessibility**: Always WCAG 2.1 AA. See the `accessibility` skill.
- **Copy**: No extra labels, descriptions, or helper text unless the user asks or it is required. See the `minimal-ui-copy` skill and `ui-minimal-copy.mdc` rule.
- **Craft elevation (optional)**: Taste Skill (`design-taste-frontend`, `redesign-existing-projects`) and Impeccable live under `.agents/skills/` — use after structure matches DESIGN.md / existing screens.

## Design thinking (before coding)

- **Purpose** — what does this screen need to accomplish? (e.g. the new `/bookings` list: scan 50+ bookings fast, filter, and drill in.)
- **Tone** — pick one and commit: minimal & refined, editorial, dense-operational (ideal for admin), or playful-guest. Don't mix.
- **Hierarchy** — one primary action per screen, one primary metric per card.
- **Differentiation** — what makes this memorable? One strong idea beats five weak ones.

## Aesthetics guidelines

- **Typography**: Keep to the font families already configured (`ui/tailwind.config.js`). Prefer weight/scale contrast over font switching.
- **Color**: Cohesive palette via tokens. For the new booking-status UI, re-use the calendar color intent (red = review, yellow = waiting, green = ready, orange = SD refund, blue = completed, purple = cancelled) but translate to on-screen colors via tokens — don't hardcode hexes.
- **Motion**: Prefer CSS transitions (`transition-colors`, `duration-200`). Scroll/hover-driven motion only when it clarifies state, never as decoration. Respect `prefers-reduced-motion`.
- **Depth**: Subtle shadows, border tokens, layered surfaces. Avoid neon gradients and glassmorphism unless the brief asks.
- **Density**: Admin pages (`/bookings`, `/bookings/:id`) are allowed to be dense. Guest-facing pages (`/`, `/form`, `/success`) keep generous whitespace on mobile.

**Avoid**: Overused font stacks, clichéd purple gradients, predictable hero sections on the guest form, and cookie-cutter dashboard layouts.

## Patterns to reuse in this repo

- `Input`, `Label`, `Button`, `Checkbox`, `Popover`, `Select` from `ui/src/components/ui/`.
- `cn()` util from `ui/src/utils/helpers.ts` (or `ui/src/lib/utils.ts` — check which exists before adding a new one).
- Existing calendar & form visual language in `ui/src/features/guest/form/` — admin pages should feel like a polished extension, not a different product.

## Where to put new UI

- Guest-facing: `ui/src/features/guest/form/`
- Admin dashboard: `ui/src/features/dashboard/bookings/` (new folder per the new flow plan)
- Shared primitives: `ui/src/components/ui/`
- Cross-feature shared (e.g. `StatusBadge`): `ui/src/components/` (non-`ui/`) — add a folder like `components/booking/` if a family of shared booking widgets emerges.

## Output

Deliver working TSX that is:

- Production-grade and functional
- Accessible (labels, focus states, contrast)
- Visually distinctive and consistent with the existing guest form
- Using existing primitives before adding new ones

When in doubt, ship smaller and more refined rather than bigger and decorated.
