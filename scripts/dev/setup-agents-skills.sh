#!/usr/bin/env bash
# Restore skills.sh ecosystem packages into .agents/skills/ and symlink for
# Cursor + Claude Code (OpenCode discovers .agents/skills/ natively + via
# opencode.json skills.paths). Canonical lock: skills-lock.json at repo root.
#
# Includes every entry in skills-lock.json: Impeccable, Taste Skill,
# playwright-cli, Caveman, Graphify, Ponytail, Vercel agent-skills,
# Anthropic skills, Matt Pocock skills, and Superpowers.
#
# Usage: bun run setup:agents-skills
# Also invoked by: bun run setup:ai-tooling / bun run setup:impeccable

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

LOCK="skills-lock.json"
AGENTS_SKILLS=".agents/skills"

link_skill() {
  local name="$1"
  local side="$2"
  local link=".${side}/skills/${name}"
  local target="../../.agents/skills/${name}"

  mkdir -p ".${side}/skills"
  if [[ -L "$link" ]]; then
    if [[ "$(readlink "$link")" == "$target" ]]; then
      return 0
    fi
    rm "$link"
  elif [[ -e "$link" ]]; then
    echo "ERROR: $link exists and is not a symlink — remove manually"
    exit 1
  fi
  ln -s "$target" "$link"
  echo "Linked $link -> $target"
}

ensure_agents_skill_symlinks() {
  [[ -d "$AGENTS_SKILLS" ]] || return 0
  local skill_dir name
  for skill_dir in "$AGENTS_SKILLS"/*/; do
    [[ -d "$skill_dir" ]] || continue
    name="$(basename "$skill_dir")"
    [[ -f "${skill_dir}SKILL.md" ]] || continue
    link_skill "$name" cursor
    link_skill "$name" claude
  done
}

if [[ ! -f "$LOCK" ]]; then
  echo "ERROR: $LOCK missing — cannot restore ecosystem skills"
  exit 1
fi

missing=0
while IFS= read -r name; do
  [[ -n "$name" ]] || continue
  if [[ ! -f "$AGENTS_SKILLS/${name}/SKILL.md" ]]; then
    missing=1
    break
  fi
done < <(jq -r '.skills | keys[]' "$LOCK" 2>/dev/null || true)

if [[ "$missing" -eq 1 ]] || [[ ! -d "$AGENTS_SKILLS" ]]; then
  echo "Restoring ecosystem skills from $LOCK ..."
  npx skills experimental_install -y
fi

# Impeccable is also installable via its dedicated package path if lock restore
# left it incomplete (older clones / partial checkouts).
# The committed package ships scripts/impeccable, not scripts/hook.mjs.
if [[ ! -f "$AGENTS_SKILLS/impeccable/scripts/impeccable" ]]; then
  echo "Installing Impeccable (pbakaus/impeccable@impeccable) ..."
  npx skills add pbakaus/impeccable@impeccable -p -y --agent claude-code cursor
fi

# Taste Skill core set (idempotent — skills CLI skips existing)
if [[ ! -f "$AGENTS_SKILLS/design-taste-frontend/SKILL.md" ]]; then
  echo "Installing Taste Skill (Leonxlnx/taste-skill) ..."
  npx skills add https://github.com/Leonxlnx/taste-skill -p -y --agent claude-code cursor \
    --skill design-taste-frontend \
    --skill redesign-existing-projects \
    --skill stitch-design-taste \
    --skill high-end-visual-design \
    --skill full-output-enforcement \
    --skill image-to-code
fi

# Playwright CLI skill (binary wired separately by setup-playwright-cli.sh)
if [[ ! -f "$AGENTS_SKILLS/playwright-cli/SKILL.md" ]]; then
  echo "Installing playwright-cli skill (microsoft/playwright-cli) ..."
  npx skills add https://github.com/microsoft/playwright-cli -p -y --agent claude-code cursor \
    --skill playwright-cli
fi

ensure_agents_skill_symlinks

if [[ -f "$AGENTS_SKILLS/impeccable/scripts/hook.mjs" ]]; then
  node --check "$AGENTS_SKILLS/impeccable/scripts/hook.mjs"
  node --check "$AGENTS_SKILLS/impeccable/scripts/hook-before-edit.mjs"
fi

echo "OK — ecosystem skills under $AGENTS_SKILLS; Cursor + Claude Code symlinks wired (OpenCode loads .agents/skills directly)."
