---
name: bookings-table
description: Patterns for the /bookings admin list table using shadcn Table primitives + TanStack Query. Use when building the booking list, adding columns, sorting, filtering, or row actions.
---

# Bookings table skill

Practical patterns for the `/bookings` list in `ui/src/features/dashboard/bookings/`. See the `admin-dashboard` skill for the surrounding page layout.

## Stack decision

- **Rendering**: shadcn `Table` primitives already present in `ui/src/components/ui/` (or add them — they're ~100 lines of Tailwind).
- **Headless library (optional)**: TanStack Table v8 is welcome if filtering/sorting complexity grows. For the initial list, **server-side** sort/filter/pagination is fine and a TanStack-free implementation is the default.
- **Data**: TanStack Query v5 via `useBookings({ search, status, sort, page, limit })`.

> Rule: don't pull in TanStack Table just to render a paged list. Introduce it only when we need column resizing, grouping, per-column sort toggles from the UI, or virtualization.

## Column definition pattern

When TanStack Table is not used, keep columns declarative anyway:

```tsx
// ui/src/features/dashboard/bookings/components/BookingTable.tsx
import type { BookingRow } from '@/features/dashboard/bookings/lib/types';

type Column = {
  id: keyof BookingRow | 'actions';
  header: React.ReactNode;
  cell: (row: BookingRow) => React.ReactNode;
  align?: 'left' | 'right';
  className?: string;
};

export const columns: Column[] = [
  {
    id: 'status',
    header: 'Status',
    cell: (r) => <StatusBadge status={r.status} />,
  },
  { id: 'guest', header: 'Guest', cell: (r) => <GuestCell row={r} /> },
  { id: 'dates', header: 'Dates', cell: (r) => <DatesCell row={r} /> },
  {
    id: 'pax',
    header: 'Pax',
    cell: (r) => r.numberOfAdults + (r.numberOfChildren ?? 0),
    align: 'right',
  },
  { id: 'flags', header: '', cell: (r) => <FlagsCell row={r} /> },
  {
    id: 'bookingRate',
    header: 'Amount',
    cell: (r) => <Amount value={r.bookingRate} />,
    align: 'right',
  },
  {
    id: 'createdAt',
    header: 'Created',
    cell: (r) => <RelativeTime value={r.createdAt} />,
  },
  {
    id: 'actions',
    header: '',
    cell: (r) => <RowActions row={r} />,
    align: 'right',
  },
];
```

## Sorting

- Default: `checkInDate ASC, createdAt DESC` (upcoming first).
- Sortable columns: Status, Dates, Amount, Created.
- Click a sortable header → toggle asc/desc → update query → **server-side** sort via `list-bookings?sort=checkInDate:asc`.

## Filtering

Filter bar is a separate component (`BookingFilters.tsx`) that updates URL search params (source of truth) and triggers the query.

| Filter         | Control                           | Query param        |
| -------------- | --------------------------------- | ------------------ |
| Search         | debounced input                   | `q`                |
| Status         | multi-select (statuses w/ badges) | `status=a,b,c`     |
| Check-in range | date range picker                 | `from`, `to`       |
| Has pets       | checkbox                          | `hasPets=true`     |
| Has parking    | checkbox                          | `needParking=true` |
| Test bookings  | checkbox (default unchecked)      | `isTest=true`      |

Keep URL params as the source of truth so back/forward navigation restores filters.

## Pagination

- `page` (1-indexed) + `limit` (default 25).
- Server responds with `{ rows, total }` — UI computes `pageCount = Math.ceil(total/limit)`.
- Show `Showing {start}–{end} of {total}`.

## Row actions menu

Use shadcn `DropdownMenu`:

- **View / Edit** → `/bookings/:id`
- **Cancel booking** → confirmation dialog → `transition-booking` mutation to `CANCELLED` (destructive styling).

Never destructively delete from the table; soft-cancel only (keeps the existing cancel semantics).

## Performance

- Paginate server-side (already stated). Do not fetch all rows.
- When expanding to >500 rows/page, consider virtualization (`@tanstack/react-virtual`) — not before.
- Memoize row components with `React.memo` if profiling shows re-render pressure. Premature optimization otherwise.

## Accessibility

- Table uses real `<table>`, `<thead>`, `<tbody>`, `<th scope="col">`.
- Sortable headers: `<th aria-sort="ascending|descending|none">` with a pressed button inside.
- Row action buttons: `aria-label` per action.
- Status badge text is readable without the color dot (color is decorative).
- Keyboard: Tab into cells, Enter/Space on row action menu.

## Don'ts

- Don't do client-side search over a partial page ("why is it not finding my booking from page 3?").
- Don't stuff 12+ columns; the four most decision-relevant columns win.
- Don't invent local component state for filters — use URL search params.
- Don't skip empty/loading/error states. Cover all three explicitly.
