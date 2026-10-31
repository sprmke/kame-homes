# workflow-sync-scratchpads

Sync **`docs/workflow/intake/_to-prompt.md`** and **`_to-plan.md`** status emojis from workflow folder state.

Read **`.agent/skills/workflow-intake-scratchpads/SKILL.md`** for emoji meanings and when to run manually vs after a move.

## Run

Preview (no writes):

```bash
bun run sync:workflow-scratchpads -- --dry-run --report
```

Apply updates + list unlinked workflow docs:

```bash
bun run sync:workflow-scratchpads -- --report
```

After `/workflow-start`, `/workflow-done`, or `/workflow-wont-do` on a single slug (also runs automatically from `workflow-move.sh`):

```bash
bun run sync:workflow-scratchpads -- --slug=my-slug
```

## What it does

| Source in item block                      | Emoji set                      |
| ----------------------------------------- | ------------------------------ |
| Link to `in-progress/` doc                | 🚧                             |
| Link to `planned/` doc (no in-progress)   | 📋                             |
| Link to `done/` doc only                  | ✅                             |
| Link to `wont-do/` doc                    | ❌                             |
| No link — title match (`--fuzzy`, opt-in) | Same as above                  |
| Title starts with ❌                      | Unchanged                      |
| No workflow link in body                  | Unchanged (keeps manual emoji) |

Does **not** rewrite item bodies or add `→` link lines — add those when moving plans (`/workflow-start`, `/workflow-done`, `/workflow-wont-do`).

Validate after sync:

```bash
bun run check:workflow-scratchpads
```

This command is available in chat with **/workflow-sync-scratchpads**
