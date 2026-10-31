# kh-check-before-pr

Run the **same quality checks as CI** before opening a PR. For new teammates.

## When to use

| User says                         | Action                   |
| --------------------------------- | ------------------------ |
| Check before PR / is it ready?    | Run `bun run ci:quality` |
| Lint / type-check / build locally | Same                     |

## Steps (agent)

1. From repo root:

```bash
bun run ci:quality
```

This mirrors GitHub Actions quality (type-check, lint errors, filenames, Vitest, Deno `_shared` + handler tests, Playwright `@smoke`, build).

2. If it **passes**: say they can run **/kh-submit-for-review**.

3. If it **fails**:
   - List the failing step and first actionable errors (not a huge dump).
   - Fix only if the user asked you to fix; otherwise explain what to change.
   - Re-run until green when fixing.

## Notes

- ESLint **warnings** alone usually do not fail CI; **errors** do.
- Do not skip hooks (`--no-verify`) unless the user explicitly asks.
- Optional targeted Playwright (not a substitute for `ci:quality`):

```bash
bun run test:e2e:smoke   # PR @smoke suite
bun run test:e2e:ci      # develop @ci mocked domains
./dev.sh --ui-only --env dev
```

This command is available in chat as **/kh-check-before-pr**
