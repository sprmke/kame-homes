---
name: testing
description: >-
  Pick unit vs Playwright E2E vs manual; colocate tests; extend harnesses;
  run CI commands. Use when adding/changing features, fixing bugs in logic,
  or before claiming work done on ui/ or supabase/functions/.
---

# Testing (GFM)

Plan: **`docs/workflow/done/sitewide-automated-testing.md`**. Index: **`docs/guides/testing/README.md`**. Rule: **`.cursor/rules/testing.mdc`**.

## Decision table

| Question                                  | Answer                          |
| ----------------------------------------- | ------------------------------- |
| Deterministic rule without browser?       | **Unit** (Vitest or Deno)       |
| User journey (routing + API + auth)?      | **Playwright mocked** + harness |
| Real PayMongo / Google OAuth / email OTP? | **Manual** guide only           |
| Local Supabase full stack?                | Playwright `@live`, not PR CI   |

## File placement

| Kind       | Path                                                      |
| ---------- | --------------------------------------------------------- |
| UI unit    | `ui/src/.../foo.test.ts` next to `foo.ts`                 |
| Edge unit  | `supabase/functions/_shared/foo_test.ts`                  |
| Handler    | `supabase/functions/tests/foo.test.ts`                    |
| E2E        | `ui/e2e/features/<domain>/*.spec.ts`                      |
| Harness    | `ui/e2e/features/<domain>/shared/*Harness.ts`             |
| Shared E2E | `ui/e2e/shared/authSeam.ts`, `interceptEdge.ts`, `ids.ts` |

## Playwright pattern

1. Reuse **`ui/e2e/shared/authSeam.ts`** for host/guest session mocks.
2. Reuse **`interceptEdge.ts`** for `**/functions/v1/*` route mocks.
3. Tag specs: `@smoke` (PR), `@ci` (develop), `@live` (manual/nightly).
4. One happy path + 1–3 edge journeys per domain.

## Deno pattern

```bash
bun run test:edge
bun run test:edge:handlers
```

Copy header from `supabase/functions/_shared/captcha_test.ts`. Stub `fetch` / env for network.

## Vitest pattern

```bash
bun run test
```

Node env only (`ui/vitest.config.ts`). No DOM unless a rare pure helper needs it later.

## Same-change checklist

Before claiming done on a material change:

- [ ] Logic changed → unit test added/updated
- [ ] Journey changed → Playwright spec + harness mock updated
- [ ] Route UX changed → route guide **Testing** row updated
- [ ] Third-party only → manual guide checkbox
- [ ] `bun run ci:quality` green (or at least `test` + `test:edge` for edge-only)

## CI parity

```bash
bun run ci:quality
```

Matches `.github/workflows/ci.yml` and `cd-dev.yml` quality job.

## AI tools (explore vs regression)

| Tool                               | Use                                 |
| ---------------------------------- | ----------------------------------- |
| Playwright **specs** in repo       | Regression (CI)                     |
| Playwright **MCP** / **CLI** skill | Explore UI while writing a spec     |
| Context7 MCP                       | Vitest / Playwright / Deno API docs |
| Supabase MCP read-only             | Schema for edge tests               |
| `test-runner` agent                | Run quality scripts after edits     |

Do not substitute MCP clicks for committed specs.

## Related skills

- `route-guides` — Testing column on page guides
- `booking-workflow` — statusMachine invariants
- `plans-and-permissions` — gate matrix tests
- `audit-logging` — action catalog when mutating
