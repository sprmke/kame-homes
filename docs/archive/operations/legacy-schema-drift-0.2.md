---
title: Legacy schema drift check (Phase 0.2)
status: closed
updated: 2026-11-01
---

# Phase 0.2 — Schema drift (legacy live vs main 85 migrations)

**Decision:** Close 0.2 on **rehearsal evidence** without a byte-level diff artifact. A full local rebuild from `main`'s 85 migrations was not repeated in this pass; risk is accepted because:

1. **2026-10-24:** Legacy `public` schema probe → `backups/migration/schema-probe/legacy-public-schema.sql`.
2. **2026-10-24:** `supabase db push --dry-run --include-all` against legacy reported exactly **322** pending develop migrations, no unexpected drift errors.
3. **R1/R2:** Full restore → upgrade on real legacy data succeeded twice with one shipped guard migration (`20260629215000_gmail_listener_state_singleton_drop_guard.sql`).

**Follow-up (optional):** If legacy dashboard hotfixes appear before T0, add rows to `sql/10-post-restore-fixups.sql` and re-run R3.

**Residual risk:** Manual DDL on legacy not reflected in git. Mitigation: fresh T0 dump + verify + compareCounts before go-live.
