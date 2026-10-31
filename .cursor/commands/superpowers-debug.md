# superpowers-debug

Run the **Superpowers systematic-debugging** workflow in **lean mode** (hooks enforce — subagents blocked).

## Lean constraints (mandatory)

Read **`.agent/skills/superpowers/SKILL.md`** § Lean mode first.

- Single-threaded debug. No subagents, no Explore, no Task tool.
- Read `docs/PROJECT.md` and files directly relevant to the bug.

## Steps

Read and follow **`superpowers:systematic-debugging`** completely before proposing fixes — **without** spawning subagents.

This command opts in to Superpowers for the current chat. Available as **/superpowers-debug**.
