---
title: 'Smart Pricing — AI-assisted dynamic nightly rates'
status: active
tags: [architecture, pricing, ai, plans]
updated: 2026-09-04
---

# Smart Pricing — AI-assisted dynamic nightly rates

Part of the [`docs/PROJECT.md`](../PROJECT.md) architecture split. Plan of record:
[`../workflow/in-progress/smart-pricing-ai.md`](../workflow/in-progress/smart-pricing-ai.md).

> **Delivery status:** Phases 0–3 shipped (2026-09-04). Schema + `smartPricing` Pro+ plan key,
> the deterministic engine + first-party history learning, the rate-resolution merge (server +
> client), the `smart-pricing-settings` / `-preview` / `-apply` edge functions, the
> `SmartPricingDialog` + Pricing-page button + calendar markers + stats card, the
> `smart-pricing-cron` autopilot sweep + `smart_pricing_updated` notification, and the optional
> Gemini `smart_pricing` rationale / sanity pass. **Phase 4** (length-of-stay discounts,
> min-stay-by-season, external market data, parking parity) is deferred to follow-up plans.

---

## What it is

A paid Pricing-page tool that recommends a nightly rate for every future night from the
property's **own** calendar history and current forward demand. The number is produced by a
**deterministic** engine — `base × Π(multipliers)` clamped to a host `[min, max]` — exactly
like PriceLabs / Beyond / Airbnb Smart Pricing. No LLM sets the price; an optional Gemini pass
(Phase 3) only writes a rationale and flags outliers.

Scope is **first-party data only** — this listing against its own demand curve (fill orphan
gaps, discount dead lead-time, premium-price proven peak weeks). No market/comparable data
(no AirDNA, no scraping) in v1.

---

## Plan gate

`smartPricing` boolean in `pricing_plans.features` — `true` on `growth` (**"Pro"**), `pro`
("Business"), `managed`, `business_plus`; `false` on `free`, `starter`, `commission`. Seeded
by `supabase/migrations/20261305120200_smart_pricing_plan_feature.sql`. Same tier as
`calendarSync` (both are Pricing-page power tools). Typed in
`_shared/planFeatures.ts` + the UI mirror; server gate is
`requirePropertyFeature(propertyId, 'smartPricing')`; team RBAC reuses `pricing.rates:edit`
(no new permission leaf).

---

## The engine — `_shared/smartPricingEngine.ts` (pure)

`computeSmartRates(input)` → one `SmartRateResult` per night. No DB, no network, no clock —
unit-tested in `_shared/smartPricingEngine_test.ts`.

Per eligible night, factors split into two groups:

```
algo = dowDemand × seasonDemand × leadTime × bookingPace       (the learned / inferred signals)
cappedAlgo = clamp(algo, 1 − cap, 1 + cap)                      (cap = 6% / 12% / 22% by aggressiveness)

structural = seasonRule × orphanGap                            (host's explicit intent + a real fill signal)

raw = base(dow) × cappedAlgo × structural
recommended = round( clamp(raw, min, max), rounding )
```

- **`ALGO_DEVIATION_CAP` is the safety floor.** The learned demand curves can never, together,
  move a night more than ±6 % (Gentle) / ±12 % (Balanced) / ±22 % (Bold) off base. A host's
  own `seasonRule` (e.g. "Christmas +40 %") and the `orphanGap` discount are applied **on top
  of** the cap, so explicit intent is always honoured but a thin-data demand curve can't slam
  a night. This is why a new or low-volume listing sees small nudges, never a blanket cut.
- **Deadzone.** After rounding, if the move is `< 2 %` of base and no `seasonRule` / bound was
  involved, the night is snapped back to `baseRate` — no rec row, no calendar marker, no
  "changed" night. Hosts don't care about a ₱50 nudge.
- **`dowDemand` / `seasonDemand` are confidence-blended** toward 1.0 by `(1 − demandConfidence)`
  before the aggressiveness gain, so curves earn influence only as booking volume grows.
- **`bookingPace`** is now an **upward-only** nudge (max +6 % before gain) and fires **only**
  when forward occupancy `> 85 %`. Low forward occupancy on a small listing is normal, not a
  distress signal, so it is never a reason to discount. Off by default
  (`occupancy_tilt_enabled = false`).
- **`leadTime`** last-minute discount is gentle by default (`−8 %` inside 3 days, `−4 %` inside 7) with no speculative far-out premium; suppressed entirely on thin history.
- Every multiplier's **deviation from 1.0** is scaled by an **aggressiveness gain**:
  `conservative 0.5 · balanced 1.0 · aggressive 1.5` (this is separate from the deviation cap).
- `min` / `max` default to `0.6× / 2.5×` base when the host leaves them blank.
- `rounding`: `r50` (nearest 50, default) · `r99` (nearest 100 − 1) · `r100` · `none`.
- **Never repriced:** past nights, booked nights, blocked nights, and host date-override
  ("locked") nights — all returned with `skipped` set and `recommendedRate = baseRate`.
- Each result carries a `factors: [{ key, label, multiplier }]` breakdown for the calendar
  tooltip. `summarizeSmartRates()` rolls a run up to `{ nightsComputed, nightsChanged,
avgDeltaPct }`.
- **Apply / autopilot persist only nights the engine actually moved** (`recommendedRate !==
baseRate`) — an unchanged night resolves to the host's base rate anyway.

---

## Feature extraction — `_shared/smartPricing.ts#gatherHistoryFeatures`

Reads ~24 months of non-`CANCELLED`/`IMPORTED` `guest_submissions` for the property:

| Feature                        | Derivation                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `dowDemand[0..6]` (Sun..Sat)   | share of elapsed booked nights on each weekday ÷ `1/7`, clamped **`0.88–1.15`** (tight — a single weekday can't justify a big swing; the engine also caps the product)                                                                                                                                                                                                                                                                                       |
| `monthDemand[0..11]`           | share of elapsed booked nights in each month ÷ `1/12`, clamped **`0.85–1.20`**                                                                                                                                                                                                                                                                                                                                                                               |
| `forwardOccupancy.d30/d60/d90` | live occupied+blocked ratio over the next 30 / 60 / 90 nights                                                                                                                                                                                                                                                                                                                                                                                                |
| `demandConfidence` (0..1)      | `clamp((elapsedNights − 12) / 128, 0, 1)` — the engine blends the demand curves toward 1.0 by `(1 − demandConfidence)`, so a listing with thin history barely moves off base from demand alone                                                                                                                                                                                                                                                               |
| `medianRealisedNightly`        | median `booking_rate / number_of_nights` — sanity only, never applied                                                                                                                                                                                                                                                                                                                                                                                        |
| `confidence`                   | `low` when **< 20** elapsed booked nights → cold-start branch: `demandConfidence: 0.5`, `monthDemand` neutral, `dowDemand` = a small fixed weekend lift (`Fri/Sat/Sun ≈ +5 %`, weekdays untouched). `computeSmartPricingForProperty` additionally suppresses `leadTime` + `bookingPace` while `confidence === 'low'` — those need booking volume to mean anything. The per-night deviation cap makes the host's chosen aggressiveness safe to respect as-is. |

---

## Data model

| Table                                    | Shape                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `property_smart_pricing_settings`        | 1:1 property. `enabled`, `mode` (`review_only` \| `autopilot`), `base_source` (`property_rates` \| `custom`) + `base_weekday/weekend`, `min_price`, `max_price`, `aggressiveness`, `dow_adjust` jsonb, `season_rules` jsonb, `lead_time` jsonb, `orphan_gap_discount_pct` (default **12**), `occupancy_tilt_enabled` (default **false**), `los_discounts` jsonb (Phase 4), `rounding`, `window_days`, `ai_rationale_enabled`, `last_run_at`. Price-bounds CHECK (`max ≥ min`). The modal exposes only `enabled` · `aggressiveness` · `min_price` / `max_price` · `mode`; the rest keep their defaults. |
| `property_smart_pricing_runs`            | Audit — one row per computation. `trigger` (`cron` \| `manual_preview` \| `manual_apply`), window, `nights_computed/changed`, `avg_delta_pct`, `ai_used`, `credits_consumed`, `error`.                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `property_smart_pricing_recommendations` | PK `(property_id, pricing_date)`. `base_rate`, `recommended_rate`, `factors` jsonb, `applied` + `applied_at`, `source` (`engine` \| `engine_ai`), `run_id`.                                                                                                                                                                                                                                                                                                                                                                                                                                            |

All three: RLS enabled, **no client policy** — edge-function-only via `service_role` GRANTs
(`20261305120100_smart_pricing_grants.sql`), same as `property_pricing_date_overrides`.

### Rate-resolution precedence

```
host lock (property_pricing_date_overrides)   ← always wins, engine skips it
  > blocked night
  > booked night
  > applied smart recommendation (enabled & entitled)   ← the layer this feature adds
  > holiday / season rule
  > weekend / weekday base
```

- Server: `_shared/propertyPricing.ts#resolveNightlyRateForDate` + `computeDefaultBookingRateFromDefaults`
  take a `smartRecommendations?: Record<string, number>` option, resolved above holiday rules.
  `loadPropertyPricing()` returns `smartRecommendations` + `smartPricingEnabled`, computed by
  `_shared/smartPricingRead.ts#loadAppliedSmartRecommendations` — **only** populated when
  `property_smart_pricing_settings.enabled` **and** `resolvePropertyEntitlements().smartPricing`.
  Threaded through `inboxAiGuestContext.ts` (AI quote context).
- Client mirror: `ui/.../pricing/lib/pricingCompute.ts#resolveNightlyRateForDate` /
  `computeDefaultBookingRate` gained the same option; `PropertyPricingDto` carries
  `smartRecommendations` + `smartPricingEnabled` from `property-pricing` GET. Consumed by the
  Pricing calendar (`PropertyPricingPage` → `PricingCalendarGrid` "Smart Pricing" marker +
  tooltip + legend + stats card), the admin booking **pricing review**
  (`ReviewPricingForm` ← `WorkflowPanel` → `WorkflowSubFormHost`), and the AI-assistant
  pricing context calendar.
- **`SmartPricingDialog`** uses **`AdminDialogShell`** (`42rem` wide, fixed header/footer,
  scrollable body). Title only — no subtitle. Two body views (no marketing intro):
  1. **settings** — Off: toggle + footer **Turn on**. On: **Strength**
     (`Gentle ±6% · Balanced ±12% · Bold ±22%`), **Limits** (Min / Max, auto-seeded on enable),
     **Apply** (`When I approve` / `Automatically`). Footer: **Preview** (no AI explain pass —
     `explain: false`). Turning the switch off opens a nested `AlertDialog` confirm, then
     `patch({ enabled: false })` + clear applied recs.
  2. **preview** — compact ₱ totals + chip (`Same` / `+₱N` / `−₱N`), month heatmap (tap a day
     for that night’s factor % lines), otherwise month-scoped drivers
     (`Weekends · ×N · +₱…`, named holiday rules only when in the visible month, gap /
     last-minute / floor hits). No AI prose. Footer: **Back** + **Apply** / **Apply now**.
     Applying closes the dialog and relies on the apply toast.
- **`pricingSave.ts` deliberately does NOT pass `smartRecommendations`** — it bakes resolved
  rates into `property_pricing_date_overrides`, and a smart rate must never be frozen as a
  host lock.
- Downgrade below Pro ⇒ `smartPricingEnabled` goes false, applied recs are ignored everywhere
  (not deleted); the host's manual rates and date overrides are untouched. `SmartPricingDialog`
  shows the Pro-plan notice; re-upgrading resumes from the stored settings.

---

## Edge functions

| Function                 | Method | Auth / gate                                                                                  | Job                                                                                                                                                                                                                                                                                                                                                                             |
| ------------------------ | ------ | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `smart-pricing-settings` | GET    | `resolveScopedPropertyAccess('pricing:view')` — preview-open                                 | `{ settings, appliedCount, resolvedBase, history }`. `appliedCount` = live `recommendations` rows from Manila-today forward (`countAppliedSmartRecommendations`); the modal shows its "N nights priced · Undo" affordance on `appliedCount > 0`, not on `last_run_at` (which lingers after a clear).                                                                            |
| `smart-pricing-settings` | PATCH  | `pricing.rates:edit` + `requirePropertyFeature(id,'smartPricing')` + `catchPlanFeatureError` | upsert `property_smart_pricing_settings`                                                                                                                                                                                                                                                                                                                                        |
| `smart-pricing-preview`  | POST   | `pricing.rates:edit` + `smartPricing` gate                                                   | body `{ explain?: boolean }` (default true). Run engine (+ AI when `explain`), record a `manual_preview` run with the full result set frozen on `runs.payload`, return `{ runId, diff[], summary, next30, ai }` — persists **no** applied rows                                                                                                                                  |
| `smart-pricing-apply`    | POST   | `pricing.rates:edit` + `smartPricing` gate                                                   | `{ runId, ranges? }` → replay the frozen `runs.payload` into `recommendations` (`applied=true`), re-checking booked/blocked/locked/past per night, **and upsert `property_smart_pricing_settings` with `enabled = true`** (applying is the intent to go live) + a real `last_run_at`; `{ clear: true }` drops all recs (`enabled` untouched — the host toggles that separately) |
| `smart-pricing-cron`     | POST   | shared secret (hosted `pg_cron` + `pg_net`)                                                  | nightly sweep of `enabled && mode='autopilot' && entitled` properties; recompute + replace recs; `smart_pricing_updated` notification when ≥ 5 nights changed or abs avg Δ ≥ 3%                                                                                                                                                                                                 |

All four: `config.toml` `verify_jwt = false` (Kong HS256 rejects modern tokens; the real gate
is inside the handler). `smart-pricing-preview` freezes on `runs.payload` so `-apply` writes
exactly what was previewed — the canonical `recommendations` table only ever holds applied
rows (+ autopilot output).

---

## AI layer (additive — `_shared/smartPricingAi.ts`)

`smart_pricing` entry in `_shared/aiModelRouter.ts` (`gemini-2.5-flash`, `flash` tier,
`defaultMaxOutputTokens 768`). `maybeRunSmartPricingAi(propertyId, computation)`:
`resolveOrgIdForProperty` → `assertOrgAndPropertyAiQuota(org, property, 'smart_pricing')` →
one Gemini call with a JSON `responseSchema` → `recordAiUsage({ feature: 'smart_pricing',
actorType: 'system' })`. **Any** failure (no keys, quota, kill switch, unreadable JSON) returns
`null` and the caller uses engine-only output — never a hard failure. Credits count against the
org's `aiMonthlyCreditAllowance` via the shared `ai_platform_*` system.

- `smart-pricing-preview` calls it unless the request sends `{ explain: false }` (result
  stashed on `runs.ai_*` columns + returned).
- `smart-pricing-cron` calls it only when `ai_rationale_enabled` **and** no `ai_used` cron run
  in the last 6 days (credit-cost throttle).
- **Platform allowlist:** `assertOrgAndPropertyAiQuota` respects
  `ai_platform_global_settings.allowed_features` — an empty array means "all features on"; a
  non-empty array must include `smart_pricing` or the pass silently degrades to engine-only.
  Set this from the super-admin AI console (`/admin/ai`, Controls tab) when enabling the AI rationale in prod.
  (Verified locally: with `smart_pricing` in the allowlist, a real Gemini `2.5-flash` call
  returned 3 season rationales + suggested min/max, recorded 1 credit in
  `ai_platform_usage_events`.)

Output (all advisory): `seasonRationales[{label,text}]`, `warnings[]`, and
`suggestedMinPrice`/`suggestedMaxPrice` **only when the host left that bound blank**. It never
touches the deterministic curve.

---

## Verification (per phase, manual — no Vitest/Deno suite in this repo)

- `bun run type-check && bun run lint && bun run build && bun run check:filenames`.
- Migrations applied to local Postgres; `mcp__supabase__get_advisors` (RLS-enabled/no-policy
  is the same benign note every property-scoped table already carries).
- `_shared/smartPricingEngine_test.ts` + `_shared/smartPricingAi_test.ts` (`deno test`) — clamp / rounding / gain-scaling /
  skip-rules / orphan-gap / lead-time / summary math (engine, 9 tests); prompt build / JSON
  extraction / output shaping (AI pass, 6 tests).
- Phase 1+: a night with an applied rec quotes at the smart price through `submit-form` and
  `get-booked-dates`; host lock still wins; booked/blocked untouched; toggling the seed
  entitlement off makes recs ignored.
