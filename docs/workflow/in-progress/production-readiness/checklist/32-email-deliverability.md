---
title: 'Email deliverability'
status: active
tags: [workflow, in-progress, production-readiness]
updated: 2026-10-19
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

| # | Work | Owner |
| - | ---- | ----- |
| 1 | SPF / DKIM / DMARC on sending domains | operator |
| 2 | Bounce/complaint → `email_suppressions` | agent |
| 3 | Template rendering spot-check (Gmail, Apple Mail, Outlook) | agent |
| 4 | `static_files` in `config.toml` for every email-sending function | agent |

## Exit gate

- [ ] DNS records verified on hosted sending domain
- [ ] Suppression table used on bounce
- [ ] CI or audit lists email functions with static_files
