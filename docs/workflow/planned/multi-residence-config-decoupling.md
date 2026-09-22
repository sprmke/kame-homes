---
stage: planned
title: 'Multi-residence support — config decoupling from Azure North'
status: planned
tags: [planning, planned-modules, multi-tenancy, developments, architecture]
updated: 2026-09-22
---

# Multi-residence support — config decoupling from Azure North

**Goal.** Support any number of residences / developments / real-estate types without code changes, with per-residence configuration edited from `/admin`, and Azure North reduced to a seeded row that behaves byte-identically to today.

**Scope decision (2026-09-22).** Full audit + decouple. Storage: `developments.settings` JSONB + super-admin UI. Fallback: generic defaults, Azure seeded.

---

## 1. Executive summary — read this before planning headcount

The premise that "the app only supports Azure North and is tightly coupled to it" is **largely already false**. An audit of `ui/src/` and `supabase/functions/` found the multi-tenant architecture shipped and working:

- Org → property / parking scoping with slug routes (`/org/:orgSlug/property/:propertySlug/…`).
- A **`developments`** table (migration `20260719100000_developments.sql`) that already models residences: `slug`, `name`, `developer_name`, `type` (`CONDOMINIUM` / `SUBDIVISION` / `MIXED_USE` / `TOWNHOUSE` / `COMMERCIAL`), `status`, `location`, `city`, `settings JSONB`.
- A shipped super-admin editor at `/admin/developments/:id` with sections for Unit types, Pool, Email automations, Document Requirements, Amenities, Location, and Towers & Parking.
- Per-property settings, configurable document requirements, and configurable guest-form sections, all already tenant-scoped.

**The actual defect is narrower and more specific: a hardcoded TypeScript layer shadows the `developments` table.** Config that should be read from the residence row is instead looked up from in-code maps keyed by the literal string `'Azure North Residences'`.

The clearest single piece of evidence, and the one that should anchor the whole effort:

> `docs/guides/routes/admin/development-detail.md` states that `settings.propertyTowers` / `parkingTowers` / `parkingLevels` "populate tower/level choices offered to admins when they set up individual properties/parking slots."
>
> This is **not true today.** `update-development/index.ts` writes those three keys, and **nothing reads them.** Runtime tower choices come from the hardcoded `PROPERTY_RESIDENCES` array. A super-admin can add a tower to a new development, save successfully, and the tower will never appear anywhere.

So this is a **config-migration and wiring effort**, not a multi-tenancy rebuild. That distinction matters: it is smaller, lower-risk, and does not require touching the org/property scoping, RBAC, plans, or booking workflow layers that already work.

### Measured blast radius

| Measure                                                                                                          | Count |
| ---------------------------------------------------------------------------------------------------------------- | ----- |
| Files referencing Azure in shipping code (excl. mocks/tests)                                                     | 80    |
| Azure references in shipping code (excl. mocks/tests)                                                            | 315   |
| Files with hardcoded **name-matching** (`isAzureNorth*`, `DEFAULT_RESIDENCE_NAME`, `AZURE_NORTH_RESIDENCE_NAME`) | 34    |
| Name-matching call sites                                                                                         | 112   |

Most of the 315 are constant definitions, doc comments, and already-deprecated aliases. **The 112 name-matching call sites across 34 files are the real work.**

### Non-goals

- Re-architecting org / property / parking tenancy. It works; changing it risks regressing shipped code.
- Changing the booking status workflow, plans/entitlements, or RBAC.
- Any behavior change for Azure North. Azure must come out byte-identical — this is the release gate.

---

## 2. The recurring anti-pattern

Nearly every coupling site is the same shape:

```ts
const AZURE_NORTH_DEFAULTS = {/* real values */};
const GENERIC_DEFAULTS = {/* permissive fallback */};

const DEFAULTS_BY_RESIDENCE: Record<string, T> = {
  [DEFAULT_RESIDENCE_NAME]: AZURE_NORTH_DEFAULTS, // 'Azure North Residences'
};

export function getX(residenceName: string): T {
  return DEFAULTS_BY_RESIDENCE[residenceName.trim()] ?? GENERIC_DEFAULTS;
}
```

Three structural problems:

1. **String-keyed identity.** Residences are identified by a display name, not by `development_id`. Renaming a development in `/admin` silently detaches its config. There is no FK — `properties.residence_name` / `parkings.residence_name` are free text matched case-sensitively against `developments.name`.
2. **Duplicated across the wire.** Every file exists twice — once in `ui/src/…` and once in `supabase/functions/_shared/…` — kept in sync only by a `/** keep in sync */` comment. Drift is unenforced by CI.
3. **Config is in code, so onboarding a residence needs a deploy.** This is the thing that actually blocks the stated goal.

**Target shape:** one resolver, fed by the `developments` row, keyed by `development_id`, with `GENERIC_DEFAULTS` as the documented fallback.

---

## 3. Config inventory — every hardcoded value and its destination

Verified by reading each file. "Read at runtime?" is the critical column: it separates _rewiring_ from _net-new plumbing_.

| #   | Config                                                                                    | Current location (ui + edge)                                | `settings` key                                | Read at runtime today?                             |
| --- | ----------------------------------------------------------------------------------------- | ----------------------------------------------------------- | --------------------------------------------- | -------------------------------------------------- |
| 1   | Property towers                                                                           | `propertyResidences.ts` → `PROPERTY_RESIDENCES`             | `propertyTowers`                              | **No — write-only orphan**                         |
| 2   | Parking towers                                                                            | `parkingResidences.ts` → `AZURE_NORTH_PARKING_TOWERS`       | `parkingTowers`                               | **No — write-only orphan**                         |
| 3   | Parking levels                                                                            | `parkingResidences.ts` → `AZURE_NORTH_PARKING_LEVELS`       | `parkingLevels`                               | **No — write-only orphan**                         |
| 4   | Occupancy / structure ranges (bedrooms, bathrooms, floors max 29, maxAdults, maxChildren) | `propertyResidenceDefaults.ts`                              | `propertyDefaults` (new)                      | No — from code map                                 |
| 5   | Check-in / check-out time (`14:00` / `12:00`)                                             | `propertyResidenceDefaults.ts`                              | `propertyDefaults` (new)                      | No — from code map                                 |
| 6   | Unit types (Studio / 1BR / 2BR)                                                           | `unitTypes.ts` → `DEFAULT_AZURE_NORTH_UNIT_TYPES`           | `unitTypes`                                   | Partial                                            |
| 7   | Map center (15.1696, 120.5598) + seed address                                             | `propertyLocation.ts`, `propertyLocationDefaults.ts`        | `latitude`/`longitude`/`address`              | Partial — Azure-only branch in `publicGeoScope.ts` |
| 8   | PMO email (`stlmonaco.…@azurenorth.com.ph`)                                               | `propertyEmailAutomationDefaults.ts` → `AZURE_PMO_EMAIL`    | `pmoEmail`                                    | **Yes** — `loadDevelopmentPmoEmailByName`          |
| 9   | Email automation copy (label/hint/placeholder)                                            | `propertyEmailAutomationDefaults.ts`                        | `emailAutomationCopy` (new)                   | No — from code map                                 |
| 10  | Pool fee (₱200) + schedule                                                                | `developmentGuestInfo.ts`                                   | `poolFee`, `poolSchedule`                     | **Yes**, but Azure-only merge override             |
| 11  | Document requirements (GAF + pet)                                                         | `documentRequirements.ts` → `DEFAULT_DOCUMENT_REQUIREMENTS` | `workflowDefaults.documentRequirements`       | **Yes** — best-shaped example in the codebase      |
| 12  | Occupancy child-age rule (≤3)                                                             | `guestCounts.ts` → `OCCUPANCY_CHILD_MAX_AGE`                | `propertyDefaults.occupancyChildMaxAge` (new) | No — module constant                               |
| 13  | Reserved display names (`azurenorth*`)                                                    | `reservedDisplayNames.ts`                                   | platform-level, not per-residence             | Platform constant                                  |
| 14  | Legacy brand regex (`Kame Home — Azure North`)                                            | `platformBrand.ts`                                          | n/a — legacy migration aid                    | Keep as-is                                         |

**Items 11 and 8 are the reference implementations.** `documentRequirements.ts` already does exactly what we want everywhere: residence-type default on `developments.settings.workflowDefaults`, per-property override on `app_settings`, resolved at runtime by a parser with a typed fallback. **Copy that pattern rather than inventing a new one.**

Items 13 and 14 are _correctly_ hardcoded — platform-level brand protection, not residence config. Leave them.

---

## 4. Target architecture

### 4.1 Identity: add a real foreign key

The root cause of string-keyed fragility. Additive and reversible:

```sql
ALTER TABLE properties ADD COLUMN development_id UUID REFERENCES developments(id);
ALTER TABLE parkings   ADD COLUMN development_id UUID REFERENCES developments(id);

UPDATE properties p SET development_id = d.id
  FROM developments d WHERE TRIM(p.residence_name) = TRIM(d.name);
-- same for parkings
```

`residence_name` stays as a denormalized display/compat column through the whole effort. Do **not** drop it in this plan — `delete-development` and several public reads still match on it, and dropping it is a separate, later migration once nothing reads it.

### 4.2 Resolver: one module, mirrored

New `supabase/functions/_shared/residenceConfig.ts` + `ui/src/lib/residence/residenceConfig.ts`:

```ts
export type ResidenceConfig = {
  developmentId: string | null;
  name: string;
  type: DevelopmentType;
  propertyTowers: string[];
  parkingTowers: string[];
  parkingLevels: string[];
  unitTypes: DevelopmentUnitType[];
  propertyDefaults: ResidencePropertyDefaults;
  emailAutomationCopy: EmailAutomationFieldCopy;
  pmoEmail: string | null;
  poolFee: number | null;
  poolSchedule: string;
  coords: { latitude: number; longitude: number } | null;
  address: string | null;
  documentRequirements: DocumentRequirement[];
};

export function parseResidenceConfig(row: DevelopmentRow | null): ResidenceConfig;
export async function loadResidenceConfig(
  supabase: SupabaseClient,
  developmentId: string | null
): Promise<ResidenceConfig>;
```

**Resolution order, three layers, applied per key:**

```
property/parking settings override  →  developments.settings  →  GENERIC_DEFAULTS
```

Per-key, not whole-object: a development that sets only `poolFee` must still inherit generic `propertyDefaults`. Merge shallowly at the key level and document it in the module header.

**Parsing is total.** Never throw on malformed `settings` — a bad JSONB value must degrade to the generic default and log, never 500 a public listing page. `documentRequirements.ts` already models this; follow it.

**Unknown `residence_name` with no matching development** resolves to `GENERIC_DEFAULTS` with `developmentId: null`. This is the MVP fallback decision and it must be explicit and tested, because it is the path every new host hits.

### 4.3 Caching

`loadResidenceConfig` sits on hot public read paths (`search-listings`, listing detail, guest form). Cache per-request; developments change rarely. Do **not** add cross-request caching in phase 1 — measure first. A stale residence config after a super-admin edit is a worse bug than a few extra reads.

### 4.4 Drift enforcement

The ui/edge mirror duplication is the standing risk. Add a CI check comparing the exported type surface and default constants of each mirrored pair, failing on divergence. Without this, phase 1 re-creates the problem it fixes. Wire into `bun run ci:quality`.

---

## 5. Phased delivery

Ordered so each phase ships independently and Azure behavior is provable at every step.

### Phase 0 — Foundation (no behavior change)

- [ ] Migration: `development_id` on `properties` + `parkings`, backfill, index. No `NOT NULL` yet.
- [ ] Migration: backfill Azure's existing hardcoded values into its `developments.settings` row — items 4, 5, 9, 12 from §3, plus `propertyDefaults` and `emailAutomationCopy`. Idempotent (`ON CONFLICT` / guarded `jsonb_set`).
- [ ] Build `residenceConfig.ts` (both sides) + parsers + `GENERIC_DEFAULTS`.
- [ ] Unit tests: parser totality, per-key merge, malformed-JSONB degradation, unknown-residence fallback.
- [ ] CI drift check for mirrored modules.

**Gate:** no runtime reads the new module yet. Zero behavior change, fully revertible.

### Phase 1 — Fix the write-only orphans (highest value, lowest risk)

Items 1–3. These are already editable in `/admin` and already broken, so there is no regression surface beyond Azure.

- [ ] `propertyTowerUnit.ts` (both sides) reads towers from resolver, not `ALL_PROPERTY_TOWERS`.
- [ ] `parkingSlotUnit.ts` reads parking towers/levels from resolver.
- [ ] `PropertyProfileSettingsSections.tsx` — residence + tower dropdowns from resolver.
- [ ] `OnboardingPage.tsx:252` — `getTowersForResidence(DEFAULT_RESIDENCE_NAME)` becomes the org's actual development.
- [ ] Delete `ORG_DEVELOPMENTS` from `orgDevelopments.ts` (the hardcoded array shadowing the table).
- [ ] Tower validation in `create-property` / `create-parking` uses resolver.

**Gate:** create a second test development with distinct towers in `/admin`; its towers appear in property and parking setup. Azure's dropdowns unchanged.

### Phase 2 — Property + guest-form defaults

Items 4, 5, 6, 12.

- [ ] `propertyResidenceDefaults.ts` (both sides) → resolver-backed; delete `DEFAULTS_BY_RESIDENCE`.
- [ ] `defaultPropertySettingsForResidence` takes `developmentId`.
- [ ] `unitTypes.ts` → resolver; delete `DEFAULT_AZURE_NORTH_UNIT_TYPES`.
- [ ] `guestFormSettings.ts:105` — drop the `|| DEFAULT_RESIDENCE_NAME` fallback.
- [ ] `guestCounts.ts` — occupancy child-age from config; retire `AZURE_*` deprecated aliases.
- [ ] Guest form occupancy validation (`guestFormSchema.ts`) uses resolved capacity. Rename the `azureAgeCounts` local.

**Gate:** guest form for a non-Azure property enforces _its own_ limits; Azure's floor cap (29) and 4-adult rule are unchanged.

### Phase 3 — Location, email, pool

Items 7, 9, 10.

- [ ] `publicGeoScope.ts:48` — remove `isAzureNorthResidence` branch; coords from config.
- [ ] `create-property/index.ts:100-117` — remove the `?? 'Azure North Residences'` default and the `azureLocation` branch; seed location from resolved config.
- [ ] `propertyEmailAutomationDefaults.ts` → resolver; delete `AZURE_PMO_EMAIL` constant (value moves to the seeded row).
- [ ] `developmentGuestInfo.ts` — delete `mergeDevelopmentPoolSettings` Azure override; values come from the row.
- [ ] `appSettings.ts:414/418/484` — drop `DEFAULT_RESIDENCE_NAME` fallbacks.

**Gate:** a non-Azure property with a map pin appears correctly in radius search; its PMO email routes approvals to its own development.

### Phase 4 — Super-admin editor completion

- [ ] Add missing sections to `/admin/developments/:id`: `propertyDefaults` (ranges, check-in/out), `emailAutomationCopy`, occupancy child age.
- [ ] Validate on save: `min ≤ default ≤ max`, time format, unit-type id uniqueness.
- [ ] Surface "inherited from generic default" vs "explicitly set" per field so operators can see what is actually configured.
- [ ] Development **type** presets (`CONDOMINIUM` vs `SUBDIVISION` vs `TOWNHOUSE`) as _seed-time_ suggestions that write concrete values — **not** a runtime resolution layer. (Deliberate: the user chose generic-defaults fallback; a second runtime defaults layer would add a hard-to-test interaction.)
- [ ] `activity_log` events for development config writes (per `audit-logging`).

### Phase 5 — Full route audit (the "every page and section" sweep)

Phases 1–4 are driven by static analysis. This phase catches what grep cannot: copy, empty states, and assumptions that read as single-tenant without naming Azure.

Audit each route against a fixed checklist — **(a)** hardcoded residence/tower/unit copy, **(b)** empty state when the org has no development, **(c)** behavior with 2+ developments, **(d)** mobile at 375px:

**Public / guest:** `index-landing`, `search`, `properties`, `properties/chat`, `developments`, `parkings`, `property-showcase`, `calendar`, `form`, `success`, `sd-form`, `stay-guide`, `services`, `for-hosts`, `bookings/parking`, `guest-booking-document`, `legal`, `auth`, `sign-in`, `accept-invite`.

**Guest account:** `account/index`, `stays`, `messages`, `profile`, `tickets`, `vouchers`, `favorites`, `wishlist`.

**Org / property dashboard:** `org/selector`, `dashboard`, `properties`, `parkings`, `settings`, `team`, `plans`, `activity`, `analytics`, `announcements`, `inbox`, `help-support`, `setup-guide`, `onboarding`, plus every `org/property/*` (bookings, bookings-detail, calendar, finance, maintenance, pricing, marketing, templates, public-pages, custom-pages, operations, staff, settings, notifications) and every `org/parking/*`.

**Super-admin:** `admin/developments`, `development-detail`, `orgs`, `hosts`, `host-detail`, `org-properties`, `platform-properties`, `approvals`, `settings`, `platform-tools`, `pricing-plans`, `org-subscriptions`, `parking-payouts`, `announcements`, `support`, `overview`, `playbook`.

Known targets already spotted: `propertyOverviewStats.ts:12` gates a stat on `isKnownResidence`; `inboxMockData.ts`, `mockProperties.ts`, `mockDevelopments.ts`, `mockParkingSlots.ts` are Azure-shaped demo data; `SceneAct1/4/5.tsx` in the for-hosts film hardcode Azure copy.

Record findings as a checklist table in this doc rather than fixing inline, so the sweep stays reviewable.

### Phase 6 — Cleanup and hardening

- [ ] Delete `propertyResidences.ts`, `parkingResidences.ts`, `orgDevelopments.ts` (both sides) once unreferenced.
- [ ] Remove deprecated `AZURE_*` aliases in `guestCounts.ts`.
- [ ] Consider `development_id NOT NULL` once backfill is proven.
- [ ] Seed a second demo development in `seed.sql` so local dev is never single-residence — this is what makes regressions self-evident going forward.

---

## 6. Risks

| Risk                                    | Mitigation                                                                                                                                                                           |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Silent Azure behavior change            | Snapshot `get-guest-payment-info`, `resolve-app-settings`, `search-listings`, and guest-form settings for Azure **before** Phase 0; diff after each phase. This is the primary gate. |
| Rename detaches config                  | `development_id` FK in Phase 0, before any resolver work.                                                                                                                            |
| ui/edge drift                           | CI drift check in Phase 0.                                                                                                                                                           |
| Malformed `settings` 500s a public page | Total parsers + degradation tests.                                                                                                                                                   |
| Scope creep into tenancy rework         | Explicit non-goal in §1.                                                                                                                                                             |
| 34-file change set is hard to review    | Phase boundaries are independently shippable; never one PR.                                                                                                                          |

**Rollback:** Phases 0–3 are additive — the FK and backfilled `settings` are harmless if resolvers revert. Phase 6 deletions are the first irreversible step; hold until Azure snapshots pass on prod-like data.

---

## 7. Open questions

1. **Multi-development orgs.** Onboarding assumes one development per org (`DEFAULT_DEVELOPMENT_NAME`). Should an org host properties across several? Affects Phase 1 onboarding UI. **Assumed yes** — the resolver is per-property, not per-org, so this costs nothing now but should be confirmed.
2. **Non-condo types.** `SUBDIVISION` / `TOWNHOUSE` have no towers. Does the tower/unit field become a free-text "lot/block", and is that a Phase 4 concern or a follow-up plan?
3. **Who creates developments?** Super-admin only today. Self-serve host creation would need a verification path — likely its own plan.
4. **`residence_name` retirement.** Out of scope here; needs a follow-up once `development_id` is `NOT NULL`.

---

## 8. Documentation to update (per `documentation-maintenance`)

`docs/architecture/overview.md`, `data-model.md` (FK + settings schema), `docs/guides/routes/admin/development-detail.md` (**correct the Towers & Parking claim once it becomes true**), `org/property/settings.md`, `onboarding.md`, `form.md`, `search.md`, `.cursor/rules/booking-workflow.mdc` if doc-requirement resolution changes, and `docs/archive/operations/migration-runbook.md` for the backfill.

Invoke `route-guides` for every route touched in Phase 5, `mobile-responsive` for Phase 1/4 UI, and `audit-logging` for Phase 4 config writes.

---

## 9. Related

- [`docs/guides/routes/admin/development-detail.md`](../../guides/routes/admin/development-detail.md) — existing editor
- [`docs/workflow/done/booking-workflow-multi-tenancy.md`](../done/booking-workflow-multi-tenancy.md)
- [`docs/workflow/done/guest-form-configurable-sections.md`](../done/guest-form-configurable-sections.md)
- [`docs/workflow/done/booking-workflow-configurable-docs.md`](../done/booking-workflow-configurable-docs.md) — the pattern to copy
- [`docs/workflow/done/public-operational-guest-pages-multi-tenant.md`](../done/public-operational-guest-pages-multi-tenant.md)
