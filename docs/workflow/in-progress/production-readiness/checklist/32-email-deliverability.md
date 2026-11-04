---
title: 'Email deliverability'
status: active
tags: [workflow, in-progress, production-readiness]
updated: 2026-11-04
stage: in-progress
kind: plan
origin_stage: untracked
readiness: unverified
launch_gate: E
launch_blocker: tbd
last_verified: none
---

# 32 — Email deliverability

**🆕** Ledger PR-101 / PR-073.

## Remaining work

| #   | Work                                                             | Owner    |
| --- | ---------------------------------------------------------------- | -------- |
| 1   | SPF / DKIM / DMARC on sending domains                            | operator |
| 2   | Bounce/complaint → `email_suppressions`                          | agent    |
| 3   | Template rendering spot-check (Gmail, Apple Mail, Outlook)       | agent    |
| 4   | `static_files` in `config.toml` for every email-sending function | agent    |

## Exit gate

- [ ] DNS records verified on hosted sending domain — **partial (2026-11-02)**: `send.kamehomes.space` has `v=spf1 include:amazonses.com ~all` and `resend._domainkey.kamehomes.space` publishes a DKIM key; **`_dmarc.kamehomes.space` has no DMARC record** and the apex has no SPF. Operator DNS action (PR-073) before launch.
- [ ] Suppression table used on bounce — `email_suppressions` + `_shared/emailSuppression.ts` exist and are written by the Resend inbound webhook; wire-up on outbound bounce events still to confirm.
- [ ] CI or audit lists email functions with `static_files` — 20 `static_files` blocks exist in `config.toml`; an automated parity check between email-sending functions and `static_files` is still open.

### Notes (2026-11-02)

- `RESEND_FROM_EMAIL=mail@notify.kamespace.com` (verified Resend domain `notify.kamespace.com`, Tokyo; CNAMEs `send.notify` / `rsend.notify`). Inbound approvals stay on `inbound.kamespace.com`.
- Apex/`kamehomes.space` DMARC gaps remain separate from the notify sending subdomain (which has DKIM + SPF CNAMEs verified).
