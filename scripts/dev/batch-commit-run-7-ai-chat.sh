#!/usr/bin/env bash
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
git reset HEAD >/dev/null 2>&1 || true

c() { git commit -m "$MSG"; }

MSG="$(cat <<'EOF'
database(supabase): add ai chat mode preferences schema

Add user_ui_preferences table and grants for dashboard mode persistence.
EOF
)"
git add -- \
  supabase/migrations/20261316126000_ai_chat_mode.sql \
  supabase/migrations/20261316126100_ai_chat_mode_grants.sql
c

MSG="$(cat <<'EOF'
feat(supabase): add briefing and ui preferences handlers

Serve dashboard mode prefs and AI mode home briefing cards for hosts.
EOF
)"
git add -- \
  supabase/functions/user-ui-preferences/index.ts \
  supabase/functions/dashboard-assistant-briefing/index.ts
c

MSG="$(cat <<'EOF'
test(supabase): add ai chat mode local integration test

Cover user-ui-preferences and dashboard-assistant-briefing against local stack.
EOF
)"
git add -- supabase/functions/tests/aiChatModeLocal.integration_test.ts
c

MSG="$(cat <<'EOF'
feat(ui): add dashboard mode and assistant session libs

Persist mode per user, draft store, motion helpers, and session context.
EOF
)"
git add -- \
  ui/src/features/dashboard/ai-assistant/lib/dashboardMode.ts \
  ui/src/features/dashboard/ai-assistant/lib/dashboardMode.test.ts \
  ui/src/features/dashboard/ai-assistant/lib/dashboardModeContext.ts \
  ui/src/features/dashboard/ai-assistant/lib/assistantMotion.ts \
  ui/src/features/dashboard/ai-assistant/lib/assistantMotion.test.ts \
  ui/src/features/dashboard/ai-assistant/lib/assistantDraftStore.ts \
  ui/src/features/dashboard/ai-assistant/lib/assistantDraftStore.test.ts \
  ui/src/features/dashboard/ai-assistant/lib/aiAssistantSessionContext.ts
c

MSG="$(cat <<'EOF'
feat(ui): extend assistant scope and message plain text

Page context, scope routing, open_page plain text, and mode transitions.
EOF
)"
git add -- \
  ui/src/features/dashboard/ai-assistant/lib/assistantPageContext.ts \
  ui/src/features/dashboard/ai-assistant/lib/assistantPageContext.test.ts \
  ui/src/features/dashboard/ai-assistant/lib/assistantScope.ts \
  ui/src/features/dashboard/ai-assistant/lib/assistantScope.test.ts \
  ui/src/features/dashboard/ai-assistant/lib/assistantSurfaceContext.ts \
  ui/src/features/dashboard/ai-assistant/lib/messagePlainText.ts \
  ui/src/features/dashboard/ai-assistant/lib/messagePlainText.test.ts \
  ui/src/features/dashboard/ai-assistant/lib/modeTransition.ts
c

MSG="$(cat <<'EOF'
feat(ui): add ai mode workspace shell and composer

Providers, full-page chrome, briefing home, and session chat composer.
EOF
)"
git add -- \
  ui/src/features/dashboard/ai-assistant/components/DashboardModeProvider.tsx \
  ui/src/features/dashboard/ai-assistant/components/DashboardModeToggle.tsx \
  ui/src/features/dashboard/ai-assistant/components/AiAssistantSessionProvider.tsx \
  ui/src/features/dashboard/ai-assistant/hooks/useAssistantBriefing.ts \
  ui/src/features/dashboard/ai-assistant/components/full-page/AiModeChrome.tsx \
  ui/src/features/dashboard/ai-assistant/components/full-page/BriefingHome.tsx \
  ui/src/features/dashboard/ai-assistant/components/SessionChatComposer.tsx \
  ui/src/features/dashboard/ai-assistant/components/ComposerSuggestionMenu.tsx \
  ui/src/features/dashboard/ai-assistant/components/MentionCandidatesLoader.tsx
c

MSG="$(cat <<'EOF'
fix(ui): flatten turnstile corners in auth forms

Remove rounded iframe chrome on Turnstile and document ai chat mode progress.
EOF
)"
git add -- \
  ui/src/components/security/TurnstileWidget.tsx \
  ui/src/index.css \
  docs/workflow/in-progress/ai-chat-mode.md
c

echo "batch-commit-run-7-ai-chat done"
