# Workflow start

Move a **planned** workflow doc into **in-progress** for this session.

## Steps

1. Identify the plan slug (e.g. `google-oauth-verification.md`) from `docs/workflow/planned/` or user message.
2. Run:

```bash
bash scripts/dev/workflow-move.sh start <slug>
```

3. Read the moved file under `docs/workflow/in-progress/` before implementing.
4. **Sync scratchpads:** `workflow-move.sh start` runs `bun run sync:workflow-scratchpads -- --slug=<slug>` automatically. Add or verify `→ **In progress:** [../in-progress/<slug>.md](…)` on the matching item. Read `.agent/skills/workflow-intake-scratchpads/SKILL.md`.
5. Follow `.agent/skills/workflow/SKILL.md` and `.cursor/rules/workflow-docs.mdc`.

If the plan only exists in `docs/workflow/intake/` (design spec), run `/superpowers-plan` first or write the plan to `docs/workflow/planned/` before starting — scratchpad item should be **📋** until then.
