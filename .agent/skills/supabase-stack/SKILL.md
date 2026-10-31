---
name: supabase-stack
description: Supabase Postgres, Auth, Storage, and Edge Functions for guest-form-management. Use for migrations, RLS, storage buckets, env vars, local vs hosted Supabase, or platform architecture.
---

# Supabase stack (GFM)

## Architecture

- **UI:** Vite SPA → `fetch` / Supabase JS client
- **API:** Edge Functions (Deno) in `supabase/functions/`
- **DB:** Postgres + SQL migrations (no ORM)
- **Files:** Supabase Storage
- **Auth:** Supabase Auth (admin Google OAuth)

## Key paths

| Concern           | Path                                              |
| ----------------- | ------------------------------------------------- |
| Migrations        | `supabase/migrations/`                            |
| Edge handlers     | `supabase/functions/<name>/index.ts`              |
| Shared server     | `supabase/functions/_shared/`                     |
| Config            | `supabase/config.toml`                            |
| UI client         | `ui/src/lib/supabase/client.ts`                   |
| Admin edge helper | `ui/src/features/dashboard/org/lib/edgeClient.ts` |

## Rules

- `.cursor/rules/supabase-edge-functions.mdc` — handler skeleton, JWT policy
- `.cursor/rules/supabase-platform.mdc` — migrations, env
- `.cursor/rules/security.mdc` — org/property scoping

## Local dev

```bash
bun run start:supabase
./dev.sh
bun run dev:api    # functions serve only
```

## Env checklist

- UI: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, optional `VITE_SUPABASE_PROJECT_URL`
- Edge: `supabase/.env.local` — see `supabase/.env.example`
- Document new secrets in `docs/architecture/validation-and-env.md`

## Storage

Upload from edge (`uploadService.ts`, `upload-booking-asset`). UI uses signed/public URLs returned by API — do not embed service role in browser.

## When adding a table

1. Migration SQL + indexes + FK to org/property where applicable
2. Update `docs/architecture/data-model.md`
3. Edge access via service role client; enforce `verifyPropertyAccess` / scoping
