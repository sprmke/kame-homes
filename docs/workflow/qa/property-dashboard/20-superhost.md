---
title: 'QA — Org settings Trust (Superhost)'
status: active
tags: [qa, superhost, org-settings]
updated: 2026-08-31
---

# QA — Org settings Trust (Superhost)

Route: `/org/:orgSlug/settings` → **Trust** section.

## Preconditions

- Local stack running (`./dev.sh` or UI + `bun run dev:api`).
- Migrations applied: `inbox_thread_metrics`, `superhost_assessment_runs`, drop imported superhost columns.
- Org with at least one property.

## Checklist

| #   | Step                                                                                       | Expected                                                                             |
| --- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------ |
| 1   | Open Org settings → Trust                                                                  | Section loads without save footer; four criterion rows + next assessment date        |
| 2   | Org with no history                                                                        | All criteria show insufficient sample; badge **Not earned**                          |
| 3   | Seed ≥3 guest reviews avg ≥4.8, ≥10 completed bookings, ≥5 inbox threads with fast replies | Live progress reflects improved metrics (`GET get-org-superhost-progress`)           |
| 4   | Super-admin `POST reassess-org-superhost` `{ orgId }`                                      | `organizations.settings.superhost.earned = true`; row in `superhost_assessment_runs` |
| 5   | Public property page                                                                       | **Superhost** badge visible when earned                                              |
| 6   | Degrade a metric + re-assess                                                               | `earned = false`; badge hidden on public listing                                     |
| 7   | Send guest inbound + host reply in inbox                                                   | New/updated row in `inbox_thread_metrics`; `responded_within_24h` set correctly      |
| 8   | Cron dry run on non-assessment day                                                         | `superhost-assessment-cron` returns skip (no org updates)                            |

## API smoke

```bash
# Progress (org member JWT)
curl -s "$SUPABASE_URL/functions/v1/get-org-superhost-progress?org_slug=<slug>" \
  -H "Authorization: Bearer $JWT"

# Manual assess (super-admin JWT)
curl -s -X POST "$SUPABASE_URL/functions/v1/reassess-org-superhost" \
  -H "Authorization: Bearer $SUPER_ADMIN_JWT" \
  -H "Content-Type: application/json" \
  -d '{"orgId":"<uuid>"}'
```

## Backfill (optional)

Historical inbox metrics: `node scripts/dev/backfill-inbox-thread-metrics.mjs [--org-id=] [--dry-run]`
