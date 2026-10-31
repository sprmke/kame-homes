---
stage: wont-do
title: 'Dashboard Ground-Up Redesign — Implementation Plan'
status: cancelled
tags: [planning, planned-modules, dashboard, redesign, design-system]
updated: 2026-08-13
---

# Dashboard Ground-Up Redesign

**Decision:** Won't do.

Incremental dashboard polish continues; a dedicated ground-up visual pass (scoped from public pages) is not being pursued.

**Intake:** `docs/workflow/intake/_to-plan.md` — "Do ground up redesign in dashboard UI to not make it look like AI generated app".

## Context

The admin dashboard (`/org/:orgSlug/...`, `/admin/*`) still reads as an "AI-generated admin template" per the project owner, despite multiple prior redesign passes. A codebase audit (three research passes + one verification pass with live greps/reads) found this is **not** a case of unstyled shadcn defaults — a real design system exists (`DESIGN.md` at repo root is canonical; teal brand `hsl(168 65% 40%)`; Plus Jakarta Sans; custom shadcn button/card/badge variants; full light/dark theming). The generic feeling has specific, fixable root causes, ranked:

1. **The KPI card** (`ui/src/components/shared/StatCard.tsx`) — icon in a colored rounded tile + big bold number + emerald/red filled trend pill + hover lift + gradient wash. This is the textbook "AI admin template" composition, reused verbatim across Bookings, Finance, and the property/org dashboard. Verified: exactly 3 consumers (`AdminMetricCard.tsx`, `FinanceSummaryCards.tsx`, `DashboardTrendStatCard.tsx`), all admin-only, zero guest usage — safe to replace outright.
2. **Desktop `lg+` was deliberately left static and flat.** The in-progress mobile-native-redesign effort ([`../in-progress/mobile-native-redesign.md`](../in-progress/mobile-native-redesign.md)) already shipped bottom-nav, sheets, staggered card entrances, and native chrome for the dashboard — but fenced almost all of it to `max-lg` (`ui/src/index.css` lines ~923-949 gate `native-stagger` to `@media (max-width: 1023px)`). Desktop, which is what the owner actually looks at most, never got the upgrade.
3. **Elevation tropes in the shadcn extension layer** — `shadow-glow`/`glow-md`, `gradient-primary`, "soft" variants layered on top of stock shadcn (`ui/tailwind.config.js`, `ui/src/components/ui/button.tsx`).
4. **Zero typographic/density differentiation between admin and public.** Both surfaces share one typeface, one radius (`--radius: 0.75rem`), one shadow scale — nothing in the token layer encodes `DESIGN.md`'s own instruction that admin should be "denser, scan-friendly" and "tighter and quieter" than marketing.
5. **No shared empty-state primitive** — e.g. the Finance empty state is a bare `<p>` inside a panel.

**Reference, not template to copy**: public pages (`GuestHero.tsx`, `AbstractBackground.tsx`, `ListingGallery.tsx`) are the stylistic bar the owner is comparing against, but `DESIGN.md` explicitly wants admin quieter than marketing. This plan is a craft/composition/motion/density upgrade of the admin surface, not a literal transplant of the flashy public aesthetic.

**Locked decisions**:

- Same brand teal (`hsl(168 65% 40%)`) in both surfaces — this redesign changes density, typography, elevation, and motion, not the brand hue.
- **Hard constraint: zero visual/style impact on any public/guest route**, proven by screenshot diff, not by inspection. `--primary`/`--radius`/etc. are shared CSS variables in one `ui/src/index.css` `:root` block and one `ui/tailwind.config.js` today; admin scoping currently exists only by naming convention (`.admin-page-stack`, `.admin-data-table`), with no physical isolation — this plan builds that isolation as its first step.
- The dashboard stays Framer-Motion-free. Framer Motion is used in 62 guest files and zero dashboard files today (dashboard motion is CSS keyframes + `PageTransition.tsx`); this is a clean existing boundary to ratify, not compromise, per `DESIGN.md` §7's caution against spreading Framer Motion further.
- This plan does **not** duplicate or re-specify scope owned elsewhere:
  - [`../in-progress/mobile-native-redesign.md`](../in-progress/mobile-native-redesign.md) owns `max-lg` native-feel behavior (bottom nav, sheets, gestures). This plan extends the same visual/motion language up to `lg+` desktop and must coordinate on shared files (`AdminLayout.tsx`, `index.css`) rather than re-litigate that effort's decisions.
  - [`../wont-do/property-public-pages-shell-redesign.md`](../wont-do/property-public-pages-shell-redesign.md) is a separate, cancelled public-page redesign — not touched here.

**Design skills to use during execution** (verified to exist locally in this repo, not just named in a global list):

- `impeccable` — has `.agents/skills/impeccable/scripts/context.mjs --target <path>` to load `PRODUCT.md` + `DESIGN.md` + surface briefs, and distinguishes refinement vs. redesign mode. Use for the Phase 0 audit/critique. **Caveat**: its redesign mode can overwrite `DESIGN.md` — since root `DESIGN.md` also governs public pages, run it in critique/audit mode only (see G5 below).
- `frontend-design` — project-aware, already references `DESIGN.md` and the admin `/bookings` dashboard directly.
- `redesign-existing-projects`, `high-end-visual-design`, `ui-ux-pro-max` — generic, non-project-aware references; filter every suggestion against `DESIGN.md`'s explicit bans (no purple-indigo gradients, no terracotta-on-cream "AI default" theme, no neon glow, Lucide icons only, no second type family without asking).
- `design-taste-frontend` explicitly excludes dashboards/data tables — **do not use it** for this effort.
- `minimal-ui-copy`, `accessibility`, `route-guides`, `mobile-responsive` — apply during Phase 7 polish.

## Isolation Strategy

Two-channel mechanism, locked before any visual change:

**Channel A (primary) — token cascade via `document.documentElement.dataset.surface = 'admin'`.** Set in an effect inside `AdminLayout.tsx` (shell root `<div>` at line 313), cleared on unmount. New/changed tokens are scoped under `:root[data-surface='admin'] { ... }` (+ a `.dark` variant) in `ui/src/index.css`. Scoping must happen at `<html>`, not a wrapper `<div>`, because Radix Dialog/Popover/DropdownMenu/Select/Tooltip and Sonner all portal to `document.body` outside any layout wrapper — a class-only approach would leave every admin modal, sheet, dropdown, and toast styled with public tokens, an immediately visible bug. Because `ui/tailwind.config.js` derives its entire `borderRadius`/shadow scale from CSS variables, most of the foundation phase (Phase 2) ships as pure variable overrides with **zero component edits and zero public-page risk**.

**Channel B (secondary) — `.admin-shell` class** on the same `AdminLayout.tsx` root `<div>`, used only for structural/layout selectors that need a DOM ancestor rather than a variable (grid rhythm, scroll containers, sidebar geometry). Never used for tokens.

### Guardrails (acceptance criteria for every phase)

- **G1 — Cross-surface census gate.** Before editing any file under `ui/src/components/ui/**` or `ui/src/components/shared/**`, run `grep -rl "<Symbol>" ui/src/features/guest ui/src/layouts ui/src/components/mobile` and record the result. Zero hits → free to change in place. Any hits → never edit the existing default/variant; add a new additive `admin-*` variant and opt in only at admin call sites.
- **G2 — Frozen files list.** `ui/src/components/ui/button.tsx`, `card.tsx`, `badge.tsx`, `input.tsx`, and the base `:root {}` / `.dark {}` token blocks in `ui/src/index.css` — existing values must not change, only additive keys appended.
- **G3 — Additive-only Tailwind.** New keys go under `extend` with an `admin-` prefix (e.g. `boxShadow['admin-raise']`, `keyframes['admin-rise']`). No renaming or removing existing keys until the final cleanup phase.
- **G4 — Screenshot proof, not reasoning.** Every phase checkpoint requires an actual public-page screenshot diff — "I only touched admin files" is not accepted as evidence on its own.
- **G5 — impeccable scoping caveat.** Run impeccable in critique/audit mode only; have it write a **new** `docs/design/DASHBOARD-DESIGN.md` (admin-only appendix) rather than overwrite root `DESIGN.md`. Add a one-line pointer to it from root `DESIGN.md` §1.

## Phase 0 — Audit, Baseline Capture, and Direction Lock (no code)

Produce a written artifact and owner-approved direction before any pixel changes.

- Run `node .agents/skills/impeccable/scripts/context.mjs --target ui/src/features/dashboard/bookings/components/AdminLayout.tsx` and critique four representative `lg+` surfaces: Bookings list, Finance, Property Settings, Org Dashboard.
- Cross-check every recommendation against `DESIGN.md` §2/§7 bans.
- Capture the Playwright baseline screenshot set (full matrix defined in Verification).
- Write `docs/design/DASHBOARD-DESIGN.md`: admin type scale, density scale, elevation ladder, motion vocabulary, metric-band spec (see KPI direction below), empty-state spec, do/don't list.
- Resolve three owner decision gates and record the answers in the doc's "Locked decisions":
  - **(a) Second admin typeface?** Default: stay on Plus Jakarta Sans, differentiate purely by optical treatment (tighter tracking, uppercase overlines, `tabular-nums` on all figures, a compressed size scale) — zero risk, honors `DESIGN.md` §3. Alternative: adopt **Inter Tight** as the admin-only face (already preloaded in `ui/index.html`, zero additional network cost), keeping Plus Jakarta Sans for public — the single strongest lever for visual differentiation, but requires explicit owner sign-off per `DESIGN.md` §7 before Phase 2 proceeds.
  - **(b) Admin radius target** — recommend `0.5rem`, down from the shared `0.75rem` (sharper reads as more operational/precise).
  - **(c) Elevation posture** — recommend border-first with a single soft shadow tier, replacing the current 3-tier `shadow-card`/`card-hover`/`elevated-lg` scale.

**Files touched**: read-only over `ui/src/index.css`, `ui/tailwind.config.js`, `AdminLayout.tsx`, `StatCard.tsx`, `DESIGN.md`. Writes only `docs/design/DASHBOARD-DESIGN.md`.

**Done when**: audit doc merged; baseline screenshots stored; (a)/(b)/(c) answered.

## Phase 1 — Isolation Substrate (zero visual delta)

Stand up the scoping mechanism and prove it changes nothing, so every later phase has a safe blast radius.

- Add the `document.documentElement.dataset.surface = 'admin'` effect + `.admin-shell` class in `AdminLayout.tsx`.
- Add a `:root[data-surface='admin'] { … }` and matching `.dark` block to `ui/src/index.css` that **re-declares current values verbatim** (identity override — no visual change yet).
- Add empty `admin-*` extend keys to `ui/tailwind.config.js`.
- Add the G1-G5 guardrails to `docs/design/DASHBOARD-DESIGN.md`.
- Verify the attribute survives route changes within admin, is removed when navigating to a public route, and is present when a Radix dialog/sheet/toast is open.

**Files touched**: `AdminLayout.tsx`, `ui/src/index.css`, `ui/tailwind.config.js`.

**Done when**: screenshot diff of admin **and** public = 0 changed pixels at 375/768/1440, light + dark. Any diff means the substrate is wrong — fix before Phase 2.

## Phase 2 — Foundation: Typography, Sizing, Color, Elevation, Density

Change token _values_ inside the isolated block — the owner's requested "base styles, fonts & sizing, colors & theme" phase. ~80% of this should be CSS variables, not component edits.

- Set admin `--radius` per the Phase 0 decision; add `--admin-surface-1/2/3` (canvas / panel / raised) and `--admin-rule` (a hairline lighter than `--border`); collapse the shadow ladder to `--admin-raise` + `--admin-overlay`.
- Extend the existing `.text-admin-page-title` utility into a coherent `.text-admin-*` family (section, card, label, metric, meta); set `font-feature-settings: 'tnum' 1, 'cv05' 1` on `[data-surface='admin']`; apply the Phase 0(a) font decision.
- Tighten the admin density scale (`.admin-page-stack`, table row heights, control heights).
- Neutralize `shadow-glow`/`glow-md` and `gradient-primary` **inside admin only** via the token block (never edit the frozen Tailwind keys — G2).

**Files touched**: `ui/src/index.css` (token block + `@layer utilities`), `ui/tailwind.config.js` (additive `admin-*` keys only).

**Done when**: admin looks materially different at rest with **no component file touched**; public diff still 0; both themes verified.

## Phase 3 — Admin Primitive Layer

Build the new component vocabulary in isolation, before touching any page.

**KPI/stat-card replacement (the single most "generic AI dashboard" tell)** — `StatCard.tsx` → new `ui/src/components/admin/AdminMetricBand.tsx`. Kill list: icon-in-colored-rounded-tile, filled emerald/red trend pills, one-bordered-card-per-metric, hover lift + gradient wash overlay. Replacement direction:

- One `.surface-card` band containing N metrics separated by hairline vertical dividers (`divide-x divide-border/60`), not four separate boxes.
- Typographic hierarchy carries the weight: overline label (`text-[11px] font-semibold uppercase tracking-[0.09em] text-muted-foreground`), `tabular-nums` value at weight 600 (not 700), plain-text delta with a small directional glyph in `text-success`/`text-destructive` — the delta number itself stays muted, no filled pill.
- Optional 28px sparkline (recharts, already a dependency) bled to the bottom edge as texture, not a chart widget — no axes/grid/tooltip/dots. Omit entirely when there's no time series; never fake one.
- Interactive metrics get a 2px brand-teal top rule instead of a `ring-2` selection state.
- Hover = background tint only (`hover:bg-muted/40`), no transform, no shadow change.
- First-class empty/zero/loading states in identical geometry — skeleton preserves the band's rules/heights (no layout shift); zero renders as a real `0`, never a dash or hidden cell.

Also build: `AdminEmptyState.tsx` (icon-well or thin line-art mark + one-line headline + optional single action), `AdminSectionHeader.tsx`, `AdminPageHeader.tsx`, `AdminPanel.tsx` (border-first replacement for ad-hoc `.surface-card` usage), `AdminToolbar.tsx`.

Rewire the 3 `StatCard` consumers (`AdminMetricCard.tsx`, `FinanceSummaryCards.tsx`, `DashboardTrendStatCard.tsx`) as thin adapters over `AdminMetricBand`; delete `StatCardGrid`.

**Files touched**: new `ui/src/components/admin/**`; `ui/src/components/shared/StatCard.tsx` (deprecate/remove); the 3 consumer files above.

**Done when**: Bookings + Finance + Org Dashboard KPI rows render the new band and get explicit owner sign-off before it propagates to Phase 6.

## Phase 4 — Shell Restructure (desktop `lg+` only)

The owner's requested "structural change" phase, confined to chrome. Explicitly does **not** touch `max-lg` behavior owned by `mobile-native-redesign.md`.

- `AdminLayout.tsx` + `AdminSectionNavLayout.tsx`: quieter active-pill treatment (currently `bg-primary rounded-xl shadow-sm`); a real desktop top bar (today the `<header>` is `lg:hidden` — desktop has no header at all, page titles float) carrying breadcrumb + workspace context + global actions; a standardized `AdminPageHeader` slot; content-column max-width and gutter rhythm; workspace switcher and account block density.

**Files touched**: `AdminLayout.tsx`, `AdminSectionNavLayout.tsx`, `dashboard/bookings/lib/adminSidebarNav.ts`.

**Done when**: shell reads as distinct product chrome at 1440/1920; `max-lg` screenshots are byte-identical to the Phase 0 baseline (proves no mobile regression).

## Phase 5 — Desktop Motion Parity (CSS only)

Kill the "static desktop / animated mobile" split without importing Framer Motion into the dashboard.

- Lift `native-stagger` out of its `@media (max-width: 1023px)` fence into an unfenced rule, retuned for desktop (shorter/shallower than mobile's entrance — recommend ~0.22s, ~24ms steps, `translateY(6px)`) via an `--admin-stagger-step` variable overridden at `lg+`.
- Add `admin-rise`/`admin-fade` keyframes to `ui/tailwind.config.js`.
- Add restrained desktop-only micro-interactions: table row hover tint, sliding nav pill easing, focus-ring transition, skeleton→content crossfade.
- Do **not** extend `PageTransition.tsx` (Framer) to desktop — add a CSS-only `.admin-page-enter` applied via `key={pathname}` remount instead, keeping the dashboard's zero-Framer-Motion property intact.
- Extend every `prefers-reduced-motion: reduce` block in `ui/src/index.css` to cover the new rules, in the same commit.

**Files touched**: `ui/src/index.css`, `ui/tailwind.config.js`, `AdminLayout.tsx` (swap `PageTransition` for the CSS variant at `lg+`).

**Done when**: desktop page loads/route changes have entrance motion; `prefers-reduced-motion: reduce` produces a fully static UI; `grep -rl framer-motion ui/src/features/dashboard` returns nothing.

## Phase 6 — Page-by-Page Rollout

Apply the Phase 2-5 foundation to actual screens as independent, reviewable checkpoints — not a big-bang change across the dashboard's ~495 `.tsx` files. **Re-enumerate the exact module/page list from `ui/src/features/dashboard/*` at execution time**, since it may have moved; the inventory below is the current shape:

| Slice | Module                               | Pages (representative)                                                                                                                                                                                                                                    |
| ----- | ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 6a    | `property` + `org` (overview)        | `DashboardPage`, `OrgDashboardPage`, `OrgPropertiesPage`, `OrgParkingsPage`, `OrgBookingsPage`, `OrgSelectorPage`                                                                                                                                         |
| 6b    | `bookings` (list + detail)           | `BookingsListPage`, `BookingDetailPage`                                                                                                                                                                                                                   |
| 6c    | `finance`                            | `FinancePage`                                                                                                                                                                                                                                             |
| 6d    | `org` settings + `bookings` settings | `OrgSettingsPage`, `AdminSettingsPage`, `TemplatesPage`, `NotificationsPage`                                                                                                                                                                              |
| 6e    | `maintenance` + `pricing`            | `MaintenancePage`, `PropertyPricingPage`                                                                                                                                                                                                                  |
| 6f    | `inbox`                              | `InboxPage`, `OrgInboxPage`, `PropertyInboxPage`, `ParkingInboxPage`                                                                                                                                                                                      |
| 6g    | `team`                               | `OrgTeamPage`, `PropertyTeamPage`, `ParkingTeamPage`, `AcceptInvitePage`                                                                                                                                                                                  |
| 6h    | `parking`                            | `ParkingDashboardPage`, `ParkingBookingsPage`, `ParkingBookingDetailPage`, `ParkingFinancePage`, `ParkingPricingPage`, `ParkingSettingsPage`, `ParkingNotificationsPage`                                                                                  |
| 6i    | `super-admin`                        | `SuperAdminOverviewPage`, `…Hosts`, `…Properties`, `…Developments`, `…Approvals`, + others                                                                                                                                                                |
| 6j    | `marketing` (studio)                 | `MarketingStudioPage` — **separate risk**: contains the font-picker/design editor that renders guest-facing output; audit before touching. If it previews guest surfaces inline, add an explicit `data-surface="public"` reset on that preview container. |

**Ordering rationale**: 6a-6c first (highest owner-visibility, contains all three `StatCard` consumers), settings/long-tail next, `super-admin` and `marketing` last (lowest traffic, highest file count / highest risk).

**Per-slice checklist (identical every time)**: replace ad-hoc cards with `AdminPanel`/`AdminSectionHeader`; replace bare empty states with `AdminEmptyState`; apply `AdminMetricBand` to any KPI row; expand `.admin-data-table` usage; align skeletons to final geometry; verify light+dark and 375/768/1024/1440.

**Done when**: each slice's screenshots reviewed; no page still imports a removed primitive (`StatCard`, `StatCardGrid`).

## Phase 7 — Copy, Alignment, Responsiveness, Accessibility Polish

The owner's requested "text copy change, alignment, responsiveness" phase.

- Sweep UI copy per the `minimal-ui-copy` skill (strip subtitle essays, tip callouts, redundant helper text).
- Enforce optical alignment (label/value baselines, icon-to-text gaps, table numeric right-alignment + `tabular-nums`).
- Verify the cramped 1024-1279 band (260px sidebar + content is tightest here) and ultrawide layouts.
- Run the `accessibility` skill for contrast on new muted/rule tokens in both themes, focus-visible on all new interactive surfaces, and reduced-motion.
- Update `docs/guides/routes/**` per the `route-guides` skill for any pages whose visible behavior changed.

**Done when**: all breakpoints/themes reviewed; an a11y pass is recorded in this doc.

## Phase 8 — Cleanup and Codification

Prevent regression back to generic.

- Remove now-dead utilities (`shadow-glow*` if unused post-rollout, `StatCardGrid`, orphaned `.surface-card` variants).
- Rename `ui/src/components/shared/` → `ui/src/components/admin/` (it is admin-private in practice — only 2 files, both admin-only).
- Finalize `docs/design/DASHBOARD-DESIGN.md` as the enforced admin reference; link it from root `DESIGN.md` §1; add a pointer from the `frontend-design` and `admin-dashboard` skills.

## Verification

No automated visual regression tooling or test suite exists in this repo — verification is a **recorded manual protocol**, run at every phase checkpoint via the Playwright MCP.

**Baseline capture (Phase 0, before any change)**:

- Viewports: `375×812`, `768×1024`, `1440×900`, `1920×1080`.
- Themes: light and dark.
- **Public control set (the zero-impact tripwire)** — capture all of: guest landing, property detail, calendar, guest form, success page, SD form, pay-parking, search results, guest account (trips/messages/wishlist), one page with an open modal, one page with an open toast.
- **Dashboard set**: one page per Phase 6 slice, plus one open Sheet, one open Dialog, one open DropdownMenu, one Sonner toast.
- Store screenshots with a `phase0-{surface}-{vw}-{theme}.png` naming scheme.

**Per-phase checkpoint**:

1. `bun run type-check` / `bun run lint` / `bun run build` must pass — no new errors.
2. Re-capture the **public control set** at the same matrix and diff against the Phase 0 baseline. **Any non-zero diff on a public surface fails the phase** — it means a shared token or component leaked; do not proceed until fixed.
3. Re-capture the dashboard set; review against `docs/design/DASHBOARD-DESIGN.md`, not against "does it look nicer."
4. Grep assertions: `grep -rl framer-motion ui/src/features/dashboard` → empty from Phase 5 onward; `grep -rn "shadow-glow\|native-icon-tile" ui/src/features/dashboard` → shrinking to zero by Phase 8.
5. Interaction spot-checks: tab through the sidebar and confirm focus rings are visible in both themes; open/close a Sheet on `max-lg` to confirm mobile-native work is untouched; emulate `prefers-reduced-motion: reduce` and confirm all entrance motion stops.
6. Record the checkpoint result (pass/fail + screenshot paths) in this doc's phase section before moving on.

**Phase 1 has the strictest bar**: the diff must be zero on **both** admin and public — it's the only phase where an admin-side pixel change is itself a failure.

## Risks and Open Questions

1. **Second typeface (Phase 0 gate a)** is the single highest-impact differentiator but needs explicit owner sign-off per `DESIGN.md` §7 before Phase 2 starts.
2. **`data-surface` attribute lifetime** — if any public route is ever rendered _inside_ the admin shell (e.g. a live preview iframe in Marketing Studio), admin tokens will bleed into it. Audit `MarketingStudioPage` in Phase 0; if it previews guest surfaces inline, add an explicit `data-surface="public"` reset on that preview container.
3. **`mobile-native-redesign.md` is still in progress** — coordinate before editing `AdminLayout.tsx`/`index.css`, since Phases 1, 4, and 5 of this plan touch files that effort owns.
4. **`marketing` module (slice 6j, 84 files)** produces guest-facing output — treat as its own risk assessment, not a routine rollout slice.

### Critical Files

- `ui/src/index.css` — token blocks (`:root`, `.dark`), `@layer utilities`, `.surface-card`, `native-stagger` fence (~923-949), `.admin-page-stack`, `.text-admin-page-title`, `.admin-data-table`, reduced-motion blocks. Host of the new `:root[data-surface='admin']` block.
- `ui/src/features/dashboard/bookings/components/AdminLayout.tsx` — shell root (line 313: `.admin-shell` + `data-surface` effect), desktop sidebar (316), mobile-only header (398), main content column (410+), active nav pill.
- `ui/src/components/shared/StatCard.tsx` — the primary generic-tell; replaced by `ui/src/components/admin/AdminMetricBand.tsx`. Only 3 consumers, all admin.
- `ui/tailwind.config.js` — `fontFamily`, `fontSize`, `borderRadius` (derived from `--radius`), `keyframes`, `animation`, `boxShadow` (incl. `glow`/`glow-md`). Additive `admin-*` keys only.
- `DESIGN.md` — canonical constraints (palette bans, typography, elevation, Framer-Motion/icon-set rules); gains a pointer to the new `docs/design/DASHBOARD-DESIGN.md`.
- Supporting: `ui/src/features/dashboard/bookings/components/AdminSectionNavLayout.tsx`, `ui/src/components/mobile/PageTransition.tsx`, `ui/src/features/dashboard/bookings/lib/adminSidebarNav.ts`, `ui/src/features/dashboard/finance/components/FinanceSummaryCards.tsx`.
