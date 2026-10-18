---
title: 'All good (working)'
status: active
updated: 2026-10-19
stage: in-progress
kind: reference
---

# All good

Only rows with evidence. Everything else stays off this list until the baseline SHA.

| ID                 | Evidence                                                                                                                   |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------- |
| PR-007 / P0-7      | Branch protection on `develop` and `main`: 1 review, code owners, required check `quality` (`gh api` 2026-10-19)           |
| PR-070             | `PARKING_INTERIM_UNGATED_FEATURES` removed; parking uses org plan (`useFeatureGate.ts`)                                    |
| PR-071             | Superhost files present (shared + cron + functions)                                                                        |
| PR-029             | Error tracking for launch: PostHog. Sentry DSN unset on purpose                                                            |
| PR-091 / D-1       | Guest-token grace 30 days (product)                                                                                        |
| PR-092 / D-2       | In-house pentest first (product)                                                                                           |
| CORS               | `check-cors-origins.sh` vs `get-health` on `fwor…`: allowed origin echoed; blocked origin not echoed (2026-10-19)          |
| Health             | `get-health` 200, `db: ok`                                                                                                 |
| Gzip               | `list-public-pricing-plans` returns gzip                                                                                   |
| Headers            | HSTS, nosniff, referrer-policy, permissions-policy on `dev.kamehomes.space`. CSP is Report-Only (not all-good; see PR-012) |
| CI                 | PR #145 all required checks green                                                                                          |
| Local `ci:quality` | Green 2026-10-19 on dirty tree including concurrent work (Phase 0 evidence)                                                |
