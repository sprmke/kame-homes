---
stage: done
title: 'AI Dashboard Assistant v2 — Full Dashboard Coverage'
status: All 8 phases shipped (architecture fixes, external-action risk tier, org & team, property settings, parking, pricing, guest inbox, marketing). 64 tools total. Full tool-by-tool reference lives at docs/architecture/ai-dashboard-assistant.md — keep both in sync going forward.
tags: [planning, planned-modules, ai]
updated: 2026-08-17
---

# AI Dashboard Assistant v2 — Full Dashboard Coverage

## Context

The v1 assistant ([`../done/ai-dashboard-assistant.md`](../done/ai-dashboard-assistant.md)) shipped with 13 tools covering only bookings, finance, and maintenance — all read-only except booking transitions, cancellation, and receipt re-validation. The goal now is for the assistant to have knowledge of and executable access to everything a host can see or do across the dashboard: org/team, property settings, parking, pricing, guest inbox, and marketing — so a host can manage the app "with just a chat," with the chat proactively helping rather than only answering the literal question asked.

This plan was produced by a full-repo audit (4 parallel research passes: org/team/property, parking/pricing, inbox/marketing, and the assistant's own architecture) with **no code written**, per the project's plan-first convention for changes this size. It is a **phased backlog**, not a single PR — each phase is independently shippable and should get its own implementation pass, its own manual-test-guide update, and its own `git` history entry. Do not build phases out of order; later phases assume earlier phases' scaffolding (esp. the new external-action risk tier from Phase 2 gates Phases 5–6).

## Guiding principles (do not re-litigate during implementation)

1. **Every existing v1 safety mechanism carries forward unchanged**: per-tool independent RBAC re-check against the original JWT (never trust the model's arguments), Tier 0/1/2 classification computed server-side, Tier 2 actions never execute inline (propose → separate confirm call), audit log on every executed action, two-layer kill switch, quota. New tools plug into this, they don't bypass it.
2. **A fixed "never auto-expose" list exists and is enforced at the tool-catalog level, not just by prompt instruction** — irreversible or maximally-destructive actions are simply never registered as callable tools, the same way `sync_booking_integrations` was omitted in v1 for having no backend. See "Explicitly excluded" below.
3. **External-facing actions are a new, stricter risk category than internal DB writes.** v1's `dashboardAssistantRiskClassifier.ts` only understands the booking-status transition graph. Sending a message to a real guest (`social-inbox-send`) or publishing to a real social account (`publish-to-meta`) is categorically riskier than an internal status change — reputational, irreversible, externally visible. These need new classification logic (Phase 2), not just a new tool registration, before Phase 5/6 tools can exist.
4. **Modules without granular RBAC permission strings get that RBAC built first.** Marketing Studio currently has no `marketing:*` permission — only "is an authenticated admin for this property." Do not expose marketing write tools until that gap is closed (Phase 6 prerequisite), otherwise the assistant would grant capability beyond what the team-permissions UI can even express.
5. **Proactive suggestions stay grounded, never pushy or speculative** — Phase 1 adds a "suggested next step" affordance, but the model still may never claim an action succeeded without a tool result, never invent data, and suggestions must be data-derived (e.g. "3 bookings are stuck in PENDING_DOCUMENTS — want me to check what's blocking them?"), not generic filler.

## Phase 0 — already shipped this session

- `get_available_dates(propertyId, from?, to?)` — Tier 0 read tool wrapping the same booked/blocked-date computation the guest calendar uses (`_shared/propertyBlockedDates.ts`). Closes the "what dates are available" gap.
- Conversation-history browsing UI (`ConversationHistoryList.tsx` + panel history toggle) — the backend already supported it, just wasn't wired into the panel.
- Panel header overlap fix, org-settings card styling fix (unrelated small bugs found along the way).

## Phase 1 — Architecture fixes (small, high-value, do first) — shipped this session

Shipped: today's-date + requester-name grounding facts, `sync:ai-knowledge-base` script wired + run locally (224 entries loaded), `propose_add_finance_line_item` / `propose_create_maintenance_item`. **Not shipped**: graceful `MAX_TOOL_ROUNDS` exhaustion (on inspection, the existing fallback already re-synthesizes from accumulated tool results rather than always showing the canned message — lower priority than believed, left as-is) and the `suggested_actions` block type (skipped — a parallel session added a different starter-prompt UI in the same files; revisit only if that doesn't cover the need).

These are cheap fixes to the _existing_ assistant that make every later phase better, independent of new modules:

| Fix                                                                                      | Why                                                                                                                                                                                                                                                                               | File(s)                                                                                                              |
| ---------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Inject explicit "today is `<date>`, timezone Asia/Manila" into the grounding prompt text | `manilaTodayIso()` is imported/used internally but never surfaced as text the model can anchor relative-date reasoning to ("this weekend", "next month")                                                                                                                          | `_shared/dashboardAssistantContext.ts`                                                                               |
| Inject the requesting user's name/role into grounding facts                              | Currently only a flat `permissions: string[]` — no human identity, so the assistant can't personalize ("Hi Sam") or reason about "did I approve that"                                                                                                                             | `_shared/dashboardAssistantContext.ts`                                                                               |
| Graceful `MAX_TOOL_ROUNDS` (4) exhaustion                                                | Currently falls back to a canned "ask again" message, discarding any partial tool results already gathered — should summarize what it found so far instead                                                                                                                        | `dashboard-assistant-chat/index.ts`                                                                                  |
| Wire `scripts/sync-ai-knowledge-base.ts` into an actual trigger                          | Script exists and correctly parses `docs/guides/routes/**/*.md` "Host-facing knowledge" sections, but nothing runs it — the knowledge base is very likely empty/stale today, silently degrading `search_knowledge_base`                                                           | add a `package.json` script + either a CI step on docs changes or a documented manual step in the release checklist  |
| Add `propose_add_finance_line_item` / `propose_create_maintenance_item` (Tier 2)         | `finance-line-items`/`maintenance-items` already have full CRUD backends; only the GET side is wrapped today. Natural, already-scaffolded extension of the existing `propose_*` pattern                                                                                           | `_shared/dashboardAssistantTools.ts`                                                                                 |
| New `suggested_actions` `ChatBlock` type + light system-prompt instruction               | No proactive-suggestion pattern exists at all today — purely reactive. Add a block type distinct from `action_confirmation` (informational nudge, not a pending mutation) so the model can surface "3 bookings need attention" without it being confused for an executable action | `aiAssistantApi.ts` (`ChatBlock` union), new `SuggestedActionsBlock.tsx`, `dashboard-assistant-chat/index.ts` prompt |

## Phase 2 — New risk category: external-facing actions — scaffold shipped this session

Shipped: `EXTERNAL_SEND_TOOL_NAMES` set + `isExternalSendTool()` in `dashboardAssistantRiskClassifier.ts`, currently empty (no external-send tools exist yet — Phase 5/6 not started). **Not shipped**: distinct confirm-UI copy and a stricter per-day external-send quota — deliberately deferred until a real tool is added to the set, per "don't build for hypothetical future requirements"; wire both when Phase 5 or 6 actually adds the first entry.

Prerequisite for Phase 5 (Inbox) and Phase 6 (Marketing). Extend `_shared/dashboardAssistantRiskClassifier.ts` with a distinct classification path (not reusing the booking-status-graph logic) for actions that are:

- Externally visible to a guest or the public (not just internal DB state), and
- Irreversible once sent/published.

Concretely: add an `external_send` risk dimension that is **always** Tier 2 regardless of any other heuristic, with its own confirmation copy in the UI ("This will send a real message to the guest" / "This will publish to your public Instagram") distinct from the existing generic `action_confirmation` copy — hosts need to viscerally understand this is not an internal-only undo-able action. Consider a stricter per-day cap on external-send Tier-2 confirmations specifically (independent of the general message quota) so a confused or adversarial confirm-click spree can't spam guests or a public feed.

## Phase 3 — Org & Team — shipped this session

Shipped exactly as scoped below, except `get_org_dashboard_stats` (already covered by v1's `get_dashboard_stats`, which is org-wide when no `propertyId` is given — no separate tool needed) and `propose_submit_org_verification` (skipped — the real `submit-org-verification` endpoint has too many interdependent preconditions — social-proof platform, ownership-relationship enum, contract end dates, pre-uploaded ID/ownership-proof assets — for a chat tool to fill correctly; flagged as needing dedicated design review, not a v2 tool). `update-organization`'s patch logic was extracted into a new shared `_shared/orgProfileService.ts` (used by both the edge function and `propose_update_org_profile`) so slug-conflict/settings-merge behavior can't drift between the two callers.

Read tools (Tier 0): `get_org_profile`, `get_org_verification_status`, `list_team_members`, `list_pending_invitations`.

Write tools:

- `propose_update_org_profile` (name/description/logo/tagline/brandColor/contact) — **reclassified Tier 1 → Tier 2 on 2026-08-17** (post-ship review pass): its patch fields include `contactName`/`contactPhone`/`contactEmail`, which feed guest-facing communication — a silently auto-executed change could redirect guest inquiries to an attacker's contact info. See `docs/architecture/ai-dashboard-assistant.md` §3.2 for the full rationale. RBAC: `org.settings.basic:edit` (same leaf as `update-organization` / Settings → Basic information).
- `propose_invite_team_member` — **Tier 2** (creates a new principal with access, sends an email).
- `propose_update_team_member_role` — **Tier 2** (changes someone's access level).
- `propose_revoke_invitation` — **Tier 1** (undoing an unaccepted invite is low-risk).
- `propose_remove_team_member` — **Tier 2**, high blast radius (revokes a real person's access).
- `propose_submit_org_verification` — **Tier 2** (kicks off an external review, uploads docs).

RBAC: granular org hub leaves (`org.settings.*`, `org.team.*`, … — catalog: `_shared/orgTeamPermissions.ts`). Legacy coarse ids expand at read time but assistant tool re-checks use leaves only (D14).

## Phase 4 — Property settings — shipped this session (scoped down from the original plan, then extended per explicit host request)

Shipped: `get_property_profile`, `get_property_settings`, `list_property_team_members`, `list_property_pending_invitations` (read); `propose_update_property_profile`, `propose_update_property_settings`, `propose_invite_property_team_member`, `propose_update_property_team_member_role`, `propose_revoke_property_invitation`, `propose_remove_property_team_member` (write). `update-property`'s top-level-field patch logic (name/address/maxGuests/status/tower/unit) was extracted into a new shared `_shared/propertyProfileService.ts`, mirroring the Phase 3 org-profile refactor.

**Settings-blob editing** (`propose_update_property_settings`) was added in a follow-up round after the host explicitly asked for the assistant to be able to edit property settings, with the constraint that sensitive/critical edits must always require confirmation. Rather than a blanket pass-through of `properties.settings` (which would let the model write into fields with no server-side validation), the tool is allowlisted to exactly the sub-fields `validatePropertySettingsPatch` actually checks: `contactName`/`contactPhone`/`contactEmail`, `bedrooms`/`bathrooms`/`floors`/`maxAdults`/`maxChildren`, `description`, `customHouseRules`, `customAmenities`, `cancellationPolicy`. It's registered in `TIER2_ONLY_TOOL_NAMES` — **always** requires host confirmation, never auto-executed, regardless of how small the change looks. (`propose_update_property_profile` was originally Tier 1 for its narrower top-level fields — no contact info in that one — but was also reclassified to Tier 2 on 2026-08-17 for the separate reason that `status` toggling ACTIVE/INACTIVE has real operational impact; see `docs/architecture/ai-dashboard-assistant.md` §3.3.) `applyPropertySettingsPatch` (new, in `propertyProfileService.ts`) is the single source of truth for this allowlist + validation; `update-property/index.ts` was intentionally **not** refactored to call it, since the real endpoint also handles `media` (binary/URL array with its own validator) which stays out of the chat tool's allowlist entirely — both call the same underlying `validatePropertySettingsPatch`, so there's no validation drift on the fields they share.

**Still out of scope, unchanged from the original narrowing**: GAF/pet doc requirements, email automation toggles, and payment methods — no dedicated validator was found for these under `properties.settings` in this codebase (unlike the fields above, which do have one), so there's nothing safe to validate a chat-driven write against yet; exposing them needs that validator built first, not just a tool wrapper. `propose_update_property_templates_settings` also stays skipped — template content is long-form legal/compliance document text (GAF/pet forms), a bad fit for chat editing at any risk tier.

RBAC: `settings:view`/`settings:edit`, `team:view`/`team:invite`/`team:manage` (catalog: `_shared/propertyTeamPermissions.ts`, `TEAM_API_PERMISSIONS`); settings/profile writes are additionally owner-gated via `verifyPropertyOwner`, matching `update-property`'s real constraint.

## Phase 5 — Parking — shipped this session (scoped down from the original plan)

Shipped: `list_parkings`, `get_parking_booking`, `list_parking_bookings`, `get_parking_available_transitions` (read); `propose_claim_parking_booking`, `propose_decline_parking_booking`, `propose_transition_parking_booking` (write, **all Tier 2**, registered directly in `TIER2_ONLY_TOOL_NAMES`). `claim-parking-booking`/`decline-parking-booking`'s core logic — including the safety-critical guarded `.eq('status', 'PENDING_HOST_ACCEPTANCE')` first-Accept-wins UPDATE — was extracted into a new shared `_shared/parkingBroadcastActions.ts`, and **both real edge functions were refactored to call it too**, so there is exactly one implementation of that race guard, not two that could drift.

**Narrowed from the original scope**: "parking slot settings/pricing snapshot" as a read tool was dropped — `parking-settings` surfaces GCash number and payment methods, the same financially-sensitive, no-dedicated-validator category excluded from property settings (Phase 4). Parking pricing (rates, holiday rules) stays entirely in Phase 6, not pulled forward.

RBAC: `verifyParkingTeamAccess` with `ParkingTeamPermissionId`s `bookings:view`/`bookings:edit`; `org:parkings:view` for the org-wide slot list.

**Explicitly excluded**: re-triggering `submit-parking-booking-request` or any broadcast fan-out — mass-notifying spot owners is a distinct, higher-blast-radius action category that needs its own design pass, not a Tier 2 checkbox.

## Phase 6 — Pricing — shipped this session

Shipped: `get_property_pricing`, `get_parking_pricing` (read, capped at 30 overrides/blocks each — not a full calendar dump); `propose_update_property_base_rate`, `propose_set_property_date_rate_override`, `propose_add_property_holiday_rule`, `propose_block_property_dates`, `propose_unblock_property_dates`, `propose_update_parking_base_rate`, `propose_set_parking_date_rate_override` (write, **all Tier 2**, registered directly in `TIER2_ONLY_TOOL_NAMES`, all single-target).

**Important discovery while implementing**: `savePropertyPricing`/`saveParkingPricing`'s `dateOverrides` and `holidayRules` patch fields are a **full replace of the stored map/array in the underlying service, not a merge** — naively passing `{dateOverrides: {"2026-12-31": 8000}}` would have silently deleted every other date override the host had ever configured. Every override/holiday-rule tool reads the current value first and writes back the merged result, never just the one new entry. This wasn't in the original plan's risk list because it required reading `propertyPricing.ts`'s implementation directly, not just its public patch type — a reminder that "single-target write" at the API-call level doesn't automatically mean "single-target write" at the storage level.

**Explicitly excluded, confirmed while building, not just planned**: any bulk/range rate mutation in one call (e.g. "raise all December weekends 20%") — every tool here is deliberately single-date/single-rule/≤62-day-range. If bulk pricing tools are wanted later, they need an explicit diff/preview step shown to the host before any multi-date write, which is a separate design effort, not a v2 tool.

## Phase 7 — Guest Inbox — shipped this session

Shipped: `list_inbox_threads`, `get_inbox_thread`, `get_inbox_settings` (read-only, no write counterpart), `list_inbox_quick_reply_templates`, `draft_inbox_reply` (read tools — `draft_inbox_reply` classified Tier 0 since it never writes to the DB, despite needing `inbox:reply`); `propose_mark_inbox_thread_read` (Tier 1) and `propose_send_inbox_reply` (**Tier 2, and the first real `EXTERNAL_SEND_TOOL_NAMES` member** — Phase 2's scaffold finally has a tool using it).

**Phase 2's confirm-UI promise was built for real this time**: `ChatBlock`'s `action_confirmation` variant gained an `isExternalSend?: boolean` field, set by `dashboard-assistant-chat/index.ts` via `isExternalSendTool()`; `ActionConfirmationBlock.tsx` now renders a destructive-tinted card, an explicit "sends a real message... can't be undone" line, and a destructive "Send" button instead of "Confirm" whenever that flag is true. This was deliberately deferred at Phase 2 time ("no tool uses it yet, build it when Phase 7/8 adds the first one") — now it's real.

`propose_send_inbox_reply`'s send logic (web / Meta DM / Meta public-comment branches, DM messaging-window check, guest-notification email) was extracted into a new shared `_shared/inboxSendReplyAction.ts` — used only by this tool, **not** shared with the real `social-inbox-send` edge function, which keeps its richer inline implementation (attachments, private replies, reply-to-message threading) since that feature set is intentionally broader than what a single chat tool should attempt from free text.

**Explicitly excluded, confirmed while building**: any tool that flips `auto_reply_mode` to `'send'` — `get_inbox_settings` is read-only, no `propose_update_inbox_settings` tool exists at all. Attachments, private replies, and reply-to-message threading are also out of `propose_send_inbox_reply`'s scope, same narrowing pattern as every other phase's first-cut write tool.

RBAC: `resolveInboxAccess` capability `view`/`reply`/`manage` → `inbox:view`/`inbox:reply`/`inbox:manage`.

## Phase 8 — Marketing Studio — shipped this session (RBAC prerequisite explicitly declined, not built)

The original prerequisite ("add granular `marketing:*` RBAC permission strings before building Phase 8") was presented to the host as a real decision point rather than assumed: build real per-property marketing RBAC first (large, standalone scope — permission catalog, built-in roles, custom-role UI, migrating 6 edge functions), or ship tools gated at today's real boundary. **Decided 2026-08-16: ship at today's boundary.** Every marketing tool calls `verifyAdminJwt(ctx.req)` directly — the same global `ADMIN_ALLOWED_EMAILS` check `serveAdmin` performs — matching the real marketing edge functions' actual current access model exactly rather than inventing a property-scoped permission the endpoints themselves don't enforce. A host who isn't a global admin gets a plain refusal, same as calling the real endpoint or using the real Marketing Studio UI today.

Shipped: `list_marketing_templates`, `get_marketing_publish_history`, `search_marketing_music` (Jamendo, read-only — no import), `draft_marketing_caption`, `draft_marketing_template` (all Tier 0 — pure generation/reads, no persistence); `propose_publish_to_meta` (**Tier 2, external_send** — publishes to a real, public Facebook Page or Instagram account, irreversible, public-facing, reputational; the single highest-blast-radius tool in the whole v2 build). Its core logic was extracted into a new shared `_shared/marketingPublishAction.ts` (used only by this tool — the real `publish-to-meta` endpoint keeps its own richer implementation with Instagram scheduling).

**Narrowed from the original scope**: music _import_/upload (`marketing-music`'s `import-jamendo`/`import-url`/file-upload actions) was left out — fetching from a caller-supplied URL is more exploitable via a prompt-injection-steered chat tool than a human clicking through a UI; only the read-only Jamendo search ships. `suggest_marketing_music` from the original plan became a read tool (`search_marketing_music`), not a write — it doesn't write anything. Template save/delete via chat was also left out — the generated design tokens are meant for a visual canvas editor, not a natural chat-managed object. "Publish history/status" and "template library" reads both shipped as planned; the noted engagement/performance-metrics gap ("how did last week's post perform") remains real and unaddressed — still no endpoint exists to answer it.

## Explicitly excluded — do not build without a dedicated design review, separate from this plan

- `delete-organization` / `delete-property` — owner-only, irreversible, cascading. Full deletion should probably never be assistant-reachable at all, even at Tier 2, given the blast radius; if ever built, it needs a bespoke multi-step confirmation flow outside the normal Tier 2 pattern.
- Any org-ownership-transfer action (doesn't exist today; if built later, treat as irreversible-equivalent).
- Payment provider credential changes — financial-config change with its own existing in-app confirm dialog; don't fold into the generic Tier 2 flow.
- `approve-org-verification` / `reject-org-verification` — super-admin only, outside org/property RBAC entirely, out of scope for a host-facing assistant by definition.
- Bulk/range pricing writes (see Phase 6).
- Re-triggering parking broadcast fan-out (see Phase 5).
- Flipping inbox `auto_reply_mode` to `'send'` (see Phase 7).

## Out of scope — nothing meaningful to expose

- **Notifications module**: read/consume-only surface for hosts (bell, toasts, panel); no host-side notification-rule CRUD exists.
- **Voucher system**: guest/system-facing only; admin dashboard only displays the result read-only, no admin management surface.
- **Guest portal**: separate guest-authenticated identity with zero host-facing management UI.

## Rollout notes

- Each phase ships behind the existing two-layer kill switch (no new flag needed) — org admins already opt in per-org, and the assistant is off by default platform-wide.
- Update `docs/guides/testing/ai-dashboard-assistant-manual.md` with new test cases per phase, not all at once at the end.
- Update `docs/PROJECT.md`'s tool catalog line and `docs/architecture/edge-functions.md` as each phase ships, per this repo's "docs are the source of truth" convention — don't batch doc updates to the end of the whole v2 effort.
- Consider whether the daily/monthly message quota needs a separate, stricter sub-limit for Tier-2 `external_send` confirmations (Phase 2) before Phase 7/8 ship, to bound worst-case guest-facing spam from a compromised session or confused host.
