# superpowers-plan

Run the **Superpowers writing-plans** workflow in **lean mode** (hooks enforce — subagents blocked).

## Lean constraints (mandatory)

Read **`.agent/skills/superpowers/SKILL.md`** § Lean mode first.

- Plan only. No subagents, no Explore, no Task tool.
- Read `docs/PROJECT.md` and the relevant route guide only.
- Save to `docs/workflow/planned/<slug>.md` — short actionable checklist, not TDD micro-steps.
- Stop when the plan is saved; do not offer subagent-driven execution.

## Steps

1. Read **`.agent/skills/superpowers/SKILL.md`** (repo path overrides + lean mode).
2. Follow **`superpowers:writing-plans`** but **override** its subagent/TDD granularity per lean mode.
3. **Save the plan to `docs/workflow/planned/<feature>.md`** — never `docs/superpowers/plans/`. **No date prefix.**
4. Add an index row to `docs/workflow/planned/README.md`.

Use after a spec exists (often via `/superpowers-brainstorm`). Opts in to Superpowers for this chat.
