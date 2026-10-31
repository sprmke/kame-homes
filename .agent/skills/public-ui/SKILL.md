# Public UI (guest marketing + operational flows)

Use when porting or changing **guest-facing** pages: PMA marketing site, calendar, form, sd-form, pay-parking.

## Stack differences (PMA → GFM)

| PMA (Next.js)              | GFM (Vite + React Router)                                           |
| -------------------------- | ------------------------------------------------------------------- |
| `next/image`               | `MarketingImage` (`marketing/shared/components/MarketingImage.tsx`) |
| `Link href=`               | `Link to=` from `react-router-dom`                                  |
| `useSearchParams()` object | `const [searchParams] = useSearchParams()`                          |
| `styled-jsx`               | Global CSS in `ui/src/index.css` (e.g. `.mode-transition-path`)     |
| `(marketing)/layout.tsx`   | `MarketingLayoutShell` + `<Outlet />`                               |
| `@/config/routes`          | `ui/src/config/routes.ts` (minimal subset)                          |
| Server components          | All client components; mock data in Phase 1                         |

## Feature layout

```
ui/src/features/guest/
  marketing/          ← PMA port (pages, components, mock data)
    pages/            ← route entry components
    routes/index.tsx
    shared/components/  MarketingLayoutShell, MarketingImage, MarketingNav, …
    properties/ developments/ guest-landing/ legal/
    forms/              ← FormSuccess + parkingFormCopy only (Pattern B mock forms removed)
  calendar/           ← /calendar (operational)
  form/               ← /form, /success
  sd-form/
  pay-parking/
  auth/               ← components only; routes TBD
  routes/index.tsx    ← merges marketing + operational
```

## Phase 1 vs Phase 2

**Phase 1 (current):** Visual parity with PMA; browse/list pages still use mock or partial APIs. **Operational flows are live:** property booking (`/properties/:slug/form` → `submit-form`), parking registration (`/parkings/:slug/form` → `submit-parking-booking-request`). Pattern B mock form routes (`…/forms/:formId`) were removed — see [`docs/workflow/done/pattern-b-mock-forms-cleanup.md`](../../docs/workflow/done/pattern-b-mock-forms-cleanup.md).

**Phase 2 (next):**

1. Public property/development catalog API
2. `BookingCard` Reserve → `/form?property=&checkInDate=&checkOutDate=`
3. Property marketing calendar → `get-booked-dates`
4. Property booking form → `submit-form` edge function (operational `/properties/:slug/form`)
5. Replace mock images with Storage URLs from property settings

## Checklist when porting a PMA component

1. Copy into `features/guest/marketing/…` (preserve folder structure)
2. Replace `next/image` → `MarketingImage as Image`
3. Replace `next/link` or `href` → `react-router-dom` `Link to=`
4. Fix `useSearchParams` destructuring
5. Remove `styled-jsx`; use Tailwind + global CSS
6. Fix lucide icon names if GFM version differs
7. Add page wrapper in `marketing/pages/` if new route
8. Register route in `marketing/routes/index.tsx`
9. Update matching guide under `docs/guides/routes/`
10. Run `cd ui && bun run build`

## Docs to update

- `docs/guides/routes/README.md` + route-specific guide
- `docs/architecture/routing.md` routes table
- `docs/archive/reference/project-structure.md` guest modules
- `.cursor/rules/public-ui.mdc` if conventions change

## Related

- Rule: `.cursor/rules/public-ui.mdc`
- Rule: `.cursor/rules/mobile-responsive.mdc`
- PMA source: `property-management-app/apps/web/src/features/marketing/`
