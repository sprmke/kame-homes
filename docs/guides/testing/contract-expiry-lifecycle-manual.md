---
title: 'Contract expiry lifecycle — manual test flows'
status: active
tags: [guides, testing, contract-expiry]
updated: 2026-08-17
---

# Contract expiry lifecycle — step-by-step manual testing

Manual E2E for **sublessee / Auth Rep contract end** (notices, grace, consideration, lock, Super Admin grant/deny). Issue: GitHub [#120](https://github.com/sprmke/kame-homes/issues/120).

**Implementation plan:** [`docs/workflow/done/unit-handoff-phase-b.md`](../../workflow/done/unit-handoff-phase-b.md)  
**Depends on:** ACTIVE tower+unit uniqueness already working.  
**Timezone:** all day math is **Asia/Manila**. Use calendar dates as `YYYY-MM-DD`.

---

## 0. What you are proving

| #   | Capability                | Pass criteria                                                                                 |
| --- | ------------------------- | --------------------------------------------------------------------------------------------- |
| 1   | Pre-expiry notices        | Owner gets T−15 / T−7 / T−1 emails once each; cron re-run does not double-send                |
| 2   | T+0 archive               | Listing → `INACTIVE` on contract end day; renewal modal; grace dismiss re-opens after refresh |
| 3   | Grace consideration       | Owner uploads proof + note + date → pending; non-owner cannot submit                          |
| 4   | SA grant                  | Temp `ACTIVE` until `grantedUntil` ≤ 14d; banner shows grant; Approvals badge clears          |
| 5   | SA deny / changes         | Status updates; host cannot stack a second self-serve in same cycle                           |
| 6   | Phase A conflict on grant | Grant blocked with clear error when another ACTIVE peer holds tower+unit                      |
| 7   | T+5 lock                  | All members see lock screen; owner must full renew (unless SA override)                       |
| 8   | Grant expiry              | After `grantedUntil`, cron revokes access / locks as designed                                 |
| 9   | Full renew                | New contract end + SA approve clears consideration + notice markers                           |
| 10  | Parking leg               | Same lifecycle independently of property leg                                                  |
| 11  | Mobile 375px              | Banner, form, Approvals Grant/Deny usable at iPhone SE width                                  |

---

## 1. Prerequisites

### 1.1 Local stack

```bash
./dev.sh
# If functions return 503: stop leftover serve, then from repo root:
bun run stop:supabase   # only if you need a clean restart of Docker
./dev.sh                # or: bun run start:supabase && bun run dev:api
```

Confirm cron responds:

```bash
ANON=$(./scripts/dev/bunx --bun supabase@latest status -o env | rg '^ANON_KEY=' | cut -d= -f2- | tr -d '"')
curl -sS -X POST "http://127.0.0.1:54321/functions/v1/contract-expiry-cron" \
  -H "Authorization: Bearer ${ANON}" \
  -H "Content-Type: application/json" \
  -d '{}'
```

Expect JSON like: `{"success":true,"todayYmd":"…","scanned":N,...}`.

Optional secret: if `CONTRACT_EXPIRY_CRON_SECRET` is set in the functions env, add:

`-H "X-Contract-Expiry-Cron-Secret: <same value>"`.

### 1.2 Accounts

| Role                       | Need                                                                                                                                                              |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Org owner**              | Host Google account that owns an org with a property (and optionally parking) verified as **sublessee** or **authorized_representative** with a contract end date |
| **Org member** (non-owner) | Invited member on the same property/parking — for lock + “cannot submit consideration”                                                                            |
| **Super Admin**            | Email in `SUPER_ADMIN_EMAILS` — `/admin/approvals`                                                                                                                |

Resend / Inbucket: local mail often lands in Supabase **Inbucket** (Studio → Emails) when Edge points at local SMTP. Confirm where your `EMAIL_*` env sends before trusting “no email”.

### 1.3 UI surfaces

| Surface                   | URL pattern                                                      |
| ------------------------- | ---------------------------------------------------------------- |
| Property shell (gate)     | `/org/:orgSlug/property/:propertySlug/...`                       |
| Parking shell (gate)      | `/org/:orgSlug/parking/:parkingSlug/...`                         |
| Full renew / verification | Org verification / Get verified flow (same as onboarding proofs) |
| Approvals                 | `/admin/approvals`                                               |

Chrome DevTools → device toolbar → **375×667** (iPhone SE) for mobile checks.

---

## 2. Seed helpers (SQL)

Use **Studio SQL** or `psql` against local DB. Replace `:org_id`, tower/unit as needed.

### 2.1 Find org + verification blob

```sql
select id, name, settings->'verification' as verification
from organizations
order by updated_at desc nulls last
limit 20;
```

Note `propertyContractEndDate` / `parkingContractEndDate`, `propertyRelationship` / parking rights, and any `propertyLifecycle` / `parkingLifecycle`.

### 2.2 Relative dates (Manila “today”)

Pick one target scenario and set **only** the contract end (and clear lifecycle when starting fresh):

| Scenario          | Set `propertyContractEndDate` to                                                            |
| ----------------- | ------------------------------------------------------------------------------------------- |
| Pre-notice T−15   | Manila today **+ 15 days**                                                                  |
| Pre-notice T−7    | today + 7                                                                                   |
| Pre-notice T−1    | today + 1                                                                                   |
| Grace (T+0…T+4)   | today − 0…4 days                                                                            |
| Lock (T+5+)       | today − 5 or more                                                                           |
| Grant-expiry cron | leave end in past; set lifecycle `consideration.status=granted`, `grantedUntil` = yesterday |

Example — put property leg into **grace day T+1** and reset lifecycle:

```sql
-- Adjust org id and the end date literal.
update organizations
set settings = jsonb_set(
  coalesce(settings, '{}'::jsonb),
  '{verification}',
  coalesce(settings->'verification', '{}'::jsonb)
  || jsonb_build_object(
    'propertyContractEndDate', to_char((current_timestamp at time zone 'Asia/Manila')::date - 1, 'YYYY-MM-DD'),
    'propertyLifecycle', jsonb_build_object(
      'noticesSent', '{}'::jsonb,
      'accessLockedAt', null,
      'consideration', jsonb_build_object(
        'status', 'none',
        'note', null,
        'expectedDate', null,
        'grantedUntil', null,
        'proofPaths', '[]'::jsonb,
        'audit', '[]'::jsonb,
        'selfServeUsedThisCycle', false,
        'allowConsiderationOverride', false
      )
    )
  ),
  true
)
where id = ':org_id';
```

Ensure the listing exists and rights need a contract:

- `propertyRelationship` / parking rights ∈ `sublessee` | `authorized_representative`
- At least one property row for that org (status will be flipped by cron / grant)

### 2.3 Force listing ACTIVE before T+0 archive test

```sql
update properties
set status = 'ACTIVE'
where organization_id = ':org_id';
```

### 2.4 Reset after a messy run

Clear lifecycle + set a future end date, set listings `ACTIVE` again, then re-seed the scenario you need.

---

## 3. Flow A — Pre-expiry notices (T−15 / T−7 / T−1)

**Goal:** Cron emails owner and records idempotent milestones.

1. Seed contract end = Manila today **+ 15** (or +7 / +1). Clear `noticesSent`.
2. Ensure owner email is reachable (Inbucket / Resend).
3. `POST contract-expiry-cron` (curl §1.1).
4. **Expect:** response `notices` ≥ 1; org `propertyLifecycle.noticesSent` contains `t_minus_15` (or `t_minus_7` / `t_minus_1`); one owner email for that milestone.
5. Run cron **again**.
6. **Expect:** same milestone not re-sent; `notices` count for that key unchanged (idempotent).
7. Optionally advance end date (or wait / re-seed) for T−7 and T−1 and repeat.

**Fail if:** duplicate emails for the same milestone, or milestone written without email when Resend is configured and should send.

---

## 4. Flow B — T+0 archive + grace UI

**Goal:** On/after end date, listing goes offline; owner sees dismissible renewal modal (`Contract expired — renewal required`).

1. Seed end = Manila **today** (or yesterday within T+0…T+4). Clear lock + consideration. Set property `ACTIVE`.
2. Run `contract-expiry-cron`.
3. **Expect DB:** property `status = INACTIVE`; `noticesSent.t_plus_0_archived` set.
4. Sign in as **owner**. Open org dashboard or the property dashboard.
5. **Expect UI:** renewal modal (not an amber strip). Dismiss hides it while you keep browsing; **full page refresh shows it again** the same Manila day. **Request consideration** and **Submit renewal contract** still work. Children still render (not lock screen).
6. At **375px:** modal + controls readable; no horizontal page scroll; tap targets ≥ 44px on **Request consideration** / **Dismiss**.

**Optional T+3:** seed end = today − 3; run cron; expect grace reminder notice (`t_plus_3`) once.

---

## 5. Flow C — Request consideration (owner)

**Goal:** Upload proof → pending consideration; anti-abuse.

### 5.1 Happy path (owner)

1. Stay in grace (Flow B). As owner, fill:
   - Note (required)
   - Requested access until (date ≤ today + 14 Manila)
   - Proof file (JPEG/PNG/WebP/PDF ≤ 5 MB) — uses `upload-org-verification-asset` with `property_consideration_proof` / `parking_consideration_proof`
2. Click **Request consideration**.
3. **Expect:** toast success; form hides or submit disabled; `consideration.status = pending`; `selfServeUsedThisCycle = true`; `proofPaths` under `org/<orgId>/…`.
4. Open `/admin/approvals` as Super Admin.
5. **Expect:** row shows **Consideration** badge; review dialog shows note / date / proof metadata for that leg.

### 5.2 Non-owner cannot submit

1. Sign in as **member** (not owner) on same listing in grace.
2. **Expect:** grace banner may show, but **no** consideration form / submit.
3. Optional curl with member JWT to `submit-contract-consideration` → **403/deny** (owner-only).

### 5.3 Anti-abuse

| Attempt                                                   | Expect                                        |
| --------------------------------------------------------- | --------------------------------------------- |
| Submit twice in same cycle                                | Second submit **409** / UI form not available |
| `expectedDate` > today + 14                               | Validation error                              |
| Empty note or no file                                     | Submit disabled / 400                         |
| Outside grace (before end or after lock without override) | Submit rejected                               |

---

## 6. Flow D — Super Admin Grant

1. Pending consideration from Flow C.
2. Approvals → open org → **Grant** for the leg (property or parking).
3. Confirm `grantedUntil` (defaults from host `expectedDate`; must be ≤ 14 days).
4. **Expect:**
   - `consideration.status = granted`, `grantedUntil` set, `accessLockedAt` cleared
   - Matching listings for that leg set **`ACTIVE`** (INACTIVE → ACTIVE)
   - Host sees banner: temporary access until `grantedUntil`
   - Property/parking shell usable
5. Mobile 375px: Grant control usable in dialog; no clipped primary actions.

---

## 7. Flow E — Deny and Request changes

### 7.1 Deny

1. Fresh pending consideration (re-seed grace + reset `selfServeUsedThisCycle` **only if** testing deny after a clean submit — or use a second org).
2. SA **Deny** with optional note.
3. **Expect:** `status = denied`; listings stay / return offline as designed; host **cannot** self-serve again this cycle; full renew still available path for owner.

### 7.2 Changes

1. Pending → SA **Changes** (or request changes).
2. **Expect:** `status = changes`; host must follow product path (re-submit only if product allows — current anti-abuse: self-serve already used; typically **full renew** or SA `allowConsiderationOverride`).

Document actual UI labels from Approvals dialog while testing.

---

## 8. Flow F — Grant blocked by Phase A conflict

1. Org A: pending consideration for property leg; tower+unit `X-Y`.
2. Org B: **ACTIVE** property with same tower+unit (Phase A peer).
3. SA Grant on Org A.
4. **Expect:** **409** / error naming the conflicting org; Org A listings **not** activated; consideration remains pending (or unchanged grant).
5. Archive / change Org B conflict → Grant on Org A succeeds.

---

## 9. Flow G — T+5 listing lock

1. Seed end = Manila today − **5** (or more). Clear grant. Ensure cron can set lock (`accessLockedAt` / `t_plus_5_locked`).
2. Run cron.
3. **Expect:** `accessLockedAt` set; property/parking shell shows **lock** screen for **owner and member**.
4. Owner copy: renew via full contract renewal for Super Admin review.
5. Member: contact owner.
6. **Expect:** no consideration form unless SA set `allowConsiderationOverride` (test override separately if used in Approvals).

At 375px: lock screen centered, readable, no overflow.

---

## 10. Flow H — Grant expiry (cron)

1. Seed / set lifecycle:
   - `consideration.status = granted`
   - `grantedUntil` = Manila **yesterday**
   - listing `ACTIVE`
2. Run `contract-expiry-cron`.
3. **Expect:** grant expired milestone; listing back to offline / locked per design (`grant_expired`); host no longer sees “temporary access until …” as active grant.

---

## 11. Flow I — Full renew clears lifecycle

1. From grace or lock, owner submits **full verification renew** with a **new** future `propertyContractEndDate` (and proofs as required).
2. SA **Approve** base verification (normal Approvals approve — not consideration grant).
3. **Expect:** consideration reset (`none`), notice markers cleared for new cycle; listing ACTIVE when uniqueness allows; contract-expiry cron starts fresh against the new end date.

---

## 12. Flow J — Parking leg (independent)

Repeat Flows B–G using:

- `parkingContractEndDate` + `parkingLifecycle`
- Parking shell routes
- `leg: "parking"` in submit/decide
- Upload asset type `parking_consideration_proof`

**Expect:** property leg state unchanged when only parking expires (and vice versa).

---

## 13. Mobile checklist (375px) — every UI flow

- [ ] No horizontal scroll on property/parking shell with grace banner
- [ ] Consideration fields stack full width; date + file + button ≥ 44px tall
- [ ] Lock screen usable without zoom
- [ ] `/admin/approvals` table scrolls horizontally inside wrapper if needed; Review + Grant/Deny reachable
- [ ] Toasts readable; no clipped primary CTA

Also spot-check **768** and **1024** once per major surface (banner + Approvals dialog).

---

## 14. API quick reference (local)

### Cron

```bash
curl -sS -X POST "http://127.0.0.1:54321/functions/v1/contract-expiry-cron" \
  -H "Authorization: Bearer ${ANON}" \
  -H "Content-Type: application/json" \
  -d '{}'
```

### Submit consideration (owner JWT)

```bash
curl -sS -X POST "http://127.0.0.1:54321/functions/v1/submit-contract-consideration" \
  -H "Authorization: Bearer ${OWNER_JWT}" \
  -H "Content-Type: application/json" \
  -d '{
    "orgId":"<uuid>",
    "leg":"property",
    "note":"Lease extension pending notarization",
    "expectedDate":"YYYY-MM-DD",
    "proofPaths":["org/<uuid>/property_consideration_proof/<file>.pdf"]
  }'
```

### Decide (super-admin JWT)

```bash
curl -sS -X POST "http://127.0.0.1:54321/functions/v1/decide-contract-consideration" \
  -H "Authorization: Bearer ${SUPER_ADMIN_JWT}" \
  -H "Content-Type: application/json" \
  -d '{
    "orgId":"<uuid>",
    "leg":"property",
    "decision":"grant",
    "grantedUntil":"YYYY-MM-DD",
    "note":"OK for two weeks"
  }'
```

`decision`: `grant` | `deny` | `changes`. Optional `allowConsiderationOverride: true` for SA second-chance after lock.

### Upload proof (multipart)

```bash
curl -sS -X POST "http://127.0.0.1:54321/functions/v1/upload-org-verification-asset" \
  -H "Authorization: Bearer ${OWNER_JWT}" \
  -F "orgId=<uuid>" \
  -F "assetType=property_consideration_proof" \
  -F "file=@./proof.pdf" \
  -F "fileName=proof.pdf"
```

---

## 15. Implementation map (for debugging)

| Area                    | Path                                                                                                  |
| ----------------------- | ----------------------------------------------------------------------------------------------------- |
| Lifecycle helpers       | `supabase/functions/_shared/contractLifecycle.ts`                                                     |
| Cron runner             | `supabase/functions/_shared/contractExpiryCron.ts`                                                    |
| Cron entry              | `supabase/functions/contract-expiry-cron/`                                                            |
| Submit                  | `supabase/functions/submit-contract-consideration/`                                                   |
| Decide                  | `supabase/functions/decide-contract-consideration/`                                                   |
| Proof upload types      | `upload-org-verification-asset` (`*_consideration_proof`)                                             |
| Host renewal UI         | `ui/.../listing-authorization/ListingContractRenewalProvider.tsx` + `ListingContractRenewalModal.tsx` |
| Approvals UI            | `docs/guides/routes/admin/approvals.md` + Approvals pages                                             |
| Hosted schedule snippet | `supabase/snippets/contract-expiry-cron.sql`                                                          |
| Ops notes               | `docs/archive/operations/scheduled-jobs-and-testing.md`                                               |

---

## 16. Sign-off sheet

Copy into the issue or PR when done:

```text
Contract expiry lifecycle E2E — date: ____  tester: ____  env: local / staging

[ ] A Notices T−15/T−7/T−1 + idempotent re-run
[ ] B T+0 archive + grace banner
[ ] C Consideration submit (owner) + non-owner blocked + anti-abuse
[ ] D SA Grant ≤14d + ACTIVE + host banner
[ ] E Deny / changes
[ ] F Phase A conflict blocks grant
[ ] G T+5 lock (owner + member) @ 375px
[ ] H Grant expiry cron
[ ] I Full renew clears lifecycle
[ ] J Parking leg independent
[ ] Mobile 375px checklist

Blockers / notes:
____
```

When all boxes pass, move the plan with the workflow helper to `docs/workflow/done/` and ship [#120](https://github.com/sprmke/kame-homes/issues/120) per `github-issues` skill.
