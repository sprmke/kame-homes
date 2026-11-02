---
title: 'Business-logic integrity'
status: active
tags: [workflow, in-progress, production-readiness]
updated: 2026-11-02
stage: in-progress
kind: plan
origin_stage: untracked
readiness: unverified
launch_gate: C
launch_blocker: tbd
last_verified: none
---

# 35 — Business-logic integrity

**🆕** Ledger PR-104. Overlaps docs 19, 21, parking, vouchers.

## Remaining work

| #   | Work                                                    | Owner |
| --- | ------------------------------------------------------- | ----- |
| 1   | Double-booking race (app today; DB exclusion is PR-032) | agent |
| 2   | Voucher double-claim                                    | agent |
| 3   | AI credit wallet race                                   | agent |
| 4   | Payment amount tampering (client vs server price)       | agent |
| 5   | Workflow transitions out of order                       | agent |
| 6   | Asia/Manila midnight + `MM-DD-YYYY` vs `YYYY-MM-DD`     | agent |

## Exit gate

- [ ] Concurrent tests or documented residual for each row
