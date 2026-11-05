# Weekly operations reports

Plan: `docs/workflow/in-progress/weekly-ops-report.md`.
Route guide: `docs/guides/routes/admin/ops-reports.md`.

## Purpose

One weekly report that tells a developer what changed, what broke, what is drifting, and
what to do next across every production dependency. It is readable in the super-admin
console and formatted so an AI agent can take the findings as a work queue.

## Flow

```
pg_cron (Monday 08:00 Manila)
  -> POST ops-report-cron (OPS_REPORT_CRON_SECRET)
       -> generateOpsReport()
            -> get_system_health_snapshot / get_system_health_capacity
            -> collectSystemHealthChecks()            (same checks as /admin/health)
            -> get_ops_weekly_metrics()               (DB-only weekly aggregates)
            -> Sentry issues API                      (optional, skipped when unset)
            -> buildOpsReport()                       (JSON + Markdown)
            -> upsert public.ops_reports              (one row per period)
       -> sendOpsReportEmail()                         (Resend, once per report)
  -> super admin /admin/ops-reports                   (list, detail, generate, send)
```

A manual `Generate now` uses the current Monday-to-Monday week and upserts the same row,
so repeated clicks never duplicate a report.

## Data model

`public.ops_reports` is service-role only (RLS enabled, no policies).

| Column                                             | Meaning                                              |
| -------------------------------------------------- | ---------------------------------------------------- |
| `environment`                                      | `production` or `non-production`                     |
| `period_kind`                                      | `weekly` (completed week) or `manual` (current week) |
| `period_start`, `period_end`                       | Manila week boundaries                               |
| `overall_status`                                   | `ok`, `warn`, `error`, `unknown`                     |
| `counts`                                           | critical/high/medium/low/info counts                 |
| `summary`                                          | structured JSON, `schemaVersion: 1`                  |
| `markdown`                                         | AI-agent-friendly Markdown                           |
| `email_sent_at`, `email_recipients`, `email_error` | delivery state                                       |
| unique                                             | `(environment, period_start, period_end)`            |

`get_ops_weekly_metrics(p_since, p_until)` returns counts and sums only. It never
selects guest names, emails, message bodies, prompt text, or storage paths.

## Sources and failure behaviour

| Source                        | Required configuration                                        | If missing                                            |
| ----------------------------- | ------------------------------------------------------------- | ----------------------------------------------------- |
| Supabase health               | none                                                          | report cannot generate (health snapshot is the spine) |
| Supabase capacity             | none                                                          | capacity metrics omitted                              |
| Weekly DB metrics             | none                                                          | metrics group omitted, source marked error            |
| Sentry                        | `SENTRY_AUTH_TOKEN`, `SENTRY_ORG_SLUG`, `SENTRY_PROJECT_SLUG` | source `skipped`, no finding                          |
| Sentry outage                 | same                                                          | source `error` plus a medium finding                  |
| Resend / payments / Meta / AI | existing health checks                                        | `off` checks are not findings                         |

Every external call has a 10s timeout and its own try/catch. One vendor failure never
blocks the report.

## Report format

Finding IDs are stable and deterministic:

- `health:<check id>` for Supabase health checks.
- `sentry:<issue id>` for Sentry issues.
- `source:sentry` for a Sentry feed outage.

Each finding carries severity, source, category, title, evidence, impact, suggested
action, links, first/last seen, and event count. The Markdown is YAML frontmatter plus
fixed sections: executive summary, sources, findings, metrics, changes, AI agent handoff.

The AI agent handoff block contains the ordered findings and the constraints:

1. Reproduce the evidence.
2. Make the smallest root-cause fix.
3. Add or update a test.
4. Run `bun run ci:quality`.
5. Mention the finding id in the PR.
6. Do not change public API shape, plan entitlements, or RLS unless required.
7. Do not deploy to production from the agent session.

## Delivery

- `ops-report-cron` is a `serveCronPost` function. It records a `system_job_heartbeats`
  row, so `/admin/health` watches it like every other job.
- The pg_cron job is created only when Vault has `ops_report_cron_secret`. Without it,
  the job is not scheduled and the super-admin page still generates on demand.
- Recipients come from `OPS_REPORT_RECIPIENTS`, falling back to `SUPER_ADMIN_EMAILS`.
  Missing recipients or `RESEND_FROM_EMAIL` records an `email_error` on the report and
  returns a clear reason; it does not throw.
- One email per report. Resending is explicit and only from the detail page.
- The email is a compact HTML summary with the top findings and a link to the detail
  page. No attachments.

## Security and privacy

- All endpoints are super admin only, except the cron endpoint which requires its own
  secret and fails closed in production.
- The report never includes secrets, tokens, guest PII, message bodies, or AI prompts.
- Health checks are the same ones already shown at `/admin/health`; tenant items are
  summarized, not enumerated.
- Sentry issue titles and culprits are included because they are the actionable signal.
  Do not paste event payloads into the report.
- Email recipients are validated, deduplicated, and capped at 20.

## Operations

1. Set `OPS_REPORT_RECIPIENTS` (or rely on `SUPER_ADMIN_EMAILS`).
2. Set `SENTRY_AUTH_TOKEN`, `SENTRY_ORG_SLUG`, `SENTRY_PROJECT_SLUG` for error data.
3. Set `OPS_REPORT_CRON_SECRET` as an edge secret and the same value as Vault secret
   `ops_report_cron_secret`.
4. Run `SELECT public.sync_ops_report_cron_job();` after the Vault secret exists.
5. Verify the job appears at `/admin/health` and the first report lands in
   `/admin/ops-reports`.

## Limits

- 25 Sentry issues per report, 100 findings, 12 next actions.
- No PostHog or Vercel data in v1; the source list is designed to add them without
  changing the report shape.
- No automatic fix PRs. The agent prompt is the handoff.
