---
title: 'Module: Inbox Meta + web + AI'
status: active
tags: [workflow, production-readiness, module]
updated: 2026-11-06
stage: in-progress
kind: reference
readiness: verified
launch_gate: E
launch_blocker: tbd
last_verified: '0fc4d94c 2026-11-03'
---

# Inbox Meta + web + AI

Area: **Comms**. Gate **E**.

## Criteria

- [x] **1. Functional (happy + main unhappy paths)** — inbox threads/messages/templates covered by E2E and handler tests
- [x] **2. Access control (roles vs catalog; UI + server)** — inbox permission leaves per module (chat/marketing/staff/… edit)
- [ ] **3. Plan gate (Free / Starter / Pro / Business + downgrade)**
- [x] **4. Tenant isolation (IDOR 403/404)** — threads scoped by property via `resolveScopedPropertyAccess`
- [ ] **5. Server-side validation on writes**
- [x] **6. Audit log (or documented N/A)** — inbox actions audited; AI suggestions logged through the gateway
- [ ] **7. Mobile native 375/768; desktop 1280**
- [x] **8. States: skeleton, empty, error, offline** — thread list + conversation skeletons, empty states
- [ ] **9. Unsaved-changes guard on manual-save**
- [ ] **10. Page title + favicon**
- [x] **11. Accessibility smoke** — axe sweep (inbox route) 0 serious/critical
- [ ] **12. Performance (bounded lists, LCP/INP)**
- [ ] **13. Observability (errors, no PII in logs)**
- [x] **14. Automated tests (unit / E2E gaps listed)** — inbox E2E (chat templates, rich messages), meta inbox handler tests
- [ ] **15. Docs (route guide Testing + host-facing)**
- [ ] **16. Prod config (secrets, crons, Vault)**

### Gaps

- Meta live traffic needs a valid page token (operator, PR-072).

## Links

- Route guides: see `docs/guides/routes/`
- Tests: see `ui/e2e/features/`
- Plan: parent [`../production-readiness-launch-audit.md`](../production-readiness-launch-audit.md)

## Evidence (2026-11-03)

See [`EVIDENCE-INDEX.md`](./EVIDENCE-INDEX.md) for the re-runnable proof behind each tick.
