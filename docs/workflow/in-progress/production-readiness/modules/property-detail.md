---
title: 'Module: Property detail + showcase + calendar'
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

# Property detail + showcase + calendar

Area: **Guest / public**. Gate **A**.

## Criteria

- [x] **1. Functional (happy + main unhappy paths)** — property detail E2E (mocked API) + production Lighthouse
- [ ] **2. Access control (roles vs catalog; UI + server)**
- [ ] **3. Plan gate (Free / Starter / Pro / Business + downgrade)**
- [x] **4. Tenant isolation (IDOR 403/404)** — public read only; booking CTA carries the guest token flow
- [ ] **5. Server-side validation on writes**
- [ ] **6. Audit log (or documented N/A)**
- [x] **7. Mobile native 375/768; desktop 1280** — detail page at 375/768/1280 in the walk + a11y sweep
- [ ] **8. States: skeleton, empty, error, offline**
- [ ] **9. Unsaved-changes guard on manual-save**
- [x] **10. Page title + favicon** — crawler middleware injects title/description/OG/JSON-LD
- [x] **11. Accessibility smoke** — axe sweep (property detail) 0 serious/critical
- [ ] **12. Performance (bounded lists, LCP/INP)**
- [ ] **13. Observability (errors, no PII in logs)**
- [ ] **14. Automated tests (unit / E2E gaps listed)**
- [x] **15. Docs (route guide Testing + host-facing)** — route guide `docs/guides/routes/properties/slug.md`
- [ ] **16. Prod config (secrets, crons, Vault)**

### Gaps

- Best practices 96 on prod (map/embed); LCP 11 s on the stale build.

## Links

- Route guides: see `docs/guides/routes/`
- Tests: see `ui/e2e/features/`
- Plan: parent [`../production-readiness-launch-audit.md`](../production-readiness-launch-audit.md)

## Evidence (2026-11-03)

See [`EVIDENCE-INDEX.md`](./EVIDENCE-INDEX.md) for the re-runnable proof behind each tick.
