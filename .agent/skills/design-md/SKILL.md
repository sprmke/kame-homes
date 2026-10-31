---
name: design-md
description: Use the project DESIGN.md (Stitch-style design system) and optional VoltAgent awesome-design-md references when generating or auditing UI. Prefer root DESIGN.md over any inspiration catalog.
---

# DESIGN.md (GFM)

Google Stitch–style design systems as markdown. This repo wires:

| Path                                 | Purpose                                                                                      |
| ------------------------------------ | -------------------------------------------------------------------------------------------- |
| **`DESIGN.md`** (repo root)          | Canonical Kame Homes / Guest Form Management look & feel                                     |
| `.agents/design-md/<slug>/DESIGN.md` | Curated inspiration from [awesome-design-md](https://github.com/VoltAgent/awesome-design-md) |
| `stitch-design-taste`                | Taste Skill variant that can author/update DESIGN.md files                                   |

## When to use

- Building or redesigning marketing, guest, or admin UI and you need a single source of visual truth
- User asks to “match DESIGN.md”, “use Stitch design system”, or “inspired by Linear/Airbnb/…”
- Auditing UI for consistency with project tokens before shipping

## Rules (non-negotiable)

1. **Root `DESIGN.md` wins** over any file under `.agents/design-md/`.
2. Inspiration refs are **mood/layout only** — do not replace teal brand tokens, Plus Jakarta Sans, or shadcn primitives with another brand’s hex/fonts unless the user explicitly asks for an experiment.
3. Still follow GFM constraints: Vite + React + Tailwind + shadcn (`frontend-design`, `brand`, `minimal-ui-copy`, `public-ui`, `ui-minimal-copy.mdc`).
4. Prefer existing components in `ui/src/components/ui/**` before inventing new primitives.
5. Pair with **Taste Skill** (`design-taste-frontend`, `redesign-existing-projects`) for anti-slop elevation — DESIGN.md sets the system; Taste Skill raises craft.

## Workflow

```text
1. Read DESIGN.md (root)
2. If user named an inspiration brand → open .agents/design-md/<slug>/DESIGN.md
3. Implement in ui/src with project tokens (ui/src/index.css, tailwind.config.js)
4. Optionally invoke design-taste-frontend / impeccable for craft pass
```

## Refresh catalog

```bash
bun run setup:design-md
# Force re-download:
DESIGN_MD_FORCE=1 bun run setup:design-md
```

## Related

- `frontend-design`, `design-system`, `brand`, `impeccable`
- `design-taste-frontend`, `stitch-design-taste` (`.agents/skills/` via skills.sh)
