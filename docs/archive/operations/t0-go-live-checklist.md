---
title: T0 go-live checklist (Google / PayMongo review)
status: active
updated: 2026-11-01
---

# T0 go-live checklist

Use this when production is **fwor** and the public URL for reviewers is **`https://kamespace.com`**.

## Already done (2026-11-01 / 2026-11-02)

- Legacy data + storage on fwor (Oct 27 load; booking paths re-verified 2026-11-02: 1,303/1,303 readable)
- `kame-homes` Vercel Production env vars → fwor
- GitHub `production` secrets + **`CUTOVER_ENABLED=true`**
- Redirect rules in `ui/vercel.json` (active when apex domains attach)
- `pg_cron` + `pg_net` installed; 26 jobs defined with the 13 outbound jobs parked (`sql/60-install-extensions-and-crons.sql`)
- QA fixtures and legacy guest sign-ins removed; prod holds 1 org / 1 property / 2 auth users
- `main → develop` merge landed (2026-11-02)

## T0 data step (D8)

Legacy takes bookings until the freeze, so the Oct 31 copy is not final. At T0:

1. `bun run backup:supabase:prod` (kamewave) before touching anything.
2. Freeze legacy `/form`, then `sql/05-legacy-freeze.sql`.
3. `migrate.sh dump` → `restore` → `upgrade` → `sql.run 30-rewrite-storage-urls` → `sql.run 40-derived-rebuild` locally.
4. `KAMEWAVE=kamewave pushLocalRehearsalToHosted.sh backups/migration/<run>`.
5. `sql/20-shape-tenant-org.sql` + `syncHostedStorageFromLegacy.ts` (copy + verify).
6. `CUTOVER_FREEZE_PAIR=1 … hosted-prod-verify.ts` must pass before DNS moves.

Skip 3–5 only if the freeze dump shows zero drift (counts + `max(created_at)` + `max(updated_at)`).

## Blocked on your login (one-time)

**Supabase CLI on this Mac cannot deploy to fwor** (403; `supabase projects list` no longer shows fwor). Fix:

1. Log into Supabase Dashboard as the **org owner** for project fwor.
2. Run `supabase login` and `supabase link --project-ref fworvijbrwpyngycotbz`.
3. Or run **GitHub Actions → CD Prod** from **`main`** with input **`CUTover`** (uses `SUPABASE_ACCESS_TOKEN` secret).

## Ship app code to Production

**2026-11-01:** **`develop` → `main`** cutover merge landed in PR #188. **`main`** may be **ahead** of **`develop`** on CD/deploy hotfixes only — merge **`main` → `develop`** so Preview matches Production tooling. **2026-11-02: done**, and `develop` carries the storage/asset fixes.

**2026-11-02 finding:** the Vercel project's **Production branch is `production`**, not `main`, so `main` pushes build Preview only and Production (`app.kamehomes.space`) still serves a **2026-09-07** build. At T0 either:

- set Production branch to `main` in the Vercel dashboard (the API rejects `productionBranch` on PATCH), or
- deploy Production explicitly from the merged `main` worktree: `vercel --prod`.

Confirm the deployed `/assets/index-*.js` points at fwor before handing the URL to reviewers.

## DNS (Namecheap → Vercel)

| Host                | Points to                      |
| ------------------- | ------------------------------ |
| `kamespace.com`     | Vercel `kame-homes` Production |
| `www`               | same or CNAME to apex          |
| `dev.kamespace.com` | Preview (`develop`) optional   |

Attach domains in Vercel **kame-homes** before Google OAuth origins use `https://kamespace.com`.

## Supabase Auth (fwor dashboard)

- **Site URL:** `https://kamespace.com`
- **Redirect URLs:** `https://kamespace.com/**`, `https://dev.kamehomes.space/**` (until dev hostname moves)
- **Google OAuth:** production client with redirect `https://fworvijbrwpyngycotbz.supabase.co/auth/v1/callback`

Plan 05: submit Google verification after the above.

## Deploy functions

CD Prod (`cd-prod.yml`) and CD Dev (`cd-dev.yml`) both shell out to `supabase functions deploy` with Docker bundling. On 2026-11-02 the Docker path stalled mid-run on `fwor`; this works and is much faster:

```bash
supabase functions deploy --project-ref fworvijbrwpyngycotbz \
  --use-api --import-map supabase/functions/deno.json
```

`--import-map` is required server-side, otherwise bare `zod` imports in `_shared` fail to bundle. Deploy from a clean worktree of the release commit, never from a dirty tree.

## PayMongo

- Webhook URL: `https://fworvijbrwpyngycotbz.supabase.co/functions/v1/paymongo-webhook`
- **Status 2026-11-02:** account still in test mode; both webhooks are `disabled` (`max_retries_exceeded`). Live keys in fwor Edge secrets plus a re-enabled webhook are required before plan or parking checkout can confirm. Guest bookings use manual GCash, so cutover is not blocked by this.

## Cutover watermark (after go decision)

Sets cron guards so historic guests are not emailed again:

```sql
UPDATE platform_settings
SET migration_cutover_at = now()
WHERE id = 1;
```

Run once at go-live (agent can run via `PROD_DB_URL` when linked).

## Legacy stack (after kamespace.com works)

1. Legacy maintenance on `/form` (optional freeze window)
2. `sql/05-legacy-freeze.sql` on **zftt** (stop legacy crons)
3. Move `kamehomes.space` apex to **kame-homes** Vercel project

## Order for reviewers (minimal)

1. Merge `main` → `develop` (already done 2026-11-02), then `develop` → `main` + deploy Vercel Production
2. DNS `kamespace.com` + attach in Vercel
3. Deploy edge functions to fwor (CLI or CD Prod)
4. Auth Site URL + Google OAuth client
5. PayMongo webhooks + live keys
6. Run T0 data step above, then `sql/61-activate-all-crons.sql`
7. Submit Google + PayMongo review
