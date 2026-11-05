---
title: 'Super Admin: Operations reports (operator guide)'
status: active
tags: [guides, routes, admin, observability]
updated: 2026-11-05
---

# Super Admin: Operations reports

Routes:

- `/admin/ops-reports`: report list, generate-now
- `/admin/ops-reports/:reportId`: one report, copy/download, send email

Sidebar: **Platform → Operations reports** (FileText icon). Page titles: `Operations reports`
and `Operations report`.

## Behavior

### List

- Shows the 20 most recent reports, newest first.
- Each row shows the period, overall status, critical/high/medium counts, generated time,
  and email state.
- **Generate now** creates or updates the current Manila week report. Repeated clicks
  update one row; they do not duplicate.
- Empty state: **No reports yet**. Generate one from the header.

### Detail

- Summary cards for critical, high, medium, and low counts.
- Source table shows Supabase health, weekly metrics, and Sentry with `ok`, `skipped`, or
  `error`. A skipped Sentry source means the token or project slugs are not configured.
- Findings are grouped by severity. Each shows the stable id, source, category, evidence,
  suggested action, and links.
- **Copy agent prompt** copies the ordered work queue with constraints.
- **Download .md** saves the full Markdown report.
- **Send email** sends once. After delivery the button becomes **Resend email**.
- The full Markdown is available in a collapsed section at the bottom.

## Save and delivery flow

- Generate and send are explicit mutations. There is no editable form and no unsaved-
  changes prompt.
- Generate upserts on environment + period, so a retry is idempotent.
- Email sends once per report. Resend is only from the detail page and is deliberate.
- Missing `RESEND_FROM_EMAIL` or recipients writes an `email_error` on the report and
  shows a toast. The report itself is still saved.

## API

- `GET /functions/v1/ops-report?limit=20`: list rows.
- `GET /functions/v1/ops-report?id=<uuid>`: one report, including `summary` and `markdown`.
- `GET /functions/v1/ops-report?id=<uuid>&format=markdown`: Markdown download.
- `POST /functions/v1/ops-report` `{ action: 'generate' }`.
- `POST /functions/v1/ops-report` `{ action: 'send', reportId, force? }`.
- `POST /functions/v1/ops-report-cron` with `x-ops-report-cron-secret`: weekly job.

All admin calls are super-admin only (`serveSuperAdmin`). The cron call requires
`OPS_REPORT_CRON_SECRET` and fails closed in production.

## Permissions

| Action                        | Gate                     |
| ----------------------------- | ------------------------ |
| View list / detail / Markdown | Super admin              |
| Generate now                  | Super admin              |
| Send / resend email           | Super admin              |
| Weekly cron                   | `OPS_REPORT_CRON_SECRET` |

Plans and team permissions: N/A. This is a platform-only console, not a host feature.

## Edge cases

- **No Sentry configuration:** source is `skipped`, no finding. The report still works.
- **Sentry outage:** source is `error` and a medium finding links to the outage.
- **No recipients / missing From:** report saves, `email_error` is recorded.
- **Repeated generate:** same row updated; `email_sent_at` is preserved.
- **Report not found / bad id:** `Report not found` or a 400 for a non-UUID.
- **Mobile:** cards stack, actions wrap, no horizontal scroll. No modals are used.
- **Email link:** uses `PUBLIC_GUEST_APP_ORIGIN` as the app base. If unset, the email
  omits the link and the report is still available in the console.

## Implementation map

| Concern                    | Path                                                                            |
| -------------------------- | ------------------------------------------------------------------------------- |
| List page                  | `ui/src/features/dashboard/super-admin/pages/SuperAdminOpsReportsPage.tsx`      |
| Detail page                | `ui/src/features/dashboard/super-admin/pages/SuperAdminOpsReportDetailPage.tsx` |
| Hooks                      | `ui/src/features/dashboard/super-admin/hooks/useOpsReports.ts`                  |
| UI types                   | `ui/src/features/dashboard/super-admin/lib/opsReports.ts`                       |
| Routes                     | `ui/src/features/dashboard/super-admin/routes/index.tsx`                        |
| Nav                        | `ui/src/features/dashboard/super-admin/lib/superAdminPlatformNav.ts`            |
| Report builder             | `supabase/functions/_shared/opsReport.ts`                                       |
| Sentry source              | `supabase/functions/_shared/opsReportSentry.ts`                                 |
| Orchestration              | `supabase/functions/_shared/opsReportRunner.ts`                                 |
| Admin function             | `supabase/functions/ops-report/index.ts`                                        |
| Cron function              | `supabase/functions/ops-report-cron/index.ts`                                   |
| Table + metrics RPC + cron | `supabase/migrations/20261318190000_ops_reports.sql`                            |
| Tests                      | `supabase/functions/_shared/opsReport_test.ts`, `opsReportSentry_test.ts`       |

## Testing

| Layer       | Coverage                                                                                                                     |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Unit (Deno) | severity mapping, counts, stable ids, changes, Markdown sections, email escaping, period boundaries, Sentry skip/error/parse |
| Handler     | `ops-report` auth and actions are exercised by the edge handler suite                                                        |
| Manual      | Generate, download, copy, send against hosted dev with a real Sentry token                                                   |

## Host-facing knowledge

Operations reports are super-admin only. Hosts never see them.

**Common operator questions**

- Q: Why is a finding high instead of critical?
  A: Critical is reserved for security errors. Operational errors and Sentry errors are
  high. Warnings are medium. Unknown checks are low.
- Q: Why does the report say Sentry was skipped?
  A: `SENTRY_AUTH_TOKEN`, `SENTRY_ORG_SLUG`, or `SENTRY_PROJECT_SLUG` is missing in the
  edge environment. The rest of the report still runs.
- Q: Can I send the same report twice?
  A: Only explicitly, with **Resend email** on the detail page. The weekly cron sends once.
- Q: Does the report contain guest data?
  A: No. It contains counts, health checks, and Sentry issue titles only.
