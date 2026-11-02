---
title: 'SEO and public discoverability'
status: active
tags: [workflow, in-progress, production-readiness]
updated: 2026-11-02
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

| #   | Work                                                     | Owner |
| --- | -------------------------------------------------------- | ----- |
| 1   | Sitemap, robots, canonical, OG on listing routes         | agent |
| 2   | Crawler middleware; **noindex on `dev.kamehomes.space`** | agent |
| 3   | Re-verify after baseline deploy                          | agent |

## Exit gate

- [x] `curl -I https://dev.kamehomes.space` shows noindex or robots disallow — `robots.txt` returns `User-agent: * / Disallow: /` (verified 2026-11-02). `X-Robots-Tag` is **not** sent; robots.txt is the enforced control.
- [ ] Production sitemap only after cutover — `sitemap.xml` currently renders **dev** URLs (`https://dev.kamehomes.space/…`, `public-sitemap` 200). Harmless while robots blocks crawling, but the prod sitemap must list the production origin after cutover (operator/cutover item).

### Notes (2026-11-02)

- Lighthouse SEO scored 100 on `/`, `/properties`, `/parkings`, `/developments` (2026-10-19 baseline); `usePageMeta` supplies description/OG on listing + marketing pages.
- Canonical/OG on guest booking routes comes from `usePageMeta` with the property name; verify again on the production host after cutover.
