---
title: 'Guest form configurable sections & source prefix — Implementation Plan'
status: done
tags: [workflow, done, guest-form, multi-tenancy]
updated: 2026-08-03
stage: done
kind: plan
---

# Guest form configurable sections & source prefix — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

## Context

The public guest booking form (`ui/src/features/guest/form/`) is hardcoded to one property's rules, the same way the booking-status workflow was before the recent **configurable document requirements** effort (shipped: [`booking-workflow-configurable-docs.md`](./booking-workflow-configurable-docs.md), audited in [`booking-workflow-multi-tenancy.md`](./booking-workflow-multi-tenancy.md)). This plan is the guest-form counterpart of that same generalization: as the platform onboards more properties, hosts need to turn Pets / Parking / Surprise Decor on or off per unit, and the booking-source field needs to stop defaulting to "Facebook" for every booking that doesn't explicitly come from a listing platform.

Two concrete problems drove this:

1. **Pet / Parking / Surprise Decor are always shown.** Every property's guest form asks about pets, parking, and surprise decor regardless of whether that property actually offers them. There is no property-level "does this unit allow X" switch anywhere in the schema, steps, or settings — confirmed by codebase audit (see Explicit non-goals / audit notes below for what already exists vs. what's missing).
2. **"Facebook" is a silent default, not a real default.** `bookingSource` defaults to `'Facebook'` in 10+ places across client and server whenever the field is empty/falsy, and the "Facebook Name" field label is shown even when a booking has no listing-platform origin. Bookings that come from anywhere else (a repeat guest, a direct referral, WhatsApp, etc.) are mislabeled as Facebook bookings. The fix: the guest form should default to a neutral **"Direct"** source with no platform prefix, and only show a "Facebook Name" / "Airbnb Name" prefix when `?source=facebook` / `?source=airbnb` is present.

This plan makes both configurable via a new **Guest Form** section in property settings, following the exact architectural pattern the document-requirements work established (property-level JSONB config, resolved server-side, consumed by both the public form and the submission edge function).

## Global Constraints

- Preserve today's behavior for the existing seeded property (Kame Home 2604 / Azure North): `allowPets`, `allowParking`, `allowSurpriseDecor` all default `true` when unset, so no property regresses until a host explicitly disables a section.
- **Locked scope (per product-owner decisions, 2026-08-03):**
  - Section toggles only — no per-field required/optional customization, no dynamic form builder. (Backlog for a future phase.)
  - Config lives in `properties.settings` JSONB, per-property only — **no** residence-type default tier in `developments.settings` for this feature (unlike document requirements). No new migration needed for the booleans; `properties.settings` already exists and is merged shallowly on every property update.
  - Source options list stays fixed for v1: `Direct` / `Facebook` / `Airbnb`. Making the source list itself host-configurable (e.g. adding Booking.com, VRBO) is backlog.
- `findUs` ("how did you find us" — Facebook/Airbnb/Tiktok/Instagram/Friend/Others) is a **separate** field from `bookingSource` and is **not** touched by this plan (`guestFormSchema.ts:87`, `GuestForm.tsx:1387-1392`).
- `guestFacebookName` keeps its internal field name and DB column (`guest_facebook_name`) — only its UI label/placeholder becomes prefix-free when source is `Direct`.
- Repo has **no Vitest/Deno test suite** — verify every task with `bun run type-check` / `bun run lint` / `bun run build` plus a manual walkthrough (dev server + curl), per repo convention.
- UI: Operate mode, `minimal-ui-copy`, mobile 375+, Impeccable craft floor for the new property-settings section (mirrors `PropertyWorkflowDocumentsSection.tsx`'s toggle-row pattern).
- No production Supabase deploy without the unlock word `kamewave` (`.cursor/rules/no-prod-deploy.mdc`).
- Docs: update `docs/guides/routes/org/property/settings.md` and `docs/PROJECT.md` in the same change, per `documentation-maintenance.mdc`.

## Locked decisions (do not re-litigate)

| #   | Decision                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | Config storage = flat booleans on `properties.settings` JSONB (`allowPets`, `allowParking`, `allowSurpriseDecor`), default `true`. No migration; merged the same way `selfCheckIn`/`enabledAmenities` already are (`propertyProfileSettingsPatch`).                                                                                                                                                                                                                                                                                                                              |
| D2  | Public exposure piggybacks on the **existing** `get-guest-payment-info` edge function + `useGuestPaymentInfo()` hook (already fetched on guest-form load) instead of a new endpoint — avoids an extra round trip.                                                                                                                                                                                                                                                                                                                                                                |
| D3  | Step removal is **id-based, not position-based**. `GuestForm.tsx` currently conflates the numeric `currentStep` counter (an array _position_) with the step's semantic `id` (1=Guest…5=Payment) — safe today only because Airbnb trims from the _end_ of the list. Removing a _middle_ step (Parking or Pets) breaks that assumption, so every `currentStep === N` conditional becomes `activeStepConfig?.id === N`.                                                                                                                                                             |
| D4  | **Server-side enforcement.** `submit-form` resolves the property's guest-form settings and forces `hasPets` / `needParking` / `guestRequestsSurpriseDecor` to `false` when disallowed, regardless of what the client posts — defends against a guest bypassing a hidden step via devtools.                                                                                                                                                                                                                                                                                       |
| D5  | Source default becomes **`Direct`** when `?source=` is missing/unrecognized. `Facebook`/`Airbnb` remain the two explicit recognized values. All hardcoded `'Facebook'` fallbacks for `bookingSource`/`booking_source` become `'Direct'`. Every pricing/behavior branch that today reads `bookingSource === 'Airbnb' ? A : B` already treats "anything not Airbnb" the same way — confirmed by inspection of `ReviewPricingForm.tsx`, `OtherInfoPanel.tsx`, `BookingDetailHeader.tsx` — so `Direct` safely reuses the existing non-Airbnb branch with zero pricing-logic changes. |
| D6  | `guestFacebookName` field/column names are unchanged; only the UI label ("Facebook Name" / "Airbnb Name" / **"Full Name"** for Direct) and placeholder change based on resolved source.                                                                                                                                                                                                                                                                                                                                                                                          |
| D7  | `findUs` dropdown and its options are untouched by this plan.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| D8  | The new "Guest Form" settings section is a **profile** section (`properties.settings`-backed, saved via the property-update endpoint), grouped with `amenities`/`house-rules`, **not** an operational (`app_settings`-backed) section like `workflow-documents`.                                                                                                                                                                                                                                                                                                                 |

---

## File map

| File                                                                                              | Role                                                                                                                                                                               |
| ------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ui/src/features/dashboard/org/lib/propertySettingsForm.ts`                                       | Add `allowPets`/`allowParking`/`allowSurpriseDecor` to `PropertyProfileDraft` + patch builder                                                                                      |
| `ui/src/features/dashboard/org/lib/propertySettingsCompletion.ts`                                 | Add `'guest-form'` to `PropertySettingsSectionId` union                                                                                                                            |
| `ui/src/features/dashboard/org/lib/propertySettingsSave.ts`                                       | Add `'guest-form'` to `PROFILE_SECTIONS`, dirty-check case, `FIELD_SECTIONS` entries                                                                                               |
| `ui/src/features/dashboard/org/components/property-settings/PropertyGuestFormSettingsSection.tsx` | **New** — toggle-row settings UI (mirrors `PropertyWorkflowDocumentsSection.tsx`)                                                                                                  |
| `ui/src/features/dashboard/org/components/property-settings/PropertyProfileSettingsSections.tsx`  | Mount the new section                                                                                                                                                              |
| `ui/src/features/dashboard/org/components/property-settings/PropertySettingsCard.tsx`             | Nav entry for `guest-form`                                                                                                                                                         |
| `supabase/functions/_shared/guestFormSettings.ts`                                                 | **New** — `resolveGuestFormSettings(propertyId)` shared resolver                                                                                                                   |
| `supabase/functions/get-guest-payment-info/index.ts`                                              | Merge resolved guest-form settings into the response                                                                                                                               |
| `supabase/functions/_shared/appSettings.ts`                                                       | Extend `GuestPaymentInfoDto` / `serializeGuestPaymentInfo`                                                                                                                         |
| `ui/src/features/guest/form/hooks/useGuestPaymentInfo.ts`                                         | Extend `GuestPaymentInfo` type + `DEFAULT_GUEST_PAYMENT_INFO`                                                                                                                      |
| `supabase/functions/submit-form/index.ts`                                                         | Server-side clamp (D4)                                                                                                                                                             |
| `ui/src/features/guest/form/lib/guestFormSteps.ts`                                                | Visibility-flag-based step filtering (D3)                                                                                                                                          |
| `ui/src/features/guest/form/components/GuestForm.tsx`                                             | Consume resolved settings; id-based step checks; source-prefix label logic                                                                                                         |
| `ui/src/features/guest/form/components/GuestFormGuestsSection.tsx`                                | "Same as Facebook/Airbnb Name" label → 3-way                                                                                                                                       |
| `ui/src/features/guest/form/schemas/guestFormSchema.ts`                                           | `buildGuestFormSchema` options object + defense-in-depth clamp                                                                                                                     |
| `ui/src/features/guest/form/lib/bookingSourceFromSearchParams.ts`                                 | `BOOKING_SOURCE_OPTIONS` + default → `Direct`                                                                                                                                      |
| `ui/src/features/guest/form/lib/bookingFormatter.ts`                                              | Copy/paste label update                                                                                                                                                            |
| Server `'Facebook'` fallback sweep (D5)                                                           | `databaseService.ts`, `types.ts`, `calendarService.ts`, `sheetsService.ts`, `workflowOrchestrator.ts`, `guestStayGuide.ts`, `propertyTemplateEmailSections.ts`, `telegramAdmin.ts` |
| Admin display fallback sweep (D5)                                                                 | `ReviewPricingForm.tsx`, `BookingDetailHeader.tsx`, `OtherInfoPanel.tsx`                                                                                                           |
| Docs                                                                                              | `docs/guides/routes/org/property/settings.md`, `docs/PROJECT.md`                                                                                                                   |

---

### Task 1: Property profile schema — `allowPets` / `allowParking` / `allowSurpriseDecor`

**Files:**

- Modify: `ui/src/features/dashboard/org/lib/propertySettingsForm.ts`
- Modify: `ui/src/features/dashboard/org/lib/propertySettingsCompletion.ts`
- Modify: `ui/src/features/dashboard/org/lib/propertySettingsSave.ts`

**Interfaces:**

```ts
// propertySettingsForm.ts — extend PropertyProfileDraft
export type PropertyProfileDraft = {
  // ...existing fields...
  allowPets: boolean;
  allowParking: boolean;
  allowSurpriseDecor: boolean;
};
```

Behavior:

1. In the function that builds `PropertyProfileDraft` from a loaded property (around `propertySettingsForm.ts:170-232`, same block that reads `selfCheckIn`), add:
   ```ts
   allowPets: readSettingsBoolean(settings, 'allowPets', true),
   allowParking: readSettingsBoolean(settings, 'allowParking', true),
   allowSurpriseDecor: readSettingsBoolean(settings, 'allowSurpriseDecor', true),
   ```
2. In `propertyProfileSettingsPatch()` (`propertySettingsForm.ts:308-339`), add the same three keys so they're included in the flat patch merged into `properties.settings` server-side (`update-property/index.ts:145` already does `{ ...currentSettings, ...incoming }` — no server change needed).
3. Add `'guest-form'` to `PropertySettingsSectionId` (`propertySettingsCompletion.ts:81-94`). Do **not** add any validation/completion checks for it in `computePropertySettingsCompletion()` — this section is entirely optional, matching the existing `workflow-documents` pattern (zero completion checks).
4. In `propertySettingsSave.ts`: add `'guest-form'` to `PROFILE_SECTIONS` (line 80-88); add `FIELD_SECTIONS` entries `'guest-form-allow-pets': 'guest-form'`, `'guest-form-allow-parking': 'guest-form'`, `'guest-form-allow-surprise-decor': 'guest-form'` (line 30-78); add a `case 'guest-form':` to `propertySettingsSectionDirty()` (line ~156-269) comparing `draft.allowPets !== baseline.allowPets || draft.allowParking !== baseline.allowParking || draft.allowSurpriseDecor !== baseline.allowSurpriseDecor`.

- [ ] **Step 1: Implement the type/patch/dirty-check changes above**
- [ ] **Step 2: `bun run type-check`** — expect PASS
- [ ] **Step 3: Commit**

```bash
git add ui/src/features/dashboard/org/lib/propertySettingsForm.ts \
  ui/src/features/dashboard/org/lib/propertySettingsCompletion.ts \
  ui/src/features/dashboard/org/lib/propertySettingsSave.ts
git commit -m "$(cat <<'EOF'
feat(settings): add allowPets/allowParking/allowSurpriseDecor to property profile

EOF
)"
```

---

### Task 2: Property Settings UI — Guest Form section (Impeccable)

**Files:**

- Create: `ui/src/features/dashboard/org/components/property-settings/PropertyGuestFormSettingsSection.tsx`
- Modify: `ui/src/features/dashboard/org/components/property-settings/PropertyProfileSettingsSections.tsx`
- Modify: `ui/src/features/dashboard/org/components/property-settings/PropertySettingsCard.tsx`
- Modify: `docs/guides/routes/org/property/settings.md`

**Design (Operate mode — Impeccable, `minimal-ui-copy`):**

- New `AdminSection id="guest-form"` block, placed near Amenities/House Rules in the profile nav group (it's a profile-level, `properties.settings`-backed section per D8).
- Three toggle rows, same visual language as `PropertyWorkflowDocumentsSection.tsx`'s `syncCalendar`/`syncSheets` toggles: **Allow Pets**, **Allow Parking**, **Allow Surprise Decor**. One short helper line per toggle (e.g. "Guests can request pet approval during booking") — no marketing copy.
- Each toggle calls `onChange('allowPets' | 'allowParking' | 'allowSurpriseDecor', boolean)` against `PropertyProfileDraft`, same callback pattern as the rest of `PropertyProfileSettingsSections.tsx`.
- Mobile: single column, 44px touch targets.

- [ ] **Step 1: Implement `PropertyGuestFormSettingsSection.tsx`** (copy `PropertyWorkflowDocumentsSection.tsx`'s shape: props `{ draft: PropertyProfileDraft; onChange: <K extends keyof PropertyProfileDraft>(key: K, value: PropertyProfileDraft[K]) => void }`)
- [ ] **Step 2: Mount it in `PropertyProfileSettingsSections.tsx`** near the Amenities/House Rules sections
- [ ] **Step 3: Add nav entry** `{ id: 'guest-form', label: 'Guest Form', icon: <pick a lucide icon, e.g. ClipboardList> }` to the nav array in `PropertySettingsCard.tsx` (~line 101-115)
- [ ] **Step 4: Manual check at 375 / 768 / 1024px** — toggle each switch, confirm dirty-state detection and save work (Task 1 wiring)
- [ ] **Step 5: Update `docs/guides/routes/org/property/settings.md`** with the new section
- [ ] **Step 6: `bun run type-check && bun run lint`**
- [ ] **Step 7: Commit**

```bash
git add ui/src/features/dashboard/org/components/property-settings/PropertyGuestFormSettingsSection.tsx \
  ui/src/features/dashboard/org/components/property-settings/PropertyProfileSettingsSections.tsx \
  ui/src/features/dashboard/org/components/property-settings/PropertySettingsCard.tsx \
  docs/guides/routes/org/property/settings.md
git commit -m "$(cat <<'EOF'
feat(ui): property settings section for guest form pet/parking/decor toggles

EOF
)"
```

---

### Task 3: Shared resolver + public exposure via `get-guest-payment-info`

**Files:**

- Create: `supabase/functions/_shared/guestFormSettings.ts`
- Modify: `supabase/functions/_shared/appSettings.ts`
- Modify: `supabase/functions/get-guest-payment-info/index.ts`
- Modify: `ui/src/features/guest/form/hooks/useGuestPaymentInfo.ts`

**Interfaces:**

```ts
// supabase/functions/_shared/guestFormSettings.ts
export type GuestFormSettings = {
  allowPets: boolean;
  allowParking: boolean;
  allowSurpriseDecor: boolean;
};

export const DEFAULT_GUEST_FORM_SETTINGS: GuestFormSettings = {
  allowPets: true,
  allowParking: true,
  allowSurpriseDecor: true,
};

/** Reads properties.settings.{allowPets,allowParking,allowSurpriseDecor}; missing/invalid → default true. */
export async function resolveGuestFormSettings(propertyId: string): Promise<GuestFormSettings>;
```

Behavior:

1. Implement `resolveGuestFormSettings` following the exact query pattern already used for `loadPropertyResidenceName` (`appSettings.ts:390-404`): `createServiceClient().from('properties').select('settings').eq('id', propertyId).maybeSingle()`, then read the three boolean keys off `data.settings` with `typeof v === 'boolean' ? v : true` fallback per key (missing key or wrong type → `true`, never `false` by accident).
2. Extend `GuestPaymentInfoDto` type (`appSettings.ts`, same file as `serializeGuestPaymentInfo`) with the three fields, and update `serializeGuestPaymentInfo(propertyId)` (`appSettings.ts:545-562`) to call `resolveGuestFormSettings(propertyId ?? await getDefaultPropertyId())` and spread the result into the returned DTO.
3. No change needed in `get-guest-payment-info/index.ts` itself — it already calls `serializeGuestPaymentInfo(propertyId)` and returns the DTO wholesale (`index.ts:15-16`).
4. Client: extend `GuestPaymentInfo` type and `DEFAULT_GUEST_PAYMENT_INFO` in `useGuestPaymentInfo.ts` with `allowPets: true, allowParking: true, allowSurpriseDecor: true` (placeholder/fallback data must default to today's always-shown behavior, never hide a section before the real fetch resolves).

- [ ] **Step 1: Implement `guestFormSettings.ts`**
- [ ] **Step 2: Wire into `appSettings.ts`'s `GuestPaymentInfoDto`/`serializeGuestPaymentInfo`**
- [ ] **Step 3: Extend `useGuestPaymentInfo.ts` client type + defaults**
- [ ] **Step 4: Manual curl check** (local `bun run dev:api`):
  ```bash
  curl -sS "$SUPABASE_URL/functions/v1/get-guest-payment-info?property=<slug>"
  ```
  Expected: response `data` includes `allowPets: true, allowParking: true, allowSurpriseDecor: true` for the seeded Azure property (no toggles disabled yet); set one to `false` via the Task 2 UI and re-curl to confirm it flips.
- [ ] **Step 5: `bun run type-check`**
- [ ] **Step 6: Commit**

```bash
git add supabase/functions/_shared/guestFormSettings.ts \
  supabase/functions/_shared/appSettings.ts \
  ui/src/features/guest/form/hooks/useGuestPaymentInfo.ts
git commit -m "$(cat <<'EOF'
feat(edge): resolve and expose per-property guest form settings

EOF
)"
```

---

### Task 4: Server-side enforcement in `submit-form` (D4)

**Files:**

- Modify: `supabase/functions/submit-form/index.ts`

**Interfaces:**

- Consumes: `resolveGuestFormSettings` (Task 3)

Behavior:

1. Immediately after `const propertyId = await resolvePublicPropertyId(url)` (`submit-form/index.ts:44`), add:
   ```ts
   const guestFormSettings = await resolveGuestFormSettings(propertyId);
   ```
2. Before the FormData is handed to `DatabaseService.processFormData` (`index.ts:207-215`), clamp the three fields directly on the `FormData` object:
   ```ts
   if (!guestFormSettings.allowPets) formData.set('hasPets', 'false');
   if (!guestFormSettings.allowParking) formData.set('needParking', 'false');
   if (!guestFormSettings.allowSurpriseDecor) formData.set('guestRequestsSurpriseDecor', 'false');
   ```
   This runs regardless of what the client posted — a guest cannot force a disallowed section on by tampering with devtools/network payload.
3. No change needed downstream (`databaseService.ts`, `types.ts`) — they read the (now-clamped) FormData values exactly as before.

- [ ] **Step 1: Implement the clamp**
- [ ] **Step 2: Manual check** — with a property that has `allowPets: false` (set via Task 2 UI), POST a submission with `hasPets=true` directly (bypass UI, e.g. via curl or a temporary devtools edit) and confirm the stored `guest_submissions.has_pets` is `false`
- [ ] **Step 3: `bun run type-check`**
- [ ] **Step 4: Commit**

```bash
git add supabase/functions/submit-form/index.ts
git commit -m "$(cat <<'EOF'
feat(submit-form): clamp pet/parking/decor fields to property guest-form settings

EOF
)"
```

---

### Task 5: `guestFormSteps.ts` — visibility-flag-based step filtering (D3)

**Files:**

- Modify: `ui/src/features/guest/form/lib/guestFormSteps.ts`

**Interfaces:**

```ts
export type GuestFormVisibilityFlags = {
  isAirbnb: boolean;
  allowParking: boolean;
  allowPets: boolean;
};

export function getGuestFormSteps(flags: GuestFormVisibilityFlags): GuestFormStepConfig[];
export function getGuestFormStepCount(flags: GuestFormVisibilityFlags): number;
export function clampGuestFormStep(step: number, flags: GuestFormVisibilityFlags): GuestFormStepId;
export function isGuestFormStepComplete(
  step: GuestFormStepId,
  values: GuestFormData,
  flags: GuestFormVisibilityFlags
): boolean;
```

Behavior:

1. Replace `AIRBNB_GUEST_FORM_STEPS = ALL_GUEST_FORM_STEPS.slice(0, 4)` (`guestFormSteps.ts:57`) and `getGuestFormSteps(isAirbnb)` (`:59-61`) with a single filter function:
   ```ts
   function buildVisibleSteps(flags: GuestFormVisibilityFlags): GuestFormStepConfig[] {
     return ALL_GUEST_FORM_STEPS.filter((step) => {
       if (step.id === 3) return flags.allowParking; // Parking
       if (step.id === 4) return flags.allowPets; // Pets
       if (step.id === 5) return !flags.isAirbnb; // Payment
       return true; // Guest, Stay always shown
     });
   }
   export function getGuestFormSteps(flags: GuestFormVisibilityFlags) {
     return buildVisibleSteps(flags);
   }
   export function getGuestFormStepCount(flags: GuestFormVisibilityFlags) {
     return buildVisibleSteps(flags).length;
   }
   ```
2. `getFieldsForGuestFormStep(step, values)` (`:78-182`) is keyed by the fixed step **id** (case 1..5) and needs **no change** — callers must now pass the true step id (`activeStepConfig.id`), not the array position (fixed in Task 6).
3. `clampGuestFormStep(step, flags)` (`:184-187`) and `isGuestFormStepComplete(step, values, flags)` (`:190-204`) change their second/third param from `isAirbnb: boolean` to the full `flags` object and call `getGuestFormStepCount(flags)` / `createGuestFormSchema(flags)` (schema signature changes in Task 7).

- [ ] **Step 1: Implement the filter-based rewrite**
- [ ] **Step 2: `bun run type-check`** — expect errors at every call site (fixed in Task 6/7)
- [ ] **Step 3: Commit** (only after Task 6 fixes call sites, to keep the branch buildable — or combine Task 5+6 into one commit if working solo; note for the executing agent: these two tasks are tightly coupled, land them together)

---

### Task 6: `GuestForm.tsx` — id-based step checks + settings wiring

**Files:**

- Modify: `ui/src/features/guest/form/components/GuestForm.tsx`

**Interfaces:**

- Consumes: `GuestFormVisibilityFlags`, `getGuestFormSteps`/`getGuestFormStepCount`/`clampGuestFormStep`/`isGuestFormStepComplete` (Task 5), `GuestFormSettings` from `useGuestPaymentInfo()` (Task 3), `createGuestFormSchema(flags)` (Task 7)

Behavior:

1. Rename the line-146 local variable to avoid colliding with the new "guest form settings" concept:
   ```ts
   const { data: guestPaymentInfo = DEFAULT_GUEST_PAYMENT_INFO } = useGuestPaymentInfo();
   ```
   (was `const { data: guestFormSettings = ... }` — every other reference to that old name in this file must be renamed to `guestPaymentInfo`.)
2. Build the visibility flags once, memoized:
   ```ts
   const visibilityFlags = useMemo<GuestFormVisibilityFlags>(
     () => ({
       isAirbnb,
       allowParking: guestPaymentInfo.allowParking,
       allowPets: guestPaymentInfo.allowPets,
     }),
     [isAirbnb, guestPaymentInfo.allowParking, guestPaymentInfo.allowPets]
   );
   ```
3. Replace all `getGuestFormSteps(isAirbnb)` / `getGuestFormStepCount(isAirbnb)` calls (`:178-179`) with `getGuestFormSteps(visibilityFlags)` / `getGuestFormStepCount(visibilityFlags)`.
4. `activeStepConfig = guestFormSteps[currentStep - 1]` (`:963`) is unchanged — `currentStep` stays a 1-based **position** into the filtered array.
5. Replace every render/logic conditional that compares `currentStep` to a step's semantic id with `activeStepConfig?.id`:
   - `:906-907` `isGuestFormStepComplete(currentStep, ..., isAirbnb)` → `isGuestFormStepComplete(activeStepConfig.id, form.getValues(), visibilityFlags)`
   - `:913` `getFieldsForGuestFormStep(currentStep, values)` → `getFieldsForGuestFormStep(activeStepConfig.id, values)`
   - `:918,922` `clampGuestFormStep(step ± 1, isAirbnb)` → `clampGuestFormStep(step ± 1, visibilityFlags)` (these stay position-space clamps against `getGuestFormStepCount(visibilityFlags)` — no id translation needed here, only the flags param changes)
   - `:1057` `currentStep === 1` → `activeStepConfig?.id === 1` (Guest)
   - `:1158` `currentStep === 2` → `activeStepConfig?.id === 2` (Stay)
   - `:1478` `currentStep === 3` → `activeStepConfig?.id === 3` (Parking)
   - `:1564` `currentStep === 4` → `activeStepConfig?.id === 4` (Pets)
   - `:1884` `currentStep === 5 && !isAirbnb` → `activeStepConfig?.id === 5` (the `!isAirbnb` check becomes redundant since step 5 is already filtered out for Airbnb, but leaving it is harmless — prefer removing it for clarity)
   - `:931,971,1968` (`currentStep !== guestFormStepCount`, `currentStep < guestFormStepCount`, `currentStep === guestFormStepCount`) — **unchanged**, these are legitimately position-space "are we on the last visible step" checks and remain correct regardless of which ids are present.
6. Gate the Surprise Decor checkbox block (`:1429-1474`, inside the Stay step) behind `guestPaymentInfo.allowSurpriseDecor` — wrap the existing JSX in `{guestPaymentInfo.allowSurpriseDecor && (...)}`.
7. Source-prefix label logic (D5/D6) — see Task 8 for the full sweep; this file's specific spots: `:1065` field label, `:1070` placeholder, `:1463` decor confirmation copy, `:1379` `findUs` select `defaultValue` (leave this one — it's the unrelated `findUs` field per D7).
8. Update `createGuestFormSchema(isAirbnb)` call site(s) to `createGuestFormSchema(visibilityFlags)` per Task 7's new signature.

- [ ] **Step 1: Rename `guestFormSettings` → `guestPaymentInfo`, add `visibilityFlags`**
- [ ] **Step 2: Replace step-count/step-list calls with `visibilityFlags`**
- [ ] **Step 3: Replace every `currentStep === N` with `activeStepConfig?.id === N`**
- [ ] **Step 4: Gate the Surprise Decor checkbox**
- [ ] **Step 5: Manual walkthrough** — with a test property where `allowParking=false`: confirm the stepper shows Guest → Stay → Pets → (Payment), Parking never appears, and `getFieldsForGuestFormStep`/step-completion checks still validate the right fields at each visible step. Repeat with `allowPets=false` and with both `allowParking=false` + `allowPets=false`.
- [ ] **Step 6: `bun run type-check && bun run lint`**
- [ ] **Step 7: Commit** (combine with Task 5's changes — see note above)

```bash
git add ui/src/features/guest/form/lib/guestFormSteps.ts \
  ui/src/features/guest/form/components/GuestForm.tsx
git commit -m "$(cat <<'EOF'
feat(guest-form): drive step visibility from resolved property guest-form settings

EOF
)"
```

---

### Task 7: `guestFormSchema.ts` — options object + defense-in-depth clamp

**Files:**

- Modify: `ui/src/features/guest/form/schemas/guestFormSchema.ts`

**Interfaces:**

```ts
export type GuestFormSchemaOptions = {
  isAirbnb: boolean;
  allowParking: boolean;
  allowPets: boolean;
};

export function buildGuestFormSchema(options: GuestFormSchemaOptions): ZodType<...>;
export function createGuestFormSchema(options: GuestFormSchemaOptions): ZodType<...>;
```

Behavior:

1. Change `buildGuestFormSchema(isAirbnb: boolean)` (`:47`) to accept `GuestFormSchemaOptions`. Every internal reference to `isAirbnb` inside the function keeps working unchanged (destructure `const { isAirbnb, allowParking, allowPets } = options;` at the top).
2. Drop the two static module-level exports `guestFormSchema` / `guestFormSchemaAirbnb` (`:430,433`) — schema construction is cheap (a handful of `z.object()` fields), so build fresh per call instead of pre-computing a fixed matrix of combinations. Replace `createGuestFormSchema(isAirbnb)` (`:435-437`) with:
   ```ts
   export function createGuestFormSchema(options: GuestFormSchemaOptions) {
     return buildGuestFormSchema(options);
   }
   ```
   Any remaining direct import of the old `guestFormSchema` constant elsewhere in the codebase must switch to `createGuestFormSchema({ isAirbnb: false, allowParking: true, allowPets: true })` (grep for `from '@/features/guest/form/schemas/guestFormSchema'` importing `guestFormSchema` directly to find call sites — expected: only `guestFormSteps.ts` and `GuestForm.tsx`, both already updated in Tasks 5-6).
3. Add a defense-in-depth `.transform()` at the end of the schema pipeline (after the existing `.superRefine(...)`, `:178-426`) that forces the three fields false when their section is disallowed:
   ```ts
   .transform((data) => ({
     ...data,
     needParking: allowParking ? data.needParking : false,
     hasPets: allowPets ? data.hasPets : false,
   }))
   ```
   (Surprise decor has no `superRefine` branch today — Task 6 already hides its checkbox; add the same transform clamp for `guestRequestsSurpriseDecor` using a captured `allowSurpriseDecor` — extend `GuestFormSchemaOptions` with `allowSurpriseDecor: boolean` and thread it through from `GuestForm.tsx`/`guestFormSteps.ts`'s `visibilityFlags`.)

- [ ] **Step 1: Implement the options-object signature + transform clamp**
- [ ] **Step 2: Update `GuestFormVisibilityFlags` (Task 5) and its call sites (Task 6) to include `allowSurpriseDecor`**
- [ ] **Step 3: `bun run type-check`**
- [ ] **Step 4: Manual check** — submit a form on a property with `allowPets=false` after manually re-enabling the hidden field via devtools (simulate tampering); confirm `schema.parse()` still yields `hasPets: false` client-side, and Task 4's server clamp is the true backstop.
- [ ] **Step 5: Commit**

```bash
git add ui/src/features/guest/form/schemas/guestFormSchema.ts \
  ui/src/features/guest/form/lib/guestFormSteps.ts \
  ui/src/features/guest/form/components/GuestForm.tsx
git commit -m "$(cat <<'EOF'
feat(guest-form): parameterize schema by property guest-form settings

EOF
)"
```

---

### Task 8: Source default → `Direct`, no-prefix labels (D5, D6)

**Files:**

- Modify: `ui/src/features/guest/form/lib/bookingSourceFromSearchParams.ts`
- Modify: `ui/src/features/guest/form/components/GuestForm.tsx`
- Modify: `ui/src/features/guest/form/components/GuestFormGuestsSection.tsx`
- Modify: `ui/src/features/guest/form/lib/bookingFormatter.ts`

**Interfaces:**

```ts
// bookingSourceFromSearchParams.ts
export const BOOKING_SOURCE_OPTIONS = ['Direct', 'Facebook', 'Airbnb'] as const;
export type BookingSource = (typeof BOOKING_SOURCE_OPTIONS)[number];

export function normalizeBookingSource(value: string | null | undefined): BookingSource;
export function bookingSourceFromUrlSearchParams(sp: URLSearchParams): BookingSource;
```

Behavior:

1. `bookingSourceFromUrlSearchParams(sp)` (`:25-29`): change the fallthrough from `'Facebook'` to `'Direct'`:
   ```ts
   export function bookingSourceFromUrlSearchParams(sp: URLSearchParams): BookingSource {
     const v = sp.get('source')?.trim().toLowerCase();
     if (v === 'airbnb') return 'Airbnb';
     if (v === 'facebook') return 'Facebook';
     return 'Direct';
   }
   ```
2. `normalizeBookingSource` (`:22`) gets the same three-way logic (was a 2-way `=== 'Airbnb' ? 'Airbnb' : 'Facebook'`).
3. In `GuestForm.tsx`, derive a tri-state instead of the boolean-only `isAirbnb`:
   ```ts
   const bookingSource = bookingSourceFromUrlSearchParams(searchParams);
   const isAirbnb = bookingSource === 'Airbnb';
   const isFacebook = bookingSource === 'Facebook';
   ```
4. Replace every `isAirbnb ? 'Airbnb X' : 'Facebook X'` two-way ternary with a three-way helper. Add a small local helper near the top of `GuestForm.tsx`:
   ```ts
   function sourceLabel(isAirbnb: boolean, isFacebook: boolean, suffix: string): string {
     if (isAirbnb) return `Airbnb ${suffix}`;
     if (isFacebook) return `Facebook ${suffix}`;
     return suffix; // Direct — no platform prefix
   }
   ```
   Apply at:
   - `:1065` field label → `sourceLabel(isAirbnb, isFacebook, 'Name')` (yields "Full Name"-equivalent — actually yields just "Name"; if a friendlier label is wanted for Direct, use `isAirbnb || isFacebook ? sourceLabel(...) : 'Full Name'` — pick the latter, it reads better)
   - `:1070` placeholder → ``isAirbnb || isFacebook ? `Your exact full name in ${isAirbnb ? 'Airbnb' : 'Facebook'}` : 'Your exact full name'``
   - `:1463` decor confirmation copy → same 3-way swap, drop the platform mention entirely for Direct
5. `GuestFormGuestsSection.tsx:271` "Same as {isAirbnb ? 'Airbnb' : 'Facebook'} Name" — same 3-way treatment (needs `isFacebook` threaded in as a prop from `GuestForm.tsx`, alongside the existing `isAirbnb` prop).
6. `bookingFormatter.ts:25,153-154` "Facebook/Airbnb Name:" copy-paste label — same 3-way swap for the clipboard summary text.
7. On submit, `formData.append('bookingSource', bookingSource)` (`GuestForm.tsx:593`) needs no change — it already appends whatever `bookingSource` resolved to, which is now `Direct`/`Facebook`/`Airbnb` instead of always `Facebook`/`Airbnb`.
8. `findUs` dropdown (`GuestForm.tsx:1387-1392`, `:1379`) — **do not touch**, per D7.

- [ ] **Step 1: Implement the 3-way source resolution in `bookingSourceFromSearchParams.ts`**
- [ ] **Step 2: Update `GuestForm.tsx` label/placeholder logic**
- [ ] **Step 3: Update `GuestFormGuestsSection.tsx` and `bookingFormatter.ts`**
- [ ] **Step 4: Manual check** — load the guest form with no `?source=` param: field label reads "Full Name" (no prefix), submitting stores `booking_source: 'Direct'`. Reload with `?source=facebook`: label reads "Facebook Name". Reload with `?source=airbnb`: label reads "Airbnb Name", Payment step is skipped (unchanged Airbnb behavior).
- [ ] **Step 5: `bun run type-check && bun run lint`**
- [ ] **Step 6: Commit**

```bash
git add ui/src/features/guest/form/lib/bookingSourceFromSearchParams.ts \
  ui/src/features/guest/form/components/GuestForm.tsx \
  ui/src/features/guest/form/components/GuestFormGuestsSection.tsx \
  ui/src/features/guest/form/lib/bookingFormatter.ts
git commit -m "$(cat <<'EOF'
feat(guest-form): default booking source to Direct, no-prefix name label

EOF
)"
```

---

### Task 9: Server + admin-UI `'Facebook'` fallback sweep (D5)

**Files:**

- Modify: `supabase/functions/submit-form/index.ts:237`
- Modify: `supabase/functions/_shared/databaseService.ts:140` (line 138, the `find_us` default, is untouched per D7)
- Modify: `supabase/functions/_shared/types.ts:301`
- Modify: `supabase/functions/_shared/calendarService.ts:441,697`
- Modify: `supabase/functions/_shared/sheetsService.ts:211,533`
- Modify: `supabase/functions/_shared/workflowOrchestrator.ts:997`
- Modify: `supabase/functions/_shared/guestStayGuide.ts:482`
- Modify: `supabase/functions/_shared/propertyTemplateEmailSections.ts:131,827` (`formatBookingSourceLabel`'s fallthrough + a hardcoded sample-data literal)
- Modify: `supabase/functions/_shared/telegramAdmin.ts:241`
- Modify: `ui/src/features/dashboard/bookings/components/ReviewPricingForm.tsx:95,356`
- Modify: `ui/src/features/dashboard/bookings/components/booking-detail/BookingDetailHeader.tsx:36`
- Modify: `ui/src/features/dashboard/bookings/components/booking-detail/panels/OtherInfoPanel.tsx:13`
- Create: `supabase/migrations/<next-timestamp>_booking_source_default_direct.sql`

Behavior:

1. Every literal `|| 'Facebook'` / `?? 'Facebook'` / `: 'Facebook'` fallback for `bookingSource`/`booking_source` listed above becomes `'Direct'`. This is a pure find-and-replace per site — **do not** touch unrelated `'Facebook'` literals in the same files if any exist for other purposes (there are none among the sites listed; each was individually confirmed via `grep -n "booking_source\|bookingSource"` scoping during planning).
2. In `ReviewPricingForm.tsx:95,356` and `OtherInfoPanel.tsx:13` the pattern is `(booking.booking_source || 'Facebook') === 'Airbnb'` / `booking.booking_source || 'Facebook'` feeding an `isAirbnb` boolean — confirmed these only ever branch on `=== 'Airbnb'`, so swapping the fallback to `'Direct'` is a pure no-op for pricing logic and only affects what gets displayed when `booking_source` is literally empty/null (legacy rows). Same for `BookingDetailHeader.tsx:36`.
3. `propertyTemplateEmailSections.ts:131` (`formatBookingSourceLabel`) — the final fallback `: 'Facebook'` becomes `: 'Direct'`; the two explicit `/^airbnb$/i`/`/^facebook$/i` regex branches are untouched (still correctly label real Facebook/Airbnb bookings).
4. New migration — bring the DB column default in line with the new app-level default, for any future direct-insert path that doesn't go through `submit-form` (defensive, low-risk, matches the existing `booking_source TEXT DEFAULT 'Facebook'` column from `20260609120000_add_booking_source.sql`):
   ```sql
   ALTER TABLE guest_submissions
     ALTER COLUMN booking_source SET DEFAULT 'Direct';
   ```
   This does **not** touch existing rows — historical `'Facebook'`/`'Airbnb'` values are left as-is; only the column's default for future inserts without an explicit value changes.

- [ ] **Step 1: Sweep all listed sites** (grep `"|| 'Facebook'"`, `"?? 'Facebook'"`, `": 'Facebook'"` across `supabase/functions` and `ui/src` first to confirm no site was missed since planning time)
- [ ] **Step 2: Write and apply the migration**
  ```bash
  bun run db:migrate
  ```
- [ ] **Step 3: Manual check** — a booking submitted with no `?source=` shows `Direct` in: Calendar event description, Google Sheet "Booking Source" column, Telegram new-booking notification, admin booking detail "Other Info" panel, `ReviewPricingForm` (still computes pricing as non-Airbnb).
- [ ] **Step 4: `bun run type-check && bun run lint && bun run build`**
- [ ] **Step 5: Commit**

```bash
git add supabase/functions/submit-form/index.ts \
  supabase/functions/_shared/databaseService.ts \
  supabase/functions/_shared/types.ts \
  supabase/functions/_shared/calendarService.ts \
  supabase/functions/_shared/sheetsService.ts \
  supabase/functions/_shared/workflowOrchestrator.ts \
  supabase/functions/_shared/guestStayGuide.ts \
  supabase/functions/_shared/propertyTemplateEmailSections.ts \
  supabase/functions/_shared/telegramAdmin.ts \
  ui/src/features/dashboard/bookings/components/ReviewPricingForm.tsx \
  ui/src/features/dashboard/bookings/components/booking-detail/BookingDetailHeader.tsx \
  ui/src/features/dashboard/bookings/components/booking-detail/panels/OtherInfoPanel.tsx \
  supabase/migrations/<next-timestamp>_booking_source_default_direct.sql
git commit -m "$(cat <<'EOF'
fix(booking-source): default to Direct instead of Facebook everywhere

EOF
)"
```

---

### Task 10: Docs sweep

**Files:**

- Modify: `docs/PROJECT.md` (architecture/API notes — new `guestFormSettings` fields on `get-guest-payment-info`, new `properties.settings` keys, updated `bookingSource` default)
- Modify: `docs/guides/routes/org/property/settings.md` (already touched in Task 2 — confirm it documents the toggle behavior for hosts/operators)
- Modify: `docs/workflow/planned/README.md` (index row for this plan — done as part of the writing-plans workflow, not a plan task)
- Modify: `CLAUDE.md` — **only if** a new sharp edge surfaces during implementation (e.g. if a second place still special-cases `isAirbnb` as a boolean instead of the tri-state source); otherwise no change needed.

- [ ] **Step 1: Update `docs/PROJECT.md`**
- [ ] **Step 2: Confirm `docs/guides/routes/org/property/settings.md` reads correctly end-to-end**
- [ ] **Step 3: Commit**

```bash
git add docs/PROJECT.md docs/guides/routes/org/property/settings.md
git commit -m "$(cat <<'EOF'
docs: document guest form settings and Direct booking-source default

EOF
)"
```

---

## Explicit non-goals (this plan)

- **Per-field required/optional customization** inside an enabled section (e.g. making pet breed optional) — backlog, needs its own design pass if requested.
- **Full dynamic form builder** (arbitrary fields/sections/reordering) — explicitly out of scope per product-owner decision; this plan only ships fixed on/off toggles for three existing sections.
- **Residence-type-level defaults** (`developments.settings`) for guest-form config — locked as property-only (D1); revisit only if multiple properties on the same residence need to share a default.
- **Configurable source list** (adding Booking.com, VRBO, etc. per property) — fixed to Direct/Facebook/Airbnb for v1 (locked decision); backlog.
- **`findUs` ("how did you find us") field** — untouched (D7), distinct from `bookingSource`.
- **Parking-request flow / `pay-parking` standalone module** — out of scope, per existing precedent in the parent booking-workflow multi-tenancy doc; this plan only touches the main guest form's parking _step_, not the separate parking-booking flow.

## Verification plan (end-to-end)

1. Local migrate + Azure property (all toggles default `true`): guest form still shows Guest → Stay → Parking → Pets → Payment (Facebook) or → 4 steps (Airbnb via `?source=airbnb`) exactly as today; submitting with no `?source=` stores `booking_source: 'Direct'` and shows "Full Name" (no prefix).
2. Toggle `allowParking=false` on a test property via the new Guest Form settings section: guest form skips the Parking step entirely (Guest → Stay → Pets → Payment); submitting always stores `need_parking: false` even via a tampered payload (Task 4).
3. Toggle `allowPets=false`: Pets step disappears; `has_pets` always `false`.
4. Toggle `allowSurpriseDecor=false`: the decor checkbox disappears from the Stay step; `guest_requests_surprise_decor` always `false`.
5. `?source=facebook` → "Facebook Name" label, `booking_source: 'Facebook'`. `?source=airbnb` → "Airbnb Name" label, Payment step skipped, `booking_source: 'Airbnb'`. No `?source=` → "Full Name" label, `booking_source: 'Direct'`.
6. Admin booking detail (`OtherInfoPanel`, `ReviewPricingForm`, `BookingDetailHeader`) correctly displays "Direct" for such bookings and prices them identically to Facebook-sourced bookings (no Airbnb commission logic applied).
7. `bun run type-check && bun run lint && bun run build`.
8. Property settings Guest Form section usable at 375px; toggles persist across reload.
9. Change **Property Details** check-out to e.g. `12:00` (or any value ≠ legacy guest-form default): new guest form pre-fills Stay-step check-in/out from **`get-guest-payment-info`**; early/late warning banners compare against those property values. **`?bookingId=`** edits keep stored times from **`get-form`**.

## Post-ship delta (2026-08-03)

- **Property check-in/out → guest form:** `resolveGuestFormSettings` also reads `checkInTime` / `checkOutTime` from `properties.settings` (defaults **`14:00`** / **`12:00`**). Exposed on **`get-guest-payment-info`**; guest form pre-fills Stay-step times and uses them for early/late warnings.
- **Unit types + guest capacity:** Development settings **Unit types** section (`developments.settings.unitTypes`); property **Unit type** dropdown drives read-only max adults/children; guest form **Maximum Guests Reminder** + **`submit-form`** occupancy validation use property limits via **`maxAdults`** / **`maxChildren`** on **`get-guest-payment-info`**. See **`get-residence-unit-types`**.

## Completion status

**Shipped (v1).** Tasks 1–10 complete. Follow-up deltas above landed in the same release branch. Manual verification recommended before prod deploy (`kamewave`).

## Open questions

_None — decisions D1–D8 locked with product owner 2026-08-03._
