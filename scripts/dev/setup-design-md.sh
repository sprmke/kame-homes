#!/usr/bin/env bash
# Vendor curated DESIGN.md references from VoltAgent/awesome-design-md and ensure
# project DESIGN.md + design-md skill symlinks exist for Cursor / Claude Code.
#
# Source: https://github.com/VoltAgent/awesome-design-md
# Local catalog: .agents/design-md/<slug>/DESIGN.md
# Project system: DESIGN.md (repo root) — agents must prefer this over refs.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

BASE_URL="https://raw.githubusercontent.com/VoltAgent/awesome-design-md/main/design-md"
DEST=".agents/design-md"

# Curated for GFM: hospitality / trust / product-admin / scheduling / payments / our stack.
# Do NOT treat these as the product brand — inspiration only. Project DESIGN.md wins.
# Local slug → upstream folder under design-md/
REFS=(
  airbnb
  linear
  cal
  notion
  stripe
  supabase
)

upstream_slug() {
  case "$1" in
    linear) echo "linear.app" ;;
    *) echo "$1" ;;
  esac
}

info() { printf '→ %s\n' "$*"; }
ok() { printf '✓ %s\n' "$*"; }
warn() { printf '⚠ %s\n' "$*" >&2; }

mkdir -p "$DEST"

cat >"$DEST/README.md" <<'EOF'
# DESIGN.md reference catalog

Curated extracts from [VoltAgent/awesome-design-md](https://github.com/VoltAgent/awesome-design-md) for agent inspiration.

| Path | Role |
| ---- | ---- |
| **`DESIGN.md` (repo root)** | **Canonical** Kame Homes / GFM visual system — always prefer this |
| `.agents/design-md/<slug>/DESIGN.md` | Optional mood/layout references — never override project tokens/brand |

## How agents should use this

1. Read root **`DESIGN.md`** first.
2. Follow GFM skills: `frontend-design`, `brand`, `minimal-ui-copy`, `public-ui`, `design-system`.
3. Only open a reference here when the user asks to match a mood (“more Linear,” “Airbnb-like density”) or when running `stitch-design-taste` / Taste Skill with an explicit inspiration brief.
4. Never copy another brand’s hex/fonts into production UI unless the user explicitly requests a visual experiment.

Refresh refs: `bun run setup:design-md`
EOF

for slug in "${REFS[@]}"; do
  upstream="$(upstream_slug "$slug")"
  dir="$DEST/$slug"
  file="$dir/DESIGN.md"
  mkdir -p "$dir"
  if [[ -f "$file" ]] && [[ "${DESIGN_MD_FORCE:-}" != "1" ]]; then
    ok "exists $file"
    continue
  fi
  url="$BASE_URL/$upstream/DESIGN.md"
  info "Fetching $slug ← $url"
  if curl -fsSL "$url" -o "$file"; then
    ok "wrote $file"
  else
    warn "failed to fetch $slug — skip"
    rm -f "$file"
  fi
done

# Team skill (canonical under .agent/skills)
if [[ ! -f .agent/skills/design-md/SKILL.md ]]; then
  echo "ERROR: .agent/skills/design-md/SKILL.md missing"
  exit 1
fi

for side in cursor claude; do
  link=".${side}/skills/design-md"
  target="../../.agent/skills/design-md"
  mkdir -p ".${side}/skills"
  if [[ -L "$link" ]]; then
    if [[ "$(readlink "$link")" != "$target" ]]; then
      rm "$link"
      ln -s "$target" "$link"
      ok "Linked $link -> $target"
    fi
  elif [[ -e "$link" ]]; then
    echo "ERROR: $link exists and is not a symlink"
    exit 1
  else
    ln -s "$target" "$link"
    ok "Linked $link -> $target"
  fi
done

if [[ ! -f DESIGN.md ]]; then
  warn "Root DESIGN.md missing — expected committed project design system"
  exit 1
fi

ok "DESIGN.md catalog ready under $DEST (project root DESIGN.md is canonical)"
