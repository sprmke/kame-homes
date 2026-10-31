#!/usr/bin/env bash
# Batch 9 commits — ~1/3 of working tree (deployable slice). Hold: guest trip hub,
# public listing search/migration, marketing browse UI, for-hosts v3, social remotion WIP.
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

commit() {
  local msg=$1
  shift
  git add "$@"
  git commit -m "$msg"
}

# 1 — workflow: ai receptionist docs → done
commit "docs(docs): move ai receptionist passes to done" \
  docs/workflow/done/ai-receptionist-experience-pass.md \
  docs/workflow/done/ai-receptionist-production-readiness.md \
  docs/workflow/in-progress/ai-receptionist-experience-pass.md \
  docs/workflow/in-progress/ai-receptionist-production-readiness.md \
  docs/workflow/done/README.md \
  docs/workflow/done/ai-voice-receptionist.md \
  docs/workflow/in-progress/README.md \
  docs/workflow/for-testing/README.md

# 2 — plan gate state + tests
commit "feat(ui): add feature gate state helper and tighten gates" \
  ui/src/features/dashboard/plans/lib/featureGateState.ts \
  ui/src/features/dashboard/plans/lib/featureGateState.test.ts \
  ui/src/features/dashboard/plans/hooks/useFeatureGate.ts \
  ui/src/features/dashboard/org/lib/aiQuotaToast.test.ts \
  supabase/functions/tests/planFeatureGateResolution.test.ts

# 3 — plan gate e2e
commit "test(ui): add booking detail and inbox stay guide plan e2e" \
  ui/e2e/features/plans/gates/bookingDetailPlanGates.spec.ts \
  ui/e2e/features/plans/gates/inboxStayGuideGate.spec.ts

# 4 — template placeholders (trip_url in catalog; trip page ships later)
commit "feat(bookings): extend template placeholders for guest links" \
  ui/src/features/dashboard/bookings/lib/propertyTemplatePlaceholders.ts \
  ui/src/features/dashboard/bookings/lib/telegramPlaceholderGroups.ts \
  ui/src/features/dashboard/bookings/lib/templatePlaceholderCatalog.ts \
  supabase/functions/_shared/propertyTemplatePlaceholders.ts \
  supabase/functions/_shared/propertyTemplateEmail.ts \
  supabase/functions/_shared/propertyTemplateEmailSections.ts

# 5 — guest email / stay guide link extras (URLs only)
commit "feat(supabase): add trip url to guest booking email links" \
  supabase/functions/_shared/publicGuestPaths.ts \
  supabase/functions/_shared/guestBookingEmailLinks.ts \
  supabase/functions/_shared/guestStayGuide.ts

# 6 — inbox + host booking docs
commit "feat(inbox): extend booking share rows and insert menu" \
  ui/src/features/dashboard/inbox/components/InboxInsertMenu.tsx \
  ui/src/features/dashboard/inbox/lib/inboxBookingShareRows.ts \
  docs/guides/routes/org/property/inbox.md \
  docs/guides/routes/org/property/templates.md \
  docs/guides/routes/org/property/bookings-detail.md

# 7 — chat rich blocks + resource hub
commit "feat(ui): improve chat url cards and resource hub items" \
  ui/src/lib/chat/parseChatRichBlocks.ts \
  ui/src/lib/chat/parseChatRichBlocks.test.ts \
  ui/src/components/chat/ChatUrlLinkCard.tsx \
  ui/src/features/guest/chat/lib/guestChatResourceHubItems.ts \
  ui/src/features/guest/chat/components/GuestChatResourceHub.tsx \
  docs/guides/routes/properties/chat.md

# 8 — guest chat thread + edge chat tweaks
commit "feat(ui): polish guest property chat thread flow" \
  ui/src/features/guest/chat/components/ContactHostSheet.tsx \
  ui/src/features/guest/chat/components/GuestChatThread.tsx \
  ui/src/features/guest/chat/lib/guestChatApi.ts \
  ui/src/features/guest/chat/pages/PropertyChatPage.tsx \
  supabase/functions/_shared/webGuestChatService.ts \
  supabase/functions/_shared/dashboardAssistantParity.ts \
  supabase/functions/_shared/emailService.ts

# 9 — parking e2e, development filters, for-hosts tour, route docs
commit "test(ui): refresh parking booking e2e and development filters" \
  ui/e2e/features/parking/property/propertyBookingFreeManualWorkflow.spec.ts \
  ui/e2e/features/parking/shared/propertyBookingParkingHarness.ts \
  ui/src/features/guest/marketing/developments/lib/parkingSlotFilters.ts \
  ui/src/features/guest/marketing/developments/lib/parkingSlotFilters.test.ts \
  ui/src/features/guest/marketing/developments/lib/resolvePublicDevelopment.ts \
  ui/src/features/guest/marketing/developments/lib/resolvePublicDevelopment.test.ts \
  ui/src/features/guest/marketing/for-hosts/components/HostDashboardTourPlayer.tsx \
  ui/src/features/guest/marketing/for-hosts/preview/components/showcase/ShowcaseDemos.tsx \
  ui/src/features/guest/marketing/for-hosts/preview/components/showcase/ShowcasePrimitives.tsx \
  supabase/functions/create-organization/index.ts \
  supabase/functions/create-parking/index.ts \
  docs/guides/routes/developments.md \
  docs/guides/routes/for-hosts.md \
  docs/guides/routes/stay-guide.md \
  docs/guides/routes/sd-form.md \
  docs/guides/routes/success.md \
  docs/guides/routes/README.md \
  docs/guides/routes/index-landing.md \
  docs/guides/routes/parkings.md \
  docs/guides/routes/properties.md \
  docs/guides/routes/account/index.md \
  docs/guides/routes/account/stays.md \
  docs/workflow/intake/_to-plan.md \
  docs/workflow/for-testing/public-listing-pages-hardening.md \
  .agent/skills/social-creative/SKILL.md

echo "batch-commit-run-9-third done"
