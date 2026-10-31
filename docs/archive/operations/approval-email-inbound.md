---
title: 'Approval email inbound (Resend Receiving)'
status: active
tags: [operations, integrations, email]
updated: 2026-08-11
---

# Approval email inbound — Resend Receiving

Production path for Azure **GAF** and **pet** approval PDFs. Replaces the retired **`gmail-listener`** Gmail API poller (CASA-free).

## Architecture

1. Outbound GAF/pet request emails set **`Reply-To:`** to `approvals+{propertySlug}@{RESEND_APPROVAL_INBOUND_DOMAIN}` and **CC** the property ops inbox (`emailReplyTo`).
2. Azure replies (with `APPROVED GAF.pdf` / approved pet PDF) land on the inbound subdomain.
3. Resend fires **`email.received`** → **`approval-email-webhook`** (Svix-signed).
4. Webhook resolves property from plus-address, matches subject dates + sender allow-list (`emailTo`), uploads PDF, calls **`WorkflowOrchestrator.transition`**, dedupes via **`processed_emails`**.

## Edge secrets

| Secret                           | Purpose                                                                                                                       |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `RESEND_API_KEY`                 | Send mail + fetch received attachments (**Full access** required — Sending-only keys return 401 on Receiving Attachments API) |
| `RESEND_INBOUND_WEBHOOK_SECRET`  | Svix signing secret from Resend webhook (`whsec_…`)                                                                           |
| `RESEND_APPROVAL_INBOUND_DOMAIN` | Inbound host, e.g. `inbound.kamehomes.space` or `cyonko.resend.app`                                                           |

## Dashboard / DNS checklist

1. Add **MX** for the inbound subdomain per [Resend Receiving](https://resend.com/docs/dashboard/receiving/introduction).
2. Create webhook for **`email.received`** → `https://<project>.supabase.co/functions/v1/approval-email-webhook`.
3. Copy signing secret → `RESEND_INBOUND_WEBHOOK_SECRET`.
4. Set `RESEND_APPROVAL_INBOUND_DOMAIN` to that inbound host.
5. Send a test GAF request from staging; reply as Azure with the approved PDF; confirm Storage + booking advance.

## Admin recovery

| Situation                                        | Action                                                                  |
| ------------------------------------------------ | ----------------------------------------------------------------------- |
| Approval email never arrived / mistyped Reply-To | Upload PDF + **Mark as Complete** on Pending Documents                  |
| Ambiguous multi-match (same dates, same status)  | Manual mark-complete — webhook skips with `ambiguous_multiple_bookings` |

## Local testing

- Set the three secrets in `supabase/.env.local`.
- POST a signed synthetic payload to `/functions/v1/approval-email-webhook` (Svix headers).

## Related

- Matcher: `supabase/functions/_shared/approvalEmailMatcher.ts`
- Webhook: `supabase/functions/approval-email-webhook/`
- Plan: `docs/workflow/in-progress/remove-google-calendar-sheets.md` Phase 2
