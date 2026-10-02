---
title: 'Super Admin AI console: operator guide'
status: active
tags: [guides, routes, admin, ai]
updated: 2026-10-02
---

# Super Admin AI console

Route: `/admin/ai` with `?tab=usage|limits|profiles|wallets|controls`. Legacy `/admin/ai-usage` and `/admin/settings` redirect here. Component: `pages/SuperAdminAiPage.tsx`; tabs in `components/super-admin-ai/`.

> **Status:** Shipped. Plan: [`ai-settings-super-admin-ownership`](../../../workflow/done/ai-settings-super-admin-ownership.md).

Hosts can only turn AI on or off and read their usage. **Every numeric AI limit is set here.** Changes apply within a few seconds: limits are memoized for 5 seconds per edge instance and the writing instance clears its memo immediately.

## Tabs

| Tab      | What it does                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Usage    | One view for every AI feature. Spend and credits totals, spend trend, cost by feature, feature health (calls, credits, errors, cache hit rate, fallback, latency). **Usage by plan**: orgs on each plan (active / total), credits and spend in range, this month's credits against the plan allowance, and how many orgs hit their allowance. **Marketing Studio jobs**: image and video jobs by tier and resolution with success rate, failed, blocked, credits, spend and render time, failure reasons, and an **unbilled** badge when a finished job still has no charge after 10 minutes (the sweeper retries billing). Top organizations (profile / override badges), quota breaches, projected month-end spend. Read-only; hosts never see this tab. Assistant feedback (thumbs) and **Assistant evals**: the latest recorded golden eval run per module (pass bars, failed case ids, tools per turn) plus earlier runs. Record with `bun run eval:ai -- --suite assistant --routed --record`. |
| Limits   | One row per organization with resolved limits, usage and flags (At limit, Override, AI off). Filter by plan, profile, status. Select many rows to assign a profile or set overrides in one action. Click a row for detail.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| Profiles | Create, edit, delete limit profiles. Each shows how many orgs it affects and their last-30-day spend. Bind profiles to plans and assign them to developments.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| Wallets  | Credit wallet balance, ledger and manual adjustment per organization.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| Controls | Platform AI kill switch, enforce-quotas, feature allowlist, default limits, and the dashboard assistant kill switch.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |

## How a limit is resolved

Most specific wins; a blank value inherits the next layer.

- **Organization scope:** override, organization profile, plan profile, plan credit allowance (monthly credits only), default profile, platform defaults.
- **Property scope:** override, property profile, development profile, then the organization chain. Development match uses the property's `residence_name` against the development name.

The org detail sheet shows every resolved number with a badge for its source (Override, profile code, Plan allowance, Platform default).

## Limit fields

Calls (daily, monthly), daily cost USD, credits (daily, monthly), assistant messages (daily, monthly) and daily write actions, voice max session seconds / sessions per guest per day / concurrent sessions, image and video monthly credit caps (blank = 60% of the org allowance).

## Common tasks

- **Change a plan's budget:** Profiles tab, edit the plan's profile. The dialog shows affected orgs and spend before you save.
- **Give one org a special limit:** Limits tab, open the org, Overrides. A reason is required and is shown as an Override flag.
- **Move many orgs at once:** Limits tab, select rows, Assign profile.
- **Reset an org to its plan:** Overrides, Clear overrides.
- **Tune a development:** Profiles tab, Developments, pick a profile.
- **Delete a profile:** only when nothing is assigned or bound to a plan; the default profile cannot be deleted.

## Save path and safety

`POST super-admin-ai-limits` with `action` = `create_profile`, `update_profile`, `delete_profile`, `assign`, `set_overrides`, `set_plan_profile`. Every POST needs the super-admin step-up code (`ai_limits`). Batches are capped at 200 targets. Each change writes a `super_admin_audit_events` row and mirrors an `ai.limits_changed` activity row into each affected organization's feed. Reads: `GET ?view=matrix|profiles|org`.

## Testing

| Layer                                              | Where                                                                   |
| -------------------------------------------------- | ----------------------------------------------------------------------- |
| Aggregation (usage by plan, Marketing Studio jobs) | `supabase/functions/_shared/aiUsageConsoleSummary_test.ts`              |
| Console tabs (limits, profiles, usage, redirects)  | `ui/e2e/features/admin/adminAiConsole.spec.ts` (`@ci`, limits `@smoke`) |

## Related

- [Org settings](../org/settings.md), [Property settings](../org/property/settings.md): the host toggle and usage panels.
- [`docs/architecture/ai-platform.md`](../../../architecture/ai-platform.md) section 5.

**Unsaved changes.** Leaving with unsaved edits (another menu item, browser back, closing the tab) asks to **Save & leave**, **Discard**, or **Keep editing**. Save & leave runs the same validation as Save and stays on the page if it fails. Shared guard: [`unsaved-changes.md`](../../../architecture/unsaved-changes.md).
