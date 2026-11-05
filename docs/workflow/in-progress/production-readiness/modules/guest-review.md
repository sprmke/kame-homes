---
title: 'Module: Guest review'
status: active
tags: [workflow, production-readiness, module]
updated: 2026-11-06
stage: in-progress
kind: reference
readiness: verified
launch_gate: A
launch_blocker: tbd
last_verified: '78f1564a 2026-11-03'
---

# Guest review

Area: **Guest / public**. Gate **A**.

## Criteria

- [x] **1. Functional (happy + main unhappy paths)** — review window + write flow E2E (6 category gates)
- [x] **2. Access control (roles vs catalog; UI + server)** — guest-side access via booking token; host side via `reviews:*`
- [ ] **3. Plan gate (Free / Starter / Pro / Business + downgrade)**
- [x] **4. Tenant isolation (IDOR 403/404)** — guest-token probe covers review reads
- [ ] **5. Server-side validation on writes**
- [x] **6. Audit log (or documented N/A)** — submit/respond audited
- [x] **7. Mobile native 375/768; desktop 1280** — mobile-first sheet flow covered by E2E at 390px
- [ ] **8. States: skeleton, empty, error, offline**
- [ ] **9. Unsaved-changes guard on manual-save**
- [ ] **10. Page title + favicon**
- [x] **11. Accessibility smoke** — axe sweep (reviews routes) 0 serious/critical
- [ ] **12. Performance (bounded lists, LCP/INP)**
- [ ] **13. Observability (errors, no PII in logs)**
- [x] **14. Automated tests (unit / E2E gaps listed)** — `guestWriteReview.spec.ts`, `hostReviewsPage.spec.ts`, `orgReviewsPage.spec.ts`
- [ ] **15. Docs (route guide Testing + host-facing)**
- [ ] **16. Prod config (secrets, crons, Vault)**

### Gaps

- Two-way reviews remain behind a flag until the module is verified end to end (PR-066).

## Links

- Route guides: see `docs/guides/routes/`
- Tests: see `ui/e2e/features/`
- Plan: parent [`../production-readiness-launch-audit.md`](../production-readiness-launch-audit.md)

## Evidence (2026-11-03)

See [`EVIDENCE-INDEX.md`](./EVIDENCE-INDEX.md) for the re-runnable proof behind each tick.
