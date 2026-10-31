# superpowers-execute

Execute an existing plan in **lean mode** (hooks enforce — subagents blocked).

## Lean constraints (mandatory)

Read **`.agent/skills/superpowers/SKILL.md`** § Lean mode (execute) first.

- Implement inline in this session — one task at a time, main thread only.
- No subagents, no Explore, no Task tool, no subagent-driven-development.
- Read the plan from `docs/workflow/in-progress/` or `docs/workflow/planned/`; per-task files only via targeted `rg`/`Read`.
- Override plugin `executing-plans` and `subagent-driven-development` — do not dispatch a subagent per task.

## Steps

1. Read **`.agent/skills/superpowers/SKILL.md`** (doc paths + lean execute rules).
2. Read the plan path the user gives, or the latest `docs/workflow/in-progress/*.md`, else `docs/workflow/planned/*.md`.
3. If not already in-progress, run `/workflow-start <slug>` first.
4. Follow **`superpowers:executing-plans`** single-threaded — work through tasks in order without subagents.

Use a **fresh session** after planning (`/clear`). Opts in to Superpowers for this chat.
