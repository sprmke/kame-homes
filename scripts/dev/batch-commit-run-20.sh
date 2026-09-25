#!/usr/bin/env bash
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
git reset HEAD >/dev/null 2>&1 || true

commit() {
  git add -- "$@"
  git commit -m "$MSG"
}

MSG="$(cat <<'EOF'
feat(supabase): add production readiness database migrations

Ship query cache, email suppressions, RLS gaps, indexes, and stay-date sort columns.
EOF
)"
commit \
  supabase/migrations/20261316121500_guest_submissions_stay_date_sort_columns.sql \
  supabase/migrations/20261316121600_request_role_statement_timeouts.sql \
  supabase/migrations/20261316121700_query_cache_table.sql \
  supabase/migrations/20261316121800_fk_and_access_pattern_indexes.sql \
  supabase/migrations/20261316121900_rls_deny_by_default_gaps.sql \
  supabase/migrations/20261316122000_email_suppressions_table.sql \
  supabase/migrations/20261316122100_email_suppressions_comment_scope.sql

MSG="$(cat <<'EOF'
feat(supabase): add query cache request log and mime sniff helpers

Add shared query cache, structured request logging, and upload mime sniffing with tests.
EOF
)"
commit \
  supabase/functions/_shared/queryCache.ts \
  supabase/functions/_shared/queryCache_test.ts \
  supabase/functions/_shared/requestLog.ts \
  supabase/functions/_shared/requestLog_test.ts \
  supabase/functions/_shared/emailSuppression.ts \
  supabase/functions/_shared/safeOutboundUrl.ts \
  supabase/functions/_shared/safeOutboundUrl_test.ts \
  supabase/functions/_shared/sniffMime.ts \
  supabase/functions/_shared/sniffMime_test.ts \
  supabase/functions/query-cache-sweep-cron/index.ts

MSG="$(cat <<'EOF'
feat(supabase): harden serve edge cors and rate limiting

Extend serveEdge wrapper, cors policy, http responses, and authenticated rate limits.
EOF
)"
commit \
  supabase/functions/_shared/serveEdge.ts \
  supabase/functions/_shared/cors.ts \
  supabase/functions/_shared/httpResponse.ts \
  supabase/functions/_shared/rateLimit.ts \
  supabase/functions/_shared/orgAuth.ts \
  supabase/functions/tests/authWrapperRejection.test.ts \
  supabase/functions/get-health/index.ts \
  supabase/config.toml

MSG="$(cat <<'EOF'
feat(supabase): unify storage upload pipelines batch 1

Align app, booking, guest chat, and org verification upload helpers with sniffMime.
EOF
)"
commit \
  supabase/functions/_shared/storageUpload.ts \
  supabase/functions/_shared/storageSignedUrl.ts \
  supabase/functions/_shared/uploadService.ts \
  supabase/functions/_shared/appSettingsAssetUpload.ts \
  supabase/functions/_shared/bookingAssetUpload.ts \
  supabase/functions/_shared/gcashQrStageUpload.ts \
  supabase/functions/_shared/inboxChatAssetUpload.ts \
  supabase/functions/_shared/listingAuthorizationAssetUpload.ts \
  supabase/functions/_shared/orgVerificationAssetUpload.ts \
  supabase/functions/_shared/orgTeamLogoUpload.ts

MSG="$(cat <<'EOF'
feat(supabase): unify storage upload pipelines batch 2

Align property, parking, marketing, and support ticket upload helpers.
EOF
)"
commit \
  supabase/functions/_shared/parkingMediaUpload.ts \
  supabase/functions/_shared/propertyMediaUpload.ts \
  supabase/functions/_shared/propertyMedia.ts \
  supabase/functions/_shared/propertyAssetClone.ts \
  supabase/functions/_shared/marketingMediaUpload.ts \
  supabase/functions/_shared/marketingMusicStorage.ts \
  supabase/functions/_shared/marketingGenerationStorage.ts \
  supabase/functions/_shared/supportTicketAttachments.ts \
  supabase/functions/_shared/propertyTemplateAssetUpload.ts \
  supabase/functions/_shared/bookingDocumentShareToken.ts

MSG="$(cat <<'EOF'
feat(supabase): extend core services and property templates email

Update database, email, workflow, finance, and custom template email delivery paths.
EOF
)"
commit \
  supabase/functions/_shared/databaseService.ts \
  supabase/functions/_shared/emailService.ts \
  supabase/functions/_shared/workflowOrchestrator.ts \
  supabase/functions/_shared/financeService.ts \
  supabase/functions/_shared/financeExport.ts \
  supabase/functions/_shared/maintenanceService.ts \
  supabase/functions/_shared/propertyTemplates.ts \
  supabase/functions/_shared/propertyTemplateEmail.ts \
  supabase/functions/send-property-custom-template-email/index.ts \
  supabase/functions/_shared/recurringSeriesScheduleRebuild.ts

MSG="$(cat <<'EOF'
feat(supabase): sync assistant inbox and telegram shared services

Refresh dashboard assistant attachments, inbox AI context, and telegram admin helpers.
EOF
)"
commit \
  supabase/functions/_shared/activityLog.ts \
  supabase/functions/_shared/dashboardAssistantAttachments.ts \
  supabase/functions/_shared/dashboardAssistantContext.ts \
  supabase/functions/_shared/guestBookingAccessToken.ts \
  supabase/functions/_shared/inboxAiGuestContext.ts \
  supabase/functions/_shared/telegramAdmin.ts \
  supabase/functions/_shared/telegramStaff.ts \
  supabase/functions/approval-email-webhook/index.ts \
  supabase/functions/dashboard-assistant-global-settings/index.ts \
  supabase/functions/dashboard-stats/index.ts

MSG="$(cat <<'EOF'
feat(supabase): harden public read edge handlers batch 1

Add caching and logging to public property, parking, showcase, and listing endpoints.
EOF
)"
commit \
  supabase/functions/get-public-property/index.ts \
  supabase/functions/get-public-parking/index.ts \
  supabase/functions/get-public-host/index.ts \
  supabase/functions/get-public-showcase/index.ts \
  supabase/functions/get-public-platform-status/index.ts \
  supabase/functions/list-public-properties/index.ts \
  supabase/functions/list-public-parkings/index.ts \
  supabase/functions/list-public-developments/index.ts \
  supabase/functions/list-public-place-groups/index.ts \
  supabase/functions/list-public-pricing-plans/index.ts

MSG="$(cat <<'EOF'
feat(supabase): harden public read edge handlers batch 2

Extend search, booked dates, residence types, and submit-form public paths.
EOF
)"
commit \
  supabase/functions/search-listings/index.ts \
  supabase/functions/search-suggestions/index.ts \
  supabase/functions/get-booked-dates/index.ts \
  supabase/functions/get-residence-unit-types/index.ts \
  supabase/functions/submit-form/index.ts \
  supabase/functions/pricing-plans/index.ts \
  supabase/functions/platform-parking-settings/index.ts \
  supabase/functions/platform-payment-settings/index.ts \
  supabase/functions/import-parse-file/index.ts \
  supabase/functions/cancel-booking/index.ts

MSG="$(cat <<'EOF'
feat(supabase): sync admin upload and support edge handlers

Update upload handlers, help center, host playbook, platform settings, and support admin routes.
EOF
)"
commit \
  supabase/functions/upload-app-settings-asset/index.ts \
  supabase/functions/upload-development-media/index.ts \
  supabase/functions/upload-guest-chat-asset/index.ts \
  supabase/functions/upload-guest-profile-asset/index.ts \
  supabase/functions/upload-parking-settings-asset/index.ts \
  supabase/functions/upload-support-ticket-attachment/index.ts \
  supabase/functions/create-help-center-faq/index.ts \
  supabase/functions/update-help-center-faq/index.ts \
  supabase/functions/delete-help-center-faq/index.ts \
  supabase/functions/super-admin-overview/index.ts \
  supabase/functions/create-host-playbook-article/index.ts \
  supabase/functions/update-host-playbook-article/index.ts \
  supabase/functions/delete-host-playbook-article/index.ts \
  supabase/functions/decide-contract-consideration/index.ts \
  supabase/functions/update-platform-host-settings/index.ts \
  supabase/functions/reply-support-ticket-admin/index.ts \
  supabase/functions/update-support-ticket-status/index.ts

MSG="$(cat <<'EOF'
feat(ui): add debounced hooks and html sanitization helpers

Add debounce, throttle, delayed loading hooks, and shared sanitizeHtml utility.
EOF
)"
commit \
  ui/src/hooks/useDebouncedCallback.ts \
  ui/src/hooks/useDelayedLoading.ts \
  ui/src/hooks/useThrottledCallback.ts \
  ui/src/lib/sanitizeHtml.ts \
  ui/src/App.tsx \
  ui/src/components/routing/RouteFallback.tsx \
  ui/src/lib/api/adminEdgeFetch.ts \
  ui/src/features/dashboard/analytics/components/AnalyticsDonutChart.tsx

MSG="$(cat <<'EOF'
feat(ui): extend bookings templates and telegram module wiring

Add send custom template dialog, telegram token hook, and booking table polish.
EOF
)"
commit \
  ui/src/features/dashboard/bookings/components/property-templates/SendCustomTemplateDialog.tsx \
  ui/src/features/dashboard/bookings/components/property-templates/PropertyTemplateEditorCard.tsx \
  ui/src/features/dashboard/bookings/components/property-templates/RichTextEditor.tsx \
  ui/src/features/dashboard/bookings/hooks/useFirstConnectedTelegramModuleToken.ts \
  ui/src/features/dashboard/bookings/hooks/usePropertyTemplates.ts \
  ui/src/features/dashboard/bookings/hooks/useTelegramMarketingSettings.ts \
  ui/src/features/dashboard/bookings/components/telegram-notifications/TelegramGlobalBotTokenCard.tsx \
  ui/src/features/dashboard/bookings/components/BookingEditForm.tsx \
  ui/src/features/dashboard/bookings/components/BookingKanban.tsx \
  ui/src/features/dashboard/bookings/components/BookingTable.tsx

MSG="$(cat <<'EOF'
feat(ui): sync bookings workflow and property settings surfaces

Update parking panel, workflow confirm modal, and property settings card layout.
EOF
)"
commit \
  ui/src/features/dashboard/bookings/components/booking-detail/panels/ParkingPanel.tsx \
  ui/src/features/dashboard/bookings/components/workflow-panel/WorkflowConfirmModal.tsx \
  ui/src/features/dashboard/bookings/components/PropertySettingsCard.tsx \
  ui/src/features/dashboard/custom-pages/components/PublicPageLivePreview.tsx \
  ui/src/features/dashboard/finance/components/OperatingLineItemForm.tsx \
  ui/src/features/dashboard/finance/lib/recurrence.ts \
  ui/src/features/dashboard/maintenance/components/MaintenanceItemForm.tsx \
  ui/src/features/dashboard/inbox/components/InboxConversationView.tsx \
  ui/src/features/dashboard/inbox/lib/inboxMockStore.ts \
  ui/src/features/dashboard/inbox/pages/InboxPage.tsx

MSG="$(cat <<'EOF'
feat(ui): refresh guest landing and for-hosts marketing pages

Remove legacy testimonial blocks and tighten landing social proof content.
EOF
)"
commit \
  ui/src/features/guest/marketing/guest-landing/components/LandingSocialProof.tsx \
  ui/src/features/guest/marketing/guest-landing/components/Testimonials.tsx \
  ui/src/features/guest/marketing/guest-landing/components/TrustIndicators.tsx \
  ui/src/features/guest/marketing/guest-landing/components/index.ts \
  ui/src/features/guest/marketing/guest-landing/data/landingContent.ts \
  ui/src/features/guest/marketing/for-hosts/components/HostReviews.tsx \
  ui/src/features/guest/marketing/for-hosts/data/hostTestimonials.ts \
  ui/src/features/guest/marketing/pages/ForHostsPage.tsx \
  ui/src/features/guest/marketing/pages/ForHostsPreviewPage.tsx \
  ui/public/images/hero-banner.png

MSG="$(cat <<'EOF'
feat(ui): sync public property and parking guest surfaces

Update property cards, booking card, parking request flow, and search results page.
EOF
)"
commit \
  ui/src/features/guest/marketing/properties/components/PropertyCard.tsx \
  ui/src/features/guest/marketing/properties/components/PropertyListItem.tsx \
  ui/src/features/guest/marketing/properties/components/property-detail/BookingCard.tsx \
  ui/src/features/guest/marketing/properties/components/property-detail/PropertyOverview.tsx \
  ui/src/features/guest/marketing/properties/hooks/useSavePropertyMutation.ts \
  ui/src/features/guest/marketing/properties/lib/propertiesQuery.ts \
  ui/src/features/guest/marketing/properties/types/publicProperty.ts \
  ui/src/features/guest/marketing/parkings/components/ParkingBookingFormModal.tsx \
  ui/src/features/guest/marketing/parkings/components/ParkingRequestStatusView.tsx \
  ui/src/features/guest/marketing/parkings/hooks/usePublicParkingDetail.ts

MSG="$(cat <<'EOF'
feat(ui): sync guest form auth and stay guide pages

Refresh guest form, sd-form API, stay guide rendering, and auth context guards.
EOF
)"
commit \
  ui/src/features/guest/form/components/GuestForm.tsx \
  ui/src/features/guest/auth/context/GuestAuthContext.tsx \
  ui/src/features/guest/sd-form/lib/api.ts \
  ui/src/features/guest/sd-form/pages/SdFormPage.tsx \
  ui/src/features/guest/stay-guide/components/StayGuideRichContent.tsx \
  ui/src/features/guest/stay-guide/pages/StayGuidePage.tsx \
  ui/src/features/guest/search/pages/SearchResultsPage.tsx \
  ui/src/features/guest/marketing/pages/PropertyDetailPage.tsx \
  ui/src/features/guest/marketing/pages/ParkingFormPage.tsx \
  ui/src/features/guest/marketing/developments/components/DevelopmentAvailableSection.tsx

MSG="$(cat <<'EOF'
feat(ui): sync org settings plans and marketing studio polish

Update property settings sections, onboarding stats, and marketing studio shared UI.
EOF
)"
commit \
  ui/src/features/dashboard/org/components/property-settings/PropertyCancellationPolicySection.tsx \
  ui/src/features/dashboard/org/components/property-settings/PropertyProfileSettingsSections.tsx \
  ui/src/features/dashboard/org/components/property-settings/PropertySocialsBrandingSection.tsx \
  ui/src/features/dashboard/org/components/property-settings/PublicPagesCrossLink.tsx \
  ui/src/features/dashboard/org/hooks/useOrgDashboardStats.ts \
  ui/src/features/dashboard/org/hooks/useResidenceUnitTypes.ts \
  ui/src/features/dashboard/org/lib/propertyMedia.ts \
  ui/src/features/dashboard/org/pages/OnboardingPage.tsx \
  ui/src/features/dashboard/plans/components/SubscriptionUpgradeModal.tsx \
  ui/src/features/dashboard/plans/components/UpgradeModalProvider.tsx

MSG="$(cat <<'EOF'
perf(ui): sync posthog telemetry and pwa precache config

Tighten PostHog bootstrap capture and service worker precache manifest updates.
EOF
)"
commit \
  ui/src/lib/posthog/PostHogAdminScopeSync.tsx \
  ui/src/lib/posthog/PostHogIdentitySync.tsx \
  ui/src/lib/posthog/bootstrapTelemetry.ts \
  ui/src/lib/posthog/capture.ts \
  ui/src/pwa/shared.ts \
  ui/src/pwa/sw.ts \
  ui/vercel.json \
  ui/package.json \
  ui/src/features/dashboard/pricing/components/PricingCalendarGrid.tsx \
  ui/src/features/dashboard/super-admin/pages/SuperAdminOrgAiSection.tsx

MSG="$(cat <<'EOF'
test(ui): update smoke e2e harnesses for lazy routes

Refresh guest form, public pages, inbox, and dashboard module smoke intercepts.
EOF
)"
commit \
  ui/e2e/shared/authSeam.ts \
  ui/e2e/features/guest-form/shared/guestFormHarness.ts \
  ui/e2e/features/guest-form/guestFormLoad.spec.ts \
  ui/e2e/features/guest-form/guestFormSubmit.spec.ts \
  ui/e2e/features/guest-form/guestCalendarSmoke.spec.ts \
  ui/e2e/features/public/publicPagesSmoke.spec.ts \
  ui/e2e/features/dashboard/dashboardModulesSmoke.spec.ts \
  ui/e2e/features/inbox/inboxThreadListSmoke.spec.ts \
  ui/e2e/features/onboarding/shared/onboardingHarness.ts \
  ui/e2e/features/account/shared/guestFavoritesHarness.ts

MSG="$(cat <<'EOF'
chore(*): add production readiness ci scripts and agent skills

Wire CI/CD checks, karpathy guidelines, and production-readiness review skill mirrors.
EOF
)"
git add -- \
  .agent/skills/production-readiness-review/SKILL.md \
  .agent/skills/karpathy-guidelines/SKILL.md \
  .claude/skills/production-readiness-review \
  .claude/skills/karpathy-guidelines \
  .cursor/skills/production-readiness-review \
  .cursor/skills/karpathy-guidelines \
  .cursor/rules/karpathy-guidelines.mdc \
  .claude/commands/production-readiness-review.md \
  .cursor/commands/production-readiness-review.md \
  .opencode/commands/production-readiness-review.md \
  .github/workflows/ci.yml \
  .github/workflows/cd-dev.yml \
  .github/CODEOWNERS \
  .github/PULL_REQUEST_TEMPLATE.md \
  scripts/dev/audit-auth-matrix.mjs \
  scripts/dev/audit-edge-functions.mjs \
  scripts/dev/check-authenticated-rate-limit.sh \
  scripts/dev/check-cache-class.sh \
  scripts/dev/check-public-asset-size.sh \
  scripts/dev/check-select-star.sh \
  scripts/dev/check-storage-cache-control.mjs \
  scripts/dev/check-unbounded-select.sh \
  scripts/dev/check-vercel-headers.sh \
  scripts/dev/check-ai-tooling-sync.sh \
  package.json \
  bun.lock \
  deno.lock \
  opencode.json \
  docs/PROJECT.md \
  docs/architecture/deployment.md \
  docs/architecture/edge-functions.md \
  docs/architecture/integrations.md \
  docs/architecture/plans-feature-matrix.md \
  docs/architecture/pwa.md \
  docs/architecture/storage.md \
  docs/archive/operations/README.md \
  docs/archive/operations/incident-response.md \
  docs/archive/operations/migration-runbook.md \
  docs/archive/operations/scheduled-jobs-and-testing.md \
  docs/archive/operations/secret-rotation.md \
  docs/guides/routes/org/property/notifications.md \
  docs/guides/routes/org/property/public-pages.md \
  docs/guides/routes/org/property/settings.md \
  docs/guides/routes/org/property/templates.md \
  .claude/README.md \
  .claude/commands/kh-help.md \
  .cursor/commands/kh-help.md \
  .cursor/hooks.json \
  .cursor/rules/README.md \
  .cursor/rules/ai-usage.mdc \
  .cursor/rules/project-context.mdc \
  .cursor/rules/pwa.mdc \
  .opencode/README.md \
  CLAUDE.md
git commit -m "$MSG"

echo "Done: 20 commits"
