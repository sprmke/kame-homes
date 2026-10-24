#!/usr/bin/env bash
# ~90% WIP: cutover watermark, chat templates, guest receptionist, booking resolver, migrate tooling.
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
git reset HEAD >/dev/null 2>&1 || true

commit() {
  local msg=$1
  shift
  git add "$@"
  git commit -m "$msg"
}

append_config_functions() {
  python3 << 'PY'
import pathlib
path = pathlib.Path("supabase/config.toml")
text = path.read_text()
blocks = {
    "resolve-booking-property": "[functions.resolve-booking-property]\nverify_jwt = false\n",
    "chat-templates": "[functions.chat-templates]\nverify_jwt = false\n",
}
for name, block in blocks.items():
    if f"[functions.{name}]" not in text:
        text = text.rstrip() + "\n\n" + block
path.write_text(text if text.endswith("\n") else text + "\n")
print("config blocks ensured:", ", ".join(blocks))
PY
}

commit "feat(supabase): add cutover watermark and gmail listener migration" \
  supabase/migrations/20260629215000_gmail_listener_state_singleton_drop_guard.sql \
  supabase/migrations/20261316128600_cutover_watermark_platform_settings.sql \
  supabase/functions/_shared/cutoverWatermark.ts \
  supabase/functions/_shared/cutoverWatermark_test.ts \
  supabase/functions/_shared/platformSettingsCache.ts

commit "feat(supabase): add chat template messages and inbox audit action" \
  supabase/migrations/20261316128700_chat_template_messages.sql \
  supabase/functions/_shared/chatTemplateMessage.ts \
  supabase/functions/chat-templates/ \
  supabase/functions/_shared/activityLog.ts

commit "feat(supabase): send rendered chat templates from social inbox" \
  supabase/functions/_shared/socialInboxTypes.ts \
  supabase/functions/social-inbox-send/index.ts \
  supabase/functions/_shared/socialInboxAiService_test.ts

commit "feat(supabase): add guest receptionist turn and tool allowlist" \
  supabase/functions/_shared/ai/prompts/guestReceptionist.ts \
  supabase/functions/_shared/guestReceptionistTools.ts \
  supabase/functions/_shared/guestReceptionistTools_test.ts \
  supabase/functions/_shared/guestReceptionistTurn.ts

commit "feat(supabase): add marketing ai session and template library helpers" \
  supabase/functions/_shared/marketingAiSessions.ts \
  supabase/functions/_shared/marketingAiSessions_test.ts \
  supabase/functions/_shared/marketingTemplateLibrary.ts \
  supabase/functions/_shared/marketingTemplateLibrary_test.ts \
  supabase/functions/_shared/marketingTemplateThumbnails.ts \
  supabase/functions/_shared/marketingTemplateThumbnails_test.ts

commit "feat(supabase): extend review automation and assistant parity routes" \
  supabase/functions/_shared/reviewAutomation.ts \
  supabase/functions/_shared/reviewLifecycle.ts \
  supabase/functions/_shared/dashboardAssistantParity.ts \
  supabase/functions/_shared/dashboardAssistantAttachedContext.ts

append_config_functions

commit "feat(supabase): add resolve-booking-property public lookup" \
  supabase/functions/resolve-booking-property/ \
  supabase/config.toml

commit "feat(ui): resolve guest booking property from bookingId" \
  ui/src/features/guest/lib/guestBookingPropertyResolver.ts \
  ui/src/features/guest/lib/guestBookingPropertyResolver.test.ts \
  ui/src/features/guest/form/lib/guestBookingAccess.ts \
  ui/src/features/guest/property/routes/index.tsx

commit "chore(scripts): add legacy-to-mt-prod migration tooling" \
  scripts/migrate/legacy-to-mt-prod/ \
  docs/archive/operations/legacy-to-mt-prod-migration.md \
  docs/workflow/planned/legacy-prod-to-mt-prod-cutover.md \
  docs/workflow/planned/legacy-prod-config-secrets-backup.md

commit "test(e2e): add admin system health smoke harness" \
  ui/e2e/features/admin/adminSystemHealth.spec.ts \
  ui/e2e/features/admin/shared/adminSystemHealthHarness.ts \
  scripts/dev/check-staged-e2e-artifacts.sh

commit "chore(scripts): add ai qa seeds and knowledge coverage checks" \
  scripts/ai-knowledge-synced-guides.txt \
  scripts/check-ai-knowledge-coverage.ts \
  scripts/dev/ai-qa-run.mjs \
  scripts/dev/ai-qa-run.sh \
  scripts/dev/fixtures/ \
  scripts/dev/seed-ai-qa.sql \
  scripts/dev/seed-ai-qa.ts

commit "docs: update project index and guest booking route guide" \
  docs/PROJECT.md \
  docs/guides/routes/sd-form.md \
  docs/workflow/intake/_to-plan.md \
  docs/workflow/intake/_to-dos.md \
  docs/workflow/planned/README.md

commit "docs: add cutover rebrand chat templates and QA workflow" \
  docs/workflow/planned/chat-templates.md \
  docs/workflow/planned/rebrand-kame-homes-to-kame-space.md \
  docs/workflow/done/unified-ai-settings-card.md \
  docs/workflow/for-testing/ai-companion-response-quality-and-generative-ui.md \
  docs/workflow/for-testing/marketing-ai-image-quality-hardening.md \
  docs/workflow/qa/README.md \
  docs/workflow/qa/ai-conversations/

commit "chore: sync package scripts and lockfiles" \
  package.json \
  bun.lock \
  deno.lock

echo "Done: 15 commits on $(git branch --show-current)."
