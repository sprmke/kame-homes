---
name: workflow
description: >-
  Manage docs/workflow lifecycle — intake, planned, in-progress, for-testing, done, wont-do.
  Sync intake scratchpads (_to-prompt, _to-plan) when status changes.
  Filenames are kebab-slug only (no date prefix).
---

# Workflow docs

| Stage       | Path                         | When                                                                              |
| ----------- | ---------------------------- | --------------------------------------------------------------------------------- |
| Intake      | `docs/workflow/intake/`      | Scratchpads + active design specs                                                 |
| Planned     | `docs/workflow/planned/`     | Plan written — **not started**                                                    |
| In progress | `docs/workflow/in-progress/` | **Work started** — plan not fully complete (partial phases / v1 slices stay here) |
| For testing | `docs/workflow/for-testing/` | **Implementation complete** — manual verification / QA only                       |
| Done        | `docs/workflow/done/`        | Plan **fully complete** (verification passed)                                     |
| Won't do    | `docs/workflow/wont-do/`     | Cancelled                                                                         |

**Rule:** A shipped slice or phase does **not** move the parent plan to `done/` while remaining plan scope is open. Move to `in-progress/` at first implementation; move to `done/` only when the plan is closed.

## Naming

**`<kebab-case-slug>.md`** — no `YYYY-MM-DD-` prefix. Use frontmatter `updated:` for dates.

Intake design specs: `<slug>-design.md` (move with plan when starting/done/wont-do — not left in `intake/` after ship/cancel).

## Intake scratchpads

Permanent backlogs: `_to-prompt.md`, `_to-plan.md`. **Always sync** when moving workflow docs.

| Emoji | Meaning                                              |
| ----- | ---------------------------------------------------- |
| ❌    | Cancelled / won't do (`wont-do/` or scratchpad-only) |
| ✅    | Shipped (`done/`)                                    |
| 📋    | Plan written (`planned/`)                            |
| 🚧    | In progress (`in-progress/`)                         |
| 🔵    | Open — no plan yet                                   |

Scratchpad **sort order** matches the legend: ❌ → ✅ → 📋 → 🚧 → 🔵.

Full rules: **`.agent/skills/workflow-intake-scratchpads/SKILL.md`**

## Commands

- `/workflow-start <slug>` — move planned → in-progress; scratchpad → **🚧**
- `/workflow-for-testing <slug>` or `workflow-move.sh for-testing <slug>` — move in-progress → for-testing; scratchpad → **🧪**
- `/workflow-done <slug>` — move in-progress|for-testing → done; scratchpad → **✅**
- `/workflow-wont-do <slug>` — move planned|in-progress → wont-do; scratchpad → **❌**
- `/workflow-sync-scratchpads` — sync emojis from folder links

```bash
bash scripts/dev/workflow-move.sh start <slug>
bash scripts/dev/workflow-move.sh for-testing <slug>
bash scripts/dev/workflow-move.sh done <slug>
bash scripts/dev/workflow-move.sh wont-do <slug>
bun run sync:workflow-scratchpads
bun run check:workflow-scratchpads
```

## Rules

- Do **not** silently move files — use commands/script only.
- Do **not** add date prefixes to new workflow docs.
- Update scratchpads in the **same session** as start/done/wont-do/plan/cancel.
- Legacy material: `docs/archive/` (not workflow).

## Related

- [`.agent/skills/workflow-intake-scratchpads/SKILL.md`](../workflow-intake-scratchpads/SKILL.md) — includes **`bun run sync:workflow-scratchpads`**
- [`.cursor/rules/workflow-docs.mdc`](../../.cursor/rules/workflow-docs.mdc)
- [`.cursor/rules/plan-mode.mdc`](../../.cursor/rules/plan-mode.mdc)
