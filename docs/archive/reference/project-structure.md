---
title: 'UI project structure'
status: active
tags: [reference]
updated: 2026-08-02
---

# UI project structure

**Canonical rule:** `.cursor/rules/architecture.mdc`  
**Last reorganized:** 2026-07-09 (guest / dashboard context split)

Adapted from [bulletproof-react](https://github.com/alan2207/bulletproof-react) and Kame Homes PMA patterns.

## Layer flow

```
shared (components/, hooks/, lib/, utils/, layouts/)
  → features/guest/ | features/dashboard/
    → routes/ (thin composition)
```

Shared code never imports from features. Features may import shared + (sparingly) other features during migration — prefer composing at route level.

## Shared `lib/` (by category)

```
lib/
  supabase/client.ts       # Supabase client
  theme/                   # preferences, brandColor, applyBrandCssVariables
  validation/              # fieldValidation, adminSettings
  constants/formPlaceholders.ts
  date/navigation.ts       # admin date-range presets
  table/pagination.ts
  feedback/toastMessages.ts
  charts/                  # chartPalette, chartStyles (config, not components)
  utils.ts                 # cn() — shadcn convention; do not move
```

Domain-specific modules moved out of global `lib/`:

| Was                                        | Now                                |
| ------------------------------------------ | ---------------------------------- |
| `lib/gafDefaults.ts`, `lib/petDefaults.ts` | `features/dashboard/bookings/lib/` |
| `lib/settingsFieldLabel.ts`                | `features/dashboard/org/lib/`      |

## Shared `utils/` (by category)

```
utils/
  format/    # currency, dates, bookingDisplay
  text/      # formatters, helpers (name/file transforms)
  dev/       # mockData (guest form dev only)
```

| Was                         | Now                                           |
| --------------------------- | --------------------------------------------- |
| `utils/bookingFormatter.ts` | `features/guest/form/lib/bookingFormatter.ts` |

## Top-level `ui/src/`

| Path                  | Role                                                                                                      |
| --------------------- | --------------------------------------------------------------------------------------------------------- |
| `components/`         | Shared UI — `ui/`, `forms/` (`FieldLabel`), `branding/`, `navigation/`, `charts/`, `skeletons/`, `theme/` |
| `features/guest/`     | Public guest-facing modules                                                                               |
| `features/dashboard/` | Admin / operator dashboard modules                                                                        |
| `hooks/`              | Cross-feature hooks (if any)                                                                              |
| `layouts/`            | `MainLayout`, `layouts/guest/navState`                                                                    |
| `lib/`                | Categorized shared logic — see **Shared `lib/`** above                                                    |
| `routes/`             | `AppRoutes` — composes guest + dashboard trees                                                            |
| `utils/`              | Categorized formatters — see **Shared `utils/`** above                                                    |

## Guest features (`features/guest/`)

| Module         | Routes                                                                                   | Purpose                                                                                         |
| -------------- | ---------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `marketing/`   | `/`, `/for-hosts`, `/services`, `/properties/*`, `/developments/*`, `/terms`, `/privacy` | Marketing site + **`showcase/`** animated property landing pages (`/properties/:slug/showcase`) |
| `calendar/`    | `/calendar`                                                                              | Operational date picker → `/form`                                                               |
| `form/`        | `/form`, `/success`                                                                      | Guest booking form                                                                              |
| `sd-form/`     | `/sd-form`                                                                               | Security deposit refund                                                                         |
| `pay-parking/` | `/bookings/:id/parking`                                                                  | Parking payment form                                                                            |
| `auth/`        | `/for-guests/*`, `/for-hosts/*` login/register/…                                         | PMA auth UI (Phase 1 mock submit)                                                               |

Entry: `features/guest/routes/index.tsx` (marketing routes first, then calendar/form/sd-form/pay-parking)

## Dashboard features (`features/dashboard/`)

| Module          | Scope          | Purpose                                                                                                   |
| --------------- | -------------- | --------------------------------------------------------------------------------------------------------- |
| `bookings/`     | Property       | Booking list, detail, workflow, templates editor, Telegram, settings pages (legacy hub — split over time) |
| `org/`          | Org            | Selector, onboarding, org/property settings, guards                                                       |
| `property/`     | Property       | Property dashboard home, stats cards                                                                      |
| `finance/`      | Property       | Finance ledger                                                                                            |
| `maintenance/`  | Property       | Maintenance reminders                                                                                     |
| `pricing/`      | Property       | Rate calendar                                                                                             |
| `inbox/`        | Org            | Meta guest inbox                                                                                          |
| `team/`         | Org + property | Team invites, permissions                                                                                 |
| `custom-pages/` | Property       | Public Pages gallery                                                                                      |
| `page-editor/`  | Property       | Stay Guide / listing / Showcase editors + `components/shared/` controls                                   |

Entry: `features/dashboard/routes/index.tsx`

## Shared components layout

```
components/
  ui/           # shadcn primitives (kebab-case — do not rename)
  branding/     # KameFormBrandHeader, KameHomesBrandIcon, GoogleMark, TeamLogoMark
  navigation/   # ScrollToTop, AdminEntryButton
  charts/
  skeletons/
  theme/
  shared/
```

## Feature folder convention

Each module uses only the subfolders it needs:

```
features/{context}/{module}/
├── components/
├── hooks/
├── lib/
├── pages/
├── routes/
├── schemas/    # guest form
└── types/
```

## Adding a module

1. Place under `features/guest/{name}/` or `features/dashboard/{name}/`.
2. Add `{name}/routes/index.tsx` and wire in the parent context router.
3. Add route guide under `docs/guides/routes/`.
4. Log moves in this file when batch-reorganizing.

## Migration log (2026-07-09)

| Before                                 | After                                                             |
| -------------------------------------- | ----------------------------------------------------------------- |
| `features/guest-form/`                 | `features/guest/form/`                                            |
| `features/guest-form/.../CalendarPage` | `features/guest/calendar/`                                        |
| `features/sd-form/`                    | `features/guest/sd-form/`                                         |
| `features/pay-parking/`                | `features/guest/pay-parking/`                                     |
| `features/admin/`                      | `features/dashboard/bookings/`                                    |
| `features/org/`                        | `features/dashboard/org/`                                         |
| `features/finance/`                    | `features/dashboard/finance/`                                     |
| `features/maintenance/`                | `features/dashboard/maintenance/`                                 |
| `features/inbox/`                      | `features/dashboard/inbox/`                                       |
| `features/pricing/`                    | `features/dashboard/pricing/`                                     |
| `features/team/`                       | `features/dashboard/team/`                                        |
| `features/dashboard/`                  | `features/dashboard/property/`                                    |
| Loose `components/*.tsx`               | `components/branding/`, `components/navigation/`                  |
| Flat `lib/`, `utils/`                  | Categorized subfolders (see **Shared `lib/`** / **utils/** above) |
| `components/charts/*.ts`               | `lib/charts/`                                                     |
| `layouts/guestNavState.ts`             | `layouts/guest/navState.ts`                                       |

Import scripts: `scripts/dev/migrate-feature-imports.sh`, `scripts/dev/migrate-shared-imports.sh` (one-shot; keep for reference).
