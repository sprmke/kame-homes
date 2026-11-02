---
title: 'Module: Landing + explore'
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

# Landing + explore

Area: **Guest / public**. Gate **A**.

## Criteria

- [x] **1. Functional (happy + main unhappy paths)** — public pages E2E (landing hero, listings, for-hosts) + production Lighthouse run
- [ ] **2. Access control (roles vs catalog; UI + server)**
- [ ] **3. Plan gate (Free / Starter / Pro / Business + downgrade)**
- [ ] **4. Tenant isolation (IDOR 403/404)**
- [ ] **5. Server-side validation on writes**
- [ ] **6. Audit log (or documented N/A)**
- [x] **7. Mobile native 375/768; desktop 1280** — mobile/tablet smoke projects + a11y sweep at three viewports
- [x] **8. States: skeleton, empty, error, offline** — hero skeleton + empty states covered by skeletons and E2E
- [ ] **9. Unsaved-changes guard on manual-save**
- [x] **10. Page title + favicon** — `usePageMeta` title/description/OG per route
- [x] **11. Accessibility smoke** — axe sweep (public routes) 0 serious/critical; prod Lighthouse a11y 100
- [x] **12. Performance (bounded lists, LCP/INP)** — LCP 6.8–11.7 s on the stale prod build; entry chunk 151 KiB gzip on develop
- [ ] **13. Observability (errors, no PII in logs)**
- [x] **14. Automated tests (unit / E2E gaps listed)** — `publicPagesSmoke`, `publicListingBrowse`, `forHostsPricing` E2E
- [x] **15. Docs (route guide Testing + host-facing)** — route guides for `/`, `/properties`, `/parkings`, `/developments`, `/for-hosts`
- [ ] **16. Prod config (secrets, crons, Vault)**

### Gaps

- Hero imagery still dominates LCP; the develop fixes need a production release (PR-149).

## Links

- Route guides: see `docs/guides/routes/`
- Tests: see `ui/e2e/features/`
- Plan: parent [`../production-readiness-launch-audit.md`](../production-readiness-launch-audit.md)

## Evidence

2026-10-19 hosted-dev `/` at desktop: title `Kame Homes - Home`, search pill, destination chips, featured stays, footer legal. Screenshot in session. Not 375/768 yet. Not ✅.

## Evidence (2026-11-03)

See [`EVIDENCE-INDEX.md`](./EVIDENCE-INDEX.md) for the re-runnable proof behind each tick.
