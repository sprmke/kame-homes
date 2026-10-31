---
name: workflow-intake-scratchpads
description: >-
  Keep docs/workflow/intake/_to-prompt.md and _to-plan.md status emojis in sync
  with workflow/planned, in-progress, done, and wont-do. Run when shipping work,
  starting plans, cancelling ideas, or finishing workflow-done.
---

# Workflow intake scratchpads

Two living backlogs — **not** lifecycle workflow docs. They stay in `docs/workflow/intake/` permanently.

| File            | Purpose                                      |
| --------------- | -------------------------------------------- |
| `_to-prompt.md` | Raw tasks to paste into agent prompts        |
| `_to-plan.md`   | Bigger items that need brainstorming / plans |

## Status emojis (required on every item title line)

Each item block starts with `===`, then a **title line** with exactly one leading emoji:

| Emoji | Meaning                                  | Sync source                                                                    |
| ----- | ---------------------------------------- | ------------------------------------------------------------------------------ |
| ❌    | Cancelled / won't do — explicit decision | Matching doc in `docs/workflow/wont-do/` or scratchpad-only with reason        |
| ✅    | Shipped — plan fully complete            | Parent plan in `docs/workflow/done/` (or route guide shipped without a plan)   |
| 🧪    | For testing — manual QA pending          | Parent plan in `docs/workflow/for-testing/` (implementation complete)          |
| 📋    | Planned — plan written, not started yet  | Plan in `docs/workflow/planned/` only                                          |
| 🚧    | In progress — work started, plan open    | Parent plan in `docs/workflow/in-progress/` (even if a v1 slice is in `done/`) |
| 🔵    | Pending / open — no plan yet             | No matching plan; backlog idea only                                            |

**Scratchpad sort order:** ❌ → ✅ → 🧪 → 📋 → 🚧 → 🔵

**Legend line** (both files, after frontmatter — order matches scratchpad sort):

```markdown
**Status legend:** ❌ cancelled / won't do · ✅ done · 🧪 for testing · 📋 planned (plan doc written) · 🚧 in progress · 🔵 pending / open
```

Bump frontmatter `updated:` to today when you change either scratchpad.

## When to update (mandatory)

| Event                                       | Scratchpad action                                                             |
| ------------------------------------------- | ----------------------------------------------------------------------------- |
| `/workflow-start` or move to `in-progress/` | Find matching item → **🚧**; add `→ **In progress:** [../in-progress/…](…)`   |
| Move to `for-testing/` (QA only remaining)  | Find matching item → **🧪**; add `→ **For testing:** [../for-testing/…](…)`   |
| `/workflow-done` or move to `done/`         | Find matching item → **✅**; add `→ **Done:** [../done/…](…)`                 |
| `/workflow-wont-do` or move to `wont-do/`   | Find matching item → **❌**; add `→ **Won't do:** [../wont-do/…](…)` + reason |
| New plan saved to `planned/`                | **📋** + link to plan                                                         |
| User/product rejects an idea (no plan)      | **❌** + one-line reason (optional minimal doc in `wont-do/`)                 |
| New backlog idea (no plan)                  | **🔵** at end of file in new `===` block                                      |

Do this **in the same session** as the workflow move or doc change — not as a follow-up.

## How to pick the emoji

1. Grep scratchpads for keywords from the plan title / slug.
2. Cross-check `docs/workflow/planned/README.md`, `in-progress/README.md`, `done/README.md`, `wont-do/README.md`.
3. If `wont-do/` link → **❌**. If parent plan in `done/` (fully complete) → **✅**. If parent plan in `for-testing/` → **🧪**. If parent plan in `in-progress/` → **🚧**. If only `planned/` (not started) → **📋**. If none → **🔵** unless user said won't do → **❌**.

**Partial ship:** v1 slice or phase doc in `done/` while parent plan remains open → parent stays **`in-progress/`**, scratchpad **🚧** (not ✅). Note phase in the `→` link line.

## Item block format

```markdown
===

🚧 Short title (matches plan slug or product name)

Original intake body unchanged…

→ **In progress:** [`../in-progress/my-slug.md`](../in-progress/my-slug.md)

===
```

Cancelled example:

```markdown
===

❌ Separate dashboard top header bar

Won't do — profile, theme toggle, and mode switch stay in sidebar footer (`AdminLayout`).

→ **Won't do:** [`../wont-do/dashboard-top-header-bar.md`](../wont-do/dashboard-top-header-bar.md)

===
```

## Validation

```bash
bun run check:workflow-scratchpads
```

Runs on pre-commit when either scratchpad is staged. Fix any reported line before commit.

## Automated sync

```bash
# Preview all emoji updates + unlinked workflow docs
bun run sync:workflow-scratchpads -- --dry-run --report

# Apply emoji updates from workflow doc links in item bodies
bun run sync:workflow-scratchpads -- --report

# Optional: also guess from titles (can false-positive — review dry-run first)
bun run sync:workflow-scratchpads -- --dry-run --fuzzy
bun run sync:workflow-scratchpads -- --fuzzy

# After workflow-move on one slug (also runs automatically from workflow-move.sh)
bun run sync:workflow-scratchpads -- --slug=my-slug
```

Cursor commands: **`/workflow-sync-scratchpads`**, **`/workflow-wont-do`**.

The sync script reads `→` / `Plan:` / backtick links to `planned/`, `in-progress/`, `done/`, or `wont-do/` docs and sets the title emoji (`wont-do` → ❌; 🚧 > 📋 > ✅ among active stages). It never changes existing **❌** titles but will set **❌** from `wont-do/` links (including downgrades from 📋/🚧/✅ when cancelling). Title guessing requires **`--fuzzy`** (off by default). It does **not** add missing `→` link lines — add those when using workflow move commands.

## Related

- [`.cursor/rules/workflow-docs.mdc`](../../.cursor/rules/workflow-docs.mdc)
- [`.agent/skills/workflow/SKILL.md`](../workflow/SKILL.md)
- [`docs/workflow/README.md`](../../../docs/workflow/README.md)
