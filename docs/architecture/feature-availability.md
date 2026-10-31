# Feature availability controls

Super admins can turn specific host capabilities off globally from `/admin/feature-availability` with a reason, optional message, expected-back time, auto restore, optional dashboard banner, and optional super-admin bypass. Hosts see that reason on the exact surface that is off. The server enforces the same switch (503 `FEATURE_UNAVAILABLE`), including crons, webhooks, and the dashboard assistant.

**Implementation plan:** [`docs/workflow/done/feature-availability-controls.md`](../workflow/done/feature-availability-controls.md)  
**Super-admin route guide:** [`docs/guides/routes/admin/feature-availability.md`](../guides/routes/admin/feature-availability.md)

## Model

| Layer     | Location                                            | Role                                                                                                   |
| --------- | --------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Catalog   | `_shared/featureAvailabilityCatalog.ts` + UI mirror | Fixed list of keys, parent tree, labels, provider copy                                                 |
| Overrides | `feature_availability_overrides`                    | Super-admin rows; no row = available (fail-open)                                                       |
| Resolver  | `_shared/featureAvailabilityResolve.ts` + UI mirror | Cascade, auto restore at read time, unknown keys ignored                                               |
| Runtime   | `_shared/featureAvailability.ts`                    | 60s cached snapshot, `isFeatureAvailable`, `featureUnavailableResponse`, `telegramDeliveryUnavailable` |

## Precedence on a host surface

1. Team RBAC (unchanged; availability never reveals a hidden surface)
2. Feature availability (reason panel; no upgrade CTA while off)
3. Plan gate
4. AI platform kill switch / quota

Server handler order: method → auth → **availability** → scope/RBAC → plan → quota.

## 503 contract

`featureUnavailableResponse` returns JSON:

```json
{
  "success": false,
  "error": "<host message>",
  "code": "FEATURE_UNAVAILABLE",
  "feature": "<key>",
  "reason": "<reason>",
  "expectedBackAt": "<iso or null>"
}
```

Optional `Retry-After` when `expected_back_at` is in the future. Client: `featureUnavailableError.ts` (toast + invalidate `get-feature-availability`). PWA replay treats 5xx as retryable.

## Edge functions

| Function                   | Auth                            | Purpose                              |
| -------------------------- | ------------------------------- | ------------------------------------ |
| `feature-availability`     | Super admin + step-up on writes | Admin catalog + CRUD overrides       |
| `get-feature-availability` | Authenticated host              | Off/bypassed keys only + `serverNow` |

## Module invariants (v1)

| Module       | Keys (root)                                    | Must keep working when off                |
| ------------ | ---------------------------------------------- | ----------------------------------------- |
| Inbox Meta   | `inbox.meta` (+ connect/reply/auto_reply/sync) | Webhook ingest, read threads, web chat    |
| Channel sync | `pricing.channel_sync` (+ import)              | **`ical-export`** (never gated)           |
| AI studio    | `marketing.ai_studio` (+ generate)             | Job polling, sweeper, session read/save   |
| AI review    | `analytics.ai_review` (+ regenerate)           | Last review visible when regenerate off   |
| Telegram     | `notifications.telegram` (+ settings/delivery) | Settings GET; delivery skipped not queued |

## Adding a catalog key

1. Add entry to `_shared/featureAvailabilityCatalog.ts` (and client mirror + parity test).
2. Gate server writes/background jobs with `featureUnavailableResponse` or `isFeatureAvailable`.
3. Wire UI: `useFeatureAvailability`, panel/notice/button/dot as appropriate.
4. Decide Plans + Team RBAC (usually N/A for toggling the control itself).
5. Update route guide Host-facing knowledge and this doc if behavior is new.

Plans / Team RBAC for the **control** itself: N/A (super-admin only). Org `activity_log`: N/A (platform-wide; super-admin audit via `logSuperAdminAction`).
