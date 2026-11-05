---
name: skeleton-loaders
description: >-
  Checklist for accurate loading states across dashboard and guest UI. REQUIRED
  whenever adding or changing a page, section, card, table, modal, editor or
  async action: render fixed labels, titles, descriptions, tabs, column headers
  and known icons immediately, and skeleton only async values, rows, media,
  charts or permission-gated actions. Mirrors always-on Cursor rule
  skeleton-loaders.mdc.
---

# Skeleton loaders — static text first, skeletons only for async

**Non-negotiable:** every loading state must mirror the final layout and render
all fixed content immediately. A skeleton is only for something that is actually
waiting on data, a mutation, permissions, media, or a route chunk.

Cursor always-on: **`.cursor/rules/skeleton-loaders.mdc`**.
Architecture + route map: **`docs/architecture/skeleton-loaders.md`**.

## When this applies

Any change that adds or changes:

- a route, page, tab, section, card, table, list, editor, sheet or modal;
- an async query/mutation and its loading state;
- a skeleton component or a `isLoading` branch;
- a stat/KPI card, card header, tab row, table header or filter bar.

Skip only pure backend work with no UI, or copy/CSS that does not touch loading.

## Mandatory classification

Before writing the skeleton, list each element and classify it.

| Element                                                                  | Loading treatment                                    |
| ------------------------------------------------------------------------ | ---------------------------------------------------- |
| Page title / subtitle / hero chrome                                      | Real text                                            |
| Card / section title, description prefix                                 | Real text                                            |
| Stat card label, known icon, trend caption (`vs last period`)            | Real text/icon                                       |
| Tab labels, nav labels, column headers, legend labels                    | Real text                                            |
| Field label, helper copy, button label, empty-state copy                 | Real text                                            |
| Known date/month/day number, fixed static list count                     | Real text                                            |
| Stat value, delta, async count, amount, name, email, status              | Skeleton                                             |
| Async rows/cards/messages/timeline clips                                 | Skeleton                                             |
| Chart plot, donut, calendar body, media preview                          | Skeleton                                             |
| Action visible only after data/permissions resolve (Edit/Publish/Invite) | Skeleton or hide                                     |
| Dynamic range inside a description (`Reminders · May 1–31`)              | Static prefix + skeleton range, or skeleton the line |

If a text string exists in code, it should be on screen during loading.

## How to implement

### Stat / KPI cards

Use the `StatCardSkeleton` props (or `AdminMetricCardSkeleton` re-export):

```tsx
<AdminMetricCardSkeleton
  title="Total Revenue"
  icon={DollarSign}
  showTrend
  changeLabel="vs last period"
/>
```

- Always pass `title` when the card label is fixed.
- Pass `icon` (and `iconClassName` / `iconBgClassName` when the real card colors
  the icon well).
- Pass `changeLabel` when the real card shows a fixed caption.
- Pass `footer` for fixed chips, or `showStatusFooter` when the real card has a
  fixed status row.
- Values and trend deltas stay skeletons.

### Card headers

Use the real header title/icon and skeleton only the action that needs data:

```tsx
<AdminSurfaceCardHeader
  icon={CalendarDays}
  title="Calendar"
  action={<Skeleton className="h-9 w-36" />}
/>
```

For dashboard card headers built from `DashboardChartCardHeaderSkeleton`, pass
`title`, `icon` and any static `description`. Leave the description as a
skeleton bar only when it concatenates a dynamic range.

### Tables, tabs, nav

- Render real column labels in the skeleton header row.
- Render real tab/nav labels; skeleton the sliding pill/track animation chrome.
- Body rows stay skeletons.

### Dates and calendars

- Render the real month label and in-month day numbers.
- Keep only prices, counts, occupied/stay bars and other data cells as skeletons.
- Outside-month cells stay blank, as in the real calendar.

### Editors / builders

- Top bar back label and tab name are real text until the item name resolves.
- Rail labels (Templates, Media, Text, Edit, Style, AI…) are real text.
- Canvas/media/timeline/panel content is skeleton.
- Mobile dock labels are real text.

### State-aware variants

Choose the skeleton from the real state, not a generic page:

- `?view=table|card|calendar` → matching ledger/list shape.
- selected tab / default tab.
- empty vs data state.
- permission-gated cards (`finance:view`, `maintenance:view`).
- `?view=themes`, `?tab=generate`, `?item=` for Marketing.
- settings section count and page-specific card counts.

## Definition of done

- [ ] Route skeleton renders the same page chrome (title, subtitle, actions).
- [ ] Page-level loading keeps the header; only the data region swaps.
- [ ] Every fixed label/title/subtitle/description/tab/column/legend is real text.
- [ ] Every fixed icon and known date/month/day is real.
- [ ] Stat cards pass `title` + `icon` (+ `changeLabel`/`footer` when fixed).
- [ ] Skeleton shape matches at 375 / 768 / 1024+ and the default view.
- [ ] Cached data is not replaced by a skeleton on refetch.
- [ ] `docs/architecture/skeleton-loaders.md` updated if a module/route map changed.
- [ ] Route guide Loading row updated when page behavior changed.

## Verification

Run the normal gate (`bun run type-check`, tests, build) and inspect the loading
state at 375 / 768 / 1024 with a slow network or by temporarily delaying the
query. Check for:

- labels that flash from a gray bar to text (not allowed);
- card heights that jump when data lands;
- desktop-only cards rendered in a mobile skeleton (or vice versa);
- static headers/tabs disappearing while the body loads.

## Related

- Rule: **`.cursor/rules/skeleton-loaders.mdc`**
- Architecture: **`docs/architecture/skeleton-loaders.md`**
- UI gate: **`mobile-responsive`** skill · **`mobile-native-ui.mdc`**
- Docs: **`documentation-maintenance`** · **`route-guides`**
