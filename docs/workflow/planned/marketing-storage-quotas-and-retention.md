---
stage: planned
title: 'Marketing storage: unified org quota, retention, and cost guardrails'
status: planned
tags: [workflow, planned, marketing, storage, quotas, plans-and-permissions, cost, supabase]
updated: 2026-11-02
kind: plan
---

# Marketing storage: unified org quota, retention, and cost guardrails

## 1. Problem

Marketing Studio writes a lot of bytes: host uploads (images, video, music), canvas uploads, AI image and video outputs, every refinement version of an AI session, saved-design thumbnails, and data-URL exports pushed to Meta. We are on Supabase Pro. If growth stays unbounded, a handful of active hosts can use up the included storage and egress.

There is already a per-tier quota, but it covers only one of the seven write paths. Most marketing bytes are never counted and never deleted.

## 2. What exists today (audit, 2026-11-02)

### 2.1 The one quota we have

`marketing_media_assets` + `reserve_marketing_media_upload` (advisory-locked) + `marketingMediaLibrary` plan feature (`20261316128900`, `…910`, `…950`). The client shows `MediaStorageMeter.tsx`, and the super-admin console has `marketing_media_org_usage` / `marketing_media_platform_usage`.

| Tier (code)    | storageMb | maxFiles | maxVideoMb | maxVideoSec | dailyUploads |
| -------------- | --------- | -------- | ---------- | ----------- | ------------ |
| free           | 100       | 30       | 50         | 30          | 20           |
| starter        | 500       | 100      | 100        | 60          | 50           |
| growth (Pro)   | 3,072     | 500      | 150        | 60          | 150          |
| pro (Business) | 10,240    | 2,000    | 150        | 60          | 300          |
| business_plus  | 10,240    | 2,000    | 150        | 60          | 300          |
| managed        | 25,600    | 5,000    | 150        | 60          | 500          |

The `marketing-media` sweeper (every 30 min) expires stale `pending` reservations, purges soft-deleted rows after 7 days, and runs a daily orphan scan, **for the `marketing-media` bucket only**.

### 2.2 Write paths and whether they are counted or cleaned

| #   | Write path                                              | Bucket / prefix                                 | Counted in quota             | Deleted ever                                                                                              |
| --- | ------------------------------------------------------- | ----------------------------------------------- | ---------------------------- | --------------------------------------------------------------------------------------------------------- |
| W1  | Media library upload (`marketing-media`)                | `marketing-media/…`                             | ✅                           | ✅ soft delete + sweeper                                                                                  |
| W2  | Music upload (`marketing-music`)                        | `marketing-media/…` (`music_upload`)            | ✅                           | ✅                                                                                                        |
| W3  | Canvas upload (`upload-marketing-asset`)                | `property-media/marketing-uploads/{pid}/`       | ❌                           | ❌ **never, no DB row**                                                                                   |
| W4  | AI output (`generate-marketing-media`)                  | `property-media/marketing-ai/{pid}/{jobId}`     | ❌ (`source=ai` is excluded) | Only on explicit delete or session purge (see W6)                                                         |
| W5  | AI references (`upload-marketing-generation-reference`) | `property-media/marketing-ai-refs/{pid}/`       | ❌                           | ✅ 90 days after last use                                                                                 |
| W6  | AI session versions (every refinement)                  | W4 objects + post `preview_path`                | ❌                           | Soft delete → 30 days → **SQL cron deletes rows but not objects** (`purge_deleted_marketing_ai_sessions`) |
| W7  | Saved-design thumbnails                                 | `property-media/{pid}/marketing-thumbs/`        | ❌                           | Same as W6 (`purge_deleted_marketing_templates` leaves objects)                                           |
| W8  | Publish exports (`resolvePublicMarketingMediaUrl`)      | `property-media/{pid}/marketing-exports/{ts}-…` | ❌                           | ❌ **never**, and a new object is written on every publish                                                |

### 2.3 Gaps found

1. **The quota is per property, not per org.** Every other quantity entitlement (team seats, publish cap) pools across `entitlementPoolPropertyIds` (`plans-feature-matrix.md`). A Business org with 5 properties currently gets 50 GB.
2. **`marketingMediaIngest.ts` is dead code.** Its header says `upload-marketing-asset` and `marketing-music` route through it, but only a test imports it. `upload-marketing-asset` writes straight to `property-media` with no quota, no dedupe, and no row (W3).
3. **AI outputs are unbounded.** Credits bound the _cost to generate_, not the _bytes kept_. Each refinement keeps another full-resolution file, and AI images are stored as returned (PNG by default, `marketingImageGenerationAi.ts:208`).
4. **Orphans pile up in `property-media`.** The SQL purge crons call leftover objects "harmless", and the orphan scan does not cover `property-media`. `delete-property` / `delete-organization` remove only `settings.media` gallery paths, so every marketing prefix stays after a property or org is deleted.
5. **Publish exports are write-only** (W8).
6. **No platform-level view or circuit breaker.** `marketing_media_platform_usage` counts only W1/W2. Nothing sums `storage.objects` by bucket and prefix, and nothing alerts before we hit the Supabase plan limit.
7. **Docs gap:** `marketingMediaLibrary` has no row in `docs/architecture/plans-feature-matrix.md`.

### 2.4 Cost reality check (verify on supabase.com/pricing before deciding numbers)

From what I last knew, Pro includes **100 GB storage** (about **$0.021 per GB-month** above that) and **250 GB egress** (about **$0.09 per GB** uncached, cheaper when cached). Two consequences:

- **Raw storage is cheap.** 1 TB is roughly $21/month. If the spend cap is **on**, the real risk is the project being restricted when it goes over, not the bill. If the spend cap is **off**, the risk is slow, silent growth with no margin control.
- **Egress is the more expensive line.** Video and full-size images loaded again and again in Studio grids, previews, and publish fetches cost more per GB than keeping them.

So the goal is **bounded, predictable, plan-priced growth**: count everything, delete what nobody keeps, and serve small files. A paywall alone does not fix this.

## 3. Your proposal: gate generation and saving to higher tiers

Partly done already: AI image generation is Pro+ and AI video is Business+. Free and Starter cannot generate at all. Uploads are open on every tier with a small allowance.

Recommendation: **do not make saving generated output a paid-only action.** An output we generate and then refuse to keep wastes the AI credits we already paid for, and it feels broken to the host. Instead:

- **Keep the tier gate on generation** (already there).
- **Make storage an org-pooled allowance per tier that counts every write path.** This becomes the upgrade lever: "You've used 4.6 of 5 GB. Upgrade or free up space."
- **Keep unkept AI versions on a short timer.** Only versions the host keeps, uses in a design, downloads, or publishes become permanent.
- **Keep a small Free allowance** (not zero). Free hosts need to try the Studio, since watermarked preview is the conversion funnel.

## 4. Strategy

Five levers, in order of impact per effort:

1. **Count everything** under one org-pooled ledger (`marketing_media_assets` becomes the single source of truth for every marketing byte).
2. **Retention**: unkept AI versions expire, publish exports expire after Meta has fetched them, and orphans are swept in every bucket and prefix we write.
3. **Make files smaller at write time**: WebP for AI images, a lower video bitrate, and posters/thumbnails served in grids.
4. **Over-quota UX that never deletes host work**: block new writes, keep everything readable, offer "free up space" and upgrade.
5. **Platform guardrails**: per-bucket and per-prefix metrics, alerts, and a circuit breaker tied to the Supabase plan budget.

## 5. Phases and tasks

### Phase 0: Measure (no behavior change)

- [ ] **T0.1** Read-only SQL on hosted dev, and on prod only with explicit go-ahead: total bytes and object count per `bucket_id` + first two path segments from `storage.objects` (`metadata->>'size'`). Record the baseline here.
- [ ] **T0.2** Same query per org (join the property id in the path to `properties.organization_id`). Find the top 10 orgs and their mix across W1 to W8.
- [ ] **T0.3** Pull the last 30 days of storage and egress from the Supabase usage dashboard. Confirm the current Pro inclusions/overage prices and the **spend cap** setting.
- [ ] **T0.4** Count orphans: `property-media` marketing prefixes with no referencing row (thumbs, AI outputs from purged sessions, exports).
- [ ] **T0.5** Egress audit: which Studio views load originals where a poster or thumbnail would do (library grid, AI Studio home, template cards, video timeline).

Exit: real numbers decide the tier allowances in Phase 2, instead of guesses.

### Phase 1: Stop the leaks (cleanup, no plan change)

- [ ] **T1.1** Wire `upload-marketing-asset` through `marketingMediaIngest.ts` (W3): it gets a row, content-hash dedupe, and is counted. Keep the returned `{ url, storagePath, width, height }` shape so Polotno is unaffected. Make `marketing-music` use the same path, or delete the duplicate code.
- [ ] **T1.2** Turn both SQL purge crons (`purge_deleted_marketing_ai_sessions`, `purge_deleted_marketing_templates`) into **"collect paths, then delete"**. Either queue the object paths into a `storage_deletion_queue` table that the sweeper drains through the Storage API, or move the purge into the existing edge sweepers. No more "harmless" orphans.
- [ ] **T1.3** Extend `marketing-media-sweeper`'s daily orphan scan to the `property-media` marketing prefixes (`marketing-ai/`, `marketing-uploads/`, `*/marketing-thumbs/`, `*/marketing-exports/`), comparing against jobs, post versions, templates, and assets. Use the same 24 h minimum age.
- [ ] **T1.4** Clean up thumbnails on re-save: confirm the old `thumbnail_path` is removed whenever a save writes a new timestamped one (`marketing-templates` lines ~750-765). Add a test.
- [ ] **T1.5** Publish exports (W8): record each export path on the publication row and delete it **7 days after a successful publish** (Meta copies the media on ingest). Keep it while a post is scheduled or failed and retryable. Coordinate with `marketing-meta-publishing-gaps.md` (scheduling cron). If the input is already a stored https asset, reuse it and do not re-upload.
- [ ] **T1.6** Property/org deletion: `delete-property` and `delete-organization` remove every marketing prefix for the property ids (paged `list` + `remove`), plus `marketing-media` objects for those rows before the cascade.
- [ ] **T1.7** One-shot backfill script (dry-run first) for orphans found in T0.4. Document it in `docs/archive/operations/migration-runbook.md`.

### Phase 2: One org-pooled allowance that counts every byte

- [ ] **T2.1** Schema: extend `marketing_media_assets.source` to `ai_output`, `ai_reference`, `canvas_upload`, `thumbnail`, `export`, and add `retention` (`permanent` | `ephemeral`) + `expires_at`. Backfill rows for existing W4/W5/W7 objects (sizes from `storage.objects`). New migration only; do not edit the shipped ones.
- [ ] **T2.2** Replace `marketing_media_usage(property_id)` with `marketing_media_org_usage_total(org_id)` over the entitlement pool. The reserve RPC locks on the **org** (`hashtext(org_id)`), not the property. Keep the property breakdown for the meter and the super-admin console.
- [ ] **T2.3** Decide what counts. Proposed: everything **permanent** counts. Ephemeral AI versions count too (otherwise refinements are a free unlimited store), but they free themselves on expiry. Thumbnails (<600 KB, one per design) and exports in flight are **exempt but bounded** by design count and retention.
- [ ] **T2.4** AI outputs reserve before the provider call (size estimate per model: image ~1.5 MB, 8 s/720p clip ~10 MB), then finalize with the real size. If storage is full, refuse to **start** a generation (no credits spent) and show "Free up space or upgrade".
- [ ] **T2.5** Re-size `marketingMediaLibrary` as **org-pooled** values using Phase 0 data. Starting proposal, assuming ~60 GB of the Pro plan budgeted for marketing at launch:

  | Tier           | Pooled storage | maxFiles | maxVideoMb | maxVideoSec |
  | -------------- | -------------- | -------- | ---------- | ----------- |
  | free           | 250 MB         | 50       | 50         | 30          |
  | starter        | 1 GB           | 200      | 100        | 60          |
  | growth (Pro)   | 5 GB           | 1,000    | 150        | 60          |
  | pro (Business) | 15 GB          | 3,000    | 150        | 90          |
  | business_plus  | 25 GB          | 5,000    | 150        | 90          |
  | managed        | 50 GB          | 10,000   | 200        | 120         |

  Values stay super-admin-editable in the plan editor (no migration per change), and `planTierGolden.ts` + `check:plan-catalog` are updated to match. Existing orgs above their new allowance are **grandfathered read-only** (Phase 4), never trimmed.

- [ ] **T2.6** `planPresentation.ts`: add a "Marketing storage" compare row and tier-card bullet, and update `/for-hosts/pricing` and `featureGateCopy.ts`.
- [ ] **T2.7** Audit log: `marketing.storage_limit_reached` (notice) and `marketing.storage_freed` (bulk delete or cleanup) via `_shared/activityLog.ts`. Uploads themselves stay N/A as today.

### Phase 3: Retention model for AI versions

- [ ] **T3.1** Every AI version starts as `ephemeral` with `expires_at = now() + 30 days` (super-admin-tunable per tier, e.g. Business 60 days).
- [ ] **T3.2** A version becomes `permanent` when the host **keeps** it (new star/Keep action), inserts it into a design or video, downloads it, or publishes it. Reuse `marketing_media_touch` / `marketing_media_used_in` for the "used in a design" check.
- [ ] **T3.3** UI: a small "Expires in N days" chip on unkept versions in AI Studio, a Keep button, and a session-level "Keep all". Follow `human-copy` / `minimal-ui-copy` and `mobile-responsive` (bottom sheet on phone).
- [ ] **T3.4** Sweeper pass: delete expired ephemeral versions (objects first, then rows), and keep the session row while at least one version survives. Send a notification 3 days before a session would empty completely.
- [ ] **T3.5** The AI Post spec stores no bytes, so preview images (`preview_path`) can be regenerated client-side. Treat them as cache: ephemeral, exempt from quota.

### Phase 4: Over-quota and downgrade UX (host perspective)

- [ ] **T4.1** Org-level storage meter on Marketing Studio Library and on the org **Plans** page: "4.6 GB of 5 GB", with a breakdown by uploads / AI / videos.
- [ ] **T4.2** Thresholds: show a quiet meter color at 80%, a banner at 95%, and at 100% **block new writes only**. Everything stays viewable, downloadable, and publishable (same read/write split as the "view past output" rule).
- [ ] **T4.3** "Free up space" sheet: sort by size, show **unused** (`last_used_at` null or older than 90 days) and "used in N designs" warnings (already built for delete), with bulk delete into the existing 7-day restore window.
- [ ] **T4.4** Downgrade: no automatic deletion, ever. Over allowance means read-only plus the upgrade modal targeting the cheapest tier that fits current usage (`useFeatureGate` pattern).
- [ ] **T4.5** Error mapping: `storage_full` / `too_many_files` / `daily_limit` from every write path (upload, canvas, AI) open the same upgrade modal, not a generic toast.
- [ ] **T4.6** Later, optional: storage add-on packs (e.g. +10 GB) next to `ai-credits-topup-purchase.md`. Only if Phase 0/2 data shows hosts hitting limits who won't change tier.

### Phase 5: Make files smaller and serve less

- [ ] **T5.1** AI images: request JPEG/WebP output from the provider where supported. Otherwise transcode PNG to WebP q≈0.85 at finalize (WASM encoder in the edge function, or a client-side re-encode on first view written back). Expected ~70-85% smaller.
- [ ] **T5.2** Video uploads: lower the `prepareMarketingMedia.ts` target from ~8 Mbps to ~5 Mbps at 1080p (enough for Reels/feeds; spot-check on Meta). Roughly 40% smaller per minute.
- [ ] **T5.3** Grids and timelines load posters/thumbnails only (fixes from the T0.5 audit). Originals load only in the editor or full preview.
- [ ] **T5.4** Keep `cacheControl: 31536000` on every content-addressed marketing object so repeat views come from the CDN (cached egress), and use `300` only for replace-in-place keys (`storage.md` §7.2).
- [ ] **T5.5** Avoid Supabase Image Transformations for grids unless T0 shows it's cheaper. It is billed per origin image, and stored thumbnails are already cheap.

### Phase 6: Platform guardrails (developer / Supabase cost perspective)

- [ ] **T6.1** `storage_usage_by_prefix()` service-role SQL (bucket + prefix + org) feeding a super-admin tile: total vs the Supabase plan budget, top orgs, growth per week. Fold into `super-admin-service-cost-monitoring.md` D7 (`storage_gb`) instead of a parallel console.
- [ ] **T6.2** Alerts at 60% / 80% / 90% of the platform marketing budget (Telegram/email, same channel as the service-cost plan).
- [ ] **T6.3** Circuit breaker: a super-admin flag `marketing_storage_writes` (`on` | `paid_only` | `off`) checked inside the reserve RPC caller. At 90% it auto-switches to `paid_only` (Free/Starter uploads paused). Guest documents and property media are never affected.
- [ ] **T6.4** Decide the spend cap: keep it **on** until Phase 1-2 ship and the alerts work, then decide with real numbers.
- [ ] **T6.5** Exit option, only if the numbers justify it: put marketing media behind a small storage adapter so `marketing-media` can move to an egress-free object store (e.g. Cloudflare R2) without touching callers. Not part of this plan's scope; listed so the adapter shape in T1.1/T2.1 does not block it.

## 6. Order and sizing

| Phase | Depends on     | Size     | Why this order                                         |
| ----- | -------------- | -------- | ------------------------------------------------------ |
| 0     | none           | 1-2 days | Numbers drive every allowance below                    |
| 1     | 0              | ~1 week  | Pure cost recovery, no host-facing change, lowest risk |
| 2     | 1 (T1.1, T1.2) | ~1.5 wks | One ledger, org pooling, AI counted                    |
| 3     | 2              | ~1 week  | Biggest long-term lever on AI growth                   |
| 4     | 2              | ~1 week  | Makes limits feel fair and drives upgrades             |
| 5     | 0              | parallel | Independent byte savings                               |
| 6     | 0, ties to D7  | ~1 week  | Safety net before launch scale                         |

Launch minimum: **Phases 0, 1, 2, and T4.1-T4.2, T4.5, T6.1-T6.2.**

## 7. Open questions

1. Should ephemeral AI versions count toward the quota (proposed: yes), or be exempt with a hard per-session cap instead?
2. Is 30 days the right default expiry for unkept AI versions, and should higher tiers get longer?
3. Should Free keep uploads at all, or only the canvas (W3) for trying templates? (Proposed: keep 250 MB pooled.)
4. What share of the Supabase plan storage do we budget for marketing vs guest docs and property media? (Proposed starting split: 60/40.)
5. Add-on storage packs: wanted at launch or later?

## 8. Docs, plans, permissions, audit (to do when implementing)

- `docs/architecture/storage.md`: replace the "never auto-pruned" rows with the new retention table and document the deletion queue and orphan scan coverage.
- `docs/architecture/plans-feature-matrix.md`: add the `marketingMediaLibrary` row (missing today) with org-pooled semantics.
- Route guides: `docs/guides/routes/org/property/marketing*.md` (Library meter, Keep, Free up space), `org/plans.md`, `for-hosts.md`.
- `docs/archive/operations/migration-runbook.md`: backfill (T1.7, T2.1).
- `plans-and-permissions`: no new RBAC leaf. Keep / delete reuse the existing marketing leaves; storage is a plan quantity.
- `audit-logging`: T2.7 events; the sweeper deletes are `system` actor, N/A per object.
