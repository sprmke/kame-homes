---
title: 'Supply chain'
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

- [x] CI uses frozen lockfile: re-verified 2026-10-19, every `bun install` in `ci.yml`, `cd-dev.yml`, `cd-prod.yml`, `cd-preprod.yml`, `migration-replay.yml` ([`phase6-supply-chain-and-uploads`](../evidence/phase6-supply-chain-and-uploads-2026-10-19.md))
- [x] Actions SHA-pin decision documented: pin every action to a full SHA with a version comment;
      Dependabot `github-actions` keeps them current ([#153](https://github.com/sprmke/kame-homes/pull/153))
- [x] Audit findings triaged: [`phase6-dependency-audit`](../evidence/phase6-dependency-audit-2026-10-19.md), in-major patches in [#158](https://github.com/sprmke/kame-homes/pull/158) (42 → 28); remaining need major upgrades (PR-124, PR-126)
