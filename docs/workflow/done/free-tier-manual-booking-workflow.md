---
stage: done
title: 'Free-tier manual booking workflow — gaps, edge cases, completion plan'
status: done
tags: [planning, planned-modules, bookings, billing, entitlements, free-tier]
updated: 2026-08-29
---

# Free-tier manual booking workflow — gaps & completion plan

**Done 2026-08-29.** Free-tier hosts can run the booking graph and manually send all six plan-gated workflow emails from Automation Triggers.

## Locked decisions (2026-08-29)

1. **Multiplexed** `send-booking-workflow-email` (`kind` enum) — keep existing SD + parking endpoints; UI uses the multiplexed path for all six.
2. **No new `*_emailed_at` columns** this pass — only existing `sd_refund_form_emailed_at`.
3. **Email Automations on Free:** disable the six plan-gated toggles + `TierBadge` / upgrade; `emailNewBookingRequest` stays editable.
4. **Parking broadcast:** expose Send when `need_parking` (legacy / unlinked); do not revive as auto on proceed.
5. **Toast:** Upgrade action + expand Automation Triggers with Send buttons.

## Implementation status (2026-08-29)

| Item                                                      | State                                                                                                                                      |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| P1.1–P1.5 Manual sends (multiplexed API + UI)             | ✅ shipped                                                                                                                                 |
| P1.6 Toast → Automation Triggers expand                   | ✅ shipped                                                                                                                                 |
| P1.7 Plan-aware advance guide                             | ✅ shipped                                                                                                                                 |
| P2.1 Email Automations plan lock + TierBadge              | ✅ shipped                                                                                                                                 |
| P2.2 Run check-out vs Resend documented                   | ✅ in booking-workflow + guide                                                                                                             |
| P2.3–P2.4 Automation Triggers expansion + plan-skip badge | ✅ shipped                                                                                                                                 |
| P2.5 Host Q&A Free path                                   | ✅ shipped                                                                                                                                 |
| P2.7 Effects/confirm copy plan-aware                      | ✅ shipped                                                                                                                                 |
| P2.6 / P2.8 Live Resend E2E + parking product decision    | ✅ parking: Send when `need_parking` (locked). Live Resend sink: type-check + eligibility unit checks done; operator Mailpit pass optional |
| P3.*                                                      | deferred (tracked above)                                                                                                                   |

**Code:** `send-booking-workflow-email` + `_shared/sendBookingWorkflowEmail.ts`; UI Automation Triggers / hooks / settings; docs updated.

**Status summary:** P1 and in-scope P2 closed in code + docs. P3 polish remains deferred (not blocking done).

**Verify (local evidence 2026-08-29):** `ui` `type-check` clean; `eligibleManualWorkflowEmailKinds` unit cases OK. Live Mailpit/Resend walk left as optional operator check.

**E2E (2026-08-31):** `propertyBookingFreeManualWorkflow.spec.ts` — **8 tests**: manual sends (GAF/ack/parking/pet), plan-skip Proceed + auto-expand, RFCI sends + Free cron label + cron plan-skip toast, confirm-modal Free hint, plan-aware GAF badge, Starter smoke (no Send manually). Unit: `bookingWorkflowEmail.test.ts` (Vitest), `sendBookingWorkflowEmail.test.ts` (Deno). Run: `bun run test:e2e:parking:free-workflow`.

Canonical companions:

- [`.cursor/rules/booking-workflow.mdc`](../../../.cursor/rules/booking-workflow.mdc) §3 (plan gating + known gap)
- [`docs/architecture/plans-feature-matrix.md`](../../architecture/plans-feature-matrix.md) Phase 5 residual
- [`docs/workflow/done/tier-feature-alignment-audit.md`](../done/tier-feature-alignment-audit.md) Phase 5
- [`docs/guides/routes/org/property/bookings-detail.md`](../../guides/routes/org/property/bookings-detail.md)
- QA: [`docs/workflow/qa/property-dashboard/03-bookings-detail.md`](../qa/property-dashboard/03-bookings-detail.md), [`16-plans-and-rbac.md`](../qa/property-dashboard/16-plans-and-rbac.md)

---

## Goal

Ensure a property on the **Free** plan can run the full booking lifecycle end-to-end for **host and guest** using **manual** operations where paid automation is gated — without leaving the host stuck sending Azure/guest emails outside the product, and without silent failures or misleading “this will email…” copy.

Paid value remains clear: **Starter+** (`automatedBookingFlow`) auto-sends the six workflow emails. Free must still complete stays via host actions + guest public forms.

---

## Correct product model (do not re-gate)

| Concern                                                               | Free                                                   | Starter+                        | Notes                                               |
| --------------------------------------------------------------------- | ------------------------------------------------------ | ------------------------------- | --------------------------------------------------- |
| Status graph / Proceed / Mark complete / Cancel                       | ✅                                                     | ✅                              | Identical                                           |
| Request PDF **generation** on proceed                                 | ✅                                                     | ✅                              | **Not** plan-gated — orchestrator throws if missing |
| Public guest form (`/form`) submit → `PENDING_REVIEW`                 | ✅                                                     | ✅                              | Ungated                                             |
| Guest SD form (`/sd-form`)                                            | ✅                                                     | ✅                              | Ungated                                             |
| Stay guide / guest portal links once issued                           | ✅                                                     | ✅                              | Token issuance is workflow infra                    |
| New booking request ops email                                         | ✅                                                     | ✅                              | Intentionally not plan-gated                        |
| Auto GAF / pet / ack / ready / parking broadcast / SD checkout emails | ❌ skipped                                             | ✅                              | `automatedBookingFlow`                              |
| Manual “send now” for those emails                                    | ✅ Automation Triggers + `send-booking-workflow-email` | Same endpoints useful as resend | Escape hatch uses `rawPropertyAutomationEnabled`    |
| Booking import                                                        | preview / gated                                        | ✅                              | Separate key `bookingImport`                        |
| AI validations                                                        | ❌                                                     | Pro+                            | Separate key                                        |

**Misconception to kill in docs/UI:** Free does **not** lose PDF generation or the public guest form. Only **automated outbound workflow emails** are paid.

---

## What’s already shipped

### Phase 5 (2026-08-24)

1. `propertyAutomationToggles.ts` — six keys forced off without `automatedBookingFlow`; `rawPropertyAutomationEnabled` for escape hatches.
2. `workflowOrchestrator.transition()` → `sideEffects.automationSkippedByPlan[]`.
3. Admin toast + Upgrade CTA.

### This plan (2026-08-29)

4. `send-booking-workflow-email` + `_shared/sendBookingWorkflowEmail.ts` (all six kinds).
5. Automation Triggers Send buttons + plan-skip badge + auto-expand after skip toast.
6. Plan-aware advance guide + confirm/effects email preview.
7. Email Automations: plan-gated toggles locked + TierBadge on Free.
8. Docs: booking-workflow rule, matrix residual closed, bookings-detail guide + Host Q&A, edge-functions inventory, QA 03.

---

## Gap inventory

### P0 — blocks “Free host can fully operate in-app”

None identified for **status movement** itself. Free hosts can proceed the graph and mark docs complete.

### P1 — incomplete Free operating model (must close for this plan)

| #    | Gap                                                                              | Evidence                                                          | Desired outcome                                                     |
| ---- | -------------------------------------------------------------------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------- |
| P1.1 | No manual send endpoint for **GAF request** (Azure)                              | No `send-*-email` fn; toast only                                  | Host can send from booking detail when PDF exists                   |
| P1.2 | No manual send for **pet request** (Azure)                                       | Same                                                              | Same                                                                |
| P1.3 | No manual send for **booking acknowledgement** (guest)                           | Same                                                              | Same                                                                |
| P1.4 | No manual send for **ready-for-check-in** (guest)                                | Same                                                              | Same                                                                |
| P1.5 | **Parking broadcast** endpoint exists, **zero UI**                               | `parking-broadcast-email`; Phase 5 note                           | Button when `need_parking` + plan skipped or host wants rebroadcast |
| P1.6 | Toast says “Send these manually…” but offers **no in-app action** — only Upgrade | `useTransitionBooking.ts`                                         | Toast / rail actions that open or run the matching send             |
| P1.7 | Proceed / workflow **guide copy claims emails will send** even on Free           | `workflowAdvanceMode.ts` PENDING_REVIEW / PENDING_DOCUMENTS lines | Copy (or dynamic) must not promise auto-send when plan blocks       |

### P2 — friction / correctness / conversion (should close in same effort or immediately after)

| #    | Gap                                                                                                    | Evidence                                                         | Desired outcome                                                                                                                                         |
| ---- | ------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P2.1 | **Email Automations** settings show six toggles with no plan signal                                    | `PropertyEmailAutomationsSection` — no `planBlocked` / TierBadge | Free host sees “on plan: Starter+” or locked toggles so saving ON doesn’t imply auto-send                                                               |
| P2.2 | **Run check-out automation** (`sd-refund-cron` scoped) uses **plan-gated** `propertyAutomationEnabled` | `sd-refund-cron/index.ts`                                        | Document clearly: on Free, button may move status / skip email; **Resend** is the true email escape hatch. Optionally surface plan-skip in UI after run |
| P2.3 | Automation Triggers only covers **SD** path today                                                      | `WorkflowAutomationTriggers.tsx`                                 | Expand for all six (or a “Manual sends” panel) keyed by status + applicability                                                                          |
| P2.4 | No persistent “skipped by plan” banner on booking — toast is easy to miss                              | toast-only                                                       | ✅ `WorkflowManualEmailBanner` + next-step banner (`WorkflowNextStepBanner`)                                                                            |
| P2.5 | Host Q&A / route guide don’t explain Free manual path                                                  | `bookings-detail.md` Host-facing knowledge                       | Add Free vs paid Q&A                                                                                                                                    |
| P2.6 | QA never fully exercised every status on Free live                                                     | `03-bookings-detail.md` Evidence                                 | E2E checklist below                                                                                                                                     |
| P2.7 | `workflowTransitionEffectsCopy` / confirm modals may imply emails fire when plan blocks                | effects copy + confirm checkboxes                                | Align preview text with effective toggles (plan ∩ property)                                                                                             |
| P2.8 | Parking broadcast still BCC env/legacy path vs marketplace                                             | Phase 7 retired auto broadcast; endpoint for historical          | Decide: keep for unlinked/`need_parking` only; don’t revive as Free “default parking arrange” vs marketplace                                            |

### P3 — polish / improvements (nice-to-have, track here so nothing is forgotten)

| #     | Idea                                                                                             | Notes                                                                                                                                                    |
| ----- | ------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P3.1  | One sticky **Next step** banner on Free (no AI)                                                  | ✅ `workflowNextStepHint` + `WorkflowNextStepBanner`                                                                                                     |
| P3.2  | After manual Azure send, deep-link to download request PDF                                       | ❌ Dropped — request PDFs live in private buckets; raw links 404. Preview via Pending Documents → **Sent Docs → View** (`get-booking-asset-url`) instead |
| P3.3  | Co-host / Operations role: ensure `bookings.detail.workflow:edit` covers new send endpoints      | ✅ `send-booking-workflow-email` uses same scope as SD resend                                                                                            |
| P3.4  | Idempotency / “last sent at” timestamps for GAF/ack/ready/pet (like `sd_refund_form_emailed_at`) | Deferred — optional columns or activity log; SD timestamp exists                                                                                         |
| P3.5  | Downgrade mid-stay: Starter → Free while booking in flight                                       | Next transitions skip emails; ensure toast + manual sends still work; no orphan “expected auto”                                                          |
| P3.6  | Upgrade mid-stay: Free → Starter                                                                 | Later transitions auto-send; don’t double-send if host already manually sent (idempotency markers help)                                                  |
| P3.7  | D2 empty `documentRequirements` (direct PENDING_REVIEW → READY_FOR_CHECKIN)                      | Ack + ready emails both skip on Free — two manual sends                                                                                                  |
| P3.8  | Past-date / re-forward confirm checkboxes vs plan gate                                           | ✅ Confirm modal Free hint when paid plan would email (`workflowWouldEmailOnPaidPlan`)                                                                   |
| P3.9  | In-app notifications still fire when email gated?                                                | ✅ RFCI/RFCO bell notifications decoupled from email gate in orchestrator (2026-08-31)                                                                   |
| P3.10 | Guest never sees plan tier                                                                       | Guest emails either arrive (manual or auto) or don’t — no plan upsell to guest                                                                           |
| P3.11 | Org with mix: some properties Free (unenrolled), some paid                                       | Entitlements are per-property enrollment — verify resolvePropertyEntitlements for unenrolled                                                             |
| P3.12 | E2E harness fixtures force `automatedBookingFlow: true`                                          | ✅ `propertyTeamRbacHarness` accepts `{ freePlan: true }`; Free workflow spec covers 8 cases                                                             |
| P3.13 | Competitive UX: Guesty/Hostaway “manual send template” patterns                                  | Run `competitive-ux-research` before designing Manual sends UI                                                                                           |

---

## Edge cases checklist (must not miss)

### Host / workflow

- [ ] Proceed PENDING_REVIEW with GAF+pet+parking flags on Free → PDFs generated; emails in `automationSkippedByPlan`; status advances
- [ ] Mark GAF/pet complete via upload (manual approval) without email-listener — Free works
- [ ] Email-listener auto-approve path on Free (if property still has Azure inbound) — status advances; ready email still plan-gated
- [ ] Late parking at RFCI+; marketplace fulfill vs manual mark-complete
- [ ] Cancel from any status on Free
- [ ] Guest field edit revert to PENDING_REVIEW on Free — re-proceed regenerates PDFs; emails skip again
- [ ] Admin Return to prior status then re-forward — confirm checkboxes + plan skip don’t contradict
- [ ] SD = 0 path (skip SD form) on Free
- [ ] “Run check-out automation” on Free when balance settled — status vs email behavior documented/tested
- [ ] “Resend Check-out Instructions” on Free when property toggle OFF → 409 (raw toggle) vs plan OK
- [ ] Property Email Automations all OFF on Starter — same as Free for emails, but toast should say host choice not plan (today planBlocked vs toggled-off distinction exists server-side — surface correctly)

### Guest

- [ ] Public form submit on Free property (ops email still fires)
- [ ] Guest never blocked by plan on `/form`, `/sd-form`, stay guide, linked parking marketplace
- [ ] After host manual ack/ready sends, guest receives same templates as paid auto path
- [ ] Guest edit/resubmit sensitive fields → host re-review path still works

### Auth / multi-tenant

- [ ] New send endpoints: `resolveScopedPropertyAccess(..., 'bookings.detail.workflow:edit')` + booking belongs to property
- [ ] Org owner Free property vs invited Operations member
- [ ] Super-admin impersonation / platform paths if any (usually N/A)

### Billing / entitlements

- [ ] Property not enrolled in org subscription → Free entitlements
- [ ] `feature_overrides` on org subscription forcing `automatedBookingFlow` on Free plan row (if used) — respect overrides
- [ ] Commission / Managed / inactive plans — out of product but don’t break resolve

### Failure modes

- [ ] Manual send without request PDF URL → clear 4xx, not 500
- [ ] Resend with Resend API failure → toast error; booking unchanged
- [ ] Double-click send → idempotent or safe duplicate with toast
- [ ] Missing `static_files` on new email functions → ENOENT in prod — copy config.toml pattern from `transition-booking` / `send-sd-refund-form-email`

---

## Scope

### In

1. Inventory + this plan (done here).
2. Four new admin edge functions (or one multiplexed `send-booking-workflow-email` with typed `kind`) for GAF / pet / ack / ready — prefer **one multiplexed function** to cut deploy surface, matching shared emailService senders.
3. Wire **parking-broadcast** + all manual sends into booking-detail UI (Automation Triggers and/or plan-skip callout).
4. Fix misleading Free copy (advance guide + effects preview + toast actions).
5. Email Automations settings: plan-aware display for the six gated toggles.
6. Docs: booking-workflow, matrix residual, route guide, QA 03, PROJECT API table, edge-functions inventory.
7. Verification: Free E2E script/checklist + Starter smoke for auto path.

### Out (unless pulled in explicitly)

- Gating PDF generation or public guest form (do **not**)
- Replacing marketplace parking with Free “broadcast-first” product
- AI Next-step banner (P3.1) — separate polish
- New DB columns for every email “last sent” if activity log suffices — decide in implementation
- Changing which emails are plan-gated (keep Phase 5 matrix)
- Parking interim ungated features / org team permissions plans

---

## Approach (recommended)

### A. Server: multiplexed manual send

**Preferred:** `supabase/functions/send-booking-workflow-email/index.ts`

```text
POST { bookingId, kind: 'gaf_request' | 'pet_request' | 'booking_acknowledgement' | 'ready_for_checkin' | 'parking_broadcast' | 'sd_refund_form_request' }
```

- Auth + scope like `send-sd-refund-form-email`.
- Each kind: status / precondition guards (PDF present, `need_parking`, pets, etc.).
- Always `rawPropertyAutomationEnabled` for the matching toggle key.
- Reuse `emailService` senders already used by orchestrator.
- Optionally deprecate thin wrappers later; keep `send-sd-refund-form-email` + `parking-broadcast-email` as thin aliases initially to avoid breaking anything.

**Alternative:** four new functions + wire parking — more config.toml / static_files duplication.

### B. UI: Manual sends surface

1. **Persistent callout** when last transition returned skips **or** when booking is in a status where a plan-blocked email would normally apply and hasn’t been sent (heuristic or explicit flags).
2. Extend **Automation Triggers** (or rename to **Emails** on Free) with contextual Send buttons — minimal labels (`Send GAF request`, `Send acknowledgement`, …).
3. Toast action: primary **Send** / secondary Upgrade — or open Automation Triggers.

Follow `ui-minimal-copy` — no essays; short labels + errors only.

### C. Settings

On Free (or whenever `!automatedBookingFlow`): show TierBadge / lock on the six gated toggles; allow viewing defaults; saving ON still won’t fire auto (server truth) — prefer disable + upgrade modal over silent lie.

### D. Copy

Make `pipelineAdvanceGuide` / effects copy **plan-aware** via `useFeatureGate('automatedBookingFlow')` (or entitlements already on property plan query).

---

## Implementation tasks (ordered)

1. **Lock decisions** — multiplexed vs separate functions; whether to add `*_emailed_at` columns; Free settings UX (lock vs watermark).
2. **Competitive UX brief** (short) for Manual sends panel — PMS patterns.
3. **Server** — implement send path(s) + `config.toml` `static_files` + permission leaf.
4. **Client hooks** — mutations mirroring `useResendSdRefundFormEmail`.
5. **UI** — Automation Triggers expansion + plan-skip callout + toast actions.
6. **Copy** — `workflowAdvanceMode`, effects copy, featureGateCopy if needed.
7. **Settings** — Email Automations plan awareness.
8. **Docs** — list below.
9. **Verify** — Free E2E + Starter smoke; update QA 03.
10. **`/workflow-start`** → move this file to `in-progress/` when coding begins; `/workflow-done` when shipped.

---

## Docs to update (same change as implementation)

| Doc                                                         | Change                                                        |
| ----------------------------------------------------------- | ------------------------------------------------------------- |
| `.cursor/rules/booking-workflow.mdc`                        | Close “known gap”; document manual send API + Free copy rules |
| `docs/architecture/plans-feature-matrix.md`                 | Remove residual gap; note UI call sites                       |
| `docs/guides/routes/org/property/bookings-detail.md`        | Automation Triggers / Manual sends; Host Q&A Free path        |
| `docs/architecture/edge-functions.md` / `docs/PROJECT.md`   | New endpoint(s)                                               |
| `docs/architecture/validation-and-env.md`                   | If any new env (unlikely)                                     |
| `docs/workflow/qa/property-dashboard/03-bookings-detail.md` | Clear P1 when verified                                        |
| This plan → `docs/workflow/done/` on ship                   | Via workflow skill                                            |

---

## Verification plan (exit criteria)

### Free property (unenrolled or Free plan)

| Step | Host                               | Guest            | Assert                                                                              |
| ---- | ---------------------------------- | ---------------- | ----------------------------------------------------------------------------------- |
| 1    | —                                  | Submit form      | Booking `PENDING_REVIEW`; ops email optional                                        |
| 2    | Set pricing, Proceed               | —                | PDFs stored; `automationSkippedByPlan` non-empty; toast/callout; **no** silent skip |
| 3    | Manual send GAF (+ pet if any)     | —                | Azure emails received (or Resend test sink)                                         |
| 4    | Manual send acknowledgement        | Guest inbox      | Ack received                                                                        |
| 5    | Mark docs complete → RFCI          | —                | Ready email skipped until manual send                                               |
| 6    | Manual send ready-for-check-in     | Guest            | Email + stay guide path usable                                                      |
| 7    | Settle balance; resend/run SD path | Guest `/sd-form` | SD flow works; resend works on Free                                                 |
| 8    | Complete refund → COMPLETED        | —                | Graph complete                                                                      |

Also: create booking from admin UI if product supports it; cancel path; D2 empty-requirements property.

### Starter+ smoke

Same transitions → emails auto-fire; manual sends still work as resend; no false `automationSkippedByPlan`.

---

## Open questions (resolve before / during `/workflow-start`)

1. **One multiplexed function vs four+ wrappers?** (Recommend multiplexed.)
2. **Persist “sent at” for GAF/ack/ready/pet?** Or toast-only + optional activity?
3. **Should Free Email Automations toggles be disabled** or left editable for “when I upgrade”?
4. **Parking broadcast on Free:** still useful post-marketplace, or hide unless legacy unlinked `need_parking`?
5. **Toast primary CTA:** Send vs Upgrade — product preference for conversion vs ops?

---

## Related / do not conflate

| Topic                     | Where                                                         |
| ------------------------- | ------------------------------------------------------------- |
| Tier audit Phases 1–9     | `done/tier-feature-alignment-audit.md`                        |
| Org billing / enrollment  | `done/org-level-billing-migration.md`                         |
| Calendar sync (Pro+)      | `done/airbnb-calendar-sync.md` — not Free booking manual path |
| Booking import (Starter+) | matrix `bookingImport` — separate                             |
| Parking marketplace Free  | Guest self-serve ungated; broadcast is legacy adjunct         |

---

## Status summary

| Area                            | State                  |
| ------------------------------- | ---------------------- |
| Status graph on Free            | ✅ Works               |
| PDF + guest forms on Free       | ✅ Works               |
| Plan skip signal (toast + rail) | ✅ Works               |
| Manual sends (all six)          | ✅ Works               |
| Free-accurate host copy         | ✅ Works               |
| Settings plan honesty           | ✅ TierBadge + locks   |
| Bell notifications on Free      | ✅ Status-based (P3.9) |
| Host-toggle vs plan toasts      | ✅ Distinct messages   |
| Automated test coverage         | ✅ 8 e2e + Vitest/Deno |
| Live Mailpit walk (operator)    | Optional staging pass  |
