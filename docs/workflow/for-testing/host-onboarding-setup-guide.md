---
title: 'Host onboarding setup guide (post-registration overlay)'
stage: for-testing
status: for testing — Phases 0–10 implemented; manual QA remaining
tags: [workflow, in-progress, onboarding, dashboard, ux]
updated: 2026-09-06
---

# Host onboarding setup guide (post-registration overlay)

> **Stage:** [`for-testing`](../for-testing/README.md). **Phase 0** research complete. **Phase 1** step assembly +
> progress model + Phase 1b persistence (`set_org_setup_guide_state` RPC,
> `setup-guide-state` edge, `useSetupGuideStateWrite`, shell/launcher/redirect). Next: **Phase 2b** settings controllers.

## Goal

Give every newly registered host a single, guided, resumable **Setup Guide** overlay that appears
the first time they land in the dashboard after `/onboarding`. It is a stepper that walks them
through the **one-time / initial** configuration spread across the dashboard today (org brand,
property basics, location, photos and listing content, pricing, payments, guest form, building
forms, email + notifications, listing verification, team) so a host can go from "account created"
to "ready to accept bookings" without hunting through settings pages. Every field reuses the
**exact validation, save path, and edge function** of its home page — the guide is an
orchestration shell over the existing forms, not a parallel implementation.

The **last actionable step** is an optional **Get Recommended** step: if the host completes the
second (Recommended / `enhanced`) verification, they are granted **one month of Pro free**. The
reward is fully controllable from super admin (on/off, plan, duration, trigger, campaign window,
per-org cap) and every grant is auditable and revocable.

`/onboarding` finishes by redirecting the host into their **listing dashboard** (property
dashboard when a property was created, parking dashboard when parking-only, org dashboard as the
fallback) — changed from today's redirect to the property **settings** page — so the Setup Guide
opens over a real dashboard, not a half-filled form.

## Scope

### In

- New `setup-guide` feature module: overlay shell, vertical stepper, per-step wrappers,
  a non-blocking dashboard **launcher** card, and a sidebar "Finish setup" entry.
- A **derived progress model** that composes the existing completion selectors
  (`computePropertySettingsCompletion`, `computeParkingSettingsCompletion`,
  `computeOrgSettingsCompletion`, pricing readiness, verification status) into a per-step
  status (`complete` / `incomplete` / `skipped` / `not-applicable`).
- Persistence of guide **meta only** (`dismissedAt`, `completedAt`, `lastStepId`, `skippedSteps`,
  `version`) on `organizations.settings.setupGuide`.
- Host-type-aware step set (property-only, parking-only, property + parking).
- Auto-open once for the **org owner** on first post-onboarding dashboard load; launcher-only
  afterward and for team members.
- Mobile-first layout (375 / 768 / 1024), keyboard + screen-reader support, reduced-motion.
- Completion step: recap of what is live vs pending review + deep links + product tour CTA.
- **Redirect change**: `/onboarding` finish (and `resolvePostSignInPath` for a returning host who
  just onboarded) targets the listing dashboard instead of property settings.
- **Host verification reward**: an optional Recommended-verification step that grants a
  time-limited Pro subscription; a super-admin config surface (`platform_settings` fields + a card
  on `/admin/settings` or `/admin/platform-settings`); grant + expiry + revoke via the existing
  `org_subscriptions` / `subscriptionOrchestrator` + billing cron; grant audit in
  `org_subscription_events`.
- Docs: new setup-guide guide, `docs/PROJECT.md`, onboarding guide cross-link, plans/permissions
  note, settings guides note the embedded usage, org-subscriptions + admin-settings + plans
  feature matrix note the reward path.

### Out

- Changes to `/onboarding` itself (org + first-listing creation + host Tier 1). It stays as-is;
  the guide sits entirely on top of the created workspace.
- Any new settings **fields** or new validation rules. If a field is not required on its home
  page today, it is not required in the guide.
- Re-running the guide for listings added **after** onboarding — those keep using the existing
  settings red-dot completion tracking. The guide covers the listing(s) present when it first
  opens (normally one property and/or one parking from onboarding); if the host somehow has more,
  the assembled list simply includes a block per listing.
- Verification tier redesign (see [`onboarding-verification-simplify.md`](../for-testing/onboarding-verification-simplify.md),
  [`host-verification-tiers.md`](../for-testing/host-verification-tiers.md)). The guide only
  surfaces existing verification status and the existing `ListingVerificationModal` /
  `GetVerifiedModal` flows.
- A cross-listing "apply to all" bulk editor. Each listing block is filled on its own; shared
  fields (e.g. org socials inherited by a listing) still inherit exactly as they do today.
- A new billing / checkout surface, PayMongo changes, or a self-serve trial anywhere else in the
  product. The reward is a super-admin-configured grant only; conversion at expiry reuses the
  existing renewal path.
- Changing which features Pro (`growth`) includes, or the plan catalog. The reward grants the
  existing Pro plan as-is.

## Background — current state

| Surface                                    | What happens today                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/onboarding` (`OnboardingPage.tsx`)       | 3 steps: org name + contact, hosting type + first property/parking + Property/Parking Rights, host Tier 1 upload (Valid ID + Facebook Page). `create-organization` + `submit-org-verification {tier:'base'}` + `submit-listing-authorization` (rights only). Redirects to **property settings → parking settings → org dashboard**.                                                                                                                                                                                                                                                       |
| After redirect                             | Host lands on a settings page with red dots on incomplete sections and no guidance on ordering or what blocks go-live. Pricing has working defaults, payments/photos/location/GAF/email are empty, listing proof of ownership is not yet uploaded (go-live blocker).                                                                                                                                                                                                                                                                                                                      |
| Completion tracking that already exists    | `propertySettingsCompletion.ts`, `parkingSettingsCompletion.ts`, `orgSettingsCompletion.ts` produce field + section errors and an `isComplete` flag, already surfaced as sidebar red dots via `OrgSettingsIssuesSync` and the parking/property equivalents.                                                                                                                                                                                                                                                                                                                               |
| Global post-login overlays already mounted | `HostVerificationChangesGate` (forced, non-dismissible) and `ListingContractRenewalProvider` (urgency-ranked reminder) in `AdminLayoutShell` (`ui/src/features/dashboard/bookings/components/AdminLayout.tsx`). This is the mount point and pattern to follow.                                                                                                                                                                                                                                                                                                                            |
| Onboarding redirect today                  | `OnboardingPage.submitOnboarding()` navigates to `propertySectionPath(..., 'settings')` → `parkingSectionPath(..., 'settings')` → `orgDashboardPath()`. `resolvePostSignInPath` / `resolveOrgLandingPath` (returning host) → `/org/:slug/dashboard`. **This plan changes the onboarding-finish target to the listing dashboard.**                                                                                                                                                                                                                                                         |
| Billing today                              | Org-level only. `org_subscriptions` (status `active`/`trialing`/`past_due`/`suspended`/`canceled`, one live row per org, `price_php_snapshot`, `feature_overrides` JSONB, `current_period_end`). `subscriptionOrchestrator.ts` (`createOrgSubscription`, `changeOrgSubscription`, `adminExtendOrgSubscription`, `runPlatformBillingCycle`), `cancel_org_subscription_to_free_rpc`. Super-admin assigns/overrides plans on `/admin/pricing/subscriptions`. `platform_settings` singleton (`default_plan_code`, `signups_enabled`, …) with `platform-settings` edge fn (`serveSuperAdmin`). |

## Pre-implementation review — risks found + resolutions

Verified against the code on 2026-09-06. These change the phase plan below; do not start before
reading them.

### R1 — Settings pages have no reusable controller (load-bearing)

`PropertySettingsCard.tsx` and the parking / org equivalents are **monoliths**: all draft state,
dirty detection, section-scoped save, OTP flow, and issue-store sync live inside one component.
The section components (`PropertyProfileMainSections`, `PropertyOperationalSettingsSections`, …)
are presentational props-only. There is **no context/provider and no headless hook** to reuse.

**Resolution:** add a dedicated **Phase 2b — controller extraction** (before any step body).
Extract `usePropertySettingsController` / `useParkingSettingsController` /
`useOrgSettingsController` from the cards **with zero behavior change**; the settings pages
become thin consumers; ship + regression-test that refactor on its own. `SetupGuideSettingsHost`
then consumes the same controller, scoped to a step's section ids. Without this the guide would
re-implement the save/dirty/OTP state machine and drift.

### R2 — Several sections are modal-only today

Payment, Amenities, House Rules, Cancellation, and Location are edited through **Manage
`ResponsiveModal`s**, not inline forms. Embedding them in the guide modal means nested sheets or
an inline render path. **Resolution:** Phase 0 audit must classify each as "has inline body" vs
"modal-only → needs an `embedded` render prop"; budget the `embedded` prop work into Phases 4-5.
Prefer inline over stacked modals; where stacking is unavoidable reuse the `overlayClassName`
stacking pattern from `GetVerifiedModal`.

### R3 — Free hosts cannot submit Recommended verification (reward chicken-and-egg)

`submit-org-verification` gates `tier:'enhanced'` with
`requireOrgPropertyFeature(orgId, 'recommendedBadgeEligible')` — **Pro (`growth`) and above**.
A brand-new Free host — the exact reward target — **cannot submit Recommended today**, so they
can never earn the reward.

**Resolution:** in `submit-org-verification`, when `tier==='enhanced'` **skip the
`recommendedBadgeEligible` gate** if `host_reward_enabled` **and** the org passes
`get-host-reward-offer` eligibility (Free, within campaign window, under `max_per_org`). Keep the
gate for everyone else. Pair with `trigger='recommended_verification_approved'` as the default so
Pro is granted only after a human approves (no self-serve abuse window). Document this
carve-out in `.cursor/rules/admin-auth.mdc` / the verification docs.

### R4 — `createOrgSubscription` cannot express a reward grant

It hardcodes `status:'active'`, `price_php_snapshot: computed`, no `current_period_end`, no
`source`. **Resolution:** add a **standalone** `grantOrgSubscriptionReward()` in
`planEntitlements.ts` that shares the property-enrollment loop + `writeOrgSubscriptionEvent` +
`chunkIds` helpers but does its own insert (`status:'trialing'`, `price_php_snapshot:0`,
`source:'reward'`, `current_period_start/end`). Do **not** bolt override params onto the
sensitive `createOrgSubscription`.

### R5 — The billing cron ignores `trialing`; expiry needs a new sweep

`runPlatformBillingCycle` only scans `status IN ('active','past_due')`. A reward `trialing` row
is therefore never dunned or suspended — good — but also never expires on its own.
**Resolution:** `expireHostVerificationRewards()` (new) matches strictly
`status='trialing' AND source='reward' AND current_period_end <= now`, calls
`cancel_org_subscription_to_free(subId, <freePlanId>, 'trialing', null)` (RPC needs the Free
plan id looked up first) + writes a `reward_expired` event. Conversion is detected by
`status !== 'trialing'`: `fulfillOrgSubscriptionPayment` already flips a mid-trial purchase to
`status:'active'` and rolls the remaining trial days into the paid period — add one line there to
also set `source='purchase'` so the row is unambiguous.

### R6 — Persisting guide meta through `update-organization` is wrong

`update-organization` requires `org.settings.basic:edit` (a team member without it must still be
able to dismiss/advance the guide) and its shared `applyOrganizationProfilePatch` does a
whole-object `{ ...currentSettings, ...patch }` read-modify-write — racing the org settings page
would clobber sibling keys. **Resolution:** new tiny `setup-guide-state` edge function (any
active org member) that writes via a Postgres RPC `set_org_setup_guide_state(org_id, patch jsonb)`
using `settings = jsonb_set(...)` / `||` so it is atomic and touches only `settings.setupGuide`.

### R7 — "Finish setup" nav dot is a new store, not a reuse

The existing dots come from three `useSyncExternalStore` issue stores and only show on the
matching admin path. **Resolution:** add `setupGuideIssuesStore` + hook, a new nav item in the
org/property/parking nav builders, and wire it in `AdminLayout` like the other three — but its
dot shows across the **whole** org admin area (not path-gated) since setup spans org + listings.

### R8 — Client entitlement cache after a reward grant

`useFeatureGate` reads a cached `['entitlements', …]` query. After the `org.recommended` submit
(and on the completion step) the client must invalidate every query whose key includes
`'entitlements'` (same predicate as `useOrgPlan.ts`) and refetch `get-host-reward-offer`. For the
`approved` trigger the grant happens with no client round-trip — the host sees Pro on next
natural refetch / reload; the completion-step copy must not imply it is instant.

### R9 — Parking "email" is not a completion blocker

`computeParkingSettingsCompletion` has no `email` section (`basic|media|details|features|location|payment`).
**Resolution:** `parking.<id>.email` is **Optional** in the guide (reply-to email is a soft
"recommended" check, not a required step). Only `basic`, `location`, `media`, `features`
(amenities), `payment` block the launcher for a parking listing.

### R10 — Reward → Free downgrade must reuse existing cascade

When a reward expires/revokes, `cancel_org_subscription_to_free` unenrolls properties; the
existing paid→Free degradations (team seats auto-deactivate, Smart Pricing stops applying,
Channel Sync pauses, custom templates lock) must fire unchanged. This is existing behavior — add
QA coverage, no new code.

### Confirmed OK (no change needed)

- `propertySectionPath(o, p, 'dashboard')` / `parkingSectionPath(o, k, 'dashboard')` /
  `orgDashboardPath(o)` all resolve to the dashboard — the redirect change is a clean swap.
- `approve-org-verification/index.ts` already branches on `tier === 'enhanced'` (sets
  `enhancedStatus:'approved'`) — single clean hook point for the `approved` trigger.
- `submit-org-verification` already sets `enhancedStatus:'pending'` — hook point for the
  `submitted` trigger.
- `ListingVerificationModal` is already designed to add a proof file to a listing authorization
  that onboarding left `pending` with rights only.
- `org_subscriptions` already has `status='trialing'` in its CHECK and a partial unique index on
  one live row per org — the eligibility pre-check in R4 respects it.

## Key decisions

1. **Non-blocking, persistent launcher — not a hard gate.** The guide auto-opens once, is
   dismissible anytime ("I'll finish later"), and then collapses to a launcher card on the org
   and property dashboards + a sidebar "Finish setup — N of M" entry with a dot. The launcher
   disappears automatically when all **Required** steps derive complete. Rationale: new hosts
   need to explore the product; the forced-modal pattern is reserved for compliance
   (verification changes-requested). Front-and-center but escapable.
2. **Embed the real section components, reuse the real save pipeline.** Each step mounts the
   existing settings section UI (or a thin wrapper) driven by the existing page draft + save
   hooks (via the Phase 2b controllers), scoped to that step's sections. No parallel forms, no
   parallel validation. This is the only way to honor "apply the same validation for all the
   fields and respect the current validation or flow from the respective pages".
3. **Step status is derived, never stored.** A step is `complete` when its underlying required
   fields pass the existing completion selector. Only guide meta (dismiss / complete / last step
   / explicitly skipped) is persisted. The guide can therefore never drift from the settings
   pages, and a host who configures something on the real page sees the guide update.
4. **Dynamic, per-listing stepper.** `setupGuideSteps.ts` builds the ordered step list at
   runtime from the **actual listings the host created at onboarding**
   (`{ hostModes, properties[], parkings[] }`), not from a fixed template. Three groups:
   - **A. Organization** (once) — brand.
   - **B. Per listing** (the listing block, repeated **once per listing**) — a host who created
     both a property **and** a parking gets the full property block **and** the full parking
     block, each scoped to that listing id, each with its own required-field set and its own
     completion state. Parking's block is shorter (no building forms / GAF, no guest-form
     toggles; it has cover photo + parking details + booking automation instead).
   - **C. Organization finish** (once) — verification & go-live (host Tier 1 + every listing's
     Tier 1 proof), team, Get Recommended reward, recap.

   `requiredRemaining` sums the incomplete required steps across **all** groups, so the launcher
   stays until org **and** every listing is set up. Progress is labeled per listing in the
   stepper rail ("Property · Solea 2005", "Parking · Bali P2-26").

5. **Owner-only auto-open.** Only `organizations.owner_id` auto-opens the modal (they did the
   onboarding). Team members with edit leaves see the launcher and can open it manually; steps
   they lack permission for render read-only with an "Ask your admin" note.
6. **Plan-gated features are optional "level up" cards, never required.** Voice receptionist,
   Smart Pricing, Channel Sync, custom templates, extra team seats appear as optional prompts
   with a `TierBadge`; they never block completion (`plans-and-permissions.mdc`).
7. **Pricing is Recommended, not Required.** A property always has working default rates, so the
   pricing step is a "review your rates and fees" prompt, not a completion blocker.
8. **Redirect to the listing dashboard, not settings.** `/onboarding` finish routes to the
   property dashboard (`/org/:orgSlug/property/:propertySlug`), else the parking dashboard
   (`/org/:orgSlug/parking/:parkingSlug`), else the org dashboard (`/org/:orgSlug/dashboard`).
   The Setup Guide auto-opens there. Rationale: the guide is the focus on arrival; dismissing it
   should reveal a real home, and the launcher card lives on that dashboard. `setLastTenantContext`
   / `setLastParkingContext` still run so the workspace switcher lands right.
9. **Verification reward = a super-admin-configured Pro grant.** Completing Recommended
   verification (trigger configurable: on submit or on super-admin approval) creates a
   time-limited Pro `org_subscriptions` row (`status='trialing'`, `price_php_snapshot=0`,
   `source='reward'`, `current_period_end = now + configured days`). It is **not** a new plan or a
   new entitlement path — it is the existing Pro plan, granted for free, expiring cleanly to Free
   unless the host converts. Everything about it (enabled, plan code, duration, trigger, campaign
   window, per-org cap, whether it can apply to an org already on a paid plan) is read from
   `platform_settings` and editable by super admin. The reward step is **optional** and never
   blocks guide completion.

## UX design

### Shell

- `ResponsiveModal` (`ui/src/components/ui/responsive-modal.tsx`): desktop centered
  `max-w-3xl` two-column (stepper rail + content); phone/tablet bottom sheet / full screen,
  sticky header + footer, scrollable middle (same pattern as `GetVerifiedModal` sheet layout).
- **Header:** guide title, "Step X of N", progress ring, close (X) → dismiss to launcher.
- **Left rail (lg+):** vertical stepper — step title, status glyph (check / dot / amber "skipped"),
  time hint, click to jump to any visited or reachable step. Collapses to a top progress bar +
  compact step chips on `max-lg`.
- **Body:** the step's embedded section(s). Opens focused on the first incomplete field.
  Inline field errors are the real ones from the section component.
- **Footer:** `Back` · `Skip for now` (always available) · `Save & continue` (runs the real
  save path for that step's dirty sections; advances on success, shows errors and stays on
  failure). Last step footer: `Finish`.
- Every step has an **"Open full page"** secondary link to the real settings route for hosts who
  prefer the full surface; progress stays in sync via derived state.

### Launcher

- Card on org dashboard (`OrgDashboardPage`), property dashboard (`DashboardPage`), and parking
  dashboard: "Finish setting up {listing name}", progress bar "N of M done" (from the resolved
  step list), primary `Continue`, subtle `Dismiss` → shrinks to a one-line pill for the session.
- Sidebar: "Finish setup" nav entry with a status dot while Required steps are incomplete
  (reuse the nav-dot mechanism from `settingsIssueOnTabs` in `AdminLayout`).
- Both auto-hide at 100% Required complete; the guide sets `settings.setupGuide.completedAt`
  and shows the completion step once.

### Completion step

- Checkmark + short recap: what is now **live** (guest form link, listing) vs **pending review**
  (host verification, listing proof of ownership). Reduced-motion: static; otherwise a small
  one-shot confetti.
- Deep links to Bookings, Public Pages (guest links to share), Get Verified.
- CTA: "Take the 2-minute product tour" (`HostDashboardTourPlayer`, already used on
  `/onboarding` and `/for-hosts`).
- **Reward status line** (only when the reward is enabled): "Recommended verification submitted —
  your month of Pro starts once it's approved" (trigger = approve, pending), or "Your month of
  Pro is active until {date}" (granted), or nothing (not submitted / not eligible).

### Accessibility / motion / copy

- Focus trap in modal; `Esc` = dismiss; focus returns to launcher `Continue`.
- Stepper rail is a real `<ol>` with `aria-current="step"`; status conveyed by text + icon, not
  color alone.
- 44x44 targets; no horizontal body scroll at 375px.
- Copy: invoke `human-copy` for every string; keep it minimal (`minimal-ui-copy`) — step titles,
  one-line helper max, button labels. No em dashes.

## Step catalog

The step list is **assembled at runtime** from the listings created at onboarding. "Required" =
blocks the launcher from disappearing. "Go-live" = blocks that listing's booking flow until done
(independent of the guide). Step ids are stable slugs, not numbers — `org.brand`,
`property.<id>.basics`, `parking.<id>.location`, `org.verification`, etc. — so `skippedSteps` /
`lastStepId` survive listing changes.

### Group A — Organization (once)

| Step id     | Step       | Required | Embeds                                                                             | Save path                                                          | Completion source                                   |
| ----------- | ---------- | -------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------ | --------------------------------------------------- |
| `welcome`   | Welcome    | —        | intro + full checklist preview (all groups) + time estimate                        | none                                                               | —                                                   |
| `org.brand` | Your brand | Required | Org Settings → Basic info (logo, brand color, tagline, description) + Socials (≥1) | `update-organization`, `org-settings`, `upload-org-settings-asset` | `computeOrgSettingsCompletion` (`basic`, `socials`) |

### Group B — Per listing (repeated once per listing the host created)

For **each** property the host created, a **Property block**; for **each** parking, a **Parking
block**. A property + parking host gets both blocks back to back. Each block is scoped to that
listing id and has its own completion state; the stepper rail labels the group with the listing
name.

**Property block** — `property.<id>.*`:

| Step id                   | Step                        | Required                                     | Embeds (Property Settings section)                                                                                                                    | Save path                                                            | Completion source (`computePropertySettingsCompletion` for that property)            | Go-live             |
| ------------------------- | --------------------------- | -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | ------------------- |
| `property.<id>.basics`    | Property basics             | Required                                     | Basic info (contact name/role/phone/email, brand color) + Property details (unit type, floor, check-in/out, self check-in)                            | `update-property`, `PATCH app-settings`                              | `basic`, `details`                                                                   | —                   |
| `property.<id>.location`  | Location                    | Required                                     | Location (address + city/province/country + map pin)                                                                                                  | `update-property`                                                    | `location`                                                                           | Yes                 |
| `property.<id>.content`   | Photos & listing content    | Required                                     | Photos (min 3) + Description + Amenities (min 5) + House Rules + Cancellation                                                                         | `upload-property-media`, `update-property`                           | `media`, `amenities`, `house-rules`, `cancellation`                                  | Yes (empty gallery) |
| `property.<id>.pricing`   | Pricing & fees              | Recommended                                  | Pricing → Rates & fees sidebar (weekday/weekend nightly + down payment, security deposit, extra-guest, pet, parking rate)                             | `PATCH property-pricing`                                             | "reviewed" flag (defaults always valid); Smart Pricing / Channel Sync optional cards | —                   |
| `property.<id>.payments`  | Payments                    | Required                                     | Payment Manage editor (≥1 method: provider, account name, account number; QR optional)                                                                | `PATCH app-settings` (+ `settings-verification` OTP if triggered)    | `payment`                                                                            | Yes                 |
| `property.<id>.guestform` | Guest form & building forms | Required                                     | Guest Form (pets/parking/decor toggles, cleaning time, preferred parking) + Building Forms (GAF owner, on-site contact, owner phone, signature)       | `update-property`, `PATCH app-settings`, `upload-app-settings-asset` | `guest-form`, `building-forms`                                                       | Yes (GAF)           |
| `property.<id>.email`     | Email & notifications       | Required (email) / Optional (Telegram, push) | Email automations (property/team email, SD lead hours, checkout age, automation toggles) + Telegram module shortcuts + "Notifications on this device" | `PATCH app-settings`, `telegram-*-settings`, push subscribe          | `email-automations` (Telegram/push never block)                                      | Partial             |

**Parking block** — `parking.<id>.*` (shorter — parking has no GAF / building forms and no
guest-form toggles; it has cover photo + parking details + booking automation instead):

| Step id                 | Step                    | Required      | Embeds (Parking Settings section)                                                                                                                                                         | Save path                                            | Completion source (`computeParkingSettingsCompletion` for that parking) | Go-live |
| ----------------------- | ----------------------- | ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- | ----------------------------------------------------------------------- | ------- |
| `parking.<id>.basics`   | Parking basics          | Required      | Basic info (contact fields, brand color) + Parking Details (check-in/out required; dimensions optional)                                                                                   | `update-parking` / `parking-settings`                | `basic`, `details`                                                      | —       |
| `parking.<id>.location` | Location                | Required      | Location (address + map pin)                                                                                                                                                              | `update-parking` / `parking-settings`                | `location`                                                              | Yes     |
| `parking.<id>.photo`    | Cover photo & amenities | Required      | Single cover photo (required) + Amenities (≥1)                                                                                                                                            | `upload-parking-settings-asset` + `parking-settings` | `media`, `features`                                                     | Yes     |
| `parking.<id>.pricing`  | Pricing                 | Recommended   | Parking pricing base rate (no fee sidebar)                                                                                                                                                | parking pricing edge                                 | "reviewed" flag (default valid)                                         | —       |
| `parking.<id>.payments` | Payments                | Required      | Payment Manage editor (≥1 method; QR optional)                                                                                                                                            | `PATCH app-settings` (+ OTP if triggered)            | `payment`                                                               | Yes     |
| `parking.<id>.email`    | Email & automation      | Optional (R9) | Email automation toggles + Booking Automation (auto-accept top match) + Telegram shortcuts — **no `email` completion section exists for parking**; soft "add a reply-to email" nudge only | `parking-settings`, `telegram-*-settings`            | none (never blocks)                                                     | —       |

### Group C — Organization finish (once)

| Step id            | Step                                   | Required | Embeds                                                                                                                                                                               | Save path                                                                    | Completion source                                                        |
| ------------------ | -------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `org.verification` | Verification & go-live                 | Required | Host Tier 1 status (from onboarding) + **one `ListingVerificationModal` proof upload per listing** (property and parking each need their own Tier 1 proof) + `GetVerifiedModal` link | `submit-listing-authorization` (per listing), existing verification uploads  | `readOrgVerificationDetail` + each listing's authorization status        |
| `org.team`         | Invite your team                       | Optional | Org Team → invite dialog + owner contact row (name/phone/email used in templates)                                                                                                    | team invite + contact PATCH                                                  | n/a (Optional)                                                           |
| `org.recommended`  | Get Recommended — 1 month of Pro on us | Optional | Recommended (`enhanced`) upload flow (selfie with ID + additional proof + Azure PMO) + **reward offer banner**                                                                       | `upload-org-verification-asset`, `submit-org-verification {tier:'enhanced'}` | `readOrgVerificationDetail` (`enhancedStatus`) + `get-host-reward-offer` |
| `org.done`         | You're all set                         | —        | Recap (live vs pending, per listing) + deep links + product tour + reward status line                                                                                                | none                                                                         | —                                                                        |

### Notes

- **Both-listing host:** every required step in the property block **and** every required step in
  the parking block **and** the org group must be complete before the launcher hides.
  `org.verification` is a single step but lists an upload slot per listing and is complete only
  when every listing's Tier 1 proof is submitted.
- **Ordering:** `welcome` → `org.brand` → `org.verification` → `org.recommended` → property block(s) → parking block(s) → `org.team` → `org.done` (verification + Recommended sit after org brand, before listings)
  → `org.team` → `org.recommended` → `org.done`. Blocks stay grouped so a host finishes one
  listing before starting the next; the rail still allows jumping.
- **Level-up cards** (optional, `TierBadge`, non-blocking): Smart Pricing + Channel Sync in
  `property.<id>.pricing`, Voice Receptionist in `property.<id>.guestform`, custom templates
  pointer after `*.email`, extra team seats in `org.team`.
- Templates (stay-guide + email copy) are not a step — shipped defaults send correctly; the
  recap links to Templates.
- **`org.recommended` without the reward:** disabled / campaign ended / org ineligible
  (`get-host-reward-offer` → `eligible:false`) → the step still shows Recommended verification as
  plain optional "build extra trust", no banner. Always optional.
- **Counts are dynamic** — the header + launcher show "N of M" from the assembled list (e.g. a
  property-only host ≈ 10 steps, a property + parking host ≈ 16).

## Progress & persistence model

### Assembled step list (`setupGuideSteps.ts`, pure)

Input: `{ hostModes, properties: [{ id, name }], parkings: [{ id, name }] }` (the listings the
org actually owns — normally the one or two created at onboarding). Output: an ordered
`SetupStep[]` with group + listing scope on each entry. One property + one parking →
`welcome`, `org.brand`, `org.verification`, `org.recommended`, 7 × `property.<id>.*`, 6 × `parking.<id>.*`,
`org.team`, `org.done`. Zero listings (edge case) → org group only.

### Derived status (`setupGuideProgress.ts`, pure)

Input: `{ steps, orgCompletion, propertyCompletionById: Record<id, result>,
parkingCompletionById: Record<id, result>, pricingReviewedById, verificationDetail,
listingAuthByListing }`. For each step: `complete` iff none of its mapped completion **section
ids** appear in that listing's / the org's `issueSectionIds` (plus step-specific extras, e.g.
`org.verification` needs a Tier 1 proof submitted for **every** listing). `skipped` iff in
`settings.setupGuide.skippedSteps` and not yet `complete`.
`requiredRemaining = steps.filter(required && status !== 'complete').length` — summed across the
org group and **every** listing block, so the launcher stays until org + each property + each
parking is set up.

**Pricing "reviewed":** there is no pricing completion selector. The pricing step is
**Recommended** (never in `requiredRemaining`), so it needs no persisted flag for launcher logic.
It shows `complete` once the host saves it in the guide at least once — tracked as an
id-keyed entry in `settings.setupGuide.reviewedSteps` (written via `setup-guide-state`), purely
cosmetic. Do not invent a `property_pricing.reviewed` DB column.

### Persisted meta

`organizations.settings.setupGuide = { version: 1, dismissedAt, completedAt, lastStepId,
skippedSteps: string[], reviewedSteps: string[] }` (`reviewedSteps` = cosmetic "done once" for
Recommended steps like pricing).

The reward **offer + grant state** is not stored here — it is read live from
`get-host-reward-offer` (`{ enabled, eligible, reason, planName, durationDays, trigger,
campaignEndsAt, grant: { status, periodEnd } | null }`), which reads `platform_settings` +
`readOrgVerificationDetail` + `getActiveOrgSubscription`. Step 12 and the completion line render
from this.

- **Write path (per R6):** new **`setup-guide-state`** edge function, `serveAuthenticated`,
  authorized for **any active member of the org** (not `org.settings.basic:edit` — a member must
  be able to dismiss/advance). It calls a new Postgres RPC
  **`set_org_setup_guide_state(p_org_id uuid, p_patch jsonb)`** (`SECURITY DEFINER`) that does
  `UPDATE organizations SET settings = COALESCE(settings,'{}'::jsonb) || jsonb_build_object(
'setupGuide', COALESCE(settings->'setupGuide','{}'::jsonb) || p_patch) WHERE id = p_org_id` —
  atomic, merges only `settings.setupGuide`, never clobbers sibling keys or races the org
  settings page. Migration adds the RPC only (no table change; `organizations.settings` is JSONB).
- **Write cadence:** debounce `lastStepId` writes (300-500ms); `dismissedAt` / `completedAt` /
  `skippedSteps` write immediately. Optimistic client state; the RPC is the source of truth.
- **Session snooze:** a `sessionStorage` key suppresses re-open within the same tab session
  after a dismiss, independent of the server `dismissedAt`.

### Auto-open rule

Open the modal automatically when **all** hold: user is `organizations.owner_id`; not on
`/admin/*`; an org context is resolved; `!settings.setupGuide.completedAt`;
`!settings.setupGuide.dismissedAt`; no session snooze; `HostVerificationChangesGate` is not
forcing (verification compliance wins). Otherwise render launcher only.

Set `completedAt` automatically the first render where `requiredRemaining === 0`, then show the
final "You're all set" step once. Optional steps (pricing, team, Get Recommended) never gate
`completedAt`.

## Architecture / file map

### New — `ui/src/features/dashboard/setup-guide/`

| Path                                                                                  | Responsibility                                                                                                                                                                                           |
| ------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `SetupGuideProvider.tsx`                                                              | Context; mounts overlay + owns open/step state; rendered in `AdminLayoutShell`                                                                                                                           |
| `hooks/useSetupGuideProgress.ts`                                                      | Fans out the org/property/parking settings + verification hooks **per listing id**, runs `setupGuideSteps` + `setupGuideProgress`                                                                        |
| `hooks/useSetupGuideState.ts`                                                         | Open/close, next/back/skip/jump (by step id), reads + writes `settings.setupGuide` via `useUpdateOrganization`                                                                                           |
| `lib/setupGuideSteps.ts`                                                              | Pure: assemble the ordered `SetupStep[]` (group + listing scope + slug id) from `{ hostModes, properties[], parkings[] }`; required flags; section-id map; time hints                                    |
| `lib/setupGuideProgress.ts`                                                           | Pure: `SetupStep[]` + per-listing completion results → `StepStatus[]` + `requiredRemaining`                                                                                                              |
| `lib/setupGuideState.ts`                                                              | Read/merge `settings.setupGuide`, session-snooze helpers                                                                                                                                                 |
| `components/SetupGuideOverlay.tsx`                                                    | `ResponsiveModal` shell + header + footer                                                                                                                                                                |
| `components/SetupGuideStepper.tsx`                                                    | Grouped vertical rail (lg+) — group headers ("Organization", "Property · {name}", "Parking · {name}") + steps; progress bar + chips (max-lg)                                                             |
| `components/SetupGuideSidebarEntry.tsx`                                               | Sidebar **Finish setup** entry + remaining count                                                                                                                                                         |
| `components/SetupGuideSettingsHost.tsx`                                               | Mounts the settings form provider/hook for a given `{ scope: 'org' \| 'property' \| 'parking', id }` headlessly; exposes `{ draft, setField, errors, saveDirtySections }` scoped to a step's section ids |
| `components/steps/*.tsx`                                                              | One thin wrapper per step **kind** (not per listing) — the property-block and parking-block wrappers are reused for every listing, parametrized by id                                                    |
| `components/steps/GetRecommendedRewardStep.tsx`                                       | `org.recommended` — embeds the Recommended (`enhanced`) upload flow + reward offer banner; reads `useHostRewardOffer`                                                                                    |
| `components/SetupGuideCompletionStep.tsx`                                             | Recap + tour CTA + reward status line                                                                                                                                                                    |
| `hooks/useHostRewardOffer.ts`                                                         | `GET get-host-reward-offer` for the current org (TanStack Query)                                                                                                                                         |
| `ui/src/features/dashboard/super-admin/components/.../HostVerificationRewardCard.tsx` | Super-admin config card (enabled, plan, duration, trigger, campaign window, per-org cap, apply-to-paid-org) + recent grants list with **Revoke**                                                         |

### Touched

| Path                                                                                                                     | Change                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ui/src/features/dashboard/bookings/components/AdminLayout.tsx`                                                          | Mount `<SetupGuideProvider />` beside `HostVerificationChangesGate` (non-super-admin, org context present)                                                                                                                                                                                                                                                                                                                                                                                         |
| `ui/src/features/dashboard/org/pages/OrgDashboardPage.tsx`, `ui/src/features/dashboard/property/pages/DashboardPage.tsx` | No dashboard Finish-setup banner (sidebar entry only)                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `ui/src/features/dashboard/bookings/lib/adminSidebarNav*` (org + property + parking nav builders) + `AdminLayout.tsx`    | New nav item "Finish setup" + **new `setupGuideIssuesStore`** + `useSyncExternalStore` hook mirroring the 3 existing settings-issue stores; dot shows across the **whole** org admin area while `requiredRemaining > 0` (R7)                                                                                                                                                                                                                                                                       |
| `ui/src/features/dashboard/org/hooks/useOrganizations.ts` + `types.ts`                                                   | Add `settings.setupGuide` to the org type                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `supabase/functions/setup-guide-state/index.ts` (new) + migration for `set_org_setup_guide_state` RPC                    | Any-active-member write path for `settings.setupGuide`, atomic `jsonb` merge (R6). Client hook `useSetupGuideStateWrite`.                                                                                                                                                                                                                                                                                                                                                                          |
| `ui/src/features/dashboard/bookings/components/PropertySettingsCard.tsx` + parking + org settings cards                  | **Phase 2b — extract `usePropertySettingsController` / `useParkingSettingsController` / `useOrgSettingsController`** (draft + dirty + section-scoped save + OTP + issue-store sync) with zero behavior change; cards become thin consumers (R1)                                                                                                                                                                                                                                                    |
| Property / parking / org settings **section components**                                                                 | Modal-only sections (Payment, Amenities, House Rules, Cancellation, Location) get an `embedded` render prop so the guide renders their body inline instead of stacking a `ResponsiveModal` (R2). Extent from Phase 0 audit.                                                                                                                                                                                                                                                                        |
| `ui/src/features/dashboard/org/pages/OnboardingPage.tsx` (`submitOnboarding`)                                            | Redirect target → listing dashboard (`propertySectionPath(o,p,'dashboard')` or the base property path) → parking dashboard → org dashboard, instead of `'settings'`. Keep `setLastTenantContext` / `setLastParkingContext`.                                                                                                                                                                                                                                                                        |
| `ui/src/features/dashboard/org/lib/orgLanding.ts` (`resolvePostSignInPath` / `resolveOrgLandingPath`)                    | No change needed (already targets `/org/:slug/dashboard`); confirm a host who onboarded in a previous session still lands somewhere the guide auto-opens.                                                                                                                                                                                                                                                                                                                                          |
| `supabase/migrations/<new>_host_verification_reward.sql`                                                                 | `platform_settings` reward columns (below) + `org_subscriptions.source TEXT NOT NULL DEFAULT 'purchase'` (`'purchase' \| 'admin' \| 'reward'`) + `CREATE INDEX ... WHERE status='trialing' AND source='reward'` for the expiry sweep. `org_subscription_events.event_type` **is** a CHECK — `ALTER` it to add `reward_granted` / `reward_expired` / `reward_revoked`. Backfill `source='admin'` for existing `price_php_snapshot=0` rows. Filename timestamp must sort after the latest migration. |
| `supabase/functions/platform-settings/index.ts`                                                                          | Read/write the new reward fields (already `serveSuperAdmin`).                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `supabase/functions/submit-org-verification/index.ts`                                                                    | (a) When `tier:'enhanced'` **and** the org is reward-eligible, **bypass** the `requireOrgPropertyFeature(orgId,'recommendedBadgeEligible')` gate (R3). (b) When `trigger='recommended_verification_submitted'`, call `maybeGrantHostVerificationReward(orgId)` after `enhancedStatus:'pending'` is written.                                                                                                                                                                                        |
| `supabase/functions/approve-org-verification/index.ts`                                                                   | In the existing `tier === 'enhanced'` → `enhancedStatus:'approved'` branch, call `maybeGrantHostVerificationReward(orgId)` when `trigger='recommended_verification_approved'`.                                                                                                                                                                                                                                                                                                                     |
| `supabase/functions/_shared/planEntitlements.ts`                                                                         | **New standalone `grantOrgSubscriptionReward(orgId, { planId, durationDays, applyToPaidOrg })`** (R4) — own insert `status:'trialing'`, `price_php_snapshot:0`, `source:'reward'`, `current_period_start/end`; reuse the property-enrollment loop + `chunkIds` + `writeOrgSubscriptionEvent`. `maybeGrantHostVerificationReward(orgId)` wraps it with the `platform_settings` eligibility checks + `max_per_org` (count of `reward_granted` events) + campaign window.                             |
| `supabase/functions/_shared/subscriptionOrchestrator.ts`                                                                 | `expireHostVerificationRewards()` (R5) — match `status='trialing' AND source='reward' AND current_period_end <= now`; look up the Free plan id; `cancel_org_subscription_to_free(subId, freePlanId, 'trialing', null)` + `reward_expired` event; call it from `runPlatformBillingCycle`. Reminder emails at T-7/T-3/T-1. In `fulfillOrgSubscriptionPayment`, also set `source='purchase'` when a trialing row converts.                                                                            |
| `supabase/functions/get-host-reward-offer/index.ts` (new)                                                                | Per-org offer + grant state read for step 12 / completion line.                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `supabase/functions/org-subscriptions-admin/index.ts`                                                                    | Include `source` in the row payload; add a `revoke_reward` PATCH action (→ cancel to Free + `reward_revoked` event).                                                                                                                                                                                                                                                                                                                                                                               |

### Reused as-is

`ResponsiveModal`, `TierBadge` / `useFeatureGate` / `UpgradeModalProvider`,
`HostDashboardTourPlayer`, `ListingVerificationModal`, `GetVerifiedModal`,
`OnboardingHostVerificationSection`, all `compute*SettingsCompletion` modules, all
`*Save.ts` pipelines, `usePropertySettingsForm` / parking / org settings form hooks.

## Validation reuse (explicit — do not re-implement)

| Concern                                         | Module                                                                                                                        |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Property section completeness + field errors    | `ui/src/features/dashboard/org/lib/propertySettingsCompletion.ts`, `propertySettingsFieldError.ts`, `propertySettingsSave.ts` |
| Parking section completeness                    | `ui/src/features/dashboard/parking/lib/parkingSettingsCompletion.ts`                                                          |
| Org section completeness                        | `ui/src/features/dashboard/org/lib/orgSettingsCompletion.ts`, `orgSettingsFieldError.ts`, `orgSettingsSave.ts`                |
| Shared field rules (name, PH phone, email, URL) | `ui/src/lib/validation/fieldValidation.ts` (+ edge mirror `supabase/functions/_shared/fieldValidation.ts`)                    |
| Payment                                         | `ui/src/features/dashboard/org/lib/paymentProviders.ts`, `paymentMethods.ts`                                                  |
| Cancellation policy                             | `ui/src/features/dashboard/org/lib/propertyCancellationPolicy.ts`                                                             |
| Pricing patch                                   | `ui/src/features/dashboard/pricing/lib/pricingSave.ts`, `pricingDefaults.ts`                                                  |
| Cleaning buffer                                 | `ui/src/lib/cleaningBuffer.ts` (+ `_shared/cleaningBuffer.ts`)                                                                |
| Verification files + status                     | `ui/src/features/dashboard/org/lib/orgVerification.ts`, `orgVerificationTiers.ts`                                             |
| Reserved names                                  | `ui/src/lib/validation/reservedDisplayNames.ts`                                                                               |

The guide imports these; it adds **zero** new validation logic.

## Plans & permissions

- **Guide visibility:** all plans, all org members with any relevant `*settings*:edit` /
  `pricing.rates:edit` / `notifications.*:edit` leaf. Auto-open: owner only.
- **Per-step permission:** a step whose sections the member cannot edit renders read-only with
  "Ask an org admin to finish this" and never counts against them (still contributes to org
  progress from saved state).
- **Plan gates:** required steps only touch always-free capabilities. Optional level-up cards use
  `useFeatureGate` + `TierBadge` + `UpgradeModalProvider`, identical to their home pages. Team
  step: `Send invitation` respects `teamManagement` seat cap exactly as `/org/:orgSlug/team`.
- Fill the `plans-and-permissions` checklist in the implementation PR (new dashboard module).
- **Reward step permission:** the Recommended upload + submit is owner-only today
  (`GetVerifiedModal` submits as org owner). Step 12 mirrors that — non-owners see a read-only
  "Ask the org owner to complete verification" state.

## Host verification reward (1 month of Pro)

### Trigger

Configurable in `platform_settings`:

- `recommended_verification_submitted` — grant immediately when the host submits Recommended
  (`submit-org-verification {tier:'enhanced'}` sets `enhancedStatus='pending'`). Simpler, more
  generous, risk of grants for submissions that later fail review.
- `recommended_verification_approved` (**default**) — grant in the `approve-org-verification`
  `tier === 'enhanced'` branch. Safer; no self-serve abuse window.

**Entitlement carve-out (R3):** a Free host cannot submit Recommended today
(`requireOrgPropertyFeature(orgId,'recommendedBadgeEligible')` in `submit-org-verification`). When
`host_reward_enabled` and the org is reward-eligible, `submit-org-verification` **skips that gate
for `tier:'enhanced'`** so the reward can be earned; everyone else still hits the gate. Combined
with the `approved` default trigger, no Pro is granted until a human approves.

### Grant mechanism (`grantHostVerificationReward`)

1. Load reward config from `platform_settings`; bail if `!enabled`, outside the campaign window,
   or the org already used its `max_per_org` reward grants (`org_subscription_events` where
   `event_type='reward_granted'`).
2. Resolve the reward plan (`plan_code`, default `growth` = Pro).
3. Eligibility vs current subscription:
   - No live subscription (org on Free) → **`grantOrgSubscriptionReward`** (standalone, R4): own
     insert of an `org_subscriptions` row `status='trialing'`, `source='reward'`,
     `price_php_snapshot=0`, `current_period_start=now`, `current_period_end=now + duration_days`;
     then enroll all org properties via the shared `org_subscription_properties` loop +
     `chunkIds` + `writeOrgSubscriptionEvent`. Respects the one-live-row partial unique index
     because this branch only runs when there is no live sub.
   - Already on a **paid** plan → controlled by `apply_to_paid_org` config: `skip` (default —
     offer copy says "you're already on a paid plan"), or `extend` (`adminExtendOrgSubscription`
     by `duration_days`, `reward_granted` event, no plan change).
   - Already on a **reward trial** → no double grant.
4. Append `org_subscription_events` `{ event_type:'reward_granted', note, new_status:'trialing',
new_plan_id }`.
5. Fire a host notification + email ("You've unlocked 1 month of Pro").

Idempotent — a repeat call for an org that already has a `reward_granted` event within the cap
is a no-op.

### Expiry / conversion (`expireHostVerificationRewards`, called by `runPlatformBillingCycle`)

- Match rows strictly by `status='trialing' AND source='reward' AND current_period_end <= now`.
  Look up the Free plan id (`pricing_plans` where `code='free'`), then
  `cancel_org_subscription_to_free(subId, freePlanId, 'trialing', null)` + append a
  `reward_expired` event. **Downgrade to Free — never `past_due` / `suspended`** (that path only
  scans `active`/`past_due`, so a `trialing` reward row is naturally invisible to it).
- Reminder emails at **T-7 / T-3 / T-1** with a link to `/org/:orgSlug/plans` to keep Pro.
- **Conversion:** `fulfillOrgSubscriptionPayment` already finds the `trialing` row, sets
  `status='active'`, and rolls the remaining trial days into the paid month. Add one line there
  to also set `source='purchase'`. The expiry sweep then never touches it (status ≠ trialing).

### Revoke

Super-admin, from the `HostVerificationRewardCard` grants list or the org row on
`/admin/pricing/subscriptions`: `org-subscriptions-admin` PATCH `revoke_reward` →
`cancel_org_subscription_to_free(subId, freePlanId, <currentStatus>, adminUserId)` +
`reward_revoked` event. Used for abuse / mistaken grants.

### `platform_settings` columns (new migration)

| Column                          | Type / default                                              | Meaning                                                               |
| ------------------------------- | ----------------------------------------------------------- | --------------------------------------------------------------------- |
| `host_reward_enabled`           | `BOOLEAN NOT NULL DEFAULT FALSE`                            | Master on/off                                                         |
| `host_reward_plan_code`         | `TEXT DEFAULT 'growth'`                                     | Plan granted (FK-checked against `pricing_plans.code` in the edge fn) |
| `host_reward_duration_days`     | `INT NOT NULL DEFAULT 30 CHECK (> 0)`                       | Trial length                                                          |
| `host_reward_trigger`           | `TEXT NOT NULL DEFAULT 'recommended_verification_approved'` | `submitted` \| `approved`                                             |
| `host_reward_campaign_start`    | `TIMESTAMPTZ` (null = always)                               | Campaign window start                                                 |
| `host_reward_campaign_end`      | `TIMESTAMPTZ` (null = always)                               | Campaign window end                                                   |
| `host_reward_max_per_org`       | `INT NOT NULL DEFAULT 1 CHECK (>= 1)`                       | Lifetime grants per org                                               |
| `host_reward_apply_to_paid_org` | `TEXT NOT NULL DEFAULT 'skip'`                              | `skip` \| `extend`                                                    |

All read/written via `platform-settings` (`serveSuperAdmin`); surfaced on
`HostVerificationRewardCard`.

### Super-admin surface

New card **Host verification reward** on `/admin/settings` (AI Management page) or
`/admin/platform-settings` — whichever the Phase 0 review picks. Controls = the table above +
a **recent grants** list (org, granted at, expires, status) with **Revoke**. Also add a
`source` column + reward filter to the `/admin/pricing/subscriptions` table so reward trials are
visible there.

## Phase 0 — Research notes (2026-09-06)

### Competitive UX brief — Host Setup Guide

**Job:** After signup, get a new host from empty workspace → ready to accept bookings without hunting settings.
**Role:** Host (operator)
**Surface:** Property/org admin dashboard overlay + persistent launcher
**Commit point:** Saving each settings section (reversible); Recommended verification submit (reviewable); reward grant (super-admin configurable, auto-expires)

#### Airbnb (host listing setup)

- **Flow:** Linear step groups ("Tell us about your place" → "Make it stand out" → "Finish and publish") with a visual progress bar and one primary Continue CTA.
- **Auth:** Host is already signed in; listing draft persists across sessions.
- **Mobile:** Full-screen mobile onboarding, not a nested modal stack.
- **Notable:** Earnings nudges and Superhost help can interrupt early — avoid premature coaching popups while the host is mid-form. Progress + single CTA keep momentum.

#### PMS leaders (Guesty / Hostaway / Lodgify / Hospitable / OwnerRez)

- **Guesty:** Onboarding Hub with progress tracking + phased checklists (account → channels → payments → team). Guided specialist path for complex ops; self-serve checklist for lighter hosts.
- **Hostaway:** Ordered setup checklist (profile → listing import → OTA connect → rates → messaging → payments → team). Persistent "finish setup" style task list, not a hard gate. Guided onboarding is multi-hour; we should stay self-serve like Hospitable/Lodgify for solo hosts.
- **Lodgify / Hospitable:** Fast self-serve: property basics → channels/payments → go-live. Checklist + expert optional, not a blocking wizard.
- **OwnerRez:** Front-loaded configuration depth — warns against dumping every settings surface into one forced wizard.

#### Adopt / adapt / skip (Kame Homes)

| Pattern                                            | Decision                                                                              |
| -------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Non-blocking persistent launcher + progress        | **Adopt** — matches Guesty/Hostaway; aligns with plan decision #1                     |
| Required vs review/optional split                  | **Adopt** — Airbnb publish blockers vs polish; our Required / Recommended / Optional  |
| Grouped steps (org → listing → finish)             | **Adopt** — Hostaway-style ordered checklist; per-listing blocks for property+parking |
| Single primary CTA per step                        | **Adopt** — Save & continue                                                           |
| Earnings / coaching interrupt popups               | **Skip** — no mid-step Superhost-style interrupts                                     |
| Forced full-screen wizard that locks the dashboard | **Skip** — keep dismissible overlay + launcher                                        |
| Human CS onboarding calls                          | **Skip** — self-serve only; reward is the incentive                                   |

### Codebase name map (plan ↔ repo)

| Plan wording                                           | Actual in repo                                                                                                                                    |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PropertySettingsCard`                                 | `ui/src/features/dashboard/bookings/components/PropertySettingsCard.tsx` (~1k LOC)                                                                |
| `ParkingSettingsCard`                                  | `ui/src/features/dashboard/parking/components/ParkingSettingsCard.tsx`                                                                            |
| Org settings card                                      | `ui/src/features/dashboard/org/pages/OrgSettingsPage.tsx` (owns drafts; sections are presentational)                                              |
| `computePropertySettingsCompletion`                    | `computePropertySettingsCompletion` in `propertySettingsCompletion.ts`                                                                            |
| `computeOrgSettingsCompletion`                         | `computeOrgSettingsCompletion` — sections `basic` \| `branding` (socials live under **branding**)                                                 |
| `computeParkingSettingsCompletion`                     | `computeParkingSettingsCompletion` — `basic` \| `media` \| `details` \| `features` \| `location` \| `payment` (no `email` section — R9 confirmed) |
| `submit-org-verification` + `recommendedBadgeEligible` | `submit-org-verification` + feature key **`recommendedBadgeEligible`**                                                                            |
| `upload-org-verification-asset`                        | `upload-org-verification-asset` — **no** plan feature gate                                                                                        |
| Admin overlay mount                                    | `AdminLayoutShell` in `AdminLayout.tsx` beside `HostVerificationChangesGate`                                                                      |
| `/admin/settings`                                      | **AI Management** (`SuperAdminSettingsPage`) — kill switches / wallets                                                                            |
| `/admin/platform-settings`                             | **Platform settings** (`SuperAdminPlatformSettingsPage`) — signups, maintenance, default plan, legal                                              |

### R2 — Embeddability audit

| Guide step / section                                      | Surface today                                                            | Classification                                                               | Phase work                                                                        |
| --------------------------------------------------------- | ------------------------------------------------------------------------ | ---------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Org brand (logo, name, tagline, description, brand color) | `OrgSettingsFields` / profile sections inline                            | **Inline drop-in**                                                           | Phase 3 — scope via org controller                                                |
| Org socials (≥1 link)                                     | Same page; completion under `branding`                                   | **Inline drop-in**                                                           | Phase 3 (same `org.brand` step)                                                   |
| Property basics / details                                 | `PropertyProfileMainSections` inline                                     | **Inline drop-in**                                                           | Phase 3                                                                           |
| Property location                                         | Summary + **Manage** `ResponsiveModal` (`PropertyLocationSettingsBlock`) | **Modal-only → needs `embedded`**                                            | Phase 3 — extract picker body; prefer inline in guide                             |
| Property photos                                           | `PropertyMediaUpload` inline                                             | **Inline drop-in**                                                           | Phase 4                                                                           |
| Property description                                      | Inline in profile sections                                               | **Inline drop-in**                                                           | Phase 4                                                                           |
| Amenities                                                 | Summary + `PropertyAmenitiesManageDialog`                                | **Modal-only → needs `embedded`**                                            | Phase 4                                                                           |
| House rules                                               | Summary + `PropertyHouseRulesManageDialog`                               | **Modal-only → needs `embedded`**                                            | Phase 4                                                                           |
| Cancellation                                              | Summary + Manage modal; already has **`embedded?: boolean`**             | **Partial** — reuse/extend `embedded`                                        | Phase 4                                                                           |
| Payment methods                                           | Summary + Manage modal in `PropertyOperationalSettingsSections`          | **Modal-only → needs `embedded`**                                            | Phase 5 — also OTP (`SensitiveSettingsOtpDialog`)                                 |
| Guest form + building forms                               | Inline operational sections                                              | **Inline drop-in**                                                           | Phase 6                                                                           |
| Email automations                                         | Mostly inline; "automated sends" sub-modal                               | **Inline + optional sub-modal**                                              | Phase 6 — keep sub-modal OK                                                       |
| Voice / AI / guest rewards / Telegram                     | Plan-gated optional cards                                                | **Inline drop-in** (optional level-up)                                       | never Required                                                                    |
| Property danger zone                                      | Confirm modals only                                                      | **Out of guide**                                                             | skip                                                                              |
| Parking basics / details / features / media               | Inline in `ParkingSettingsCard` sections                                 | **Inline drop-in**                                                           | Phases 3–4                                                                        |
| Parking location                                          | Inline (no Manage-modal twin found)                                      | **Inline drop-in**                                                           | Phase 3                                                                           |
| Parking payment                                           | Inline in card + OTP dialog                                              | **Inline + OTP overlay**                                                     | Phase 5 — OTP stacks on guide (allowed; same as settings)                         |
| Parking archive/restore/delete                            | Confirm modals                                                           | **Out of guide**                                                             | skip                                                                              |
| Org verification / listing proof                          | `GetVerifiedModal` / `ListingVerificationModal`                          | **Existing modals — embed or deep-link**                                     | Phase 7 — prefer embedding upload bodies; stack with `overlayClassName` if needed |
| Team invite                                               | Existing invite dialog                                                   | **Modal OK** (optional step)                                                 | Phase 7                                                                           |
| Pricing                                                   | Separate Pricing page / rate sidebar                                     | **Separate surface** — thin "review rates" step, not full editor embed in v1 | Phase 5 — Recommended only                                                        |

**Sizing takeaway:** Phase 4–5 must budget `embedded` (or body extraction) for **Payment, Amenities, House Rules, Location**; Cancellation already has a foothold. Parking is cheaper to embed than property.

### R1 — Controller extraction map

#### `usePropertySettingsController(propertyId)` — lift from `PropertySettingsCard`

| Concern                                | Owns today (must move)                                                                                          |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Profile draft + baseline               | `profileDraft` / `profileBaseline` + sync effects from `property`                                               |
| Operational draft + baseline           | `operationalDraft` / `operationalBaseline` from `useAppSettings` + building-forms team defaults                 |
| Voice draft + baseline                 | `voiceDraft` / `voiceBaseline` (optional for guide)                                                             |
| Custom amenity / house-rule input maps | local `useState` maps                                                                                           |
| Dirty detection                        | `propertyProfileDraftIsDirty`, `operationalSettingsDraftIsDirty`, payment fingerprint, voice dirty              |
| Field interaction + show-errors        | `interactedFields`, `showValidationErrors`, `resolveFieldError`                                                 |
| Completion / issue store               | `usePropertySettingsCompletionForDraft` → `setPropertySettingsIssueSections`                                    |
| Section-scoped save                    | `planPropertySettingsSave` / `buildProfilePatchForSections` / `buildAppSettingsPatchForSections` / `handleSave` |
| Payment OTP                            | `paymentOtpOpen`, fingerprint, `SensitiveSettingsOtpDialog`, resume save after verify                           |
| Name / tower conflict gates            | `useCheckPropertyName`, `useTowerUnitConflict`                                                                  |
| Permissions                            | `usePropertyPermissions` + section edit leaves                                                                  |
| Media busy                             | gallery upload busy flag                                                                                        |

**Not owned by controller (stay in card/guide shell):** page chrome (`AdminMobilePage`, section nav layout), navigate-away, archive/delete modals.

#### `useParkingSettingsController(parkingId)` — lift from `ParkingSettingsCard`

Same pattern: profile / operational / features / location / details / automation drafts + baselines, dirty predicates, `setParkingSettingsIssueSections`, `handleSave`, payment OTP, validation interaction state. Archive/restore/delete modals stay in the card.

#### `useOrgSettingsController(orgId)` — lift from `OrgSettingsPage`

`profileDraft` / `operatorDraft` + baselines, dirty, `handleSave`, interaction/validation, org completion sync (`OrgSettingsIssuesSync`). Danger zone stays page-only.

**Phase 2b rule:** extract hooks → cards/pages become thin consumers → **zero behavior change** → ship before any guide step body.

### R3 — Recommended gate confirmation

| Gate                                                           | Location                                                  | Blocks Free host?                                                                                 |
| -------------------------------------------------------------- | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `requireOrgPropertyFeature(orgId, 'recommendedBadgeEligible')` | `submit-org-verification` when `tier === 'enhanced'`      | **Yes** — only Free-blocking server gate on submit                                                |
| Plan gate in assistant tools                                   | `_shared/dashboardAssistantVerificationTools.ts`          | Yes for assistant path — mirror reward carve-out or leave assistant on Pro-only                   |
| Client `useFeatureGate('recommendedBadgeEligible')`            | `GetVerifiedModal` before enhanced submit                 | **Yes** — must bypass when reward-eligible or Free hosts never reach the server                   |
| `upload-org-verification-asset`                                | upload function                                           | **No** plan feature check (confirmed)                                                             |
| Listing Recommended (separate product)                         | `submit-listing-recommended` + `ListingVerificationModal` | Separate from org enhanced reward path — **out of reward carve-out** unless product expands later |

**Decision:** implement R3 carve-out on **`submit-org-verification`** + matching **client bypass** in `GetVerifiedModal` / guide step when `get-host-reward-offer` says eligible. Default trigger remains **`recommended_verification_approved`**.

### Admin surface decision

**Host `HostVerificationRewardCard` on `/admin/platform-settings`** (`SuperAdminPlatformSettingsPage`), not `/admin/settings` (AI Management). Reward config sits with signups / default plan / campaign-style platform knobs. Recent grants + Revoke live on that card; `/admin/pricing/subscriptions` gets `source` column + reward filter (Phase 8).

### Phase 0 open questions (resolved or deferred)

| #                      | Question                      | Resolution                                                                                    |
| ---------------------- | ----------------------------- | --------------------------------------------------------------------------------------------- |
| Admin card location    | settings vs platform-settings | **platform-settings**                                                                         |
| R3 only gate?          | —                             | **Server submit + client GetVerifiedModal**; upload clean; assistant tools optional follow-up |
| Launcher placement     | card + sidebar vs top strip   | Keep plan default (card + sidebar); confirm in Phase 2 visual review                          |
| Reward trigger default | submit vs approve             | Keep **approve** (plan default)                                                               |
| "Both" host redirect   | org vs property dashboard     | Keep plan default (org dashboard); confirm Phase 2                                            |

### Phase 0 — research + embeddability audit

- [x] `competitive-ux-research` pass recorded above.
- [x] **R2 audit** table recorded above.
- [x] **R1 audit** controller ownership map recorded above.
- [x] **R3 confirm** — submit gate + client gate; upload clean.
- [x] Admin page = `/admin/platform-settings`.
- [x] Acceptance: audit tables + decisions appended; no code in Phase 0.

## Implementation phases

### Phase 0 — research + embeddability audit

- [x] Complete — see **Phase 0 — Research notes** above.

### Phase 1 — step assembly + progress model

- [x] `setupGuideSteps.ts` — assemble `SetupStep[]` from `{ hostModes, properties[], parkings[] }`
      (org group + one block per property + one block per parking + org finish group), stable slug
      ids, group + listing scope on each step.
- [x] `settings.setupGuide` type via `SetupGuidePersistedState` + `readSetupGuidePersistedState`
      (org `settings` stays `Record<string, unknown>`; typed read helper, no org type break).
- [x] `setupGuideProgress.ts` pure mapper + vitest harness (`setupGuideSteps.test.ts`) for:
      property-only, parking-only, **property + parking**, two properties; empty / partial /
      complete. `requiredRemaining` sums across all blocks and ignores Optional/Recommended.
- [x] `useSetupGuideProgress` — assembles steps from org listings; org completion from
      `useSavedOrgSettingsCompletion`; verification + listing Tier 1 from settings readers.
      Property/parking issue maps default to “all open” until Phase 2b controllers expose
      saved per-listing completion (callers can pass overrides).
- [x] Acceptance: both-listings org shows property **and** parking blocks; required count
      sums across blocks (covered by unit tests). Live flip-on-settings-save lands with Phase 2b.

### Phase 1b — persistence (R6)

- [x] Migration: `set_org_setup_guide_state(uuid, jsonb)` RPC (atomic `settings.setupGuide`
      merge). Local `db:migrate`.
- [x] `setup-guide-state` edge function (`serveAuthenticated`, any active org member) → RPC.
- [x] `useSetupGuideStateWrite` hook: debounced `lastStepId`, immediate `dismissedAt` /
      `completedAt` / `skippedSteps` / `reviewedSteps`; optimistic + refetch org.
- [x] Acceptance: two concurrent writers (guide + org settings page) never clobber each other's
      `settings` keys; a member without `org.settings.basic:edit` can still dismiss/advance.
      (RPC merges only `setupGuide`; edge skips settings-edit permission. Local RPC applied.)

### Phase 2 — shell + stepper + launcher (no step bodies)

- [x] `SetupGuideProvider` mounted in `AdminLayout` (wraps shell); auto-open rule; session snooze;
      dismiss / complete writes.
- [x] `SetupGuideOverlay` + stepper rail with placeholder step bodies ("coming next").
- [x] Sidebar "Finish setup" entry + dot (dashboard Finish-setup banner removed).
- [x] Navigation: next / back / skip / jump; `lastStepId` persistence; resume on reopen.
- [x] **Redirect change:** `OnboardingPage.submitOnboarding()` → listing dashboard (property →
      parking → org), keeping last-tenant context setters.
- [ ] Acceptance: owner sees modal once post-onboarding on the listing dashboard; dismiss →
      launcher; reopen resumes; launcher hides when `requiredRemaining === 0` (manual QA).

### Phase 2b — settings controller extraction (R1) — ships on its own

- [x] Extract `usePropertySettingsController` from `PropertySettingsCard.tsx` —
      draft state, dirty predicates, section-scoped save, OTP flow, issue-store sync.
      Card is a thin consumer. Re-export: `org/hooks/usePropertySettingsController.ts`.
- [x] Same for `useParkingSettingsController` and `useOrgSettingsController`.
- [ ] Full regression pass on all three settings pages (manual QA).
- [x] `bun run type-check` clean after extraction.

> Phases 3-6 build the reusable **step-kind wrappers** on top of the Phase 2b controllers. Each
> property-block / parking-block wrapper is written once and rendered per listing id via
> `SetupGuideSettingsHost({ scope, id })`. Acceptance for every phase includes the **property +
> parking** run: each listing's block gets its own instance and its own completion state.

### Phase 3 — `org.brand` + `*.basics` + `*.location`

- [ ] `SetupGuideSettingsHost({ scope, id })` — instantiate the Phase 2b controller for that
      scope, expose draft/errors/save filtered to a step's section ids.
- [ ] `org.brand` wrapper (org basic + socials + logo upload); `property.*.basics` wrapper
      (basic + details); `parking.*.basics` wrapper (basic + parking details); `*.location`
      wrapper for both listing kinds.
- [ ] Each step: opens on first incomplete field, real inline errors, `Save & continue` runs the
      real dirty-section save, advances on success.
- [ ] Acceptance: on a property + parking org, the property basics/location and parking
      basics/location steps each appear once, save independently, and match the DB writes of the
      real settings pages; red dots clear per listing.

### Phase 4 — `*.content` / `*.photo`

- [ ] `property.*.content` wrapper: Photos (min 3) + Description + Amenities (min 5) + House
      Rules + Cancellation (reuse `PropertyMediaUpload`, `PropertyAmenitiesManageDialog`,
      `PropertyHouseRulesManageDialog`, `PropertyCancellationPolicySection` inline).
- [ ] `parking.*.photo` wrapper: single cover photo (required) + Amenities (≥1).
- [ ] Acceptance: min-count validation matches `MIN_PROPERTY_PHOTOS` / `MIN_PROPERTY_AMENITIES`
      and the parking cover-photo rule; runs per listing.

### Phase 5 — `*.pricing` + `*.payments`

- [ ] `property.*.pricing` (rates & fees sidebar; Smart Pricing + Channel Sync optional cards)
      and `parking.*.pricing` (base rate only); "reviewed" flag on save. Never blocks.
- [ ] `*.payments` wrapper for both kinds: Payment Manage editor + `settings-verification` OTP
      path inline (first-time payment set may trigger OTP — guide waits).
- [ ] Acceptance: each listing needs its own valid primary payment method; OTP works inside the
      guide; a property + parking org must complete payments twice.

### Phase 6 — `property.*.guestform` + `*.email`

- [ ] `property.*.guestform`: Guest Form toggles + cleaning time + preferred parking + Building
      Forms owner fields + signature (`upload-app-settings-asset`). Voice Receptionist optional
      card. (No parking equivalent.)
- [ ] `*.email` wrapper: property → Email automations (email + timing + toggles); parking →
      email automation toggles + Booking Automation. Telegram + "Notifications on this device" as
      Optional sub-cards that never block.
- [ ] Acceptance: `guest-form` + `building-forms` + `email-automations` derive complete per
      property; parking `email` completes on the reply-to email alone.

### Phase 7 — `org.verification` + `org.team` + `org.done`

- [ ] `org.verification`: host Tier 1 status readout + **one proof-upload slot per listing**
      (`ListingVerificationModal` per property and per parking) + `GetVerifiedModal` link.
      Complete only when **every** listing's Tier 1 proof is submitted (go-live still waits on
      super-admin approval, shown per listing as "pending review").
- [ ] `org.team` (Optional): team invite + owner contact row.
- [ ] Final step: `SetupGuideCompletionStep` — live vs pending recap, deep links, tour CTA,
      "customize templates later" pointer, reward status line placeholder. Sets `completedAt`.
- [ ] Acceptance (property + parking org): the guide is not "done" until the org group **and**
      the full property block **and** the full parking block have every Required step complete;
      finishing them all auto-advances to `org.done`; launcher + sidebar dot gone; optional steps
      left undone do not block.

### Phase 8 — host verification reward

- [ ] Migration: `platform_settings` reward columns; `org_subscriptions.source` +
      `CHECK`; expiry-sweep index; `ALTER` `org_subscription_events.event_type` CHECK to add the
      three reward events; backfill `source`. Separate migration for the `set_org_setup_guide_state`
      RPC already landed in Phase 1b. Local `db:migrate`.
- [ ] `platform-settings` edge fn reads/writes the reward fields; `host_reward_plan_code`
      validated against `pricing_plans.code`.
- [ ] **`grantOrgSubscriptionReward`** (standalone, `planEntitlements.ts`) + **`maybeGrantHostVerificationReward`**
      wrapper (eligibility: enabled, campaign window, `max_per_org` via `reward_granted` event
      count, current-sub check → grant | `extend` | skip). Idempotent.
- [ ] **`expireHostVerificationRewards`** in `subscriptionOrchestrator.ts` — strict
      `status='trialing' AND source='reward' AND current_period_end <= now`; Free plan id lookup;
      `cancel_org_subscription_to_free` + `reward_expired`. Wire into `runPlatformBillingCycle`.
      Add `source='purchase'` write in `fulfillOrgSubscriptionPayment` on trial conversion.
- [ ] T-7 / T-3 / T-1 reminder emails + grant "unlocked Pro" email + notification event type
      (`notificationService`).
- [ ] `submit-org-verification`: (a) **skip `recommendedBadgeEligible` gate for `enhanced` when
      reward-eligible** (R3); (b) call `maybeGrantHostVerificationReward` when
      `trigger='recommended_verification_submitted'`.
- [ ] `approve-org-verification`: call `maybeGrantHostVerificationReward` in the `enhanced`
      approve branch when `trigger='recommended_verification_approved'`.
- [ ] `get-host-reward-offer` edge fn (any active org member) + `useHostRewardOffer` hook.
- [ ] `org.recommended` step (`GetRecommendedRewardStep`): embed the Recommended (`enhanced`)
      upload + submit flow (reuse `GetVerifiedModal` internals / `OnboardingProofUpload`); reward
      offer banner from `useHostRewardOffer`; on submit success invalidate `['entitlements', …]` + refetch the offer (R8); graceful non-reward fallback; owner-only, non-owner read-only.
      Optional — never blocks completion.
- [ ] Completion-step reward status line (must not imply the grant is instant for the `approved`
      trigger).
- [ ] Super-admin `HostVerificationRewardCard` (config + grants list + **Revoke**) on the chosen
      admin page; `org-subscriptions-admin` `revoke_reward` PATCH; `source` column + reward filter
      on `/admin/pricing/subscriptions`.
- [ ] Deno edge tests for `grantOrgSubscriptionReward`, `maybeGrantHostVerificationReward` (all
      eligibility branches), `expireHostVerificationRewards` (expire / skip-converted / skip-paid).
- [ ] Acceptance: with reward enabled + `trigger=approved`, a Free host submits Recommended in
      the guide (gate bypassed) → super-admin approves → trialing Pro sub created for
      `duration_days`, `['entitlements']` resolves to Pro after refetch, unlock email sent;
      billing cron at period end downgrades to Free (no `past_due`), existing paid→Free
      degradations fire; super-admin Revoke works; `max_per_org` + campaign window enforced;
      disabling the reward keeps the step working as plain optional verification.

### Phase 9 — polish

- [ ] Mobile pass at 375 / 768 / 1024 (`mobile-responsive` skill): sheet layout, sticky
      header/footer, no clipped upload fields, 44px targets.
- [ ] A11y: focus trap, `aria-current`, `<ol>` stepper, keyboard jump, screen-reader labels,
      `prefers-reduced-motion` for progress ring + completion animation.
- [ ] Copy pass with `human-copy` on every string (guide + reward banner + emails); trim to
      `minimal-ui-copy`.
- [ ] Optional: fire a lightweight analytics event per step start / complete / skip / dismiss +
      reward grant (if an analytics util exists; otherwise skip).

### Phase 10 — docs + QA

- [ ] Docs (see below).
- [ ] Manual QA checklist (see below) on local + hosted dev, property-only / parking-only /
      both, owner + team member, Free plan, reward on/off.
- [ ] Move to `for-testing` when the checklist passes.

## Docs to update (same change)

- **New:** `docs/guides/routes/org/setup-guide.md` — operator guide for the overlay (invoke
  `route-guides`): what each step covers, required vs recommended vs optional, resume/dismiss
  behavior, permission behavior, host-facing Q&A.
- `docs/guides/routes/onboarding.md` — add a "Post-registration Setup Guide" section linking to
  the new guide; clarify `/onboarding` ends at workspace creation and the guide takes over.
- `docs/PROJECT.md` — architecture: new `setup-guide` module + `settings.setupGuide` meta +
  `AdminLayoutShell` mount; `setup-guide-state` fn + `set_org_setup_guide_state` RPC; the
  `usePropertySettingsController` / parking / org extraction (Phase 2b).
- `.cursor/rules/admin-auth.mdc` + `docs/guides/routes/onboarding.md` — document the
  `submit-org-verification` `enhanced` gate **carve-out** when the reward is enabled (R3).
- `.cursor/rules/supabase-edge-functions.mdc` — new `setup-guide-state` + `get-host-reward-offer`
  functions and their JWT policy.
- `docs/guides/routes/org/settings.md`, `docs/guides/routes/org/property/settings.md`,
  `docs/guides/routes/org/parking/settings.md`, `docs/guides/routes/org/property/pricing.md`,
  `docs/guides/routes/org/property/notifications.md` — one line noting sections are also
  editable inside the Setup Guide (same storage, same validation).
- `.cursor/rules/plans-and-permissions.mdc` — no rule change; fill the checklist in the PR (the
  reward is a real paid-plan grant path — call it out).
- **Reward docs:** `docs/guides/routes/admin/settings.md` (or `.../platform-settings` guide) —
  new **Host verification reward** card; `docs/guides/routes/admin/org-subscriptions.md` —
  `source` column, reward filter, `revoke_reward`; `docs/architecture/plans-feature-matrix.md` —
  note the reward grants Pro via a trialing `source='reward'` subscription that auto-expires to
  Free; `docs/guides/routes/onboarding.md` — Recommended-verification reward offer + trigger.
- `docs/PROJECT.md` — also: `/onboarding` redirect now targets the listing dashboard; reward
  edge functions + `platform_settings` fields + `org_subscriptions.source`.
- `docs/workflow/planned/README.md` — index row (added with this plan).
- On ship: `docs/workflow/for-testing/` move + `docs/workflow/intake/_to-prompt.md` /
  `_to-plan.md` status via `workflow-sync-scratchpads`.

## Manual QA checklist

- **Phase 2b regression (before anything else ships):** every section on all three settings pages
  saves as before; OTP payment flow; dirty bar; red-dot sync; mobile shells; `type-check` /
  `lint` / `build` green. No visual or behavioral diff vs `main`.
- **Concurrent write (R6):** open the guide and the org settings page in two tabs; advance a step
  in one while saving tagline in the other → both persist, neither `settings` key is lost.
- Fresh Google sign-up → `/onboarding` (property + parking) → dashboard → guide auto-opens once.
- Dismiss → launcher card on org + property dashboard + sidebar dot; reload → launcher only,
  no auto-modal; `sessionStorage` snooze holds within the tab.
- Resume → opens at `lastStepId`; jump around the stepper; skip a required step → amber dot,
  launcher stays.
- Each step `Save & continue` writes the same DB rows as the home page; that page's red dot
  clears; guide status flips to complete.
- Payment step OTP flow completes inside the guide; closing OTP without verifying reverts.
- Verification step: proof upload submits `submit-listing-authorization`; step shows "pending
  review"; listing stays inactive until super-admin approves (`/admin/approvals`).
- Finish all Required → final recap step → `completedAt` set → launcher + dot gone → no
  auto-open after reload. Leaving step 12 (Get Recommended) undone does **not** keep the
  launcher alive.
- Onboarding finish lands on the **property dashboard** (property host), **parking dashboard**
  (parking-only), **org dashboard** (both / fallback); the guide auto-opens there.
- Team member (Operations role) → no auto-modal; opens launcher; brand/settings steps read-only
  with "ask your admin"; steps they can edit still save; step 12 read-only for non-owners.
- Free plan: no required step blocked by a plan gate; level-up cards show `TierBadge` and open
  the upgrade modal, never block completion.
- Property-only and parking-only runs show the correct trimmed step list.
- **Property + parking host:** the stepper shows the org group, a full **Property** block, and a
  full **Parking** block (grouped + labeled with each listing name). Completing every Required
  step in the property block alone does **not** hide the launcher — the parking block's Required
  steps (basics, location, cover photo, payments, email) and `org.verification` (a proof slot per
  listing) must also be done. Each block's completion is independent; saving a property field
  does not flip a parking step and vice versa.
- Two-property org (edge case): two Property blocks, each with its own id-scoped state.
- **Reward — enabled, trigger = approved:** submit Recommended in the `org.recommended` step →
  step shows "pending
  review"; super-admin approves on `/admin/approvals` → trialing Pro subscription created for
  `duration_days`, Pro entitlements resolve, host gets the unlock email, completion line shows
  "active until {date}".
- **Reward — expiry:** move `current_period_end` to the past → run billing cron → subscription
  goes to Free (not `past_due`), `reward_expired` event, entitlements drop to Free; T-7/T-3/T-1
  emails fired.
- **Reward — guards:** second Recommended approval for the same org does not grant again
  (`max_per_org`); outside the campaign window nothing is granted; org already on a paid plan →
  `skip` (or `extend` when configured); super-admin **Revoke** cancels a live reward to Free.
- **Reward — disabled:** step 12 renders as plain optional verification, no banner, no grant.
- **Reward — R3 bypass:** a Free host can submit Recommended in the guide when the reward is
  enabled; a Free host on the normal Get Verified modal (reward disabled) still hits the upgrade
  gate.
- **Reward → Free cascade (R10):** during the trial, add a 6th team member + connect Channel
  Sync + apply Smart Pricing; on expiry the newest team member auto-deactivates ("Plan limit"),
  smart rates stop applying, Channel Sync pauses — same as a paid→Free downgrade.
- 375 / 768 / 1024: sheet layout, no horizontal scroll, sticky footer, uploads reachable.
- `prefers-reduced-motion`: no confetti, static progress ring.
- `bun run type-check`, `bun run lint`, `bun run build`; edge tests for the reward grant/expiry
  helpers (Deno test runner).

## Open questions

1. ~~Persistence surface~~ — **resolved (R6):** dedicated `setup-guide-state` fn + atomic RPC.
2. **Launcher placement** — dashboard card + sidebar entry (proposed) vs a slimmer top strip on
   the dashboard only. Lean card + sidebar; confirm during Phase 2 visual review.
3. **Team step position** — Optional step 11 (proposed) vs a completion-step pointer only. Keep
   as a skippable step unless Phase 0 research says otherwise.
4. **R3 abuse surface** — with `trigger=submitted` + reward enabled, a Free host could submit
   Recommended, get Pro, then fail review (super-admin revokes). Acceptable, or force
   `trigger=approved` whenever the reward is on? Recommend forcing `approved` while the reward
   is enabled.
5. **Reward trigger** — grant on Recommended **submit** (generous, immediate, but can grant for
   submissions that fail review) vs on super-admin **approve** (proposed default, safer). Config
   supports both; which is the shipped default?
6. **Org already on a paid plan** — `skip` (proposed default) vs `extend` current period by the
   reward duration. Config supports both.
7. **Reward plan** — Pro (`growth`, proposed) vs Business (`pro`). Configurable; confirm the
   default with the business owner.
8. **Expiry behavior** — auto-downgrade to Free (proposed) vs one grace attempt to `past_due`
   with a renewal link before dropping to Free. Proposed keeps reward trials strictly non-billing.
9. **Admin surface location** — a card on `/admin/settings` (AI Management) vs
   `/admin/platform-settings`. Resolve in Phase 0.
10. **Redirect target for "both" hosts** — org dashboard (proposed) vs the property dashboard
    (property is the primary listing). Confirm in Phase 2.

## Known gaps after code review (2026-09-06)

**Fixed in follow-up:** parking Save & continue is section-scoped (`planParkingSettingsSave` + `scopeSectionIds`); parking basics step includes brand color + description; dead `allowRecommendedRewardBypass` prop removed (bypass keys off host reward offer); property Setup Guide steps pass `embedded` / `inline` so amenities, house rules, location, and payments edit without nested Manage modals; payment OTP defers the in-flight Save & continue promise and resolves it after verify (parking + property); `HostVerificationRewardCard` lists live `source=reward` grants with Revoke (`org-subscriptions-admin?rewards=true` + PATCH `revoke_reward`).

Deferred / incomplete vs Phase 8–9 acceptance — track before promoting to done:

1. **Reward reminder / unlock emails** (T-7/T-3/T-1 + grant unlocked) — not implemented; grant/expire still work.
2. **Deno tests** cover campaign-window helper only; expand grant/skip-path coverage.
3. Plan Phase 3–8 checkboxes in this doc are **stale** — step shells and reward APIs exist; re-tick after manual QA.
