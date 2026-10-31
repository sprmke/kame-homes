# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primary users are **property hosts / operators** managing a single listing inside a multi-tenant org (and org admins overseeing multiple properties). They open the property dashboard daily on desktop and phone to see performance, clear blockers, and jump into bookings, finance, or maintenance.

Guests use a separate public surface (forms, calendar, stay guide); they are not the dashboard audience.

## Product Purpose

Kame Homes helps hosts run short-term rentals end-to-end: guest intake, booking workflow, Google sync, finance, maintenance reminders, inbox, and marketing — scoped per org and property.

Success for the property dashboard: a host can see **what needs action**, **period performance**, and **money/calendar context** in one scan, then deep-link into the right module.

## Positioning

Multi-tenant property + parking ops with a real booking status machine (documents → check-in → SD refund), not a generic listing CRM. Dashboard home is property-scoped ops + finance, not an owner-only statements portal.

## Operating Context

- Shell: `/org/:orgSlug/property/:propertySlug` under AdminLayout (sidebar desktop, bottom tabs mobile).
- Period filter (`?from` / `?to`) drives KPIs, finance charts, calendar, and related summaries.
- Attention items merge booking/finance server alerts with client chips (rejected external reviews).
- Maintenance reminders live under `/maintenance` with pending/completed + Telegram reminders.
- Light-first admin UI; Asia/Manila dates.

## Capabilities and Constraints

- Stack: Vite + React SPA + Supabase Edge Functions (no Next.js / tRPC).
- Visual system: root `DESIGN.md` (teal brand, Plus Jakarta Sans, shadcn) — dashboard redesign extends this world; it does not rebrand.
- Minimal UI copy unless asked.
- No fabricated revenue, occupancy, or customer claims in demos.

## Brand Commitments

- Product name: **Kame Homes** (guest-form lineage).
- Brand accent: hospitality teal per `DESIGN.md`.
- Lucide icons only.

## Evidence on Hand

- Live property dashboard: `ui/src/features/dashboard/property/pages/DashboardPage.tsx`
- Route guide: `docs/guides/routes/org/property/dashboard.md`
- Maintenance summary API: `maintenance-summary` / `maintenance-items`
- Incumbent screenshot of current dashboard (attention strip + KPI + finance/calendar grid)

## Product Principles

1. **Action before vanity** — blockers and reminders outrank decorative metrics.
2. **One property, one period** — filters and deep links stay scoped and predictable.
3. **Dense but calm** — scan-friendly admin density; no marketing chrome on ops pages.
4. **Truth over demo** — empty and loading states are real product states.

## Accessibility & Inclusion

WCAG-oriented admin UI: ≥44×44px touch targets on mobile, visible focus, labels on icon controls, contrast via theme tokens (light + dark).
