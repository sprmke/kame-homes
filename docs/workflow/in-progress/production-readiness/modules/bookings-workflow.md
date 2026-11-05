---
title: 'Module: Bookings + workflow + detail'
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

# Bookings + workflow + detail

Area: **Host core**. Gate **A**.

## Criteria

- [x] **1. Functional (happy + main unhappy paths)** — lifecycle probe: guards + 4 transitions + activity trail
- [x] **2. Access control (roles vs catalog; UI + server)** — RBAC probe (workflow leaf per template)
- [ ] **3. Plan gate (Free / Starter / Pro / Business + downgrade)**
- [x] **4. Tenant isolation (IDOR 403/404)** — IDOR probe on booking reads/writes
- [x] **5. Server-side validation on writes** — server transition guard rejects skips and wrong balances
- [x] **6. Audit log (or documented N/A)** — booking.status_changed rows verified per transition
- [x] **7. Mobile native 375/768; desktop 1280** — booking detail E2E on desktop + mobile shells
- [ ] **8. States: skeleton, empty, error, offline**
- [ ] **9. Unsaved-changes guard on manual-save**
- [ ] **10. Page title + favicon**
- [x] **11. Accessibility smoke** — axe sweep (bookings routes) 0 serious/critical
- [ ] **12. Performance (bounded lists, LCP/INP)**
- [ ] **13. Observability (errors, no PII in logs)**
- [x] **14. Automated tests (unit / E2E gaps listed)** — statusMachine + orchestrator Deno tests, booking E2E specs
- [x] **15. Docs (route guide Testing + host-facing)** — route guide `docs/guides/routes/org/property/bookings.md` + `.cursor/rules/booking-workflow.mdc`
- [ ] **16. Prod config (secrets, crons, Vault)**

### Gaps

- Free-tier manual workflow QA (F7 `free-tier-manual-booking-workflow`) not re-run this cycle.

## Links

- Route guides: see `docs/guides/routes/`
- Tests: see `ui/e2e/features/`
- Plan: parent [`../production-readiness-launch-audit.md`](../production-readiness-launch-audit.md)

## Evidence (2026-11-03)

See [`EVIDENCE-INDEX.md`](./EVIDENCE-INDEX.md) for the re-runnable proof behind each tick.
