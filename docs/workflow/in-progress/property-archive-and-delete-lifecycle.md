---
stage: in-progress
title: 'Property archive and delete: lifecycle, guardrails, and clear host UX'
status: in-progress
tags: [workflow, planned, property, settings, lifecycle, billing, guest, ux-copy]
updated: 2026-11-07
kind: plan
---

# Property archive and delete: lifecycle, guardrails, and clear host UX

**Goal.** Make "take a property out of use" safe and obvious. A host should know, before they click, what happens to guests with upcoming stays, to the public page and booking link, to channel sync and automations, to their team, and to their bill. Nothing a guest already paid for should break, and no host action should bypass verification or contract rules.

**Scope.** Property only. Parking has the same pattern (`ParkingSettingsCard` archive/restore on `parkings.status`) and gets a follow-up once this ships (see Phase 7).

**Not in scope.** Org deletion (`delete-organization`), booking cancellation policy itself, channel-side unlisting on Airbnb/Booking.com (we only stop our own sync).

---

## 1. How it works today

| Action  | UI                               | Server                                                        | Gate                       |
| ------- | -------------------------------- | ------------------------------------------------------------- | -------------------------- |
| Archive | Settings > Danger Zone > Archive | `PATCH update-property { status: 'INACTIVE' }`                | `settings.dangerZone:edit` |
| Restore | Same card, shown when `INACTIVE` | `PATCH update-property { status: 'ACTIVE' }` + tower/unit 409 | `settings.dangerZone:edit` |
| Delete  | Same card, owner only            | `DELETE delete-property`, 409 if any `guest_submissions` row  | Org owner                  |

Files: `ui/src/features/dashboard/org/components/property-settings/PropertyProfileSettingsSections.tsx` (`PropertyDangerZoneSection`), `ui/src/features/dashboard/bookings/components/PropertySettingsCard.tsx` (`handleArchiveProperty` / `handleRestoreProperty` / `handleDeleteProperty`), `supabase/functions/update-property/index.ts`, `supabase/functions/delete-property/index.ts`.

"Archive" is **not a separate state**. It is just `properties.status = 'INACTIVE'`, the same value the system uses for four other meanings.

---

## 2. Findings

Severity: **P0** = security or guest-harm bug, **P1** = wrong or surprising behavior, **P2** = confusing UX or missing info.

### 2.1 One flag, five meanings (root cause of the confusion)

`status = 'INACTIVE'` is written by:

| Writer                                                      | Meaning                                  |
| ----------------------------------------------------------- | ---------------------------------------- |
| `create-property` / `create-organization`                   | New listing, waiting for Tier 1 approval |
| `contractExpiryCron.ts#setListingInactive`                  | Contract lapsed, grace over              |
| `decide-contract-consideration` (deny)                      | Super admin denied an extension          |
| `propertyTowerUnit.ts#activatePropertyAfterListingApproval` | Unit handed to a new host (succession)   |
| Danger Zone Archive                                         | Host chose to retire it                  |

Nothing records **why** a property is inactive, so the UI cannot explain it, and the server cannot decide who may reactivate it.

### 2.2 P0: Restore bypasses verification and contract locks

`update-property` accepts `status: 'ACTIVE'` from anyone with `settings.dangerZone:edit`. It only checks the tower/unit peer conflict. It does **not** check listing authorization or `accessLockedAt`.

- A brand-new, unverified property shows **"Restore Property"** in the Danger Zone (because it starts `INACTIVE`). Clicking it publishes the listing without super-admin approval. The docs say the listing "stays inactive until super-admin approves" (`docs/workflow/in-progress/host-onboarding-setup-guide.md`).
- A contract-locked or consideration-denied listing can be restored the same way, undoing the contract lifecycle.
- A non-owner team member with `settings.dangerZone:edit` can do either.
- The AI assistant tool `propose_update_property_profile` accepts `status` and goes through the same service, so it has the same bypass.

### 2.3 P0: Archived properties still take new bookings

`submit-form` and `get-form` resolve the property via `resolvePublicPropertyId` > `resolvePropertyIdBySlug`, which does **not** filter by status. The public property page 404s, but the direct booking link (`/?property=<slug>`), any saved bookmark, QR code, or old Facebook post still creates real `PENDING_REVIEW` bookings on an archived unit. The same applies to `get-booked-dates`.

### 2.4 P0: Guests with confirmed stays lose their stay guide

`guestStayGuide.ts` returns `null` when `property.status !== 'ACTIVE'`, and `get-guest-stay-guide` does not pass `allowInactive`. Archiving a property with an upcoming or in-house guest removes check-in instructions, Wi-Fi, house rules, and access details for that guest with no warning. It also means a pending-verification property that already took bookings via the direct link (2.3) has no stay guide.

The trip page links to the public property page, which also 404s for archived listings.

### 2.5 P1: Archive has no pre-check or impact summary

Archive runs instantly with no look at:

- Upcoming or in-house bookings (`PENDING_REVIEW` through `READY_FOR_CHECKOUT`)
- Pending SD refunds (`PENDING_SD_REFUND`) and open cancellation requests or refunds
- Connected iCal import feeds and the iCal export link
- Scheduled Meta publications, Telegram automations, Smart Pricing, Voice receptionist, Inbox AI auto-reply
- Team members and pending invitations
- Its slot in the org subscription

Compare: Airbnb blocks permanent removal while any upcoming reservation or request exists, and Guesty warns that deactivation turns off automations and calendar features.

### 2.6 P1: Automations keep running on archived properties

No status check in: `calendar-sync-cron` (keeps importing bookings), `ical-export` (keeps publishing availability to OTAs), `smart-pricing-cron`, `publish-to-meta`, all `telegram-*-cron`, `review-lifecycle-cron`, `meta-inbox-webhook` AI replies. Some of these **must** keep running (SD refund, cancellation refund, reviews for past stays). Others should stop. Today it is all or nothing by accident.

### 2.7 P1: Archived properties are billed forever

`planEntitlements.ts#listOrganizationPropertyIds` ("billing always covers the full count") and `orgSubscriptionCheckout.ts` count every org property regardless of status. A host with booking history cannot delete, so a retired unit is billed indefinitely. Guesty stops billing on deactivate (next cycle); Hostaway is criticized for charging off-market listings. The UI never mentions billing on archive.

### 2.8 P1: Delete is blocked by more than bookings, with a vague error

The UI says delete is "only allowed when there is no booking history". Real blockers (`ON DELETE RESTRICT` / no action):

| Table                                 | Effect                         |
| ------------------------------------- | ------------------------------ |
| `guest_submissions`                   | Pre-checked, clear 409         |
| `finance_line_items`                  | Generic "still referenced" 409 |
| `maintenance_items`                   | Generic "still referenced" 409 |
| `import_batches`, `import_batch_rows` | Generic "still referenced" 409 |

The host has to guess what to remove. Cancelled-only and imported bookings also block delete (correct for records, but the copy should say so).

### 2.9 P1: Delete silently cascades data the copy does not mention

`ON DELETE CASCADE` removes, among others: `social_conversations` (Guest Inbox threads, including prospective guests who never booked), `property_payment_transactions` (billing payment history), `org_subscription_properties` (subscription slot, no proration or event), `property_members` + `property_invitations` (team loses access without notice), `marketing_*` (posts stay live on Facebook, our records vanish), `property_calendar_feeds` / `property_calendar_export` (OTAs keep polling a dead iCal URL), reviews, pricing, templates, custom pages.

Storage cleanup only covers `property-media`. Marketing media, payment QR / signature assets, guest chat uploads and listing verification docs are orphaned.

The modal mentions only "profile, gallery media, payment settings, and Telegram configs".

### 2.10 P2: UX and copy issues

- "Danger Zone" mixes a reversible action (Archive) and an irreversible one (Delete) with near-identical buttons.
- Restore copy ("Shows the property in active listings again") is wrong for a never-verified or contract-locked property.
- No "Archived" banner anywhere in the property dashboard; hosts and team members keep working in it with no signal.
- Properties list shows one grey `INACTIVE` badge for all five meanings; the status filter has only Active / Inactive.
- Delete confirmation is one click, no typed name, no list of what will be lost.
- Activity log records archive as a generic `property.updated` status diff, not `property.archived` / `property.restored`.
- `handleArchiveProperty` / `handleRestoreProperty` overwrite `profileDraft` and `profileBaseline` with the server result, silently discarding any unsaved profile edits on the page.
- Archive and Restore share `updateProperty.isPending`, so any profile save shows "Archiving..." on the button.
- After delete, a remembered last-property slug (sidebar/selector) can point at a 404.
- Unlisted terminology: we say "Archive" in the card, "Inactive" in the badge, "hide from active listings" in copy. Guests and hosts never see one word.

### 2.11 Things that already work and must not regress

- Tower/unit uniqueness is only among `ACTIVE` listings, so archiving frees the unit for a successor; Restore 409s if a peer took it.
- Booking workflow transitions, emails, trip portal (`get-guest-trip`), guest cancel and SD refund have no status check, so existing bookings keep working (except the stay guide, 2.4).
- `get-public-property` / `get-public-showcase` allow host preview of inactive listings.
- Public search, facets, host profile, portfolio summary and analytics cron already filter `ACTIVE`.
- Delete is owner-only and hidden for others.

---

## 3. How others do it

| Product  | Reversible "stop new bookings"                                                      | Retire                                                                                         | Permanent delete                                                     |
| -------- | ----------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| Airbnb   | **Unlist / snooze** (up to 6 months or indefinitely); confirmed stays still honored | n/a                                                                                            | **Remove**: blocked while any upcoming reservation or request exists |
| Guesty   | **Unlist** on channel (still billed)                                                | **Deactivate**: stops billing next month, turns off automations and calendar rules, keeps data | **Delete**: permanent, must disconnect channels first, stops billing |
| Hostaway | No pause (community complaint)                                                      | Deactivate iCal before delete recommended                                                      | **Delete**: permanent, reservations no longer manageable             |

Takeaways we adopt:

1. Three distinct verbs, each with one meaning.
2. Pausing never touches confirmed stays.
3. Retiring stops automations and billing, keeps every record.
4. Delete is only for empty listings, and the blocker list is explicit.

---

## 4. Proposed model

### 4.1 Host-facing states

| State                    | Who sets it                                 | Public page + search             | New bookings | Existing stays | Automations                    | Billed                  | Host can reactivate                |
| ------------------------ | ------------------------------------------- | -------------------------------- | ------------ | -------------- | ------------------------------ | ----------------------- | ---------------------------------- |
| **Pending verification** | System on create                            | Hidden                           | **Blocked**  | Work           | Off except booking emails      | Yes                     | No, super admin approves           |
| **Live**                 | Approval / host                             | Shown                            | Open         | Work           | On                             | Yes                     | n/a                                |
| **Paused**               | Host                                        | Shown with "Not taking bookings" | **Blocked**  | Work           | On                             | Yes                     | Yes, anytime                       |
| **Suspended**            | System (contract lapsed/denied, succession) | Hidden                           | Blocked      | Work           | Off except money + guest comms | Yes                     | No, resolve the cause first        |
| **Archived**             | Host                                        | Hidden                           | Blocked      | Must be none   | Off                            | **No, from next cycle** | Yes, re-checks verification + unit |
| **Deleted**              | Org owner                                   | Gone                             | n/a          | Must be none   | n/a                            | No                      | No                                 |

"Pause" replaces today's casual use of Archive (seasonal break, renovation). "Archive" becomes "I no longer manage this unit".

### 4.2 Data model

Keep `properties.status` (`ACTIVE` | `INACTIVE`) as the single "is it publicly live" flag so the ~40 existing `.eq('status', 'ACTIVE')` reads keep working. Add:

```
properties.inactive_reason   text null  check in ('pending_verification','paused','contract_lapsed','consideration_denied','succession','archived')
properties.archived_at        timestamptz null
properties.archived_by        uuid null references auth.users(id) on delete set null
properties.paused_at          timestamptz null
```

- Invariant: `status = 'ACTIVE'` iff `inactive_reason is null` (check constraint).
- Backfill: `INACTIVE` + no approved listing authorization > `pending_verification`; `INACTIVE` + `accessLockedAt` > `contract_lapsed`; `INACTIVE` + an `ACTIVE` same tower/unit peer in another org > `succession`; all other `INACTIVE` > `archived` with `archived_at = updated_at`. Dry-run counts on hosted dev before applying.
- Every system writer in 2.1 sets its reason in the same update.

### 4.3 One server-side lifecycle service

New `_shared/propertyLifecycle.ts`, the only code allowed to change `status` / `inactive_reason`:

- `getPropertyLifecycleImpact(propertyId)` returns counts for: upcoming/in-house bookings, pending requests, pending SD refunds, open cancellation requests, iCal feeds + export, scheduled publications, team members + invites, subscription slot, delete blockers (bookings incl. cancelled/imported, finance, maintenance, import batches) and cascade counts (inbox threads, reviews, payment transactions).
- `pauseProperty`, `resumeProperty`, `archiveProperty`, `restoreProperty`, plus the system setters.
- `canHostActivate(property)`: false when reason is `pending_verification`, `contract_lapsed`, `consideration_denied`, `succession` (unless the peer is gone) or the listing authorization is not approved or `accessLockedAt` is set.

New edge function `property-lifecycle` (`serveAuthenticated`, `verifyPropertyAccess`):

- `GET ?property_id=` > impact + current state + allowed actions (drives the UI; never compute rules client-side).
- `POST { action: 'pause' | 'resume' | 'archive' | 'restore' }`.

`update-property` and `propertyProfileService` **reject** `status` in the body (400 "Use property-lifecycle"), which also closes the AI assistant path. Add an assistant tool that proposes lifecycle actions through the new service (Tier 2 confirm).

### 4.4 Guardrails per action

**Pause.** Allowed when Live. No booking pre-check. Blocks new submissions only.

**Archive.** Allowed from Live, Paused or Suspended. **Blocked** while any booking is in `PENDING_REVIEW`, `PENDING_DOCUMENTS`, `READY_FOR_CHECKIN`, `READY_FOR_CHECKOUT`, `PENDING_SD_REFUND` or a legacy nested pending status, or while a cancellation request or refund is open. The block lists each booking with a link. (Airbnb model. Simpler and safer than auto-cancel.) On success: disable iCal feeds and export, cancel scheduled publications, turn off Smart Pricing / Telegram / Voice / Inbox AI auto-reply, keep team access read-only, unslot from the org subscription at next cycle.

**Restore (from Archived).** Re-runs `canHostActivate` and the tower/unit check. Does **not** re-enable automations or iCal automatically; the success sheet lists what to turn back on. Re-slots into the subscription (may trigger `billingRequired`, same as `create-property`).

**Delete.** Owner only. Server returns every blocker by name ("3 finance entries, 1 maintenance item"). Confirmation lists what will be removed (inbox threads, reviews, payment history, team access, marketing records) and requires typing the property name. Blocked while a listing verification is `pending` (avoid orphaned review rows) Delete is allowed mid-period with no refund; the subscription slot drops next cycle. Cleans every per-property storage prefix, not just `property-media`. Notifies removed team members by email. Writes `property.deleted` with the impact snapshot in metadata.

### 4.5 Guest-side behavior

| Surface                                    | Live | Paused                                                   | Pending / Suspended       | Archived                |
| ------------------------------------------ | ---- | -------------------------------------------------------- | ------------------------- | ----------------------- |
| Public page `/properties/:slug`            | Yes  | Yes, booking CTA replaced with "Not taking new bookings" | 404                       | 404                     |
| Search, host profile, development pages    | Yes  | No                                                       | No                        | No                      |
| New booking via `?property=` link          | Yes  | **Friendly closed screen**                               | Closed screen             | Closed screen           |
| Existing booking: edit form, SD form, docs | Yes  | Yes                                                      | Yes                       | n/a (none can exist)    |
| Trip portal, cancel, refund details, chat  | Yes  | Yes                                                      | Yes                       | Past trips read-only    |
| Stay guide                                 | Yes  | Yes                                                      | **Yes for booked guests** | No (no stays left)      |
| Reviews for completed stays                | Yes  | Yes                                                      | Yes                       | Yes until window closes |
| Vouchers for this property                 | Yes  | Valid, not redeemable until resumed                      | Not redeemable            | Not redeemable          |

Implementation: `submit-form` new-submission path and `get-form` new-booking mode call `assertPropertyAcceptsNewBookings`; booking-scoped calls (update with token/booking id) skip it. Stay guide loader allows inactive when the token is tied to a booking on that property. Closed screen copy: "This place isn't taking new bookings right now." plus host contact if published.

### 4.6 Automations matrix (server)

| Job / surface                                | Paused                     | Suspended            | Archived                    |
| -------------------------------------------- | -------------------------- | -------------------- | --------------------------- |
| Booking workflow emails                      | On                         | On                   | n/a                         |
| `sd-refund-cron`, `cancellation-refund-cron` | On                         | On                   | On (must finish)            |
| `review-lifecycle-cron`                      | On                         | On                   | On                          |
| `calendar-sync-cron` (import)                | On                         | Off                  | Off                         |
| `ical-export`                                | Shows paused dates blocked | Blocked feed         | 410 Gone                    |
| `smart-pricing-cron`                         | On                         | Off                  | Off                         |
| `publish-to-meta` scheduled                  | On                         | Off                  | Cancelled                   |
| `telegram-*-cron`                            | On                         | Booking-related only | Off                         |
| Inbox AI auto-reply                          | On, context says paused    | Off                  | Off                         |
| Analytics AI review                          | Off                        | Off                  | Off (already `ACTIVE` only) |

Each cron reads one helper (`propertyLifecycle.ts#automationAllowed(property, job)`) instead of ad-hoc status checks.

### 4.7 Host UX

Replace "Danger Zone" with a **Listing status** section at the top of Settings (status is not only a danger action):

1. **Status card.** Badge (Live / Paused / Pending verification / Suspended / Archived), one line on why, one line on what guests see. Suspended and Pending link to the verification or renewal flow instead of showing Restore.
2. **Actions** shown only when `allowedActions` from the server includes them: Pause / Resume, Archive / Restore.
3. **"Compare options"** info button (shared `InfoHint` / How it works dialog from `dashboard-contextual-help.md`) with the Pause vs Archive vs Delete table in plain words.
4. **Impact sheet** (ResponsiveModal, bottom sheet on phone) before Archive, Restore and Delete, filled from `GET property-lifecycle`: what stops, what keeps working, who is affected, billing line. Blocked state lists the bookings to finish or cancel first.
5. **Delete** moves to a separate, collapsed "Delete property" row at the bottom, owner only, typed-name confirmation.

Elsewhere:

- **Property dashboard banner** for Paused / Suspended / Archived, with the primary action.
- **Properties list**: badge per state, status filter gains Paused / Pending / Suspended / Archived, Archived hidden by default behind a toggle.
- **Property selector / sidebar**: archived properties grouped under "Archived".
- **Plans page**: show which properties are billed, and that archived ones drop off next cycle.
- **Activity**: `property.paused`, `property.resumed`, `property.archived`, `property.restored`, `property.suspended`, `property.deleted` with reason and impact metadata.
- Fix the unsaved-draft wipe: lifecycle actions refetch the property and only update `status` fields in the draft and baseline. Separate pending flags per action.

Draft copy (run through `human-copy` at build time):

| Spot              | Copy                                                                                      |
| ----------------- | ----------------------------------------------------------------------------------------- |
| Pause helper      | Stop new bookings for a while. Guests with bookings keep their stay.                      |
| Archive helper    | Retire this property. Records stay, automations stop, and it leaves your bill next cycle. |
| Archive blocked   | Finish or cancel these bookings first.                                                    |
| Delete helper     | Remove a property that has no records. This can't be undone.                              |
| Pending badge tip | We're reviewing your listing. It goes live once approved.                                 |
| Suspended tip     | Your listing contract has ended. Renew it to go live again.                               |

---

## 5. Edge cases checklist

Each needs a test or an explicit manual check.

1. Archive with an in-house guest (checked in today) > blocked, guest stay guide still loads.
2. Archive with only `PENDING_SD_REFUND` bookings > blocked until refund completes.
3. Archive with only `CANCELLED` / `COMPLETED` / `IMPORTED` history > allowed.
4. Pause, then a guest edits their existing booking via the form link > allowed.
5. Pause, then a new guest opens `?property=` > closed screen, no row created.
6. Paused/archived property receives an iCal-imported booking from an OTA (sync lag) > paused: imported and host notified; archived: sync is off, and if an import arrives mid-archive the archive is rejected (re-check inside the same transaction / RPC).
7. Race: guest submits while host archives > archive pre-check and submit both read status under a row lock, or archive re-checks after setting status and rolls back if a new booking appeared.
8. Restore a never-verified property > 409 "Waiting for approval".
9. Restore a contract-locked property > 409 with link to renewal.
10. Restore after another org took the same tower/unit > 409, unchanged today.
11. Super admin approves verification for a property the host has Paused > stays Paused (approval clears `pending_verification` only, does not override a host pause). Decide order: store `paused_at` independently of reason.
12. Contract lapses on a Paused property > becomes Suspended; resuming later still requires renewal.
13. Contract lapses on an Archived property > stays Archived, no lapse emails (contract cron skips archived).
14. Team member with `settings.dangerZone:edit` but not owner > can Pause/Archive, cannot Delete.
15. Plan-limited team seat reconciliation ignores archived properties' seats.
16. Org with one property archives it > org dashboard empty state, onboarding does not re-trigger.
17. Delete the last property > navigates to properties list, selector cleared, no 404 loop.
18. Delete with finance entries only > blocker message names finance.
19. Delete while enrolled mid-period in a paid sub > allowed, no refund, slot drops next cycle.
20. Delete with a pending listing verification > blocked.
21. Delete with Meta inbox connected > disconnect first or auto-revoke tokens; warn that threads are removed.
22. Delete while marketing posts are scheduled > cancel jobs first.
23. Old trip link for a deleted property (should not exist since bookings block delete) > 404 handled.
24. Voucher issued for an archived property > shown as not redeemable in the guest wallet.
25. Public page cache (`Cache-Control`) after archive > purge or short TTL so it 404s promptly.
26. AI assistant asked to "archive this property" > uses lifecycle tool, shows impact, Tier 2 confirm.
27. Guest web chat started on a paused property's page > works, AI knows it is paused.
28. Smart pricing overrides scheduled for future dates on an archived property > kept, not applied.
29. Unsaved profile edits on the Settings page when the host clicks Pause > edits preserved.
30. Phone: every sheet fits 375px, primary action reachable, typed-name input does not get hidden by the keyboard.

---

## 6. Decisions (settled 2026-11-06)

All five are decided. They follow the recommended option; the reasoning is recorded so a later
change does not silently reverse them.

| ID     | Decision                                                                                                                                                | Why                                                                                                                                                                                                    |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **D1** | **Block** new bookings on a property that is still waiting for verification.                                                                            | Matches the documented onboarding rule that a listing "stays inactive until super-admin approves", and the direct link is shareable, so leaving it open lets an unapproved listing take real bookings. |
| **D2** | **Keep the public page** for Paused, with the booking CTA replaced by "Not taking new bookings". Search, host profile and development pages exclude it. | Shared links, QR codes and indexed pages keep working, so the listing can return without a new URL. Same as Airbnb snooze. Hiding it would create dead links for a state the host intends to reverse.  |
| **D3** | **Archived leaves the bill from the next cycle. Paused and Suspended stay billed.**                                                                     | Archiving is the host's explicit "stop charging me for this unit" action. Paused is temporary and fully operational. Suspended holds the unit and is recoverable by renewal, so it stays on the plan.  |
| **D4** | **Archived is read-only for team members and frees their seats.**                                                                                       | There is no operational work on a retired listing, and keeping write access risks edits to something no guest can see. Freeing seats keeps plan limits honest.                                         |
| **D5** | **Delete is allowed mid-period with no refund; the subscription slot drops next cycle.**                                                                | Matches Guesty delete. Blocking until period end creates a support dead end for a host who already decided to leave. No proration logic to build or explain.                                           |

Settled behaviour that follows from these, already reflected in 4.1, 4.4, 4.5 and 4.6:

- Pending verification and Suspended take no new bookings, and their direct link shows the same
  closed screen as Archived.
- Paused properties keep every automation, stay on the bill, and still serve guests who booked.
- Archive is the only host action that stops billing, and it drops the slot at the next cycle, not
  immediately, so the current period is still paid for.
- Team seats for archived properties are released; un-archiving re-checks the seat count and may
  require a plan change.
- Delete never refunds a paid period and never prorates.

---

## 7. Phases

Each phase ships on its own and leaves the app working.

| Phase                             | Scope                                                                                                                                                                                                                                                                                                                                                          | Key files                                                                                                                                                                                |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **P0 hotfix** (shipped)           | Server: `update-property` and `propertyProfileService` reject `ACTIVE` when listing authorization not approved or access locked, reading the listing block only (no org-leg fallback). `submit-form` refuses a new submission when the property is not `ACTIVE`. Stay guide allows inactive for booked guests. Restore hidden in the UI with the reason shown. | `update-property/index.ts`, `propertyProfileService.ts`, `submit-form`, `propertyListingGate.ts`, `guestStayGuide.ts`, `PropertySettingsCard.tsx`, `PropertyProfileSettingsSections.tsx` |
| **P1 data** (shipped)             | Migration: `inactive_reason`, `archived_at`, `archived_by`, `paused_at`, constraint, backfill. All system writers set the reason.                                                                                                                                                                                                                              | new migration, `contractExpiryCron.ts`, `decide-contract-consideration`, `propertyTowerUnit.ts`, `approve-listing-authorization`, `create-property`, `create-organization`               |
| **P2 service** (shipped)          | `_shared/propertyLifecycle.ts`, `property-lifecycle` edge function (GET impact, POST actions), `config.toml` entry, activity events, assistant tool swap. `update-property` stops accepting `status`.                                                                                                                                                          | new files, `dashboardAssistantTools.ts`, `activityLog.ts`                                                                                                                                |
| **P3 automations** (shipped)      | `automationAllowed` helper wired into the crons and webhooks in 4.6. iCal export 410 for archived.                                                                                                                                                                                                                                                             | crons listed in 2.6                                                                                                                                                                      |
| **P4 host UI** (shipped)          | Listing status section, impact sheets, compare dialog, typed-name delete, dashboard banner, list badges and filters, selector grouping, draft-wipe fix.                                                                                                                                                                                                        | `PropertyProfileSettingsSections.tsx`, `PropertySettingsCard.tsx`, `OrgProperty*`, `orgPropertyDisplay.ts`, `orgPropertiesFilters.ts`, new `usePropertyLifecycle` hook                   |
| **P5 guest UI** (shipped)         | Closed-for-bookings screen, paused public page state, voucher states, trip page link fallback.                                                                                                                                                                                                                                                                 | `features/guest/form`, `features/guest/property`, guest vouchers                                                                                                                         |
| **P6 billing + delete** (shipped) | Billing count excludes Archived (D3 decision); delete blocker list, cascade warnings, storage cleanup for all buckets, member notification, Meta token revoke, subscription event.                                                                                                                                                                             | `planEntitlements.ts#listOrganizationPropertyIds`, `orgSubscriptionCheckout.ts`, `org-plan`, `delete-property`                                                                           |
| **P7 parking parity**             | Same model for `parkings` (archive, pause, delete, guest pay-parking closed screen). Separate plan once P0 to P6 land.                                                                                                                                                                                                                                         | `ParkingSettingsCard.tsx`, `update-parking`, parking guest flows                                                                                                                         |

Plans/RBAC: new leaf `settings.listingStatus:edit` replaces `settings.dangerZone:edit` (remap existing roles in the migration); delete stays owner-only. No plan gate: lifecycle actions are available on every plan.

**P0 notes (shipped):**

- `get-form` has no new-booking mode. It only loads an existing booking by id, so the
  `INACTIVE` gate belongs in `submit-form` alone. The plan's P0 wording is corrected here.
- The activation gate reads `properties.settings.listingAuthorization` directly, never
  `resolveListingAuthorization`'s org-leg fallback. A listing created after the backfill has no
  block, and falling back to the org leg would call it approved.
- `propertyListingGate.ts` is temporary scaffolding: P2 moves the same check into
  `propertyLifecycle.ts#automationAllowed` / `assertPropertyAcceptsNewBookings`.
- The `PROPERTY_NOT_ACCEPTING_BOOKINGS` toast is the P0 stopgap. P5 replaces it with the
  full closed screen on the public page.

activity-log: required, see 4.7. P0 adds no new mutation, so it stays on `property.updated` until
P2 adds `property.archived` / `property.restored`.

---

### Implementation notes (2026-11-07)

Shipped P1 to P6 on `feat/property-lifecycle`:

- `_shared/propertyLifecycleState.ts` holds the pure vocabulary (state mapping, automation
  matrix) so guest read paths do not pull the billing service graph. `_shared/propertyLifecycle.ts`
  re-exports it and owns every status write.
- `property-lifecycle` is the only host path. `update-property` and `propertyProfileService`
  reject `status` (so the AI assistant tool cannot flip it either; the assistant now hands off
  to Settings). The new assistant lifecycle tool is deferred, not required to close the bypass.
- DB backstop: `guest_submissions_property_live_guard` rejects a new guest booking on a
  non-`ACTIVE` property. OTA iCal imports (`external_feed_id`) and `IMPORTED` rows are exempt
  so a paused listing still receives an in-flight OTA booking.
- Delete is owner-only, typed-name, blocked by `guest_submissions`, `finance_line_items`,
  `maintenance_items`, and `import_batches` / `import_batch_rows`, and cleans every property
  storage prefix we own (`property-media`, `marketing-media`, `listing-authorization-assets`,
  the three `app-settings-assets` prefixes, and guest chat attachments).
- Billing: archiving calls `removePropertyFromOrgSubscription` (event `property_removed`);
  restoring calls `autoEnrollPropertyInOrgSubscription`; plan changes use
  `listOrganizationPropertyIds`, which now excludes archived listings.

Deliberately deferred:

- **P7 parking parity** (separate plan).
- **Assistant lifecycle tool** — the assistant cannot change status; a Settings handoff is returned.
- **Plans page per-property billed list** — the count and totals already exclude archived;
  an explicit per-property breakdown is still a nice-to-have.
- **Trip page "View listing" fallback** for a suspended listing (the link 404s; no guest data is lost).
- **`ai-assistant-attachments` storage** is org/conversation scoped, not property scoped, so it is
  not part of delete cleanup.

## 8. Verification plan

- **Deno unit**: `propertyLifecycle_test.ts` covering `canHostActivate`, archive blockers per status, impact counts, automation matrix.
- **Deno handler tests**: `property-lifecycle` (each action, 403 for wrong role, 409 cases), `update-property` rejects `status`, `submit-form` closed path, stay guide for booked guest on inactive property.
- **Migration**: backfill dry-run counts on hosted dev logged in the PR; constraint holds after backfill.
- **Vitest**: state label/badge mapping, allowed-action rendering from server payload.
- **Playwright mocked E2E**: pause/resume, archive blocked with bookings, archive success, restore blocked when unverified, delete typed-name, guest closed screen. 375px + 1024px.
- **Manual on hosted dev**: archive with an imported OTA feed connected; restore re-slots billing; delete cleans storage buckets.
- Gates: `bun run ci:quality`, `test:edge`, `test:edge:handlers`, `test:e2e:smoke`.

## 9. Docs to update in the same changes

`docs/guides/routes/org/property/settings.md` (replace "Active vs Archive" and Danger Zone sections), `docs/guides/routes/org/properties.md`, `docs/guides/routes/org/plans.md`, guest route guides for form / property page / trip / stay guide, `docs/architecture/edge-functions.md` (`property-lifecycle`, `update-property`, `delete-property`), `docs/architecture/data-model.md`, `docs/architecture/overview.md`, `docs/PROJECT.md`, `docs/architecture/plans-feature-matrix.md` (billing rule), `docs/archive/operations/migration-runbook.md` (backfill), `docs/guides/support/faqs.md` + Host-facing knowledge Q&A, `.cursor/rules/booking-workflow.mdc` if guest form gating is documented there.

## Sources

- Airbnb: [Snooze, unlist or deactivate a listing](https://www.airbnb.com/help/article/476/how-do-i-snooze-unlist-or-deactivate-my-listing)
- Guesty: [Options for disabling a listing](https://help.guesty.com/hc/en-gb/articles/23668386450077-What-are-the-options-for-disabling-a-listing), [Deactivating or reactivating a listing](https://help.guesty.com/hc/en-gb/articles/9175347000861-Deactivating-or-reactivating-a-listing), [Deleting a listing](https://help.guesty.com/hc/en-gb/articles/9365078202141-Deleting-a-Listing), [Billing for inactive listings](https://help.guesty.com/hc/en-gb/articles/11016900448669-Why-am-I-being-billed-for-inactive-listings)
- Hostaway: [Deleting a listing](https://support.hostaway.com/hc/en-us/articles/360021368354), [Pause without data loss (community)](https://support.hostaway.com/hc/en-us/community/posts/29926016968347-Listing-Pause-Deactivation-without-Data-Loss)
