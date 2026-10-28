---
title: 'Legacy → multi-tenant prod migration (data + storage)'
status: active
tags: [operations, deployment, migration, supabase, storage]
updated: 2026-10-25
---

# Legacy → multi-tenant prod migration

**When:** Phase B prod release — **after** **MULTI_TENANT_PROD** Supabase exists and **before** pointing **`app.kamehomes.space`** at prod.

**Source:** **LEGACY** `zfttdwtceyqszyeyhilc` (live bookings, Auth users, Storage)  
**Target:** **MULTI_TENANT_PROD** _(project ref TBD at create time)_

**Plan context:** [`multi-tenant-dev-prod-environments.md`](../../workflow/in-progress/ci-cd-environments/multi-tenant-dev-prod-environments.md) Phase B.

> **Not the same as schema migrations.** Repo SQL under `supabase/migrations/` creates empty mt schema. This runbook covers **copying/transforming legacy production data** into the new project.

---

## Scope (to implement)

| Area             | Legacy (`zftt…`)                                          | Target (mt-prod)                                       | Notes                                                      |
| ---------------- | --------------------------------------------------------- | ------------------------------------------------------ | ---------------------------------------------------------- |
| **Postgres**     | Bookings, properties (legacy shape), files metadata, etc. | Multi-tenant schema (`organizations`, `properties`, …) | Transform pipeline — map legacy rows → org/property model  |
| **Storage**      | Guest uploads, templates, PDFs                            | Same bucket names/policies on mt-prod                  | Object copy + path mapping                                 |
| **Auth**         | Supabase Auth users (legacy)                              | mt-prod Auth                                           | Choose: export/import, or re-invite; document PII handling |
| **Edge secrets** | Prod integrations                                         | mt-prod secrets                                        | Manual — not part of data script                           |

**Out of scope for v1 script:** Gmail history, external Google Calendar event IDs (re-link per property).

---

## Legacy → mt-prod cutover (canonical plan)

The detailed, authoritative plan with decisions (D1–D7), phases, runbook timeline and risk table lives in [`docs/workflow/planned/kamespace-02-legacy-prod-to-mt-prod-cutover.md`](../../workflow/planned/kamespace-02-legacy-prod-to-mt-prod-cutover.md). This file becomes the operational companion (commands + timings) as phases land.

**Status 2026-10-25 — R1 + R2 local rehearsals PASSED (clean twice, compareCounts green).** Tooling proven in [`scripts/migrate/legacy-to-mt-prod/`](../../../scripts/migrate/legacy-to-mt-prod/README.md): dump (CLI + docker `pg_dump` for managed schemas) → restore into an isolated rehearsal db → `10-post-restore-fixups` → 322-migration `--include-all` upgrade (1 chain fix shipped: `20260629215000_gmail_listener_state_singleton_drop_guard.sql`) → `30-rewrite-storage-urls` → `40-derived-rebuild` → inventory-diff verify. Storage copy implemented with manifest; private buckets verified to need `LEGACY_SERVICE_ROLE_KEY`; actual object copy waits for R3/cutover targets.

## Pending implementation tasks

- [x] **Inventory** — Phase 0.1 done (counts-only JSON, July 2026 data): 445 bookings, 7 auth users, 10 buckets, 85 migrations, 18 public tables
- [x] **Script location** — `scripts/migrate/legacy-to-mt-prod/` (implemented, see its README)
- [x] **Dry-run mode** — restore-then-upgrade rehearsed locally (R1/R2); `db push --dry-run` also verified read-only against legacy
- [x] **Storage sync** — `storage/copyBuckets.ts`: full dry-run verified 1,471/1,471 objects (0 missing, exact sizes) with `LEGACY_SERVICE_ROLE_KEY` from `supabase/.env.local`; `copy` mode executes on R3/cutover.
- [x] **Idempotency** — restore = rebuild-from-dump; rewrite/derived-rebuild guarded + re-runnable
- [~] **Validation** — `verify/compareCounts.ts` automated; `sql/90-verify.sql` runner wiring + guest/host smoke flows pending (R3)
- [x] **Rollback** — plan §8 rollback (legacy unfreeze + DNS revert); local snapshot in `backups/migration/r1-20261024/local-dev-public-snapshot.dump`
- [ ] **mt-prod provisioning** (Phase 1) — new Supabase account + project; needs owner credentials
- [ ] **R3 hosted dress rehearsal** — full integration, outbound disabled
- [ ] **Runbook entry** in [`migration-runbook.md`](./migration-runbook.md) when script lands

---

## Recommended order (release day)

1. **Backup** LEGACY (`bun run backup:supabase:prod` with **`kamewave`**) and **mt-prod** (empty project backup after schema deploy).
2. **Restore legacy into mt-prod then run the develop chain** (D1 restore-then-upgrade — NOT "schema first, data second"): `migrate.sh dump` → `restore` → `10-post-restore-fixups` → `db push --include-all` → `30-rewrite-storage-urls` (mt-prod host) → `40-derived-rebuild` → `verify`/`compareCounts`.
3. **Copy Storage objects** (`storage/copyBuckets.ts copy`, legacy service role for private buckets).
4. **Verify** counts + spot-check bookings + file URLs + future-bookings calendar blocking.
5. **Deploy functions** + secrets to mt-prod (Vault cron secrets per scheduled-jobs doc).
6. **Flip** Vercel Production `VITE_*` + **`app.kamehomes.space`**; legacy-link redirects (§5.1/5.2).
7. **Merge `develop` → `main`**; **`kame-homes`** Production branch = **`main`**.

---

## Auth migration (decided — plan D3)

**Carry over** via the `auth` schema dump: same UUIDs keep `organizations.owner_id` and audit FKs intact; Google `sub` is stable across OAuth clients so identity rows keep matching. Sessions invalidate by design (new JWT keys); admins sign in again with Google on the new OAuth client. Rehearsed: 7 users + 7 identities restore cleanly and pass `compareCounts`.

---

## Storage buckets (verify in Dashboard before script)

Inventory LEGACY Storage buckets used by guest form workflow (templates, guest uploads, etc.) — mirror policies on mt-prod before bulk copy. See [`docs/PROJECT.md`](../../PROJECT.md) storage sections.

---

## Related

- Prod cutover checklist: [`production-deployment.md`](./production-deployment.md)
- Dev-only phase: [`multi-tenant-dev-prod-setup.md`](./multi-tenant-dev-prod-setup.md)
- Agent guard: `.cursor/rules/no-prod-deploy.mdc` — LEGACY mutations require **`kamewave`**
