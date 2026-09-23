---
title: 'Comprehensive unit test coverage for all pages and features'
status: done
tags: [testing, vitest, unit-tests, coverage]
updated: 2026-09-23
stage: done
kind: plan
---

# Comprehensive unit test coverage for all pages and features

## Shipped (2026-09-23)

| Track                         | Result                                                                                                                                                                               |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Colocated lib/utils tests** | **627** Vitest files; `node scripts/dev/lib-unit-test-inventory.mjs` → **0 missing**                                                                                                 |
| **Vitest**                    | `bun run test` — **621** passed, **6** skipped (types-only + Polotno browser)                                                                                                        |
| **Type-check**                | Green with colocated tests                                                                                                                                                           |
| **P0 depth**                  | Drift tests (team catalogs), workflow/booking/plan hand-written cases (`bookingStatus`, `bookingProgressEditPayload`, `totalGuestBalance`, `propertyPermissions`, `planFeatures`, …) |
| **Export organization**       | `enrich-lib-unit-tests.mjs` groups per-export describes; `lib-behavioral-coverage-audit.mjs` tracks incremental depth                                                                |
| **`ui/src/hooks/`**           | **N/A** for Vitest Node — layout/auth covered by Playwright `@smoke` / `@ci`                                                                                                         |
| **Page UI**                   | Playwright (48 specs); not duplicated in Vitest                                                                                                                                      |
| **Route guides**              | Existing per-route **Testing** sections + [`docs/guides/testing/README.md`](../../guides/testing/README.md) pyramid                                                                  |

**Follow-up (optional):** deepen export-only tests flagged by `lib-behavioral-coverage-audit.mjs` using the session tables below.

## Goal

Achieve near-100% unit test coverage across every page, section, element, and business-logic file in the application. Every lib file, utility, helper, validator, schema, formatter, state machine mirror, filter, sort, and display function gets a colocated `.test.ts`. Every page and component with non-trivial logic gets tested. This plan covers both public (guest/marketing) and dashboard (host/admin) surfaces.

## Scope

### In

- Colocated Vitest unit tests (`*.test.ts`) for every `lib/*.ts` file across all feature modules
- Unit tests for all shared `ui/src/lib/` utilities (dates, charts, chat, media, PDF, theme, validation, PWA, security, table, feedback, posthog)
- Unit tests for all shared `ui/src/utils/` files (currency, dates, formatters, helpers)
- Unit tests for all shared `ui/src/hooks/` with testable logic (debounce timers, display mode, media query, online status, throttle)
- Schema/validation tests for every Zod schema and form validator
- Logic tests for every filter, sort, search, and display function
- State management / store logic tests
- API response shape validators where client mirrors server types
- Feature gate, permission gate, and plan gate decision functions
- Route path builders and navigation helpers

### Out

- React component rendering / DOM tests (no Testing Library / jsdom needed; that is E2E territory)
- CSS / Tailwind class assertions
- shadcn `ui/src/components/ui/` primitives
- E2E / Playwright tests (already covered by the sitewide testing plan)
- Deno edge function tests (already covered)
- Visual regression / screenshot tests
- Tests that require a browser, DOM, or React rendering context

## Approach

### File convention

Every testable `foo.ts` gets a `foo.test.ts` next to it. Tests run in Vitest Node environment (no DOM). If a file exports only types or React components with no extractable logic, mark it `/* test: N/A — types-only */` or `/* test: N/A — component, no extractable logic */` in this plan.

### Organization

Tests are organized by feature module, matching the existing directory structure. Each batch session focuses on one feature domain. The plan below lists every file that needs a test, grouped by domain, with specific test cases for each.

### Priority tiers

| Tier            | Criteria                                                       | Target        |
| --------------- | -------------------------------------------------------------- | ------------- |
| **P0 Critical** | Money, booking status, permissions, auth, plan gates, workflow | Session 1-3   |
| **P1 High**     | Form validation, search, calendar, settings save, imports      | Session 4-6   |
| **P2 Medium**   | Display helpers, formatters, sort/filter, analytics, marketing | Session 7-10  |
| **P3 Low**      | Navigation paths, mock data, copy strings, motion configs      | Session 11-13 |

### Session management

- Each session: one feature domain, ~20-40 test files
- Run `bun run test` after each batch to confirm green
- Run `bun run ci:quality` at session boundaries
- Do not start next domain until current domain is green

---

## Inventory: current state

### Existing unit tests (34 files, keep and extend)

| Test file                                                        | Status     |
| ---------------------------------------------------------------- | ---------- |
| `dashboard/bookings/lib/workflow.test.ts`                        | **exists** |
| `dashboard/bookings/lib/bookingWorkflowEmail.test.ts`            | **exists** |
| `dashboard/bookings/lib/workflowEmailManualSendCooldown.test.ts` | **exists** |
| `dashboard/bookings/lib/workflowEmailSendPrerequisites.test.ts`  | **exists** |
| `dashboard/bookings/lib/workflowEmailTriggerTooltip.test.ts`     | **exists** |
| `dashboard/bookings/lib/workflowSensitiveGuestDiff.test.ts`      | **exists** |
| `dashboard/bookings/lib/pendingDocStatusGroups.test.ts`          | **exists** |
| `dashboard/analytics/lib/guestOriginsDisplay.test.ts`            | **exists** |
| `dashboard/analytics/lib/analyticsDistributionRange.test.ts`     | **exists** |
| `dashboard/analytics/lib/channelLabels.test.ts`                  | **exists** |
| `dashboard/marketing/lib/marketingGenerationComposer.test.ts`    | **exists** |
| `dashboard/marketing/lib/marketingGenerationPricing.test.ts`     | **exists** |
| `dashboard/marketing/lib/marketingGenerationProgress.test.ts`    | **exists** |
| `dashboard/marketing/lib/collage/collageDocument.test.ts`        | **exists** |
| `dashboard/marketing/lib/collage/coverCrop.test.ts`              | **exists** |
| `dashboard/org/lib/copyPropertySettingsGroups.test.ts`           | **exists** |
| `dashboard/org/lib/listingContractRenewalSession.test.ts`        | **exists** |
| `dashboard/plans/lib/planPresentation.test.ts`                   | **exists** |
| `dashboard/setup-guide/lib/setupGuideSteps.test.ts`              | **exists** |
| `dashboard/team/lib/orgTeamCatalogDrift.test.ts`                 | **exists** |
| `dashboard/team/lib/permissionExpansionDrift.test.ts`            | **exists** |
| `dashboard/team/lib/propertyTeamCatalogDrift.test.ts`            | **exists** |
| `guest/form/lib/guestFormSteps.test.ts`                          | **exists** |
| `guest/form/lib/guestBookingAccess.test.ts`                      | **exists** |
| `guest/auth/lib/otpRequestGate.test.ts`                          | **exists** |
| `guest/sd-form/lib/voucherRevealWheel.test.ts`                   | **exists** |
| `guest/search/lib/searchIntents.test.ts`                         | **exists** |
| `guest/lib/guestPublicPaths.test.ts`                             | **exists** |
| `lib/posthog/sanitize.test.ts`                                   | **exists** |
| `lib/posthog/capture.test.ts`                                    | **exists** |
| `lib/posthog/catalog.test.ts`                                    | **exists** |
| `lib/posthog/client.test.ts`                                     | **exists** |
| `lib/platformAppName.test.ts`                                    | **exists** |
| `lib/feedback/toastMessages.test.ts`                             | **exists** |

---

## Detailed task breakdown by domain

### Session 1: Shared utilities and core lib (P0/P1)

**`ui/src/lib/` — 28 new test files**

| #   | File                                     | Test file to create                           | Test cases                                                                                 |
| --- | ---------------------------------------- | --------------------------------------------- | ------------------------------------------------------------------------------------------ |
| 1   | `lib/utils.ts`                           | `lib/utils.test.ts`                           | `cn()` merges classes correctly; handles undefined/null; deduplicates conflicting Tailwind |
| 2   | `lib/entityInitials.ts`                  | `lib/entityInitials.test.ts`                  | Single name, multi-word name, empty string, special chars, unicode                         |
| 3   | `lib/pageTitle.ts`                       | `lib/pageTitle.test.ts`                       | Format with prefix, undefined returns fallback, org/property scoping                       |
| 4   | `lib/favicon.ts`                         | `lib/favicon.test.ts`                         | Logo URL → padded favicon URL, undefined → default                                         |
| 5   | `lib/platformBranding.ts`                | `lib/platformBranding.test.ts`                | Returns VITE_PLATFORM_APP_NAME, fallback when unset                                        |
| 6   | `lib/sanitizeHtml.ts`                    | `lib/sanitizeHtml.test.ts`                    | Strips scripts, preserves safe tags, handles empty, XSS vectors                            |
| 7   | `lib/availabilityCheckState.ts`          | `lib/availabilityCheckState.test.ts`          | State transitions, loading/success/error, overlap detection                                |
| 8   | `lib/cleaningBuffer.ts`                  | `lib/cleaningBuffer.test.ts`                  | Buffer day calculation, zero buffer, adjacent bookings                                     |
| 9   | `lib/statusToneColors.ts`                | `lib/statusToneColors.test.ts`                | Every status → correct color mapping, unknown status fallback                              |
| 10  | `lib/date/manilaPeriod.ts`               | `lib/date/manilaPeriod.test.ts`               | Manila timezone period boundaries, start/end of day, DST edge                              |
| 11  | `lib/date/navigation.ts`                 | `lib/date/navigation.test.ts`                 | Next/prev period, month boundaries, year rollover                                          |
| 12  | `lib/charts/chartPalette.ts`             | `lib/charts/chartPalette.test.ts`             | Palette generation, N colors, distinct hues                                                |
| 13  | `lib/charts/chartStyles.ts`              | `lib/charts/chartStyles.test.ts`              | Style object shape, responsive config                                                      |
| 14  | `lib/table/pagination.ts`                | `lib/table/pagination.test.ts`                | Page count, offset calc, boundary pages, total=0                                           |
| 15  | `lib/validation/fieldValidation.ts`      | `lib/validation/fieldValidation.test.ts`      | Required, min/max length, email, phone, regex patterns                                     |
| 16  | `lib/validation/adminSettings.ts`        | `lib/validation/adminSettings.test.ts`        | Admin settings schema: valid/invalid payloads                                              |
| 17  | `lib/validation/reservedDisplayNames.ts` | `lib/validation/reservedDisplayNames.test.ts` | Reserved names rejected, normal names pass, case insensitive                               |
| 18  | `lib/theme/colorConvert.ts`              | `lib/theme/colorConvert.test.ts`              | Hex→HSL, RGB→Hex, invalid input handling                                                   |
| 19  | `lib/theme/hsvColor.ts`                  | `lib/theme/hsvColor.test.ts`                  | HSV conversions, boundary values (0, 360, 100%)                                            |
| 20  | `lib/theme/brandColor.ts`                | `lib/theme/brandColor.test.ts`                | Brand color generation from base, contrast check                                           |
| 21  | `lib/theme/brandColorPresets.ts`         | `lib/theme/brandColorPresets.test.ts`         | Preset list completeness, each preset is valid                                             |
| 22  | `lib/theme/photoBrandColor.ts`           | `lib/theme/photoBrandColor.test.ts`           | Dominant color extraction mock, fallback                                                   |
| 23  | `lib/theme/applyBrandCssVariables.ts`    | `lib/theme/applyBrandCssVariables.test.ts`    | CSS variable map from brand color, dark mode variant                                       |
| 24  | `lib/security/antiSpamRequest.ts`        | `lib/security/antiSpamRequest.test.ts`        | Honeypot field generation, timing token                                                    |
| 25  | `lib/security/antiSpamResponse.ts`       | `lib/security/antiSpamResponse.test.ts`       | Validate timing, honeypot check, pass/fail                                                 |
| 26  | `lib/media/uploadLimits.ts`              | `lib/media/uploadLimits.test.ts`              | File size limits by type, dimension limits, format check                                   |
| 27  | `lib/media/imageOptimization.ts`         | `lib/media/imageOptimization.test.ts`         | Optimization config per surface, quality settings                                          |
| 28  | `lib/media/optimizationSurfaces.ts`      | `lib/media/optimizationSurfaces.test.ts`      | Surface registry, each surface has valid config                                            |

**`ui/src/utils/` — 5 new test files**

| #   | File                                 | Test file to create                       | Test cases                                                            |
| --- | ------------------------------------ | ----------------------------------------- | --------------------------------------------------------------------- |
| 29  | `utils/format/currency.ts`           | `utils/format/currency.test.ts`           | PHP/USD format, zero, negative, large numbers, decimal places         |
| 30  | `utils/format/dates.ts`              | `utils/format/dates.test.ts`              | MM-DD-YYYY ↔ YYYY-MM-DD, Manila TZ, relative dates, null/invalid      |
| 31  | `utils/format/bookingDisplay.ts`     | `utils/format/bookingDisplay.test.ts`     | Guest name display, date range label, nights count, status badge text |
| 32  | `utils/format/parkingStayDisplay.ts` | `utils/format/parkingStayDisplay.test.ts` | Parking duration display, slot label, status                          |
| 33  | `utils/text/formatters.ts`           | `utils/text/formatters.test.ts`           | Pluralize, truncate, capitalize, title case                           |
| 34  | `utils/text/helpers.ts`              | `utils/text/helpers.test.ts`              | Slug generation, sanitize, strip HTML, word count                     |

**`ui/src/lib/` additional modules — 13 new test files**

| #   | File                                | Test file to create                      | Test cases                                              |
| --- | ----------------------------------- | ---------------------------------------- | ------------------------------------------------------- |
| 35  | `lib/chat/chatMessageFormat.ts`     | `lib/chat/chatMessageFormat.test.ts`     | Text → rich blocks, mention parse, link detect, emoji   |
| 36  | `lib/chat/chatReplyStatus.ts`       | `lib/chat/chatReplyStatus.test.ts`       | Reply state transitions, seen/delivered/sent            |
| 37  | `lib/chat/chatThreadSearch.ts`      | `lib/chat/chatThreadSearch.test.ts`      | Search query match, fuzzy, highlight positions          |
| 38  | `lib/chat/parseChatRichBlocks.ts`   | `lib/chat/parseChatRichBlocks.test.ts`   | Parse blocks from raw message, handle empty, nested     |
| 39  | `lib/chat/chatAttachments.ts`       | `lib/chat/chatAttachments.test.ts`       | Attachment type detection, size validation, preview URL |
| 40  | `lib/parking/parkingFlowCopy.ts`    | `lib/parking/parkingFlowCopy.test.ts`    | Copy strings per flow state, plural guests              |
| 41  | `lib/pdf/pdfFormatters.ts`          | `lib/pdf/pdfFormatters.test.ts`          | Currency format for PDF, date format, percentage        |
| 42  | `lib/pdf/pdfFinanceTotals.ts`       | `lib/pdf/pdfFinanceTotals.test.ts`       | Sum rows, subtotals, tax calc, rounding                 |
| 43  | `lib/pdf/pdfScopeLabel.ts`          | `lib/pdf/pdfScopeLabel.test.ts`          | Org/property/parking scope → label                      |
| 44  | `lib/pdf/pdfStatusColors.ts`        | `lib/pdf/pdfStatusColors.test.ts`        | Each status → color, unknown fallback                   |
| 45  | `lib/constants/formPlaceholders.ts` | `lib/constants/formPlaceholders.test.ts` | All fields have placeholder, no empty strings           |
| 46  | `lib/google-maps/locationLabel.ts`  | `lib/google-maps/locationLabel.test.ts`  | Place → short label, city extraction, country code      |
| 47  | `lib/pwa/offlineQueryAllowlist.ts`  | `lib/pwa/offlineQueryAllowlist.test.ts`  | Allowlisted keys pass, unknown blocked, wildcard        |

**Session 1 total: 47 new test files**

---

### Session 2: Booking workflow and email (P0)

**`dashboard/bookings/lib/` — 39 new test files** (6 already exist)

| #   | File                                  | Test file to create                        | Test cases                                                       |
| --- | ------------------------------------- | ------------------------------------------ | ---------------------------------------------------------------- |
| 1   | `bookingStatus.ts`                    | `bookingStatus.test.ts`                    | Status badge color, label, icon per status; unknown status       |
| 2   | `bookingStages.ts`                    | `bookingStages.test.ts`                    | Stage index, active stage, completed stages per status           |
| 3   | `bookingFlags.ts`                     | `bookingFlags.test.ts`                     | isAirbnb, isPet, isGaf, combined flags, edge cases               |
| 4   | `bookingFinance.ts`                   | `bookingFinance.test.ts`                   | Total calc, SD amount, balance, partial payments, refund amounts |
| 5   | `bookingListDisplay.ts`               | `bookingListDisplay.test.ts`               | Card data mapping, guest name, date range, nights                |
| 6   | `bookingListNavigation.ts`            | `bookingListNavigation.test.ts`            | Next/prev booking in list, wrap around, empty list               |
| 7   | `bookingsListSort.ts`                 | `bookingsListSort.test.ts`                 | Sort by check-in, name, status, created; ascending/descending    |
| 8   | `bookingsSortOptions.ts`              | `bookingsSortOptions.test.ts`              | Option list completeness, default sort, label text               |
| 9   | `bookingsStatusFilter.ts`             | `bookingsStatusFilter.test.ts`             | All status filter options, multi-select, "all" clears others     |
| 10  | `bookingDetailActions.ts`             | `bookingDetailActions.test.ts`             | Available actions per status, disabled conditions, labels        |
| 11  | `bookingProgressEditPayload.ts`       | `bookingProgressEditPayload.test.ts`       | Payload shape per edit type, required fields                     |
| 12  | `bookingPastPipelineManila.ts`        | `bookingPastPipelineManila.test.ts`        | Past detection in Manila TZ, checkout date boundary              |
| 13  | `bookingAssetClearPatch.ts`           | `bookingAssetClearPatch.test.ts`           | Clear GAF, pet doc, receipt; preserve other fields               |
| 14  | `bookingAiDocumentLinks.ts`           | `bookingAiDocumentLinks.test.ts`           | Link generation for AI review documents                          |
| 15  | `bookingAiReviewProgress.ts`          | `bookingAiReviewProgress.test.ts`          | Progress stages, completion percentage                           |
| 16  | `bookingAiValidations.ts`             | `bookingAiValidations.test.ts`             | AI validation results mapping, confidence threshold              |
| 17  | `documentRequirements.ts`             | `documentRequirements.test.ts`             | Required docs per property config, GAF/pet/parking combos        |
| 18  | `gafDefaults.ts`                      | `gafDefaults.test.ts`                      | Default GAF fields, prefill from booking data                    |
| 19  | `petDefaults.ts`                      | `petDefaults.test.ts`                      | Default pet fields, multiple pets                                |
| 20  | `pendingDocApproval.ts`               | `pendingDocApproval.test.ts`               | Approval state, can approve/reject, all docs approved            |
| 21  | `listView.ts`                         | `listView.test.ts`                         | View mode toggle, persist preference                             |
| 22  | `resolveBookingViewTab.ts`            | `resolveBookingViewTab.test.ts`            | Tab from URL, default tab per status                             |
| 23  | `moneyFieldSchema.ts`                 | `moneyFieldSchema.test.ts`                 | Zod schema: valid amounts, negative rejected, max, decimals      |
| 24  | `unitTypes.ts`                        | `unitTypes.test.ts`                        | Unit type labels, icons, filterable list                         |
| 25  | `totalGuestBalance.ts`                | `totalGuestBalance.test.ts`                | Balance calculation, overpayment, zero, multi-payment            |
| 26  | `storageUrls.ts`                      | `storageUrls.test.ts`                      | URL construction for booking assets, signed URL params           |
| 27  | `workflowAdvanceMode.ts`              | `workflowAdvanceMode.test.ts`              | Auto vs manual advance, conditions per status                    |
| 28  | `workflowPlanSkip.ts`                 | `workflowPlanSkip.test.ts`                 | Plan skip list, free plan skips, grandfathered                   |
| 29  | `workflowStageDeck.ts`                | `workflowStageDeck.test.ts`                | Stage deck cards per status, card ordering                       |
| 30  | `workflowActionButtonStyles.ts`       | `workflowActionButtonStyles.test.ts`       | Button variant per action, disabled styles                       |
| 31  | `workflowTransitionEffectsCopy.ts`    | `workflowTransitionEffectsCopy.test.ts`    | Copy text per transition, side effect descriptions               |
| 32  | `workflowTransitionEmailControls.ts`  | `workflowTransitionEmailControls.test.ts`  | Email checkbox state per transition, required/optional           |
| 33  | `workflowEmailTriggerAvailability.ts` | `workflowEmailTriggerAvailability.test.ts` | Trigger availability per status, missing data                    |
| 34  | `importCommitStatus.ts`               | `importCommitStatus.test.ts`               | Import commit stages, error states                               |
| 35  | `adminBottomNav.ts`                   | `adminBottomNav.test.ts`                   | Nav items per context, active state, badge counts                |
| 36  | `adminSidebarNav.ts`                  | `adminSidebarNav.test.ts`                  | Sidebar items per role, collapsed/expanded                       |
| 37  | `adminGuestSlots.ts`                  | `adminGuestSlots.test.ts`                  | Guest slot allocation, max guests, overflow                      |
| 38  | `navActive.ts`                        | `navActive.test.ts`                        | Active nav detection from pathname, nested routes                |
| 39  | `adminPageTransitionKey.ts`           | `adminPageTransitionKey.test.ts`           | Key generation per route, cache bust on property change          |

**Templates and Telegram — 14 new test files**

| #   | File                                   | Test file to create                         | Test cases                                              |
| --- | -------------------------------------- | ------------------------------------------- | ------------------------------------------------------- |
| 40  | `templatePlaceholderCatalog.ts`        | `templatePlaceholderCatalog.test.ts`        | All placeholders listed, no duplicates, category groups |
| 41  | `templatePlaceholderHighlight.ts`      | `templatePlaceholderHighlight.test.ts`      | Highlight positions in HTML, nested placeholders        |
| 42  | `templatePreviewReadonly.ts`           | `templatePreviewReadonly.test.ts`           | Preview mode strips edit controls                       |
| 43  | `propertyTemplatePlaceholders.ts`      | `propertyTemplatePlaceholders.test.ts`      | Property-scoped placeholders, merge with global         |
| 44  | `propertyTemplateSections.ts`          | `propertyTemplateSections.test.ts`          | Section ordering, required sections                     |
| 45  | `normalizeBlockLevelPlaceholders.ts`   | `normalizeBlockLevelPlaceholders.test.ts`   | Block placeholder normalization, HTML wrapping          |
| 46  | `normalizeEmailCalloutPlaceholders.ts` | `normalizeEmailCalloutPlaceholders.test.ts` | Callout placeholder inject/remove                       |
| 47  | `gafPdfPreview.ts`                     | `gafPdfPreview.test.ts`                     | GAF PDF data mapping, missing fields                    |
| 48  | `gafPdfSignature.ts`                   | `gafPdfSignature.test.ts`                   | Signature data URL validation, fallback                 |
| 49  | `petPdfPreview.ts`                     | `petPdfPreview.test.ts`                     | Pet PDF data mapping                                    |
| 50  | `petPdfSignature.ts`                   | `petPdfSignature.test.ts`                   | Pet signature handling                                  |
| 51  | `telegramConnectionLabels.ts`          | `telegramConnectionLabels.test.ts`          | Connection status labels, error labels                  |
| 52  | `telegramNotificationDefaults.ts`      | `telegramNotificationDefaults.test.ts`      | Default notification settings per event                 |
| 53  | `telegramPlaceholderGroups.ts`         | `telegramPlaceholderGroups.test.ts`         | Placeholder groups, insertion                           |

**Session 2 total: 53 new test files**

---

### Session 3: Team permissions and plans (P0)

**`dashboard/team/lib/` — 27 new test files** (3 already exist)

| #   | File                              | Test file to create                    | Test cases                                               |
| --- | --------------------------------- | -------------------------------------- | -------------------------------------------------------- |
| 1   | `propertyPermissions.ts`          | `propertyPermissions.test.ts`          | All leaves resolve, read/write/admin tiers, unknown leaf |
| 2   | `propertyTeamConstants.ts`        | `propertyTeamConstants.test.ts`        | Constants match server expectations, no missing roles    |
| 3   | `propertyTeamRoles.ts`            | `propertyTeamRoles.test.ts`            | Role → permission set, custom role creation              |
| 4   | `propertyTeamTemplates.ts`        | `propertyTeamTemplates.test.ts`        | Template completeness, all leaves covered                |
| 5   | `propertyPermissionCatalog.ts`    | `propertyPermissionCatalog.test.ts`    | Catalog entries, display names, no orphan leaves         |
| 6   | `orgPermissions.ts`               | `orgPermissions.test.ts`               | Org permission resolution, owner override                |
| 7   | `orgTeamConstants.ts`             | `orgTeamConstants.test.ts`             | Org constants sync with property                         |
| 8   | `orgTeamRoles.ts`                 | `orgTeamRoles.test.ts`                 | Org roles, admin vs member                               |
| 9   | `orgTeamTemplates.ts`             | `orgTeamTemplates.test.ts`             | Org role templates                                       |
| 10  | `orgPermissionCatalog.ts`         | `orgPermissionCatalog.test.ts`         | Catalog completeness                                     |
| 11  | `orgMemberRoleDisplay.ts`         | `orgMemberRoleDisplay.test.ts`         | Role display labels, badge variants                      |
| 12  | `orgRoleListingScope.ts`          | `orgRoleListingScope.test.ts`          | Listing scope per role                                   |
| 13  | `parkingPermissions.ts`           | `parkingPermissions.test.ts`           | Parking permission resolution                            |
| 14  | `parkingTeamConstants.ts`         | `parkingTeamConstants.test.ts`         | Parking team constant sync                               |
| 15  | `teamApi.ts`                      | `teamApi.test.ts`                      | API request shape builders (no fetch; shape tests)       |
| 16  | `teamApiJson.ts`                  | `teamApiJson.test.ts`                  | JSON serialization of team payloads                      |
| 17  | `teamMemberAccess.ts`             | `teamMemberAccess.test.ts`             | Access check: can view/edit/delete member                |
| 18  | `teamMemberContact.ts`            | `teamMemberContact.test.ts`            | Contact display: name, email, phone format               |
| 19  | `teamInviteContact.ts`            | `teamInviteContact.test.ts`            | Invite contact validation                                |
| 20  | `teamInviteEmail.ts`              | `teamInviteEmail.test.ts`              | Email validation for invites, domain check               |
| 21  | `teamRoleHelpers.ts`              | `teamRoleHelpers.test.ts`              | Role comparison, upgrade/downgrade checks                |
| 22  | `teamRoleToast.ts`                | `teamRoleToast.test.ts`                | Toast messages per role action                           |
| 23  | `teamScopeConfig.ts`              | `teamScopeConfig.test.ts`              | Scope config per entity type                             |
| 24  | `formatTeamInvitationDate.ts`     | `formatTeamInvitationDate.test.ts`     | Date formatting, expired, pending                        |
| 25  | `sortTeamMembersByCurrentUser.ts` | `sortTeamMembersByCurrentUser.test.ts` | Current user first, then alphabetical                    |
| 26  | `listingAssignmentRoles.ts`       | `listingAssignmentRoles.test.ts`       | Role → listing assignment permissions                    |
| 27  | `permissionTreeState.ts`          | `permissionTreeState.test.ts`          | Tree expand/collapse, check/uncheck cascade              |
| 28  | `planLimitedTeamCopy.ts`          | `planLimitedTeamCopy.test.ts`          | Copy strings for plan-limited team features              |
| 29  | `accessPermissionExpansion.ts`    | `accessPermissionExpansion.test.ts`    | Permission expansion rules                               |
| 30  | `bookingsPermissionExpansion.ts`  | `bookingsPermissionExpansion.test.ts`  | Bookings permission expansion                            |
| 31  | `opsPermissionExpansion.ts`       | `opsPermissionExpansion.test.ts`       | Operations permission expansion                          |
| 32  | `settingsPermissionExpansion.ts`  | `settingsPermissionExpansion.test.ts`  | Settings permission expansion                            |
| 33  | `legacyPermissionExpansion.ts`    | `legacyPermissionExpansion.test.ts`    | Legacy permission compat                                 |
| 34  | `orgLegacyPermissionExpansion.ts` | `orgLegacyPermissionExpansion.test.ts` | Org legacy compat                                        |
| 35  | `acceptInviteApi.ts`              | `acceptInviteApi.test.ts`              | Invite token parsing, expiry check                       |

**`dashboard/plans/lib/` — 11 new test files** (1 already exists)

| #   | File                        | Test file to create              | Test cases                                                |
| --- | --------------------------- | -------------------------------- | --------------------------------------------------------- |
| 36  | `planFeatures.ts`           | `planFeatures.test.ts`           | Feature key → value per tier, free/starter/pro/enterprise |
| 37  | `planPricing.ts`            | `planPricing.test.ts`            | Monthly/annual pricing, discount calc, currency format    |
| 38  | `planProration.ts`          | `planProration.test.ts`          | Proration days, upgrade credit, downgrade timing          |
| 39  | `planTierIcons.ts`          | `planTierIcons.test.ts`          | Icon per tier, fallback                                   |
| 40  | `featureGateCopy.ts`        | `featureGateCopy.test.ts`        | Gate message per feature, upgrade CTA                     |
| 41  | `orgEntitlements.ts`        | `orgEntitlements.test.ts`        | Entitlement checks: can use feature X at tier Y           |
| 42  | `orgPlanCheckoutParams.ts`  | `orgPlanCheckoutParams.test.ts`  | Checkout URL params, plan ID, callback URL                |
| 43  | `orgPlanCheckoutSession.ts` | `orgPlanCheckoutSession.test.ts` | Session state, timeout, retry                             |
| 44  | `openOrgPlanCheckout.ts`    | `openOrgPlanCheckout.test.ts`    | Checkout open logic, window handling                      |
| 45  | `upgradeModalBridge.ts`     | `upgradeModalBridge.test.ts`     | Bridge state, reason → modal content                      |
| 46  | `planStubPayToast.ts`       | `planStubPayToast.test.ts`       | Toast message per plan action                             |

**Session 3 total: 46 new test files**

---

### Session 4: Guest form, calendar, and operational flows (P1)

**`guest/form/lib/` — 4 new test files** (2 already exist)

| #   | File                               | Test file to create                     | Test cases                                              |
| --- | ---------------------------------- | --------------------------------------- | ------------------------------------------------------- |
| 1   | `bookingFormatter.ts`              | `bookingFormatter.test.ts`              | Format booking data for submission, date normalization  |
| 2   | `bookingSourceFromSearchParams.ts` | `bookingSourceFromSearchParams.test.ts` | Airbnb/direct/referral source detection from URL params |
| 3   | `findUsOptions.ts`                 | `findUsOptions.test.ts`                 | "How did you find us" option list, other field          |
| 4   | `guestFormPayment.ts`              | `guestFormPayment.test.ts`              | Payment method selection, Airbnb skip-pay, amount calc  |
| 5   | `guestFormPropertyDefaults.ts`     | `guestFormPropertyDefaults.test.ts`     | Property → form defaults, optional fields               |
| 6   | `guestFormBranding.ts`             | `guestFormBranding.test.ts`             | Brand color application, logo URL                       |
| 7   | `guestCounts.ts`                   | `guestCounts.test.ts`                   | Adult/child/infant count validation, max guests         |
| 8   | `guestPropertyScope.ts`            | `guestPropertyScope.test.ts`            | Property resolution from slug, 404 handling             |
| 9   | `fetchGuestBookedDates.ts`         | `fetchGuestBookedDates.test.ts`         | Booked dates merge, buffer days, date range overlap     |

**`guest/calendar/lib/` — 1 new test file**

| #   | File                           | Test file to create                 | Test cases                                                   |
| --- | ------------------------------ | ----------------------------------- | ------------------------------------------------------------ |
| 10  | `guestCalendarAvailability.ts` | `guestCalendarAvailability.test.ts` | Available/booked/blocked dates, min-stay enforcement, buffer |

**`guest/sd-form/lib/` — 5 new test files** (1 already exists)

| #   | File                         | Test file to create               | Test cases                                                    |
| --- | ---------------------------- | --------------------------------- | ------------------------------------------------------------- |
| 11  | `sdFormSchema.ts`            | `sdFormSchema.test.ts`            | Zod schema: valid submission, missing fields, invalid amounts |
| 12  | `sdFormSteps.ts`             | `sdFormSteps.test.ts`             | Step progression, completion check, back navigation           |
| 13  | `guestReviewFeedbackTags.ts` | `guestReviewFeedbackTags.test.ts` | Tag list, category grouping                                   |
| 14  | `voucher.ts`                 | `voucher.test.ts`                 | Voucher validation, expired, already claimed, discount calc   |
| 15  | `voucherRevealMotion.ts`     | `voucherRevealMotion.test.ts`     | Motion config per reveal style                                |
| 16  | `voucherRevealStyle.ts`      | `voucherRevealStyle.test.ts`      | Style config per reveal type                                  |

**`guest/stay-guide/lib/` — 4 new test files**

| #   | File                  | Test file to create        | Test cases                                     |
| --- | --------------------- | -------------------------- | ---------------------------------------------- |
| 17  | `mapStayGuideData.ts` | `mapStayGuideData.test.ts` | API response → display model, missing sections |
| 18  | `stayGuideConfig.ts`  | `stayGuideConfig.test.ts`  | Config per property, default chapters          |
| 19  | `stayGuideContent.ts` | `stayGuideContent.test.ts` | Content blocks mapping, rich text              |

**`guest/chat/lib/` — 5 new test files**

| #   | File                           | Test file to create                 | Test cases                                  |
| --- | ------------------------------ | ----------------------------------- | ------------------------------------------- |
| 20  | `guestChatSuggestions.ts`      | `guestChatSuggestions.test.ts`      | Suggestion generation per context           |
| 21  | `guestChatInsertItems.ts`      | `guestChatInsertItems.test.ts`      | Insert items (booking ref, location), shape |
| 22  | `guestChatResourceHubItems.ts` | `guestChatResourceHubItems.test.ts` | Resource hub item list, filtering           |

**`guest/booking-documents/lib/` — 1 new test file**

| #   | File                         | Test file to create | Test cases                                       |
| --- | ---------------------------- | ------------------- | ------------------------------------------------ |
| 23  | `api.ts` (booking-documents) | `api.test.ts`       | Token validation shape, document type resolution |

**`guest/auth/lib/` — 4 new test files** (1 already exists)

| #   | File                 | Test file to create       | Test cases                                        |
| --- | -------------------- | ------------------------- | ------------------------------------------------- |
| 24  | `authRedirect.ts`    | `authRedirect.test.ts`    | Post-login redirect URL, preserve return-to param |
| 25  | `guestAuthPaths.ts`  | `guestAuthPaths.test.ts`  | Auth path construction, login/register/OTP        |
| 26  | `guestAuthResume.ts` | `guestAuthResume.test.ts` | Resume session after redirect, token refresh      |
| 27  | `hostAuthPaths.ts`   | `hostAuthPaths.test.ts`   | Host auth paths, Google OAuth URL                 |

**`guest/pay-parking/lib/` — 3 new test files**

| #   | File                   | Test file to create         | Test cases                           |
| --- | ---------------------- | --------------------------- | ------------------------------------ |
| 28  | `payParkingSchema.ts`  | `payParkingSchema.test.ts`  | Zod schema validation: valid/invalid |
| 29  | `payParkingHelpers.ts` | `payParkingHelpers.test.ts` | Amount calculation, duration pricing |

**`guest/account/lib/` — 5 new test files**

| #   | File                        | Test file to create              | Test cases                                |
| --- | --------------------------- | -------------------------------- | ----------------------------------------- |
| 30  | `guestAccountNav.ts`        | `guestAccountNav.test.ts`        | Nav items, active state, badge counts     |
| 31  | `guestAccountPaths.ts`      | `guestAccountPaths.test.ts`      | Path construction for all account routes  |
| 32  | `guestAccountIdentity.ts`   | `guestAccountIdentity.test.ts`   | Display name, avatar fallback, initials   |
| 33  | `guestProfileValidation.ts` | `guestProfileValidation.test.ts` | Profile form schema, required fields      |
| 34  | `voucherDiscount.ts`        | `voucherDiscount.test.ts`        | Discount calc: percentage, fixed, max cap |

**Session 4 total: 34 new test files**

---

### Session 5: Org dashboard and settings (P1)

**`dashboard/org/lib/` — 55 new test files** (2 already exist)

| #   | File                                    | Test file to create                          | Test cases                                                |
| --- | --------------------------------------- | -------------------------------------------- | --------------------------------------------------------- |
| 1   | `adminApiScope.ts`                      | `adminApiScope.test.ts`                      | Scope resolution for API calls                            |
| 2   | `adminAssetScope.ts`                    | `adminAssetScope.test.ts`                    | Asset scope per entity type                               |
| 3   | `adminParkingScope.ts`                  | `adminParkingScope.test.ts`                  | Parking scope resolution                                  |
| 4   | `orgAccessKind.ts`                      | `orgAccessKind.test.ts`                      | Access kind: owner/admin/member                           |
| 5   | `orgLanding.ts`                         | `orgLanding.test.ts`                         | Landing page redirect logic per role                      |
| 6   | `orgDevelopments.ts`                    | `orgDevelopments.test.ts`                    | Developments list filter/sort                             |
| 7   | `tenantPaths.ts`                        | `tenantPaths.test.ts`                        | Tenant path construction per scope                        |
| 8   | `guestPublicPaths.ts` (org mirror)      | `guestPublicPaths.test.ts`                   | Public path generation for admin copy-link                |
| 9   | `edgeClient.ts`                         | `edgeClient.test.ts`                         | Edge client header construction                           |
| 10  | `postSignInRouting.ts`                  | `postSignInRouting.test.ts`                  | Routing after sign-in: new user → onboard, existing → org |
| 11  | `orgSettingsForm.ts`                    | `orgSettingsForm.test.ts`                    | Form field definitions, defaults                          |
| 12  | `orgSettingsValidation.ts`              | `orgSettingsValidation.test.ts`              | Settings schema validation, each field                    |
| 13  | `orgSettingsSave.ts`                    | `orgSettingsSave.test.ts`                    | Save payload diff, only changed fields                    |
| 14  | `orgSettingsCompletion.ts`              | `orgSettingsCompletion.test.ts`              | Completion percentage, missing fields list                |
| 15  | `orgSettingsFieldError.ts`              | `orgSettingsFieldError.test.ts`              | Error message per field, validation rule                  |
| 16  | `orgSettingsIssuesStore.ts`             | `orgSettingsIssuesStore.test.ts`             | Issues store: add/remove/clear                            |
| 17  | `orgVerification.ts`                    | `orgVerification.test.ts`                    | Verification state machine, transitions                   |
| 18  | `orgVerificationTiers.ts`               | `orgVerificationTiers.test.ts`               | Tier requirements, upgrade/downgrade                      |
| 19  | `verificationCopy.ts`                   | `verificationCopy.test.ts`                   | Copy per verification state                               |
| 20  | `listingVerificationCopy.ts`            | `listingVerificationCopy.test.ts`            | Listing verification status copy                          |
| 21  | `listingVerificationTiers.ts`           | `listingVerificationTiers.test.ts`           | Listing tier definitions                                  |
| 22  | `listingAuthorization.ts`               | `listingAuthorization.test.ts`               | Authorization check per action                            |
| 23  | `contractLifecycle.ts`                  | `contractLifecycle.test.ts`                  | Contract states, renewal, expiry                          |
| 24  | `listingContractRenewalCandidates.ts`   | `listingContractRenewalCandidates.test.ts`   | Renewal candidates filter                                 |
| 25  | `listingContractRenewalCopy.ts`         | `listingContractRenewalCopy.test.ts`         | Renewal copy per state                                    |
| 26  | `listingContractRenewalDismiss.ts`      | `listingContractRenewalDismiss.test.ts`      | Dismiss logic                                             |
| 27  | `listingContractRenewalDismissScope.ts` | `listingContractRenewalDismissScope.test.ts` | Dismiss scope                                             |
| 28  | `orgSuperhost.ts`                       | `orgSuperhost.test.ts`                       | Superhost badge logic                                     |
| 29  | `orgPropertiesFilters.ts`               | `orgPropertiesFilters.test.ts`               | Filter options, apply, clear                              |
| 30  | `orgParkingsFilters.ts`                 | `orgParkingsFilters.test.ts`                 | Parking filter options                                    |
| 31  | `orgPropertyCardModel.ts`               | `orgPropertyCardModel.test.ts`               | Card data mapping from property                           |
| 32  | `orgPropertyDisplay.ts`                 | `orgPropertyDisplay.test.ts`                 | Property display helpers                                  |
| 33  | `orgParkingCardModel.ts`                | `orgParkingCardModel.test.ts`                | Parking card model                                        |
| 34  | `orgParkingDisplay.ts`                  | `orgParkingDisplay.test.ts`                  | Parking display helpers                                   |
| 35  | `formatParkingLocation.ts`              | `formatParkingLocation.test.ts`              | Location format                                           |
| 36  | `parkingResidences.ts`                  | `parkingResidences.test.ts`                  | Residence list for parking                                |
| 37  | `parkingSlotConflict.ts`                | `parkingSlotConflict.test.ts`                | Slot conflict detection                                   |
| 38  | `parkingSlotDisplay.ts`                 | `parkingSlotDisplay.test.ts`                 | Slot display helpers                                      |
| 39  | `propertyConstants.ts`                  | `propertyConstants.test.ts`                  | Constants completeness                                    |
| 40  | `propertyDisplay.ts`                    | `propertyDisplay.test.ts`                    | Property display helpers                                  |
| 41  | `propertyLocation.ts`                   | `propertyLocation.test.ts`                   | Location display and formatting                           |
| 42  | `propertyMedia.ts`                      | `propertyMedia.test.ts`                      | Media list handling, ordering                             |
| 43  | `propertyCancellationPolicy.ts`         | `propertyCancellationPolicy.test.ts`         | Policy types, refund rules                                |
| 44  | `propertyDocumentRequirements.ts`       | `propertyDocumentRequirements.test.ts`       | Document requirement toggles                              |
| 45  | `propertyEmailAutomation.ts`            | `propertyEmailAutomation.test.ts`            | Automation toggle states                                  |
| 46  | `propertyEmailAutomationDefaults.ts`    | `propertyEmailAutomationDefaults.test.ts`    | Default automation config                                 |
| 47  | `propertyExternalReviews.ts`            | `propertyExternalReviews.test.ts`            | Review platform config                                    |
| 48  | `propertyHouseRulesConstants.ts`        | `propertyHouseRulesConstants.test.ts`        | House rules options                                       |
| 49  | `propertyResidences.ts`                 | `propertyResidences.test.ts`                 | Residence management helpers                              |
| 50  | `propertyResidenceDefaults.ts`          | `propertyResidenceDefaults.test.ts`          | Default residence config                                  |
| 51  | `propertySettingsForm.ts`               | `propertySettingsForm.test.ts`               | Settings form field definitions                           |
| 52  | `propertySettingsCompletion.ts`         | `propertySettingsCompletion.test.ts`         | Completion score                                          |
| 53  | `propertySettingsConstants.ts`          | `propertySettingsConstants.test.ts`          | Settings constants                                        |
| 54  | `propertySettingsFieldError.ts`         | `propertySettingsFieldError.test.ts`         | Field error messages                                      |
| 55  | `propertySettingsIssuesStore.ts`        | `propertySettingsIssuesStore.test.ts`        | Issues store CRUD                                         |
| 56  | `propertySettingsSave.ts`               | `propertySettingsSave.test.ts`               | Save diff payload                                         |
| 57  | `propertyTowerUnit.ts`                  | `propertyTowerUnit.test.ts`                  | Tower/unit label generation                               |
| 58  | `propertyTowerUnitConflict.ts`          | `propertyTowerUnitConflict.test.ts`          | Conflict detection                                        |
| 59  | `propertyVoucherSettings.ts`            | `propertyVoucherSettings.test.ts`            | Voucher config per property                               |
| 60  | `propertySocialLinks.ts`                | `propertySocialLinks.test.ts`                | Social link validation, platform detect                   |
| 61  | `settingsFieldLabel.ts`                 | `settingsFieldLabel.test.ts`                 | Field labels                                              |
| 62  | `settingsVerificationFingerprint.ts`    | `settingsVerificationFingerprint.test.ts`    | Fingerprint calculation                                   |
| 63  | `socialPlatformTypes.ts`                | `socialPlatformTypes.test.ts`                | Platform type list                                        |
| 64  | `paymentMethods.ts`                     | `paymentMethods.test.ts`                     | Payment method options, icons                             |
| 65  | `paymentProviders.ts`                   | `paymentProviders.test.ts`                   | Provider config                                           |
| 66  | `aiQuotaToast.ts`                       | `aiQuotaToast.test.ts`                       | Quota exceeded toast content                              |
| 67  | `voucherRevealStyle.ts`                 | `voucherRevealStyle.test.ts`                 | Reveal style options                                      |

**Session 5 total: 67 new test files**

---

### Session 6: Property dashboard modules (P1)

**`dashboard/property/lib/` — 4 new test files**

| #   | File                              | Test file to create                    | Test cases                    |
| --- | --------------------------------- | -------------------------------------- | ----------------------------- |
| 1   | `dashboardPeriod.ts`              | `dashboardPeriod.test.ts`              | Period calculation, Manila TZ |
| 2   | `dashboardFinanceTransactions.ts` | `dashboardFinanceTransactions.test.ts` | Transaction list filtering    |
| 3   | `propertyGuestPublicPages.ts`     | `propertyGuestPublicPages.test.ts`     | Public page URL generation    |
| 4   | `resolvePropertyDashboardHref.ts` | `resolvePropertyDashboardHref.test.ts` | Dashboard href from context   |

**`dashboard/finance/lib/` — 8 new test files**

| #   | File                         | Test file to create               | Test cases                                                  |
| --- | ---------------------------- | --------------------------------- | ----------------------------------------------------------- |
| 5   | `financeLedger.ts`           | `financeLedger.test.ts`           | Ledger entries, balance calc, categories                    |
| 6   | `financePeriod.ts`           | `financePeriod.test.ts`           | Period selection, month/quarter/year                        |
| 7   | `financeSummaryStats.ts`     | `financeSummaryStats.test.ts`     | Revenue, expense, net, averages                             |
| 8   | `financeChartData.ts`        | `financeChartData.test.ts`        | Chart data points, empty periods                            |
| 9   | `financeCategoryColors.ts`   | `financeCategoryColors.test.ts`   | Category → color mapping                                    |
| 10  | `financeFilterLabels.ts`     | `financeFilterLabels.test.ts`     | Filter label text                                           |
| 11  | `financeReminderTemplate.ts` | `financeReminderTemplate.test.ts` | Reminder template placeholders                              |
| 12  | `recurrence.ts`              | `recurrence.test.ts`              | Recurrence rule: daily/weekly/monthly/yearly, next due date |

**`dashboard/pricing/lib/` — 8 new test files**

| #   | File                            | Test file to create                  | Test cases                                     |
| --- | ------------------------------- | ------------------------------------ | ---------------------------------------------- |
| 13  | `pricingCompute.ts`             | `pricingCompute.test.ts`             | Nightly rate calc, weekend surcharge, seasonal |
| 14  | `pricingDefaults.ts`            | `pricingDefaults.test.ts`            | Default pricing config                         |
| 15  | `pricingCalendarUtils.ts`       | `pricingCalendarUtils.test.ts`       | Calendar date helpers, blocked ranges          |
| 16  | `pricingSave.ts`                | `pricingSave.test.ts`                | Save payload diff                              |
| 17  | `phHolidayRules.ts`             | `phHolidayRules.test.ts`             | PH holiday detection by date, regular/special  |
| 18  | `smartPricingPreviewExplain.ts` | `smartPricingPreviewExplain.test.ts` | Explanation text per factor                    |

**`dashboard/maintenance/lib/` — 4 new test files**

| #   | File                             | Test file to create                   | Test cases                   |
| --- | -------------------------------- | ------------------------------------- | ---------------------------- |
| 19  | `maintenancePeriod.ts`           | `maintenancePeriod.test.ts`           | Period handling              |
| 20  | `maintenanceReminders.ts`        | `maintenanceReminders.test.ts`        | Reminder scheduling, overdue |
| 21  | `maintenanceReminderTemplate.ts` | `maintenanceReminderTemplate.test.ts` | Template placeholders        |

**`dashboard/notifications/lib/` — 5 new test files**

| #   | File                       | Test file to create             | Test cases                         |
| --- | -------------------------- | ------------------------------- | ---------------------------------- |
| 22  | `notificationsDisplay.ts`  | `notificationsDisplay.test.ts`  | Notification card content per type |
| 23  | `notificationsCollapse.ts` | `notificationsCollapse.test.ts` | Group/collapse logic               |
| 24  | `notificationsPaths.ts`    | `notificationsPaths.test.ts`    | Notification link targets          |
| 25  | `notificationsScope.ts`    | `notificationsScope.test.ts`    | Scope filtering                    |

**`dashboard/import/lib/` — 5 new test files**

| #   | File                          | Test file to create                | Test cases                             |
| --- | ----------------------------- | ---------------------------------- | -------------------------------------- |
| 26  | `importCsvTemplate.ts`        | `importCsvTemplate.test.ts`        | Template column headers, sample row    |
| 27  | `importTargetFields.ts`       | `importTargetFields.test.ts`       | Field mapping options per import type  |
| 28  | `importRowDraftValidation.ts` | `importRowDraftValidation.test.ts` | Row validation: dates, names, required |
| 29  | `importUploadLimits.ts`       | `importUploadLimits.test.ts`       | File size, row count limits            |
| 30  | `importBatchWorkflow.ts`      | `importBatchWorkflow.test.ts`      | Batch stages, progress tracking        |
| 31  | `importEdgeResponse.ts`       | `importEdgeResponse.test.ts`       | Response shape, error mapping          |

**`dashboard/setup-guide/lib/` — 3 new test files** (1 already exists)

| #   | File                    | Test file to create          | Test cases                           |
| --- | ----------------------- | ---------------------------- | ------------------------------------ |
| 32  | `setupGuideProgress.ts` | `setupGuideProgress.test.ts` | Progress percentage, completed steps |
| 33  | `setupGuideState.ts`    | `setupGuideState.test.ts`    | State persistence, dismiss           |

**Session 6 total: 33 new test files**

---

### Session 7: Inbox and marketing (P2)

**`dashboard/inbox/lib/` — 19 new test files**

| #   | File                         | Test file to create               | Test cases                                |
| --- | ---------------------------- | --------------------------------- | ----------------------------------------- |
| 1   | `inboxFormat.ts`             | `inboxFormat.test.ts`             | Message format, timestamps, relative time |
| 2   | `inboxMatchBooking.ts`       | `inboxMatchBooking.test.ts`       | Match guest message → booking, fuzzy name |
| 3   | `inboxBookingShareRows.ts`   | `inboxBookingShareRows.test.ts`   | Share row data, booking card content      |
| 4   | `inboxShareBookingItems.ts`  | `inboxShareBookingItems.test.ts`  | Item list for share action                |
| 5   | `inboxCheckInPack.ts`        | `inboxCheckInPack.test.ts`        | Check-in pack data assembly               |
| 6   | `inboxPinnedSnippets.ts`     | `inboxPinnedSnippets.test.ts`     | Pin/unpin, max pinned                     |
| 7   | `inboxThreadPagination.ts`   | `inboxThreadPagination.test.ts`   | Thread pagination, load more              |
| 8   | `inboxInsertContent.ts`      | `inboxInsertContent.test.ts`      | Insert booking ref, template content      |
| 9   | `inboxChatAttachment.ts`     | `inboxChatAttachment.test.ts`     | Attachment type detect, preview           |
| 10  | `inboxMessageAttachments.ts` | `inboxMessageAttachments.test.ts` | Attachment list handling                  |
| 11  | `inboxNotifications.ts`      | `inboxNotifications.test.ts`      | Notification badges, unread count         |
| 12  | `inboxQuickReplyLinks.ts`    | `inboxQuickReplyLinks.test.ts`    | Quick reply insertion                     |
| 13  | `inboxQuickReplyMerge.ts`    | `inboxQuickReplyMerge.test.ts`    | Merge placeholders in quick reply         |
| 14  | `quickReplyGroups.ts`        | `quickReplyGroups.test.ts`        | Group categories                          |
| 15  | `metaInboxOAuthErrors.ts`    | `metaInboxOAuthErrors.test.ts`    | Error code → user message                 |
| 16  | `metaInboxSyncErrors.ts`     | `metaInboxSyncErrors.test.ts`     | Sync error handling                       |
| 17  | `inboxMockMode.ts`           | `inboxMockMode.test.ts`           | Mock mode toggle                          |

**`dashboard/marketing/lib/` — 22 new test files** (5 already exist)

| #   | File                             | Test file to create                   | Test cases                               |
| --- | -------------------------------- | ------------------------------------- | ---------------------------------------- |
| 18  | `marketingFormats.ts`            | `marketingFormats.test.ts`            | Format dimensions, aspect ratios         |
| 19  | `marketingStudioCopy.ts`         | `marketingStudioCopy.test.ts`         | Copy strings per tab                     |
| 20  | `marketingDefaultBinding.ts`     | `marketingDefaultBinding.test.ts`     | Default bindings per template            |
| 21  | `marketingContentFingerprint.ts` | `marketingContentFingerprint.test.ts` | Fingerprint generation, change detection |
| 22  | `marketingBookedDates.ts`        | `marketingBookedDates.test.ts`        | Booked dates for marketing calendar      |
| 23  | `marketingCatalogHidden.ts`      | `marketingCatalogHidden.test.ts`      | Hidden catalog items filter              |
| 24  | `marketingIdle.ts`               | `marketingIdle.test.ts`               | Idle detection config                    |
| 25  | `calendarCanvasFormats.ts`       | `calendarCanvasFormats.test.ts`       | Canvas format definitions                |
| 26  | `calendarPresets.ts`             | `calendarPresets.test.ts`             | Preset list, thumbnail data              |
| 27  | `calendarBrandColors.ts`         | `calendarBrandColors.test.ts`         | Brand color extraction                   |
| 28  | `calendarBrandTints.ts`          | `calendarBrandTints.test.ts`          | Tint generation                          |
| 29  | `designCampaignTemplates.ts`     | `designCampaignTemplates.test.ts`     | Template catalog                         |
| 30  | `designCanvasTypes.ts`           | `designCanvasTypes.test.ts`           | Canvas type definitions                  |
| 31  | `designBrandColors.ts`           | `designBrandColors.test.ts`           | Brand color for design                   |
| 32  | `videoCampaignTemplates.ts`      | `videoCampaignTemplates.test.ts`      | Video template catalog                   |
| 33  | `templateRegistry.ts`            | `templateRegistry.test.ts`            | Registry lookup, fallback                |
| 34  | `marketingSavedTemplates.ts`     | `marketingSavedTemplates.test.ts`     | Save/load templates                      |
| 35  | `propertyBindingMedia.ts`        | `propertyBindingMedia.test.ts`        | Property media binding                   |
| 36  | `marketingAiPhotoPalette.ts`     | `marketingAiPhotoPalette.test.ts`     | AI photo palette extraction              |
| 37  | `marketingGuestReview.ts`        | `marketingGuestReview.test.ts`        | Guest review display for marketing       |
| 38  | `marketingReviewDesignSeed.ts`   | `marketingReviewDesignSeed.test.ts`   | Design seed from review                  |

**Session 7 total: 38 new test files**

---

### Session 8: Analytics, activity, announcements (P2)

**`dashboard/analytics/lib/` — 5 new test files** (3 already exist)

| #   | File                    | Test file to create          | Test cases                                  |
| --- | ----------------------- | ---------------------------- | ------------------------------------------- |
| 1   | `analyticsDateRange.ts` | `analyticsDateRange.test.ts` | Date range presets, custom range, Manila TZ |
| 2   | `analyticsPeriod.ts`    | `analyticsPeriod.test.ts`    | Period comparison, YoY, MoM                 |
| 3   | `metricGlossary.ts`     | `metricGlossary.test.ts`     | Glossary entries, all metrics defined       |
| 4   | `exportCsv.ts`          | `exportCsv.test.ts`          | CSV generation, column headers, escaping    |
| 5   | `exportPdf.ts`          | `exportPdf.test.ts`          | PDF data assembly                           |

**`dashboard/activity/lib/` — 3 new test files**

| #   | File                     | Test file to create           | Test cases                                             |
| --- | ------------------------ | ----------------------------- | ------------------------------------------------------ |
| 6   | `activityCatalog.ts`     | `activityCatalog.test.ts`     | Catalog entries, category grouping, server mirror sync |
| 7   | `activityFilterUtils.ts` | `activityFilterUtils.test.ts` | Filter by category, actor, date range                  |
| 8   | `activityFormat.ts`      | `activityFormat.test.ts`      | Activity display: summary text, timestamp, diff        |

**`dashboard/announcements/lib/` — 7 new test files**

| #   | File                              | Test file to create                    | Test cases                       |
| --- | --------------------------------- | -------------------------------------- | -------------------------------- |
| 9   | `hostAnnouncementPresentation.ts` | `hostAnnouncementPresentation.test.ts` | Presentation per type            |
| 10  | `hostAnnouncementReadState.ts`    | `hostAnnouncementReadState.test.ts`    | Read/unread tracking             |
| 11  | `hostAnnouncementSchedule.ts`     | `hostAnnouncementSchedule.test.ts`     | Schedule parsing, active/expired |
| 12  | `hostAnnouncementSeverity.ts`     | `hostAnnouncementSeverity.test.ts`     | Severity levels, colors          |
| 13  | `hostAnnouncementCopy.ts`         | `hostAnnouncementCopy.test.ts`         | Copy per announcement type       |
| 14  | `hostAnnouncementTypes.ts`        | `hostAnnouncementTypes.test.ts`        | Type definitions                 |
| 15  | `hostAnnouncementsPaths.ts`       | `hostAnnouncementsPaths.test.ts`       | URL paths per scope              |

**`dashboard/help-support/lib/` — 5 new test files**

| #   | File                     | Test file to create           | Test cases                 |
| --- | ------------------------ | ----------------------------- | -------------------------- |
| 16  | `helpContentDisplay.ts`  | `helpContentDisplay.test.ts`  | Content rendering helpers  |
| 17  | `helpFaqModules.ts`      | `helpFaqModules.test.ts`      | FAQ module categories      |
| 18  | `helpSupportPaths.ts`    | `helpSupportPaths.test.ts`    | Help paths per scope       |
| 19  | `supportTicketSchema.ts` | `supportTicketSchema.test.ts` | Ticket form Zod schema     |
| 20  | `supportTicketStatus.ts` | `supportTicketStatus.test.ts` | Status labels, transitions |

**Session 8 total: 20 new test files**

---

### Session 9: Parking dashboard (P2)

**`dashboard/parking/lib/` — 14 new test files**

| #   | File                             | Test file to create                   | Test cases                                       |
| --- | -------------------------------- | ------------------------------------- | ------------------------------------------------ |
| 1   | `parkingDashboardStats.ts`       | `parkingDashboardStats.test.ts`       | KPI calculation                                  |
| 2   | `parkingWorkflow.ts`             | `parkingWorkflow.test.ts`             | Parking workflow transitions, actions per status |
| 3   | `parkingPricingCompute.ts`       | `parkingPricingCompute.test.ts`       | Pricing: hourly, daily, monthly, compound        |
| 4   | `parkingPricingDefaults.ts`      | `parkingPricingDefaults.test.ts`      | Default pricing config                           |
| 5   | `parkingPricingSave.ts`          | `parkingPricingSave.test.ts`          | Save payload diff                                |
| 6   | `parkingDimensionDefaults.ts`    | `parkingDimensionDefaults.test.ts`    | Slot dimension defaults                          |
| 7   | `parkingSettingsForm.ts`         | `parkingSettingsForm.test.ts`         | Settings form fields                             |
| 8   | `parkingSettingsCompletion.ts`   | `parkingSettingsCompletion.test.ts`   | Completion score                                 |
| 9   | `parkingSettingsFieldError.ts`   | `parkingSettingsFieldError.test.ts`   | Field errors                                     |
| 10  | `parkingSettingsIssuesStore.ts`  | `parkingSettingsIssuesStore.test.ts`  | Issues store                                     |
| 11  | `parkingSettingsSavePlan.ts`     | `parkingSettingsSavePlan.test.ts`     | Save plan diff                                   |
| 12  | `parkingEmailAutomation.ts`      | `parkingEmailAutomation.test.ts`      | Email automation config                          |
| 13  | `parkingFeaturesConstants.ts`    | `parkingFeaturesConstants.test.ts`    | Feature constants                                |
| 14  | `parkingTelegramPlaceholders.ts` | `parkingTelegramPlaceholders.test.ts` | Telegram placeholder groups                      |

**Session 9 total: 14 new test files**

---

### Session 10: Super admin (P2)

**`dashboard/super-admin/lib/` — 20 new test files**

| #   | File                                     | Test file to create                           | Test cases                          |
| --- | ---------------------------------------- | --------------------------------------------- | ----------------------------------- |
| 1   | `approvalReviewTier.ts`                  | `approvalReviewTier.test.ts`                  | Tier determination, requirements    |
| 2   | `listingApprovalReviewTier.ts`           | `listingApprovalReviewTier.test.ts`           | Listing approval tier               |
| 3   | `requestChangesMessage.ts`               | `requestChangesMessage.test.ts`               | Message template per issue          |
| 4   | `listingRequestChangesMessage.ts`        | `listingRequestChangesMessage.test.ts`        | Listing-specific changes message    |
| 5   | `rejectReasonOptions.ts`                 | `rejectReasonOptions.test.ts`                 | Rejection reasons list              |
| 6   | `pricingPlanDisplay.ts`                  | `pricingPlanDisplay.test.ts`                  | Plan display per tier               |
| 7   | `hostPropertyAdapter.ts`                 | `hostPropertyAdapter.test.ts`                 | Host → property data adapter        |
| 8   | `platformPropertyAdapter.ts`             | `platformPropertyAdapter.test.ts`             | Platform → property adapter         |
| 9   | `developmentSettingsForm.ts`             | `developmentSettingsForm.test.ts`             | Development settings form fields    |
| 10  | `developmentSettingsConstants.ts`        | `developmentSettingsConstants.test.ts`        | Constants                           |
| 11  | `developmentGuestInfo.ts`                | `developmentGuestInfo.test.ts`                | Guest info display for developments |
| 12  | `developmentLocation.ts`                 | `developmentLocation.test.ts`                 | Location helpers                    |
| 13  | `developmentMedia.ts`                    | `developmentMedia.test.ts`                    | Media handling                      |
| 14  | `developmentParking.ts`                  | `developmentParking.test.ts`                  | Parking assignment                  |
| 15  | `superAdminPaths.ts`                     | `superAdminPaths.test.ts`                     | All admin paths                     |
| 16  | `superAdminPlatformNav.ts`               | `superAdminPlatformNav.test.ts`               | Nav items, active state             |
| 17  | `superAdminListViewMode.ts`              | `superAdminListViewMode.test.ts`              | Table/card toggle                   |
| 18  | `superAdminHostsFilters.ts`              | `superAdminHostsFilters.test.ts`              | Host filters                        |
| 19  | `superAdminApprovalsFilters.ts`          | `superAdminApprovalsFilters.test.ts`          | Approval filters                    |
| 20  | `superAdminDevelopmentsFilters.ts`       | `superAdminDevelopmentsFilters.test.ts`       | Developments filters                |
| 21  | `superAdminPlatformPropertiesFilters.ts` | `superAdminPlatformPropertiesFilters.test.ts` | Properties filters                  |
| 22  | `superAdminPricingFilters.ts`            | `superAdminPricingFilters.test.ts`            | Pricing filters                     |
| 23  | `superAdminAnnouncementFilters.ts`       | `superAdminAnnouncementFilters.test.ts`       | Announcement filters                |
| 24  | `superAdminSupportFilters.ts`            | `superAdminSupportFilters.test.ts`            | Support filters                     |

**Session 10 total: 24 new test files**

---

### Session 11: AI assistant (P2)

**`dashboard/ai-assistant/lib/` — 14 new test files**

| #   | File                            | Test file to create                  | Test cases                             |
| --- | ------------------------------- | ------------------------------------ | -------------------------------------- |
| 1   | `assistantSuggestions.ts`       | `assistantSuggestions.test.ts`       | Suggestion generation per page context |
| 2   | `assistantToolLabels.ts`        | `assistantToolLabels.test.ts`        | Tool label display, icon mapping       |
| 3   | `attachedContext.ts`            | `attachedContext.test.ts`            | Context assembly from selection        |
| 4   | `bookingPickerItems.ts`         | `bookingPickerItems.test.ts`         | Picker items from bookings list        |
| 5   | `chatBlockDisplay.ts`           | `chatBlockDisplay.test.ts`           | Block rendering decisions              |
| 6   | `chatAttachments.ts`            | `chatAttachments.test.ts`            | Attachment handling in chat            |
| 7   | `contextPickerRegistry.ts`      | `contextPickerRegistry.test.ts`      | Registry lookup, categories            |
| 8   | `contextPickerIcons.ts`         | `contextPickerIcons.test.ts`         | Icon per context type                  |
| 9   | `contextPickerCatalogVisual.ts` | `contextPickerCatalogVisual.test.ts` | Visual catalog data                    |
| 10  | `conversationTitle.ts`          | `conversationTitle.test.ts`          | Title from first message, truncation   |
| 11  | `dynamicFormValidation.ts`      | `dynamicFormValidation.test.ts`      | Dynamic form field validation          |
| 12  | `humanizeAssistantLabels.ts`    | `humanizeAssistantLabels.test.ts`    | Technical → human labels               |
| 13  | `moduleSuggestions.ts`          | `moduleSuggestions.test.ts`          | Module-specific suggestions            |
| 14  | `partitionAssistantBlocks.ts`   | `partitionAssistantBlocks.test.ts`   | Block partitioning: text/tool/confirm  |

**Session 11 total: 14 new test files**

---

### Session 12: Public marketing pages and search (P2)

**`guest/marketing/shared/lib/` — 12 new test files**

| #   | File                              | Test file to create                    | Test cases                         |
| --- | --------------------------------- | -------------------------------------- | ---------------------------------- |
| 1   | `listingFilterChips.ts`           | `listingFilterChips.test.ts`           | Chip generation, remove, clear all |
| 2   | `listingQueryParams.ts`           | `listingQueryParams.test.ts`           | URL param parsing/serialization    |
| 3   | `listingPlacement.ts`             | `listingPlacement.test.ts`             | Placement algorithm, grid position |
| 4   | `listingMapMarkers.ts`            | `listingMapMarkers.test.ts`            | Marker data from listings          |
| 5   | `listingMapLayout.ts`             | `listingMapLayout.test.ts`             | Map bounds calculation             |
| 6   | `listingScrollSearchPaths.ts`     | `listingScrollSearchPaths.test.ts`     | Scroll-search path generation      |
| 7   | `listingSearchFields.ts`          | `listingSearchFields.test.ts`          | Search field definitions           |
| 8   | `listingSearchPreferType.ts`      | `listingSearchPreferType.test.ts`      | Type preference from context       |
| 9   | `listingSearchDefaultLocation.ts` | `listingSearchDefaultLocation.test.ts` | Default location                   |
| 10  | `locationSlug.ts`                 | `locationSlug.test.ts`                 | Location → slug, slug → location   |
| 11  | `marketingGuestNavLinks.ts`       | `marketingGuestNavLinks.test.ts`       | Nav link list                      |
| 12  | `publicListingFetch.ts`           | `publicListingFetch.test.ts`           | Fetch params shape                 |

**`guest/marketing/properties/lib/` — 6 new test files**

| #   | File                              | Test file to create                    | Test cases                  |
| --- | --------------------------------- | -------------------------------------- | --------------------------- |
| 13  | `groupPropertiesByLocation.ts`    | `groupPropertiesByLocation.test.ts`    | Grouping, sort within group |
| 14  | `groupPropertiesByDevelopment.ts` | `groupPropertiesByDevelopment.test.ts` | Grouping by development     |
| 15  | `mapPublicPropertyDetail.ts`      | `mapPublicPropertyDetail.test.ts`      | API → display model         |
| 16  | `propertyLandingSections.ts`      | `propertyLandingSections.test.ts`      | Section visibility          |
| 17  | `propertyOverviewStats.ts`        | `propertyOverviewStats.test.ts`        | Stat card data              |
| 18  | `propertyMapEmbed.ts`             | `propertyMapEmbed.test.ts`             | Map embed URL               |

**`guest/marketing/parkings/lib/` — 8 new test files**

| #   | File                           | Test file to create                 | Test cases              |
| --- | ------------------------------ | ----------------------------------- | ----------------------- |
| 19  | `groupParkingsByLocation.ts`   | `groupParkingsByLocation.test.ts`   | Location grouping       |
| 20  | `formatParkingLocation.ts`     | `formatParkingLocation.test.ts`     | Location format         |
| 21  | `parkingDimensions.ts`         | `parkingDimensions.test.ts`         | Dimension display       |
| 22  | `parkingTypeLabel.ts`          | `parkingTypeLabel.test.ts`          | Type labels             |
| 23  | `parkingListEntries.ts`        | `parkingListEntries.test.ts`        | List entry data         |
| 24  | `parkingRegistrationSchema.ts` | `parkingRegistrationSchema.test.ts` | Zod schema              |
| 25  | `parkingRegistrationSteps.ts`  | `parkingRegistrationSteps.test.ts`  | Step progression        |
| 26  | `parkingRequestEntryCopy.ts`   | `parkingRequestEntryCopy.test.ts`   | Copy per request status |
| 27  | `parkingLinkStay.ts`           | `parkingLinkStay.test.ts`           | Stay linking logic      |

**`guest/marketing/developments/lib/` — 5 new test files**

| #   | File                             | Test file to create                   | Test cases        |
| --- | -------------------------------- | ------------------------------------- | ----------------- |
| 28  | `groupDevelopmentsByLocation.ts` | `groupDevelopmentsByLocation.test.ts` | Location grouping |
| 29  | `resolvePublicDevelopment.ts`    | `resolvePublicDevelopment.test.ts`    | Slug resolution   |
| 30  | `parkingSlotDisplay.ts`          | `parkingSlotDisplay.test.ts`          | Slot display      |
| 31  | `parkingSlotFilters.ts`          | `parkingSlotFilters.test.ts`          | Filter options    |
| 32  | `parkingSlotMedia.ts`            | `parkingSlotMedia.test.ts`            | Media handling    |

**`guest/search/lib/` — 4 new test files** (1 already exists)

| #   | File                    | Test file to create          | Test cases                   |
| --- | ----------------------- | ---------------------------- | ---------------------------- |
| 33  | `searchFilterParams.ts` | `searchFilterParams.test.ts` | Filter param parse/serialize |
| 34  | `searchParams.ts`       | `searchParams.test.ts`       | Search param construction    |
| 35  | `amenityLabels.ts`      | `amenityLabels.test.ts`      | Amenity label mapping        |
| 36  | `mapSearchSummaries.ts` | `mapSearchSummaries.test.ts` | Summary card data            |
| 37  | `geolocation.ts`        | `geolocation.test.ts`        | Geolocation helpers          |

**`guest/marketing/showcase/lib/` — 12 new test files**

| #   | File                         | Test file to create               | Test cases                |
| --- | ---------------------------- | --------------------------------- | ------------------------- |
| 38  | `showcaseBrandPalette.ts`    | `showcaseBrandPalette.test.ts`    | Palette from brand color  |
| 39  | `showcasePresetPalettes.ts`  | `showcasePresetPalettes.test.ts`  | Preset palette list       |
| 40  | `showcaseThemeTokens.ts`     | `showcaseThemeTokens.test.ts`     | Token generation          |
| 41  | `showcaseTypographyScale.ts` | `showcaseTypographyScale.test.ts` | Type scale                |
| 42  | `showcaseStyleConfig.ts`     | `showcaseStyleConfig.test.ts`     | Style config per template |
| 43  | `showcaseSectionLayout.ts`   | `showcaseSectionLayout.test.ts`   | Section layout rules      |
| 44  | `showcaseHeroLayout.ts`      | `showcaseHeroLayout.test.ts`      | Hero layout variants      |
| 45  | `showcaseHeroEyebrow.ts`     | `showcaseHeroEyebrow.test.ts`     | Eyebrow text generation   |
| 46  | `showcaseHostContent.ts`     | `showcaseHostContent.test.ts`     | Host content display      |
| 47  | `showcaseLocation.ts`        | `showcaseLocation.test.ts`        | Location display          |
| 48  | `showcasePaths.ts`           | `showcasePaths.test.ts`           | Showcase URL paths        |
| 49  | `showcasePaletteSurfaces.ts` | `showcasePaletteSurfaces.test.ts` | Surface color resolution  |

**`guest/marketing/contact/lib/` — 1 new test file**

| #   | File                     | Test file to create           | Test cases               |
| --- | ------------------------ | ----------------------------- | ------------------------ |
| 50  | `publicContactParams.ts` | `publicContactParams.test.ts` | Contact form param parse |

**`guest/marketing/forms/lib/` — 1 new test file**

| #   | File                 | Test file to create       | Test cases        |
| --- | -------------------- | ------------------------- | ----------------- |
| 51  | `parkingFormCopy.ts` | `parkingFormCopy.test.ts` | Form copy strings |

**`guest/marketing/hosts/lib/` — 1 new test file**

| #   | File                 | Test file to create       | Test cases              |
| --- | -------------------- | ------------------------- | ----------------------- |
| 52  | `hostListingGrid.ts` | `hostListingGrid.test.ts` | Grid layout calculation |

**Session 12 total: 52 new test files**

---

### Session 13: Page editor, PDF exports, and remaining (P3)

**`dashboard/page-editor/lib/` — 7 new test files**

| #   | File                                      | Test file to create                            | Test cases                    |
| --- | ----------------------------------------- | ---------------------------------------------- | ----------------------------- |
| 1   | `pageEditorPublicLinks.ts`                | `pageEditorPublicLinks.test.ts`                | Public link generation        |
| 2   | `showcaseSectionEditorCopy.ts`            | `showcaseSectionEditorCopy.test.ts`            | Editor copy strings           |
| 3   | `showcaseSectionEditorFields.ts`          | `showcaseSectionEditorFields.test.ts`          | Field definitions per section |
| 4   | `showcaseTemplatePresentation.ts`         | `showcaseTemplatePresentation.test.ts`         | Template display data         |
| 5   | `showcaseTemplateThumbData.ts`            | `showcaseTemplateThumbData.test.ts`            | Thumbnail data generation     |
| 6   | `stayGuideChapterSections.ts`             | `stayGuideChapterSections.test.ts`             | Chapter/section structure     |
| 7   | `stayGuideTemplateThumbData.ts`           | `stayGuideTemplateThumbData.test.ts`           | Thumbnail data                |
| 8   | `resolveShowcaseTemplatePickerPalette.ts` | `resolveShowcaseTemplatePickerPalette.test.ts` | Palette resolution            |

**`dashboard/finance/lib/` PDF — 3 new test files**

| #   | File                         | Test file to create     | Test cases            |
| --- | ---------------------------- | ----------------------- | --------------------- |
| 9   | `exportPdf.ts` (finance)     | `exportPdf.test.ts`     | PDF data assembly     |
| 10  | `pdfFormatters.ts` (finance) | `pdfFormatters.test.ts` | Currency, date format |
| 11  | `pdfTheme.ts` (finance)      | `pdfTheme.test.ts`      | Theme tokens          |

**`dashboard/maintenance/lib/` PDF — 1 new test file**

| #   | File                         | Test file to create | Test cases |
| --- | ---------------------------- | ------------------- | ---------- |
| 12  | `exportPdf.ts` (maintenance) | `exportPdf.test.ts` | PDF data   |

**`dashboard/analytics/lib/` PDF — 1 new test file**

| #   | File                       | Test file to create | Test cases        |
| --- | -------------------------- | ------------------- | ----------------- |
| 13  | `exportPdf.ts` (analytics) | `exportPdf.test.ts` | PDF data assembly |

**Remaining shared `lib/` files — 5 new test files**

| #   | File                                 | Test file to create                       | Test cases                      |
| --- | ------------------------------------ | ----------------------------------------- | ------------------------------- |
| 14  | `lib/media/imageOptimizationPlan.ts` | `lib/media/imageOptimizationPlan.test.ts` | Optimization plan per surface   |
| 15  | `lib/media/mediaTelemetry.ts`        | `lib/media/mediaTelemetry.test.ts`        | Telemetry event shape           |
| 16  | `lib/pwa/capabilities.ts`            | `lib/pwa/capabilities.test.ts`            | Feature detection helpers       |
| 17  | `lib/pwa/share.ts`                   | `lib/pwa/share.test.ts`                   | Share API payload construction  |
| 18  | `lib/query/refetchWhenVisible.ts`    | `lib/query/refetchWhenVisible.test.ts`    | Visibility-based refetch config |

**`dashboard/lib/` — 1 new test file**

| #   | File                    | Test file to create          | Test cases                 |
| --- | ----------------------- | ---------------------------- | -------------------------- |
| 19  | `storedMediaDisplay.ts` | `storedMediaDisplay.test.ts` | Media display URL/fallback |

**Session 13 total: 19 new test files**

---

## Summary

| Session   | Domain                                  | New tests | Priority |
| --------- | --------------------------------------- | --------- | -------- |
| 1         | Shared utilities and core lib           | 47        | P0/P1    |
| 2         | Booking workflow and email              | 53        | P0       |
| 3         | Team permissions and plans              | 46        | P0       |
| 4         | Guest form, calendar, operational flows | 34        | P1       |
| 5         | Org dashboard and settings              | 67        | P1       |
| 6         | Property dashboard modules              | 33        | P1       |
| 7         | Inbox and marketing                     | 38        | P2       |
| 8         | Analytics, activity, announcements      | 20        | P2       |
| 9         | Parking dashboard                       | 14        | P2       |
| 10        | Super admin                             | 24        | P2       |
| 11        | AI assistant                            | 14        | P2       |
| 12        | Public marketing and search             | 52        | P2       |
| 13        | Page editor, PDF, remaining             | 19        | P3       |
| **Total** |                                         | **461**   |          |

Combined with 34 existing tests: **~495 unit test files** for full coverage.

## Files explicitly excluded (N/A)

These categories do not need colocated unit tests:

| Category                                                                 | Reason                                                      |
| ------------------------------------------------------------------------ | ----------------------------------------------------------- |
| `*Api.ts` / `*Query.ts` files that are pure fetch wrappers               | Test at E2E/handler level; only test request shape builders |
| `types.ts` / type-only exports                                           | No runtime logic                                            |
| `*.tsx` component files                                                  | React rendering is E2E territory; extract logic into `.ts`  |
| Mock data files (`mockData.ts`, `inboxMockData.ts`, `inboxMockStore.ts`) | Test infrastructure, not product code                       |
| Motion/animation configs (`*Motion.ts`, `*Easing.ts`)                    | Config objects, no branching logic                          |
| API fetch clients (`edgeClient.ts`, `*Api.ts` with only fetch calls)     | Integration/E2E scope                                       |
| `*Telemetry.ts` / `*Analytics.ts` event emitters                         | Verify event shape only if complex                          |

## Session workflow

```
Per session:
1. Create all test files for the domain
2. Write tests following existing patterns (see workflow.test.ts, planPresentation.test.ts)
3. Run `bun run test` — all green
4. Run `bun run ci:quality` at session end
5. Commit with: `test: add unit tests for <domain>`
6. /clear → next session
```

## Docs to update

| Doc                                      | Update                                                        |
| ---------------------------------------- | ------------------------------------------------------------- |
| `docs/guides/testing/README.md`          | Add "Comprehensive unit coverage" section with progress table |
| `docs/workflow/planned/README.md`        | Add index row                                                 |
| Route guides (`docs/guides/routes/*.md`) | Update Testing rows as each session completes                 |

## Open questions

1. **API wrapper tests:** Some `*Api.ts` files contain request-building logic mixed with fetch calls. Extract testable logic or test the shape only?
2. **Store tests:** Zustand-like stores (`*IssuesStore.ts`, `*MockStore.ts`) may need a test harness. Use `zustand/testing` or test the pure action functions directly?
3. **Session pacing:** 13 sessions at ~30-50 files each. One session per day, or batch multiple in a sitting?

## Success criteria

- Every `lib/*.ts` file with branching logic has a colocated `.test.ts`
- `bun run test` passes with 0 failures
- `bun run ci:quality` passes
- No lib file without a test or an explicit N/A annotation
- Route guide Testing columns are updated per session
