---
name: integrations
description: Telegram crons, Meta inbox, Resend inbound approvals. Use when connecting webhooks, scheduled jobs, or integration settings UI.
---

# Integrations (GFM)

## GAF/pet approvals (platform)

- Production intake: Resend Receiving → `approval-email-webhook` (see `docs/archive/operations/approval-email-inbound.md`)
- Skill: `gmail-listener` (documents inbound path) | Rules: `booking-workflow.mdc`
- Hosts do **not** connect Google accounts for approvals.

## Telegram (per property)

- Five modules: marketing, staff, admin, finance, maintenance
- Settings UI: `/notifications` (property) — bot token + chat id encrypted in DB
- Crons: `telegram-*-cron` + `docs/archive/operations/scheduled-jobs-and-testing.md`
- Reference: `docs/archive/reference/telegram-marketing-reminders.md`
- Env: `GMAIL_OAUTH_TOKEN_ENCRYPTION_KEY` (legacy name) encrypts Telegram tokens via `propertySecretCrypto.ts`

## Meta Guest Inbox (org)

- Skills: `social-inbox`, `meta-messaging`
- Rule: `social-inbox.mdc`
- Runbook: `docs/archive/operations/inbox-e2e-runbook.md`

## Resend

- Skill: `emails`
- `RESEND_API_KEY` edge secret
- `RESEND_APPROVAL_INBOUND_DOMAIN`, `RESEND_INBOUND_WEBHOOK_SECRET` for inbound approvals

## AI (receipt validation)

- `GEMINI_API_KEYS` / `GROQ_API_KEY` — `docs/archive/reference/ai-payment-receipt-validation.md`

## Google Maps (property location)

- UI: `VITE_GOOGLE_MAPS_API_KEY` — Places + map pin on property settings (not Gmail/Calendar/Sheets)

## Don'ts

- Store refresh tokens in UI env
- Add integration side effects outside `workflowOrchestrator` for booking transitions
- Reintroduce Gmail listener or Connect Google OAuth for hosts
