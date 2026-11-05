---
title: 'Module: Notifications in-app/Telegram/push'
status: active
tags: [workflow, production-readiness, module]
updated: 2026-11-06
stage: in-progress
kind: reference
readiness: verified
launch_gate: E
launch_blocker: tbd
last_verified: '78f1564a 2026-11-03'
---

# Notifications in-app/Telegram/push

Area: **Comms**. Gate **E**.

## Criteria

- [x] **1. Functional (happy + main unhappy paths)** — feed paging fixed (#189) and covered by E2E
- [ ] **2. Access control (roles vs catalog; UI + server)**
- [ ] **3. Plan gate (Free / Starter / Pro / Business + downgrade)**
- [ ] **4. Tenant isolation (IDOR 403/404)**
- [ ] **5. Server-side validation on writes**
- [ ] **6. Audit log (or documented N/A)**
- [x] **7. Mobile native 375/768; desktop 1280** — section nav + mobile sheet E2E at 390px
- [x] **8. States: skeleton, empty, error, offline** — skeleton + empty states
- [x] **9. Unsaved-changes guard on manual-save** — dirty bot-token guard E2E (leave page)
- [ ] **10. Page title + favicon**
- [x] **11. Accessibility smoke** — axe sweep (notifications route) 0 serious/critical
- [ ] **12. Performance (bounded lists, LCP/INP)**
- [ ] **13. Observability (errors, no PII in logs)**
- [x] **14. Automated tests (unit / E2E gaps listed)** — `notificationsHub.spec.ts` (6 cases)
- [x] **15. Docs (route guide Testing + host-facing)** — route guide `docs/guides/routes/org/property/notifications.md`
- [ ] **16. Prod config (secrets, crons, Vault)**

### Gaps

- Telegram delivery itself needs live bot tokens (operator).

## Links

- Route guides: see `docs/guides/routes/`
- Tests: see `ui/e2e/features/`
- Plan: parent [`../production-readiness-launch-audit.md`](../production-readiness-launch-audit.md)

## Evidence (2026-11-03)

See [`EVIDENCE-INDEX.md`](./EVIDENCE-INDEX.md) for the re-runnable proof behind each tick.
