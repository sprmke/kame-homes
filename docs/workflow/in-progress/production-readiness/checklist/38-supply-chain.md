---
title: 'Supply chain'
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

# 38 — Supply chain

**🆕** Ledger PR-107 / PR-079.

## Remaining work

| #   | Work                                                       | Owner    |
| --- | ---------------------------------------------------------- | -------- |
| 1   | Lockfile integrity (`bun install --frozen-lockfile` in CI) | agent    |
| 2   | `bun audit` / OSV triage before cutover                    | operator |
| 3   | Deno remote imports pinned                                 | agent    |
| 4   | GitHub Actions pinned by SHA                               | agent    |
| 5   | Dependabot (or equivalent) on                              | operator |

## Exit gate

- [ ] CI uses frozen lockfile (already true — re-verify)
- [x] Actions SHA-pin decision documented: pin every action to a full SHA with a version comment;
      Dependabot `github-actions` keeps them current ([#153](https://github.com/sprmke/kame-homes/pull/153))
- [ ] Audit findings triaged
