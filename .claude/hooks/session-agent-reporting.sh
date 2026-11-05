#!/usr/bin/env bash
# SessionStart: one summary/reporting format for every agent and model.
# Claude Code cannot auto-load alwaysApply .mdc rules — this injects the contract every session.
# OpenCode is intentionally exempt (its output is the reference) — no plugin counterpart.
set -uo pipefail

MSG='REPORTING FORMAT (mandatory, every model): Summaries, progress updates, investigation answers and questions all use one shape. Line 1 = plain outcome sentence, no heading, PR/URL here. Then max 5 "##" sections with 1-3 word titles, one-line bullets, one nesting level. Report types (pick one, do not blend): Implementation = What changed/Verification/Docs/Notes; Investigation = Short answer/What is happening/Options/Recommendation; Deploy = Shipped/Verification/Cleanup; Blocked = What works/What is blocked/Next step; mid-task = 1-2 lines, no sections. Status words only: pass, fail, skipped, not run, blocked, "N/A - why". Never claim a gate you did not run. Always state uncommitted work, skipped gates, and anything needing kamewave. Bold = the one thing that matters per bullet; backticks = paths/commands/identifiers. Questions: ONE decision, last in the message, recommended option first. Banned: opening heading, "## Summary", preamble ("I have completed", "Great!"), em dash, decorative emoji or check/cross as status, "Let me know if you need anything else", narrating tool calls, apologies. Canonical: CLAUDE.md § Reporting format + agent-reporting skill · .cursor/rules/agent-reporting.mdc.'

escape_for_json() {
  local s="$1"
  s="${s//\\/\\\\}"
  s="${s//\"/\\\"}"
  s="${s//$'\n'/\\n}"
  printf '%s' "$s"
}

escaped=$(escape_for_json "$MSG")
printf '{\n  "additional_context": "%s"\n}\n' "$escaped"
