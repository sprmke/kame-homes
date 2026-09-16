---
title: 'Availability and recovery'
status: active
tags: [workflow, planned, production-readiness, availability, backup, incident]
updated: 2026-09-16
stage: planned
kind: plan
---

# 30 — Availability & recovery

## Goal

Known and agreed uptime targets, verified backups, a rehearsed restore, and an incident process that works at 3am when one person is awake.

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
- [ ] Full restore drill completed on hosted dev, including Storage, with measured RTO vs target.
- [ ] Backup schedule matches RPO; PITR evaluated against cost.
- [ ] Automated backup integrity verification + failure alerting.
- [ ] Backups stored outside the primary account/region; encrypted; retention defined.
- [ ] Health endpoint + external uptime monitoring alerting to a watched channel.
- [ ] Incident runbook with severities, on-call, and communication templates.
- [ ] Per-scenario runbooks for all ten scenarios.
- [ ] Module kill switches usable and tested.
- [ ] Single-tenant recovery procedure documented and tested.
- [ ] Cron disable/enable step included in the restore procedure.

## Docs / Plans / activity-log

- **Docs:** `docs/archive/operations/` (runbooks — mandatory), `docs/architecture/deployment.md`, `docs/architecture/storage.md`, `scripts/README.md`.
- **Plans / Team RBAC:** N/A.
- **activity-log:** invoke `audit-logging` — restores, tenant data recovery, and kill-switch changes should be recorded.
