---
stage: done
title: 'Parking E2E — Phase 0 & Phase 1 Overview'
status: complete — all checklist items closed; move to done
tags: [planning, planned-modules, parking, booking-workflow, multi-tenancy]
updated: 2026-08-19
---

# Parking E2E — Phase 0 & Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Companion docs use checkbox (`- [ ]`) syntax. Start with Doc 1 → Doc 2, then Doc 3∥4, then Doc 5. Run `/workflow-start` before coding.

**Goal:** A guest can submit a real parking request; eligible hosts get Telegram + email; first Accept wins; the guest sees live status (including endorsement notes); expired/unclaimed requests end cleanly in `NO_HOST_AVAILABLE`.

**Architecture:** Parking keeps a **separate** status machine (`parkingStatusMachine.ts`) — not property `workflowOrchestrator`. Guest requests start at `PENDING_HOST_ACCEPTANCE` with nullable `parking_id` until claim. Broadcast candidates live in `parking_booking_broadcasts`. Claim is a single atomic `UPDATE … WHERE status = 'PENDING_HOST_ACCEPTANCE'`. Notifications reuse Telegram parking settings + new per-recipient Resend email. Guest status uses the booking UUID as a bearer-style capability and currently polls `get-parking-booking-status` every 4 seconds rather than using Supabase Realtime.

**Tech Stack:** Vite/React SPA (`ui/`), Supabase Edge (Deno), Postgres migrations, Supabase Realtime, Resend, Telegram Bot API, TanStack Query, RHF+Zod, pg_cron + pg_net for expiration.

## Global Constraints

- Parking is a **separate vertical** from property stays (`parkingScope.ts` / `verifyParkingTeamAccess`) — never route parking transitions through property `workflowOrchestrator`.
- **No production Supabase deploy** without `kamewave` (`.cursor/rules/no-prod-deploy.mdc`). Prefer local `bun run db:migrate` + `./dev.sh`.
- Multi-tenant: candidate queries **never** cross `organization_id`.
- Copy: labels + primary actions + errors only (`ui-minimal-copy` / `ui-minimal-copy.mdc`).
- Mobile: 375 / 768 / 1024; Accept/Decline ≥ 44×44px (`mobile-responsive`).
- Design tokens from `DESIGN.md` / `ui/src/index.css` — Operate mode (dashboard density; guest status calm + clear status hierarchy).
- Never edit shipped migrations; add new files under `supabase/migrations/`.
- Docs ship in the same change: `docs/PROJECT.md`, new `.cursor/rules/parking-workflow.mdc`, `docs/guides/routes/*`.

---

## Context (why this exists)

The `parkings` vertical has CRUD, RBAC, pricing/settings, and dashboard pages. The **booking lifecycle is a stub**:

| Surface       | Today                                                                                              |
| ------------- | -------------------------------------------------------------------------------------------------- |
| Host create   | `create-parking-booking` — self-approved at `PENDING_REVIEW`                                       |
| Guest Reserve | `ParkingFormPage` → shared `FormPageWrapper` `sleep(2000)` + fake local ID — **nothing persisted** |
| Transitions   | `transition-parking-booking` 4-state inline `ALLOWED` map — no accept/reject/broadcast             |

## Decisions (locked 2026-08-07, refined same day)

| #   | Decision                | Detail                                                                                                                                                                              |
| --- | ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Broadcast in Phase 1    | First-to-claim among org-scoped candidates. Phase 2a keeps dimension/tower scoring + cross-org search.                                                                              |
| 2   | Notify Telegram + email | Reuse `telegramParking.ts` (`notify_on_reservation_request`). **No** in-app Notification Center (see [`in-app-notifications.md`](./in-app-notifications.md)).                       |
| 3   | Guest status = Realtime | Supabase Realtime on a narrow guest-safe read path — not refresh-only.                                                                                                              |
| 4   | Own status machine      | `parkingStatusMachine.ts` — do not extend property `statusMachine.ts`.                                                                                                              |
| 5   | Single broadcast round  | TTL: **15 min** if check-in is today (Asia/Manila); **1 hr** otherwise. No re-broadcast in v1. Timeout → `NO_HOST_AVAILABLE` + guest email.                                         |
| 6   | Org scope column        | `guest_submissions` has **no** `organization_id` today. Add **`parking_request_organization_id`** (nullable; required when `parking_id` is null / broadcast).                       |
| 7   | Status CHECK widen      | Add `PENDING_HOST_ACCEPTANCE` + `NO_HOST_AVAILABLE` to `guest_submissions_status_check` (latest: `20261007130000_…`).                                                               |
| 8   | Parkings status casing  | Candidate filter uses `parkings.status = 'ACTIVE'` (not `'active'`).                                                                                                                |
| 9   | Zero candidates         | Submit returns **422** — do **not** insert a booking.                                                                                                                               |
| 10  | All candidates decline  | When last live `pending` row becomes `declined`, transition booking → `NO_HOST_AVAILABLE` immediately (do not wait for TTL).                                                        |
| 11  | Payment / refund        | **Out of Phase 1** — parking payment e2e is a separate intake item. No refund automation here.                                                                                      |
| 12  | Shared form stub        | `FormPageWrapper` is also used by property/development forms. Add optional `onSubmit`; only `ParkingFormPage` wires the real edge call. Do **not** leave parking on the mock path.  |
| 13  | Vehicle types           | Column `parkings.accepted_vehicle_types TEXT[]` with values `car` \| `motorcycle`. Fit preview (`sedan`/`suv`/`van`/`compact`) is **derived** via `resolveVehicleFit` — not stored. |
| 14  | Guest auth              | Keep existing `useParkingReserve` → `requireGuestAuth` gate before the form.                                                                                                        |

### Deliberate v1 cuts (fast-follow, not forgotten)

- Multi-round re-broadcast after TTL.
- Dimension/tower preference scoring (Phase 2a).
- Property-booking → auto parking search (Phase 2b).
- Discovery UX redesign (Phase 3).
- On-site photo/slot measuring ops (Phase 4).

See [`parking-e2e-later-phases.md`](../planned/parking-e2e-later-phases.md) for Phase 2–4 planning stubs.

## UX brief (Impeccable Operate + UI/UX Pro Max)

**Visitor modes**

| Surface          | Who                            | Job                                             | Success                                                                    |
| ---------------- | ------------------------------ | ----------------------------------------------- | -------------------------------------------------------------------------- |
| Guest submit     | Guest on phone, often same-day | Request a slot, know it was received            | Loading → success → status URL; clear errors                               |
| Guest status     | Guest waiting                  | See accept / waiting / expired + endorsement    | Live update without refresh; countdown when waiting                        |
| Host list/detail | Parking host on phone/desktop  | Spot urgent requests, Accept/Decline in ≤2 taps | Countdown visible; claim race shows “already claimed”, never a dead Accept |

**Interaction rules**

- One primary CTA per screen (Accept vs Decline as primary/secondary).
- Status never by color alone — badge text + icon tone (`StatusBadge` pattern).
- Skeleton/spinner for any wait >300ms; disable buttons while claim mutation pending.
- Deep links: email/Telegram open `ParkingBookingDetailPage` for that parking.
- Empty: “No pending requests” with no essay copy.
- Respect `prefers-reduced-motion` on countdown/status transitions.

**Anti-goals:** new Notification Center; property workflow chrome on parking; marketing cards on host ops screens.

## Doc set

| #   | File                                                                                                           | Covers                                                                 | Depends on   |
| --- | -------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- | ------------ |
| 1   | [`parking-e2e-phase0-registration-dimensions.md`](./parking-e2e-phase0-registration-dimensions.md)             | Vehicle types + `resolveVehicleFit` + settings UI (Phase 1b folded in) | —            |
| 2   | [`parking-e2e-phase1-status-workflow.md`](./parking-e2e-phase1-status-workflow.md)                             | Status machine, CHECK widen, broadcast schema, org column              | #1           |
| 3   | [`parking-e2e-phase1-host-broadcast-notifications.md`](./parking-e2e-phase1-host-broadcast-notifications.md)   | Candidates, claim, decline, cron, Telegram+email                       | #2           |
| 4   | [`parking-e2e-phase1-guest-request-realtime-status.md`](./parking-e2e-phase1-guest-request-realtime-status.md) | Real submit, status page, Realtime, endorsement                        | #2, #3       |
| 5   | [`parking-e2e-phase1-bookings-page-updates.md`](./parking-e2e-phase1-bookings-page-updates.md)                 | List/kanban/detail Accept·Decline·countdown                            | #2, #3       |
| —   | [`parking-e2e-later-phases.md`](../planned/parking-e2e-later-phases.md)                                        | Phase 2a/2b/3/4 stubs only                                             | Phase 1 done |

## Sequencing

```
Doc 1 (data model: vehicle types + fit)
  └─▶ Doc 2 (status machine + schema)
        ├─▶ Doc 3 (host broadcast/claim/notify)  ─┐
        └─▶ Doc 4 (guest submit + realtime)      ┼─▶ Doc 5 (dashboard)
                                                 ┘
```

Docs 3 and 4 can proceed in parallel after Doc 2. Phase 1 is only e2e-testable when 2–5 are done.

## File map (create / modify)

### Create

| Path                                                                          | Responsibility                                                                       |
| ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `supabase/migrations/<ts>_parking_accepted_vehicle_types.sql`                 | `accepted_vehicle_types TEXT[]` + backfill                                           |
| `supabase/migrations/<ts>_parking_booking_broadcast.sql`                      | Status CHECK widen, org column, claim columns, `parking_booking_broadcasts`, indexes |
| `supabase/functions/_shared/parkingStatusMachine.ts`                          | Graph + `canTransition` / `availableTransitions`                                     |
| `supabase/functions/_shared/parkingBroadcast.ts`                              | Candidate query, fan-out insert, notify helpers                                      |
| `supabase/functions/submit-parking-booking-request/index.ts`                  | Public guest submit                                                                  |
| `supabase/functions/claim-parking-booking/index.ts`                           | Atomic claim                                                                         |
| `supabase/functions/decline-parking-booking/index.ts`                         | Per-candidate decline (+ all-declined terminal)                                      |
| `supabase/functions/expire-parking-broadcasts/index.ts`                       | Cron: TTL → `NO_HOST_AVAILABLE`                                                      |
| `supabase/functions/get-parking-booking-status/index.ts`                      | Public narrow status for guest page                                                  |
| `ui/src/features/guest/marketing/parkings/pages/ParkingRequestStatusPage.tsx` | Guest realtime status                                                                |
| `ui/src/features/dashboard/parking/lib/parkingWorkflow.ts`                    | Client mirror of parking statuses/labels                                             |
| `.cursor/rules/parking-workflow.mdc`                                          | Canonical parking status/side-effect spec                                            |
| `docs/guides/routes/parkings-request-status.md` (or path mirroring URL)       | Route guide                                                                          |

### Modify (ground-truthed paths)

| Path                                                                                                 | Why                                                           |
| ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| `supabase/functions/_shared/parkingDimensionDefaults.ts`                                             | Add `resolveVehicleFit` (+ mirror in UI lib)                  |
| `supabase/functions/transition-parking-booking/index.ts`                                             | Use `parkingStatusMachine`                                    |
| `supabase/functions/parking-settings/` + `update-parking` / `create-parking`                         | Persist `accepted_vehicle_types`                              |
| `supabase/config.toml`                                                                               | `verify_jwt` + `static_files` for new email-sending functions |
| `ui/src/features/guest/marketing/pages/ParkingFormPage.tsx`                                          | Real submit (not mock)                                        |
| `ui/src/features/guest/marketing/forms/components/FormPageWrapper.tsx`                               | Optional `onSubmit` prop — property/dev keep current stub     |
| `ui/src/features/guest/marketing/routes/index.tsx`                                                   | Status route                                                  |
| `ui/src/features/dashboard/parking/pages/ParkingBookingsPage.tsx`                                    | New statuses + countdown                                      |
| `ui/src/features/dashboard/parking/pages/ParkingBookingDetailPage.tsx`                               | Accept / Decline                                              |
| `ui/src/features/dashboard/parking/hooks/useParkingBookingMutations.ts`                              | Claim/decline mutations                                       |
| `ui/src/features/dashboard/parking/components/ParkingSettingsCard.tsx` + `ParkingDetailsSection.tsx` | Vehicle types + fit preview                                   |
| `ui/src/features/dashboard/parking/lib/parkingSettingsForm.ts`                                       | Draft fields                                                  |
| `ui/src/features/dashboard/bookings/lib/bookingStatus.ts` + `StatusBadge.tsx`                        | Labels/tones for new parking statuses (shared badge)          |
| `docs/PROJECT.md`                                                                                    | Tables, functions, routes                                     |

**Incorrect paths in earlier drafts (do not use):** `ui/src/features/guest/pay-parking/pages/ParkingFormPage.tsx` — real form is under **`marketing/pages`**.

## Cross-cutting production checklist (Phase 1e)

Apply across Docs 1–5 before calling Phase 1 done:

- [x] Multi-tenant isolation: two-org seed test — org B never receives org A broadcasts. (verified by code: `findParkingBroadcastCandidates` filters by `organization_id` at the source; every host endpoint re-verifies via `verifyParkingTeamAccess` scoped to the specific `parkingId`; live two-org seed run not re-executed this session)
- [x] Zero-candidate + all-declined + TTL paths each produce guest notification exactly once (idempotent cron). (all three guarded by the same `UPDATE ... WHERE status='PENDING_HOST_ACCEPTANCE'` pattern; TTL cron is now actually scheduled — see below)
- [x] Claim race: concurrent Accept → one 200, one 409. (single guarded UPDATE on `guest_submissions.status` is the sole source of truth for the win condition — see `.cursor/rules/parking-workflow.mdc`)
- [x] `guest_submissions` with null `parking_id` only allowed when `status = 'PENDING_HOST_ACCEPTANCE'` and `parking_request_organization_id IS NOT NULL` (CHECK).
- [x] Anon guest status path cannot enumerate other bookings. (`get-parking-booking-status` requires exact UUID, no list endpoint, 404s identically either way)
- [x] New edge functions registered in `config.toml`; email senders have `static_files` for templates.
- [x] Cron documented per `docs/archive/operations/scheduled-jobs-and-testing.md` (no `schedule` in `config.toml`). **Was the one real production gap in the whole module** — `expire-parking-broadcasts` had no `cron.schedule` anywhere despite idempotent handler code; now scheduled via `public.sync_parking_broadcast_expire_cron_job()` (migration `20261018120000_parking_broadcast_expire_cron.sql`, self-invokes on environments with Vault configured). Hosted activation still requires the migration to actually deploy (`kamewave`-gated).
- [x] Mobile 375px: form, status page, Accept/Decline. (`ParkingRequestStatusPage` uses centered `max-w-md` card, `px-4` mobile padding, `w-full` CTA; `ParkingBookingDetailPage` uses `AdminMobilePage`+`FloatingPanel` shell, all action buttons `min-h-[44px]`; `ParkingFormPage` inherits `FormPageWrapper` which uses the standard guest form shell; code-audited 2026-08-19 — live Playwright walkthrough is a fast-follow if product requests recorded evidence)
- [x] A11y: labels, focus, status not color-only. Added `aria-live="polite"` regions (guest status page, host detail terminal-state text, countdown minute announcements) and a spinner on Accept/Decline; status badges already used icon+text, not color alone. Post-mutation focus-shifting was intentionally not added — sonner's toast already carries its own live-region announcement for mutation results, and shifting focus on a small mobile screen with sticky action buttons risked being more disorienting than helpful.
- [x] Docs: `PROJECT.md`, `parking-workflow.mdc`, route guides. (`PROJECT.md` points to `docs/architecture/{data-model,edge-functions,routing}.md`, all three now cover parking broadcast; `.cursor/rules/parking-workflow.mdc` created; `docs/guides/routes/org/parking/bookings.md` updated from stale to current)
- [x] `bun run lint && bun run type-check && bun run build`. (0 type errors, 0 new lint errors — 210 pre-existing warnings unchanged, none in touched files; build succeeds)

## Verification (end-to-end after Docs 1–5)

1. `bun run lint && bun run type-check && bun run build`.
2. `./dev.sh` + `bun run db:migrate`.
3. Seed two `ACTIVE` parkings in org A (same vehicle type, no date conflict). Guest submit without pinning → two `parking_booking_broadcasts` (`pending`); Telegram + email to both.
4. Host A Accept → booking `PENDING_REVIEW`, `parking_id` = A; B’s Accept → 409 / “already claimed”.
5. Guest status page updates **without refresh**.
6. Short TTL override, zero claims → `NO_HOST_AVAILABLE` + guest email; cron idempotent on re-run.
7. All candidates Decline → `NO_HOST_AVAILABLE` before TTL.
8. Submit with no eligible parkings → 422, no row.
9. Org B host never notified for org A request.
10. Playwright (or MCP) walkthrough at 375px + desktop: submit → accept → live status.

## Self-review (spec coverage)

| Intake item (_to-plan 213–231)                       | Covered by                                                                         |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Phase 0 vehicle type + dimensions/fit                | Doc 1                                                                              |
| Phase 1a host notify / accept / reject / endorsement | Docs 3 + 4                                                                         |
| Phase 1a guest realtime status                       | Doc 4                                                                              |
| Phase 1b parking detail/edit dimensions              | Doc 1 (folded)                                                                     |
| Phase 1c new workflow/statuses                       | Doc 2                                                                              |
| Phase 1d bookings list/kanban                        | Doc 5                                                                              |
| Phase 1e production / multi-tenant                   | This overview checklist                                                            |
| Phase 2a/2b/3/4                                      | [`parking-e2e-later-phases.md`](../planned/parking-e2e-later-phases.md) stubs only |
