---
title: "Won't do"
status: active
tags: [workflow, wont-do]
updated: 2026-08-19
stage: wont-do
kind: reference
---

# Won't do

Explicit **cancelled** or **rejected** plans — kept for history, not implementation.

| Doc                                                                                    | Reason                                                                                                                                                             |
| -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [`dashboard-ground-up-redesign.md`](./dashboard-ground-up-redesign.md)                 | Cancelled; incremental dashboard polish only — no dedicated ground-up pass scoped from public pages                                                                |
| [`dashboard-top-header-bar.md`](./dashboard-top-header-bar.md)                         | Profile, theme toggle, and mode switch stay in sidebar footer                                                                                                      |
| [`listing-authorization.md`](./listing-authorization.md)                               | Never started; superseded by [`../done/verification-scope-split.md`](../done/verification-scope-split.md)                                                          |
| [`google-oauth-verification.md`](./google-oauth-verification.md)                       | Gmail CASA / OAuth verification pivot — superseded by Resend inbound approvals ([`remove-google-calendar-sheets.md`](../done/remove-google-calendar-sheets.md))    |
| [`property-public-pages-shell-redesign.md`](./property-public-pages-shell-redesign.md) | Never started; superseded by [`../done/page-editor-public-pages.md`](../done/page-editor-public-pages.md), which owns `PropertyDetailPage.tsx` section-config work |

Move plans here with **`/workflow-wont-do`** or `bash scripts/dev/workflow-move.sh wont-do <slug>`. Scratchpad item → **❌** + `→ **Won't do:**` link (sync runs automatically).

Scratchpad-only cancellations (never had a plan doc) can stay **❌** in `_to-prompt.md` / `_to-plan.md` only, or add a minimal doc here for consistency.

Back to [workflow index](../README.md).
