# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

**Guest Form Management (GFM)** — a multi-tenant property-management platform, not just a guest form. Core loop: guests submit a booking form; admins run each booking through a status workflow (`PENDING_REVIEW` → … → `COMPLETED`) with Resend email and inbound approval email for Azure GAF/pet documents.

Beyond that loop: org/property/**parking** multi-tenancy (parking is a separate vertical + RBAC, not a property sub-feature) with org verification tiers and a super-admin layer (`/admin/*`); Guest Inbox (Meta + web chat, AI replies); Marketing Studio (AI content, Meta publishing); Finance/Maintenance modules; pricing calendars; an authenticated guest portal (separate identity from the anon booking form); AI receipt validation; a voucher system. Not all of these have a dedicated skill yet — check `.claude/README.md` before assuming coverage.

Stack: **Vite + React 18 SPA** (`ui/`) + **Supabase Edge Functions** (Deno, `supabase/functions/`) — no Node API, no tRPC/Drizzle/Next.js. Postgres (plain SQL migrations, no ORM), Supabase Storage, Supabase Auth.

**Before non-trivial work**, read `docs/PROJECT.md` (architecture/API/routes/env vars) and, for booking-status/email/calendar/sheet changes, `.cursor/rules/booking-workflow.mdc` — both are authoritative, not just background reading (see "Docs are the source of truth" below).

## AI session hygiene

See **`.cursor/rules/ai-usage.mdc`** (always-on in Cursor; follow here too):

- **One task ≈ one session** — `/clear` when switching goals; avoid multi-day threads.
- **No subagent swarms by default** — Explore/Plan/brainstorm only when asked or clearly necessary.
- **Superpowers is opt-in** (`/superpowers-*` only). Do not auto-run brainstorming.
- Prefer `/effort medium` for routine chores; reserve high effort + thinking for hard judgment.
- Heavy rules (`booking-workflow`, `admin-auth`) are **not** always injected — **read them when the task touches those surfaces**.

## Commands

```bash
bun install
./dev.sh                      # full stack: Docker + local Supabase + UI (default)
./dev.sh --ui-only              # UI only — ui/.env.development
./dev.sh --ui-only --env dev    # UI only — hosted dev (ui/.env.development.dev)
bun run dev:remote-api          # local edge functions → hosted dev DB (hybrid)
bun run deploy:supabase:dev     # deploy migrations + functions to dev project
bun run backup:supabase:dev / :prod     # pre-deploy backups (also automatic before deploy)
bun run rollback:supabase:dev / :prod   # restore most recent backup (prod: kamewave required)
bun run env:status                      # which Supabase project is linked (dev/prod/unknown)
bun run setup:ai-tooling        # once after clone: Cursor/Claude/OpenCode + .agent skills, Taste, Playwright CLI, DESIGN.md, MCP

bun run lint / lint:fix / type-check / build / check:filenames / format:check
bun run start:supabase / stop:supabase / status:supabase / db:reset
bun run db:migrate   # local only: migration up --local --include-all — see /fix-migration-issues
bun run dev:api            # functions serve — local stack
bun run deploy:supabase    # PRODUCTION — kamewave unlock required for agents
```

Dev/staging setup guide: **`docs/archive/operations/dev-staging-environment.md`**

**Dual-track (multi-tenant WIP):** Live = `main` + [`guest-form-management-app`](https://vercel.com/sprmkes-projects/guest-form-management-app) + LEGACY `zftt…`. Multi-tenant = [`kame-homes`](https://vercel.com/kame-works/kame-homes) + `fwor…`. Inventory: `docs/architecture/deployment.md`.

CI (`.github/workflows/ci.yml`): type-check, lint, check:filenames, build — no test step (none exist yet, see Conventions).

Root `bun run *:supabase` wrappers source `ui/.env.development` before invoking the Supabase CLI (needed for `GOOGLE_CLIENT_*` to resolve) — prefer them over a global `supabase` CLI (easy to leave outdated, breaks Postgres 17 migrations) or `cd ui && bun run dev` directly.

### Local dev gotchas

- **502 on `/functions/v1/*`**: Kong stuck on a stale Docker edge-runtime IP after `db:reset`/a partial restart. Fix: `bun run stop:supabase` then `./dev.sh`.
- Never run a second `supabase functions serve` in parallel (Docker name conflict).
- **PWA / service worker**: the SW is **off** under `vite` dev (it would fight HMR). Test it with `bun run build && cd ui && bun run preview`, or set `VITE_PWA_DEV=true`. If a stale SW causes weird caching, DevTools → Application → Service Workers → **Unregister**, then hard-reload. Full reference: `docs/architecture/pwa.md`; rule: `.cursor/rules/pwa.mdc`.

## Architecture

```
ui/src/main.tsx → App.tsx → routes/index.tsx → merges guest/sd-form/pay-parking/dashboard routes
```

| Path                   | Role                                                                                                                                                                                     |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ui/`                  | Vite SPA — guest flows, calendar, admin dashboard                                                                                                                                        |
| `supabase/migrations/` | Postgres schema, RLS, storage policies — plain SQL, no ORM                                                                                                                               |
| `supabase/functions/`  | Deno edge functions; `_shared/` services (`databaseService`, `emailService`, `pdfService`, `uploadService`, `statusMachine`, `workflowOrchestrator`, `auth`, `propertyScope`, `orgAuth`) |
| `supabase/config.toml` | Local Supabase config + per-function JWT policy                                                                                                                                          |
| `scripts/`             | Dev/deploy/data-sync — `scripts/README.md`                                                                                                                                               |
| `docs/`                | Doc index at `docs/README.md`                                                                                                                                                            |

### Frontend feature layout

```
shared (components/, hooks/, lib/, utils/, layouts/)
  → features/guest/{module}/ | features/dashboard/{module}/
    → routes/ (thin composition)

features/{guest|dashboard}/{module}/
├── components/  ├── hooks/  ├── lib/  ├── pages/  └── routes/
```

Path alias `@/` → `ui/src/`. No barrel `index.ts` re-exports across features. Guest modules: `calendar/`, `form/`, `sd-form/`, `pay-parking/`, `marketing/`, `property/`. Dashboard modules: `bookings/`, `org/`, `property/`, `finance/`, `maintenance/`, `pricing/`, `inbox/`, `team/` — `bookings/` is not a junk drawer, new domain UI belongs in its own module. Full map: `docs/archive/reference/project-structure.md`.

### Multi-tenancy

Admin routes: `/org/:orgSlug/property/:propertySlug/...` and `/org/:orgSlug/parking/:parkingSlug/...`. One owner per org (`organizations.owner_id`); invited org admins (`organization_members`) or property members (`property_members`) with JSONB-scoped permissions. Public guest endpoints resolve the property via `?property=<slug>` (`resolvePublicPropertyId`).

### Booking status workflow

Canonical enum (Postgres `TEXT` + `CHECK`, not `ENUM`): `PENDING_REVIEW → PENDING_DOCUMENTS → READY_FOR_CHECKIN → READY_FOR_CHECKOUT → PENDING_SD_REFUND → COMPLETED`, terminal `CANCELLED`, legacy nested `PENDING_GAF`/`PENDING_PARKING_REQUEST`/`PENDING_PET_REQUEST`. Graph + side-effects + calendar color/title map: `_shared/statusMachine.ts` (server), mirrored in `ui/.../bookings/lib/workflow.ts` (client) — **read `.cursor/rules/booking-workflow.mdc` first**, it's the canonical spec with invariants that must not break.

All transitions go through `_shared/workflowOrchestrator.ts#transition()` — never duplicate side-effect logic in a caller.

### Auth — don't conflate these tiers

| Tier                | Gate                                                           | Notes                                                                                                                                          |
| ------------------- | -------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Guest anon          | none                                                           | public endpoints, anon key                                                                                                                     |
| Guest authenticated | Supabase Auth (separate identity)                              | guest portal (profile/trips/chat) only, not admin                                                                                              |
| Legacy admin        | `ADMIN_ALLOWED_EMAILS` + `_shared/auth.ts#verifyAdminJwt(req)` | server-side only, first line of every admin function — the real boundary despite `verify_jwt=false` (Kong's HS256 check rejects modern tokens) |
| Org                 | `orgAuth.ts#verifyOrgAccess`                                   | owner / org admin / member                                                                                                                     |
| Property            | `propertyScope.ts#verifyPropertyAccess`                        | built-in roles + custom                                                                                                                        |
| Parking             | `parkingScope.ts#resolveScopedParkingAccess`                   | separate scope from property                                                                                                                   |
| Super-admin         | `SUPER_ADMIN_EMAILS`                                           | gates `/admin/*`                                                                                                                               |

### Edge functions

Prefer `serveAdmin`/`servePublic`/`serveCronPost` (`_shared/serveEdge.ts`) over hand-rolled `serve()`. Deno, pinned remote imports (`esm.sh`, `deno.land`). Email-sending functions need `static_files` in `config.toml` for `_shared/email-templates/**` or production throws `ENOENT`. Scheduled jobs run via hosted `pg_cron` + `pg_net`, not `config.toml` schedule (local CLI mishandles it) — see `docs/archive/operations/scheduled-jobs-and-testing.md`.

### Conventions

- **Dates**: DB guest fields often `MM-DD-YYYY` text; UI/query params `YYYY-MM-DD`. Use `_shared/utils.ts` / `ui/src/utils/dates.ts` normalizers. All user-visible times: `Asia/Manila`.
- **Naming**: `PascalCase.tsx` components/pages, `useX.ts` hooks, `camelCase.ts` lib/schema, `kebab-case/index.ts` edge functions, shadcn stays `kebab-case.tsx`. Named exports only. Full rules: `.cursor/rules/naming-conventions.mdc`.
- **Secrets**: local edge secrets in `supabase/.env.local` (gitignored); never commit or log credentials/tokens/PII.
- **Testing**: Vitest (UI unit, Node env), Deno test (`_shared/*_test.ts`, `functions/tests/*.test.ts`), Playwright mocked E2E (`ui/e2e/features/`). Commands: `bun run test`, `test:edge`, `test:edge:handlers`, `test:e2e:smoke`, `test:e2e:ci`, `bun run ci:quality`. Skill **`testing`**, rule **`.cursor/rules/testing.mdc`**. Playwright MCP is for exploration only, not CI.
- **Mobile**: every screen works at 375/768/1024px+, native bottom sheets/nav on phone — **always-on** `.cursor/rules/mobile-native-ui.mdc` + glob spec `mobile-responsive.mdc`; **invoke `mobile-responsive` skill** on every UI task (Claude Code / OpenCode).
- **Copy**: prefer no extra UI prose (`ui-minimal-copy.mdc` / `minimal-ui-copy`). When text is required, keep it short, plain, and production-grade with no AI tells and no em dashes (`human-copy.mdc` / skill `human-copy`). Claude Code: invoke `human-copy` on string changes.

## Known sharp edges

- `compareFormData` (`_shared/utils.ts`) **omits `petType`** — changing only pet type silently skips the update/revert pipeline.
- Two PDF template copies must be hand-synced: Storage bucket `templates` (workflow generation) vs `ui/public/templates` (admin preview).
- Legacy static email HTML still references a dead `{{urgentBlock}}` placeholder — live sends use per-property templates + `configurable-template-send.html` instead.
- RLS is **not** the access-control layer today — it's edge-function checks (`verifyAdminJwt`/`verifyOrgAccess`/`verifyPropertyAccess`/`resolveScopedParkingAccess`). Don't assume a table is protected just because the query goes through Supabase.

## Plan mode

When planning without implementing (Cursor Plan mode, or the user asks for a plan only), follow `.cursor/rules/plan-mode.mdc`:

- **Do not write code** during planning.
- When the plan is finished, save it to **`docs/workflow/planned/<slug>.md`** (no date prefix) and add a row to `docs/workflow/planned/README.md`.
- If Plan mode blocks file writes, persist the plan as the **first** step after switching to Agent mode.

Superpowers uses the same **`docs/workflow/planned/`** paths as Plan mode — see `.agent/skills/superpowers/SKILL.md`. Never `docs/superpowers/`.

## Docs are the source of truth

Whenever you implement or materially change behavior (features, routes, validation, edge functions, DB schema/migrations, env vars, integrations, or user-visible flows), **update documentation in the same change** — not as a follow-up the user must request. This is not optional; it mirrors `.cursor/rules/documentation-maintenance.mdc`, Cursor's always-on (`alwaysApply: true`) version of this same rule — Claude Code can't auto-load `.mdc` files, so this section is the equivalent always-loaded copy and must be kept in sync with that file whenever it changes.

**Before claiming any material task done (Claude Code — non-negotiable):**

1. Invoke / follow the **`documentation-maintenance`** skill (write checklist).
2. If any page, section, or route UX changed → also invoke **`route-guides`** (no exceptions).
3. If any UI in `ui/src/**` changed → invoke **`mobile-responsive`** skill (native mobile gate: bottom sheets, bottom nav, density).
4. If the change mutates org / property / parking state (edge write, workflow transition, cron, webhook, direct-write surface, or a guest/public action worth recording) → invoke **`audit-logging`**: emit an `activity_log` event or write `activity-log: N/A — <why>`.
5. Confirm the matching files below were updated, or explicitly note why the change is docs-exempt (typo / rename-only).

SessionStart and PostToolUse hooks also inject this reminder — do not ignore them.

| Change                                                                                             | Update                                                                                                                                                                                                                                                                                                                          |
| -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Architecture, routes, env vars, API, data model                                                    | `docs/PROJECT.md`                                                                                                                                                                                                                                                                                                               |
| **Page/section behavior, save flows, validation, per-route UX**                                    | **`docs/guides/routes/*.md`** — invoke the `route-guides` skill for **every** route/page/section change, no exceptions. Mirrors a **second, separate** always-on Cursor rule (`.cursor/rules/route-guides.mdc`) — read it for the full route→file mapping, per-page section checklist, and Host-facing-knowledge writing rules. |
| **UI layout, modals, menus, navigation** in `ui/src/**`                                            | Invoke **`mobile-responsive`** skill; follow **`mobile-native-ui.mdc`** (always-on) + **`mobile-responsive.mdc`**                                                                                                                                                                                                               |
| **Pricing plans / tier catalog / `planPresentation` / entitlements**                               | **`/for-hosts/pricing`** (live via `list-public-pricing-plans` + shared `planPresentation.ts`) **and** **`docs/architecture/plans-feature-matrix.md`** + host Plans route guides (`org/plans.md` — the only in-app Plans page, billing is org-level only; `for-hosts.md`)                                                       |
| **New host feature (Plans and/or Team RBAC)**                                                      | **`plans-and-permissions`** skill + always-on **`.cursor/rules/plans-and-permissions.mdc`** — decide both or mark N/A in the same change                                                                                                                                                                                        |
| **New / changed mutating capability (edge write, transition, cron, webhook, guest/public action)** | **`audit-logging`** skill + always-on **`.cursor/rules/audit-logging.mdc`** — emit an `activity_log` event via `_shared/activityLog.ts`, or mark `activity-log: N/A — <why>`, in the same change                                                                                                                                |
| Booking status/transition/side-effects                                                             | `.cursor/rules/booking-workflow.mdc` (canonical)                                                                                                                                                                                                                                                                                |
| Admin auth, allow list, new admin endpoints                                                        | `.cursor/rules/admin-auth.mdc`                                                                                                                                                                                                                                                                                                  |
| Edge function conventions / JWT policy                                                             | `.cursor/rules/supabase-edge-functions.mdc`                                                                                                                                                                                                                                                                                     |
| Database migration or one-shot backfill instructions                                               | `docs/archive/operations/migration-runbook.md`                                                                                                                                                                                                                                                                                  |
| Backlog / shipped work                                                                             | GitHub Issues + `docs/README.md` (Product backlog section); shipped history in `docs/archive/todos/shipped/`                                                                                                                                                                                                                    |
| Booking-flow redesign decisions                                                                    | `docs/archive/planning/NEW_FLOW_PLAN.md`                                                                                                                                                                                                                                                                                        |

Trivial fixes (typos, internal renames with no behavior/API/UX impact) don't need doc updates — everything else does. Doc index: `docs/README.md`. Full rules/skills index: `.cursor/rules/README.md` · Claude: `.claude/README.md`. Skills: `documentation-maintenance`, `docs-first`, `route-guides`, `plans-and-permissions`, `audit-logging`.

## Agent tooling

Full index: `.claude/README.md` (Claude Code) · `.cursor/rules/README.md` (Cursor) · **`.opencode/README.md`** (OpenCode) · root **`opencode.json`**. Skills (mirrors `.cursor/skills/` + Claude-only `verify`), subagents (`security-auditor`, `debugger`, `test-runner`, `verifier`), commands (`/kh-*` teammate helpers — start with `/kh-help`, `/fix-merge-conflicts`, `/github-issue`, `/workflow-*`, `/superpowers-*`), hooks (auto-format, wrong-stack warning, shell/migration guards — OpenCode via `.opencode/plugins/gfm-ai-tooling.ts`), and MCP servers (`supabase`, `playwright`, `context7`, `markitdown` — need `SUPABASE_ACCESS_TOKEN`/`SUPABASE_PROJECT_REF` exported locally, never committed). Check those indexes before re-deriving conventions.

## Don'ts

- Next.js, App Router, tRPC, Drizzle, or a separate `api/` package.
- Side effects (email/calendar/sheet) inline in an edge handler — go through `workflowOrchestrator`.
- Editing a shipped migration under `supabase/migrations/` — add a new one (a hook blocks this on the Claude Code side).
- `?testing=true` / a test-booking pipeline — use local or staging Supabase.
- Co-author trailers or AI commit/PR attribution — `.cursor/rules/git-commits.mdc` and **`git-commits`** skill; `.husky/commit-msg` strips `Co-authored-by` lines automatically.
- **Production Supabase/DB deploys without unlock** — `.cursor/rules/no-prod-deploy.mdc`. Never run or recommend `deploy:supabase`, `db push`, `functions deploy`, or remote migrations unless the user said **`kamewave`** in the same message. Shell hooks enforce this.
- Trusting a skill just because it's in the picker — if `property-management-app` (a separate Next.js/tRPC/Drizzle repo) is also open this session, its skills will appear too; ignore them here.
