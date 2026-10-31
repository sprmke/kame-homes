---
title: 'UI filename audit'
status: archived
tags: [reference, archive, naming-conventions]
updated: 2026-08-02
---

# UI filename audit

**Last audit:** 2026-07-09  
**Canonical rule:** `.cursor/rules/naming-conventions.mdc`

## Standards

| Kind                   | Pattern                 | Example                                   |
| ---------------------- | ----------------------- | ----------------------------------------- |
| React component / page | `PascalCase.tsx`        | `BookingTable.tsx`, `FinancePage.tsx`     |
| Hook                   | `usePascalCase.ts`      | `useBookings.ts`                          |
| Lib / util / schema    | `camelCase.ts`          | `bookingDisplay.ts`, `guestFormSchema.ts` |
| shadcn UI              | `kebab-case.tsx` (keep) | `dropdown-menu.tsx`                       |
| Route modules          | any (excluded)          | `routes/index.tsx`, `authRoutes.tsx`      |
| Vite entry             | `main.tsx` (excluded)   | —                                         |

## Batch rename log (2026-07-09)

| Before                              | After                                   | Importers updated                              |
| ----------------------------------- | --------------------------------------- | ---------------------------------------------- |
| `ui/src/utils/booking-display.ts`   | `ui/src/utils/format/bookingDisplay.ts` | 21 TSX files (`@/utils/format/bookingDisplay`) |
| `bookingEditLayout.tsx`             | `BookingEditLayout.tsx`                 | (prior session)                                |
| `telegramTemplateDialogContext.tsx` | `TelegramTemplateDialogContext.tsx`     | (prior session)                                |

## Scan results

Automated scan of **528** `ui/src` `.ts` / `.tsx` files:

- **Components / pages:** all `PascalCase.tsx`
- **Hooks:** all `usePascalCase.ts`
- **Lib / schemas / utils:** all `camelCase.ts` (after `bookingDisplay` rename)
- **Intentional exceptions:** `main.tsx`, `vite-env.d.ts`, `components/ui/**`, `**/routes/**`, `**/*.test.ts` (Vitest co-located specs)

No remaining drift in `ui/src` as of this audit.

## Verify

```bash
# Shell audit (CI-friendly)
./scripts/dev/check-ui-filename-conventions.sh

# ESLint filename-case (warn)
cd ui && bunx eslint .
```

## When adding files

- New component → `PascalCase.tsx` under `features/**/components/` or `pages/`
- New hook → `useSomething.ts` under `features/**/hooks/`
- New util → `camelCase.ts` under `lib/`, `utils/`, or `schemas/`
- Do **not** rename shadcn files under `components/ui/`
