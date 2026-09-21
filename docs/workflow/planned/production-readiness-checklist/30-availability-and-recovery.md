---
title: 'Availability and recovery'
status: active
tags: [workflow, planned, production-readiness, availability, backup, incident]
updated: 2026-09-19
stage: planned
kind: plan
---

# 30 — Availability & recovery

## Goal

Known and agreed uptime targets, verified backups, a rehearsed restore, and an incident process that works at 3am when one person is awake.

## Implementation status (2026-09-19 session)

- **Phase 30.4 — `/health` liveness endpoint shipped** (cross-referenced with doc 27, built there since it shares that doc's "cheap unauthenticated probe" concern): `get-health` does a real DB round-trip (`platform_settings` singleton, `head: true`/`count: 'exact'` so no row data returns even indirectly), rate-limited 60/min, `verify_jwt = false`. **Verified on hosted dev** 2026-09-21 (`{"status":"ok","db":"ok"}` via `verify:deployed-preview` + `HEALTH_URL`). Not yet wired to an external uptime monitor (needs an operator to sign up for one and point it here) or a watched alert channel — both still open.
- **Phase 30.5 — incident response runbook written.** New `docs/archive/operations/incident-response.md`: 4 severity levels, first-response steps (assess → communicate → mitigate → fix), and 10 per-scenario runbooks (database down, bad deploy, bad migration, payment/email/AI/Meta provider outages, Storage unavailable, cost runaway, security incident) — each grounded in what actually exists in this repo (rollback scripts, maintenance mode's real 5-path scope per doc 24, the AI plan's existing degrade behavior, doc 25's vendor-risk table) rather than generic incident-response boilerplate. Also documented, accurately: **on-call is undefined** (one collaborator, `@sprmke`, confirmed via `gh api`), **no communication channel exists** (no platform-level Telegram, no status page — only per-property Telegram), and **module kill switches don't exist yet** ([`module-status-management.md`](../module-status-management.md) is itself still `status: planned`). The runbook says this plainly rather than describing a process that doesn't exist — a runbook that overstates readiness is worse than one that's honest about gaps.
- **Phase 30.7 (partial) — cron inventory for the restore procedure.** Enumerated all 17 `serveCronPost` functions (hosted `pg_cron` + `pg_net`) in the runbook's "cron disable/enable" section, with the `UPDATE cron.job SET active = false` bulk-disable command and the reasoning (crons firing immediately post-restore can re-send duplicate guest emails for a "missed window"). **Not done:** a scripted disable-all/enable-all tool (documented as manual SQL for now) and single-tenant recovery (still undocumented and untested, confirmed as a genuine gap, not attempted this session — no per-tenant export/restore tooling exists).
- **Everything else — targets (30.1), the actual restore drill (30.2, still the doc's own "highest priority in this folder"), backup verification automation (30.3), and kill-switch build-out (30.6, blocked on the separate `module-status-management` plan) — not attempted.** All need either hosted-dev access, a product-owner conversation, or a separate feature build, none of which this session had.

## Remaining work to finalize

**Status: partial.** Backup/rollback scripts already existed (not redone). This session shipped a `/health` endpoint and a real incident-response runbook grounded in repo fact rather than boilerplate. Remaining work is agreed targets, the actual rehearsed restore (still the single highest-priority open item in this doc), and kill switches.

| #   | Work                                                                                                                                                                                                                                                          | Blocker             |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------- |
| 1   | Agree and document uptime, RPO, and RTO targets (30.1).                                                                                                                                                                                                       | Product / ops       |
| 2   | Full restore drill on hosted-dev, including Storage; measure RTO vs target (30.2). **Partial:** `hosted-dev-rollback-rehearsal.md` + preflight script (2026-09-21). Highest priority; drill not executed.                                                     | Hosted-dev operator |
| 3   | Backup schedule matches RPO; evaluate PITR vs cost (30.3).                                                                                                                                                                                                    | Hosted + doc 25     |
| 4   | Automated backup integrity verification + failure alerting.                                                                                                                                                                                                   | Hosted + doc 27     |
| 5   | Backups stored outside the primary account/region; encrypted; retention defined.                                                                                                                                                                              | Hosted / offsite    |
| 6   | ~~Health endpoint~~ **shipped** (`get-health`). External uptime monitoring to a watched channel still needs an operator (30.4).                                                                                                                               | Hosted              |
| 7   | ~~Incident runbook with severities, on-call, and communication templates (30.5).~~ **Written** — `incident-response.md`, 10 per-scenario runbooks. On-call/comms sections document the real gap (undefined) rather than inventing a process.                  | Ops (fill gaps)     |
| 8   | Module kill switches — blocked on the separate `module-status-management` plan (still `planned`, not built) (30.6). Single-tenant recovery still undocumented (30.7). Cron disable/enable **documented** in the restore procedure (manual SQL, not scripted). | Code + 2            |

## Prior art — do not redo

| Shipped                                 | Where                                                                                                         |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Automatic pre-deploy backups            | `backup:supabase:dev/:prod`                                                                                   |
| Backup includes roles + managed schemas | `auth`/`storage`/`cron` when `DEV_DB_URL`/`PROD_DB_URL` set (launch audit P1-3)                               |
| Hardened rollback                       | `--fresh-target`, empty-public-tables assertion, typed project-ref confirm, atomic schema+data restore (P0-6) |
| Rollback workflow                       | `.github/workflows/cd-rollback.yml`                                                                           |
| Maintenance mode                        | `platform_settings.maintenanceMode`                                                                           |
| Meta integration healthcheck cron       | `metaInboxHealthcheckCron.ts`                                                                                 |

## The single largest open risk in this entire folder

**Restore has never been rehearsed.** The launch audit states it explicitly: _"Rollback has not been rehearsed against the hosted dev project in this session (Docker was down locally)."_

A backup that has never been restored is not a backup — it is an untested assumption. Everything else in this doc is secondary to Phase 30.2.

## Phases

### Phase 30.1 — Define targets

Agree and write down, with the product owner:

| Metric                  | Definition                                      | Target |
| ----------------------- | ----------------------------------------------- | ------ |
| Uptime                  | Guest booking flow available                    |        |
| Uptime                  | Host dashboard available                        |        |
| **RPO**                 | Maximum acceptable data loss                    |        |
| **RTO**                 | Maximum acceptable time to restore              |        |
| Degraded-mode tolerance | Which features may be down while the core works |        |

Targets drive backup frequency and architecture. A 1-hour RPO and a daily backup are incompatible; pick deliberately.

### Phase 30.2 — Rehearse restore (highest priority in this folder)

Full drill against hosted dev:

1. Take a backup; note its size and duration.
2. Create a fresh target project.
3. Restore schema + data + roles + managed schemas.
4. **Verify**: row counts per table, auth users can sign in, storage objects resolve from DB rows, crons are scheduled, secrets/Vault entries present, the app functions end to end.
5. Measure elapsed time = actual RTO.
6. Document every manual step and every surprise.

Repeat quarterly and after any change to the backup scripts.

**Edge case — the one most likely to bite:** database backups do **not** include Storage objects (doc 20 Phase 20.6). A restored database pointing at missing files is a half-restore. The drill must cover Storage explicitly, and the runbook must state the Storage recovery procedure.

**Edge case:** Supabase manages `auth` and `storage` schemas. Restoring them into a fresh project can conflict with platform-managed state. The backup script already handles roles and managed schemas when DB URLs are set — verify that path is the one exercised.

### Phase 30.3 — Backup verification automation

- Schedule backups appropriate to the RPO (Supabase PITR on a paid tier is the stronger answer than script-based dumps — evaluate the cost against the RPO target).
- Automated integrity check on each backup: file exists, size within expected range, schema objects present.
- Retention policy: how many, how long, where, and confirm they are stored **outside** the same account/region as the primary, or a project-level incident destroys both.
- Alert when a backup fails or is skipped. A silently failing backup job is the classic catastrophe.

### Phase 30.4 — Health checks and uptime monitoring

- A lightweight `/health` edge function returning DB connectivity and version, cheap and unauthenticated (careful not to leak internals).
- External uptime monitoring from outside the stack (a monitor hosted on the same platform cannot tell you that the platform is down), checking: guest landing page, a public API read, and the health endpoint.
- Alert to a channel someone actually watches. Telegram is already integrated.
- Public or internal status page for incident communication.

### Phase 30.5 — Incident response

Write the runbook before the incident:

- Severity levels with example symptoms.
- Who is on call and how they are reached.
- First-response steps: assess, communicate, mitigate (maintenance mode, feature flag, rollback), then fix.
- Communication templates for guests and hosts — a booking system going down affects people mid-travel, and silence is worse than a delay.
- Post-incident review expectations.

Per-scenario runbooks for the failures that are actually likely:

| Scenario                   | Runbook                                   |
| -------------------------- | ----------------------------------------- |
| Database down/unresponsive |                                           |
| Bad deploy                 | Rollback procedure (24.2)                 |
| Bad migration              | Restore procedure (30.2)                  |
| Payment provider outage    | Degrade, queue, communicate               |
| Email provider outage      | Queue, backfill sends                     |
| AI provider outage         | Degrade to non-AI paths                   |
| Meta API outage            | Inbox degraded, rest unaffected           |
| Storage unavailable        | Media broken, booking flow must survive   |
| Cost runaway               | Kill switches per doc 25                  |
| Security incident          | Rotate, revoke, preserve evidence, notify |

### Phase 30.6 — Degradation and kill switches

The app should lose features, not fall over:

- Per-module kill switches — the [`module-status-management.md`](../module-status-management.md) plan (`live`/`coming_soon`/`maintenance` registry with badge/overlay gates) is exactly this mechanism. Use it rather than building another.
- The booking flow must survive AI, Meta, Telegram, and Marketing being down.
- PWA offline support already provides guest-side resilience — verify what actually works offline.

### Phase 30.7 — Data recovery beyond full restore

Full restore is the blunt instrument. Also needed:

- Soft deletes / recoverable deletion for bookings, properties, and orgs so a mistaken delete does not require a full restore.
- Storage versioning/soft-delete on PII buckets (doc 20).
- The `activity_log` as a forensic record of who changed what.
- A documented procedure for restoring a single tenant's data without affecting others — the realistic support request, and much harder than a full restore.

## Edge cases

- **Restoring into a non-empty project** is destructive; the current script already requires `--fresh-target` and empty public tables. Keep that guard.
- **Point-in-time recovery vs dumps** — PITR gives a much better RPO but is a paid tier feature. This is a cost/risk decision for doc 25.
- **Backups containing PII** are themselves sensitive: encrypted at rest, access-controlled, retention-limited (doc 22).
- **Third-party state cannot be rolled back** — sent emails, captured payments, published posts. The runbook must say what is unrecoverable and how to compensate (refund, correction email).
- **Clock/timezone during restore** — crons resume and may immediately fire for missed windows, sending duplicate emails to guests. Disable crons before restore, verify, then re-enable.
- **Single-operator risk** — if one person holds every credential and all the knowledge, that is the real availability risk. Document access and keep a break-glass procedure.
- **Testing restore on prod is not an option**; dev must be representative enough for the drill to mean something.

## Exit gate

- [ ] Uptime, RPO, and RTO targets agreed and documented.
- [ ] Full restore drill completed on hosted dev, including Storage, with measured RTO vs target. **Still the single highest-priority open item in this doc.**
- [ ] Backup schedule matches RPO; PITR evaluated against cost.
- [ ] Automated backup integrity verification + failure alerting.
- [ ] Backups stored outside the primary account/region; encrypted; retention defined.
- [x] Health endpoint shipped (`get-health`). External uptime monitoring alerting to a watched channel not set up — needs an operator.
- [x] Incident runbook with severities, on-call, and communication templates written. On-call and communication-channel sections honestly document that neither exists yet, rather than a process that would be fiction.
- [x] Per-scenario runbooks for all ten scenarios written.
- [ ] Module kill switches usable and tested — blocked on the separate `module-status-management` plan, still unbuilt.
- [ ] Single-tenant recovery procedure documented and tested.
- [x] Cron disable/enable step included in the restore procedure (documented as manual SQL; not yet scripted).

## Docs / Plans / activity-log

- **Docs:** `docs/archive/operations/` (runbooks — mandatory), `docs/architecture/deployment.md`, `docs/architecture/storage.md`, `scripts/README.md`.
- **Plans / Team RBAC:** N/A.
- **activity-log:** invoke `audit-logging` — restores, tenant data recovery, and kill-switch changes should be recorded.
