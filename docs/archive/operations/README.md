---
title: 'Operations docs'
status: active
tags: [operations]
updated: 2026-08-02
---

# Operations docs

Runbooks for migrations, deployment, cron jobs, and Meta inbox testing.

| Doc                                                                  | When to use                                                                                        |
| -------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| [migration-runbook.md](./migration-runbook.md)                       | Local Supabase, `db reset`, prod → local data sync                                                 |
| [production-deployment.md](./production-deployment.md)               | Shipping migrations + functions + secrets to prod                                                  |
| [secret-rotation.md](./secret-rotation.md)                           | Rotate Edge / Vercel / vendor secrets without a dual-live gap                                      |
| [approval-email-inbound.md](./approval-email-inbound.md)             | Resend Receiving webhook for GAF/pet approvals (replaces Gmail listener)                           |
| [scheduled-jobs-and-testing.md](./scheduled-jobs-and-testing.md)     | SD refund cron, Telegram crons (Gmail listener retired)                                            |
| [inbox-e2e-runbook.md](./inbox-e2e-runbook.md)                       | Guest Inbox operator E2E (Meta OAuth, webhook)                                                     |
| [meta-app-review.md](./meta-app-review.md)                           | Meta app use cases, OAuth scopes, webhooks, App Review                                             |
| [google-services-approval.md](./google-services-approval.md)         | Current Google stack (Sign-in + Maps only), cleanup, brand verification                            |
| [google-cloud-console-cleanup.md](./google-cloud-console-cleanup.md) | GCP checklist — disable Gmail/Calendar/Sheets before applying                                      |
| [incident-response.md](./incident-response.md)                       | Severity levels, first-response steps, per-scenario runbooks, cron disable/enable before a restore |

Back to [docs index](../README.md).
