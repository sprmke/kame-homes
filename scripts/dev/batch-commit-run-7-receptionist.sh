#!/usr/bin/env bash
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
git reset HEAD >/dev/null 2>&1 || true

c() { git commit -m "$MSG"; }

MSG="$(cat <<'EOF'
feat(supabase): extend stay guide and voice receptionist edges

Guest stay guide tokens, voice start handler, and shared upload helpers.
EOF
)"
git add -- \
  supabase/functions/_shared/bookingAssetUpload.ts \
  supabase/functions/_shared/dashboardAssistantParityTools.ts \
  supabase/functions/_shared/emailService.ts \
  supabase/functions/_shared/guestStayGuide.ts \
  supabase/functions/_shared/receiptValidationService.ts \
  supabase/functions/_shared/documentAiValidationPatch_test.ts \
  supabase/functions/get-guest-stay-guide/index.ts \
  supabase/functions/issue-guest-stay-guide-token/index.ts \
  supabase/functions/voice-receptionist-start/index.ts
c

MSG="$(cat <<'EOF'
feat(ui): polish ai receptionist voice booth experience

Avatar media, session panel, audio pipeline, and dwell timing helpers.
EOF
)"
git add -- \
  ui/public/avatars/ATTRIBUTION.md \
  ui/public/avatars/receptionist-turtle-idle.webp \
  ui/public/avatars/receptionist-turtle-loop.mp4 \
  ui/src/features/guest/chat/components/voice/ReceptionistAvatar.tsx \
  ui/src/features/guest/chat/components/voice/ReceptionistFacePlate.tsx \
  ui/src/features/guest/chat/components/voice/VoiceBoothRing.tsx \
  ui/src/features/guest/chat/components/voice/VoiceMicWaveform.tsx \
  ui/src/features/guest/chat/components/voice/VoiceSessionPanel.tsx \
  ui/src/features/guest/chat/components/voice/receptionistAvatarVideo.ts \
  ui/src/features/guest/chat/hooks/useVoiceSession.ts \
  ui/src/features/guest/chat/hooks/useDwellValue.ts \
  ui/src/features/guest/chat/lib/liveVoiceProtocol.test.ts \
  ui/src/features/guest/chat/lib/liveVoiceProtocol.ts \
  ui/src/features/guest/chat/lib/voiceAudioCodec.test.ts \
  ui/src/features/guest/chat/lib/voiceAudioCodec.ts \
  ui/src/features/guest/chat/lib/voiceMicrophoneCapture.ts \
  ui/src/features/guest/chat/lib/voicePlaybackQueue.ts \
  ui/src/features/guest/chat/lib/voicePlaybackQueue.test.ts \
  ui/src/features/guest/chat/lib/voiceReceptionistApi.ts \
  ui/src/features/guest/chat/lib/voiceSessionTiming.test.ts \
  ui/src/features/guest/chat/lib/voiceSessionTiming.ts \
  ui/src/features/guest/chat/lib/voiceSessionView.ts \
  ui/src/features/guest/chat/lib/voiceSessionView.test.ts \
  ui/src/features/guest/stay-guide/lib/api.ts \
  ui/src/index.css
c

MSG="$(cat <<'EOF'
feat(bookings): wire stay guide links and workflow copy

Booking detail actions, AI review trigger, and pending review acknowledgements.
EOF
)"
git add -- \
  ui/src/features/dashboard/bookings/components/booking-detail/BookingDetailActionsMenu.tsx \
  ui/src/features/dashboard/bookings/components/booking-detail/panels/AiSummaryPanel.tsx \
  ui/src/features/dashboard/bookings/components/workflow-panel/WorkflowPanel.tsx \
  ui/src/features/dashboard/bookings/components/workflow-panel/WorkflowPendingReviewAck.tsx \
  ui/src/features/dashboard/bookings/hooks/useBookingAiReviewTrigger.ts \
  ui/src/features/dashboard/bookings/hooks/useBookingStayGuideLink.ts \
  ui/src/features/dashboard/bookings/lib/bookingDetailActions.test.ts \
  ui/src/features/dashboard/bookings/lib/bookingDetailActions.ts \
  ui/src/features/dashboard/bookings/lib/workflowPlanSkip.ts \
  ui/src/features/dashboard/bookings/lib/workflowTransitionEffectsCopy.test.ts \
  ui/src/features/dashboard/bookings/lib/workflowTransitionEffectsCopy.ts \
  ui/src/features/dashboard/inbox/lib/inboxBookingShareRows.ts
c

MSG="$(cat <<'EOF'
feat(ui): align plan gates and admin api error handling

Entitlements hooks, calendar sync JSON errors, and team API parsing.
EOF
)"
git add -- \
  ui/src/features/dashboard/org/lib/aiQuotaToast.ts \
  ui/src/features/dashboard/plans/hooks/useFeatureGate.ts \
  ui/src/features/dashboard/plans/hooks/usePropertyEntitlements.ts \
  ui/src/features/dashboard/plans/lib/planGateCoverage.test.ts \
  ui/src/features/dashboard/pricing/lib/calendarSyncApi.ts \
  ui/src/features/dashboard/pricing/lib/smartPricingApi.ts \
  ui/src/features/dashboard/team/lib/teamApiJson.ts
c

MSG="$(cat <<'EOF'
chore(*): extend marketing social remotion compositions

Add bento layouts, feature screens, and video entry compositions.
EOF
)"
git add -- \
  marketing/social/README.md \
  marketing/social/scripts/render.mjs \
  marketing/social/src/Root.tsx \
  marketing/social/src/device.tsx \
  marketing/social/src/primitives.tsx \
  marketing/social/src/screens.tsx \
  marketing/social/src/theme.ts \
  marketing/social/src/bento.tsx \
  marketing/social/src/concepts.tsx \
  marketing/social/src/path.tsx \
  marketing/social/src/videos.tsx \
  marketing/social/src/features/
c

MSG="$(cat <<'EOF'
test(ui): update voice receptionist and stay guide e2e

Cover consent flow, stay guide token handoff, and parking booking smoke.
EOF
)"
git add -- \
  ui/e2e/features/guest-chat/voiceReceptionistConsent.spec.ts \
  ui/e2e/features/guest-form/stayGuideToken.spec.ts \
  ui/e2e/features/parking/property/propertyBookingFreeManualWorkflow.spec.ts
c

MSG="$(cat <<'EOF'
docs(docs): sync receptionist guides and social creative skill

Route guides, manual testing, workflow ledgers, and social-creative docs.
EOF
)"
git add -- \
  .agent/skills/social-creative/SKILL.md \
  .cursor/rules/social-creative.mdc \
  docs/architecture/plans-feature-matrix.md \
  docs/guides/routes/org/property/bookings-detail.md \
  docs/guides/routes/org/property/inbox.md \
  docs/guides/routes/properties/chat.md \
  docs/guides/routes/stay-guide.md \
  docs/guides/testing/voice-receptionist-manual.md \
  docs/workflow/in-progress/README.md \
  docs/workflow/in-progress/ai-receptionist-experience-pass.md \
  docs/workflow/planned/README.md \
  docs/workflow/planned/dashboard-mobile-native-v2.md \
  scripts/dev/batch-commit-run-7-receptionist.sh
c

echo "batch-commit-run-7-receptionist done"
