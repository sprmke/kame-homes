---
name: gmail-listener
description: Resend inbound approval-email-webhook for Azure GAF/pet PDFs (replaces retired Gmail API poller). Use when changing approval intake, processed_emails dedupe, or Reply-To inbound routing.
---

# Approval email intake (was: Gmail listener)

**Production path:** Resend Receiving → **`approval-email-webhook`**.

The Gmail API poller (`gmail-listener`), **`gmail-backfill-approvals`**, and **Connect Google** OAuth UI were **removed**. Do not reintroduce `gmail.readonly` polling or host-facing Gmail OAuth — it triggers Google CASA.

## Canonical docs

- Ops runbook: **`docs/archive/operations/approval-email-inbound.md`**
- Matcher: `supabase/functions/_shared/approvalEmailMatcher.ts`
- Svix verify: `supabase/functions/_shared/resendWebhookVerify.ts`
- Webhook: `supabase/functions/approval-email-webhook/index.ts`
- Rules: `.cursor/rules/booking-workflow.mdc`

## Algorithm (happy path)

1. Verify Svix signature (`RESEND_INBOUND_WEBHOOK_SECRET`).
2. Resolve property from `approvals+{slug}@{RESEND_APPROVAL_INBOUND_DOMAIN}`.
3. Parse subject for GAF/pet + dates; enforce Documents Approver allow-list (`emailTo`).
4. Fetch attachment via Resend Receiving Attachments API; match `APPROVED GAF.pdf` / pet variants.
5. Find booking by property + dates + expected statuses; **skip if ambiguous** (Q6.5).
6. Upload to `approved-gafs` / `approved-pet-forms` via `bookingAssetStorageKey`.
7. `WorkflowOrchestrator.transition(…, PENDING_DOCUMENTS, { approved_*_pdf_url, document_completion_target }, silent flags, manual=false)`.
8. Upsert `processed_emails` with Resend `email_id`.

## Admin recovery

- **Mark as Complete** on Pending Documents (manual PDF upload if needed).

## Don'ts

- Don't call Gmail History API from edge functions for approval intake.
- Don't add Connect Google / `google-mail-oauth-*` for hosts.
- Don't bypass `WorkflowOrchestrator`.
- Don't auto-resolve ambiguous multi-matches.
