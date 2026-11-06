---
stage: in-progress
title: 'Settings cleanup — retire legacy settings, fix redundant ones, clarify Email automations'
status: in-progress
tags: [workflow, planned, settings, parking, email, cleanup, ux-copy]
updated: 2026-11-06
kind: plan
---

# Settings cleanup — retire legacy settings, fix redundant ones, clarify Email automations

**Goal.** Audit every org, property and parking setting. Remove what is dead or legacy, fix what is redundant or misleading, and rewrite the Email automations card so a non-technical host understands each field without reading docs.

**Constraint.** Nothing that works today may break. Removal is **expand/contract**: first the UI stops showing a field and the server stops using it (Phases 1 to 5). Columns and keys are dropped only after that ships and soaks (Phase 6, deferred).

> **Verified 2026-11-06** against `origin/develop` (`6a8a9038a`). Every "no callers" claim below was re-checked with `rg` on that commit. Three numbers in the first draft were wrong and are corrected here: the plan-gated property toggles are **5** after `emailParkingBroadcast` is removed (not 6), `useSaveParkingRateGuest` has **one** importer (the orphan `PayParkingModal`), and removing the parking **Payment** section also removes the parking setup-guide payment step and the parking OTP path, which the first draft missed.

---

## Shipped in this change (Phases 1 to 5)

- Property Email automations: Parking owners removed; one **Team email** label; read-only **Building admin email**; check-out section rewritten; automated sends inline and grouped by recipient; tier badge moved to the 5 gated rows; 120 min default.
- Guest Form: Parking grouped; Preferred and Free own parking hidden without an ACTIVE org slot; server requires `allowParking` for complimentary; own-slot CTA falls back when parking is off; Cleaning Time moved to Property Details; Guest Form modal says **Done**.
- Parking settings: Email + Booking Automation merged into **Automations**; Payment section, completion rules, OTP path, setup-guide step and QR upload UI removed.
- Server/dead code: `emailParkingBroadcast` removed from both key lists, defaults, plan gates, assistant label and workflow copy; `parkingOwnerEmails` dropped from the DTO, patch, permissions and clone groups; `sendParkingBroadcast` deleted; `email-parking-request` template removed (static HTML + index links too); `submit-pay-parking` is a 410 stub; orphan pay-parking components/schema and `submitPayParking` deleted.
- **Bug found during this pass:** `buildProfilePatchForSections` never included `cleaningBufferMinutes`, so changing only Cleaning Time could mark the section dirty but save nothing. It is now saved in the `details` section.
- Tests: `ownerDefaultParking_test`, `propertyAutomationToggles_test`, `propertyTemplates_test`, `propertyEmailAutomation.test`, `propertySettingsSave.test` (incl. no Parking owners, cleaning-buffer section), `propertySettingsCompletion.test`, `parkingSettingsSavePlan.test`, and a `@ci` Playwright spec `propertySettingsEmailAutomations.spec.ts`.

Phase 6 (schema contract) stays deferred until one release soak and `kamewave`.

---

## 0. Decisions (locked)

| #      | Decision                                                                                      | Outcome                                                                                                                                                                                                       |
| ------ | --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **D1** | Parking **Payment** section (guest payment methods, GCash QR, required for completion).       | **Remove.** Guests pay through PayMongo. No public/guest/payout path reads `parking_settings.payment_methods`. If super-admin payouts need a host account later, add an org-level "Payout account", not this. |
| **D2** | Property **Parking rate** fee + `ParkingRequestForm` manual fields (owner/agent, owner rate). | **Keep for now.** Still the manual fallback for off-platform parking. Relabel the Pricing fee row "Parking rate (manual parking only)". Full retirement is a separate booking-workflow change.                |
| **D3** | Automated sends: inline list vs modal.                                                        | **Inline**, grouped by recipient. Removes the fake "Save" button.                                                                                                                                             |
| **D4** | Check-out email lead default.                                                                 | **120 minutes.** Matches `sd-refund-cron/index.ts` header and `booking-workflow.mdc`. Server code currently says 180 in two places. Only `null` rows change.                                                  |

---

## 1. Audit result (2026-11-06, re-verified)

Legend: **Remove** = dead or legacy, no live behavior depends on it · **Fix** = live but buggy, misplaced or redundant · **Clarify** = live and correct, copy/UX only · **Keep** = no change.

### 1.1 Org settings (`/org/:orgSlug/settings`)

The UI is lean already: Basic info, Socials & branding, Superhost progress, AI, Activity, Danger zone.

| Item                                                                                                                                                                                               | Verdict                 | Evidence                                                                                                                                                   |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Visible org sections                                                                                                                                                                               | **Keep**                | All wired and used.                                                                                                                                        |
| `org_settings.email_to`, `email_reply_to`, `parking_owner_emails`, `sd_refund_cron_email_lead_minutes`, `sd_refund_cron_max_checkout_age_days`, `default_parking_rate_guest`, `automation_toggles` | **Remove** (DB + types) | No UI. `pickOrgSettingsFieldsFromRow` computes them but `resolveOrgSettings` / `serializeOrgSettingsForAdmin` only use socials, logo and origin.           |
| `org_settings.public_guest_app_origin`                                                                                                                                                             | **Keep for now**        | Fallback in `_shared/publicAppOrigin.ts` after the `PUBLIC_GUEST_APP_ORIGIN` env var. Remove later only if every env sets the var (check `/admin/health`). |

### 1.2 Property settings (`/org/:orgSlug/property/:propertySlug/settings`)

| Item                                                                                                                                   | Section           | Verdict            | Evidence / notes                                                                                                                                                                                                                                                                                                                                                                                                |
| -------------------------------------------------------------------------------------------------------------------------------------- | ----------------- | ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Parking owners** (`parking_owner_emails`)                                                                                            | Email automations | **Remove**         | Legacy BCC broadcast. `sendParkingBroadcast` (`_shared/emailService.ts:1006`) has zero callers. `parking-broadcast-email` already returns `410 PARKING_BROADCAST_RETIRED`. The field still renders, validates (`propertySettingsCompletion.ts:381`) and can block Save with a bad email.                                                                                                                        |
| `emailParkingBroadcast` automation toggle                                                                                              | (hidden)          | **Remove**         | In `PROPERTY_AUTOMATION_TOGGLE_KEYS` (server + UI) and `PLAN_GATED_AUTOMATION_TOGGLE_KEYS`, never rendered, never read by any send path.                                                                                                                                                                                                                                                                        |
| `sendParkingBroadcastEmail` transition option                                                                                          | n/a               | **Remove**         | No-op flag passed by `submit-sd-form`, `sd-refund-cron`, `import-revert`, `approvalEmailMatcher` and typed in `useTransitionBooking.ts:92`. The orchestrator never reads it.                                                                                                                                                                                                                                    |
| **Parking Request** email template (`email-parking-request`, preview slug `parking-broadcast`)                                         | Templates page    | **Remove**         | Only consumer is the dead `sendParkingBroadcast`. Hosts can still open and edit it, which implies it sends. Also remove the static `_shared/email-templates/parking-broadcast.html`, its `_preview` file, and both links in `email-templates/index.html`.                                                                                                                                                       |
| "Check-out timing & **defaults**" description says "…and default parking rate"                                                         | Email automations | **Fix**            | No parking rate field exists in this card. Copy is wrong.                                                                                                                                                                                                                                                                                                                                                       |
| SD refund email lead (hours)                                                                                                           | Email automations | **Clarify + Fix**  | Copy uses "SD" jargon. Server default is **180 min** (`appSettings.ts:443`, `orgSettings.ts:177`) while the cron header says **120**. Align on 120 (§ 3.3).                                                                                                                                                                                                                                                     |
| Days after checkout to stop guest emails                                                                                               | Email automations | **Clarify**        | Label says "guest emails" but it only gates the **check-out & deposit refund** email in `sd-refund-cron`. Review emails are not affected.                                                                                                                                                                                                                                                                       |
| Property email / Team email                                                                                                            | Email automations | **Clarify**        | Label differs by residence ("Property email" for Azure, "Team email" otherwise) for the same column (`email_reply_to`). Use one label. Keep `AZURE_PMO_EMAIL` and `defaultPmoEmail` — they are the server fallback and the super-admin default.                                                                                                                                                                 |
| Building admin (PMO) email                                                                                                             | Email automations | **Clarify**        | GAF and pet emails go to `emailTo` (development PMO email). Hosts cannot see it in this card. Add a read-only row. It must **not** create a validation error when empty.                                                                                                                                                                                                                                        |
| Automated sends modal                                                                                                                  | Email automations | **Fix**            | Footer button says **Save** but only closes. The real save is the page Save. Typo "reviwed". Triggers read like internal status names. Section badge suggests all 8 are paid; only 5 are plan-gated after removal.                                                                                                                                                                                              |
| Guest Form modal                                                                                                                       | Guest Form        | **Fix**            | Same fake **Save** button as Automated sends (only closes). Fix both in one change so the pattern is consistent.                                                                                                                                                                                                                                                                                                |
| **Complimentary own parking**                                                                                                          | Guest Form        | **Keep + Fix**     | Live (Phase 7). Same-org owner pin + this flag skips PayMongo through a ₱0 fulfill (`parkingPaymentOrchestrator.ts#fulfillComplimentaryOwnerParking`). Problems: (a) UI already disables the toggle when Allow Parking is off, but a stale saved `true` is still honored server-side; (b) the control shows even when the org has **no active parking**, so it does nothing; (c) copy "org's parking" is vague. |
| Preferred parking                                                                                                                      | Guest Form        | **Keep + Clarify** | Live. No help text; hosts don't know it powers **Use your parking** and the guest parking CTA deep link. Already hidden when the org has no active parking.                                                                                                                                                                                                                                                     |
| Cleaning Time                                                                                                                          | Guest Form        | **Fix (move)**     | It is a calendar availability rule, not a guest form option. Move it to Property Details next to check-in/check-out time. Same column, layout change only. Also remove it from the Guest Form summary line.                                                                                                                                                                                                     |
| Property **Parking rate** fee (`app_settings.default_parking_rate_guest`, Pricing page fee row)                                        | Pricing           | **Keep (D2)**      | Read by `ReviewPricingForm`, `ParkingRequestForm`, `get-pay-parking`, and the public property DTO. Legacy manual-parking pricing.                                                                                                                                                                                                                                                                               |
| Socials, brand color, Payment, Building Forms, Cancellation, Reviews & vouchers, Integrations, Location, Media, Amenities, House rules | various           | **Keep**           | All wired. Building Forms (GAF) residence coupling is owned by [`multi-residence-config-decoupling.md`](./multi-residence-config-decoupling.md).                                                                                                                                                                                                                                                                |

### 1.3 Parking settings (`/org/:orgSlug/parking/:parkingSlug/settings`)

| Item                                                                   | Verdict            | Evidence / notes                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| ---------------------------------------------------------------------- | ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Basic info, Photos, Location, Integrations, Activity, Danger zone      | **Keep**           | Wired.                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| Email toggles: Reservation request, Guest confirmed, No host available | **Keep + Clarify** | All three are read server-side (`parkingBroadcast.ts:385`, `parkingBroadcastActions.ts:126`, `parkingPaymentOrchestrator.ts:535`, `parkingBroadcastExpireCron.ts:119`). No recipient/trigger text. "No host available" reads like an error.                                                                                                                                                                                                          |
| Booking Automation (Auto-accept top match)                             | **Keep + Clarify** | Live (`submit-parking-booking-request:293`). A whole section for one toggle. Merge into one **Automations** section.                                                                                                                                                                                                                                                                                                                                 |
| **Payment** (payment methods, GCash QR, required for completion)       | **Remove (D1)**    | Guests pay through PayMongo (`create-parking-payment-checkout`). No guest/payout/verification path reads `parking_settings.payment_methods`. Removing it also removes the parking **setup-guide payments step**, the parking **OTP verification** entry point, parking payment completion/save rules, and the QR upload UI. The `parking-settings` PATCH keeps accepting legacy payment fields for one release so a cached PWA bundle does not fail. |

### 1.4 Legacy pay-parking code (no settings surface, same retirement)

| Item                                                                                              | Verdict               | Evidence                                                                                                                         |
| ------------------------------------------------------------------------------------------------- | --------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `PayParkingModal.tsx`, `useSaveParkingRateGuest.ts`                                               | **Remove**            | `PayParkingModal` has no importers; `useSaveParkingRateGuest` is imported only by that orphan.                                   |
| `PayParkingSections.tsx`, `PayParkingOwnerEmailDialog.tsx`, `PayParkingUpdateBroadcastDialog.tsx` | **Remove**            | No importers.                                                                                                                    |
| `submitPayParking()` in `pay-parking/lib/api.ts`                                                  | **Remove**            | No callers.                                                                                                                      |
| `submit-pay-parking` edge function                                                                | **Retire → 410**      | No UI caller; legacy links redirect.                                                                                             |
| `PayParkingPage` redirect + `get-pay-parking`                                                     | **Keep**              | Still redirects old `/properties/:slug/parking/:bookingId` links.                                                                |
| `parking-broadcast-email` (410 stub)                                                              | **Delete in Phase 6** | Remove dir, `config.toml` entry and `dashboardAssistantParity.ts` entry once logs show no hits.                                  |
| `bookings.parking_owner_email` column                                                             | **Keep (data)**       | Historical per-booking data. Stop writing it (orchestrator lines 670 to 671). Keep the column.                                   |
| `upload-parking-settings-asset` (QR upload)                                                       | **Defer**             | Only caller is the parking payment UI. Leave the function; mark for Phase 6 deletion with `settings-verification` parking scope. |

---

## 2. Phase 0: Pre-flight checks (read-only)

Record results here before Phase 6 (not required to start Phases 1 to 5).

1. **Data snapshot** (read-only):
   - `select count(*) from app_settings where coalesce(trim(parking_owner_emails),'') <> ''`
   - `select count(*) from app_settings where automation_toggles ? 'emailParkingBroadcast'`
   - `select count(*) from property_template_contents where template_key = 'email-parking-request'`
   - `select count(*) from parking_settings where jsonb_array_length(coalesce(payment_methods,'[]'::jsonb)) > 0`
   - `select count(*) from properties where (settings->>'complimentaryOwnerParking')::boolean and not coalesce((settings->>'allowParking')::boolean, false)` — rows hit by the § 4.1 bug.
   - `select count(*) from app_settings where sd_refund_cron_email_lead_minutes is null` — rows that change under D4.
2. **Grep gates.** Re-run: `sendParkingBroadcast(`, `submitPayParking(`, `PayParkingModal`, `parkingOwnerEmails`, `emailParkingBroadcast`, `sendParkingBroadcastEmail`, `email-parking-request`.
3. **Edge logs.** Last 30 days of `submit-pay-parking`, `parking-broadcast-email`, `upload-parking-settings-asset`. Any hits mean an old client still calls them; keep the 410 stubs longer.
4. **Assistant parity.** `dashboardAssistantParityTools.ts` reads `PROPERTY_AUTOMATION_TOGGLE_KEYS`, so the toggle drops out automatically. Remove the now-dead `PROPERTY_TOGGLE_LABELS.emailParkingBroadcast` entry.
5. Confirm the Phase 6 column drop list against `docs/architecture/data-model.md`.

---

## 3. Phase 1: Property Email automations

Files: `PropertyEmailAutomationsSection.tsx`, `PropertyEmailAutomationTogglePanel.tsx`, `org/lib/propertyEmailAutomation.ts`, `org/lib/propertyEmailAutomationDefaults.ts`, `org/lib/propertySettingsSave.ts`, `org/lib/propertySettingsCompletion.ts`, `bookings/hooks/useAppSettings.ts`, `_shared/appSettings.ts`, `_shared/app-settings/index.ts`.

### 3.1 Remove Parking owners

- Remove the input, `parking-owner-emails` field id, the `propertySettingsCompletion` validator, the dirty check and patch in `propertySettingsSave.ts`, and `parkingOwnerEmails` from `AppSettingsDto` / `AppSettingsFormValues`.
- **Edge case:** a property whose saved value is malformed must no longer block Save. Add a regression test.
- **PWA edge case:** server keeps accepting `parkingOwnerEmails` and ignores it for one release.

### 3.2 Recipients

- One label for `email_reply_to`: **Team email**. Help: "Gets new booking alerts and is the Reply-To on guest emails." Remove the Azure-only label variant but keep `AZURE_PMO_EMAIL` / `defaultPmoEmail`.
- Update `propertySettingsCompletion` error text from "Property email" / "Enter property email" to "Team email" / "Enter team email".
- Add a read-only row **Building admin email** showing `draft.emailTo`. Help: "GAF and pet requests go here. Set by your residence." If empty, "Not set" and a one-line hint that GAF and pet emails will not send. Never add a validation error for it.

### 3.3 Check-out email subsection (rename from "Check-out timing & defaults")

- Description: "When guests get the check-out and deposit refund email."
- **Send check-out email** · hours · suffix "hours before check-out". Help: "Guests get the check-out steps and the security deposit refund form this many hours before check-out."
- **Skip if check-out was over** · days · suffix "days ago". Help: "Skips the check-out email for old stays, for example after an import. 0 means never skip. Does not affect review emails."
- **D4:** change the default to 120 in `appSettings.ts` and `sd-refund-cron/index.ts`, keep `orgSettings.ts` in sync until Phase 6, and update UI placeholder + docs. Existing rows with a stored value do not change.

### 3.4 Automated sends → inline

- Remove the "8 of 8 enabled + Manage" modal and render the list inline. No popup, no Save button, no `useGuardedClose` needed.
- Group by recipient: **Your team** · **Building admin** · **Guest** · **Guest reviews**.
- Each row: label + one-line "When:". Rewrite triggers in plain language:
  - New booking alert: "When a guest submits the booking form."
  - GAF request: "When you approve a booking that needs building documents."
  - Pet request: "When you approve a booking that includes a pet."
  - Booking acknowledgement: "When you approve the booking." (fixes "reviwed")
  - Ready for check-in: "When all required documents are approved."
  - Check-out & deposit refund: "Before check-out, using the timing above."
  - Review request / reminder: shorter, same meaning.
- **Plan gating:** remove `TierBadge` from the section header. Put `TierBadge` only on the **5** gated rows (`emailGafRequest`, `emailBookingAcknowledgement`, `emailPetRequest`, `emailReadyForCheckin`, `emailSdRefundCheckout`). Keep the existing disabled-switch + upgrade behavior.
- Remove `emailParkingBroadcast` from both key lists, the defaults, `PLAN_GATED_AUTOMATION_TOGGLE_KEYS`, `PROPERTY_TOGGLE_LABELS`, `workflowTransitionEffectsCopy.ts`, and the three e2e harness payloads. `mergePropertyAutomationToggles` already ignores unknown keys, so stored JSON stays harmless.

### 3.5 Section header

- Description: "Who gets workflow emails and when." Keep anchor id `email-automations` (deep links, setup guide, `issueSectionIds`).

---

## 4. Phase 2: Complimentary own parking + Guest Form

### 4.1 Server fix (independent, low risk)

- `readComplimentaryOwnerParking(settings)` requires `allowParking === true` **and** `complimentaryOwnerParking === true`. Both callers (`submit-parking-booking-request:314`, `parkingPaymentOrchestrator.ts:305`) pick it up.
- Deno test matrix: parking off + flag on → false; both on → true; missing keys → false; non-boolean → false.
- **Edge cases:** already-fulfilled ₱0 bookings stay as is. An in-flight request when the host turns parking off falls back to `PENDING_PAYMENT` / PayMongo (the existing not-eligible catch path).
- Related read-only path: `resolveGuestParkingCtaAbsoluteUrl` suggests an own slot for any property booking. Gate it on `allowParking` so a property with parking off does not deep-link to a parking form. Callers: `parkingReminderCron`, `emailService`, `guestTrip`. Fall back to the stay-scoped marketplace URL.

### 4.2 UI

- Group **Allow Parking**, **Preferred parking**, **Complimentary own parking** under a Parking sub-heading in Guest Form.
- Show Preferred and Complimentary only when Allow Parking is on **and** the org has at least one active parking (`useParkings`). Otherwise show one short line linking to `/org/:orgSlug/parkings`.
- Copy:
  - Allow Parking → help "Parking requests on the booking form."
  - Complimentary → **Free parking on your own slots**. Help: "Guests from this property who book one of your parking slots don't pay for it. Other hosts' slots are still paid."
  - Preferred → help "The slot we suggest first when you use Use your parking or share a parking link."
- Turning Allow Parking off keeps the stored complimentary value. The server fix makes it inert. Turning parking back on restores the host's choice.
- Summary chip: "Free own parking" instead of "Complimentary parking". Drop Cleaning Time from the summary line.
- Fix the Guest Form modal footer button from **Save** to **Done**.

### 4.3 Move Cleaning Time

- Move the field from Guest Form to Property Details, beside Check-in and Check-out time.
- Rename field id to `property-cleaning-buffer` and map it to section `details` in `propertySettingsSave.ts` `FIELD_SECTION_MAP` and completion. Update `propertySettingsSave.ts` dirty-id logic.
- Guest Form description becomes "Optional requests guests can add: pets, parking, decor."

---

## 5. Phase 3: Parking settings

- Merge **Email** and **Booking Automation** into one **Automations** section (`id="automations"`). Add `#email` and `#booking-automation` as scroll aliases so old links and the setup guide still work.
- Each toggle gets a recipient + trigger line:
  - Reservation request: "You · when a guest asks to book this slot."
  - Guest confirmed: "Guest · when their parking is confirmed and paid."
  - No host available: "Guest · when no slot could be matched in time."
  - Auto-accept top match: "Accepts the best request automatically. The guest still pays before it's confirmed."
- **Remove Payment (D1):**
  - Delete the `payment` section, nav item, `Wallet` icon import, `PropertyPaymentMethodsSection` usage, `parkingPaymentSettingsDto`, `SensitiveSettingsOtpDialog` usage, QR upload handler and `useUploadParkingSettingsAsset`.
  - Delete `ParkingOperationalDraft` and `parkingOperationalDraftFromSettings` / `parkingOperationalDraftIsDirty`.
  - Remove `payment` from `ParkingSettingsSectionId`, completion, `ParkingSettingsDirtyFlags`, `planParkingSettingsSave`, and `SETUP_GUIDE_PARKING_SAVE_SCOPE`.
  - Remove the parking **payments** step from `setupGuideSteps.ts`, `setupGuideTypes.ts`, `SetupGuideStepBody`, `SetupGuideStepSkeleton`, `useSetupGuideListingCompletions`, and its tests.
  - Keep the `parking-settings` PATCH payment handling and `upload-parking-settings-asset` server-side for one release. Legacy rows keep their stored `payment_methods`; nothing reads them.
  - **Activity log:** settings saves already emit existing events. The removed section is not a new mutation. Note `activity-log: N/A — removal only`.

---

## 6. Phase 4: Server + dead code removal

Server:

- `app-settings/index.ts`: stop accepting `parkingOwnerEmails` (ignore silently for one release).
- `_shared/appSettings.ts`: drop `parking_owner_emails` from the row type, `parkingOwnerEmails` from `AppSettingsResolved`, `fieldSources` and picks.
- `settingsPatchPermissions.ts`: remove `parkingOwnerEmails`.
- `propertySettingsCloneGroups.ts`: remove `parking_owner_emails` from `EMAIL_RECIPIENT_COLUMNS`.
- `emailService.ts`: delete `sendParkingBroadcast`. Keep `buildBookingVehicleCopySectionHtml` only if `{{booking_vehicle_copy}}` is used by another template (it is still selectable in `propertyTemplateEmailSections.ts`; keep the helper and the placeholder).
- `propertyTemplates.ts`: remove the `email-parking-request` builtin. Unknown stored rows are already ignored by `serializePropertyTemplatesForAdmin`; add a regression test.
- `workflowOrchestrator.ts`: remove the `sendParkingBroadcastEmail` option and its 4 call-site args. Stop writing `parking_owner_email`.
- `orgSettings.ts`: trim `OrgSettingsRow` and `pickOrgSettingsFieldsFromRow` to the fields actually used.
- `submit-pay-parking`: replace with a 410 stub mirroring `parking-broadcast-email`.
- `dashboardAssistantParity.ts` / `dashboardAssistantParityTools.ts`: remove retired entries and the dead toggle label.

UI:

- Delete the orphan pay-parking files and `submitPayParking`.
- Remove `sendParkingBroadcastEmail` from `useTransitionBooking.ts`.
- Remove `emailParkingBroadcast` from the UI automation key list and `workflowTransitionEffectsCopy.ts`.

Each removal is a separate commit so a revert is clean.

---

## 7. Phase 5: Tests

Vitest (colocated, Node env; no `.test.tsx` component tests):

- `propertySettingsSave.test.ts`: no `parkingOwnerEmails` in the patch; malformed legacy value does not block save; `property-cleaning-buffer` maps to `details`.
- `propertySettingsCompletion.test.ts`: no parking-owner error path; empty Building admin email is not an error.
- `propertyEmailAutomation.test.ts`: 8 keys; 5 plan-gated; `automationTogglesEqual` ignores a stray stored `emailParkingBroadcast`.
- `parkingSettingsSavePlan.test.ts` / `parkingSettingsCompletion.test.ts`: no `payment` section; automation-only save still works.
- `setupGuideSteps.test.ts`: no `parking.payments` step; step count/completion assertions updated.
- `edgeCalendars`/date helpers: no change expected.

Deno (`_shared/*_test.ts`):

- `ownerDefaultParking_test.ts`: complimentary matrix.
- `propertyAutomationToggles_test.ts`: merge ignores the removed key; plan-gated list has 5 keys.
- `appSettings` serialize test: DTO has no `parkingOwnerEmails`; lead default is 120.
- `propertyTemplates` test: removed builtin with a stored row is ignored, list does not crash.
- Orchestrator suites stay green with the option removed.

Playwright mocked E2E (`ui/e2e/features/`):

- Property settings: Email automations renders without Parking owners; Building admin row shows; toggles are inline and save through the page Save; unsaved-changes guard fires on toggle edits.
- Guest Form: complimentary hidden with no parkings, visible with one; Cleaning Time now under Property Details.
- Parking settings: single Automations section; `#email` hash still scrolls there; no Payment section or nav item.
- Update `contextualHelp.spec.ts` if help copy is asserted.

Manual on local stack:

- Full booking loop `PENDING_REVIEW` → `COMPLETED` with GAF + pet + parking interest. All emails still send; none goes to old parking owner addresses.
- Same-org owner parking request with complimentary on → ₱0 fulfill. With Allow Parking off → PayMongo path.
- `sd-refund-cron` scoped run with the new default on a `null` lead row.
- 375 / 768 / 1024 px for all three settings pages.

Gates: `bun run ci:quality`, `check:filenames`, `check:support-content`, `check:ai-knowledge-coverage`, `test:edge`.

---

## 8. Phase 6: Contract (schema) — deferred, needs soak + `kamewave`

New migration (never edit shipped ones). **Not written in this change.**

- `alter table app_settings drop column parking_owner_emails;`
- `update app_settings set automation_toggles = automation_toggles - 'emailParkingBroadcast';`
- `alter table org_settings drop column email_to, email_reply_to, parking_owner_emails, sd_refund_cron_email_lead_minutes, sd_refund_cron_max_checkout_age_days, default_parking_rate_guest, automation_toggles;`
- `delete from property_template_contents where template_key = 'email-parking-request';`
- `alter table parking_settings drop column payment_methods;` (plus legacy gcash columns if unused)
- Drop `upload-parking-settings-asset` and the parking branch of `settings-verification` if logs show no traffic.
- Update the table comment in `20261316122100_email_suppressions_comment_scope.sql` via a new `comment on table`.
- Check views, RPCs, `select *` consumers, and the `assistantParityLocal` / `assistantParityLiveGemini` integration tests.
- Back up before deploy. Production deploy needs **`kamewave`**.

---

## 9. Docs, rules, support (same change as each phase)

- `docs/guides/routes/org/property/settings.md`: Email automations, Guest Form, Property Details; remove the Parking owners row; document Cleaning Time's new home.
- `docs/guides/routes/org/parking/settings.md`: Automations section, no Payment section, fix the false "payment flows to your public parking page" claim, update completion rules.
- `docs/guides/routes/bookings/parking.md`: complimentary wording.
- `docs/guides/routes/org/property/templates.md`: remove `email-parking-request`.
- `docs/PROJECT.md`, `docs/architecture/overview.md`, `docs/architecture/data-model.md`, `docs/architecture/plans-feature-matrix.md`: settings inventory, removed toggles/templates.
- `.cursor/rules/booking-workflow.mdc` + parking workflow rule: remove `sendParkingBroadcastEmail`; note the complimentary gate requires Allow Parking.
- `docs/archive/operations/migration-runbook.md`: Phase 6 migration.
- Support: Host-facing knowledge Q&A + `docs/guides/support/faqs.md` for "Where do GAF emails go?", "What does free parking on your own slots do?", "Why did Parking owners disappear?", "Why is there no Parking payment section?".
- `human-copy` pass on every new string (no em dashes).

## 10. Cross-cutting checklist

- **Plans/RBAC:** no new feature. Existing `settings.emailAutomations:edit` and `settings.guestForm:edit` stay. Remove only the `parkingOwnerEmails` mapping. Per-row tier badges reuse `automatedBookingFlow`.
- **activity-log:** settings saves already emit existing events; removed fields drop out of diffs. Parking payment removal is removal only. `activity-log: N/A` for new emissions.
- **Unsaved changes:** page-level guard already covers both cards. Re-verify after moving Cleaning Time between sections.
- **Mobile:** inline toggles keep 44px rows. Parking section merge keeps normal section scrolling; no new modal.
- **PWA:** old cached bundles may still send `parkingOwnerEmails` and payment fields for one release. The server ignores/accepts them.

## 11. Rollout order (this change)

1. Phase 0 checks where cheap; decisions locked.
2. Phase 2 § 4.1 server fix (independent, low risk).
3. Phases 1 to 3 (UI + copy) with docs.
4. Phase 4 dead-code removal.
5. Phase 5 tests + gates.
6. One release soak, then Phase 6 contract migration with `kamewave`.

## 12. Known risks / edge cases

| Risk                                                                                     | Mitigation                                                                                                    |
| ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Removing parking payment drops the only `sensitive settings` path for parking            | Leave server endpoints in place; only the UI goes. Legacy `payment_methods` rows stay readable by nothing.    |
| Setup guide completion now reports a stale `payment` section                             | Remove the step + completion section in the same commit; update `setupGuideSteps.test.ts`.                    |
| Dropping `TierBadge` from the section header hides the plan requirement                  | Per-row badges on the 5 gated rows + disabled switch + upgrade modal.                                         |
| A stale `complimentaryOwnerParking: true` with `allowParking: false` now skips payment   | Server helper requires both. Test covers it. Already-paid bookings are untouched.                             |
| Old PWA bundle PATCHes removed fields                                                    | Server ignores `parkingOwnerEmails`; parking payment PATCH still accepted.                                    |
| Cleaning Time field id appears in existing saved `field-to-section` maps / red-dot logic | Rename once, update map + completion + tests; no stored data key changes (column is `cleaningBufferMinutes`). |
| Template removal with an existing stored row                                             | `serializePropertyTemplatesForAdmin` already ignores non-builtin, non-custom rows. Add a test.                |
| `defaultPmoEmail` removal would break the Azure PMO fallback                             | Keep the constant and the `defaultPmoEmail` field; only the label variant is unified.                         |
