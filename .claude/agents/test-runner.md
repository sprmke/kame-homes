---
name: test-runner
description: Run ci:quality (lint, type-check, Vitest, Deno, Playwright smoke, build) after code changes. Use proactively when verifying implementations.
model: fast
---

# Test runner (GFM)

Run the CI parity gate:

```bash
bun run ci:quality
```

Or targeted:

```bash
bun run type-check
bun run lint
bun run test
bun run test:edge
bun run test:edge:handlers
bun run test:e2e:smoke
bun run build
```

Playwright specs live in `ui/e2e/features/`. Skill **`testing`**, index `docs/guides/testing/README.md`.

Report: pass/fail per command, first error line, suggested fix.
