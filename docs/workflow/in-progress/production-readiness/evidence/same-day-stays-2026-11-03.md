---
title: 'Same-day stays (day use) — end-to-end support and the stay-date guard'
status: active
stage: in-progress
kind: evidence
readiness: verified
launch_gate: F
launch_blocker: false
last_verified: '1740bb91 2026-11-03'
---

# Same-day stays — 2026-11-03

The product allows a guest to **check in and out on the same date** (day use). The guest form
already hinted at it (a same-day time rule in `guestFormSchema`), but the picker, the edge
validator and the database all treated it as invalid, and three availability surfaces silently
dropped same-day rows. This closes the gap.

## Rule

- `check_out_date >= check_in_date`. An inverted range is rejected everywhere.
- A same-day stay occupies the **check-in night**: `number_of_nights = 1`.
- Availability treats the stay as the half-open range `[check-in, check-in + 1)`.

`_shared/utils.ts#occupiedStayNights` is the single definition of the nights count.

## What changed

| Layer              | File                                                                                     | Change                                                                                        |
| ------------------ | ---------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Guest form UI      | `features/guest/form/components/GuestForm.tsx`                                           | Check-out picker accepts the check-in date (min date = check-in, only earlier dates disabled) |
| Guest form payload | `utils/text/formatters.ts`                                                               | Nights never go below 1                                                                       |
| Success page       | `features/guest/form/components/GuestFormSuccess.tsx`                                    | Shows "1 Night" for a same-day stay                                                           |
| Edge validation    | `_shared/guestFormSubmitValidation.ts`                                                   | `validateGuestFormCheckOutNotBeforeCheckIn` accepts equal, rejects inverted                   |
| Edge payload       | `_shared/types.ts`                                                                       | `number_of_nights` derived from the dates, not the client                                     |
| Overlap            | `_shared/databaseService.ts`                                                             | Same-day ranges normalize to one occupied night                                               |
| Pricing occupancy  | `_shared/propertyPricing.ts`                                                             | `loadBookedDateKeys` + `bookingOverlapsMonth` include the day-use night                       |
| Availability       | `_shared/calendarAvailabilityManila.ts`                                                  | `collectBlockedNights` / `bookingOccupiesNight`                                               |
| ICS export         | `_shared/calendarSyncRun.ts`                                                             | `loadExportRanges` publishes `[check-in, check-in + 1)` so OTAs block the night               |
| Admin edit         | `_shared/bookingDetailsPatch.ts`                                                         | Reschedule + field-level edits validate the merged pair and recompute nights                  |
| Import             | `_shared/importPreviewService.ts`, `ui/.../importRowDraftValidation.ts`, `import-commit` | Same-day rows preview as valid and commit with 1 night                                        |
| Guest calendar     | `features/guest/calendar/lib/guestCalendarAvailability.ts`, `utils/format/dates.ts`      | Same-day bookings block their day                                                             |
| Database           | `migrations/20261317120000_same_day_stay_dates.sql`                                      | Adds the missing `valid_dates` CHECK allowing equal dates                                     |

## The database guard (and why 41 rows are grandfathered)

Production never had `valid_dates`: the table was created outside the migration chain and the
original `CREATE TABLE IF NOT EXISTS` was a no-op, so the constraint set had drifted. The new
migration adds it for the first time, allows same-day, and validates.

41 rows created 2025-03..05 have `check_out_date < check_in_date`. They were edited, but arrival,
departure and `number_of_nights` disagree with each other, so every possible rewrite invents
history (a swap does not fit: only 2 of 41 have `check_in - check_out = nights`). Rows created
before 2025-06-01 are grandfathered; **0** rows created on/after the cutoff violate the rule, so
`VALIDATE CONSTRAINT` passes and a production dump still restores into a fresh project.

Follow-up: the 41 rows (and 24 more from the same edit bug) were repaired on 2026-11-03 from the
upload filenames, and `20261318120000_strict_valid_dates.sql` drops the cutoff. See
[`legacy-stay-date-reconstruction.md`](./legacy-stay-date-reconstruction.md).

## Verification

- `deno test` — `utils_stayNights_test.ts`, `calendarAvailabilityManila_stayDates_test.ts`,
  `guestFormSubmitValidation_test.ts`, `bookingDetailsPatch_test.ts` (24 passed)
- `bun run test` — `dates.test.ts`, `formatters.test.ts`, `importRowDraftValidation.test.ts`
- Constraint exercised on a scratch table: same-day (MM-DD-YYYY and YYYY-MM-DD) accepted, inverted
  row created today rejected, inverted legacy row accepted
- `bun run type-check`, `bun run lint` — clean

## Production verification (2026-11-03)

| Check        | Result                                                                                                                                                              |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Deploy       | `CD Deploy (Supabase)` run `41539328461` on `4a4d6ccf` — quality + deploy **success**                                                                               |
| Constraint   | `valid_dates` present on `fwor…` with `convalidated = true`                                                                                                         |
| Data         | `node scripts/dev/audit-booking-dates.mjs` → `OK — 450 rows restore cleanly (41 pre-2025-06 reversed rows grandfathered, 1 same-day stays, 1 non-canonical format)` |
| Public reads | `get-health` ok; `get-booked-dates` and `get-public-property` return data                                                                                           |
| Captcha      | `submit-form` rejects unverified probes with `Human verification is required` (enforced)                                                                            |

The **frontend** half is live too: `release/same-day-picker` (UI-only cherry-pick) merged to `main`
as `5fb3dc64` and Vercel deployed production from that commit on 2026-11-04. The same-day checkout
is now selectable on `kamespace.com`.
