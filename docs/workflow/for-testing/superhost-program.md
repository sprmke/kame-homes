---
title: 'Superhost program — earned-only (detailed plan)'
status: active
tags: [workflow, planned, superhost, trust]
updated: 2026-09-01
stage: for-testing
kind: plan
---

# Superhost program — earned-only

> **Stage:** [`for-testing`](../for-testing/README.md) — implementation complete (Phases 0–4). Remaining: manual QA only — [`../qa/property-dashboard/20-superhost.md`](../qa/property-dashboard/20-superhost.md). Move to [`../done/`](../done/) after checklist passes.

**Authoritative plan** for Kame Superhost.

---

## TL;DR

| Item                 | Decision                                                                                                    |
| -------------------- | ----------------------------------------------------------------------------------------------------------- |
| **Model**            | **Earned only** — automatic, no application                                                                 |
| **Scope**            | **Organization** — badge on all properties under that org                                                   |
| **Public badge**     | `isSuperhost = organizations.settings.superhost.earned === true`                                            |
| **Criteria**         | Airbnb-style four metrics, rolling 365 days, all required                                                   |
| **Assessment**       | Quarterly cron (Jan 1, Apr 1, Jul 1, Oct 1 — Asia/Manila)                                                   |
| **Plan gating**      | None — trust is not paywalled                                                                               |
| **Effort remaining** | Manual QA only — see [`../qa/property-dashboard/20-superhost.md`](../qa/property-dashboard/20-superhost.md) |

---

## 1. Goal

Guests see a **Superhost** badge on public listings when the host organization meets Kame performance standards. Hosts do not submit proof or apply — status is computed and reassessed automatically (like Airbnb).

### Definition of done

- [x] Org meeting all four criteria at assessment → `settings.superhost.earned = true` → badge on all org properties.
- [x] Org losing criteria at next assessment → badge removed org-wide.
- [x] Host sees progress (four criteria + next assessment) in **Org settings → Trust**.
- [x] Public APIs (`get-public-property`, `list-public-properties`, place-groups) resolve badge from org earned flag.
- [x] Quarterly `superhost-assessment-cron` + optional manual re-run for super-admin support.
- [x] Docs + QA checklist complete; `bun run ci:quality` green.

---

## 2. Superhost criteria (all four required)

Rolling **365 days**, **org-wide** across all properties. Assessed **quarterly**.

| #   | Criterion             | Threshold                                                               | Data source                                                                                                                         | Min sample    |
| --- | --------------------- | ----------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ------------- |
| 1   | **Overall rating**    | ≥ **4.8 / 5**                                                           | `guest_reviews.star_rating` only                                                                                                    | ≥ 3 reviews   |
| 2   | **Response rate**     | ≥ **90%** within **24h**                                                | Inbox thread metrics (new table)                                                                                                    | ≥ 5 threads   |
| 3   | **Cancellation rate** | **< 1%**                                                                | Host-initiated **`cancel-booking`** → `CANCELLED` (OTA calendar **feed-drop** auto-cancels excluded via **`calendar_sync_events`**) | ≥ 10 bookings |
| 4   | **Activity**          | ≥ **10 completed stays** **OR** ≥ **3 stays** totaling ≥ **100 nights** | `guest_submissions` `COMPLETED`                                                                                                     | ≥ 1 stay      |

**Assessment dates:** Jan 1, Apr 1, Jul 1, Oct 1 (Asia/Manila). No grace period on loss.

**Out of v1:** Parking bookings, search ranking boost, Superhost-only vouchers, external OTA stars in rating average.

---

## 3. Architecture

### Badge resolution (shipped stub)

```typescript
// organizations.settings.superhost
{ earned: boolean, earnedAt?, lastAssessmentAt?, nextAssessmentAt?, criteria?, history? }

isSuperhost(property) = isOrgSuperhostEarned(org.settings)  // all properties inherit
```

**Implementation (shipped):**

- `_shared/orgSuperhost.ts` — `isOrgSuperhostEarned`, `batchLoadIsSuperhostByPropertyId`
- `publicPropertyService.ts`, `list-public-properties`, `list-public-place-groups` use org earned flag
- UI mirror: `ui/.../org/lib/orgSuperhost.ts`

Until the first assessment runs (or a super-admin **`reassess-org-superhost`** call), `earned` is unset → badge **off** for everyone.

### Host journey

```text
Host operates on Kame (bookings, reviews, inbox replies, low cancels)
  → Org Settings → Superhost shows 4 criteria + progress
  → Quarterly cron evaluates org
  → All four met → Superhost earned → badge on public listings
  → Next quarter: re-evaluated; can lose badge if metrics slip
```

### Guest-facing

Badge unchanged on property detail, search cards, showcase, host cards — label **Superhost** when `isSuperhost` is true.

---

## 4. Data model (to ship)

### Org JSONB — `organizations.settings.superhost`

```json
{
  "earned": false,
  "earnedAt": null,
  "lastAssessmentAt": null,
  "lastAssessmentKey": "2026-Q3",
  "nextAssessmentAt": "2026-10-01T00:00:00+08:00",
  "criteria": {
    "rating": { "value": 4.9, "required": 4.8, "met": true, "sampleSize": 12 },
    "responseRate": { "value": 0.92, "required": 0.9, "met": true, "sampleSize": 8 },
    "cancellationRate": { "value": 0.0, "required": 0.01, "met": true, "sampleSize": 45 },
    "activity": {
      "value": 12,
      "required": 10,
      "met": true,
      "sampleSize": 12,
      "metVia": "ten_stays"
    }
  },
  "history": []
}
```

### Inbox metrics table (Phase 1)

`inbox_thread_metrics` — per conversation: `first_guest_message_at`, `first_host_reply_at`, `responded_within_24h`.

### Assessment runs (Phase 2)

`superhost_assessment_runs` — idempotent log per org per quarter.

### Dropped columns (shipped)

`app_settings.superhost_verification_url`, `superhost_proof_image_url`, `superhost_status` — removed.

---

## 5. API (to ship)

| Function                     | Method | Auth                               | Purpose                                              |
| ---------------------------- | ------ | ---------------------------------- | ---------------------------------------------------- |
| `get-org-superhost-progress` | GET    | org member                         | Live criteria snapshot + next assessment for host UI |
| `reassess-org-superhost`     | POST   | super-admin                        | Manual re-run for one org                            |
| `superhost-assessment-cron`  | POST   | cron secret **or** super-admin JWT | Quarterly batch assessment                           |

**Public (shipped):** `get-public-property`, `list-public-properties`, `list-public-place-groups` read org earned via `orgSuperhost.ts`.

---

## 6. UI (to ship)

| Surface                  | Content                                               |
| ------------------------ | ----------------------------------------------------- |
| **Org settings → Trust** | Earned status, 4 criterion rows, next assessment date |
| **Property settings**    | No Superhost block (removed)                          |
| **Super-admin**          | No Superhost moderation queue                         |
| **Public**               | Existing badge components (unchanged)                 |

---

## 7. Implementation phases

### Phase 0 — Remove import track ✅ (shipped 2026-08-31)

- Drop `app_settings` superhost columns (migration)
- Remove property settings Superhost UI + API fields
- Remove `superhost_proof` upload asset type
- Add `orgSuperhost.ts` + wire public badge to org `settings.superhost.earned`
- Update route guides + edge-functions inventory

### Phase 1 — Metrics foundation (~2–3 days)

| Task                               | Paths                                                             |
| ---------------------------------- | ----------------------------------------------------------------- |
| `inbox_thread_metrics` migration   | `supabase/migrations/…`                                           |
| Upsert on inbound / host reply     | `_shared/inboxSendReplyAction.ts`, inbox send handlers            |
| `superhostMetrics.ts` + Deno tests | `_shared/superhostMetrics.ts`, `_shared/superhostMetrics_test.ts` |
| Optional backfill script           | `scripts/dev/backfill-inbox-thread-metrics.mjs`                   |

### Phase 2 — Assessment engine (~2–3 days)

| Task                                          | Paths                                                          |
| --------------------------------------------- | -------------------------------------------------------------- |
| `superhostAssessment.ts`                      | evaluate org, patch `settings.superhost`                       |
| `superhost_assessment_runs` migration         |                                                                |
| `superhost-assessment-cron` + pg_cron snippet | edge + `docs/archive/operations/scheduled-jobs-and-testing.md` |
| `get-org-superhost-progress`                  | new edge                                                       |
| `reassess-org-superhost`                      | super-admin support                                            |
| Earn/lose emails                              | `_shared/superhostNotifications.ts`                            |

### Phase 3 — Host dashboard UX (~1–2 days)

| Task                              | Paths                                |
| --------------------------------- | ------------------------------------ |
| `OrgSuperhostProgressSection.tsx` | org settings Superhost section       |
| `useOrgSuperhostProgress.ts`      | hook                                 |
| Route guide                       | `docs/guides/routes/org/settings.md` |

### Phase 4 — Production readiness (~1–2 days)

| Task                | Paths                                                 |
| ------------------- | ----------------------------------------------------- |
| QA doc              | `docs/workflow/qa/property-dashboard/20-superhost.md` |
| Staging walkthrough | manual script in plan §8                              |
| `ci:quality`        |                                                       |

**Total remaining:** ~6–10 days.

---

## 8. Manual test script (post Phase 2)

1. Seed org with ≥10 completed bookings, ≥3 guest reviews avg ≥4.8, inbox threads with fast replies.
2. Run `reassess-org-superhost` for that org → `earned: true`.
3. Public property page shows Superhost badge.
4. Degrade metric (e.g. add low review) → re-assess → `earned: false` → badge hidden.

---

## 9. Docs checklist

| Doc                                                     | Status                              |
| ------------------------------------------------------- | ----------------------------------- |
| `docs/workflow/planned/superhost-program.md`            | This file                           |
| `docs/guides/routes/org/property/settings.md`           | Updated — no Superhost settings     |
| `docs/guides/routes/org/settings.md`                    | Updated — Trust section             |
| `docs/architecture/edge-functions.md`                   | Updated — Superhost endpoints       |
| `docs/architecture/data-model.md`                       | Updated — org JSONB + inbox metrics |
| `docs/PROJECT.md`                                       | Pending — cross-link only           |
| `docs/archive/operations/scheduled-jobs-and-testing.md` | Updated — assessment cron           |
| `docs/workflow/qa/property-dashboard/20-superhost.md`   | QA checklist                        |

---

## 10. Related

- Public badge UI: `PropertyOverview.tsx`, `ListingHostCard.tsx`
- External reviews (separate): property settings Guest rewards
- Host verification tiers (separate): Verified / Recommended badges

---

_Last updated: 2026-08-31. Phases 0–4 shipped; run QA + deploy to dev when ready._
