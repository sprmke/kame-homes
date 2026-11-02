# D6 config export/import (Plan 02 §3.9)

**Status:** `exportDevConfig.ts` and `importConfig.ts` shipped (allow-list in `allow-list.json`). Run against a scratch restore of `fwor-backup-20261027T032331/`, not live fwor, unless you intend to overwrite prod config.

## Source of dev config

Do **not** export from live `fwor` after the 2026-10-27 legacy load. Use the pre-load backup:

`backups/migration/fwor-backup-20261027T032331/`

## Scripts

```bash
DB_URL=postgresql://… bun scripts/migrate/legacy-to-mt-prod/config/exportDevConfig.ts --out backups/migration/d6-export-kame-home.json
DRY_RUN=1 DB_URL=… bun scripts/migrate/legacy-to-mt-prod/config/importConfig.ts backups/migration/d6-export-kame-home.json
```

## Manual allow-list export (fallback)

1. Restore that dump to a local scratch DB (see `migrate.sh restore`).
2. Export only property-scoped config tables keyed by `kame-home` slug (templates, public pages, pricing rules, property media metadata).
3. Import onto production `fwor` with slug joins, never dev UUIDs.
4. Copy referenced Storage objects from the backup manifest into `property-media` on fwor.

Track completion in [`legacy-cutover-phase-status.md`](../../../../docs/archive/operations/legacy-cutover-phase-status.md).
