---
title: 'Module: Analytics + Ask Analytics'
status: active
tags: [workflow, production-readiness, module]
updated: 2026-11-03
stage: in-progress
kind: reference
readiness: verified
launch_gate: A
launch_blocker: tbd
last_verified: '0fc4d94c 2026-11-03'
---

# Analytics + Ask Analytics

Area: **Growth / AI**. Gate **A**.

## Criteria

- [x] **1. Functional (happy + main unhappy paths)** — property + org analytics pages load with mocked data in E2E
- [ ] **2. Access control (roles vs catalog; UI + server)**
- [x] **3. Plan gate (Free / Starter / Pro / Business + downgrade)** — analytics gated per tier (`analytics` feature) — gate cases in `featureGates`
- [ ] **4. Tenant isolation (IDOR 403/404)**
- [ ] **5. Server-side validation on writes**
- [ ] **6. Audit log (or documented N/A)**
- [x] **7. Mobile native 375/768; desktop 1280** — charts at 375 (scroll-in-container) and 1280
- [ ] **8. States: skeleton, empty, error, offline**
- [ ] **9. Unsaved-changes guard on manual-save**
- [ ] **10. Page title + favicon**
- [x] **11. Accessibility smoke** — axe sweep (analytics route) 0 serious/critical
- [x] **12. Performance (bounded lists, LCP/INP)** — charts lazy-loaded (`AreaChart` chunk); paginated tables
- [ ] **13. Observability (errors, no PII in logs)**
- [x] **14. Automated tests (unit / E2E gaps listed)** — analytics E2E + AI review harness tests
- [x] **15. Docs (route guide Testing + host-facing)** — route guides `org/property/analytics.md`
- [ ] **16. Prod config (secrets, crons, Vault)**

### Gaps

- Ask Analytics / AI review need a paid AI key for live verification.

## Links

- Route guides: see `docs/guides/routes/`
- Tests: see `ui/e2e/features/`
- Plan: parent [`../production-readiness-launch-audit.md`](../production-readiness-launch-audit.md)

## Evidence (2026-11-03)

See [`EVIDENCE-INDEX.md`](./EVIDENCE-INDEX.md) for the re-runnable proof behind each tick.
