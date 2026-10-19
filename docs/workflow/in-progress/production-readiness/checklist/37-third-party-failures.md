---
title: 'Third-party failure modes'
status: active
tags: [workflow, in-progress, production-readiness]
updated: 2026-10-19
stage: in-progress
kind: plan
origin_stage: untracked
readiness: partial
launch_gate: F
launch_blocker: tbd
last_verified: 2026-10-19
---

# 37 — Third-party failure modes

**🆕** Ledger PR-106. Overlaps doc 17.5.

## Remaining work

| #   | Work                                                          | Owner |
| --- | ------------------------------------------------------------- | ----- |
| 1   | Gemini / Groq down → AI surfaces degrade, bookings still work | agent |
| 2   | Resend down → queue or visible failure, no silent drop        | agent |
| 3   | PayMongo down → checkout error, no false paid                 | agent |
| 4   | Meta token expired → inbox banner, not 500                    | agent |
| 5   | Maps quota → listing still usable                             | agent |

## Exit gate

- [x] One test or manual probe per provider: [`phase8-third-party-failures`](../evidence/phase8-third-party-failures-2026-10-19.md). Resend silent drop fixed in [#157](https://github.com/sprmke/kame-homes/pull/157) (merge pending); PayMongo sandbox still needs keys (PR-030)
