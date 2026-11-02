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

### One project, one pipeline (2026-11-02 cutover)

The legacy dual-track is over. There is **one** Supabase project and **one** Vercel project
for multi-tenant. Legacy `zftt…` is retired and must not be used.

| Surface               | Value                                                                               |
| --------------------- | ----------------------------------------------------------------------------------- |
| Supabase              | `fworvijbrwpyngycotbz` — "Kame Homes - Dev", **serves production** too              |
| Vercel (multi-tenant) | `kame-homes` (team `kame-works`) — Preview on `develop`, Production on `main`       |
| Vercel (legacy)       | `guest-form-management-app` — retired, do not deploy to it                          |
| Public domain         | `kamespace.com` (production), `dev.kamespace.com` / `dev.kamehomes.space` (preview) |
| Backend deploy        | `.github/workflows/cd-prod.yml` — the single pipeline, on `develop`                 |
| UI deploy             | Vercel (separate from the backend pipeline)                                         |

**Because one project serves both environments, a "dev deploy" is a production deploy.**
That is why there is exactly one backend workflow: `cd-dev.yml`, `cd-preprod.yml` and the old
gated `cd-prod.yml` all resolved to the same ref and each duplicated a quality gate.

Consequences agents must respect:

- A migration or edge-function deploy reaches real users. Treat `bun run deploy:supabase:dev`
  as a production action.
- Load / abuse / cost-probe scripts refuse this ref outright: there is no disposable target.
  Stand up a throwaway project if you need to hammer something.
- The deploy workflow takes a pre-deploy backup and publishes it as an artifact, and captures
  a schema diff before pushing. Do not bypass them.

`scripts/migrate/legacy-to-mt-prod/` is the completed migration's record. It is historical and
must not be run.

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
| **Preview**       | [`dev-staging-environment.md`](../archive/operations/dev-staging-environment.md) — retired as a hosted environment; use local or a Vercel preview URL       |
| **Migrations**    | [`migration-runbook.md`](../archive/operations/migration-runbook.md)                                                                                         |

- `ui/vercel.json`: SPA rewrites to `index.html` for every path except `/assets/*` (a missing old chunk returns 404 instead of HTML cached as `immutable`), Vite build output `dist`. After a deploy, an open tab that hits a removed chunk reloads once (`ui/src/lib/chunkReload.ts`, wired into `RouteErrorFallback` and `AppErrorBoundary`; a second failure within 10s shows the error screen). Headers (doc 16): hashed `/assets/*` is `immutable`; `/index.html` is `public, max-age=0, must-revalidate`; unhashed `ui/public` trees (`/icons`, `/favicon`, `/templates`, `/images`, `/marketing`, `/avatars`, `/fonts`, `/worklets`) use weekly `max-age` + `stale-while-revalidate` (never `immutable`); PWA files stay short/no-cache. Catch-all security headers: HSTS, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy` (microphone + geolocation `self` only), `Content-Security-Policy-Report-Only` (doc 22; inventory `docs/architecture/third-party-origins.md`). Config guards: `scripts/dev/check-vercel-headers.sh`, `check-csp-theme-hash.sh` (no inline scripts/handlers in `index.html`); post-deploy: `bun run verify:deployed-preview`.
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
