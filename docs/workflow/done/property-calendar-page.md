---
stage: done
title: 'Property Calendar Page Implementation Plan'
status: done
tags: [superpowers, calendar, properties]
updated: 2026-08-03
kind: plan
---

# Property Calendar Page — Shipped

**Status: Done (2026-08-03)**

### Final product (supersedes dual-view plan)

Property **Calendar** at `/org/:orgSlug/property/:propertySlug/calendar` is a **single unified page** (not Occupancy/Pricing tabs). It combines:

- Nightly rate management (weekday/weekend, overrides, fees sidebar)
- **Booked stays** as primary-colored spanning pills (Airbnb-style), click → guest modal → booking detail
- **Block / unblock** owner-closed nights
- Guest availability enforcement via `get-booked-dates` + overlap checks

Legacy `/pricing` redirects to `/calendar`. Permission gate: **`pricing:view`** (edit: **`pricing:edit`**).

### Design pivot (accepted)

Mid-ship, dual **Occupancy | Pricing** tabs were removed in favor of one pricing grid with booking pills — better UX alignment with Airbnb host calendar. Occupancy-only components (`PropertyCalendarPage`, `PropertyOccupancyCalendarPanel`, `PropertyCalendarViewToggle`) were deleted.

### Task checklist

| Task                             | Status     | Notes                                                                |
| -------------------------------- | ---------- | -------------------------------------------------------------------- |
| 1 Route / nav / permissions      | Done       | Calendar nav + route; `pricing:view` gate (not dual `bookings:view`) |
| 2 Page shell                     | Superseded | `PropertyPricingPage` is the page; no dual-view shell                |
| 3 `property_blocked_dates` + API | Done       | Migration + `propertyBlockedDates.ts` + PATCH                        |
| 4 Guest availability             | Done       | `get-booked-dates` union; submit overlap                             |
| 5 Block/unblock UI               | Done       | Grid legend + modal                                                  |
| 6 Documentation                  | Done       | `docs/guides/routes/org/property/calendar.md`, PROJECT.md            |

### Post-ship polish (same module)

- Overlay spanning pills vertically centered on week rows
- Primary color for all booked pills/cells (status-agnostic)
- Night count derived from stay dates in calendar UI (fixes stale `number_of_nights`)
- `calendarBookings` on `property-pricing` GET for pill/modal data

---

# Property Calendar Page Implementation Plan (original spec)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the property sidebar **Pricing** item with **Calendar**, a single page with **Occupancy** (default) and **Pricing** views — Occupancy reuses the dashboard Name/Price booking calendar; Pricing keeps rate config and adds owner date blocking.

**Architecture:** New `PropertyCalendarPage` shell at `/org/:orgSlug/property/:propertySlug/calendar` with `?view=occupancy|pricing` (default `occupancy`). Redirect legacy `/pricing` → `/calendar?view=pricing`. Occupancy mounts `BookingCalendarView` + `BookingCalendarPillLabelToggle`. Pricing keeps existing pricing components. Owner blocks live in `property_blocked_dates` and fold into `get-booked-dates`, overlap checks, and the pricing calendar legend.

**Tech Stack:** Vite + React 18, React Router 6, TanStack Query, Tailwind/shadcn, Supabase Postgres migrations + Edge Functions (Deno).

## Competitive UX brief — Property Calendar

**Job:** See what’s booked and manage rates / closed nights on one Calendar surface.  
**Role:** Operator (property admin)  
**Surface:** Property admin  
**Commit point:** Saving rates or creating/removing a date block (irreversible for guest availability).

### Airbnb (host calendar)

- Flow: Single **Calendar** — select nights → panel for Available/Blocked + custom price.
- Auth: Host session.
- Mobile: Long-press + swipe range.
- Notable: Blocks and prices share the same selection affordance; blocked nights show a strike-through.

### PMS (host/admin) — Guesty / Hostaway

- Flow: **Calendar** / Multi-calendar as primary nav; drag to **Create manual block** (gray); click nights to change pricing; confirmed stays are inflexible.
- Parallels: One Calendar destination; blocks ≠ bookings; color/legend distinguishes states.
- Differences: Full channel sync / multi-listing — out of scope for Kame v1.

### Adopt for Kame Homes

- Nav label **Calendar** (not Pricing); page title **Calendar**.
- Two explicit views (segmented control / tabs), not one overloaded grid — matches existing Occupancy vs Pricing UIs we already have.
- Default view name: **Occupancy** (Name/Price pill toggle like property dashboard).
- Second view: **Pricing** (current rate calendar + **Block** action on selection).
- Blocks: distinct from Booked; gray/muted legend; fold into public availability.
- Minimal copy (`ui-minimal-copy`); Lucide icons only; mobile-first 44px targets; match admin shell patterns.

### Skip

- Multi-calendar across properties, Smart Pricing, channel sync, Guesty “flexible override” semantics.
- Renaming parking Pricing in this plan (optional follow-up).
- Changing booking-detail **Pricing** workflow tab.

## Global Constraints

- Property scope only (`/org/:orgSlug/property/:propertySlug/…`). Do not rename public guest `/calendar` or `/properties/:slug/calendar`.
- Preserve `pricing:view` / `pricing:edit` permission IDs (no migration of team permission strings). Nav **Calendar** visible when `pricing:view || bookings:view`.
- Route section key becomes `'calendar'`; `PROPERTY_SECTION_VIEW_PERMISSION.calendar` uses a dual-permission check in the route guard (see Task 1).
- Occupancy tab requires `bookings:view`; Pricing tab requires `pricing:view`. If user has only one, hide the other tab and force that view.
- Default `?view=occupancy` when both allowed; if only `pricing:view`, default `pricing`.
- Date blocks: nights as `[start_date, end_date)` (same occupancy convention as bookings). Never delete `guest_submissions` to “block.”
- Blocked nights must disable guest booking via `get-booked-dates` and `checkOverlappingBookings`.
- UI: existing admin tokens/components; no new font families; no purple/cream AI-default aesthetics; `ui-minimal-copy.mdc`.
- Docs: update route guide + [[guides/routes/README|Route-based operator guides]] + [[PROJECT|Guest Form Management — Project Documentation]] in the same change as behavior.
- No production Supabase deploy (`kamewave` unlock required) — local migrations only.
- Do not edit shipped migrations; add a new migration file.
- Commits: conventional messages; no Cursor/AI attribution.

---

## File map

| File                                                                              | Role                                                                             |
| --------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `ui/src/features/dashboard/pricing/pages/PropertyCalendarPage.tsx`                | New shell: header, view switch, tab content                                      |
| `ui/src/features/dashboard/pricing/pages/PropertyPricingPage.tsx`                 | Extract body into reusable content OR render from shell without duplicate header |
| `ui/src/features/dashboard/pricing/components/PropertyCalendarViewToggle.tsx`     | Occupancy / Pricing segmented control                                            |
| `ui/src/features/dashboard/pricing/components/PropertyOccupancyCalendarPanel.tsx` | Occupancy view wiring                                                            |
| `ui/src/features/dashboard/pricing/routes/index.tsx`                              | `calendar` route + `/pricing` redirect                                           |
| `ui/src/features/dashboard/bookings/lib/adminSidebarNav.ts`                       | Label Calendar, href calendar, icon `CalendarDays`                               |
| `ui/src/features/dashboard/team/lib/propertyPermissions.ts`                       | Section `'calendar'`; nav permission map                                         |
| `ui/src/features/dashboard/org/components/RequirePropertyPermission.tsx`          | Dual-permission for calendar                                                     |
| `supabase/migrations/20260801120000_property_blocked_dates.sql`                   | New table                                                                        |
| `supabase/functions/_shared/propertyBlockedDates.ts`                              | Load/save blocked nights                                                         |
| `supabase/functions/_shared/propertyPricing.ts`                                   | Include `blockedDateKeys` in DTO; PATCH block ops                                |
| `supabase/functions/get-booked-dates/index.ts`                                    | Union booking + blocked ranges                                                   |
| `supabase/functions/_shared/databaseService.ts`                                   | Overlap check includes blocks                                                    |
| [[guides/routes/org/property/calendar]]                                           | Renamed/expanded guide                                                           |
| [[guides/routes/org/property/pricing]]                                            | Redirect stub or delete + README update                                          |

---

### Task 1: Route, nav, permissions — Pricing → Calendar

**Files:**

- Modify: `ui/src/features/dashboard/team/lib/propertyPermissions.ts`
- Modify: `ui/src/features/dashboard/org/components/RequirePropertyPermission.tsx`
- Modify: `ui/src/features/dashboard/bookings/lib/adminSidebarNav.ts`
- Modify: `ui/src/features/dashboard/pricing/routes/index.tsx`
- Modify: `ui/src/features/dashboard/routes/index.tsx` (if needed)
- Modify: `ui/src/features/dashboard/org/lib/tenantPaths.ts` (if section union drives types)
- Grep/fix any `'pricing'` section path usages that mean the **page** (not booking workflow pricing)

**Interfaces:**

- Produces: `PropertySection` includes `'calendar'` (remove page-level `'pricing'` section or keep both with redirect). Prefer replace `'pricing'` → `'calendar'` for the property section union.
- Produces: `propertySectionPath(org, slug, 'calendar')` → `/org/.../property/.../calendar`
- Produces: route `path="calendar"` guarded with calendar dual permission; `path="pricing"` redirects to `../calendar?view=pricing`

- [ ] **Step 1: Update `PropertySection` and permission maps**

In `propertyPermissions.ts`:

- Replace `'pricing'` with `'calendar'` in `PropertySection`.
- `PROPERTY_SECTION_VIEW_PERMISSION.calendar` — temporarily set to `'pricing:view'` as the _declared_ map value; actual dual check lives in `RequirePropertyPermission` (document in comment).
- `PROPERTY_NAV_VIEW_PERMISSION`: change key `Pricing` → `Calendar`. For nav filtering, ensure sidebar uses dual check (next step).

- [ ] **Step 2: Dual-permission gate for calendar section**

In `RequirePropertyPermission.tsx`, when `section === 'calendar'`, allow access if `hasPropertyPermission(..., 'pricing:view') || hasPropertyPermission(..., 'bookings:view')`. Otherwise keep existing `PROPERTY_SECTION_VIEW_PERMISSION` lookup.

- [ ] **Step 3: Sidebar**

In `adminSidebarNav.ts` `buildPropertyNavSections`:

- Label: `Calendar`
- `href`: `propertySectionPath(..., 'calendar')`
- Icon: `CalendarDays` (from lucide-react)
- Show item when `pricing:view || bookings:view` (mirror gate)

- [ ] **Step 4: Routes**

```tsx
// pricing/routes/index.tsx
export function pricingPropertyRoute(propertyRoute: PropertyRouteFn): ReactNode {
  return (
    <>
      <Route path="calendar" element={propertyRoute('calendar', <PropertyCalendarPage />)} />
      <Route path="pricing" element={<Navigate to="../calendar?view=pricing" replace />} />
    </>
  );
}
```

Temporarily, if `PropertyCalendarPage` does not exist yet, mount existing `PropertyPricingPage` behind calendar path so the app compiles; Task 2 replaces it.

- [ ] **Step 5: Grep fix**

Update any redirects/links that pointed at section `'pricing'` for this page. Do **not** change booking workflow `'pricing'` content keys.

- [ ] **Step 6: Type-check**

Run: `cd ui && bun run type-check`  
Expected: pass (or only errors fixed in this task).

- [ ] **Step 7: Commit**

```bash
git add ui/src/features/dashboard/team/lib/propertyPermissions.ts \
  ui/src/features/dashboard/org/components/RequirePropertyPermission.tsx \
  ui/src/features/dashboard/bookings/lib/adminSidebarNav.ts \
  ui/src/features/dashboard/pricing/routes/index.tsx
git commit -m "$(cat <<'EOF'
feat: rename property Pricing nav to Calendar route

EOF
)"
```

---

### Task 2: PropertyCalendarPage shell + Occupancy / Pricing views

**Files:**

- Create: `ui/src/features/dashboard/pricing/pages/PropertyCalendarPage.tsx`
- Create: `ui/src/features/dashboard/pricing/components/PropertyCalendarViewToggle.tsx`
- Create: `ui/src/features/dashboard/pricing/components/PropertyOccupancyCalendarPanel.tsx`
- Modify: `ui/src/features/dashboard/pricing/pages/PropertyPricingPage.tsx` — export content without duplicating page chrome when embedded; or rename internal body to `PropertyPricingPanel`
- Modify: routes to use `PropertyCalendarPage`

**Interfaces:**

- Consumes: `BookingCalendarView`, `BookingCalendarPillLabelToggle`, `useBookings`, patterns from `DashboardFinanceCalendarSection`
- Produces: `PropertyCalendarPage` reading `?view=` via `useSearchParams`
- View ids: `'occupancy' | 'pricing'` exactly

**Design (frontend-design + existing admin):**

- Page header title: **Calendar** (`AdminPageHeader`)
- View switch: segmented control matching `BookingViewToggle` density — labels **Occupancy** | **Pricing** only (no subtitles)
- Occupancy: full-width `BookingCalendarView` (not mini); Name/Price toggle in header actions row
- Pricing: existing pricing layout unchanged visually inside the tab
- Mobile: toggle full-width or scrollable strip; 44px min targets

- [ ] **Step 1: View toggle component**

```tsx
export type PropertyCalendarViewId = 'occupancy' | 'pricing';

type Props = {
  value: PropertyCalendarViewId;
  onChange: (v: PropertyCalendarViewId) => void;
  showOccupancy: boolean;
  showPricing: boolean;
};
```

Render only allowed options. Use `role="tablist"` / `aria-selected`.

- [ ] **Step 2: Occupancy panel**

Wire `useBookings` for a wide date window (current month ± buffer, or reuse list defaults with `showCompletedBookings: true` and a generous `from`/`to` like BookingsList calendar view). Include Name/Price toggle state.

Mirror `BookingsListPage` calendar view data loading if clearer than dashboard mini range.

- [ ] **Step 3: Refactor pricing page**

Split so `PropertyPricingPanel` (or keep page component accepting `embedded?: boolean`) omits outer `AdminPageHeader` when used inside Calendar shell. Shell owns the single page title **Calendar**.

- [ ] **Step 4: PropertyCalendarPage**

- Resolve permissions → which tabs visible; sync `?view=` with allowed set
- Render toggle + active panel
- Deep link: `/calendar?view=pricing` opens Pricing

- [ ] **Step 5: Type-check + smoke**

Run: `cd ui && bun run type-check`

- [ ] **Step 6: Commit**

```bash
git commit -m "$(cat <<'EOF'
feat: add Calendar page Occupancy and Pricing views

EOF
)"
```

---

### Task 3: `property_blocked_dates` migration + shared service

**Files:**

- Create: `supabase/migrations/20260801120000_property_blocked_dates.sql`
- Create: `supabase/functions/_shared/propertyBlockedDates.ts`
- Modify: `supabase/functions/_shared/propertyPricing.ts` — add `blockedDateKeys` to GET DTO; PATCH support for block/unblock
- Modify: `supabase/functions/property-pricing/index.ts` if request validation lives there

**Schema:**

```sql
CREATE TABLE public.property_blocked_dates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  start_date date NOT NULL,
  end_date date NOT NULL,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT property_blocked_dates_range_chk CHECK (end_date > start_date)
);

CREATE INDEX property_blocked_dates_property_range_idx
  ON public.property_blocked_dates (property_id, start_date, end_date);
```

Nights covered: each date `d` where `start_date <= d < end_date` (checkout-exclusive), matching bookings.

**Interfaces (`propertyBlockedDates.ts`):**

- `loadBlockedDateKeys(propertyId, monthStart?, monthEnd?): Promise<string[]>`
- `insertBlockedRange(propertyId, startDate, endDate, note?, userId?): Promise<…>`
- `deleteBlockedRangesCovering(propertyId, dateKeys: string[]): Promise<number>` — expand overlapping rows as needed (simple v1: delete any range that intersects selected nights; or delete by id if UI passes ids)

**PATCH body additions (property-pricing):**

```ts
{
  blockRange?: { startDate: string; endDate: string; note?: string }; // YYYY-MM-DD
  unblockDateKeys?: string[]; // YYYY-MM-DD night keys to free
}
```

Requires `pricing:edit`.

- [ ] **Step 1: Add migration file** (never edit old migrations)

- [ ] **Step 2: Implement shared helpers + wire into `loadPropertyPricing`**

DTO gains `blockedDateKeys: string[]`.

- [ ] **Step 3: Apply locally**

Run: `bun run db:migrate`  
Expected: migration applies on local Supabase.

- [ ] **Step 4: Commit**

```bash
git commit -m "$(cat <<'EOF'
feat: add property_blocked_dates and pricing API support

EOF
)"
```

---

### Task 4: Enforce blocks in guest availability + overlap checks

**Files:**

- Modify: `supabase/functions/get-booked-dates/index.ts` (or its shared helper)
- Modify: `supabase/functions/_shared/databaseService.ts` `checkOverlappingBookings`
- Modify: `supabase/functions/_shared/calendarAvailabilityManila.ts` if that is the shared blocked-set builder

**Behavior:**

- Public `get-booked-dates` returns union of booking occupied nights + `property_blocked_dates` nights for the property.
- `checkOverlappingBookings` (or a sibling check called from submit/update) rejects stays that intersect owner blocks — return clear 409/400 message like "Selected dates are unavailable".

- [ ] **Step 1: Implement union in the same place bookings already expand to night keys**

- [ ] **Step 2: Call block check from submit-form / update paths that already call `checkOverlappingBookings`**

Prefer extending `checkOverlappingBookings` or adding `assertDatesAvailable(propertyId, checkIn, checkOut)` used by both.

- [ ] **Step 3: Manual curl against local `get-booked-dates` after inserting a block row**

- [ ] **Step 4: Commit**

```bash
git commit -m "$(cat <<'EOF'
fix: treat owner blocked dates as unavailable for guests

EOF
)"
```

---

### Task 5: Pricing view UI — block / unblock dates

**Files:**

- Modify: `ui/src/features/dashboard/pricing/components/PricingCalendarGrid.tsx` — legend **Blocked**; cell state
- Modify: `ui/src/features/dashboard/pricing/components/PricingDateModal.tsx` — primary actions: set rate **or** Block (when `canEdit`); if selection is blocked, show Unblock
- Modify: `ui/src/features/dashboard/pricing/hooks/usePropertyPricing.ts` / API client — send `blockRange` / `unblockDateKeys`
- Modify: pricing panel state to track `blockedDateKeys` from DTO

**UX rules:**

- Past dates: no block/unblock.
- Booked nights: cannot block (already occupied); show Booked only.
- Available nights: select → modal offers rate **and** Block (Airbnb-style shared selection).
- Blocked nights: selectable for Unblock; not for custom rate until unblocked.
- Legend: Available / Holiday / Custom / Booked / **Blocked** / Selected.
- Blocked cells: muted/gray treatment distinct from Booked (use theme tokens, not raw red/green-only).
- Minimal copy: button labels `Block`, `Unblock`, `Apply` only.

- [ ] **Step 1: Thread `blockedDateKeys` through grid + modal**

- [ ] **Step 2: Wire save mutations**

- [ ] **Step 3: Type-check**

- [ ] **Step 4: Commit**

```bash
git commit -m "$(cat <<'EOF'
feat: block and unblock nights on property Pricing calendar

EOF
)"
```

---

### Task 6: Documentation

**Files:**

- Create: [[guides/routes/org/property/calendar|Calendar — operator guide]] (from pricing guide + Occupancy + blocks)
- Modify or replace: [[guides/routes/org/property/pricing|Pricing — legacy route]] — short stub pointing to calendar guide + redirect note
- Modify: [[guides/routes/README|Route-based operator guides]]
- Modify: [[PROJECT|Guest Form Management — Project Documentation]] — route table, `property_blocked_dates`, API fields
- Modify: [[TASKS_TO_PROMPT|Tasks To Prompt]] — mark Calendar task done
- Modify: [[planning/planned_modules/README|Planned modules]] — optional cross-link to superpowers plan

- [ ] **Step 1: Write calendar route guide** (behavior, save paths, permissions, host Q&A, implementation map)

- [ ] **Step 2: Update PROJECT.md API/schema mentions**

- [ ] **Step 3: Commit**

```bash
git commit -m "$(cat <<'EOF'
docs: document property Calendar page and date blocks

EOF
)"
```

---

## Self-review

1. **Spec coverage:** Rename ✓, Occupancy default + Name/Price ✓, Pricing view ✓, block dates ✓, guest enforcement ✓, docs ✓. Parking Pricing deferred ✓.
2. **Placeholders:** None intentional.
3. **Types:** View ids `'occupancy' | 'pricing'`; night keys `YYYY-MM-DD`; range `[start, end)`.
