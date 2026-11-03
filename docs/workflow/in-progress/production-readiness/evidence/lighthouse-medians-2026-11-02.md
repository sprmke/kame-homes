---
title: 'Lighthouse 3x median — https://kamespace.com (2026-11-02)'
status: active
stage: in-progress
kind: evidence
readiness: verified
launch_gate: A
launch_blocker: false
last_verified: '2026-11-02'
---

# Lighthouse 3x median

Mobile emulation, simulated throttling, 3 runs per route, median reported.
Command: `BASE_URL=https://kamespace.com node scripts/performance/lighthouse-medians.mjs`.

| Route                        | Perf | A11y | BP  | SEO | LCP   | TBT  | CLS   | n   |
| ---------------------------- | ---- | ---- | --- | --- | ----- | ---- | ----- | --- |
| /                            | 60   | 100  | 100 | 69  | 9.6s  | 27ms | 0     | 3   |
| /properties                  | 61   | 100  | 100 | 69  | 9.0s  | 23ms | 0     | 3   |
| /parkings                    | 62   | 100  | 100 | 66  | 8.6s  | 31ms | 0     | 3   |
| /developments                | 62   | 100  | 100 | 66  | 8.0s  | 31ms | 0     | 3   |
| /search                      | 60   | 100  | 100 | 69  | 9.1s  | 34ms | 0.058 | 3   |
| /for-hosts                   | 60   | 100  | 100 | 63  | 8.3s  | 1ms  | 0     | 3   |
| /for-hosts/pricing           | 63   | 100  | 100 | 63  | 6.8s  | 28ms | 0     | 3   |
| /properties/monaco-2604      | 60   | 100  | 96  | 69  | 11.0s | 23ms | 0     | 3   |
| /properties/monaco-2604/form | 59   | 100  | 96  | 63  | 11.7s | 18ms | 0     | 3   |
