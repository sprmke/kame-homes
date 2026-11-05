---
title: 'Weekly operations report and remaining capacity follow-ups'
status: in_progress
tags: [observability, ops, super-admin, supabase, sentry, capacity]
updated: 2026-11-06
stage: in-progress
kind: plan
readiness: in-progress
launch_gate: B
---

# Weekly operations report and remaining capacity follow-ups

## Goal

Give developers one weekly report that covers every production dependency, is readable
in the super-admin console, is emailed to the team, and is formatted so an AI agent can
pick up the findings and act on them. Close the remaining capacity items that are safe
to do now, and explicitly defer the ones that need a staging seed or an architectural
decision.

## Password decision

The app does not use password authentication. Hosts sign in with Google OAuth; guests
use email OTP. There is no `signInWithPassword`, `signUp`, or password update call in
the client. `password_min_length = 6` is therefore inert, and leaked-password protection
is harmless defense in depth for any future password flow. No change is required now.
If a password flow is ever added, raise the minimum to 8 and keep HIBP enabled in the
same change.

## Part A: weekly operations report

### Data model

`public.ops_reports` (service-role only, RLS enabled with no policies):

| Column                                             | Notes                                                                           |
| -------------------------------------------------- | ------------------------------------------------------------------------------- |
| `id`                                               | uuid                                                                            |
| `environment`                                      | `production` or `non-production`                                                |
| `period_kind`                                      | `weekly` (completed week) or `manual` (current week to now)                     |
| `period_start`, `period_end`                       | Manila week boundaries, stored as timestamptz                                   |
| `overall_status`                                   | `ok`, `warn`, `error`, `unknown`                                                |
| `counts`                                           | critical/high/medium/low/info counts                                            |
| `summary`                                          | structured JSON, schema version 1                                               |
| `markdown`                                         | AI-agent-friendly Markdown                                                      |
| `generated_by`                                     | `cron` or `manual`                                                              |
| `generated_at`                                     | timestamp                                                                       |
| `email_sent_at`, `email_recipients`, `email_error` | delivery state                                                                  |
| unique                                             | `(environment, period_start, period_end)` so a re-run updates, never duplicates |

`get_ops_weekly_metrics(p_since, p_until)` returns one JSONB with weekly aggregates:
bookings created/completed/cancelled/pending, emails processed/suppressed, parking and
org payments paid/failed, support tickets opened/open, social webhook events, AI
requests/errors/credits, destructive activity rows, rate-limit row count, and failing
cron jobs. No guest PII, no message bodies, no prompt text.

### Sources

| Source                        | Method                                                     | Missing-secret behaviour  |
| ----------------------------- | ---------------------------------------------------------- | ------------------------- |
| Supabase health               | existing `get_system_health_snapshot` + `evaluate*` checks | always available          |
| Supabase capacity             | existing `get_system_health_capacity`                      | always available          |
| Weekly activity               | new `get_ops_weekly_metrics` RPC                           | always available          |
| Sentry                        | REST issues API (`is:unresolved`, 7 days, top 25)          | source marked `skipped`   |
| Resend / payments / Meta / AI | existing health checks                                     | `off` when not configured |

Each source runs inside its own timeout and try/catch. One vendor failure never blocks
the report; it becomes a `source` row with `status: error` and a short detail.

### Report format

Markdown with YAML frontmatter, stable section order, and deterministic finding IDs:

1. Executive summary and severity counts.
2. Source status table.
3. Findings, each with id, source, severity, title, evidence, impact, suggested action,
   file hints, links, first/last seen.
4. Metrics tables.
5. Changes since the previous report (resolved, new).
6. AI agent handoff block with the ordered task list and constraints.

The same data is stored as `summary` JSON (`schemaVersion: 1`) for the UI and for
machine consumption. The Markdown is downloadable and copyable from the detail page.

### Delivery

- `ops-report` edge function (super admin): list, detail, Markdown download, generate,
  send email.
- `ops-report-cron` edge function (cron secret): generate the completed week and send
  once. `serveCronPost` records the heartbeat.
- Weekly pg_cron job Monday 08:00 Manila, scheduled only when the Vault secret exists.
- Recipients: `OPS_REPORT_RECIPIENTS`, falling back to `SUPER_ADMIN_EMAILS`.
- Email: compact HTML summary, top findings, and a link to the super-admin detail page.
  No attachments; the full report lives in the app to avoid encoding and size issues.
- Idempotent: one report per period, one email per report unless an operator explicitly
  resends.

### Super-admin UI

- `/admin/ops-reports` list: period, overall status, severity counts, generated at,
  email state, generate-now action.
- `/admin/ops-reports/:reportId` detail: summary cards, source table, findings grouped
  by severity, metrics, changes, Markdown panel with copy and download, send email.
- Add to Platform navigation and the overview quick links.
- Follow `SuperAdminPage`, `settings-action`, mobile-native rules, and the existing
  skeleton boundaries.

### Alerts

The weekly report is the deterministic reminder. A daily cron evaluates the same
findings and emails only when a `critical` finding appears or a scheduled job crosses
its failure threshold, deduped per finding per day. This avoids a new external collector
while still paging a human for the urgent cases. A future Slack/PagerDuty sink can reuse
the same finding payload.

## Part B: remaining capacity items

| Item                                 | Decision                                                                                                                                                                      |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Large-tenant seed                    | Add a local-only SQL seed (10k bookings, 50k finance rows, 20k messages) with a wrapper that refuses non-localhost. Use it for query plans and the load matrix; never hosted. |
| Public Vercel cache                  | Defer. Needs a same-origin proxy plus invalidation from property, pricing, media, review, and publish writes. Current browser `max-age=60` is safe but not CDN-level.         |
| Dashboard and finance SQL aggregates | Defer. Correctness-sensitive and needs the large-tenant seed plus parity tests. The 45s dashboard cache bounds the current blast radius.                                      |
| Booking transition RPC               | Defer. Needs a concurrency test and a single-writer design across workflow fields and status. Separate change.                                                                |
| Continuous Prometheus collector      | Defer the external collector. The daily alert cron covers urgent thresholds; a Grafana/PagerDuty sink can consume the same findings later.                                    |
| Auth connection allocation           | Operator action: after compute is settled, set Auth connections to percentage-based in the Dashboard.                                                                         |
| Product retention windows            | Needs an owner decision; not changed here.                                                                                                                                    |

## Progress (2026-11-05)

Shipped in the same change:

- `ops_reports` table, `get_ops_weekly_metrics` RPC, and `sync_ops_report_cron_job`.
- `_shared/opsReport.ts` (builder, Markdown, email HTML), `opsReportSentry.ts`,
  `_shared/opsReportRunner.ts`, and the shared `systemHealth/collect.ts` used by both
  `/admin/health` and the report.
- `ops-report` (list, detail, Markdown, generate, send) and `ops-report-cron`.
- `/admin/ops-reports` list and detail, nav entry, routes, TanStack Query hooks.
- 13 Deno tests for severity mapping, counts, stable ids, changes, Markdown, email
  escaping, period boundaries, and Sentry skip/error/parse.
- Local-only large-tenant seed: 10k bookings, 50k finance rows, 20k messages
  (`perf:seed-large-tenant`, rolls back by default).

Still open:

- Continuous Prometheus collector and a Slack/PagerDuty sink. The weekly email is the
  current reminder; a daily critical-only alert can reuse the same findings next.
- Run the load matrix against the hosted seed and record the first failing component.
- Public Vercel cache, dashboard/finance SQL aggregates, and the booking transition RPC.
- PostHog and Vercel source adapters (the source list is ready for them).

## Acceptance

- Report generates from a clean local stack with every source either populated or
  explicitly `skipped`; no crash when Sentry tokens are absent.
- Markdown and JSON contain the same finding IDs and severity counts.
- Re-running the same period updates one row and does not duplicate findings.
- Email sends once; resend is explicit.
- Super-admin list and detail work at 375, 768, and 1024px.
- No secret, prompt, guest PII, or message body appears in the report, logs, or email.
- Existing `/admin/health`, booking, and guest flows are unchanged.
