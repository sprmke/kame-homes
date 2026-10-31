---
title: 'Browser and device matrix'
status: active
tags: [workflow, in-progress, production-readiness]
updated: 2026-10-19
stage: in-progress
kind: plan
origin_stage: untracked
readiness: partial
launch_gate: A
launch_blocker: tbd
last_verified: 2026-10-19
---

# 36 — Browser and device matrix

**🆕** Ledger PR-105.

## Remaining work

| #   | Work                                            | Owner |
| --- | ----------------------------------------------- | ----- |
| 1   | Chrome desktop + Android                        | agent |
| 2   | Safari iOS (booking, PWA, voice, bottom sheets) | agent |
| 3   | Firefox smoke                                   | agent |
| 4   | PWA install on iOS + Android                    | agent |

## Matrix (2026-10-19, hosted dev, `develop` mid-merge)

| Engine                                        | Scope                                   | Result                                                               | Evidence                                                                 |
| --------------------------------------------- | --------------------------------------- | -------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Chromium desktop + phone/tablet emulation     | 54 routes × 375 / 768 / 1280, signed in | Clean (no crash/overflow; bottom nav on phone)                       | [`phase7-hosted-walk`](../evidence/phase7-hosted-walk-2026-10-19.md)     |
| WebKit (Safari engine)                        | 20 public routes × 3 widths             | No layout issues; chunk errors from a mid-walk redeploy (fixed #175) | [`phase7-cross-browser`](../evidence/phase7-cross-browser-2026-10-19.md) |
| Firefox                                       | 20 public routes × 3 widths             | Same chunk issue (fixed #175); CSP gaps (#176)                       | [`phase7-cross-browser`](../evidence/phase7-cross-browser-2026-10-19.md) |
| Real iOS Safari / Android Chrome, PWA install | —                                       | Not run yet (needs a device)                                         | —                                                                        |

## Exit gate

- [ ] Matrix table filled with date + SHA
