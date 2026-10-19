---
title: 'Route coverage map'
status: active
updated: 2026-10-19
stage: in-progress
kind: reference
readiness: unverified
launch_gate: A
---

# Route coverage map

Generated 2026-10-19 from 98 route guides and 67 Playwright specs. Filename heuristic only. Missing E2E is 🆕 for Phase 7, not automatic fail.

| Guide | Testing section | Mentions E2E | Matching spec files |
| ----- | --------------- | ------------ | ------------------- |
| [`accept-invite.md`](../../../docs/guides/routes/accept-invite.md) | yes | yes | auth/acceptInviteSmoke.spec.ts |
| [`account/favorites.md`](../../../docs/guides/routes/account/favorites.md) | yes | yes | account/favoritesSmoke.spec.ts |
| [`account/index.md`](../../../docs/guides/routes/account/index.md) | yes | yes | — |
| [`account/messages.md`](../../../docs/guides/routes/account/messages.md) | yes | yes | — |
| [`account/profile.md`](../../../docs/guides/routes/account/profile.md) | yes | yes | — |
| [`account/stays.md`](../../../docs/guides/routes/account/stays.md) | yes | yes | — |
| [`account/tickets.md`](../../../docs/guides/routes/account/tickets.md) | yes | yes | — |
| [`account/trips.md`](../../../docs/guides/routes/account/trips.md) | **no** | no | — |
| [`account/vouchers.md`](../../../docs/guides/routes/account/vouchers.md) | yes | yes | vouchers/flows/voucherRedemptionMocked.spec.ts, vouchers/flows/voucherRevealStylesDemo.spec.ts, vouchers/guest/voucherFormApply.spec.ts, vouchers/guest/voucherRevealClaim.spec.ts, vouchers/guest/voucherWallet.spec.ts, vouchers/host/voucherBookingDetailPricing.spec.ts, vouchers/host/voucherRevealStyleSettings.spec.ts |
| [`account/wishlist.md`](../../../docs/guides/routes/account/wishlist.md) | yes | yes | — |
| [`admin/ai.md`](../../../docs/guides/routes/admin/ai.md) | yes | yes | admin/adminAiConsole.spec.ts, analytics/aiReviewPlaybook.spec.ts, assistant/assistantAiMode.spec.ts, marketing/marketingAiGenerate.spec.ts, marketing/marketingAiPost.spec.ts, org/orgAiSettingsToggleOnly.spec.ts, parking/host/parkingHostClaim.spec.ts, plans/gates/bookingDetailPlanGates.spec.ts, vouchers/guest/voucherRevealClaim.spec.ts, vouchers/host/voucherBookingDetailPricing.spec.ts |
| [`admin/announcements.md`](../../../docs/guides/routes/admin/announcements.md) | yes | yes | — |
| [`admin/approvals.md`](../../../docs/guides/routes/admin/approvals.md) | yes | yes | admin/adminApprovalsSmoke.spec.ts |
| [`admin/development-detail.md`](../../../docs/guides/routes/admin/development-detail.md) | yes | yes | plans/gates/bookingDetailPlanGates.spec.ts, vouchers/host/voucherBookingDetailPricing.spec.ts |
| [`admin/developments.md`](../../../docs/guides/routes/admin/developments.md) | yes | yes | — |
| [`admin/health.md`](../../../docs/guides/routes/admin/health.md) | yes | yes | admin/adminSystemHealth.spec.ts |
| [`admin/host-detail.md`](../../../docs/guides/routes/admin/host-detail.md) | yes | yes | parking/flows/parkingGuestHostOutcomes.spec.ts, parking/flows/parkingGuestHostSideBySide.spec.ts, parking/host/parkingHostClaim.spec.ts, parking/host/parkingHostNewBooking.spec.ts, parking/live/parkingGuestHostLocal.spec.ts, plans/gates/bookingDetailPlanGates.spec.ts, plans/public/forHostsPricing.spec.ts, vouchers/host/voucherBookingDetailPricing.spec.ts, vouchers/host/voucherRevealStyleSettings.spec.ts |
| [`admin/hosts.md`](../../../docs/guides/routes/admin/hosts.md) | yes | yes | parking/flows/parkingGuestHostSideBySide.spec.ts, plans/public/forHostsPricing.spec.ts |
| [`admin/org-properties.md`](../../../docs/guides/routes/admin/org-properties.md) | yes | yes | — |
| [`admin/org-subscriptions.md`](../../../docs/guides/routes/admin/org-subscriptions.md) | yes | yes | — |
| [`admin/orgs.md`](../../../docs/guides/routes/admin/orgs.md) | yes | yes | org/orgSettingsSave.spec.ts |
| [`admin/overview.md`](../../../docs/guides/routes/admin/overview.md) | yes | yes | — |
| [`admin/parking-payouts.md`](../../../docs/guides/routes/admin/parking-payouts.md) | yes | yes | parking/flows/parkingGuestHostOutcomes.spec.ts, parking/flows/parkingGuestHostSideBySide.spec.ts, parking/guest/guestFormParkingCta.spec.ts, parking/guest/parkingGuestRequest.spec.ts, parking/guest/parkingMarketplaceEdgeCases.spec.ts, parking/host/parkingHostClaim.spec.ts, parking/host/parkingHostNewBooking.spec.ts, parking/legacy/payParkingFlow.spec.ts, parking/live/parkingGuestHostLocal.spec.ts, parking/property/propertyBookingFreeManualWorkflow.spec.ts, parking/property/propertyBookingLinkedParking.spec.ts |
| [`admin/payment-settings.md`](../../../docs/guides/routes/admin/payment-settings.md) | yes | yes | org/copyPropertySettingsDryRun.spec.ts, org/orgAiSettingsToggleOnly.spec.ts, org/orgSettingsSave.spec.ts, vouchers/host/voucherRevealStyleSettings.spec.ts |
| [`admin/platform-properties.md`](../../../docs/guides/routes/admin/platform-properties.md) | yes | yes | — |
| [`admin/platform-tools.md`](../../../docs/guides/routes/admin/platform-tools.md) | yes | yes | — |
| [`admin/playbook.md`](../../../docs/guides/routes/admin/playbook.md) | **no** | yes | analytics/aiReviewPlaybook.spec.ts |
| [`admin/pricing-plans.md`](../../../docs/guides/routes/admin/pricing-plans.md) | yes | yes | plans/gates/bookingDetailPlanGates.spec.ts, plans/gates/featureGates.spec.ts, plans/gates/inboxStayGuideGate.spec.ts, plans/org/orgPlanCheckout.spec.ts, plans/org/orgPlanDowngrade.spec.ts, plans/org/orgPlanReviewDialog.spec.ts, plans/org/orgPlansCardsCompare.spec.ts, plans/public/forHostsPricing.spec.ts, vouchers/host/voucherBookingDetailPricing.spec.ts |
| [`admin/settings.md`](../../../docs/guides/routes/admin/settings.md) | yes | yes | org/copyPropertySettingsDryRun.spec.ts, org/orgAiSettingsToggleOnly.spec.ts, org/orgSettingsSave.spec.ts, vouchers/host/voucherRevealStyleSettings.spec.ts |
| [`admin/support.md`](../../../docs/guides/routes/admin/support.md) | yes | yes | — |
| [`auth.md`](../../../docs/guides/routes/auth.md) | yes | yes | auth/acceptInviteSmoke.spec.ts, auth/authPagesSmoke.spec.ts, auth/authRedirectSmoke.spec.ts, auth/legacyRedirectSmoke.spec.ts, auth/legacyRouteRedirectSmoke.spec.ts |
| [`bookings/parking.md`](../../../docs/guides/routes/bookings/parking.md) | yes | yes | parking/flows/parkingGuestHostOutcomes.spec.ts, parking/flows/parkingGuestHostSideBySide.spec.ts, parking/guest/guestFormParkingCta.spec.ts, parking/guest/parkingGuestRequest.spec.ts, parking/guest/parkingMarketplaceEdgeCases.spec.ts, parking/host/parkingHostClaim.spec.ts, parking/host/parkingHostNewBooking.spec.ts, parking/legacy/payParkingFlow.spec.ts, parking/live/parkingGuestHostLocal.spec.ts, parking/property/propertyBookingFreeManualWorkflow.spec.ts, parking/property/propertyBookingLinkedParking.spec.ts |
| [`calendar.md`](../../../docs/guides/routes/calendar.md) | yes | yes | guest-form/guestCalendarSmoke.spec.ts |
| [`developments.md`](../../../docs/guides/routes/developments.md) | yes | yes | — |
| [`for-hosts.md`](../../../docs/guides/routes/for-hosts.md) | yes | yes | parking/flows/parkingGuestHostSideBySide.spec.ts, plans/public/forHostsPricing.spec.ts |
| [`form.md`](../../../docs/guides/routes/form.md) | yes | yes | guest-form/guestCalendarSmoke.spec.ts, guest-form/guestFormLoad.spec.ts, guest-form/guestFormSubmit.spec.ts, guest-form/sdFormSubmit.spec.ts, guest-form/stayGuideToken.spec.ts, parking/guest/guestFormParkingCta.spec.ts, vouchers/guest/voucherFormApply.spec.ts |
| [`guest-booking-document.md`](../../../docs/guides/routes/guest-booking-document.md) | yes | no | bookings/propertyBookingProceed.spec.ts, guest-chat/voiceReceptionistConsent.spec.ts, guest-form/guestCalendarSmoke.spec.ts, guest-form/guestFormLoad.spec.ts, guest-form/guestFormSubmit.spec.ts, guest-form/sdFormSubmit.spec.ts, guest-form/stayGuideToken.spec.ts, parking/flows/parkingGuestHostOutcomes.spec.ts, parking/flows/parkingGuestHostSideBySide.spec.ts, parking/guest/guestFormParkingCta.spec.ts, parking/guest/parkingGuestRequest.spec.ts, parking/guest/parkingMarketplaceEdgeCases.spec.ts, parking/host/parkingHostNewBooking.spec.ts, parking/live/parkingGuestHostLocal.spec.ts, parking/property/propertyBookingFreeManualWorkflow.spec.ts, parking/property/propertyBookingLinkedParking.spec.ts, plans/gates/bookingDetailPlanGates.spec.ts, reviews/guestWriteReview.spec.ts, vouchers/guest/voucherFormApply.spec.ts, vouchers/guest/voucherRevealClaim.spec.ts, vouchers/guest/voucherWallet.spec.ts, vouchers/host/voucherBookingDetailPricing.spec.ts |
| [`index-landing.md`](../../../docs/guides/routes/index-landing.md) | **no** | yes | — |
| [`legal.md`](../../../docs/guides/routes/legal.md) | **no** | yes | — |
| [`onboarding.md`](../../../docs/guides/routes/onboarding.md) | yes | yes | onboarding/onboardingSmoke.spec.ts |
| [`org/activity.md`](../../../docs/guides/routes/org/activity.md) | yes | yes | — |
| [`org/analytics.md`](../../../docs/guides/routes/org/analytics.md) | yes | yes | analytics/aiReviewPlaybook.spec.ts |
| [`org/announcements.md`](../../../docs/guides/routes/org/announcements.md) | **no** | yes | — |
| [`org/assistant.md`](../../../docs/guides/routes/org/assistant.md) | **no** | yes | assistant/assistantAiMode.spec.ts, assistant/assistantConfirmCards.spec.ts, assistant/assistantLiveLocal.spec.ts, assistant/assistantSmoke.spec.ts |
| [`org/bookings.md`](../../../docs/guides/routes/org/bookings.md) | yes | yes | bookings/propertyBookingProceed.spec.ts |
| [`org/dashboard.md`](../../../docs/guides/routes/org/dashboard.md) | yes | yes | dashboard/dashboardModulesSmoke.spec.ts |
| [`org/help-support.md`](../../../docs/guides/routes/org/help-support.md) | yes | yes | — |
| [`org/inbox.md`](../../../docs/guides/routes/org/inbox.md) | yes | yes | inbox/inboxThreadListSmoke.spec.ts, plans/gates/inboxStayGuideGate.spec.ts |
| [`org/parking/activity.md`](../../../docs/guides/routes/org/parking/activity.md) | yes | yes | — |
| [`org/parking/announcements.md`](../../../docs/guides/routes/org/parking/announcements.md) | yes | yes | — |
| [`org/parking/bookings.md`](../../../docs/guides/routes/org/parking/bookings.md) | yes | yes | bookings/propertyBookingProceed.spec.ts |
| [`org/parking/dashboard.md`](../../../docs/guides/routes/org/parking/dashboard.md) | yes | yes | dashboard/dashboardModulesSmoke.spec.ts |
| [`org/parking/finance.md`](../../../docs/guides/routes/org/parking/finance.md) | yes | yes | — |
| [`org/parking/help-support.md`](../../../docs/guides/routes/org/parking/help-support.md) | yes | yes | — |
| [`org/parking/inbox.md`](../../../docs/guides/routes/org/parking/inbox.md) | yes | yes | inbox/inboxThreadListSmoke.spec.ts, plans/gates/inboxStayGuideGate.spec.ts |
| [`org/parking/notifications.md`](../../../docs/guides/routes/org/parking/notifications.md) | yes | yes | — |
| [`org/parking/pricing.md`](../../../docs/guides/routes/org/parking/pricing.md) | yes | yes | plans/public/forHostsPricing.spec.ts, vouchers/host/voucherBookingDetailPricing.spec.ts |
| [`org/parking/settings.md`](../../../docs/guides/routes/org/parking/settings.md) | yes | yes | org/copyPropertySettingsDryRun.spec.ts, org/orgAiSettingsToggleOnly.spec.ts, org/orgSettingsSave.spec.ts, vouchers/host/voucherRevealStyleSettings.spec.ts |
| [`org/parking/team.md`](../../../docs/guides/routes/org/parking/team.md) | yes | yes | team/propertyTeamNavRbac.spec.ts, team/propertyTeamPermissionCatalog.spec.ts |
| [`org/parkings.md`](../../../docs/guides/routes/org/parkings.md) | yes | yes | — |
| [`org/plans.md`](../../../docs/guides/routes/org/plans.md) | yes | yes | plans/gates/bookingDetailPlanGates.spec.ts, plans/gates/featureGates.spec.ts, plans/gates/inboxStayGuideGate.spec.ts, plans/org/orgPlanCheckout.spec.ts, plans/org/orgPlanDowngrade.spec.ts, plans/org/orgPlanReviewDialog.spec.ts, plans/org/orgPlansCardsCompare.spec.ts, plans/public/forHostsPricing.spec.ts |
| [`org/properties.md`](../../../docs/guides/routes/org/properties.md) | yes | yes | — |
| [`org/property/activity.md`](../../../docs/guides/routes/org/property/activity.md) | yes | yes | — |
| [`org/property/analytics.md`](../../../docs/guides/routes/org/property/analytics.md) | **no** | yes | analytics/aiReviewPlaybook.spec.ts |
| [`org/property/announcements.md`](../../../docs/guides/routes/org/property/announcements.md) | yes | yes | — |
| [`org/property/bookings-detail.md`](../../../docs/guides/routes/org/property/bookings-detail.md) | yes | yes | bookings/propertyBookingProceed.spec.ts, plans/gates/bookingDetailPlanGates.spec.ts, vouchers/host/voucherBookingDetailPricing.spec.ts |
| [`org/property/bookings.md`](../../../docs/guides/routes/org/property/bookings.md) | yes | yes | bookings/propertyBookingProceed.spec.ts |
| [`org/property/calendar.md`](../../../docs/guides/routes/org/property/calendar.md) | yes | yes | guest-form/guestCalendarSmoke.spec.ts |
| [`org/property/custom-pages.md`](../../../docs/guides/routes/org/property/custom-pages.md) | yes | yes | auth/authPagesSmoke.spec.ts, public/publicPagesSmoke.spec.ts |
| [`org/property/dashboard.md`](../../../docs/guides/routes/org/property/dashboard.md) | yes | yes | dashboard/dashboardModulesSmoke.spec.ts |
| [`org/property/finance.md`](../../../docs/guides/routes/org/property/finance.md) | yes | yes | — |
| [`org/property/help-support.md`](../../../docs/guides/routes/org/property/help-support.md) | yes | yes | — |
| [`org/property/inbox.md`](../../../docs/guides/routes/org/property/inbox.md) | yes | yes | inbox/inboxThreadListSmoke.spec.ts, plans/gates/inboxStayGuideGate.spec.ts |
| [`org/property/maintenance.md`](../../../docs/guides/routes/org/property/maintenance.md) | yes | yes | — |
| [`org/property/marketing.md`](../../../docs/guides/routes/org/property/marketing.md) | yes | yes | marketing/marketingAiGenerate.spec.ts, marketing/marketingAiPost.spec.ts, marketing/marketingCollage.spec.ts, marketing/marketingStudioSmoke.spec.ts, marketing/marketingThemes.spec.ts |
| [`org/property/notifications.md`](../../../docs/guides/routes/org/property/notifications.md) | yes | yes | — |
| [`org/property/operations.md`](../../../docs/guides/routes/org/property/operations.md) | yes | yes | — |
| [`org/property/pricing.md`](../../../docs/guides/routes/org/property/pricing.md) | yes | yes | plans/public/forHostsPricing.spec.ts, vouchers/host/voucherBookingDetailPricing.spec.ts |
| [`org/property/public-pages.md`](../../../docs/guides/routes/org/property/public-pages.md) | yes | yes | auth/authPagesSmoke.spec.ts, plans/public/forHostsPricing.spec.ts, public/publicListingBrowse.spec.ts, public/publicPagesSmoke.spec.ts |
| [`org/property/settings.md`](../../../docs/guides/routes/org/property/settings.md) | yes | yes | org/copyPropertySettingsDryRun.spec.ts, org/orgAiSettingsToggleOnly.spec.ts, org/orgSettingsSave.spec.ts, vouchers/host/voucherRevealStyleSettings.spec.ts |
| [`org/property/staff.md`](../../../docs/guides/routes/org/property/staff.md) | yes | yes | — |
| [`org/property/team.md`](../../../docs/guides/routes/org/property/team.md) | yes | yes | team/propertyTeamNavRbac.spec.ts, team/propertyTeamPermissionCatalog.spec.ts |
| [`org/property/templates.md`](../../../docs/guides/routes/org/property/templates.md) | yes | yes | — |
| [`org/selector.md`](../../../docs/guides/routes/org/selector.md) | yes | yes | — |
| [`org/settings.md`](../../../docs/guides/routes/org/settings.md) | yes | yes | org/copyPropertySettingsDryRun.spec.ts, org/orgAiSettingsToggleOnly.spec.ts, org/orgSettingsSave.spec.ts, vouchers/host/voucherRevealStyleSettings.spec.ts |
| [`org/setup-guide.md`](../../../docs/guides/routes/org/setup-guide.md) | yes | yes | guest-form/stayGuideToken.spec.ts, plans/gates/inboxStayGuideGate.spec.ts |
| [`org/team.md`](../../../docs/guides/routes/org/team.md) | yes | yes | team/propertyTeamNavRbac.spec.ts, team/propertyTeamPermissionCatalog.spec.ts |
| [`parkings.md`](../../../docs/guides/routes/parkings.md) | yes | yes | — |
| [`properties.md`](../../../docs/guides/routes/properties.md) | yes | yes | — |
| [`properties/chat.md`](../../../docs/guides/routes/properties/chat.md) | yes | yes | guest-chat/voiceReceptionistConsent.spec.ts |
| [`property-showcase.md`](../../../docs/guides/routes/property-showcase.md) | yes | yes | bookings/propertyBookingProceed.spec.ts, org/copyPropertySettingsDryRun.spec.ts, parking/property/propertyBookingFreeManualWorkflow.spec.ts, parking/property/propertyBookingLinkedParking.spec.ts, team/propertyTeamNavRbac.spec.ts, team/propertyTeamPermissionCatalog.spec.ts |
| [`sd-form.md`](../../../docs/guides/routes/sd-form.md) | yes | yes | guest-form/guestCalendarSmoke.spec.ts, guest-form/guestFormLoad.spec.ts, guest-form/guestFormSubmit.spec.ts, guest-form/sdFormSubmit.spec.ts, guest-form/stayGuideToken.spec.ts, parking/guest/guestFormParkingCta.spec.ts, vouchers/guest/voucherFormApply.spec.ts |
| [`search.md`](../../../docs/guides/routes/search.md) | yes | yes | — |
| [`services.md`](../../../docs/guides/routes/services.md) | yes | yes | — |
| [`sign-in.md`](../../../docs/guides/routes/sign-in.md) | yes | yes | — |
| [`stay-guide.md`](../../../docs/guides/routes/stay-guide.md) | yes | yes | guest-form/stayGuideToken.spec.ts, plans/gates/inboxStayGuideGate.spec.ts |
| [`success.md`](../../../docs/guides/routes/success.md) | yes | yes | — |
| [`trip.md`](../../../docs/guides/routes/trip.md) | yes | yes | — |

**Guides with no filename-matched E2E:** 45/98. Confirm in Phase 7 before treating as a gap (shared specs cover many routes).
