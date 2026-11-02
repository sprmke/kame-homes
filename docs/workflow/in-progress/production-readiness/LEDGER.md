---
title: 'Production readiness ledger'
status: active
tags: [workflow, in-progress, production-readiness]
updated: 2026-11-02
stage: in-progress
kind: reference
---

# Production readiness ledger

One row per distinct item. Sources are listed, not duplicated. Extracted 2026-10-19 from 1,268 raw open boxes/rows across 89 files (`evidence/phase2-open-items-raw.md`). Implementation-step leftovers in `done/` docs are triaged in **F7** below, not copied as 500 fake launch tasks.

**Baseline SHA:** not set (Phase 0.5–0.6). Until then every 🟡 is default.

Tag legend: [`README.md`](./README.md). Gates A–G: same file.

| Col   | Values                                                                                            |
| ----- | ------------------------------------------------------------------------------------------------- |
| Sev   | blocker / high / medium / low                                                                     |
| Owner | agent / operator / product                                                                        |
| Tag   | ✅ verified · 🟡 unverified · 🔴 failing · ⛔ operator · 🧭 decision · ⏸️ deferred · 🆕 untracked |

---

## 2026-11-01 re-verification on `develop` `497c7772`

Evidence: [`evidence/phase5-reverify-2026-11-01.md`](./evidence/phase5-reverify-2026-11-01.md). Flips and new rows from today's pass:

| ID     | Change                                                                                                                                                                                                                                                    | Evidence                                                                    |
| ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| PR-008 | ✅ re-verified: guest-link tokens 401 without/forged, 200 inside grace                                                                                                                                                                                    | `probe-readiness-guest-token-dev.mjs`                                       |
| PR-009 | ✅ re-verified: `GUEST_BOOKING_ACCESS_ENFORCE=true` on hosted dev                                                                                                                                                                                         | same probe                                                                  |
| PR-014 | ✅ re-verified: RBAC matrix + invite abuse on current dev                                                                                                                                                                                                 | `probe-readiness-rbac-dev.mjs`, `probe-readiness-invites-dev.mjs`           |
| PR-016 | ✅ uploads: byte sniffing rejects HTML-as-PNG and PDF-as-PNG on every probed path                                                                                                                                                                         | `probe-readiness-uploads-dev.mjs`                                           |
| PR-069 | ✅ abuse/CORS/storage probes run against hosted dev (CORS probe fixed, #186)                                                                                                                                                                              | `abuse-public-endpoints.sh`, `check-cors-origins.sh`                        |
| PR-076 | ✅ hosted-dev functions are on `develop` again (deployed 2026-11-01); migrations in sync                                                                                                                                                                  | `deploy-supabase-dev.sh --functions-only`, `migrations:status:dev`          |
| PR-130 | ✅ closed: hosted dev and `develop` migration history match                                                                                                                                                                                               | `bun run migrations:status:dev`                                             |
| PR-133 | 🆕 9 marketing-studio `@ci` specs sit `test.fixme` after the 2026-10-30 New post gallery redesign                                                                                                                                                         | `ui/e2e/features/marketing/*`                                               |
| PR-134 | 🆕 Total JS 4932.8 KiB gzip vs the 4200 KiB budget (warn-only); decide budget or trim lazy chunks                                                                                                                                                         | `bun run check:budgets`                                                     |
| PR-135 | 🆕 55 `ui/src/**/lib` modules still have no unit test                                                                                                                                                                                                     | `scripts/dev/lib-unit-test-inventory.mjs`                                   |
| PR-136 | 🆕 Assistant pinned-context "Preview template" action exists but the composer never passes `onPreview`                                                                                                                                                    | `ChatComposer.tsx`, `ChatContextPillSuggestions.tsx`                        |
| PR-025 | 🔴 still open: GitHub `development` secrets missing; DB-level checks on dev (pg_stat_statements, cron.job) cannot run                                                                                                                                     | `env matrix` + `supabase db query --linked` 403                             |
| PR-137 | ✅ fresh `db reset` failed: `supabase/seed.sql` pointed its property/parking fixtures at an organization no migration creates any more (FK violation), so `supabase start`, `db reset` and `Migration Replay` failed for everyone                         | `migration-replay` run `41234319626`; org now seeded in `seed.sql`          |
| PR-138 | ✅ paid plans came up with Free marketing media-library limits on a fresh DB (plan-catalog drift for Starter → Managed); the per-tier backfill is guarded so it never fired                                                                               | `bun run check:plan-catalog`; `…950_marketing_media_library_paid_tiers.sql` |
| PR-139 | 🟡 `Migration Replay` lint step reports `relation "cron.job" does not exist` (local stack has no `pg_cron`) plus two older function lint errors                                                                                                           | `migration-replay` run for #190                                             |
| PR-140 | ✅ Phase 6 tooling ran: gitleaks full history (0 real secrets, allowlist committed), semgrep (2 sanitized FP), OSV + `bun audit` triaged, ZAP baseline on dev (0 fail / 11 warn / 57 pass)                                                                | `evidence/phase6-tooling-2026-11-02.md`                                     |
| PR-141 | 🆕 zod 3.x memory-exhaustion advisory (fix = zod 4 major) + quill 1.3.7 XSS (unused) — plan a dependency upgrade                                                                                                                                          | `bun audit`, OSV                                                            |
| PR-142 | 🆕 Two lockfiles (`bun.lock` + tracked `package-lock.json`) must stay in sync; OSV reports the same trees twice. Decide: generate-only or retire the npm one                                                                                              | OSV per-lockfile report                                                     |
| PR-143 | ✅ Anti-clickjacking: `X-Frame-Options: SAMEORIGIN` added to `vercel.json` + guard (CSP `frame-ancestors` only applies once CSP enforces)                                                                                                                 | ZAP baseline + `check-vercel-headers.sh`                                    |
| PR-144 | 🆕 `.agents/skills/mcp-builder/requirements.txt` pins `python-multipart` 0.0.9 (16 advisories) — vendored tooling, bump or pin a patched version                                                                                                          | OSV                                                                         |
| PR-145 | 🆕 Guest/host data-subject export + delete path and retention jobs are not implemented (RA 10173); needs product + legal decision (financial records have a lawful retention basis)                                                                       | checklist 31                                                                |
| PR-146 | 🟡 `dev.kamehomes.space/sitemap.xml` serves dev URLs; robots blocks crawling, but the sitemap must switch to the production origin at cutover                                                                                                             | checklist 34                                                                |
| PR-147 | 🔴 **Production blocked from search**: `kamespace.com/robots.txt` served `Disallow: /` (host list missed the rebrand, then a stale `SEO_INDEXABLE_HOSTS` replaced the defaults). Fixed on `main` (#215, #216); live once Vercel production is rebuilt     | `evidence/production-audit-2026-11-02.md`                                   |
| PR-148 | ✅ Production sitemap listed `dev.kamehomes.space` URLs — `PUBLIC_GUEST_APP_ORIGIN` on `fwor…` was the dev origin (also affected absolute links in guest email). Set to `https://kamespace.com`; sitemap now production                                   | `curl https://kamespace.com/sitemap.xml`                                    |
| PR-149 | ⛔ **Production UI is stale**: merges to `main` land as Vercel **Preview** deployments and `kamespace.com` keeps an older build (no `--brand-ink`, no `x-frame-options`). Operator: set the project's production branch to `main` or promote a deployment | `gh api …/deployments`                                                      |
| PR-150 | 🟡 Production mobile Lighthouse: A11y 100 everywhere, SEO 63–69 (robots), Perf 59–63 with LCP 6.8–11.7s                                                                                                                                                   | `evidence/lighthouse-medians-2026-11-02.md`                                 |
| PR-151 | ✅ Anti-clickjacking on production (`X-Frame-Options: SAMEORIGIN`, #215) — ships with the next production build                                                                                                                                           | ZAP baseline                                                                |

Fixed in this pass (product): the notifications hub feed never attached its load-more observer (`scrollRoot` was never passed), so the feed could not page past 20 rows. See `InAppNotificationsPanel.tsx`.

## Counts (2026-10-19, pre-baseline)

| Tag | Count | Notes                                                                                   |
| --- | ----- | --------------------------------------------------------------------------------------- |
| ⛔  | 22    | Keys, billing, GitHub env, dashboards                                                   |
| 🧭  | 8     | Product calls still open                                                                |
| 🔴  | 2     | Hosted-dev drift until deploy finishes; GitHub `development` env missing smoke secrets  |
| 🟡  | 74    | Code claimed done, not re-tested on a fresh SHA                                         |
| ⏸️  | 18    | Explicit deferrals with a written reason                                                |
| 🆕  | 12    | Gaps with no prior checklist (privacy, a11y, SEO, business races, …)                    |
| ✅  | 4     | Reconciled this session (branch protection, parking ungate flag, superhost files, P0-7) |

Top blockers for launch: restore drill (PR-024), Turnstile enforce on hosted UI (PR-001), paid AI ceiling (PR-003), PayMongo sandbox E2E (PR-030), guest-token IDOR remaining (PR-008), CSP enforce (PR-012).

---

## Gate A — Core platform / public / performance

| ID     | Item                                                                          | Sev    | Owner    | Tag | Sources                            |
| ------ | ----------------------------------------------------------------------------- | ------ | -------- | --- | ---------------------------------- |
| PR-040 | Lighthouse median on local `vite preview` + CLS ≤ 0.1 on 9 baseline routes    | medium | agent    | 🟡  | checklist/00, 03                   |
| PR-041 | `pg_stat_statements` top-50 committed from hosted-dev (`DEV_DB_URL`)          | high   | operator | ⛔  | 00, 12, 14; GitHub env             |
| PR-042 | Flip `performance-budgets.json` from warn-only after real numbers             | medium | product  | 🧭  | 00                                 |
| PR-043 | Chunk-load error path + mid-session PWA update on two sequential deploys      | medium | agent    | 🟡  | 01, 16                             |
| PR-044 | Remaining ~65 dashboard `<img>` lazy/priority + width/height CI lint          | medium | agent    | 🟡  | 03                                 |
| PR-045 | Self-host Plus Jakarta Sans; load brand fonts per route                       | medium | agent    | 🟡  | 04                                 |
| PR-046 | Playwright degradation when fonts/PostHog blocked                             | low    | agent    | 🟡  | 04                                 |
| PR-047 | Consolidate `date-fns` vs `dayjs`; knip allowlist then CI                     | low    | agent    | ⏸️  | 05 (wide, high-regression)         |
| PR-048 | React Profiler traces for 8 scenarios; `exhaustive-deps` error                | low    | agent    | 🟡  | 06                                 |
| PR-049 | Skeleton classification table + four states on 9 routes                       | medium | agent    | 🟡  | 07                                 |
| PR-050 | High-frequency handler inventory; IME; request-count Playwright               | medium | agent    | 🟡  | 08                                 |
| PR-051 | OCR size gate fixtures; Storage transforms + srcset after paid add-on         | medium | operator | ⛔  | 09, 25                             |
| PR-052 | Large-tenant seed (10k bookings) + keyset pagination remaining lists          | high   | agent    | 🟡  | 10, 19                             |
| PR-053 | Classify remaining ~300 functions cache class; ETag on public; curl -I        | medium | agent    | 🟡  | 11                                 |
| PR-054 | Rank hosted pg_stat; analytics rollup decision; query cache sweep cron        | medium | operator | ⛔  | 12                                 |
| PR-055 | Gzip on a **large** authenticated endpoint; payload budgets                   | medium | agent    | 🟡  | 13                                 |
| PR-056 | `EXPLAIN ANALYZE` top statements; drop unused indexes from live stats         | high   | operator | ⛔  | 14                                 |
| PR-057 | Document pooler mode/limits; remaining `db()` singletons; workflow RPC        | medium | agent    | 🟡  | 15                                 |
| PR-058 | Full asset-class CDN header matrix + Manila latency                           | medium | operator | ⛔  | 16, 25                             |
| PR-059 | Capacity targets + load-test run against hosted-dev + seed                    | high   | product  | 🧭  | 17, 24, 30                         |
| PR-060 | Public listing pages hardening: re-verify search RPCs, cache, SEO on baseline | high   | agent    | 🟡  | audits/public-listing-pages        |
| PR-061 | QA batch #1 Superhost                                                         | medium | agent    | 🟡  | qa/QA-BATCH, for-testing/superhost |
| PR-062 | QA batch #2 Onboarding verification simplify                                  | medium | agent    | 🟡  | QA-BATCH                           |
| PR-063 | QA batch #3 Host verification tiers                                           | medium | agent    | 🟡  | QA-BATCH                           |
| PR-064 | QA batch #6 Org granular team permissions                                     | high   | agent    | 🟡  | QA-BATCH                           |
| PR-065 | Guest trip hub (in-progress) ships behind flag until verified                 | medium | agent    | 🆕  | in-progress/guest-trip-hub         |
| PR-066 | Two-way reviews (just started) not launch-scope unless verified               | medium | product  | ⏸️  | in-progress/two-way-reviews        |
| PR-067 | Marketing themes for-testing QA (Describe a look, Storage thumbs)             | medium | agent    | 🟡  | for-testing/marketing-themes       |

---

## Gate B — Security posture

| ID     | Item                                                                                                            | Sev     | Owner    | Tag | Sources                                                            |
| ------ | --------------------------------------------------------------------------------------------------------------- | ------- | -------- | --- | ------------------------------------------------------------------ |
| PR-001 | Cloudflare Turnstile keys + `CAPTCHA_MODE=enforce` on hosted UI                                                 | blocker | operator | ⛔  | P0-1; captcha audit; operator list                                 |
| PR-002 | Supabase Auth Attack Protection captcha in Dashboard                                                            | high    | operator | ⛔  | P0-2                                                               |
| PR-008 | Guest-link tokens: remaining IDOR on `get-form` / SD / review / voucher without `access=` after grace           | blocker | agent    | ✅  | hardening Phase 2; cost-abuse 2.1; V-5                             |
| PR-009 | `GUEST_BOOKING_ACCESS_ENFORCE=true` already set on hosted-dev; re-verify after deploy                           | high    | agent    | 🟡  | V-5; secrets list 2026-10-19                                       |
| PR-010 | RLS probe as `anon`/`authenticated` on **hosted** Postgres                                                      | high    | operator | ⛔  | 22                                                                 |
| PR-011 | Supabase security advisors (`mcp get_advisors`) on hosted                                                       | high    | operator | ⛔  | 22, 14                                                             |
| PR-012 | CSP enforce-ready (#176: 0 own-origin violations enforced); flip to enforcing + report-uri                      | high    | product  | 🧭  | 16, 22                                                             |
| PR-013 | Prompt-injection adversarial tests (inbox + assistant exist; expand)                                            | high    | agent    | 🟡  | 22; cost-abuse §6.2                                                |
| PR-014 | RBAC parity + invite abuse verified live (#162: org/parking invites left)                                       | high    | agent    | ✅  | 21, 29                                                             |
| PR-015 | Shared-device sign-out: query cache / realtime / PWA Cache Storage                                              | medium  | agent    | 🟡  | 21                                                                 |
| PR-016 | Storage: tenant-scoped paths; MIME sniff remaining upload paths; guest-PII delete propagation                   | high    | agent    | 🟡  | 20                                                                 |
| PR-017 | Signed-URL TTLs per class + issuance log for sensitive                                                          | medium  | agent    | 🟡  | 20                                                                 |
| PR-018 | Input validation unknown-field rejection on every write                                                         | medium  | agent    | 🟡  | 18                                                                 |
| PR-019 | Idempotency on retryable writes; webhook event-id dedupe all providers                                          | high    | agent    | 🟡  | 18                                                                 |
| PR-020 | Timeouts + backoff + circuit breakers on remaining outbound calls                                               | medium  | agent    | 🟡  | 18                                                                 |
| PR-021 | Cost-weighted rate limits (AI/email/Meta/maps/payments)                                                         | medium  | agent    | ⏸️  | 23 → service-cost plan                                             |
| PR-022 | Fail-closed cron secrets: Vault vs Edge parity (P0-6). Edge has 23 `*_CRON_SECRET` names; confirm pg_cron Vault | high    | operator | ⛔  | P0-6; secrets list                                                 |
| PR-023 | In-house pentest §6.2 after V-1                                                                                 | high    | agent    | 🟡  | cost-abuse-verification; V-4                                       |
| PR-068 | QA batch #4 CAPTCHA walk (pass + fail keys)                                                                     | high    | agent    | ⛔  | needs PR-001                                                       |
| PR-069 | Abuse scripts vs hosted-dev (`cost-abuse-verify-dev.sh`)                                                        | high    | agent    | 🟡  | V-2                                                                |
| PR-007 | GitHub branch protection `quality` on `develop` + `main`                                                        | high    | operator | ✅  | `gh api` 2026-10-19: 1 review + codeowners + `quality`. Tick P0-7. |
| PR-070 | `PARKING_INTERIM_UNGATED_FEATURES` removed                                                                      | medium  | agent    | ✅  | `useFeatureGate.ts` comment; parking uses org plan                 |
| PR-071 | Superhost files present (`orgSuperhost.ts`, cron, UI)                                                           | low     | agent    | ✅  | hardening stale note                                               |

---

## Gate C — Money

| ID     | Item                                                                | Sev     | Owner    | Tag | Sources                                                         |
| ------ | ------------------------------------------------------------------- | ------- | -------- | --- | --------------------------------------------------------------- |
| PR-030 | PayMongo sandbox E2E: checkout → webhook → endorsement              | blocker | operator | ⛔  | parking-e2e-production-readiness; paymongo-subscription-billing |
| PR-031 | Admin parking refund/override path                                  | high    | product  | 🧭  | parking readiness (deferred by design until decided)            |
| PR-032 | DB exclusion constraint vs double-booking + concurrency test        | high    | product  | 🧭  | 19                                                              |
| PR-033 | Org PayMongo subscription: live sandbox subscribe/renew/fail/cancel | high    | operator | ⛔  | done/paymongo-subscription-billing leftover QA                  |
| PR-034 | Default plan code for new orgs (`default_plan_code`)                | medium  | product  | ⏸️  | D-4 Unset (free via UI)                                         |
| PR-035 | Parking payout manual-disbursement scale limit                      | medium  | product  | 🧭  | parking open Q2                                                 |
| PR-036 | Webhook replay same event id → no double fulfill                    | high    | agent    | 🟡  | cost-abuse §6.2                                                 |

---

## Gate D — AI / voice

| ID     | Item                                                                            | Sev     | Owner    | Tag | Sources                                         |
| ------ | ------------------------------------------------------------------------------- | ------- | -------- | --- | ----------------------------------------------- |
| PR-003 | GCP billing + hard cap; paid `GEMINI_API_KEY` / `GROQ_API_KEY` per env          | blocker | operator | ⛔  | P0-3; ai-paid-provider plan                     |
| PR-004 | Voice receptionist: paid project terms, staged rollout, dogfood                 | high    | operator | ⛔  | ai-receptionist audit Phase 0/8; D-3 after P0-3 |
| PR-005 | AI LLM hardening manual checklist (assistant, inbox, receipt override, eval:ai) | high    | agent    | 🟡  | audits/ai-llm                                   |
| PR-006 | Platform USD ceiling + voice quota-before-mint on hosted                        | high    | operator | ⛔  | planned/ai-paid-provider                        |
| PR-037 | Drop legacy `voice_receptionist_*` tables after hosted backfill verify          | medium  | agent    | 🟡  | receptionist Phase 2/9                          |
| PR-038 | Dashboard assistant + AI chat mode (in-progress) behind flag until verified     | medium  | agent    | 🆕  | in-progress/ai-chat-mode                        |
| PR-039 | Super-admin AI settings ownership remaining clamps (property/voice)             | medium  | agent    | 🟡  | done/ai-settings-super-admin-ownership          |

---

## Gate E — Comms

| ID     | Item                                                          | Sev    | Owner    | Tag | Sources                   |
| ------ | ------------------------------------------------------------- | ------ | -------- | --- | ------------------------- |
| PR-072 | Inbox / Meta live on hosted-dev (token not expired)           | high   | operator | ⛔  | QA implicit; integrations |
| PR-073 | Email deliverability SPF/DKIM/DMARC + suppressions            | high   | operator | 🆕  | new checklist 32          |
| PR-074 | PWA push: VAPID already on hosted; real-device QA remaining   | medium | agent    | 🟡  | for-testing/pwa; QA #5    |
| PR-075 | QA batch #8 activity log smoke (then prod deploy before done) | medium | agent    | 🟡  | QA-BATCH                  |

---

## Gate F — Operations

| ID     | Item                                                                               | Sev     | Owner    | Tag | Sources                                                                                                                         |
| ------ | ---------------------------------------------------------------------------------- | ------- | -------- | --- | ------------------------------------------------------------------------------------------------------------------------------- |
| PR-024 | Full restore drill on hosted-dev including Storage; measured RTO                   | blocker | operator | ⛔  | 24, 30; pre-prod audit; QA #9                                                                                                   |
| PR-025 | `DEV_DB_URL` + `SMOKE_PROPERTY_SLUG` on GitHub Environment `development`           | high    | operator | 🔴  | 00/12/14/24; `gh api` 2026-10-19: missing. Also missing `SUPABASE_ANON_KEY`, `SUPABASE_DB_PASSWORD` on that env (CD Dev smoke). |
| PR-026 | PostHog prod + nonprod projects; Vercel/Supabase secrets; source maps              | high    | operator | ⛔  | 27, 28; posthog audit. `POSTHOG_API_KEY` **is** set on hosted-dev Edge.                                                         |
| PR-027 | Alerts: channel, named owner, runbook each; fire a deliberate error                | high    | operator | ⛔  | 27                                                                                                                              |
| PR-028 | Super-admin health surface: in-progress module; ship behind flag                   | medium  | agent    | 🆕  | in-progress/super-admin-system-health                                                                                           |
| PR-029 | Error tracking decision: **PostHog for launch**; Sentry stays no-op                | medium  | product  | ✅  | Phase 0 Q3                                                                                                                      |
| PR-076 | Hosted-dev 17 migrations + ~70 functions drift vs `develop`                        | blocker | agent    | 🔴  | Phase 0 snapshot; deploy in flight 2026-10-19 from `3e269a98`                                                                   |
| PR-077 | Help Center sync: `DEV_SUPABASE_SERVICE_ROLE_KEY` set 2026-10-19; confirm next run | medium  | agent    | 🟡  | F3                                                                                                                              |
| PR-078 | Backup offsite + integrity verify + PITR vs cost                                   | medium  | operator | ⛔  | 30                                                                                                                              |
| PR-079 | SAST (CodeQL) + Dependabot triage                                                  | medium  | operator | 🆕  | 26; checklist 38                                                                                                                |
| PR-080 | Release tagging + changelog                                                        | low     | operator | ⏸️  | 26 not launch-blocking                                                                                                          |
| PR-081 | Environment matrix verified vs live projects                                       | medium  | operator | ⛔  | 24                                                                                                                              |
| PR-082 | Uptime / RPO / RTO targets agreed                                                  | high    | product  | 🧭  | 30                                                                                                                              |
| PR-083 | Module kill switches                                                               | medium  | product  | ⏸️  | blocked on planned/module-status-management                                                                                     |
| PR-084 | Maps key HTTP-referrer lock                                                        | high    | operator | ⛔  | P0-4                                                                                                                            |
| PR-085 | Resend / PayMongo / Meta / Supabase spending alerts                                | high    | operator | ⛔  | P0-5                                                                                                                            |
| PR-086 | QA batch #7 Super-admin step-up OTP                                                | medium  | agent    | 🟡  | QA-BATCH                                                                                                                        |
| PR-087 | QA batch #9 pre-prod restore residual                                              | high    | operator | ⛔  | same as PR-024                                                                                                                  |

---

## Gate G — Cutover / operator

| ID     | Item                                                             | Sev     | Owner    | Tag | Sources                                        |
| ------ | ---------------------------------------------------------------- | ------- | -------- | --- | ---------------------------------------------- |
| PR-088 | mt-prod does not exist; `cd-prod.yml` stays gated; no `kamewave` | blocker | operator | ⏸️  | ci-cd-environments; not this session           |
| PR-089 | Legacy → mt-prod migration rehearsal                             | blocker | operator | ⏸️  | archive/operations/legacy-to-mt-prod           |
| PR-090 | Cutover checklist with named owners (depends 17/21/22/23/27/30)  | high    | product  | 🟡  | 24.6                                           |
| PR-091 | Product: guest-token 30d grace (D-1)                             | low     | product  | ✅  | decided 30d                                    |
| PR-092 | Product: in-house pentest first (D-2)                            | low     | product  | ✅  | decided                                        |
| PR-093 | Operator P0-1..P0-6 still open (P0-7 ✅)                         | blocker | operator | ⛔  | operator/cost-abuse-security-pending-from-user |
| PR-094 | V-1 hosted-dev deploy — in progress this session                 | blocker | agent    | 🟡  | this plan 0.5                                  |
| PR-095 | V-2..V-5 after V-1                                               | high    | agent    | 🟡  | operator list                                  |

---

## F7 — `done/` unchecked boxes (triage)

Do **not** copy these into the launch list as-is. Status 2026-10-19:

| Doc                                              | Raw boxes | Verdict                                                                                              |
| ------------------------------------------------ | --------- | ---------------------------------------------------------------------------------------------------- |
| `remove-google-calendar-sheets.md`               | 146       | **Stale** implementation steps. Calendar/Sheets services are gone. Ignore.                           |
| `docs-obsidian-tooling-sync.md`                  | 56        | **Stale** docs-tooling plan. Vault exists. Ignore.                                                   |
| `docs-workflow-vault.md`                         | 26        | **Stale**. Workflow folders exist. Ignore.                                                           |
| `guest-form-configurable-sections.md`            | 49        | **Stale** task steps. Feature shipped. Remaining QA is guest-form E2E (covered).                     |
| `property-calendar-page.md`                      | 28        | **Stale** task steps. Calendar page exists.                                                          |
| `parking-e2e-phase*` "Commit." boxes             | ~20       | **Stale** process boxes.                                                                             |
| `host-verification-tiers.md` "Commit when asked" | 7         | **Stale**.                                                                                           |
| `paymongo-subscription-billing.md`               | 41        | **Mix**: leftover task prose + real sandbox QA → PR-033.                                             |
| `ai-settings-super-admin-ownership.md`           | 47        | **Mix**: most shipped; remaining clamps → PR-039.                                                    |
| `free-tier-manual-booking-workflow.md`           | 25        | **Real QA** of Free-tier skip paths → include in Phase 7 bookings card.                              |
| `review-approval-workflow.md`                    | 11        | **Real QA** remaining. Phase 7.                                                                      |
| `verification-scope-split.md`                    | 10        | **Real QA** remaining. Phase 7.                                                                      |
| `listing-contract-renewal-modal.md`              | 6         | **Real QA** remaining. Phase 7.                                                                      |
| `unit-handoff-phase-a.md`                        | 20        | **Mix**: leftover tasks vs shipped. Confirm in operations card.                                      |
| `super-admin-console-overhaul.md`                | 13        | Remaining 6 modules already planned (`super-admin-console-followups`) → ⏸️ not launch unless listed. |
| `comprehensive-unit-test-coverage.md`            | 19        | Coverage backlog → ⏸️ not a launch blocker; feeds 29.                                                |
| `ai-receptionist-production-readiness.md`        | 16        | Real remaining → Gate D rows.                                                                        |

---

## 🆕 Cross-cutting (checklists 31–38)

| ID     | Checklist                                                         | Gate | Tag |
| ------ | ----------------------------------------------------------------- | ---- | --- |
| PR-100 | 31 Privacy / RA 10173 / export-delete / legal copy                | B    | 🆕  |
| PR-101 | 32 Email deliverability                                           | E    | 🆕  |
| PR-102 | 33 Accessibility WCAG 2.2 AA                                      | A    | 🆕  |
| PR-103 | 34 SEO 100 on marketing; dev robots Disallow (#181)               | A    | ✅  |
| PR-104 | 35 Business-logic races (booking, voucher, wallet, payments, TZ)  | C    | 🆕  |
| PR-105 | 36 Browser matrix: Chromium/WebKit/Firefox walked; device pending | A    | 🟡  |
| PR-106 | 37 Third-party failures: probed all 5; Resend fix #157            | F    | 🟡  |
| PR-107 | 38 Supply chain: lockfile ✅, Actions #153, audit #158            | F    | 🟡  |
| PR-108 | For-hosts hero em dash + tour rail clip                           | A    | 🔴  |
| PR-109 | Public `/properties` empty on hosted-dev (retest after deploy)    | A    | 🟡  |

---

## Evidence index

| Date       | What                                                            | Where                                                                                                            |
| ---------- | --------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| 2026-10-19 | Phase 0 snapshot (CI red causes, hosted drift, branch decision) | [`evidence/phase0-snapshot.md`](./evidence/phase0-snapshot.md)                                                   |
| 2026-10-19 | Raw open-item extract (1,268)                                   | [`evidence/phase2-open-items-raw.md`](./evidence/phase2-open-items-raw.md)                                       |
| 2026-10-19 | Branch protection                                               | `gh api repos/sprmke/kame-homes/branches/{develop,main}/protection`                                              |
| 2026-10-19 | Hosted-dev Edge secret **names** (61)                           | listed in Phase 0 evidence addendum                                                                              |
| 2026-10-19 | GitHub env `development` secrets                                | `DEV_SUPABASE_SERVICE_ROLE_KEY`, `LEGACY_PROD_PROJECT_REF`, `SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_REF` only |
