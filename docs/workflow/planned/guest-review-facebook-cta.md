---
title: 'Guest review — optional Facebook review CTA'
status: planned
tags: [workflow, planned, guest-review, sd-form, vouchers]
updated: 2026-09-04
stage: planned
kind: plan
---

# Guest review — optional Facebook review CTA

Add an **optional, non-blocking** "leave a Facebook review" step after the guest submits
their in-app Kame review, shown only when the property (or its org) has a Facebook
reviews URL configured.

- Surfaces: `/sd-form` step 1 → step 2, and the standalone `/guest-review` (Airbnb zero-SD) flow.
- Never gates the voucher reveal or the SD refund. Completion is **honor-system** — there is no
  reliable Facebook signal to verify a guest actually posted (see Feasibility).

## Feasibility summary

| Question                                | Verdict                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Data available?                         | **Yes.** `org_settings.facebook_reviews_url` (org-wide) + `app_settings.facebook_reviews_url` (property, property→org fallback via `resolvePropertyFacebookUrl`). `resolveAppSettings()` already returns a resolved `facebookReviewsUrl` string. `main_social_platform` enum + `resolveMainSocialUrl()` also exist already but are currently **unused** (pre-staged infra).                                                                                                          |
| Deep-link to the host's FB review page? | **Yes.** Open the configured URL in a new tab (`window.open(url, '_blank', 'noopener,noreferrer')`). The Facebook reviews/recommendations tab is a normal URL. There is no official web "compose review" intent URL and mobile `fb://` deep links are unreliable — open exactly what the host configured.                                                                                                                                                                            |
| Verify completion?                      | **No.** Meta Graph API's Page `ratings` edge needs Page Public Content Access (heavy App Review), does not attribute recommendations to arbitrary users, and offers no per-booking / real-time signal. No webhook ties a new page recommendation to a specific guest. → honor system, non-blocking, exactly as the ticket anticipates. Weak _client_ signals only: "Open Facebook" click, tab blur/return, explicit "I posted my review" tap — usable for analytics, not for gating. |
| Endpoints expose it?                    | **Not yet.** `get-sd-form` and `get-guest-review` both call `resolveAppSettings` but don't return `facebookReviewsUrl` — one field to add to each payload.                                                                                                                                                                                                                                                                                                                           |

**Verdict: implement.** Scope is a small CTA + deep link + two flow-wiring points. No schema
change required for the core feature (Phase 5 soft signal is optional).

## Current state (references)

- `/sd-form` flow — `ui/src/features/guest/sd-form/pages/SdFormPage.tsx`
  - `step` 1 → `SdFormReviewSection` → `onReviewSubmitted` branches to step 2 (`step2Phase`
    `'wait_balance' | 'voucher'`) or step 3.
- `/guest-review` flow — `ui/src/features/guest/sd-form/pages/GuestReviewPage.tsx`
  - `Phase = 'review' | 'voucher' | 'done'`; `onReviewSubmitted` → `voucher` (or `done` when
    `vouchers_enabled === false`).
- Shared review UI — `ui/src/features/guest/sd-form/components/SdFormReviewSection.tsx`
  (posts to `submit-guest-review`; fires `posthog.capture('guest_review_submitted', …)`).
- Bootstrap types — `ui/src/features/guest/sd-form/lib/api.ts`
  (`GuestReviewBootstrap`, `SdFormBootstrap`).
- Bootstrap endpoints — `supabase/functions/get-sd-form/index.ts`,
  `supabase/functions/get-guest-review/index.ts`.
- Resolved settings — `supabase/functions/_shared/appSettings.ts`
  (`resolveAppSettings().facebookReviewsUrl`).
- Pre-staged (unused) generic helper — `supabase/functions/_shared/socialPlatform.ts`
  (`resolveMainSocialUrl`).
- Host config UI — `ui/src/features/dashboard/org/components/settings/MainSocialPlatformPicker.tsx`,
  `.../property-settings/PropertySocialsBrandingSection.tsx` (Facebook page URL fields already exist).
- Route guide — `docs/guides/routes/sd-form.md` (covers both `/sd-form` and the Airbnb `/guest-review` variant).

## Design decisions

- **Facebook-only for now**, per the ticket ("when the property has a Facebook reviews URL
  configured"). Note the generic `main_social_platform` / `resolveMainSocialUrl` path as a
  later generalization — do not build it here.
- **Show once, right after submit.** Returning guests (`guest_review_submitted` already true
  on load, or an existing voucher) skip the CTA entirely — no nagging.
- **Never blocks.** Every CTA button (Open, Skip, "I posted it") leads to the same next
  phase. No server round-trip required for the core feature.
- **No CTA when unconfigured.** If neither property nor org has a Facebook URL, the flow is
  byte-for-byte identical to today.

## Phase 1 — Expose the Facebook URL to guest bootstrap

1. `supabase/functions/get-guest-review/index.ts` — add to the `jsonSuccess` payload:
   `facebook_reviews_url: settings.facebookReviewsUrl || null`.
2. `supabase/functions/get-sd-form/index.ts` — same addition (both already have `settings`
   from `resolveAppSettings`).
3. `ui/src/features/guest/sd-form/lib/api.ts` — add
   `facebook_reviews_url?: string | null` to both `GuestReviewBootstrap` and `SdFormBootstrap`.
4. No new Deno test needed (pass-through field); optionally extend an existing
   `get-sd-form` / `get-guest-review` fixture if one asserts the payload shape.

Two-way reviews (2026-10-19): the guest write UI remains `SdFormReviewSection` (shared by SD stepper and `/guest-review`). Wire this CTA after that review step is submitted or skipped (`GuestReviewPage` / `SdFormPage` "Done" / next-phase), not a separate `GuestReviewFlow` module.

## Phase 2 — Shared `GuestReviewFacebookCta` component

New file: `ui/src/features/guest/sd-form/components/GuestReviewFacebookCta.tsx`

- Props: `{ facebookUrl: string; context: 'sd_form' | 'guest_review'; onContinue: () => void }`.
- Layout: `<section aria-labelledby>` + heading + one line of copy + two full-width buttons
  (`min-h-[48px]`, match `SdFormReviewSection` button styling); mobile-first, 44px targets.
- Behaviour:
  - Primary "Open Facebook review" → `window.open(facebookUrl, '_blank', 'noopener,noreferrer')`,
    set local `opened = true`.
  - After `opened`, primary swaps to "I've posted my review" → `onContinue()`.
  - Secondary is always "Skip" → `onContinue()` (same target; label differs only for intent).
- Guard: caller only renders when `facebookUrl` passes a simple `^https?://` check; component
  also no-ops the open if the URL is falsy.
- Analytics (guarded by `isPostHogEnabled`):
  `posthog.capture('guest_review_facebook_cta_opened' | '…_skipped' | '…_confirmed', { context })`.
- Copy: keep to one heading + one sentence (`minimal-ui-copy`). No helper paragraph.

## Phase 3 — Wire into `/guest-review` (standalone Airbnb flow)

`ui/src/features/guest/sd-form/pages/GuestReviewPage.tsx`

- Extend `type Phase = 'review' | 'facebook' | 'voucher' | 'done'`.
- Add a helper `nextAfterReview(data)` → `'facebook'` when
  `isHttpUrl(data.facebook_reviews_url)`, else `data.vouchers_enabled === false ? 'done' : 'voucher'`.
- `onReviewSubmitted` uses `nextAfterReview`.
- The returning-guest `useEffect` (existing voucher / `guest_review_submitted`) stays as-is —
  it jumps straight to `voucher`/`done`, so the CTA never shows for returning guests.
- Render `<GuestReviewFacebookCta context="guest_review" facebookUrl={data.facebook_reviews_url!}
onContinue={() => setPhase(data.vouchers_enabled === false ? 'done' : 'voucher')} />`
  when `phase === 'facebook'`.

## Phase 4 — Wire into `/sd-form` step flow

`ui/src/features/guest/sd-form/pages/SdFormPage.tsx`

- Add `'facebook'` to the `step2Phase` union (`'wait_balance' | 'voucher' | 'facebook'`).
- Extract `nextAfterReview(data)` returning `'facebook' | 'voucher' | 'step3'` (shared shape
  with Phase 3; can live in `sd-form/lib`).
- Step 1 `onReviewSubmitted`:
  - `awaiting_balance_settlement` → step 2 `wait_balance` (unchanged).
  - else `facebook_reviews_url` present → step 2 `facebook`.
  - else existing `voucher` / step 3 branch.
- New `step === 2 && step2Phase === 'facebook'` block renders
  `<GuestReviewFacebookCta context="sd_form" … onContinue={goToVoucherOrStep3} />` where
  `goToVoucherOrStep3` = `data.vouchers_enabled !== false ? setStep2Phase('voucher') : setStep(3)`.
- Balance-wait path: after `wait_balance` resolves, run the same `facebook` check before
  `voucher` so those guests also see it once.
- Returning guests (`guest_review_submitted`, or `existingVoucher`) already skip to voucher —
  no CTA.

## Phase 5 — (Optional, deferred) soft host-visible signal

Only if the team later wants a "guest opened the FB review" breadcrumb. Honor-system is
acceptable per the ticket, so this is not required to ship.

- Migration: `ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS facebook_review_opened_at timestamptz;`
- New public edge fn `mark-facebook-review-opened` (`servePublic`, anti-spam gated, reuses
  `canAccessGuestReview` eligibility), called on the "I've posted my review" tap.
- Surface as an info chip on the booking detail page. Never used for gating.

## Phase 6 — Docs (same change)

- `docs/guides/routes/sd-form.md`:
  - Progress-overview table: note the Facebook CTA on Step 1 / Step 2 rows.
  - Add a "Facebook review CTA" subsection under Step 1 / Step 2 and to the Airbnb-variant
    notes: optional, only when a Facebook URL is configured, never blocks, cannot be verified.
  - Host-facing knowledge: add a Q&A — "Guests are invited to also post on Facebook; it's
    optional, we can't confirm they did, and it never holds up the refund or voucher."
- `docs/PROJECT.md`: record the new `facebook_reviews_url` field on the `get-sd-form` /
  `get-guest-review` responses (and the Phase 5 column/endpoint if built).
- `docs/workflow/intake/_to-prompt.md` line ~305: flip the status emoji when shipped
  (`workflow-sync-scratchpads`).
- Run the `route-guides` and `documentation-maintenance` skills before marking done.
- `plans-and-permissions`: **N/A** — guest-facing, no gated capability, no plan entitlement,
  no team permission. State this explicitly in the PR.

## Testing

No Vitest/Deno suite for this path yet. Use the `verify` skill:

- `bun run type-check && bun run lint && bun run build`.
- Playwright MCP walk-throughs on local Supabase:
  - Property **with** `facebook_reviews_url` → `/sd-form` and `/guest-review` both show the
    CTA once, both buttons advance to the voucher reveal, refund still completes.
  - Property **without** any Facebook URL → neither flow shows the CTA (regression check).
  - Returning guest (review already submitted) → no CTA.
- Extend `ui/e2e/features/vouchers/shared/voucherRevealHarness.ts` /
  `voucherRevealClaim.spec.ts` to cover the new phase.

## Estimate

Phases 1–4 + docs: ~0.5–1 day. Phase 5 (optional): +~0.5 day.
