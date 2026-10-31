---
name: fix-migration-issues
description: Apply pending local Supabase migrations safely when schema drift or missing columns appear. Use after adding a new file under supabase/migrations/, when local Postgres is behind the repo, or when errors mention missing tables/columns/policies. Never suggest db reset or production deploy.
---

# Fix migration issues (local only)

## When to use

Invoke **`/fix-migration-issues`** or this skill when:

- You **added a new file** under `supabase/migrations/`
- Local errors mention **missing column/table**, **relation does not exist**, or **migration history** drift on **127.0.0.1:54322**
- `supabase status` shows local stack up but schema is behind git
- After pulling a branch that includes new migrations

## Default fix (run this)

From repo root, with local Supabase running:

```bash
bun run db:migrate
```

Equivalent:

```bash
supabase migration up --local --include-all
```

(`db:migrate` sources `ui/.env.development` for Google OAuth vars the CLI may need — prefer the wrapper.)

## Preconditions

1. **Local stack running** — if not: `bun run start:supabase` or `./dev.sh`
2. **New migration only** — never edit shipped files under `supabase/migrations/` (hook blocks edits); add a new timestamped file instead
3. **Read the error** — if migration SQL itself fails, fix the **new** migration file and run `bun run db:migrate` again

## After success

- Re-run the failing query, edge function curl, or UI flow
- If the task added schema used by edge/UI, mention that local verification now depends on this migrate step

## Never suggest (without explicit user + `kamewave`)

| Avoid                                         | Why                                                 |
| --------------------------------------------- | --------------------------------------------------- |
| `bun run db:reset` / `supabase db reset`      | Wipes local data — destructive, not the default fix |
| `supabase db push`, `db push --linked`        | Remote/prod schema mutation                         |
| `bun run deploy:supabase*`                    | Production deploy                                   |
| `supabase migration up` **without** `--local` | Can target linked/remote                            |
| `supabase migration repair` on linked         | Remote history mutation                             |

See **`.cursor/rules/no-prod-deploy.mdc`**.

## If migrate still fails

1. Read the migration error output — fix SQL in the **new** file only
2. Confirm local Postgres is reachable: `bun run status:supabase`
3. For history mismatch on **local only**, see `docs/archive/operations/migration-runbook.md` — still avoid reset unless the user explicitly asks
4. Do **not** jump to prod deploy as a workaround

## Related

- Rule: `.cursor/rules/supabase-platform.mdc` (migrations section)
- Runbook: `docs/archive/operations/migration-runbook.md`
- Prod cutover (only with **`kamewave`**): `docs/archive/operations/production-deployment.md`
