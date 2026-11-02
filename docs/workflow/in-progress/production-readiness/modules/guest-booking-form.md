---
title: 'Module: Guest booking form + success'
status: active
tags: [workflow, production-readiness, module]
updated: 2026-11-03
stage: in-progress
kind: reference
readiness: verified
launch_gate: A
launch_blocker: tbd
last_verified: '78f1564a 2026-11-03'
---

# Guest booking form + success

Area: **Guest / public**. Gate **A**.

## Criteria

- [x] **1. Functional (happy + main unhappy paths)** — guest-form E2E submit + real-browser submit on dev (2026-10-19)
- [x] **2. Access control (roles vs catalog; UI + server)** — guest anon only; property resolved server-side
- [ ] **3. Plan gate (Free / Starter / Pro / Business + downgrade)**
- [x] **4. Tenant isolation (IDOR 403/404)** — IDOR probe: outsider + guest refused
- [x] **5. Server-side validation on writes** — server capacity/validation rejects over-capacity and bad payloads
- [x] **6. Audit log (or documented N/A)** — `booking.created` audit row + host notification
- [x] **7. Mobile native 375/768; desktop 1280** — mobile/tablet E2E projects + a11y sweep at three viewports
- [ ] **8. States: skeleton, empty, error, offline**
- [ ] **9. Unsaved-changes guard on manual-save**
- [ ] **10. Page title + favicon**
- [x] **11. Accessibility smoke** — axe sweep (guest booking routes) 0 serious/critical
- [ ] **12. Performance (bounded lists, LCP/INP)**
- [ ] **13. Observability (errors, no PII in logs)**
- [x] **14. Automated tests (unit / E2E gaps listed)** — `guestFormLoad` / `guestFormSubmit` / `guestFormSteps` E2E, form unit tests
- [x] **15. Docs (route guide Testing + host-facing)** — route guide `docs/guides/routes/form.md`
- [ ] **16. Prod config (secrets, crons, Vault)**

### Gaps

- Unsaved-changes guard (`useUnsavedChangesGuard`) on the long form is still open (draft is persisted by `useOfflineFormDraft` instead).
- Offline resume path is covered by unit tests only.

## Links

- Route guides: see `docs/guides/routes/`
- Tests: see `ui/e2e/features/`
- Plan: parent [`../production-readiness-launch-audit.md`](../production-readiness-launch-audit.md)

## Evidence (2026-11-03)

See [`EVIDENCE-INDEX.md`](./EVIDENCE-INDEX.md) for the re-runnable proof behind each tick.
