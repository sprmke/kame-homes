---
title: Import preview fix queue
status: done
tags: [workflow, import, bookings]
updated: 2026-08-06
stage: done
kind: plan
---

# Import preview: error queue + inline fix

## Goal

Hosts importing hundreds or thousands of bookings can find every bad row quickly, see what value failed and why, fix only those fields in-app, and continue importing Ready rows — without leaving the wizard or re-uploading.

## Shipped approach

| Decision          | Choice                                                                        |
| ----------------- | ----------------------------------------------------------------------------- |
| Fix UI            | Side sheet / bottom sheet opened from Needs fixing rows                       |
| Editable fields   | Only flagged error fields on that row                                         |
| List management   | Status filter chips; default Need fixing when errors exist                    |
| Bad-value display | `ImportValidationError.value` on server + client formatters                   |
| Persist fixes     | `import-update-row` accepts `fieldValues` → patches `raw_data` → re-validates |

See implementation in `ImportPreviewTable.tsx`, `ImportRowFixSheet.tsx`, `importPreviewService.ts`, `import-update-row/index.ts`.

## Follow-up UX shipped in the same arc

- **Skipped queue:** Skipped rows reopen the same sheet in Restore mode; Prev/Next walk a frozen skipped queue (never flips into Need fixing mid-session). Restoring the last skipped row closes the sheet.
- **Skip flicker:** Footer mode comes from the session (`fix` | `restore`), not live `validationStatus`, so Skip never flashes Restore.
- **Commit review:** Step 4 shows Ready / Not included stats plus a paginated table of bookings about to import (#, Guest, Check-in, Check-out, Guests, Booking rate).
- **Template confirm:** Download template asks first — existing files work as-is; template is optional reference.
