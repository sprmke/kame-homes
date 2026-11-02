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

**Status 2026-11-02 — data, storage and accounts are on production `fwor…`; cutover day (T0) is the only remaining migration step.**
Tooling proven in [`scripts/migrate/legacy-to-mt-prod/`](../../../scripts/migrate/legacy-to-mt-prod/README.md): dump (CLI + docker `pg_dump` for managed schemas) → restore into an isolated rehearsal db → `10-post-restore-fixups` → `--include-all` upgrade (1 chain fix shipped: `20260629215000_gmail_listener_state_singleton_drop_guard.sql`) → `30-rewrite-storage-urls` → `40-derived-rebuild` → inventory-diff verify. Storage sync through the Storage API (not SQL metadata only); all 1,303 booking-referenced paths verify readable.

Production baseline (2026-11-02, `hosted-prod-verify` + live queries):

- 450 `guest_submissions` on both legacy and `fwor`, same status mix, same latest `created_at`.
- 412 migrations applied = exactly the committed chain (newer local files are WIP, not drift).
- 10 legacy buckets, 1,505 objects, same per-bucket counts; booking paths 1,303/1,303 readable.
- Org `kame-homes` / property `monaco-2604`, correct owner, comped plan, origin `https://kamespace.com`.
- Test fixtures removed: QA orgs/users deleted (`sql/70-clean-prod-test-data.sql`), legacy guest sign-ins removed (`sql/50-cleanup-guest-auth.sql`). Prod now has 1 org, 1 property, 2 auth users.
- `pg_cron` + `pg_net` installed and 26 jobs defined (`sql/60-install-extensions-and-crons.sql`). The 13 outbound jobs are parked until the go call (`sql/61-activate-all-crons.sql`).

**T0 data path (decided 2026-11-02).** Legacy keeps taking bookings and edits until the freeze, so the Oct 31 copy is not the freeze-time truth. At T0, rebuild from the freeze dump and re-push, in this order:

1. `bun run backup:supabase:prod` on `fwor` (kamewave) before anything else.
2. Freeze legacy: maintenance redirect on `/form`, then `sql/05-legacy-freeze.sql` (unschedules legacy crons).
3. `inventory.ts` against legacy at freeze time → `backups/migration/inventory-<freeze>.json`.
4. `migrate.sh dump <run>` → `restore` → `upgrade` → `sql.run 30-rewrite-storage-urls` (`PSQLVAR_TARGET_HOST=fwor…`) → `sql.run 40-derived-rebuild` on the local rehearsal DB.
5. `KAMEWAVE=kamewave pushLocalRehearsalToHosted.sh backups/migration/<run>` — truncates `public`/`auth`/`storage` on `fwor` and restores the rehearsal data. This also clears any fixture rows and sets `platform_settings.migration_cutover_at`.
6. `sql/20-shape-tenant-org.sql` on `fwor`, then **`sql/75-restore-public-grants.sql`** (a restore can leave tables with RLS but no PostgREST grants; that silently broke `processed_emails` on 2026-11-02), then the storage sync (`syncHostedStorageFromLegacy.ts copy-booking-paths` + `copy-legacy-buckets` + `verify-booking-paths`).
7. `CUTOVER_FREEZE_PAIR=1 LEGACY_INVENTORY=… bun scripts/migrate/legacy-to-mt-prod/hosted-prod-verify.ts` — counts must match before anything is switched.
8. Deploy functions (`cd-prod.yml`), then go call → `sql/61-activate-all-crons.sql` and remove the legacy maintenance redirect.

Fallback: if the freeze dump shows zero drift vs the Oct 31 copy (same counts, same `max(created_at)`, same `max(updated_at)` per carried table), skip 4–5 and run the same verify in step 7. Do not hand-patch individual rows.

## Pending implementation tasks

- [x] **Inventory** — Phase 0.1 done (counts-only JSON, July 2026 data): 445 bookings, 7 auth users, 10 buckets, 85 migrations, 18 public tables
- [x] **Script location** — `scripts/migrate/legacy-to-mt-prod/` (implemented, see its README)
- [x] **Dry-run mode** — restore-then-upgrade rehearsed locally (R1/R2); `db push --dry-run` also verified read-only against legacy
- [x] **Storage sync** — `storage/copyBuckets.ts`: full dry-run verified 1,471/1,471 objects (0 missing, exact sizes) with `LEGACY_SERVICE_ROLE_KEY` from `supabase/.env.local`; `copy` mode executes on R3/cutover.
- [x] **Hosted blob sync (fwor)** — Metadata-only loads leave ghost rows and missing nested paths. Use `storage/syncHostedStorageFromLegacy.ts`: `copy-booking-paths` (every path in `guest_submissions` URLs) then `copy-legacy-buckets` (recursive list of all legacy buckets, ~1.5k objects). `repairHostedBlobs.ts` remains for manifest-only ghost repair. Edge `get-booking-asset-url` HEAD-checks signed URLs before returning a link. Verified 2026-11-02: 1,303/1,303 booking paths readable.
- [x] **Idempotency** — restore = rebuild-from-dump; rewrite/derived-rebuild guarded + re-runnable
- [x] **Validation** — `verify/compareCounts.ts` automated and `sql/90-verify.sql` wired into `migrate.sh verify`; `hosted-prod-verify.ts` + `hosted-r3-smoke.ts` green 2026-11-01/02; guest/host smoke walked by the host
- [x] **Rollback** — plan §8 rollback (legacy unfreeze + DNS revert); local snapshot in `backups/migration/r1-20261024/local-dev-public-snapshot.dump`; dry-run sign-off in [`r3-rollback-rehearsal.md`](./r3-rollback-rehearsal.md)
- [x] **Hosted provisioning** — `fwor…` reused as production (2026-10-27 decision); data + storage loaded, shaping applied
- [x] **R3 hosted rehearsal** — hosted structural verify + HTTP smoke; host admin walkthrough signed off
- [x] **Runbook entry** — this file plus [`t0-go-live-checklist.md`](./t0-go-live-checklist.md)
- [x] **Extensions + scheduled jobs** — `pg_cron` + `pg_net` installed 2026-11-02; 26 jobs defined, 13 outbound jobs parked until T0 (`sql/60-install-extensions-and-crons.sql`, `sql/61-activate-all-crons.sql`)
- [x] **Test-fixture cleanup** — QA orgs/users and legacy guest sign-ins removed (`sql/70-clean-prod-test-data.sql`, `sql/50-cleanup-guest-auth.sql`); prod holds only the Kame Homes tenant
- [ ] **T0 freeze pair** — fresh dump + reload per the T0 data path above, `compareCounts` green at freeze time
- [ ] **Plan 01 B-18 sign-off** — gates decommission (§10), not T0

---

## Recommended order (release day)

Superseded by the **T0 data path** section above. It is kept short here so the runbook has one ordered list:

1. **Backup prod first** (`bun run backup:supabase:prod`, kamewave), then freeze legacy (`05-legacy-freeze.sql`).
2. **Rebuild and re-push** from the freeze dump: `migrate.sh dump` → `restore` → `upgrade` → `sql.run 30-rewrite-storage-urls` → `sql.run 40-derived-rebuild`, then `pushLocalRehearsalToHosted.sh`.
3. **Shape + Storage delta**: `sql/20-shape-tenant-org.sql` on prod, then `syncHostedStorageFromLegacy.ts` (`copy-booking-paths`, `copy-legacy-buckets`, `verify-booking-paths`).
4. **Verify** at freeze: `CUTOVER_FREEZE_PAIR=1` hosted verify + `compareCounts`; spot-check bookings, file URLs and future-booking calendar blocking.
5. **Deploy functions** (CD Prod) and confirm Vault cron secrets.
6. **Flip DNS/Vercel** to `kamespace.com` + the legacy apex redirects, then merge `develop → main`.
7. **Go call**: `sql/61-activate-all-crons.sql`, remove the legacy maintenance redirect, start hypercare.

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
