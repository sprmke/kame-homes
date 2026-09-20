---
title: 'Deployment'
status: active
tags: [architecture, deployment]
updated: 2026-08-09
---

# Deployment

Part of the [`docs/PROJECT.md`](../PROJECT.md) architecture split.

---

## 12. Deployment

### Dual-track (multi-tenant WIP) — agents read this first

Until multi-tenant cutover is complete, **two parallel stacks** (same git repo, **separate** Vercel + Supabase projects):

| Track                | Git branch (today)         | Vercel project                                                                                          | Supabase ref                                           |
| -------------------- | -------------------------- | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| **Live users**       | **`main`** (hotfixes only) | **LEGACY** [`guest-form-management-app`](https://vercel.com/sprmkes-projects/guest-form-management-app) | **LEGACY_PROD** `zfttdwtceyqszyeyhilc`                 |
| **Multi-tenant WIP** | **`develop`**              | **NEW** [`kame-homes`](https://vercel.com/kame-works/kame-homes) Preview                                | **MULTI_TENANT_DEV** `fwor…` only _(mt-prod deferred)_ |

### Vercel project inventory (canonical)

Each project’s **Production** environment (not Preview) is the deploy surface for that track.

| Logical name            | Vercel project              | Team               | Production branch (configured)                                                 | Production env → Supabase                                            |
| ----------------------- | --------------------------- | ------------------ | ------------------------------------------------------------------------------ | -------------------------------------------------------------------- |
| **LEGACY_VERCEL**       | `guest-form-management-app` | `sprmkes-projects` | **`main`**                                                                     | LEGACY `zftt…`                                                       |
| **MULTI_TENANT_VERCEL** | `kame-homes`                | `kame-works`       | Preview: **`develop`** · Production: **`main`** _(at release — not wired yet)_ | Preview → **fwor…** · Production → **mt-prod** _(create at release)_ |

Same monorepo is connected to **both** Vercel projects. Pushing to `main` deploys only the legacy project; pushing to the multi-tenant branch deploys only `kame-homes`.

### Supabase project inventory (canonical)

Project **refs** are public in API URLs; **keys** stay in gitignored env only.

| Logical name          | Env var(s)                                          | Project ref                           | Host                               | Used for                                                                                       |
| --------------------- | --------------------------------------------------- | ------------------------------------- | ---------------------------------- | ---------------------------------------------------------------------------------------------- |
| **LEGACY_PROD**       | `PROD_PROJECT_REF` (guard in `.env.dev.local`)      | `zfttdwtceyqszyeyhilc`                | `zfttdwtceyqszyeyhilc.supabase.co` | **`guest-form-management-app`** Production (`main`), live users                                |
| **MULTI_TENANT_DEV**  | `DEV_PROJECT_REF` in `supabase/.env.dev.local`      | `fworvijbrwpyngycotbz`                | `fworvijbrwpyngycotbz.supabase.co` | **`kame-homes`** Preview / `develop` URL, `deploy:supabase:dev`, `cd-dev.yml`                  |
| **MULTI_TENANT_PROD** | `MT_PROD_PROJECT_REF` in `supabase/.env.prod.local` | _(deferred — create at prod release)_ | —                                  | **`app.kamehomes.space`** after **`develop` → `main`**; legacy data migration from **`zftt…`** |

Aliases: informal **NEW_PROD** in older docs meant **MULTI_TENANT_DEV** during early wiring — **mt-prod is now a separate project** (see [`multi-tenant-dev-prod-setup.md`](../archive/operations/multi-tenant-dev-prod-setup.md)).

**Do not:**

- Deploy multi-tenant migrations or Edge Functions to the **legacy production** Supabase until a planned cutover.
- Point **`guest-form-management-app`** Production env at multi-tenant Supabase, or **`kame-homes`** at LEGACY Supabase.
- Merge multi-tenant-only work into **`main`** until cutover readiness.

**Do:**

- Multi-tenant **dev** only for now: push **`develop`** → **`dev.kamehomes.space`** → **`fwor…`**.
- **At prod release:** create mt-prod, migrate legacy data ([`legacy-to-mt-prod-migration.md`](../archive/operations/legacy-to-mt-prod-migration.md)), merge **`develop` → `main`**, wire **`app.kamehomes.space`** → mt-prod.
- Legacy UI: push hotfixes to **`main`** → **`guest-form-management-app`** only.
- Use `bun run deploy:supabase:dev` against **`fwor…`** only; mt-prod deploy manual until scripted.
- Git branches: **`develop`** (mt-dev, daily work) · **`main`** (legacy live today; mt-prod UI at release after **`develop` → `main`** merge).

| Artifact                               | Doc                                                                                                                                                                                                                           |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Environment matrix**                 | [`ci-cd-environment-matrix.md`](../archive/operations/ci-cd-environment-matrix.md) — git / Vercel / GitHub / Supabase                                                                                                         |
| **CI/CD + environments (in progress)** | [`ci-cd-environments/README.md`](../workflow/in-progress/ci-cd-environments/README.md) — design, plan, status, dev/staging tracker                                                                                            |
| Design                                 | [`ci-cd-dev-prod-design.md`](../workflow/in-progress/ci-cd-environments/ci-cd-dev-prod-design.md)                                                                                                                             |
| Implementation plan                    | [`ci-cd-dev-prod.md`](../workflow/in-progress/ci-cd-environments/ci-cd-dev-prod.md) (Phases A–C shipped; F in progress)                                                                                                       |
| **mt-dev + mt-prod (phased)**          | [`multi-tenant-dev-prod-setup.md`](../archive/operations/multi-tenant-dev-prod-setup.md) · status [`multi-tenant-dev-prod-environments.md`](../workflow/in-progress/ci-cd-environments/multi-tenant-dev-prod-environments.md) |
| **Legacy → mt-prod migration**         | [`legacy-to-mt-prod-migration.md`](../archive/operations/legacy-to-mt-prod-migration.md)                                                                                                                                      |
| GitHub env setup                       | [`github-environments-setup.md`](../archive/operations/github-environments-setup.md)                                                                                                                                          |
| Dev/staging runbook                    | [`dev-staging-environment.md`](../archive/operations/dev-staging-environment.md)                                                                                                                                              |
| Production / cutover                   | [`production-deployment.md`](../archive/operations/production-deployment.md)                                                                                                                                                  |

### Checklists

| Environment       | Checklist / runbook                                                                                                                                          |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Production**    | [`production-deployment.md`](../archive/operations/production-deployment.md) — backups, `db push`, secrets, Vercel Production (`kamewave` unlock for agents) |
| **Dev / Preview** | [`dev-staging-environment.md`](../archive/operations/dev-staging-environment.md) — **`kame-homes`** + hosted dev Supabase, local mode picker                 |
| **Migrations**    | [`migration-runbook.md`](../archive/operations/migration-runbook.md)                                                                                         |

- `ui/vercel.json`: SPA rewrites to `index.html`, Vite build output `dist`. Headers (doc 16): hashed `/assets/*` is `immutable`; `/index.html` is `public, max-age=0, must-revalidate`; unhashed `ui/public` trees (`/icons`, `/favicon`, `/templates`, `/images`, `/marketing`, `/avatars`, `/fonts`, `/worklets`) use weekly `max-age` + `stale-while-revalidate` (never `immutable`); PWA files stay short/no-cache. Catch-all security headers: HSTS, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy` (microphone + geolocation `self` only). CSP is doc 22. Config guard: `scripts/dev/check-vercel-headers.sh`.
- **CDN purge:** Vercel invalidates static assets on each deploy. Storage objects do not purge on deploy — change the object key or wait out `cacheControl`. Do not put `immutable` on an unhashed file.
- **PWA deploy:** the service worker + manifest ship with the normal Vercel UI build (nothing extra). Push needs Supabase migrations + secrets + Vault `push_fanout_secret` + `VITE_VAPID_PUBLIC_KEY` per Vercel project — full checklist in [`pwa.md`](pwa.md) §9. Kill-switch: [`pwa.md`](pwa.md) §10.
- **Dev deploy:** `bun run deploy:supabase:dev` (reads `supabase/.env.dev.local`) — multi-tenant **dev** project, never assume it is Vercel Production.
- **Backups & rollback:** `bun run backup:supabase:<dev|prod>`, `rollback:supabase:<dev|prod>`, `rollback:functions:<dev|prod>` — see `production-deployment.md` §1/§12.
- **Env / migration status:** `bun run env:status`, `migrations:status:dev`, `migrations:status:prod` (read-only).
- **Local modes:** `./dev.sh` (full Docker), `./dev.sh --ui-only --env dev` (hosted dev), `bun run dev:remote-api` (hybrid edge functions).

### Regional placement (verify in dashboards)

Repo files (`PROJECT.md`, `ci-cd-environment-matrix.md`, `ui/vercel.json`, `supabase/config.toml`) do **not** pin a cloud region. Confirm before launch:

| Surface          | What to check                                                                                                        | Expected for Manila users                         |
| ---------------- | -------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| Supabase project | Dashboard → Settings → General → Region                                                                              | Nearest realistic: **Southeast Asia (Singapore)** |
| Vercel           | Static assets from nearby POP; Edge Functions that talk to Postgres should run **near the DB**, not near the browser | Measure Manila → origin RTT (doc 16 / doc 25)     |

A region move after launch is a full data migration, not a config flip.

### Vendor risk and data export (doc 25.6)

| Vendor                                                 | Fallback                                                        | Multi-hour outage looks like                                                                                                                                                   | Data export                                                                                                                                                                                                |
| ------------------------------------------------------ | --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Supabase** (Postgres, Auth, Storage, Edge, Realtime) | None. The platform.                                             | App down. Use status page + maintenance mode (`platform_settings.maintenanceMode`) to stop new intake.                                                                         | `bun run backup:supabase:dev\|:prod` / `supabase db dump --linked`. Keep dumps off git (PII). Restore: `rollback:supabase:*` (rehearse on hosted-dev first — doc 24). Storage objects are a separate dump. |
| **Vercel**                                             | None for the SPA.                                               | UI 404; Edge Functions on Supabase still run if called directly.                                                                                                               | Git is the source. Preview deploys must not carry production secrets.                                                                                                                                      |
| **PayMongo**                                           | None in-market for cards/e-wallets.                             | Checkout and parking pay-now fail. Existing bookings stay.                                                                                                                     | Dashboard exports + `parking_payment_transactions` / subscription rows in Postgres.                                                                                                                        |
| **Resend**                                             | None for transactional email.                                   | Guests/hosts miss confirmations and inbound GAF approvals stall. Bounce/complaint events write `email_suppressions`; guest-lifecycle sends skip suppressed addresses (doc 25). | Resend dashboard + Postgres `processed_emails` / `email_suppressions`.                                                                                                                                     |
| **Gemini / Groq**                                      | Each other for some text paths; image/video gen is Gemini-only. | AI features 429/disabled via quota kill switches. Core booking loop still works.                                                                                               | No guest-data store at the vendor we own; prompts are ephemeral.                                                                                                                                           |
| **Meta Graph**                                         | Web chat still works.                                           | Host inbox Meta channel silent.                                                                                                                                                | Conversations already in `social_*` tables.                                                                                                                                                                |
| **PostHog**                                            | Product still works.                                            | Analytics/errors gap.                                                                                                                                                          | PostHog project export.                                                                                                                                                                                    |
| **Google Maps**                                        | Listing pages without maps.                                     | Public search UX degraded.                                                                                                                                                     | N/A.                                                                                                                                                                                                       |

Communication plan for a vendor outage is doc 30. Secret rotation: [`secret-rotation.md`](../archive/operations/secret-rotation.md).
