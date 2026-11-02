---
title: 'Readiness status — 2026-11-02'
status: active
stage: in-progress
kind: reference
readiness: partial
launch_gate: 'A–G'
launch_blocker: true
last_verified: '2224ef7c 2026-11-02'
---

# Readiness status — 2026-11-02

One page answering "what is done, what is in progress, what is pending". Detail lives in the
[`LEDGER.md`](./LEDGER.md) (one row per item), the phase plan
([`production-readiness-launch-audit.md`](./production-readiness-launch-audit.md)) and `evidence/`.

**Snapshot:** `develop` `e8e7a7f3` · **hosted `fworvijbrwpyngycotbz` is production** (since
2026-10-27; `kamespace.com` and `dev.kamehomes.space` share it, so hosted writes need
`kamewave`) · CI green · `CD Dev` green end-to-end ·
`ci:quality` green · `@ci` E2E 301 passed / 9 skipped (marketing studio, PR-133) / 0 failed.

## Phase scoreboard

| Phase                | Done                                                                                                                                       | In progress                                                                    | Pending (agent)                                                                                           | Pending (operator / product)                                               |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| 0 Baseline           | ✅ CI + CD green, dev deployed, probes pass                                                                                                | —                                                                              | —                                                                                                         | GitHub `development` secrets (PR-025)                                      |
| 1 Consolidation      | ✅ one folder, links checked                                                                                                               | —                                                                              | —                                                                                                         | —                                                                          |
| 2 Ledger             | ✅ seeded, deduped, now 145 rows                                                                                                           | keep rows current                                                              | —                                                                                                         | —                                                                          |
| 3 Gap analysis       | ✅ 57 module cards, route/edge maps, checklists 31–38                                                                                      | module cards still have unchecked criteria (Phase 7 fills them)                | fill cards from evidence                                                                                  | —                                                                          |
| 4 Environments       | ✅ env matrix, operator key list                                                                                                           | —                                                                              | seed matrix for tiers/roles (4.2), test-accounts doc (4.3)                                                | sandbox keys (PayMongo, Meta, Gemini paid, Maps)                           |
| 5 Automated sweep    | ✅ quality gate, edge, static guards, plan catalog, RLS, clean `db:reset`, hosted-dev probes, AI evals, `@smoke`, `@ci`, **axe 35 routes** | —                                                                              | `test:e2e:plans` + full non-`@ci` suite; Lighthouse 3× median (5.10); coverage backlog (PR-135)           | `DEV_DB_URL` for advisors + pg_stat (PR-025)                               |
| 6 OWASP / security   | ✅ A01 IDOR, RBAC, uploads, guest tokens, rate limits, CORS, storage, **gitleaks, semgrep, OSV, ZAP**                                      | API Top 10 and ASVS rows being filled from today's runs                        | BOPLA/mass-assignment probe, SSRF sweep, ASVS rows, manual pentest §6.2, LLM adversarial suite (PR-013)   | CSP enforce decision (PR-012), Turnstile/Auth captcha on prod (PR-001/002) |
| 7 Module QA          | ✅ bookings lifecycle, guest form submit, RBAC matrix, notifications/reviews/marketing smoke via E2E; a11y on all baseline routes          | property + org dashboard a11y now covered; **module cards still to be filled** | role × tier walkthroughs, parking money path, cross-browser/device, UX quality bar                        | parking/paymongo sandbox                                                   |
| 8 Non-functional     | ✅ ZAP (security headers), SEO robots/sitemap checks, email DNS checks, clean replay, bundle budget tracked                                | perf: entry chunk 151 KiB gzip, listing latency halved                         | Lighthouse medians, load test re-run, cron heartbeat/overlap, privacy export/delete, a11y manual keyboard | restore drill (PR-024), alerts + on-call (PR-027), Maps lock (PR-084)      |
| 9 Operator / cutover | ✅ operator list, prod env matrix (`readiness-env-matrix --check` clean)                                                                   | cutover dry run notes                                                          | finish dry run write-up                                                                                   | mt-prod project, DNS/SMTP/Meta/Google approvals, `kamewave`                |
| 10 Final report      | ✅ issues for agent rows; `ALL-GOOD`/`TO-FIX` drafts                                                                                       | this status page + re-tags                                                     | final ALL-GOOD/TO-FIX grouping after the remaining fixes                                                  | go/no-go                                                                   |

## Gate scoreboard

| Gate                    | Verdict         | Why not green yet                                                                              |
| ----------------------- | --------------- | ---------------------------------------------------------------------------------------------- |
| A Core booking + public | 🟡 close        | Lighthouse medians + load re-run; Maps key on dev (PR-116); bundle budget 4.9/4.2 MiB (PR-134) |
| B Security              | 🟡 close        | CSP enforce decision (PR-012); prod captcha (PR-001/002); BOPLA/SSRF/pentest rows              |
| C Money                 | 🔴 blocked      | PayMongo sandbox keys (PR-030); refund + double-booking decisions (PR-031/032)                 |
| D AI / voice            | 🟡 partial      | AI evals pass every gate; paid key + platform ceiling (PR-003/006); LLM adversarial suite      |
| E Comms                 | 🟡 partial      | DMARC record missing (PR-073); Meta live on dev (PR-072); push QA on device (PR-074)           |
| F Operations            | 🔴 blocked      | Restore drill + `DEV_DB_URL` (PR-024/025); alerts + on-call (PR-027); cron heartbeat           |
| G Cutover               | ⛔ out of scope | mt-prod does not exist; needs a `kamewave` release window                                      |

## What changed in this pass (2026-11-02)

1. **Phase 6 tooling executed for the first time** — gitleaks (2877 commits, 0 real secrets, allowlist committed), semgrep (2 findings, both sanitized), OSV + `bun audit` triaged, **ZAP baseline on dev (0 fail / 11 warn / 57 pass)**. Anti-clickjacking fixed with `X-Frame-Options: SAMEORIGIN` (+ guard).
2. **Accessibility gate now automated and green** — new axe sweep over 35 routes in `@ci`; fixed brand-text contrast (derived `--brand-ink`), muted ink, every white-on-brand fill, theme preview AA, target sizes, table-row semantics, unnamed controls, skeleton ARIA, reduced-motion.
3. **Shopping list made explicit** — new ledger rows PR-140…PR-145 (see below).

## Production audit (2026-11-02)

`fwor…` is production and the live site runs from `main`. First live audit found: robots.txt blocking
all crawling (fixed in code on `main`), sitemap pointing at the preview host (fixed via the production
`PUBLIC_GUEST_APP_ORIGIN` secret), missing anti-clickjacking header (fixed in code), and **production
UI stale relative to `main`** because the Vercel project builds `main` as Preview only (operator).
Detail: [`evidence/production-audit-2026-11-02.md`](./evidence/production-audit-2026-11-02.md).

## Next actions, in order

| #   | Action                                                                                                                                                          | Owner              |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------ |
| 1   | Merge the a11y PR (#210) and re-run ZAP on dev to confirm the clickjacking warning clears                                                                       | agent              |
| 2   | Set GitHub `development` secrets (`DEV_DB_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_DB_PASSWORD`, `SMOKE_PROPERTY_SLUG`) → unblocks restore drill, pg_stat, advisors | operator           |
| 3   | Measured restore drill on dev with RTO/RPO numbers                                                                                                              | operator + agent   |
| 4   | BOPLA (mass-assignment) probe + SSRF outbound-fetch sweep; fill API Top 10 + ASVS rows                                                                          | agent              |
| 5   | Lighthouse 3× median on the 9 budget routes; re-run k6 with a large-tenant seed                                                                                 | agent              |
| 6   | Fill module cards from existing evidence (bookings, guest form, RBAC, notifications, reviews, marketing) and walk the remaining modules per role/tier           | agent              |
| 7   | Privacy: guest/host export + delete path (RA 10173) and retention jobs decision                                                                                 | product + agent    |
| 8   | DMARC record (`_dmarc.kamehomes.space`)                                                                                                                         | operator           |
| 9   | PayMongo sandbox keys + parking money path; money gate decisions                                                                                                | operator + product |
| 10  | Cutover rehearsal write-up + go/no-go                                                                                                                           | agent + you        |
