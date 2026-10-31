# workflow-wont-do

Mark a plan as **cancelled** — move to `docs/workflow/wont-do/`.

## Steps

1. Identify the slug from `planned/`, `in-progress/`, or user message.
2. Run:

```bash
bash scripts/dev/workflow-move.sh wont-do <slug>
```

Moves `<slug>.md` and `<slug>-design.md` (if present) from the source folder to `wont-do/`. Updates `stage: wont-do` and runs scratchpad emoji sync.

3. **Sync scratchpad:** set matching item to **❌** and add:

```markdown
→ **Won't do:** [`../wont-do/<slug>.md`](../wont-do/<slug>.md)
```

Read `.agent/skills/workflow-intake-scratchpads/SKILL.md`.

4. Add a row to [`docs/workflow/wont-do/README.md`](../../docs/workflow/wont-do/README.md) with a one-line reason.

5. Remove the plan row from `docs/workflow/planned/README.md` if it was listed there.

**Scratchpad-only cancel** (never had a plan file): mark **❌** in `_to-prompt.md` / `_to-plan.md` with reason only, or create a minimal doc in `wont-do/` for traceability.
