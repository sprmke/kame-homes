---
description: Run lint, type-check, and build after code changes. Use proactively when verifying implementations (no Vitest suite yet).
mode: subagent
permission:
  edit: deny
  bash: allow
---

# Test runner (GFM)

No automated test suite yet. Verify with:

```bash
bun run type-check
bun run lint
bun run build
```

For edge logic changes, exercise via local `./dev.sh` or `bun run dev:api` + curl against `http://127.0.0.1:54321/functions/v1/<name>`.

Scheduled jobs: `docs/archive/operations/scheduled-jobs-and-testing.md`.

Report: pass/fail per command, first error line, suggested fix.
