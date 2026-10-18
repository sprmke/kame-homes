---
title: 'Third-party failure modes'
status: active
tags: [workflow, in-progress, production-readiness]
updated: 2026-10-19
stage: in-progress
kind: plan
origin_stage: untracked
readiness: unverified
launch_gate: F
launch_blocker: tbd
last_verified: none
---
# 37 — Third-party failure modes

**🆕** Ledger PR-106. Overlaps doc 17.5.

## Remaining work

| # | Work | Owner |
| - | ---- | ----- |
| 1 | Gemini / Groq down → AI surfaces degrade, bookings still work | agent |
| 2 | Resend down → queue or visible failure, no silent drop | agent |
| 3 | PayMongo down → checkout error, no false paid | agent |
| 4 | Meta token expired → inbox banner, not 500 | agent |
| 5 | Maps quota → listing still usable | agent |

## Exit gate

- [ ] One test or manual probe per provider
