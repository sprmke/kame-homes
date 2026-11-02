---
title: 'Module: Settings + copy-to-properties + OTP'
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

# Settings + copy-to-properties + OTP

Area: **Host core**. Gate **A**.

## Criteria

- [x] **1. Functional (happy + main unhappy paths)** — property/org/parking settings save paths covered by probes + E2E
- [x] **2. Access control (roles vs catalog; UI + server)** — settings leaves per section (basicInfo, media, payment, dangerZone …)
- [x] **3. Plan gate (Free / Starter / Pro / Business + downgrade)** — plan-gated settings surfaced with tier badges
- [x] **4. Tenant isolation (IDOR 403/404)** — settings writes scoped by property/org
- [x] **5. Server-side validation on writes** — server validators reject bad payloads (`settingsPatchPermissions`)
- [x] **6. Audit log (or documented N/A)** — `org.updated` / property edits audited with field diffs
- [ ] **7. Mobile native 375/768; desktop 1280**
- [ ] **8. States: skeleton, empty, error, offline**
- [x] **9. Unsaved-changes guard on manual-save** — unsaved-changes guard on every settings card (`useUnsavedChangesGuard`)
- [ ] **10. Page title + favicon**
- [x] **11. Accessibility smoke** — axe sweep (settings route) 0 serious/critical
- [ ] **12. Performance (bounded lists, LCP/INP)**
- [ ] **13. Observability (errors, no PII in logs)**
- [x] **14. Automated tests (unit / E2E gaps listed)** — settings field-error unit tests, org settings E2E, RBAC nav gates
- [x] **15. Docs (route guide Testing + host-facing)** — route guides for property/parking/org settings
- [ ] **16. Prod config (secrets, crons, Vault)**

### Gaps

- Sensitive-settings step-up OTP needs a live email OTP to verify end to end.

## Links

- Route guides: see `docs/guides/routes/`
- Tests: see `ui/e2e/features/`
- Plan: parent [`../production-readiness-launch-audit.md`](../production-readiness-launch-audit.md)

## Evidence (2026-11-03)

See [`EVIDENCE-INDEX.md`](./EVIDENCE-INDEX.md) for the re-runnable proof behind each tick.
