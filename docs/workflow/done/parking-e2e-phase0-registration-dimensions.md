---
stage: done
title: 'Parking E2E — Phase 0: Registration & Dimensions'
status: implemented
tags: [planning, planned-modules, parking, multi-tenancy]
updated: 2026-08-17
---

# Parking E2E — Phase 0: Registration & Dimensions

Part of the [Parking E2E Phase 0/1 plan set](./parking-e2e-phase1-overview.md).

**Goal:** Persist which vehicle types a slot accepts, and derive car-size fit from existing dimension fields so Phase 1 candidate matching (and later Phase 2a scoring) has a single source of truth.

**Architecture:** Add `parkings.accepted_vehicle_types TEXT[]`. Keep raw dimensions in `parkings.settings` (`spaceLengthM`, `spaceWidthM`, `heightClearanceM`). Expose `resolveVehicleFit` as a pure function — do **not** store derived tiers.

---

## Context

`parkings.parking_type` (`inside_tower` \| `outside_tower` \| `motorcycle`, `supabase/migrations/20260918120000_parkings.sql`) describes **structure**, not guest vehicle compatibility. Dimensions already exist in settings + `ParkingDetailsSection.tsx` — Phase 0 wires vehicle-type checkboxes and a live fit preview.

## Locked decisions

| Item         | Choice                                                                                                                                                                                           |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Storage      | Column `parkings.accepted_vehicle_types TEXT[] NOT NULL DEFAULT '{car}'` with `CHECK (accepted_vehicle_types <@ ARRAY['car','motorcycle']::text[] AND cardinality(accepted_vehicle_types) >= 1)` |
| Queryability | Column (not JSONB) so Doc 3 can use `accepted_vehicle_types @> ARRAY[$type]::text[]`                                                                                                             |
| Fit tiers    | Derived only: `compact` \| `sedan` \| `suv` \| `van` (motorcycle slots skip car tiers)                                                                                                           |
| UI surfaces  | Registration (`create-parking` / org onboarding if applicable) + Settings (`ParkingSettingsCard` / `ParkingDetailsSection`) — Phase 1b folded here                                               |
| Defaults     | Existing rows: `'{car}'`; if `parking_type = 'motorcycle'`, backfill `'{motorcycle}'`                                                                                                            |

### `resolveVehicleFit` thresholds (meters, inclusive minimums)

Lock these constants in `_shared/parkingDimensionDefaults.ts` and mirror in `ui/.../parking/lib/parkingDimensionDefaults.ts`:

| Tier      | Min length | Min width | Min height clearance |
| --------- | ---------: | --------: | -------------------: |
| `compact` |        4.0 |       1.8 |                  1.6 |
| `sedan`   |        4.5 |       2.0 |                  1.8 |
| `suv`     |        5.0 |       2.2 |                  2.0 |
| `van`     |        5.5 |       2.3 |                  2.2 |

A slot “supports” a tier when **all three** dimensions meet that tier’s minimums (using resolved defaults when unset — existing `resolveParking*` helpers). Preview lists tiers from largest-fitting downward, plus motorcycle if `accepted_vehicle_types` includes it.

---

### Task 1: Migration — `accepted_vehicle_types`

**Files:**

- Create: `supabase/migrations/<ts>_parking_accepted_vehicle_types.sql`
- Modify: none (do not edit `20260918120000_parkings.sql`)

**Interfaces:**

- Produces: `parkings.accepted_vehicle_types: text[]`

- [x] **Step 1:** Add column + check + backfill + index for containment queries. (`20261016120000_parking_accepted_vehicle_types.sql`)

```sql
ALTER TABLE public.parkings
  ADD COLUMN IF NOT EXISTS accepted_vehicle_types TEXT[] NOT NULL DEFAULT ARRAY['car']::text[];

ALTER TABLE public.parkings
  ADD CONSTRAINT parkings_accepted_vehicle_types_check
  CHECK (
    accepted_vehicle_types <@ ARRAY['car', 'motorcycle']::text[]
    AND cardinality(accepted_vehicle_types) >= 1
  );

UPDATE public.parkings
SET accepted_vehicle_types = ARRAY['motorcycle']::text[]
WHERE parking_type = 'motorcycle'
  AND accepted_vehicle_types = ARRAY['car']::text[];

CREATE INDEX IF NOT EXISTS parkings_accepted_vehicle_types_gin_idx
  ON public.parkings USING GIN (accepted_vehicle_types);
```

- [ ] **Step 2:** `bun run db:migrate` — expect clean apply.
- [ ] **Step 3:** Commit migration only.

---

### Task 2: `resolveVehicleFit` (shared + UI mirror)

**Files:**

- Modify: `supabase/functions/_shared/parkingDimensionDefaults.ts`
- Modify: `ui/src/features/dashboard/parking/lib/parkingDimensionDefaults.ts` (keep thresholds identical)

**Interfaces:**

- Produces:

```ts
export type CarSizeTier = 'compact' | 'sedan' | 'suv' | 'van';

export function resolveVehicleFit(input: {
  spaceLengthM: number;
  spaceWidthM: number;
  heightClearanceM: number;
  acceptedVehicleTypes: ReadonlyArray<'car' | 'motorcycle'>;
}): { carTiers: CarSizeTier[]; acceptsMotorcycle: boolean };
```

- [x] **Step 1:** Implement pure function + export thresholds as named constants.
- [ ] **Step 2:** Manual boundary checks (or Deno/UI unit test when harness exists): clearance 1.7 → compact only among cars; 2.2+ with large L/W → includes van.
- [ ] **Step 3:** Commit.

---

### Task 3: Persist on create/update + settings UI

**Files:**

- Modify: `supabase/functions/create-parking/index.ts` (and org create-parking path in `create-organization` if it inserts parkings)
- Modify: parking update path used by settings (`update-parking` / `parking-settings` — use the same function `ParkingSettingsCard` already calls)
- Modify: `ui/src/features/dashboard/parking/lib/parkingSettingsForm.ts` — draft `acceptedVehicleTypes: Array<'car'|'motorcycle'>`
- Modify: `ui/src/features/dashboard/parking/components/ParkingSettingsCard.tsx` — checkboxes for Car / Motorcycle
- Modify: `ui/src/features/dashboard/parking/components/ParkingDetailsSection.tsx` — live “Fits: …” preview from `resolveVehicleFit` (short label only)

**Interfaces:**

- Consumes: `resolveVehicleFit`
- API body field: `acceptedVehicleTypes: ('car'|'motorcycle')[]` (camelCase at edge; snake in DB)

- [x] **Step 1:** Validate non-empty subset of `{car, motorcycle}` server-side; reject empty array.
- [x] **Step 2:** Wire UI checkboxes + fit preview that updates as length/width/height change.
- [ ] **Step 3:** Save round-trip: edit → reload → values persist. (needs live/manual verification)
- [x] **Step 4:** `bun run lint && bun run type-check`. (0 errors, 210 pre-existing warnings unrelated to parking)
- [ ] **Step 5:** Commit.

---

## Verification

1. Motorcycle-type parking backfill → `accepted_vehicle_types = {motorcycle}`.
2. Height below sedan minimum → preview omits sedan/SUV/van.
3. Candidate query precursor: `WHERE accepted_vehicle_types @> ARRAY['car']` returns only car-accepting slots.
4. `bun run lint && bun run type-check && bun run build`.
