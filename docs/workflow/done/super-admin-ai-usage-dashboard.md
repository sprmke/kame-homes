---
stage: done
title: 'Super Admin AI usage & cost dashboard'
status: in-progress
tags: [planning, planned-modules, super-admin, admin, ai, cost]
updated: 2026-09-06
---

## Status (2026-09-05)

**Shipped.** `super-admin-ai-usage` edge fn + `/admin/ai-usage` page — spend trend, cost-by-feature, top-25-orgs table with quota-breach flags, 30d/90d/12mo range toggle. Verified against real local data. Each org row links to that org's hub **AI credits** section.

**Remaining:** per-org drill-down page; nothing else from the original sketch is outstanding.

---

# Super Admin AI usage & cost dashboard

**Spun out of** [`super-admin-console-overhaul.md`](./super-admin-console-overhaul.md) Phase 6.

## Problem

`ai-platform-usage` edge function exists but **no page renders it**. The Overview dashboard shows
total AI spend + cost-by-feature, but there's no per-org drill-down, trend, or quota-breach view.
AI is the platform's biggest variable cost — it needs a dedicated console.

## Approach

- **Route** `/admin/ai-usage` (Platform nav group), shared console scaffold.
- **Edge fn** `super-admin-ai-usage` (`serveSuperAdmin`, `?range=30d|90d|12mo`):
  - `dailySeries` — platform daily spend + call count from `ai_platform_usage_daily`.
  - `byFeature` — cost + calls per feature from `ai_platform_usage_events` (capped fetch, bucketed).
  - `byOrg` — top N orgs by spend, each with call count + wallet balance + whether over daily /
    monthly allowance (`ai_platform_org_settings` vs `ai_platform_usage_daily`).
  - `quotaBreaches` — orgs currently over allowance.
- **UI**: spend trend area chart, feature bar, a top-orgs table (link each row to the org hub's
  **AI credits** section), a "quota breaches" attention list.

## Phasing

- P1: `super-admin-ai-usage` edge fn + `useSuperAdminAiUsage` hook.
- P2: page + charts (reuse the `super-admin-overview` chart components) + top-orgs table.
- P3: nav entry + route guide + `edge-functions.md`.

## Notes

- Reuse `_shared` AI cost helpers if present; otherwise sum `estimated_cost_usd` directly.
- Cross-link: Overview "AI spend" KPI → this page; this page's org rows → org hub AI section.
