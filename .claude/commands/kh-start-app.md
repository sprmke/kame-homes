# kh-start-app

Start the app locally for testing. For new teammates (QA / tester / junior dev).

## When to use

| User says                        | Recommended mode                              |
| -------------------------------- | --------------------------------------------- |
| Run the app / test on my machine | Ask which mode (default: UI → hosted **dev**) |
| Full local stack                 | Docker + local Supabase + UI                  |
| UI only against dev              | Fastest for most QA                           |

## Modes

### A — UI only → hosted multi-tenant **dev** (default for QA)

Uses `ui/.env.development.dev`. Needs network. No local Docker DB.

```bash
./dev.sh --ui-only --env dev
```

App: usually `http://localhost:5173` (Vite). Remote API/data: **dev** Supabase (`fwor…`), not production.

### B — Full local stack

Docker Desktop must be running.

```bash
./dev.sh
```

Local Supabase + Edge Functions + UI. Heavier; use when testing migrations or local functions.

### C — UI only → local env file

```bash
./dev.sh --ui-only
```

Uses `ui/.env.development` (whatever that file points at — confirm before testing).

## Steps (agent)

1. Check if a dev server is already running (terminals / ports). Do not start a duplicate if one is healthy.
2. Prefer **mode A** unless the ticket needs local DB/functions.
3. After start, tell the user:
   - Local URL
   - Which backend (dev hosted vs local)
   - Reminder: never deploy to production Supabase from a QA session
4. Optional: open the route from the ticket (from **Where** in the GitHub issue).

## Don'ts

- Do not run `bun run deploy:supabase` or other prod DB mutators.
- Do not recommend merging multi-tenant work to `main`.
- Do not commit `.env` files or secrets.

## Related

- Pull latest first: **/kh-pull-new-changes**
- Dev/staging notes: `docs/archive/operations/dev-staging-environment.md`

This command is available in chat as **/kh-start-app**
