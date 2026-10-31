---
title: 'QA — Property Finance'
status: active
updated: 2026-08-29
---

# 04 — Finance

Route: `/org/:orgSlug/property/:propertySlug/finance`

## Looks good

- Title OK; summary cards + charts + unified ledger match guide.
- Export gated `financeReporting` (Starter+) + `finance.export:view`.
- Stays auto-appear — host does not double-enter booking income.

## Issues

| Sev | Issue                                                                                                                         | Evidence                                 |
| --- | ----------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| P2  | Operations template has **no** `finance:view` — correct for security, but day-to-day ops staff cannot see dues they might pay | `SEEDED_TEMPLATE_PERMISSIONS.OPERATIONS` |
| P3  | Calendar view of finance may confuse hosts expecting Pricing calendar                                                         | UX                                       |

## Improvements

- Optional “Ops can view finance read-only” preset variant.
- Link unpaid guest balances from Needs attention straight into settlement on booking detail.

## Doc gaps

- Guide current (2026-08-26).

## Evidence

Live load title + page; code permissions; guide `finance.md`.
