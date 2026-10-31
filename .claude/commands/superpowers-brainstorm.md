# superpowers-brainstorm

Run the **Superpowers brainstorming** workflow in **lean mode** (hooks enforce — subagents blocked).

## Lean constraints (mandatory)

Read **`.agent/skills/superpowers/SKILL.md`** § Lean mode first.

- Spec/design only. No subagents, no Explore, no Task tool.
- Read `docs/PROJECT.md` and the relevant route guide only.
- Save to `docs/workflow/intake/<slug>-design.md` — concise design, not exhaustive code dumps.
- Stop when the spec is saved; do not chain into `/superpowers-plan` unless the user asks.

## Steps

1. Read **`.agent/skills/superpowers/SKILL.md`** (repo path overrides + lean mode).
2. Follow **`superpowers:brainstorming`** single-threaded — no Explore fan-out.
3. **Save the design spec to `docs/workflow/intake/<feature>-design.md`** — never `docs/superpowers/specs/`. **No date prefix.**
4. Get user approval before implementation or `/superpowers-plan`.

Opts in to Superpowers for this chat.
