# Guest Form Management

Vite + React admin/guest SPA with Supabase Edge Functions (Deno).

## Quick start

```bash
bun install
./dev.sh              # Docker + local Supabase + UI
./dev.sh --ui-only    # UI only (remote Supabase in ui/.env.development)
```

## Docs

- **[docs/README.md](docs/README.md)** — documentation index
- **[docs/PROJECT.md](docs/PROJECT.md)** — architecture & API
- **[scripts/README.md](scripts/README.md)** — automation scripts

## Tooling

```bash
bun run lint
bun run type-check
bun run build
```

CI runs the same checks on push/PR (`.github/workflows/ci.yml`).

**VS Code:** Run **Terminal → Run Task** for dev, Supabase, quality, and deploy scripts (`.vscode/tasks.json`). Default build task: **Dev: Full stack**. Cursor also shows **Start dev server** (auto from `package.json` — uses Bun via `npm.packageManager`).

Cursor agent rules: **`.cursor/rules/README.md`**
