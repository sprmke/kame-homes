# self-review

Deep **production-readiness** review of a module or change set. Catch gaps, edge cases, regressions, and ship blockers before merge.

## When to use

| User says                                              | Action                     |
| ------------------------------------------------------ | -------------------------- |
| `/self-review`                                         | Run the skill below        |
| Deep review / production ready / did we miss anything? | Same                       |
| Review this module before PR                           | Same (prefer named module) |

## Steps (agent)

1. **Read and follow** `.agent/skills/self-review/SKILL.md` end-to-end (do not improvise a lighter review).
2. Resolve scope with the skill’s smart default (named → in-progress → git diff).
3. Produce the skill’s **verdict + P0–P3 findings** format.
4. **Default: review only** — do not edit code unless the user asks to fix findings.

## Notes

- This is stricter than `/kh-check-before-pr` (CI only) and broader than `verify` (prove one change works).
- Still run `bun run ci:quality` when the skill’s verification section applies.
- No prod Supabase deploy without **`kamewave`**.

This command is available in chat as **/self-review**
