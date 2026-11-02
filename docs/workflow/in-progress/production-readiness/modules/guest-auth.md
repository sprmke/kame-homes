---
title: 'Module: Guest auth'
status: active
tags: [workflow, production-readiness, module]
updated: 2026-11-03
stage: in-progress
kind: reference
readiness: verified
launch_gate: B
launch_blocker: tbd
last_verified: '0fc4d94c 2026-11-03'
---

# Guest auth

Area: **Guest / public**. Gate **B**.

## Criteria

- [x] **1. Functional (happy + main unhappy paths)** — magic-link/email-code sign-in exercised by probes and E2E seams
- [x] **2. Access control (roles vs catalog; UI + server)** — guest identity is separate from admin allow list
- [ ] **3. Plan gate (Free / Starter / Pro / Business + downgrade)**
- [ ] **4. Tenant isolation (IDOR 403/404)**
- [ ] **5. Server-side validation on writes**
- [x] **6. Audit log (or documented N/A)** — failed sign-ins recorded as outcomes (#c8dfe00e)
- [x] **7. Mobile native 375/768; desktop 1280** — auth pages at 375/768 (sign-in layout, challenge widget)
- [ ] **8. States: skeleton, empty, error, offline**
- [ ] **9. Unsaved-changes guard on manual-save**
- [ ] **10. Page title + favicon**
- [x] **11. Accessibility smoke** — axe sweep on `/for-guests/login` 0 serious/critical
- [ ] **12. Performance (bounded lists, LCP/INP)**
- [ ] **13. Observability (errors, no PII in logs)**
- [x] **14. Automated tests (unit / E2E gaps listed)** — auth page smoke E2E + auth parity seed tests
- [x] **15. Docs (route guide Testing + host-facing)** — route guide `docs/guides/routes/for-guests/login.md`
- [ ] **16. Prod config (secrets, crons, Vault)**

### Gaps

- Production captcha for Supabase Auth is on; deliberate brute-force checks are operator-run.

## Links

- Route guides: see `docs/guides/routes/`
- Tests: see `ui/e2e/features/`
- Plan: parent [`../production-readiness-launch-audit.md`](../production-readiness-launch-audit.md)

## Evidence (2026-11-03)

See [`EVIDENCE-INDEX.md`](./EVIDENCE-INDEX.md) for the re-runnable proof behind each tick.
