---
title: 'Accessibility'
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

# 33 — Accessibility (WCAG 2.2 AA)

**🆕** Ledger PR-102. Overlaps doc 29.6.

## Remaining work

| #   | Work                                                             | Owner |
| --- | ---------------------------------------------------------------- | ----- |
| 1   | axe sweep on primary guest + host routes (0 serious/critical)    | agent |
| 2   | Keyboard path: booking form, sign-in, bookings table, assistant  | agent |
| 3   | Screen-reader spot check on booking form + listing               | agent |
| 4   | Contrast on marketing themes (user-chosen palettes need a floor) | agent |

## Exit gate

- [x] axe 0 serious/critical on the 9 baseline routes — **exceeded**: automated sweep over **35 routes** (14 public, 2 guest booking, 17 property-dashboard, 5 org-hub) at 1280px, 0 serious/critical. Spec: `ui/e2e/features/a11y/axeSweep.spec.ts` (runs in `@ci`, so CD Dev keeps the gate). Evidence: PR #210 + [`evidence/phase6-tooling-2026-11-02.md`](../evidence/phase6-tooling-2026-11-02.md) (ZAP pass) and the sweep output in the PR.
- [ ] Keyboard path documented with evidence — the sweep covers focus order only indirectly; manual keyboard pass (booking form, sign-in, bookings table, assistant) still open.

### Notes (2026-11-02)

- Fixed by the sweep: brand teal as text (2.7–3.0:1) replaced by a derived `--brand-ink` (4.8:1 target, per-tenant); muted ink 46% → 40%; every white-on-brand fill moved to `bg-primary-strong` (the `textOnBrandFill` allowlist is now empty); theme previews derive AA on-colours; carousel dots 24px hit area; table rows no longer fake `role="button"`; skeletons get `role="status"`; marketing cards honour `prefers-reduced-motion`.
- Marketing theme previews inherit AA via `resolveMarketingTheme` (`ensureContrast` now pushes ink away from the background luminance), so user-chosen palettes keep a contrast floor.
