# production-readiness-review

Deep **code review** of production-readiness checklist **phases 5–10** before moving to Tier 2 (docs 11–17).

## When to use

| User says                                                | Action              |
| -------------------------------------------------------- | ------------------- |
| `/production-readiness-review`                           | Run the skill below |
| Review phases 5–10 / tier 1 checklist                    | Same                |
| Ready for phase 11? / pagination debounce skeleton audit | Same                |

## Steps (agent)

1. **Read and follow** `.agent/skills/production-readiness-review/SKILL.md` end-to-end (do not improvise a lighter review).
2. Read implementation-status sections in `docs/workflow/planned/production-readiness-checklist/05` through `10`.
3. Review the git diff for all related changes; map each file to its phase.
4. Run verification from the skill (`ci:quality`, `check-unbounded-select.sh`, `db:migrate` when migration changed).
5. Produce the skill's **verdict + per-phase summary + P0–P3 findings** format.
6. **Default: review only** — do not edit code unless the user asks to fix findings.

## Notes

- Phases **00–05** are inputs only unless the diff touches them; focus on **06–10** shipped work vs deferred items.
- Stricter than `/kh-check-before-pr` (CI only); narrower than `/self-review` (any module).
- Exit gates in each plan doc may still be **partial** — the review should say what is honestly done vs deferred.
- No prod Supabase deploy without **`kamewave`**.

This command is available in chat as **/production-readiness-review**
