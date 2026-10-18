---
title: 'Module: For-hosts + tour + pricing'
status: active
tags: [workflow, production-readiness, module]
updated: 2026-10-19
stage: in-progress
kind: reference
readiness: unverified
launch_gate: A
launch_blocker: tbd
last_verified: none
---

# For-hosts + tour + pricing

Area: **Guest / public**. Gate **A**.

## Criteria

- [ ] **1. Functional (happy + main unhappy paths)**
- [ ] **2. Access control (roles vs catalog; UI + server)**
- [ ] **3. Plan gate (Free / Starter / Pro / Business + downgrade)**
- [ ] **4. Tenant isolation (IDOR 403/404)**
- [ ] **5. Server-side validation on writes**
- [ ] **6. Audit log (or documented N/A)**
- [ ] **7. Mobile native 375/768; desktop 1280**
- [ ] **8. States: skeleton, empty, error, offline**
- [ ] **9. Unsaved-changes guard on manual-save**
- [ ] **10. Page title + favicon**
- [ ] **11. Accessibility smoke**
- [ ] **12. Performance (bounded lists, LCP/INP)**
- [ ] **13. Observability (errors, no PII in logs)**
- [ ] **14. Automated tests (unit / E2E gaps listed)**
- [ ] **15. Docs (route guide Testing + host-facing)**
- [ ] **16. Prod config (secrets, crons, Vault)**

## Links

- Route guides: see `docs/guides/routes/`
- Tests: see `ui/e2e/features/`
- Plan: parent [`../production-readiness-launch-audit.md`](../production-readiness-launch-audit.md)

## Evidence

None yet. Fill during Phase 7.
