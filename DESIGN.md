# DESIGN.md — Kame Homes / Guest Form Management

Plain-text design system for AI coding agents (Google Stitch–compatible). **This file is canonical.** Inspiration catalogs under `.agents/design-md/` never override it.

## 1. Visual Theme & Atmosphere

- **Product:** Multi-tenant property / parking / guest booking platform (Kame Homes). Trust-first guest flows + dense operational admin.
- **Mood:** Calm hospitality teal, clean surfaces, confident hierarchy — not playful startup purple, not brutalist, not newspaper editorial.
- **Density:** Guest/marketing = generous whitespace. Dashboard (`/org/...`, bookings) = denser, scan-friendly tables and panels.
- **Theme:** Light-first; dark tokens exist in CSS — if you touch dark variants, update every surface in the change.
- **Copy:** Minimal. Labels and primary actions only unless the user asks for more (`minimal-ui-copy` skill).

## 2. Color Palette & Roles

Source of truth: `ui/src/index.css` HSL tokens (no raw hex in components).

| Role                  | Token                  | Approx (light)       | Use                           |
| --------------------- | ---------------------- | -------------------- | ----------------------------- |
| Canvas                | `--background`         | white                | Page background               |
| Ink                   | `--foreground`         | near-black blue-gray | Body text                     |
| Brand                 | `--primary`            | teal `168 65% 40%`   | Accents, focus ring, icons    |
| Brand fill with text  | `--primary-strong`     | teal `168 65% 31%`   | Fills behind white labels     |
| Brand text on primary | `--primary-foreground` | white                | Labels on `bg-primary-strong` |

Fills that carry white text (buttons, badges, active pills, chips) use `bg-primary-strong`,
never `bg-primary`. `brandColor.ts` derives it per tenant brand color: same hue/saturation,
darkened only until white text reaches 4.5:1. The CTA `--brand-gradient` follows the same
rule. `src/lib/theme/textOnBrandFill.test.ts` fails on new `bg-primary` + white text pairs.
| Muted | `--muted` / `--muted-foreground` | cool gray | Secondary surfaces / meta text |
| Border | `--border` / `--input` | light gray | Dividers, inputs |
| Danger | `--destructive` | red | Destructive actions / errors |
| Success | `--success` | teal-aligned | Positive states |
| Warning | `--warning` | amber | Caution |
| Radius | `--radius` | `0.75rem` | Default control radius |

**Do not** introduce purple-indigo gradients, terracotta-on-cream “AI default” themes, or neon glow stacks.

## 3. Typography Rules

| Role      | Family                              | Notes                                   |
| --------- | ----------------------------------- | --------------------------------------- |
| UI / body | **Plus Jakarta Sans** (`font-sans`) | Configured in `ui/tailwind.config.js`   |
| Mono      | system / existing code fonts        | Edge/debug only — not marketing display |

Hierarchy via shared utilities in `ui/src/index.css` (not one-off `text-xl` / `max-sm:[1.65rem]` bumps). Prefer weight/size contrast over a second display family.

**Admin / dashboard (phone density — 4af):** use the token classes, not raw sizes:

| Role                   | Token                                           | Phone                                             |
| ---------------------- | ----------------------------------------------- | ------------------------------------------------- |
| Page / hero title      | `text-admin-page-title`                         | 18px (`text-lg`)                                  |
| Section / group        | `text-section-title`                            | 14px (`text-sm`)                                  |
| Card title             | `text-card-title`                               | 14px phone → 16px `sm+`                           |
| Body / UI              | `text-sm` / `text-ui`                           | 14px                                              |
| KPI value              | `text-stat-value`                               | 16px **bold** (`font-bold`)                       |
| List amount            | `text-list-amount`                              | 15px                                              |
| Meta / caption         | `text-xs` / `text-caption`                      | 12px                                              |
| Settings field label   | `settings-field-label`                          | 12px muted → 14px `sm+`                           |
| Settings secondary CTA | `settings-action` (+ `size="sm"`)               | visual `h-8` + hit pad (not `min-h-[44px]`)       |
| Hero icon action       | `mobile-hero-action` / `MobileHeroActionButton` | 36px visual (`size-9`) + hit pad; sticky `size-8` |

Settings surfaces (org / property / parking) must use `settings-action` for Manage / Customize / Test / Archive-style secondary actions so they match Location “Manage”, not full-width default `h-10` buttons. **Never** put `min-h-[44px]` on the visible chrome of `.settings-action` — that cancelled the density pass; hit size comes from the invisible pad only.

Teal hero trailing icons must use `MobileHeroActionButton` (never raw `size-11` circles) so Bookings / Inbox / Pricing / Settings stay even.

Canonical table: `.cursor/rules/mobile-responsive.mdc` §4. Marketing display heroes may stay large; do not apply that display scale to admin chrome.

**`cn()` / `tailwind-merge`:** custom type tokens are named `text-*` (e.g. `text-stat-value`). Default `twMerge` treats those as text-color utilities and can drop them when a color class follows — wiping size/weight. `ui/src/lib/utils.ts` registers the type-scale tokens so they compose with colors. Always pass color overrides _after_ the token via `cn('text-stat-value', 'text-emerald-600')`, never replace the token with a color-only class.

Guest heroes may use larger tracking-tight headlines; admin stays tighter and quieter.

## 4. Component Stylings

- **Primitives:** shadcn/radix under `ui/src/components/ui/**` — extend, don’t fork.
- **Buttons:** Primary = solid teal; secondary/ghost for quieter actions. Mobile CTAs use existing `mobile-*` utility classes in `index.css` where present.
- **Inputs:** Border token, clear focus ring (`--ring` = primary). 44×44px touch targets on guest/mobile.
- **Cards:** Use only when they contain interaction or a clear grouped control. Prefer flat sections on marketing heroes.
- **Feedback:** Sonner toasts; inline errors only on failure/validation.

## 5. Layout Principles

- Path alias `@/` → `ui/src/`. Feature folders: `features/guest/**`, `features/dashboard/**`.
- Marketing: one composition in the first viewport; brand-forward on branded pages; full-bleed heroes when the surface is promotional.
- Admin: shell + content; tables and filters over decorative chrome.
- Spacing: Tailwind scale; avoid arbitrary one-off spacing unless matching an existing pattern nearby.

## 6. Depth & Elevation

- Soft elevation tokens (`--shadow-elevated`, `--shadow-soft`) — subtle, not multi-layer neon.
- Prefer border + surface separation over heavy shadows.
- Brand gradient (`--brand-gradient`) sparingly for hero bands / emphasis — not every card.

## 7. Do's and Don'ts

**Do**

- Reuse tokens and shadcn primitives
- Match nearby screens in the same feature
- Keep guest flows mobile-first (375 / 768 / 1024)
- Invoke `design-taste-frontend` / `impeccable` for craft elevation after structure is correct

**Don't**

- Drop in another brand’s DESIGN.md palette (Airbnb, Linear, …) as production tokens
- Add explanatory microcopy, subtitle essays, or tip callouts unless asked
- Use Next.js / Framer Motion / new design deps without asking
- Invent a second icon set — Lucide only

## 8. Responsive Behavior

- Breakpoints: Tailwind defaults; verify 375 / 768 / 1024+
- Touch: ≥44×44px interactive targets on guest and mobile chrome
- Collapse complex filter/toolbars into sheets on small screens (follow existing listing patterns)

## 9. Agent Prompt Guide

Quick anchors:

- Primary teal ≈ `hsl(168 65% 40%)`
- Font: Plus Jakarta Sans
- Stack: Vite + React + Tailwind + shadcn
- Docs: `docs/PROJECT.md`, route guides under `docs/guides/routes/`

Suggested prompts:

- “Implement this screen per root `DESIGN.md` and existing `ui/src/components/ui` primitives.”
- “Elevate craft with `design-taste-frontend` but keep Kame teal tokens.”
- “Use `.agents/design-md/linear/DESIGN.md` only for density inspiration; do not copy purple accents.”

## Related tooling

| Tool                | Path / skill                                                              |
| ------------------- | ------------------------------------------------------------------------- |
| This skill          | `design-md`                                                               |
| Taste Skill         | `design-taste-frontend`, `stitch-design-taste`, … under `.agents/skills/` |
| Impeccable          | `.agents/skills/impeccable`                                               |
| Inspiration catalog | `.agents/design-md/README.md`                                             |
| Setup               | `bun run setup:design-md`                                                 |
