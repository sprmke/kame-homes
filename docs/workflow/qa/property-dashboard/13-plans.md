---
title: 'QA — Property Plans & Billing'
status: active
updated: 2026-08-29
---

# 13 — Plans & Billing (property mirror)

Route: `/org/:orgSlug/property/:propertySlug/plans`

## Looks good

- Same UI as org Plans; payment continues at org scope — correct for org-level billing.
- Feature compare matrix groups follow property sidebar order.
- Suspended orgs keep Plans + Help accessible (`RequirePropertySubscriptionAccess`).

## Issues

| Sev | Issue                                                                                                                    | Evidence                               |
| --- | ------------------------------------------------------------------------------------------------------------------------ | -------------------------------------- |
| P2  | Property nav “Plans & Billing” may imply per-property pricing — hosts with many units need clearer “this is org billing” | Host lens; org-level billing migration |
| P3  | Local seed all Free — hard to demo upgrade UX without SQL                                                                | QA env                                 |

## Improvements

- Property Plans header: “Organization plan · N properties enrolled”.
- Demo script: seed one org on each tier for QA.

## Doc gaps

- Points to `org/plans.md` — ensure property route README stays linked.

## Evidence

Live Plans title; `RequirePropertySubscriptionAccess`; matrix.
