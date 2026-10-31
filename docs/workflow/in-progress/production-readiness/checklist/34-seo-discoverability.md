---
title: 'SEO and public discoverability'
status: active
tags: [workflow, in-progress, production-readiness]
updated: 2026-10-19
stage: in-progress
kind: plan
origin_stage: untracked
readiness: unverified
launch_gate: A
launch_blocker: tbd
last_verified: none
---
# 34 — SEO + public discoverability

**🆕** Ledger PR-103. Overlaps public-listing-pages audit.

## Remaining work

| # | Work | Owner |
| - | ---- | ----- |
| 1 | Sitemap, robots, canonical, OG on listing routes | agent |
| 2 | Crawler middleware; **noindex on `dev.kamehomes.space`** | agent |
| 3 | Re-verify after baseline deploy | agent |

## Exit gate

- [ ] `curl -I https://dev.kamehomes.space` shows noindex or robots disallow
- [ ] Production sitemap only after cutover
