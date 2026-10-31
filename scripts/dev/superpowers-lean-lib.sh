#!/usr/bin/env bash
# Shared helpers for Superpowers lean mode — no subagent fan-out on any /superpowers-* command.
# Sourced by .cursor/hooks/* and .claude/hooks/* — do not execute directly.

superpowers_lean_marker_path() {
  local root="${1:-${CURSOR_PROJECT_DIR:-${CLAUDE_PROJECT_DIR:-}}}"
  if [[ -z "$root" ]]; then
    root="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
  fi
  printf '%s/.cursor/.superpowers-lean-active' "$root"
}

superpowers_lean_read_mode() {
  local root="${1:-${CURSOR_PROJECT_DIR:-${CLAUDE_PROJECT_DIR:-}}}"
  local marker
  marker="$(superpowers_lean_marker_path "$root")"
  if [[ -f "$marker" ]]; then
    awk 'NR==1 { print $1; exit }' "$marker"
  fi
}

superpowers_lean_constraints_text() {
  local mode="${1:-}"
  if [[ -z "$mode" ]]; then
    mode="$(superpowers_lean_read_mode "${CURSOR_PROJECT_DIR:-${CLAUDE_PROJECT_DIR:-}}")"
  fi

  case "$mode" in
    execute)
      cat <<'EOF'
SUPERPOWERS LEAN MODE — EXECUTE (mandatory for this session)

- Implement the plan inline in this session — one task at a time in the main thread.
- No subagents, no Explore, no Task tool, no subagent-driven-development.
- Read the plan from docs/workflow/in-progress/ (preferred) or docs/workflow/planned/; run /workflow-start <slug> if not already in-progress.
- For each task: targeted rg/Read only for files listed in that task — no broad repo scans.
- Override plugin executing-plans and subagent-driven-development: do not dispatch a fresh subagent per task.
- After logical chunks, run the checks named in the plan (or bun run ci:quality); pause for user review when the plan says to.
- Update matching docs/guides/routes/* and docs/PROJECT.md when behavior changes.
EOF
      ;;
    brainstorm)
      cat <<'EOF'
SUPERPOWERS LEAN MODE — BRAINSTORM (mandatory for this session)

- Spec/design only unless the user explicitly asked to implement.
- No subagents, no Explore, no Task tool, no subagent-driven execution.
- Read docs/PROJECT.md and the relevant docs/guides/routes/* guide only — avoid broad repo scans.
- Use targeted rg/Read; do not fan out parallel exploration.
- Save to docs/workflow/intake/<slug>-design.md — concise design, not exhaustive code dumps.
- Stop when the spec is saved; do not chain into /superpowers-plan unless the user asks.
EOF
      ;;
    debug)
      cat <<'EOF'
SUPERPOWERS LEAN MODE — DEBUG (mandatory for this session)

- Single-threaded debug in the main thread — no subagents, no Explore, no Task tool.
- Read docs/PROJECT.md and files directly relevant to the bug; use targeted rg/Read only.
- Follow superpowers:systematic-debugging without spawning subagents.
- Stop when root cause and fix (or clear next step) are identified.
EOF
      ;;
    *)
      cat <<'EOF'
SUPERPOWERS LEAN MODE — PLAN (mandatory for this session)

- Plan only unless the user explicitly asked to implement.
- No subagents, no Explore, no Task tool, no subagent-driven execution.
- Read docs/PROJECT.md and the relevant docs/guides/routes/* guide only — avoid broad repo scans.
- Use targeted rg/Read; do not fan out parallel exploration.
- Save to docs/workflow/planned/<slug>.md — short actionable checklist, not TDD micro-steps.
- Stop when the plan is saved; do not offer subagent-driven execution or /superpowers-execute in this chat.
- Override plugin writing-plans granularity: skip bite-sized TDD steps; prefer 5–15 ordered tasks with file paths.
EOF
      ;;
  esac
}

# Returns 0 when prompt activates lean mode; prints mode slug to stdout (plan|brainstorm|debug|execute|skill).
superpowers_lean_detect_mode() {
  local prompt="$1"
  local lower
  lower="$(printf '%s' "$prompt" | tr '[:upper:]' '[:lower:]')"

  if [[ "$lower" =~ (/superpowers-execute|superpowers-execute|superpowers:executing-plans|superpowers:subagent-driven-development) ]]; then
    printf 'execute'
    return 0
  fi
  if [[ "$lower" =~ (/superpowers-plan|superpowers-plan|superpowers:writing-plans|/writing-plans) ]]; then
    printf 'plan'
    return 0
  fi
  if [[ "$lower" =~ (/superpowers-brainstorm|superpowers-brainstorm|superpowers:brainstorming|/brainstorm) ]]; then
    printf 'brainstorm'
    return 0
  fi
  if [[ "$lower" =~ (/superpowers-debug|superpowers-debug|superpowers:systematic-debugging) ]]; then
    printf 'debug'
    return 0
  fi
  if [[ "$lower" =~ (superpowers:executing-plans|superpowers:subagent-driven-development|superpowers:writing-plans|superpowers:brainstorming|superpowers:systematic-debugging) ]]; then
    printf 'skill'
    return 0
  fi

  return 1
}

superpowers_lean_activate() {
  local root="$1"
  local mode="$2"
  local marker
  marker="$(superpowers_lean_marker_path "$root")"
  mkdir -p "$(dirname "$marker")"
  printf '%s %s\n' "$mode" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" >"$marker"
}

superpowers_lean_is_active() {
  local root="${1:-${CURSOR_PROJECT_DIR:-${CLAUDE_PROJECT_DIR:-}}}"
  local marker
  marker="$(superpowers_lean_marker_path "$root")"
  [[ -f "$marker" ]]
}

superpowers_lean_deactivate() {
  local root="${1:-${CURSOR_PROJECT_DIR:-${CLAUDE_PROJECT_DIR:-}}}"
  local marker
  marker="$(superpowers_lean_marker_path "$root")"
  rm -f "$marker"
}

superpowers_lean_deny_message() {
  cat <<'EOF'
Blocked: Superpowers lean mode is active. Subagents and Task tool are disabled — implement or investigate single-threaded with rg/Read. See .agent/skills/superpowers/SKILL.md § Lean mode.
EOF
}
