---
title: 'Google OAuth verification'
stage: wont-do
status: cancelled
updated: 2026-08-19
---

# PMO approval email intake — avoid Gmail CASA (inbound webhook)

> **Status (2026-08-02):** Pivoted. Full Google OAuth verification + **CASA** for `gmail.readonly` is a **cost blocker**. Dropping Calendar/Sheets does **not** avoid CASA — restricted Gmail alone still requires it for External production apps.  
> **New goal:** keep **PMO / Azure approval PDF automation** without reading Gmail via Google APIs.

## Goal

Replace (or sideline) the **Gmail API listener** (`gmail.readonly` + Connect Google) with an intake path that receives Azure/PMO approval emails **as inbound mail to a Kame-controlled address**, parse PDF attachments, and run the same booking transitions as today’s listener — **without** Google restricted-scope verification or CASA.

Calendar and Sheets sync are **out of scope / optional legacy** for public multi-tenant launch (hosts do not need Connect Google for those).

Maps + Sign in with Google remain separate (no CASA): Maps = API key + billing; Sign-in = brand/identity scopes only.

## Critical fact

| Change                                                                               | Avoids CASA?                                  |
| ------------------------------------------------------------------------------------ | --------------------------------------------- |
| Drop Calendar + Sheets scopes only                                                   | **No** — `gmail.readonly` is still restricted |
| Keep Connect Google for hosts’ Gmail (External)                                      | **No** — CASA required for production         |
| Stop using Gmail API; receive approvals via inbound email / forward                  | **Yes**                                       |
| Single Kame-owned mailbox + OAuth app stuck in Testing (≤100 test users, only staff) | **Yes** (narrow; not for host Connect Google) |
| Manual admin PDF upload only                                                         | **Yes** (no automation)                       |

## Scope

### In

- Choose and implement a **CASA-free** approval intake architecture (recommended: **Resend Receiving** — already used for outbound)
- Edge webhook that: verifies signature → fetches body/attachments → matches booking (reuse listener matching rules) → Storage upload → `WorkflowOrchestrator` / same transitions as `gmail-listener`
- Dedupe via `processed_emails` (or equivalent inbound message id)
- Product/ops: how Azure is addressed (Reply-To / To / forward from property ops Gmail)
- Per-property routing if multi-tenant (`approvals+{propertySlug}@…` or property-specific inbound addresses)
- Docs: ops runbook + update booking-workflow / PROJECT notes that Connect Google is no longer required for approval automation
- Deprecate or hide **Connect Google** for public hosts (or keep only for optional later Calendar/Sheets if CASA ever funded)
- Manual upload path remains the safety net

### Out

- Paying for CASA / full External Gmail OAuth verification (deferred indefinitely)
- Nylas / Unipile “shared verified GCP” (paid escape hatch — only if inbound proves insufficient)
- IMAP / `mail.google.com` (worse restricted scope)
- Requiring hosts to Connect Google for launch
- Calendar / Sheets as launch blockers (may stay as legacy/dev for Azure North only under Testing)

## Recommended approach: inbound email webhook (Resend)

You already send workflow mail via **Resend**. Resend also supports **[Receiving](https://resend.com/docs/dashboard/receiving/introduction)**: MX on a subdomain → webhook `email.received` → API to fetch content + attachments.

```
Azure / PMO replies with APPROVED GAF.pdf
        ↓
  approvals@inbound.yourdomain.com   (or property+slug@…)
        ↓
  Resend Receiving → POST edge function (webhook)
        ↓
  Match booking (subject / dates / thread rules — reuse gmail-listener logic)
        ↓
  Upload PDF → transition PENDING_DOCUMENTS nested steps (same as today)
```

**Why this fits Kame**

- No `gmail.readonly`, no Connect Google for hosts, no CASA
- Push-based (no 5‑min poll), attachments supported
- Aligns with existing Resend account + edge functions
- Manual upload remains fallback if mail misses

**Ops patterns (pick one)**

1. **Preferred — Reply-To / To on GAF request emails**  
   Send Azure mail with Reply-To (or To) = inbound address so replies land on Resend directly. Property ops Gmail still gets a copy via CC if needed.
2. **Forward rule**  
   Keep Azure → property Gmail; Gmail auto-forward matching senders/subjects to inbound address. No API; one-time Gmail settings. Multi-tenant: each host forwards to `approvals+{propertyId}@inbound…`.
3. **Platform-only inbox**  
   All properties share one inbound address; matcher uses subject/dates only (same ambiguity rules as today).

### Alternatives (ranked)

| Option                                                     | Cost                                   | Pros                                                | Cons                                                                                 |
| ---------------------------------------------------------- | -------------------------------------- | --------------------------------------------------- | ------------------------------------------------------------------------------------ |
| **A. Resend / Postmark / Cloudflare Email inbound**        | Free–low (esp. Resend if already paid) | No Google restricted scopes; real-time; your domain | Need MX / forward setup; rewrite listener → webhook                                  |
| **B. Testing-mode Gmail OAuth on Kame-owned mailbox only** | Free                                   | Keep current `gmail-listener` code                  | Only staff test users; **cannot** offer Connect Google to public hosts; 100-user cap |
| **C. Manual PDF upload only**                              | Free                                   | Zero infra                                          | No auto-advance; ops burden                                                          |
| **D. Nylas Shared GCP / similar**                          | Paid subscription                      | Keep Gmail API UX; they hold verified app           | Still money; vendor lock-in                                                          |
| **E. Full Google verification + CASA**                     | ~$500–1k/yr + weeks                    | Hosts connect any Gmail                             | **Blocked by budget**                                                                |

**Do not pursue:** IMAP with `https://mail.google.com/` (also restricted + CASA).

## Approach (implementation)

1. **Lock product decision:** inbound webhook is the production path; Connect Google is not required for PMO approvals.
2. **Spike Resend Receiving** on a subdomain (e.g. `inbound.kamehomes.com`) + local/staging webhook.
3. **Port matching + PDF apply logic** out of `gmail-listener` into a shared module used by inbound webhook (and optionally keep gmail-listener for Azure North Testing-only).
4. **Wire GAF/pet request emails** so Azure replies hit inbound (Reply-To/To/CC strategy documented).
5. **UI:** Integrations card — remove or demote Connect Google; document “approval email address” / forward instructions for hosts if pattern B.
6. **Docs** + deprecate OAuth verification plan phases that assumed CASA.

## Implementation tasks

### Phase 0 — Decision lock

- [x] Confirm CASA / External `gmail.readonly` is out of budget
- [x] Confirm Calendar + Sheets are not launch-critical
- [ ] Choose intake provider: **Resend Receiving** (default) vs Postmark Inbound
- [ ] Choose addressing: Reply-To on Azure mail vs Gmail forward vs shared platform inbox
- [ ] Decide fate of Connect Google UI: hide / “legacy internal only” / remove

### Phase 1 — Spike (1–2 days)

- [ ] Add receiving subdomain MX (or use Resend-managed receiving domain for spike)
- [ ] Create edge function e.g. `approval-email-webhook` (verify Resend signature; handle `email.received`)
- [ ] Fetch attachment PDFs via Resend Received/Attachments API
- [ ] Prove one end-to-end: send sample “approval” mail → booking advances / PDF stored
- [ ] Document limitations (size limits, retries, spam)

### Phase 2 — Parity with gmail-listener

- [ ] Extract shared matcher + apply helpers from `gmail-listener` / `gmail-backfill-approvals` (GAF vs pet, subject rules, ambiguity skip)
- [ ] Persist dedupe (`processed_emails` or inbound `email_id`)
- [ ] Call same orchestrator paths as listener (`approved_*_pdf_url`, nested completion)
- [ ] Property routing from `to` / `received_for` / plus-address
- [ ] Admin “reprocess” / dashboard visibility if useful (optional)
- [ ] Keep manual upload + mark-complete as fallback

### Phase 3 — Outbound email + host ops

- [ ] Update GAF / pet request send path so Azure replies land on inbound (Reply-To and/or dedicated To)
- [ ] If using forward: short host-facing instructions (Settings → Integrations)
- [ ] Ensure ops still see a copy in human inbox (CC property `email_reply_to`) if desired

### Phase 4 — Product cleanup

- [ ] Stop requiring Connect Google for property “ready” / Needs attention chips (or gate only when Calendar/Sheets explicitly needed later)
- [ ] Hide or internal-only Connect Google + gmail-listener cron for unverified Testing mailbox
- [ ] Calendar/Sheets: document as optional/legacy; no public OAuth verification work
- [ ] Maps key restrictions still recommended (unrelated to CASA)

### Phase 5 — Docs

- [ ] Create `docs/archive/operations/approval-email-inbound.md` (setup, MX, webhook secret, forward vs Reply-To, test checklist)
- [ ] Index in `docs/archive/operations/README.md`
- [ ] Update `docs/PROJECT.md`, `.cursor/rules/booking-workflow.mdc` / gmail-listener skill notes as needed (“inbound preferred; Gmail API optional internal”)
- [ ] Update property settings route guide Integrations section
- [ ] Mark this plan’s old CASA phases superseded

## Docs to update

| Doc                                                 | Change                                                                         |
| --------------------------------------------------- | ------------------------------------------------------------------------------ |
| `docs/archive/operations/approval-email-inbound.md` | **Create** — primary ops guide                                                 |
| `docs/archive/operations/README.md`                 | Index row                                                                      |
| `docs/PROJECT.md`                                   | Phase 2g / Gmail listener → inbound path                                       |
| `docs/guides/routes/org/property/settings.md`       | Integrations: approval intake vs Connect Google                                |
| `.cursor/skills/gmail-listener/SKILL.md`            | Point to inbound as production path                                            |
| Privacy Policy                                      | If Connect Google removed, drop Gmail-read claims; disclose inbound processing |

## Open questions

- [ ] Resend plan limits for Receiving + attachment size vs typical Azure PDFs
- [ ] Must Azure keep emailing the property’s human Gmail, or can Reply-To be inbound-only?
- [ ] Multi-tenant: plus-address per property vs one shared inbox
- [ ] Keep `gmail-listener` codepath for internal Azure North Testing forever?

## Related

- Current: `gmail-listener`, `gmailMailOAuthAccess.ts` (`gmail.readonly`), Connect Google UI, `processed_emails`
- Outbound: `emailService.ts` (GAF/pet request To/Reply-To)
- Parallel ops: [`docs/archive/operations/meta-app-review.md`](../../archive/operations/meta-app-review.md)
- Supersedes earlier CASA-oriented phases of this same filename (2026-08-02 original draft)
