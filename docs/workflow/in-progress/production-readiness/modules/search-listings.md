---
title: 'Module: Search + listing pages'
status: active
tags: [workflow, production-readiness, module]
updated: 2026-11-06
stage: in-progress
kind: reference
readiness: verified
launch_gate: A
launch_blocker: tbd
last_verified: '0fc4d94c 2026-11-03'
---

# Search + listing pages

Area: **Guest / public**. Gate **A**.

## Criteria

- [x] **1. Functional (happy + main unhappy paths)** — search + listing browse E2E (filters, sort, pagination, empty state)
- [ ] **2. Access control (roles vs catalog; UI + server)**
- [ ] **3. Plan gate (Free / Starter / Pro / Business + downgrade)**
- [x] **4. Tenant isolation (IDOR 403/404)** — search RPCs scoped by public listing visibility
- [ ] **5. Server-side validation on writes**
- [ ] **6. Audit log (or documented N/A)**
- [x] **7. Mobile native 375/768; desktop 1280** — filter sheets on phone, toolbar at 768
- [x] **8. States: skeleton, empty, error, offline** — empty state keeps the guest on the page
- [ ] **9. Unsaved-changes guard on manual-save**
- [ ] **10. Page title + favicon**
- [x] **11. Accessibility smoke** — axe sweep on `/search`, `/properties` 0 serious/critical
- [x] **12. Performance (bounded lists, LCP/INP)** — `get-public-property` latency halved (#180); search payloads paginated
- [ ] **13. Observability (errors, no PII in logs)**
- [x] **14. Automated tests (unit / E2E gaps listed)** — `publicListingBrowse.spec.ts`, `search-listings` parity integration test
- [x] **15. Docs (route guide Testing + host-facing)** — route guides `search.md`, `properties.md`
- [ ] **16. Prod config (secrets, crons, Vault)**

### Gaps

- A large-tenant seed (PR-052) is still missing, so search pagination is untested at 10k rows.

## Links

- Route guides: see `docs/guides/routes/`
- Tests: see `ui/e2e/features/`
- Plan: parent [`../production-readiness-launch-audit.md`](../production-readiness-launch-audit.md)

## Evidence

2026-10-19 hosted-dev `/properties`: title `Kame Homes - Properties`, filters render, **0 listings** empty state. **PR-109.** Re-test after function deploy.

## Evidence (2026-11-03)

See [`EVIDENCE-INDEX.md`](./EVIDENCE-INDEX.md) for the re-runnable proof behind each tick.
