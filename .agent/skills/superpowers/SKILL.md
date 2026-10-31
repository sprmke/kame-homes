---
name: superpowers
description: >-
  Superpowers opt-in workflow with repo path overrides — plans go to
  docs/workflow/planned/, brainstorm specs to docs/workflow/intake/.
  Never write docs/superpowers/. No date prefixes in filenames.
  Lean mode (hooks-enforced): no subagents on any /superpowers-* command.
---

# Superpowers (repo paths)

When active, **override the plugin's default save locations** and naming.

## Lean mode (mandatory for all /superpowers-*)

Hooks activate lean mode for **`/superpowers-plan`**, **`/superpowers-brainstorm`**, **`/superpowers-debug`**, and **`/superpowers-execute`** (and matching plugin skills). Subagents and Task tool are **blocked**.

**Enforced by hooks** (`.cursor/hooks/superpowers-lean-mode.sh`, `guard-superpowers-subagents.sh`):

### Plan (`/superpowers-plan`)

- Plan only unless the user explicitly asked to implement.
- Read **`docs/PROJECT.md`** and the relevant **`docs/guides/routes/*`** guide only.
- **Plans:** `docs/workflow/planned/<slug>.md` — short actionable checklist, **not** TDD micro-steps.
- Stop when saved; do not offer `/superpowers-execute` in the same chat.

### Brainstorm (`/superpowers-brainstorm`)

- Spec/design only. **Specs:** `docs/workflow/intake/<slug>-design.md` — concise, not code dumps.

### Debug (`/superpowers-debug`)

- Single-threaded **`superpowers:systematic-debugging`** — no subagents.

### Execute (`/superpowers-execute`)

- Implement the plan **inline** — one task at a time in the main thread.
- Read plan from **`docs/workflow/in-progress/`** (or **`planned/`**); run **`/workflow-start <slug>`** if needed.
- Per task: **targeted `rg`/`Read`** for files listed in the plan only.
- **Override** `executing-plans` and **`subagent-driven-development`** — never dispatch a subagent per task.
- Run checks from the plan (or **`bun run ci:quality`**) after logical chunks; update route guides when behavior changes.

### All lean modes

- **No subagents, no Explore, no Task tool.**
- Use targeted **`rg`/`Read`**; no broad repo scans or parallel exploration.

Shared lib: `scripts/dev/superpowers-lean-lib.sh`.

## Token hygiene (mandatory)

- Opt-in only — never auto-start from a normal coding task.
- Prefer **one** brainstorming/planning pass. Do **not** fan out Explore / general-purpose subagents unless the user asks.
- After the plan lands in `docs/workflow/planned/`, use **`/clear`**, then **`/superpowers-execute`** or a normal implementation session — not both tools in one thread.

## Doc paths (mandatory)

| Artifact                 | Save to                      | Filename                   |
| ------------------------ | ---------------------------- | -------------------------- |
| Implementation plan      | `docs/workflow/planned/`     | `<kebab-slug>.md`          |
| Brainstorm / design spec | `docs/workflow/intake/`      | `<kebab-slug>-design.md`   |
| Active execution         | `docs/workflow/in-progress/` | move via `/workflow-start` |

**Never** use `YYYY-MM-DD-` prefixes in workflow filenames.  
**Never** create `docs/superpowers/**`.

## After writing a plan

1. Set frontmatter `updated: YYYY-MM-DD`.
2. Add a row to `docs/workflow/planned/README.md`.

## Plugin overrides

| Plugin default            | Use instead                             |
| ------------------------- | --------------------------------------- |
| `docs/superpowers/plans/` | `docs/workflow/planned/<slug>.md`       |
| `docs/superpowers/specs/` | `docs/workflow/intake/<slug>-design.md` |
| `YYYY-MM-DD-<slug>.md`    | `<slug>.md`                             |

## Installed upstream skills

`obra/superpowers` is installed under `.agents/skills/` (brainstorming, writing-plans, test-driven-development, and the rest). Cursor, Codex, and OpenCode read that folder. Claude Code follows the `.claude/skills/` symlinks.

Those skills stay opt-in. Do not auto-run `using-superpowers`. Use them when the user asks, or via `/superpowers-*`. This file's path overrides still apply.
