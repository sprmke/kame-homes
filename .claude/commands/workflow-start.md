# Workflow start

Move a **planned** workflow doc into **in-progress** for this session.

## Steps

1. Identify the plan slug (e.g. `2026-08-02-google-oauth-verification.md`) from `docs/workflow/planned/` or user message.
2. Run:

```bash
bash scripts/dev/workflow-move.sh start <slug>
```

3. Read the moved file under `docs/workflow/in-progress/` before implementing.
4. Follow `.agent/skills/workflow/SKILL.md` and `.cursor/rules/workflow-docs.mdc`.

If the plan only exists in `docs/superpowers/plans/` and not yet in `workflow/planned/`, ask whether to copy a pointer into `workflow/planned/` first (Plan mode output) or start from the superpowers plan path explicitly.
