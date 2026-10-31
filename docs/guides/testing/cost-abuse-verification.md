---
title: 'Cost / abuse / security — dev verification'
status: active
tags: [testing, security, cost, abuse]
updated: 2026-09-11
---

# Cost / abuse / security — dev verification

Parent plan: [`cost-abuse-security-production-readiness.md`](../../workflow/in-progress/production-readiness/audits/cost-abuse-security-production-readiness.md).

Run **after** `bun run deploy:supabase:dev` (migrations + functions on hosted dev).

## Automated bundle

```bash
export BASE_URL="https://<dev-ref>.supabase.co/functions/v1"
export SUPABASE_URL="https://<dev-ref>.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="<dev-service-role>"
export ANON_KEY="<dev-anon>"
export STORAGE_OBJECT_PATH="valid-ids/<propertyId>/<file>"  # from key-shapes audit

./scripts/dev/cost-abuse-verify-dev.sh
```

| Script                          | Checks                                    |
| ------------------------------- | ----------------------------------------- |
| `audit-cron-secrets.sh`         | Inventory of `*_CRON_SECRET` keys in code |
| `abuse-public-endpoints.sh`     | A4/A5/A6/A12/A13 rate limits              |
| `check-cors-origins.sh`         | Allowed vs blocked `Origin`               |
| `abuse-storage-anon-read.sh`    | A11 private bucket anon read denied       |
| `storage-audit.ts --key-shapes` | Legacy flat vs `{propertyId}/…` keys      |

## Guest token enforcement (V-5)

On hosted **dev** Edge secrets:

| Secret                                   | Dev value               |
| ---------------------------------------- | ----------------------- |
| `GUEST_BOOKING_ACCESS_ENFORCE`           | `true`                  |
| `GUEST_BOOKING_ACCESS_LEGACY_GRACE_DAYS` | `30` (default if unset) |

Verify:

1. Booking **older than 30 days** without `?access=` → `401` on `get-form`.
2. **New** booking email link with `?access=` → loads.
3. Recent booking without token (within grace) still loads until grace expires.
4. Write companions (same enforce/grace): `POST submit-form` (existing booking), `submit-sd-form`, `submit-guest-review`, `claim-sd-voucher` without `access` → `401` when grace expired. Matching token succeeds.

## Manual pentest (§6.2)

Use this checklist after automated scripts pass:

- [ ] Auth: guest JWT cannot call admin edge functions.
- [ ] IDOR: random booking UUID on get-form/sd-form/review **and** write endpoints (outside grace) → 401.
- [ ] Upload: SVG/HTML rejected or stored without execution; oversized file → 400.
- [ ] PayMongo: replay same event id → no double fulfill.
- [ ] Assistant: prompt injection does not return other guests' PII.
- [ ] Error bodies: no stack traces or secret names in JSON errors.

## Operator items (still manual)

Keys, billing alerts, Turnstile, Maps referrer lock, GitHub branch protection: [`cost-abuse-security-pending-from-user.md`](../../workflow/in-progress/production-readiness/operator/cost-abuse-security-pending-from-user.md).
