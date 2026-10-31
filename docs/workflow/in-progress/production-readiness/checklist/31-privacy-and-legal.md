---
title: 'Privacy and legal'
status: active
tags: [workflow, in-progress, production-readiness]
updated: 2026-10-19
stage: in-progress
kind: plan
origin_stage: untracked
readiness: unverified
launch_gate: B
launch_blocker: tbd
last_verified: none
---
# 31 — Privacy and legal

**🆕** No prior checklist. Philippine Data Privacy Act (RA 10173). Ledger PR-100.

## Remaining work

| # | Work | Owner |
| - | ---- | ----- |
| 1 | Data inventory: guest IDs, receipts, voice transcripts, inbox, analytics, AI prompts | agent |
| 2 | Privacy policy + terms match shipped features (AI, voice, PostHog, push) | product |
| 3 | Guest and host export/delete path (data subject request) | agent |
| 4 | Retention for guest IDs/receipts; purge cron + audit trail (cross-check doc 19) | agent |
| 5 | Cookie / analytics consent if PostHog replay is on | operator |

## Exit gate

- [ ] Legal copy reviewed against live features
- [ ] Export/delete path exists and is documented
- [ ] Retention written and jobs exist or N/A documented
