---
title: 'Module: Team RBAC + invites'
status: active
tags: [workflow, production-readiness, module]
updated: 2026-11-06
stage: in-progress
kind: reference
readiness: verified
launch_gate: B
launch_blocker: tbd
last_verified: '78f1564a 2026-11-03'
---

# Team RBAC + invites

Area: **Team & trust**. Gate **B**.

## Criteria

- [x] **1. Functional (happy + main unhappy paths)** — invite/accept/role-change covered by probes + E2E
- [x] **2. Access control (roles vs catalog; UI + server)** — RBAC matrix probe: Full Access / Operations / Read Only
- [x] **3. Plan gate (Free / Starter / Pro / Business + downgrade)** — team seat gate: Free refuses invite, Growth allows
- [x] **4. Tenant isolation (IDOR 403/404)** — invites probe: cross-tenant role refused, token reuse/expiry handled
- [ ] **5. Server-side validation on writes**
- [x] **6. Audit log (or documented N/A)** — `org.updated` / member events emitted
- [ ] **7. Mobile native 375/768; desktop 1280**
- [ ] **8. States: skeleton, empty, error, offline**
- [ ] **9. Unsaved-changes guard on manual-save**
- [ ] **10. Page title + favicon**
- [x] **11. Accessibility smoke** — axe sweep (team routes) 0 serious/critical
- [ ] **12. Performance (bounded lists, LCP/INP)**
- [ ] **13. Observability (errors, no PII in logs)**
- [x] **14. Automated tests (unit / E2E gaps listed)** — `propertyTeamPermissionCatalog`, plan↔permission coverage tests, team E2E
- [x] **15. Docs (route guide Testing + host-facing)** — route guide `docs/guides/routes/org/property/team.md`
- [ ] **16. Prod config (secrets, crons, Vault)**

### Gaps

- Org-granular and parking RBAC matrices have probe scripts but were last exercised before the production cutover.

## Links

- Route guides: see `docs/guides/routes/`
- Tests: see `ui/e2e/features/`
- Plan: parent [`../production-readiness-launch-audit.md`](../production-readiness-launch-audit.md)

## Evidence (2026-11-03)

See [`EVIDENCE-INDEX.md`](./EVIDENCE-INDEX.md) for the re-runnable proof behind each tick.
