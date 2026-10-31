---
name: tanstack-table
description: Admin data tables — filters, pagination, responsive columns, row actions. Use with bookings-table skill for list pages (bookings, finance, team, maintenance).
---

# Tables (admin)

GFM uses custom table markup + Tailwind (not always TanStack Table library). Follow established list patterns.

## Bookings list (reference)

- `BookingTable.tsx`, `BookingsSummaryCards.tsx`
- Hook: `useBookings.ts` — server pagination via `list-bookings`
- Skill: `bookings-table`

## Patterns

1. **Wrapper:** `overflow-x-auto rounded-xl` around `<table className="w-full min-w-[600px]">`
2. **Hide columns** on small breakpoints (`hidden md:table-cell`)
3. **Row actions:** icon buttons `min-w-[44px] min-h-[44px]`, `aria-label`
4. **Filters:** horizontal scroll strip on mobile — `overflow-x-auto`
5. **Loading:** skeleton rows or `AdminSkeletons`
6. **Empty:** icon + one short line

## Toolbar

`AdminListToolbar.tsx` — search, filters, view toggle patterns.

## Finance / maintenance / team

Reuse filter chip + table density from finance ledger and team member tabs.

## Rules

- `mobile-responsive.mdc` §5 Tables
- `components.mdc`
- `ui-minimal-copy.mdc` — no column description essays

## Query integration

Table state (page, sort, filters) drives TanStack Query key — see `useBookings` `BookingsQuery` type.
