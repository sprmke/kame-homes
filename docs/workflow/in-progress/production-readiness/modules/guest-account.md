---
title: 'Module: Guest account surfaces'
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

# Guest account surfaces

Area: **Guest / public**. Gate **A**.

## Criteria

- [x] **1. Functional (happy + main unhappy paths)** — guest account pages covered by E2E (reviews, favorites)
- [x] **2. Access control (roles vs catalog; UI + server)** — guest auth identity only; no admin surfaces
- [ ] **3. Plan gate (Free / Starter / Pro / Business + downgrade)**
- [x] **4. Tenant isolation (IDOR 403/404)** — guest account data scoped to the signed-in user
- [ ] **5. Server-side validation on writes**
- [ ] **6. Audit log (or documented N/A)**
- [x] **7. Mobile native 375/768; desktop 1280** — phone-first layouts (bottom sheets) in account routes
- [ ] **8. States: skeleton, empty, error, offline**
- [ ] **9. Unsaved-changes guard on manual-save**
- [ ] **10. Page title + favicon**
- [x] **11. Accessibility smoke** — account routes included in the axe sweep
- [ ] **12. Performance (bounded lists, LCP/INP)**
- [ ] **13. Observability (errors, no PII in logs)**
- [x] **14. Automated tests (unit / E2E gaps listed)** — `accountReviews.spec.ts`, favorites harness, trip hub E2E
- [ ] **15. Docs (route guide Testing + host-facing)**
- [ ] **16. Prod config (secrets, crons, Vault)**

### Gaps

- Full guest profile/settings journeys are spot-checked manually.

## Links

- Route guides: see `docs/guides/routes/`
- Tests: see `ui/e2e/features/`
- Plan: parent [`../production-readiness-launch-audit.md`](../production-readiness-launch-audit.md)

## Evidence (2026-11-03)

See [`EVIDENCE-INDEX.md`](./EVIDENCE-INDEX.md) for the re-runnable proof behind each tick.
