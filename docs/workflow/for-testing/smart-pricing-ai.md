---
stage: for-testing
title: 'Smart Pricing — AI-assisted dynamic nightly rates'
status: for-testing
tags: [workflow, for-testing, pricing, ai, plans, revenue]
updated: 2026-09-04
kind: plan
---

# Smart Pricing — AI-assisted dynamic nightly rates

**Supersedes / expands** the shortlist item #9 "Dynamic pricing suggestions" in
[`../planned/ai-opportunities-roadmap.md`](../planned/ai-opportunities-roadmap.md). Sibling
power-tool to Channel Sync — same Pricing-page surface, same **Pro (`growth`) +** gate.

---

## Delivery status — Phases 0–3 SHIPPED (2026-09-04); Phase 4 deferred

| Area                      | What shipped                                                                                                                                                                                                                                                                                        |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Schema** (6 migrations) | `20261305120000` schema (3 tables + RLS) · `…120100` grants · `…120200` `smartPricing` plan key (Pro+, `UPDATE 3` / `UPDATE 4`) · `…120300` `runs.payload` + AI columns · `…120400` `smart_pricing_updated` notification type · `…120500` `sync_smart_pricing_cron_job()` (`30 17 * * *` UTC)       |
| **Engine (pure)**         | `_shared/smartPricingEngine.ts` — `base × Π(mult)` clamp+round; `_test.ts` **9/9**; `_shared/smartPricingAi_test.ts` **6/6** (prompt / JSON parse / output shape) — both `deno test`                                                                                                                |
| **Feature extraction**    | `_shared/smartPricing.ts#gatherHistoryFeatures` (24-mo DOW/month demand + forward occupancy; cold-start fallback) + validated settings load/save                                                                                                                                                    |
| **Orchestrator**          | `_shared/smartPricingRun.ts` — compute / persist-preview (freeze on `runs.payload`) / `applyRun` (replay + re-check availability) / `runAutopilotForProperty` / `clearRecommendations`                                                                                                              |
| **Read merge**            | `_shared/smartPricingRead.ts#loadAppliedSmartRecommendations` (enabled **and** entitled) → `loadPropertyPricing` returns `smartRecommendations` + `smartPricingEnabled`; `resolveNightlyRateForDate` + `computeDefaultBookingRateFromDefaults` honour it; threaded through `inboxAiGuestContext.ts` |
| **Edge functions**        | `smart-pricing-settings` (GET/PATCH), `smart-pricing-preview` (POST), `smart-pricing-apply` (POST), `smart-pricing-cron` (POST) — all in `config.toml`; gates `pricing.rates:edit` + `requirePropertyFeature('smartPricing')` + `catchPlanFeatureError`                                             |
| **AI pass**               | `_shared/smartPricingAi.ts` + `aiModelRouter` `smart_pricing` (`gemini-2.5-flash`) — rationale / warnings / blank-only min-max; degrades to null; credits via `ai_platform_*`                                                                                                                       |
| **Client**                | `pricingCompute.ts` + `propertyPricingApi.ts`; `smartPricingApi.ts` + `useSmartPricing.ts`; `SmartPricingDialog.tsx` (`AdminDialogShell` — settings / preview; month-scoped drivers + tap-day factors via `smartPricingPreviewExplain.ts`); calendar `Wand2` marker + stats card                    |
| **Notification**          | `smart_pricing_updated` (server `notificationService.ts` + client `notificationsApi.ts`/`notificationsDisplay.ts`) — deduped `smart_pricing:<propertyId>:<manila-date>`                                                                                                                             |
| **Docs**                  | `architecture/smart-pricing.md` (new), `PROJECT.md`, `plans-feature-matrix.md`, route guide `org/property/pricing.md`, `org/plans.md`, `for-hosts.md`, `scheduled-jobs-and-testing.md`, `validation-and-env.md`                                                                                     |

### Verified this session

- `bun run type-check` / `lint` (0 errors) / `build` / `check:filenames` — all clean.
- `deno test` — engine **9/9** + AI pass **6/6** (clamp, rounding, gain-scaling, skip
  rules, orphan gap, lead-time, summary).
- `deno check` on all 8 new/edited edge modules — **zero errors anchored to Smart Pricing
  files** (the ~61 remaining are pre-existing transitive `dayjs`/`uploadService`/`telegram`
  issues under Deno 2.9, unrelated).
- All 6 migrations applied to local Postgres; schema + notification CHECK verified.
- `supabase functions serve` — `smart-pricing-settings` / `-preview` / `-apply` boot cleanly
  and return `401` for an anon token (auth guard fires).
- **`smart-pricing-cron` ran end-to-end** against a seeded autopilot property on real local
  data: `{candidates:1, processed:1, applied:365, notified:1, errors:[]}` — 365 recs persisted
  with factor breakdowns, `cron` run row logged, `smart_pricing_updated` notification created,
  `last_run_at` set. Test data cleaned up afterward.

### Local browser walkthrough — DONE 2026-09-04 (Playwright, real Pro-owner session on `kame-homes` / `uptown-summit-2br-1663`)

1. ✅ **Pro-entitled happy path.** Smart Pricing button renders (no badge on Pro). Dialog opens
   with Overview / Advanced / Suggestions tabs, the **"Learning — limited booking history"**
   badge (cold-start property), Mode radio, min/max, aggressiveness. Enable toggle → set
   min ₱3,200 / max ₱9,000 → **Save settings** → **Preview suggestions**: auto-switched to
   **Suggestions (7)**, summary "365 of 365 future nights change · avg -13.5%", 7 contiguous
   ranges each with per-range **Apply** (Christmas 12-24→12-26 **+33.2%**, All Saints 11-01→11-02
   **+12.1%**, shoulder ranges -14 to -16%). **Apply all** → toast, dialog re-fetches, Enable
   toggle stays on, label flips to **"Recompute suggestions"**, **"Clear applied rates"** +
   real **"Last run 9/4/2026, 9:51:19 AM"** appear. Calendar: Sept 5+ cells show the emerald
   **`Wand2`** marker; prices become the smart rates with the **₱3,200 floor visibly holding**
   on weekday nights; cell aria-label reads "…, Smart Pricing rate". **Pricing summary** shows
   a 5th **Smart Pricing: 26** card. **Clear applied rates** → toast → calendar reverts to
   base rates, markers + stat card gone.
2. ✅ **Below-Pro gate.** Org downgraded to `starter` in the DB: Smart Pricing button shows a
   **Pro** `TierBadge`; dialog opens (preview-open) with the yellow **"Smart Pricing is
   available on the Pro plan and above"** notice; all inputs/buttons disabled. Server:
   `PATCH smart-pricing-settings` and `POST smart-pricing-preview` return **429**
   `{upgradeHook:true, feature:"smartPricing"}`. `GET` stays 200.
3. ✅ **Downgrade safety.** With recs applied on Pro, flipping the org to `starter`:
   `property-pricing` GET returns `smartPricingEnabled:false` + `smartRecommendations:{}`
   immediately; calendar reverts; `property_smart_pricing_recommendations` rows are **not
   deleted** (verified in DB). Pro restored afterward; all test data purged.
4. ✅ **`smart-pricing-cron`** (from the earlier session) ran end-to-end on a seeded autopilot
   property: `{candidates:1, processed:1, applied:365, notified:1, errors:[]}` — 365 recs +
   `cron` run row + `smart_pricing_updated` notification + `last_run_at`.

**Two fixes made during this walkthrough** (both verified, both kept):

- **`_shared/smartPricingRun.ts#touchLastRun`** — now upserts the settings row and sets
  `enabled = true` on **apply / autopilot** (was a plain `UPDATE … WHERE property_id` that
  no-op'd when no row existed, so a first-time Review-only apply left `enabled = false` and the
  applied recs never merged into the calendar/quotes). Applying a recommendation is the
  explicit intent to go live.
- **`_shared/smartPricingRun.ts`** — `last_run_at` / `applied_at` / `updated_at` now use
  `new Date().toISOString()` instead of `manilaNowIso()` (a fixed _noon_-Manila marker meant
  for Superhost rolling windows) so timestamps are real.

### Second QA pass — all residual gaps closed locally (2026-09-04)

5. ✅ **Booking pricing default reflects the applied smart rate.** Created a `PENDING_REVIEW`
   booking (Sep 10–13 2026, `booking_rate = null`) on the test property _after_ Smart Pricing
   was applied so those nights kept their recs (2950 / 3650 / 4000). The Pricing-calendar
   **Booking Details** modal showed **3 nights · ₱10,600.00** (= the smart sum), not ₱12,950
   (base) — via the **exact same `computeDefaultBookingRate(booking, defaults, dateOverrides,
holidayRules, smartRecommendations)`** call `ReviewPricingForm` makes. `applyRun` also
   correctly **skips a night that is already booked** when re-applying.
6. ✅ **Full `pg_cron` → `pg_net` → Kong → edge fn → DB chain.** Installed `pg_cron` locally,
   seeded Vault (`project_url` → Kong's Docker-internal IP `172.18.0.9:8000`, `anon_key`), ran
   `SELECT public.sync_smart_pricing_cron_job();` → `{"ok": true, "cronExpr": "30 17 * * *"}`
   (job `smart-pricing-autopilot-nightly` registered `active`). Fired the job's exact command
   body via `net.http_post` → pg_net recorded **status 200**, body
   `{"success":true,"candidates":1,"processed":1,"applied":365,"notified":1,"errors":[]}`. DB
   side-effects landed: 365 `applied` recs, a `cron` run row (365/365, avg −13.6%), a
   `smart_pricing_updated` notification with the right dedupe key, `last_run_at` stamped. This
   is the production chain verbatim — the only prod difference is the public URL vs. the
   container IP. Cleaned up (job unscheduled, extension dropped, Vault + `net._http_response`
   test rows removed).
7. ✅ **AI-pass "populated" path — against the real Gemini API.** `_shared/smartPricingAi_test.ts`
   (**6/6**) covers the pure helpers (`buildSmartPricingAiPrompt`, `parseSmartPricingAiJson`,
   `shapeSmartPricingAiOutput`). Then, with `smart_pricing` temporarily added to
   `ai_platform_global_settings.allowed_features` (local was `{dashboard_assistant}` only), a
   real `smart-pricing-preview` returned a **populated `ai` block**: 3 Gemini-written season
   rationales ("Prices are set lower during these months due to typical off-peak demand", "…
   December reflects increased demand around the holiday season", …), `warnings: []`,
   `suggestedMinPrice 2370` / `suggestedMaxPrice 14625` (host bounds blank). Persisted on the
   `runs` row (`ai_used=t`, `credits_consumed=1`, 3 rationales, suggested min/max) and metered
   in `ai_platform_usage_events` (`feature='smart_pricing'`, `gemini-2.5-flash`, 687/153
   tokens, `actor_type='system'`). Allowlist restored to `{dashboard_assistant}` afterward.

### Usability redesign (2026-09-04) — verified in browser

The first cut of `SmartPricingDialog` was 3 tabs of revenue-management jargon
("aggressiveness", "orphan-gap discount", "rounding: nearest 100 − 1", "forward-occupancy
tilt"). Rebuilt as **one plain-language screen**:

- **Off** = a single "Turn on Smart Pricing" switch, nothing else.
- **On** reveals 4 choices: _how changes happen_ (suggest vs automatic, tappable cards),
  _how much prices move_ (**Gentle / Balanced / Bold** with one-line blurbs), **Never go
  below ₱\_\_** (a floor that **auto-fills ~70% of the weekday rate** on enable so "Preview"
  always runs with a real floor), and _Preview my prices_. Advanced (custom base, per-weekday
  nudge, window) is a collapsed `<details>`. Every control **saves on change** — no Save
  button, which also removed the old "Advanced edits get clobbered on refetch" bug.
- **Preview** reframed to **pesos**: "Your next 30 nights ₱126,200 → ₱104,950", a **45-night
  bar strip** (green up / amber down / grey same), and **labelled change groups**
  ("Sep–Oct (quieter dates) · lower, ~₱3,546/night", "Christmas Season · higher,
  ~₱5,767/night", "All Saints' Day", "Weekend nights", "Gap nights between bookings") with
  per-group **Apply** + **Apply all changes**. "Why these prices" (AI) shows inline when
  available; the preview works fully without it.
- Server: `smart-pricing-preview` gained `{ explain?: boolean }` (default true) so a host can
  skip the AI credit, and a `next30` totals block for the headline.

Verified via Playwright on the Pro-owner session: off → on → floor auto-saved (`min_price =
2750` in DB) → preview (₱ headline + bar strip + labelled groups) → per-group Apply persisted
3 recs → env restored.

### Second usability pass (2026-09-04) — `/impeccable` + engine cold-start fix, verified in browser

The redesign above still overwhelmed on a **new listing**: the engine cut every night ~33%
(empty forward calendar → pace tilt + last-minute discounts fired), and `groupChanges`
mislabelled — merging contiguous runs and naming a 186-night span "New Year's Eve". Fixed:

- **Engine cold-start guard** (`smartPricingRun.ts#computeSmartPricingForProperty`): when
  `history.confidence === 'low'`, force `aggressiveness: 'conservative'`, pass empty
  `leadTime`, and `occupancyTiltEnabled: false`. A new listing now only moves off its own
  weekend split + season/holiday rules (weekends +₱150–250, weekdays −₱50 on the test
  property) instead of a blanket discount.
- **`groupChanges` rewrite**: bucket by semantic key — `season_rule` factor (host/holiday name),
  `orphan` factor, weekend (`wd ∈ {0,5,6}`), else month — round `~₱/night` to 50, show an
  up/down arrow, and fold a run of ≥3 same-direction month buckets into one **Quieter dates**
  / **Busier dates** row. Added `isUniform()`: when every changed night moves by a similar
  small amount (spread ≤ 7pp, all down), drop the strip + list and show one honest sentence.
- **Progressive disclosure**: the on-state now shows only the floor + Preview button; _Prices
  update_ and _Adjustment size_ moved behind a `Style: Balanced · you approve changes`
  expander, with the window + per-weekday nudges nested one level deeper under "More options".
- **`appliedCount`**: `smart-pricing-settings` GET now returns a live count of applied recs
  from Manila-today forward (`countAppliedSmartRecommendations`). The dialog's "N nights
  priced · Undo" affordance keys off `appliedCount > 0`, not `last_run_at` — so it clears the
  instant you press Undo (`last_run_at` intentionally lingers as an audit trail).

Playwright re-run on the same Pro-owner session: off → on (floor auto-saved `2750`) → expand
Style → Preview (₱126,200 → ₱128,000, "about the same total", real-variance strip, 9 semantic
rows incl. "Quieter dates · Jan 4–Sep 2 · 140 nights") → Apply all (26 Sept nights on the
calendar with `Wand2` markers, stats card "26") → Undo (recs gone, affordance gone) → env
restored (`property_smart_pricing_*` purged, temp password nulled).

**Bundled safety fixes** (from the same-day code review):

- `smartPricingEngine.ts` — hard `min ≥ 1` floor and `max ≥ min` so a mis-set bound can never
  yield ₱0; unchanged nights (no factors, no clamp) return `baseRate` untouched (no
  rounding-only "changed" nights).
- `smartPricing.ts` — reject `maxPrice ≤ 0` outright (a zero ceiling would clamp every rate
  to 0).
- `smartPricingRead.ts` — merge only `recommended_rate > 0` into guest quotes.

### Third pass (2026-09-04) — ground-up engine + dialog rebuild after continued rejection

The cold-start guard in pass 2 only special-cased `confidence === 'low'`. A property with
_some_ history (`confidence: 'high'`, e.g. ≥ 20 booked nights but concentrated in a couple of
months) still slammed every night to the floor: `monthDemand`/`dowDemand` clamped at `0.6`
(−40 %) compounded with an always-on booking-pace tilt (`(occupancy − 0.7) × 0.5`, always
negative on a normal, not-nearly-full listing) and 14-day/−18 % last-minute discounts. Root
cause was structural, not a threshold — there was no ceiling on how far the _algorithmic_
signals could compound, and "low forward occupancy" was read as "cut the price" even though
it is the normal state for a small listing. Rebuilt both the engine and the UI:

- **`ALGO_DEVIATION_CAP`** (new, engine): the product of the learned/inferred signals
  (day-of-week, season demand, lead-time, booking pace) is hard-capped to `±6 % / ±12 % / ±22
%` by aggressiveness, applied _before_ the host's own `season_rule` / `orphan` factors (which
  are structural and stay uncapped). This alone makes a harsh demand curve unable to slam a
  night, whatever the confidence level.
- **`demandConfidence`** (new field on `SmartHistoryFeatures`): 0 → 1, ramping with elapsed
  booked nights (12 → 140). `dowDemand`/`monthDemand` are blended toward 1.0 by
  `(1 − demandConfidence)` before the gain, and the raw clamps were tightened to `0.88–1.15` /
  `0.85–1.20` (was `0.6–1.8`).
- **Booking pace turned upward-only**: fires only when forward occupancy `> 85 %`, max `+6 %`
  before gain, and is **off by default** (`occupancy_tilt_enabled: false`). Low forward
  occupancy is normal for a small listing, never a discount signal.
- **Gentler default lead-time**: `−8 %` inside 3 days / `−4 %` inside 7 (was `−18/−10/−5 %`
  across 14 days), no speculative far-out premium.
- **2 % deadzone**: after rounding, a move under 2 % of base (and not from a season rule or a
  bound) snaps back to the base rate — no rec row, no "changed" night, no calendar marker.
- **Apply / autopilot persist only nights the engine actually moved** (`recommendedRate !==
baseRate`) — previously every eligible night in the window got a rec row (365 on the test
  property) even when unchanged, inflating `appliedCount` and marking every future date on the
  calendar.
- **`SmartPricingDialog` rebuilt from scratch** — three views instead of a form-with-tabs:
  1. **intro** (off) — 3-line explainer + one button;
  2. **settings** (on) — a 3-card strategy picker showing the _real_ ±% range per card, inline
     price-limit inputs, a 2-option "who approves" radio, `Preview my prices`. Weekday-nudge
     grid and window selector removed entirely (kept at their defaults, not host-facing);
  3. **preview** — replaced the bar-strip + text-group list with a **month calendar
     heat-map** (green/grey/amber per night, opens on the first changed month) plus ≤ 4
     deterministic "why" bullets (weekend delta, each holiday rule, gap-night count, AI
     warnings). `Apply all` / `Not now`.
- **`STRATEGY_OPTIONS`** gained a `range` field ("up to ±6/12/22%") so the settings cards state
  the engine's real limit instead of vague "small/large" language.

Verified via Playwright on the same Pro-owner cold-start property: off → on (floor auto-saved)
→ Preview showed **±0** change (before the deadzone/weekend-curve tuning) → tuned cold-start
`demandConfidence: 0.5` + weekend-only `COLD_START_DOW` so a new listing gets a small,
consistent Fri/Sat/Sun premium (`+₱100–150`) and nothing else moves → Apply all persisted
**160** recs (all weekends + the property's 2 holiday rules, zero weekday rows) → calendar
markers exactly on those nights, stats card "11" for the visible month → Undo cleared them and
the affordance disappeared → 13/13 engine tests pass (2 new: algorithmic cap holds, deadzone
snaps back) → env restored.

### Fourth pass (2026-09-05) — modal chrome + polish, from direct host-style feedback

Six concrete complaints on the third-pass UI, all fixed in `SmartPricingDialog.tsx`:

1. **Not the standard modal.** Rebuilt on `ResponsiveModalContent sheetLayout="split"` (the
   same pattern as `InboxAiResponseDialog`) — fixed header, `flex-1 overflow-y-auto` body,
   fixed `ResponsiveModalFooter`. Only the body scrolls now; actions never move.
2. **Undo not evident.** Moved from a small inline text link to a real outlined destructive
   `Button` in the settings footer, always visible next to the primary action whenever
   `appliedCount > 0`.
3. **"Applying changes" radio was confusing.** Replaced the two unlabelled radio rows with a
   `When I approve` / `Automatically` two-button picker plus one line underneath spelling out
   what the selected option actually does ("nothing changes until you approve it" vs. "updates
   every night on its own").
4. **Price-limit defaults too tight / no ceiling default.** Both floor and ceiling now
   auto-seed together on enable: `floor = round50(0.9 × weekday base)`,
   `ceiling = round50(1.25 × weekday base)` — for the reported property (weekday base ₱2,799)
   that resolves to exactly **₱2,500 / ₱3,500** as asked. Previously only the floor was seeded,
   at `0.7×`, and the ceiling was always blank.
5. **Calendar didn't show before/after.** Each changed night now shows the old rate struck
   through above the new one, not just the new number.
6. **Apply all / Not now inconsistent with modal conventions.** Preview footer now mirrors the
   settings footer: `← Back` on the left, `Not now` / `Apply all` on the right, all fixed and
   always visible — same button sizing/order convention as the rest of the admin's modals.

Verified via Playwright at both desktop (dialog) and phone width (bottom sheet): settings and
preview footers stay pinned while the body scrolls in both modes; on the test property (weekday
base ₱3,950) the floor/ceiling auto-seeded to ₱3,550 / ₱4,950 (0.9×/1.25×, confirmed against the
formula); Apply → Undo round-trip still clears `appliedCount` correctly. Type-check, lint, and
`vite build` clean; env restored.

### Fifth pass (2026-09-05) — stepper + six more polish items

Replaced the preview's `← Settings` text link with the app's shared wizard stepper
(`SegmentedStepProgress`, the same component used by Import and Marketing-generate) in the
header — `Settings` / `Preview`, current step highlighted — and made the footer's `Back` a real
outlined button with `ArrowLeft`, matching the convention `ImportModalFooter`/
`ImportWizardModal` already use elsewhere. `Not now` was dropped since it was functionally
identical to `Back` (both just reset the preview).

Then six more items, from a closer look at the settings screen:

1. **Undo shouldn't be in settings at all.** Removed the settings-footer Undo button entirely —
   the `N nights priced` line is now purely informational.
2. **Modal too small.** Widened `36rem → 42rem` and taller (`700px → 760px` max-height).
3. **"Prices update" still looked identical either way.** The preview screen now visibly
   differs by mode: an extra primary-colored line when `mode === 'autopilot'` ("Automatic
   updates are on — this applies tonight on its own. Tap **Apply now**…") and the primary
   button itself relabels to **Apply now** (optional early apply) vs **Apply all** (the only
   way review-mode changes go live).
4. Re-confirmed the outline `Back` button and the removed `Not now` (already done in the
   stepper change above, just verified together with the rest).
5. **Apply should close the dialog.** The apply mutation's `onSuccess` now calls
   `onOpenChange(false)` instead of `previewMut.reset()` — the existing
   `useApplySmartPricing` toast ("Smart Pricing applied to N nights") is what confirms the
   action, not a screen inside the modal.
6. **Disabling needs a confirmation.** Flipping the switch off no longer patches immediately —
   it opens a nested `AlertDialog` ("Turn off Smart Pricing? This resets your prices back to
   your saved rates and clears the current suggestions."). Confirming runs
   `patch({ enabled: false })` + `clearMut.mutate()` together — this is now the only way to
   clear applied recommendations from the modal. The parent modal blocks its own outside-click
   / escape / open-change handling while the alert is open (the same nested-`AlertDialog`
   pattern `TelegramManageDialog` uses), so clicking the confirmation doesn't also dismiss
   Smart Pricing.

Verified via Playwright: stepper shows 1/2 → 2/2 across settings/preview and Back returns
correctly; switching to Automatically + Preview shows the new note and an "Apply now" button;
clicking it closed the dialog and the "Smart Pricing applied to 160 nights" toast appeared over
the (already-updated) calendar; reopening showed no Undo, just status text; toggling off opened
the confirm dialog (Smart Pricing modal stayed open behind it), Cancel left everything
untouched, Turn off cleared all recommendations and disabled the flag (confirmed 0 rows in
`property_smart_pricing_recommendations` after). Type-check, lint, `vite build` clean; env
restored.

### Left for the real production deploy

Nothing new to verify — running the same code, migrations, and cron in prod. The staging
checklist is just: `bun run deploy:supabase` (migrations + functions), then in the SQL editor
`SELECT public.sync_smart_pricing_cron_job();` (once Vault `project_url` + `anon_key` are set),
and — if the AI pass should be live — the super-admin adds `smart_pricing` to the AI platform
allowlist (or leaves it empty = all features on). Every mechanism above was exercised locally
end to end.

### Phase 4 — deferred to follow-up plans

Length-of-stay (weekly/monthly) discounts (needs guest-quote LOS support), min-stay-by-season,
external market/comparable data, parking-listing parity, push smart rates to Airbnb
(blocked — Channel Sync is availability-only). Open decisions #2–#6 (default mode, window,
AI-on-by-default, rounding, RBAC leaf) resolved as: **Review only** default, **365-day**
window, **AI off by default** (`ai_rationale_enabled=false`), **nearest-50** rounding, **no new
RBAC leaf** (reuse `pricing.rates:edit`).

---

## 1. Problem & goal

The Pricing calendar (`/org/:orgSlug/property/:propertySlug/pricing`) is fully manual today:
a host sets a weekday rate, a weekend rate, PH holiday rules, and per-date overrides by hand.
There is **no signal** on which future nights are underpriced (peak weeks left at base) or
overpriced (dead shoulder weeks that never book), and no way to react to how the calendar is
actually filling.

**Goal:** a paid "Smart Pricing" feature, launched from the Pricing page, that:

1. Analyses the property's **own historical calendar** (booked nights, lead times, day-of-week
   and seasonal patterns) plus its **current forward occupancy** and a bundled PH
   season/holiday model, and produces a **recommended nightly rate for every future night** in
   a rolling window.
2. Offers **two ways to use it**: _Autopilot_ (a nightly cron keeps rates optimised
   automatically) and _Review suggestions_ (a diff preview the host applies all / by range /
   dismisses).
3. Is **easy to run with zero config** (sensible defaults) but exposes **Advanced settings**
   (min/max price, aggressiveness, day-of-week, last-minute, orphan-gap, seasonal profiles,
   rounding) for hosts who want fine control.
4. Produces **realistic, defensible** prices — every recommendation carries a factor
   breakdown ("Base ₱2,799 · Weekend +7% · Peak +25% · Booking pace +8% → ₱3,750"), and an
   optional AI pass writes a plain-language rationale and flags where the engine looks off.

### What "attract more guests" means here (scope honesty)

We have **first-party data only** — this property's `guest_submissions` history and forward
calendar. We are **not** buying market/comparable data (no AirDNA, no scraping). So v1
optimises _this listing against its own demand curve_ (fill orphan gaps, discount dead
lead-time, premium-price proven peak weeks), not against the neighbourhood. That is still the
bulk of the revenue lift the popular tools deliver; the market-comp layer is a documented
future phase, not a v1 promise.

---

## 2. How the popular apps do this (research summary)

| Tool                           | Engine shape                                                                             | Host controls                                                                                                                                                                                     | Signals                                                                     |
| ------------------------------ | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| **Airbnb Smart Pricing**       | Platform algorithm, daily updates                                                        | **Min & max price** (hard bounds), per-date opt-out, custom price still wins                                                                                                                      | Area booking behaviour, lead time, season, day-of-week, local events        |
| **PriceLabs**                  | Deterministic rule + demand engine ("Hyper Local Pulse"), daily                          | **Base price = midpoint anchor** (not floor/ceiling), min price, max price (~3–4× base), min-stay, last-minute & far-out curves, DOW, orphan-gap, occupancy-based rules, custom seasonal profiles | Search volume, booking pace, comp availability, historical occupancy curves |
| **Beyond / Wheelhouse / DPGO** | Same family — base price × stacked multipliers, clamped to min/max, ML demand multiplier | Aggressiveness / "health" profile, 15+ rule knobs (DOW, LOS discounts, orphan days, last-minute, far-out)                                                                                         | PMS occupancy + pace, DOW patterns, seasonality, events                     |

**Key takeaways we adopt:**

- **None of them are LLM-priced.** The number comes from a **deterministic `base × Π(multipliers)` clamped to `[min, max]`** engine. LLMs hallucinate prices — ours does rationale + sanity-check only.
- **Base price is the anchor**, not a bound. Min price is "the single most consequential decision a host makes" — so we surface it hard, and the AI pass suggests one when unset.
- Multiplier stack, in the order the industry uses: **seasonality → day-of-week → holiday/event → lead-time / booking-pace → forward-occupancy tilt → orphan-gap → last-minute / far-out → rounding**.
- Occupancy heuristics: >80% forward occupancy ⇒ stop discounting / premium; <70% ⇒ 10–20% last-minute reduction. Orphan (1–2 night) gaps ⇒ 10–25% fill discount.
- Custom/host-locked prices and per-date opt-out always win over the algorithm.

_Sources: PriceLabs algorithm overview & setup guides (hello.pricelabs.co), Airbnb "What is
Smart Pricing" (airbnb.com/resources), Hostaway & Guesty dynamic-pricing guides, MagicBNB
"PriceLabs vs Wheelhouse vs Beyond 2026"._

---

## 3. Product design

### 3.1 Entry point

New header action on `PropertyPricingPage.tsx`, right of **Channel sync**: **Smart Pricing**
(desktop outline button with a `Sparkles` icon; mobile hero icon). Below the plan tier it
carries a `TierBadge` / `TierBadgeAnchor` on `feature="smartPricing"` (same pattern as
`calendarSync`). Opens `SmartPricingDialog` — a `ResponsiveModal`, **preview-open** below the
gate (browsable), with writes blocked → upgrade modal.

### 3.2 Dialog tabs

**Overview**

- Master **Enable Smart Pricing** switch.
- **Mode**: `Autopilot` (cron keeps rates updated) · `Review only` (never auto-applies; host applies from the Suggestions tab).
- **Min price / Max price** (nightly ₱). Empty allowed but strongly nudged; if empty, engine uses conservative internal bounds (`0.6×`–`2.5×` base) and the AI pass proposes real numbers.
- **Aggressiveness**: `Conservative` / `Balanced` / `Aggressive` — scales how far every multiplier is allowed to deviate from `1.0` (e.g. `0.5×` / `1.0×` / `1.5×` deviation gain).
- **Projected impact** readout: over the next 90 days, `N nights` change, avg `+X%`, "recommended" total vs current total. Read-only, recomputed on open.
- **Last run**: timestamp + trigger (cron / manual) + "Recompute now" button.

**Advanced** (all optional; every field has a safe default)

- **Base price source**: `Use my weekday/weekend rates` (default) · `Set a Smart Pricing base` (weekday + weekend fields).
- **Day-of-week adjustments**: 7 sliders (−30%…+50%), pre-filled from the learned DOW curve, host-overridable.
- **Seasonal profiles**: list of `{name, startDate, endDate, percentage}` — this is the existing `pricing_holiday_rules` concept widened to ranges/seasons. Seeded from `phHolidayRules.ts` + a bundled PH seasonal curve (dry-season Nov–May uplift, wet-season Jun–Oct softening, Holy Week, Christmas–New Year, long weekends).
- **Lead-time curve**: `last-minute` (−% within 3 / 7 / 14 days when that window is under-occupied) and `far-out` (+% beyond 120 days on peak-season nights). Tiered inputs.
- **Orphan-gap fill**: discount % applied to 1–2 night gaps sandwiched between two bookings (default −15%).
- **Forward-occupancy tilt**: rolling 30/60/90-day forward occupancy → global ± up to the aggressiveness cap (>80% ⇒ up, <60% ⇒ down).
- **Length-of-stay discounts**: weekly (≥7 nights) and monthly (≥28 nights) %. _Phase 4 — needs guest-quote support; hidden until then._
- **Rounding**: `nearest 50` (default) / `nearest 99` / `nearest 100` / `none`.
- **Per-night control**: a host-set custom price on the calendar is a **lock** — Smart Pricing never touches it. Each locked night gets a "Let Smart Pricing manage this" affordance to release it.

**Suggestions** (Review-only mode, or "preview before autopilot")

- Diff table: date / contiguous range · list price → **smart price** · Δ% · factor chips.
- Actions: **Apply all**, **Apply range**, **Dismiss** — reusing the frozen-diff pattern from [`ai-assistant-bulk-pricing-chat.md`](../planned/ai-assistant-bulk-pricing-chat.md): the apply call carries the previewed `run_id` and only writes rows that still match, so a stale preview can never blind-replace the calendar.
- Optional AI rationale block per season/segment when the AI pass ran.

### 3.3 Calendar surface

`PricingCalendarGrid` day cells:

- Applied smart nights render the smart price with a small **sparkle** marker, visually
  distinct from a host **custom** (locked) override's existing marker.
- Tooltip = full factor breakdown line.
- `PricingStatsRow` gains a **Smart Pricing: On / Off** chip and an **Avg uplift (90d)** stat.
- Resolution precedence (see §4.3) is implemented once in `getPriceForDate` and mirrored server-side.

---

## 4. Architecture

### 4.1 The engine — `_shared/smartPricingEngine.ts` (pure, deterministic, no I/O)

```
computeSmartRates(input: {
  window: { start: string; end: string };          // rolling forward, e.g. today+1 … today+365
  base: { weekday: number; weekend: number };
  bounds: { min: number | null; max: number | null };
  aggressiveness: 'conservative' | 'balanced' | 'aggressive';
  seasons: SeasonRule[];                            // widened holiday rules
  dowAdjust: Record<0..6, number>;                  // learned + host overrides, %
  leadTime: { lastMinute: Tier[]; farOut: Tier[] };
  orphanGapDiscountPct: number;
  occupancyTilt: { d30: number; d60: number; d90: number };   // forward occupancy ratios
  rounding: 'r50' | 'r99' | 'r100' | 'none';
  bookedDateKeys: Set<string>;                      // never repriced
  blockedDateKeys: Set<string>;
  lockedDateKeys: Set<string>;                      // host custom overrides — skipped
  historyFeatures: HistoryFeatures;                 // from smartPricingData.ts
  today: string;
}): Array<{
  date: string;
  baseRate: number;
  recommendedRate: number;
  factors: Array<{ key: string; label: string; multiplier: number }>;
  clampedBy?: 'min' | 'max';
}>
```

Per night: `raw = base(dow) × seasonMult × dowMult × holidayMult × leadTimeMult ×
occupancyTiltMult × orphanGapMult`, each multiplier's deviation from `1.0` scaled by the
aggressiveness gain, then `clamp(min, max)` then `round(rounding)`. Booked / blocked / locked
nights are emitted with `recommendedRate = null`-equivalent (skipped on write). Fully
unit-testable with synthetic `historyFeatures`; no DB, no network.

### 4.2 Feature extraction — `_shared/smartPricingData.ts`

Reads (service client, per property):

- `guest_submissions` last 24 months (non-`CANCELLED`, non-`IMPORTED`): expand occupied
  nights → **DOW booking distribution**, **month-of-year occupancy index**, **lead-time
  histogram** (submission→check-in), **avg realised nightly** (`booking_rate / number_of_nights`)
  per season bucket.
- Forward calendar (`loadBookedDateKeys` + `loadBlockedDateKeys`) → **d30/d60/d90 forward
  occupancy** and **orphan-gap detection**.
- Cold-start (thin history, < ~15 booked nights): fall back to the bundled PH seasonal curve +
  `pricing_holiday_rules`, force `aggressiveness = conservative`, and rely more on the AI
  sanity pass + host min/max. `historyFeatures.confidence` is surfaced in the UI.

### 4.3 Rate resolution precedence (single source of truth, mirrored client + server)

```
host lock (property_pricing_date_overrides row)         ← unchanged, always wins
  > blocked night
  > booked night (stay pill, no list price)             ← unchanged
  > applied smart recommendation (autopilot on, applied) ← NEW layer
  > holiday / season rule
  > weekend / weekday base
```

Implemented in `_shared/propertyPricing.ts#resolveNightlyRateForDate` (add a
`smartRecommendations?: Record<string, number>` option, resolved just above holiday rules) and
mirrored in `ui/.../pricing/lib/pricingCompute.ts#resolveNightlyRateForDate`. Guest-facing
paths that must pick up smart rates: `get-booked-dates` quote, `submit-form` price
computation, `property-pricing` GET (`calendarBookings` unaffected; add `smartRecommendations`

- `smartPricingEnabled` to the DTO), and the booking pricing-review default
  (`computeDefaultBookingRateFromDefaults`).

> **Decision — keep smart recs in their own table, merge at read.** Not folded into
> `property_pricing_date_overrides`. Clean downgrade (feature lost ⇒ recs ignored, host
> overrides untouched), no change to `savePropertyPricing`, and the "is this custom?" UI check
> stays correct.

### 4.4 Data model (new migrations — never edit shipped ones)

`property_smart_pricing_settings` (1:1 property)
: `property_id PK/FK`, `enabled bool default false`, `mode text check in ('autopilot','review_only') default 'review_only'`, `base_source text check in ('property_rates','custom') default 'property_rates'`, `base_weekday numeric`, `base_weekend numeric`, `min_price numeric`, `max_price numeric`, `aggressiveness text default 'balanced'`, `dow_adjust jsonb`, `season_rules jsonb`, `lead_time jsonb`, `orphan_gap_discount_pct numeric default 15`, `occupancy_tilt_enabled bool default true`, `los_discounts jsonb`, `rounding text default 'r50'`, `window_days int default 365`, `ai_rationale_enabled bool default false`, `last_run_at timestamptz`, `updated_by uuid`, timestamps.

`property_smart_pricing_recommendations` (property × date)
: `property_id FK`, `pricing_date date`, `base_rate numeric`, `recommended_rate numeric`, `factors jsonb`, `applied bool default false`, `applied_at timestamptz`, `source text check in ('engine','engine_ai')`, `run_id uuid FK`, `updated_at`. PK `(property_id, pricing_date)`.

`property_smart_pricing_runs` (audit)
: `id uuid PK`, `property_id FK`, `trigger text check in ('cron','manual_preview','manual_apply')`, `window_start date`, `window_end date`, `nights_computed int`, `nights_changed int`, `avg_delta_pct numeric`, `ai_used bool`, `credits_consumed numeric`, `error text`, `created_by uuid`, `created_at`.

RLS: `ENABLE ROW LEVEL SECURITY` + `GRANT ALL … TO service_role`, no client SELECT policy
(all reads go through edge functions), matching every other property-scoped table.

### 4.5 Edge functions (`serveAuthenticated` / `serveCronPost`, register in `config.toml`, `verify_jwt = false`)

| Function                 | Method                          | Auth / gate                                                                                                                                                    | Job                                                                                                                                                                                                                                                                                   |
| ------------------------ | ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `smart-pricing-settings` | GET / PATCH                     | `resolveScopedPropertyAccess('pricing:view')`; PATCH also `pricing.rates:edit` + `requirePropertyFeature(propertyId,'smartPricing')` + `catchPlanFeatureError` | Load/save `property_smart_pricing_settings`. GET ungated (preview-open).                                                                                                                                                                                                              |
| `smart-pricing-preview`  | POST                            | `pricing.rates:edit` + `smartPricing` gate                                                                                                                     | Run `smartPricingData` → `computeSmartRates` (+ optional AI pass) **without persisting** applied state; write a `runs` row + `recommendations` rows with `applied=false`; return the diff + `run_id`.                                                                                 |
| `smart-pricing-apply`    | POST `{ run_id, ranges? }`      | `pricing.rates:edit` + `smartPricing` gate                                                                                                                     | Freeze-apply: set `applied=true` on the frozen `run_id` rows within `ranges` (or all), skipping any night that became booked/blocked/locked since the preview. Bump `last_run_at`.                                                                                                    |
| `smart-pricing-cron`     | POST (pg_cron + pg_net, hosted) | shared cron secret                                                                                                                                             | For every property with `enabled && mode='autopilot'` **and** a live `smartPricing` entitlement: recompute the rolling window, upsert recs, mark `applied=true`, emit a `smart_pricing_updated` notification when `nights_changed` or `avg_delta_pct` exceed a threshold. Idempotent. |

Shared: `_shared/smartPricingEngine.ts` (pure), `_shared/smartPricingData.ts` (feature
extraction), `_shared/smartPricingAi.ts` (optional Gemini rationale + sanity flags + min/max
suggestion).

### 4.6 AI layer — additive, credit-metered, never sets raw prices

- Register `smart_pricing` in `_shared/aiModelRouter.ts` `AI_FEATURES` + `FEATURE_MODELS`
  (`gemini-2.5-flash`, `flash` tier, `0.3 / 2.5` per 1M, `defaultMaxOutputTokens ~768`).
  Est. ~$0.002/run ⇒ ~2 credits at `credit_unit_usd = 0.001`.
- `smart-pricing-preview` and (optionally, throttled to weekly) `smart-pricing-cron` call
  `assertOrgAndPropertyAiQuota(orgId, propertyId, 'smart_pricing')` → Gemini → `recordAiUsage({… feature:'smart_pricing', actorType: manual ? 'staff' : 'system' })`. Credits count against `aiMonthlyCreditAllowance`; a quota error degrades gracefully to **engine-only** output (no hard failure — the deterministic curve still returns).
- AI input: the computed curve + `historyFeatures` summary + property context (bed count,
  reviews avg if available, holiday rules). AI output (structured JSON): `seasonRationales[]`,
  `warnings[]` (e.g. "Christmas week only +10% vs. historical +45% realised"),
  `suggestedMinPrice` / `suggestedMaxPrice` when host left them blank. Reuse
  `geminiToolCallClient` / the `marketingTemplateGenerationAi` structured-output shape.
- Global kill switch, per-feature allowlist, cache, and `upgradeHook` behaviour come for free
  from `aiUsageService`.

### 4.7 Plans & permissions

- **New `PlanFeatures` key `smartPricing: boolean`** in `supabase/functions/_shared/planFeatures.ts` **and** the UI mirror `ui/src/features/dashboard/plans/lib/planFeatures.ts` (+ `DEFAULT_PLAN_FEATURES`, `PLAN_FEATURE_LABELS: 'Smart Pricing'`).
- **Seed migration** (mirror `20261213120300_calendar_sync_plan_feature.sql`): `smartPricing: true` on `growth` / `pro` / `managed` / `business_plus`; `false` on `free` / `starter` / `commission`. ⇒ **Pro (`growth`) and above**, same as Channel Sync.
  - _Open decision:_ if the user wants it Business-only (like `aiDashboardAssistant`), flip `growth` to `false`. Recommendation: **Pro+**, because it is a Pricing-page operational tool paired with Channel Sync, and its AI usage is already bounded by `aiMonthlyCreditAllowance` (Pro = 1000 credits/mo).
- **Server gates:** `requirePropertyFeature(propertyId, 'smartPricing')` on all three write
  functions + per-property in the cron sweep (`orgHasPropertyWithFeature` not needed — always
  property-scoped).
- **Client gate:** `useFeatureGate('smartPricing')` for the button + dialog writes;
  `TierBadge feature="smartPricing"`; modal preview-open; `FEATURE_GATE_COPY.smartPricing`.
- **RBAC:** reuse `pricing.rates:edit` (managing Smart Pricing == editing rates) — no new team
  permission leaf. Note in `team.md` / `propertyTeamPermissions.ts` docs that `pricing.rates:edit`
  now also governs Smart Pricing.
- **Compare matrix / cards:** add a `boolRow` for `smartPricing` to `PLAN_FEATURE_ROWS`
  (`pricing` group) in `planPresentation.ts`; add a bullet to `PLAN_TIER_CARD_GAINS.growth`;
  confirm `/for-hosts/pricing` and `/org/:orgSlug/plans` still tell the same story.
- **Downgrade safety:** losing `smartPricing` ⇒ cron skips the property, applied recs stop
  being merged into guest quotes and the calendar (ignored, **not deleted**), settings row
  kept. `SmartPricingDialog` + a Pricing-page banner explain "Smart Pricing paused — your
  manual rates are active." Re-upgrading resumes from the stored settings. This is the
  "view-past-output vs generate-new-output" split from `plans-feature-matrix.md`.

---

## 5. Phased delivery (each phase independently shippable)

### Phase 0 — Schema + entitlement + deterministic engine (no UI, no guest impact)

1. Migrations: three tables (§4.4) + `get_advisors` clean.
2. `planFeatures` key `smartPricing` (both copies) + seed migration + `plans-feature-matrix.md` row.
3. `_shared/smartPricingEngine.ts` (pure) + `_shared/smartPricingData.ts`.
4. `smart-pricing-settings` GET/PATCH + `config.toml` registration.
5. Verification: `type-check`/`lint`/`build`; a `scripts/dev/` determinism harness feeding
   synthetic `historyFeatures` through `computeSmartRates` and asserting clamp/rounding/factor
   math; `get_advisors`.

### Phase 1 — Rate resolution wiring + manual Review/Apply

1. Add `smartRecommendations` option to `resolveNightlyRateForDate` (server + client) and the
   guest quote / availability / pricing-review paths (§4.3). Feature-flagged: only merges when
   `property_smart_pricing_settings.enabled`.
2. `property-pricing` GET DTO: `+ smartRecommendations`, `+ smartPricingEnabled`.
3. `smart-pricing-preview` + `smart-pricing-apply` (engine-only, no AI yet).
4. `SmartPricingDialog` (Overview + Advanced + Suggestions tabs), Pricing-page header button
   with `TierBadge`, calendar sparkle marker + factor tooltip, `PricingStatsRow` chip.
5. Verification: Playwright pass on the dialog + calendar; a night with an applied rec quotes
   at the smart price through `submit-form` and `get-booked-dates`; host lock still wins;
   booked/blocked nights untouched; downgrade path (toggle entitlement off in seed → recs
   ignored).

### Phase 2 — Autopilot cron + notifications + downgrade UX

1. `smart-pricing-cron` + hosted `pg_cron`/`pg_net` schedule (per
   `docs/archive/operations/scheduled-jobs-and-testing.md`) — **not** `config.toml` schedule.
2. `smart_pricing_updated` notification type (`notificationService.ts` +
   `features/dashboard/notifications`) — "Smart Pricing updated N nights (avg +X%)".
3. Downgrade banner + paused-state copy; `reconcile`-style skip in the cron for lost
   entitlement.
4. Verification: run the cron locally against a seeded property; idempotent re-run; notification
   fires only above threshold; disabled/`review_only` properties skipped.

### Phase 3 — AI rationale + sanity flags + min/max suggestion

1. `smart_pricing` in `aiModelRouter` + `_shared/smartPricingAi.ts`.
2. Wire into `smart-pricing-preview` (always) and `smart-pricing-cron` (weekly throttle,
   `ai_rationale_enabled` gate). Graceful degrade to engine-only on quota error.
3. UI: rationale block in Suggestions; "Suggested min ₱X / max ₱Y" prefill when blank;
   warning chips on flagged nights.
4. Verification: credits recorded against `aiMonthlyCreditAllowance`; quota-exhausted org still
   gets engine output; kill-switch respected.

### Phase 4 — Later / optional (separate follow-up plans)

- Length-of-stay (weekly/monthly) discounts — needs guest-quote LOS support first.
- Min-stay-by-season — needs booking-form min-stay enforcement.
- Market/comparable-listing signals — needs an external data source; explicitly out of scope
  until one is chosen.
- Parking-listing parity (`/org/:orgSlug/parking/:parkingSlug/pricing` — base rates only).
- Push smart rates to Airbnb — blocked: Channel Sync is **availability-only** by design.

---

## 6. Risks & mitigations

| Risk                                                          | Mitigation                                                                                                                                                                     |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| LLM invents unrealistic prices                                | Engine is deterministic; AI does rationale + flags + (blank-only) min/max suggestions, never the raw curve.                                                                    |
| Cold-start property with no history                           | `historyFeatures.confidence`; force conservative aggressiveness; PH seasonal curve fallback; lean on host min/max + AI pass. UI shows "Learning — limited history".            |
| Autopilot surprises a host with a big price swing             | Hard min/max clamp; aggressiveness cap on every multiplier; `smart_pricing_updated` notification; Review-only is the default mode; per-night lock + release.                   |
| Stale preview blind-replaces the calendar                     | `smart-pricing-apply` freezes on `run_id` and re-checks booked/blocked/locked per night (same pattern as `ai-assistant-bulk-pricing-chat.md`).                                 |
| Guest quote / admin pricing-review disagree with the calendar | Single `resolveNightlyRateForDate` precedence, mirrored client/server, with the smart layer in exactly one place.                                                              |
| AI credit blowout from the cron                               | Deterministic core is free; AI pass on cron is weekly-throttled and `ai_rationale_enabled`-gated; per-run cost ~2 credits; counts against existing `aiMonthlyCreditAllowance`. |
| Downgrade leaves stale smart prices live                      | Merge is `enabled && entitled`-gated at read time; recs ignored (not deleted) on downgrade; banner explains.                                                                   |
| Booked nights get repriced                                    | Engine skips `bookedDateKeys`; unchanged existing rule ("no rate change on booked nights").                                                                                    |

---

## 7. Docs to update in the same change (per `documentation-maintenance` + `route-guides`)

- **New:** `docs/architecture/smart-pricing.md` — engine formula, factor list, data model, resolution precedence, cron.
- `docs/PROJECT.md` — new routes/functions/env, `smart_pricing_*` tables, `smartPricing` feature key.
- `docs/guides/routes/org/property/pricing.md` — Smart Pricing section (Host-facing knowledge Q&A, permissions row, API/data table, edge cases) — **`route-guides` skill, mandatory**.
- `docs/architecture/plans-feature-matrix.md` — `smartPricing` row + tier decision + gate inventory entries.
- `docs/guides/routes/org/plans.md` + `for-hosts.md` + `/for-hosts/pricing` copy (`planPresentation.ts`).
- `.cursor/rules/booking-workflow.mdc` — note the smart layer in the nightly-rate resolution order (pricing feeds the booking pricing-review default).
- `docs/archive/operations/scheduled-jobs-and-testing.md` — `smart-pricing-cron`.
- `ai-opportunities-roadmap.md` — mark #9 as promoted to this plan.
- `docs/workflow/planned/README.md` — add the row (done with this plan).

---

## 8. Open decisions for the user

1. **Tier gate:** Pro (`growth`) + [recommended, matches Channel Sync] vs Business (`pro`) + [matches `aiDashboardAssistant`].
2. **Default mode:** `review_only` [recommended — safer first impression] vs `autopilot`.
3. **Rolling window length:** 365 days [recommended] vs 180.
4. **AI rationale on by default?** Off by default (`ai_rationale_enabled=false`), host opts in — keeps credit spend predictable. Confirm.
5. **Rounding default:** `nearest 50` PHP — confirm vs `nearest 99`.
6. Whether to add a dedicated `pricing.smart:manage` RBAC leaf (default: no, reuse `pricing.rates:edit`).

---

Back to [for-testing index](./README.md).
