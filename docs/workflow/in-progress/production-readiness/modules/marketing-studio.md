---
title: 'Module: Marketing Studio (themes, collage, video, poster, Meta)'
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

# Marketing Studio (themes, collage, video, poster, Meta)

Area: **Growth / AI**. Gate **A**.

## Criteria

- [x] **1. Functional (happy + main unhappy paths)** — AI post / library / collage flows covered by E2E (collage rewritten 2026-11-02)
- [ ] **2. Access control (roles vs catalog; UI + server)**
- [x] **3. Plan gate (Free / Starter / Pro / Business + downgrade)** — AI image/video generation gate per tier (`featureGates` cases)
- [x] **4. Tenant isolation (IDOR 403/404)** — generation ownership scoped by property in edge functions
- [ ] **5. Server-side validation on writes**
- [x] **6. Audit log (or documented N/A)** — generation + publish actions audited
- [x] **7. Mobile native 375/768; desktop 1280** — collage sheet at 390px E2E
- [x] **8. States: skeleton, empty, error, offline** — skeletons + empty states for library and AI studio
- [ ] **9. Unsaved-changes guard on manual-save**
- [ ] **10. Page title + favicon**
- [x] **11. Accessibility smoke** — axe sweep (marketing route) 0 serious/critical
- [ ] **12. Performance (bounded lists, LCP/INP)**
- [ ] **13. Observability (errors, no PII in logs)**
- [x] **14. Automated tests (unit / E2E gaps listed)** — marketing E2E suite (6 specs still `test.fixme` → PR-133)
- [ ] **15. Docs (route guide Testing + host-facing)**
- [ ] **16. Prod config (secrets, crons, Vault)**

### Gaps

- Six AI/library/theme specs are still fixme after the New post redesign (PR-133).

## Links

- Route guides: see `docs/guides/routes/`
- Tests: see `ui/e2e/features/`
- Plan: parent [`../production-readiness-launch-audit.md`](../production-readiness-launch-audit.md)

## Evidence (2026-11-03)

See [`EVIDENCE-INDEX.md`](./EVIDENCE-INDEX.md) for the re-runnable proof behind each tick.
