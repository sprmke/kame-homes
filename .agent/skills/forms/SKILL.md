---
name: forms
description: Guest and admin forms with React Hook Form and Zod. Use for guest form, booking edit, property settings, SD form, validation, or submit-form integration.
---

# Forms (GFM)

## Stack

React Hook Form + Zod + shadcn inputs.

## Guest form (canonical)

| Piece  | Path                                                    |
| ------ | ------------------------------------------------------- |
| Schema | `ui/src/features/guest/form/schemas/guestFormSchema.ts` |
| UI     | `ui/src/features/guest/form/components/GuestForm.tsx`   |
| Submit | `submit-form` edge — FormData + files                   |
| Guide  | `docs/guides/routes/form.md`                            |

Airbnb: `buildGuestFormSchema(true)` — skips payment step; `?source=airbnb`.

## Admin booking edit

`BookingEditForm.tsx` — workflow-sensitive field changes may revert status (see `booking-workflow.mdc`).

## Property / org settings

Large sectioned forms under `ui/src/features/dashboard/org/components/property-settings/`. Saves via `update-property`, `app-settings`, `org-settings` edge functions.

## Validation sync

Server mirrors critical rules:

- `_shared/fieldValidation.ts`
- `_shared/orgSettingsValidation.ts`
- `_shared/propertySettingsValidation.ts`

## File uploads

Guest: included in FormData to `submit-form`. Admin assets: `upload-booking-asset`, `upload-property-media` with multipart from UI.

## Rule

`.cursor/rules/forms.mdc`

## Dev toggles

Non-prod guest form checkboxes map to query params (`sendEmail`, `saveToDatabase`, …) — `admin-auth.mdc` §4.

## Unsaved changes

Every form with a manual Save must use the shared guard (`useUnsavedChangesGuard`, or `useGuardedClose` for modals). Invoke the `unsaved-changes-guard` skill. RHF: `isDirty` from `formState`, `onSave` wraps `handleSubmit` and returns whether it saved.
