---
stage: done
title: 'AI Dashboard Assistant — Implementation Plan'
status: v1 shipped — see ../done/ai-platform-hardening-handoff.md for the build log
tags: [planning, planned-modules, done]
updated: 2026-08-15
---

# AI Dashboard Assistant — Implementation Plan

## Context

Hosts and property managers have no in-dashboard way to ask natural-language questions about their operational data ("what's checking in today", "why is booking #123 stuck in PENDING_DOCUMENTS") or take action (check a guest in, advance a booking status) without manually navigating the bookings/finance/maintenance pages. This plan adds a chat assistant embedded in the admin dashboard (`/org/:orgSlug/...`) that both answers questions and executes mutations — strictly scoped to the signed-in user's existing RBAC permissions — and renders responses as a fixed set of typed, pre-built UI components (cards, lists, tables, confirmations) inside the chat, not free-form AI-generated markup.

Because v1 ships write actions together with read/Q&A (not phased read-only-first, per explicit decision), the core design problem is a concrete, implementable **tiered confirmation model** plus an **independently-enforced permission/action guard that never trusts the model's own judgment as the sole gate** — mirroring the "scoped facts + independent safety guard" convention already proven by the Guest Inbox AI (`socialInboxAiService.ts` / `inboxAiGuestContext.ts` / `inboxAiSafetyGuard.ts`), and the two-tier kill-switch convention proven by the sibling AI Voice Receptionist plan — while remaining fully independent of both (own tables, own switches, own quota, no shared infrastructure).

This plan was produced by research + brainstorming (no code written). It covers the connection/execution model, tool/action design, rich structured chat UI, data model, guardrails, admin configuration, and a phased build order.

## Decisions made during brainstorming (do not re-litigate during implementation)

1. **v1 ships read (Q&A/insights) and write (action execution) together, not phased read-only-first.** Fixed constraint from the brief. This raises the stakes on the guard design (Architecture §5) since there's no "safe" read-only interim release to fall back on before actions ship.
2. **Tiered risk-based confirmation, not "confirm everything" or "confirm nothing."** Three concrete tiers (full rule set in Architecture §5): Tier 0 = pure reads, never touches a mutation. Tier 1 = auto-executed forward, non-override, no-financial-payload transitions, always surfaced with a visible "done automatically" notice (never silent). Tier 2 = explicit confirm-click required for anything destructive, override, refund-related, financially consequential, or cross-scope. The tier is computed **server-side by a deterministic classifier** reading the same `statusMachine.ts` graph the orchestrator itself enforces — never decided by the model.
3. **Usage limits are a self-contained daily/monthly quota table per org**, mirroring the voice plan's `voice_receptionist_sessions` cap pattern, with a stubbed "upgrade for more" UI hook. No real Stripe/billing wiring in this plan — that integration is explicit future work, and today there is zero billing infrastructure anywhere in the codebase to build against (verified by full-repo grep).
4. **Fully independent of the AI Voice Receptionist plan** — own settings tables, own kill switch, own quota/audit tables, no shared infra. Follows the same architectural _conventions_ only: a two-tier kill switch (super-admin global + org-level opt-in, with a per-property disable list rather than a combinatorial per-property settings table), and a "host-safe" permission-scoped context builder analogous to the voice plan's guest-safe builder — except filtered by the requesting admin's _resolved permissions array_, not a fixed guest-safe field allowlist.
5. **Rich chat responses use a fixed, typed set of UI "block" schemas selected/populated by the model via structured output, rendered by dedicated React components — never free-form AI-generated HTML/markdown.** This closes the injection/consistency risk of an LLM emitting arbitrary markup on an admin surface with mutation buttons, and lets the safety guard validate each block's data fields against grounding facts before render.
6. **New tables, not reuse of `social_conversations`/`social_messages`.** Those tables model guest↔host conversations over external platforms (`platform` CHECK constrained to `facebook/instagram/tiktok/airbnb`, keyed by `organization_id + platform + external_thread_id`, with a guest `participant_name`) — this feature is admin-user↔AI with no external platform/guest identity, and needs its own risk-tier/action-audit columns that would be meaningless on a guest-chat row. New `ai_dashboard_assistant_*` tables follow the same RLS + `SECURITY DEFINER`-helper convention `social_inbox` established.
7. **The 61 route guides' "Host-facing knowledge" Q&A sections** (`docs/guides/routes/**/*.md`, shipped by the now-Done `route-guides-refresh.md`) **are the knowledge base for "how does X work" questions** — ingested into a new lookup table via a small sync script (Deno edge functions can't read arbitrary repo markdown at request time), kept separate from live-data grounding facts so "what does PENDING_DOCUMENTS mean" and "what's checking in today" are answered by two different, individually-auditable sources rather than one hallucination-prone blob.

## Current state (verified this session)

- **RBAC primitives** (`supabase/functions/_shared/orgAuth.ts`): `verifyAuthenticatedUser` (JWT only); `verifyPropertyAccess(req, propertyId, requiredPermission?)` and `verifyOrgAccess(req, scope, requiredPermission?)` return `{ accessKind, permissions[] }` for owner / platform_admin / org_admin / member. `supabase/functions/_shared/propertyScope.ts` wraps these: `resolveScopedPropertyAccess(req, requiredPermission, explicitPropertyId?)`, `resolveOrgAccessContext(req, requiredPermission?)`, `resolvePropertyAccessContext(req, explicitPropertyId?)` (no permission gate — the right primitive for "can this user open the assistant at all"), and `verifyBookingBelongsToProperty(bookingId, propertyId)`.
- **Verified permission keys per candidate tool** (confirmed directly in `propertyTeamPermissions.ts`/`orgTeamPermissions.ts` and each edge function's source): `bookings:view`, `bookings:edit`, `bookings:workflow`, `finance:view`, `maintenance:view` all exist as declared property-level permission ids; `org:bookings:view`, `org:dashboard:view` exist as org-level ids. `list-bookings`→`bookings:view`/`org:bookings:view`; `dashboard-stats`→`bookings:view`/`org:dashboard:view`; `finance-summary`/`finance-bookings`→`finance:view` via `resolveFinanceAssetAccess` (`_shared/financeAssetScope.ts` — a **separate** resolver from `resolveScopedPropertyAccess`, unioning property/parking finance access); `maintenance-summary`/`maintenance-items`→`maintenance:view`; `transition-booking`/`cancel-booking`→`bookings:workflow`; `sync-booking-integrations`/`validate-booking-receipts`→`bookings:edit`.
- **Workflow orchestrator** (`_shared/workflowOrchestrator.ts:189`): `WorkflowOrchestrator.transition(bookingId, toStatus, payload?, devControls?, manual=true): Promise<{success, booking, sideEffects}>` is the single mutation entry point; it re-validates `canTransition()` internally and throws on an invalid/unmet-precondition transition — a wrong AI-proposed call fails safely even if the risk classifier had a bug.
- **`_shared/statusMachine.ts` exact graphs** (read in full and verified this session): primary `TRANSITION_GRAPH` — `PENDING_REVIEW→[PENDING_DOCUMENTS, CANCELLED]`, `PENDING_DOCUMENTS→[PENDING_DOCUMENTS, READY_FOR_CHECKIN, CANCELLED]` (same-status = sub-step completion), legacy `PENDING_GAF/PENDING_PARKING_REQUEST/PENDING_PET_REQUEST→[PENDING_DOCUMENTS, READY_FOR_CHECKIN, CANCELLED]`, `READY_FOR_CHECKIN→[READY_FOR_CHECKOUT, CANCELLED]`, `READY_FOR_CHECKOUT→[PENDING_SD_REFUND, COMPLETED, CANCELLED]`, `PENDING_SD_REFUND→[COMPLETED, CANCELLED]`, `COMPLETED/CANCELLED→[]`. Separate `MANUAL_OVERRIDE_GRAPH` (admin-only, requires `manual:true`) covers force-advance/backward-recovery edges, e.g. `READY_FOR_CHECKIN→[PENDING_DOCUMENTS, PENDING_PET_REQUEST, PENDING_PARKING_REQUEST, PENDING_GAF, PENDING_REVIEW, PENDING_SD_REFUND]`. `canTransition(from,to,{manual})`/`availableTransitions(from,{manual})` are the exact functions to reuse for both the risk classifier and a `get_available_transitions` read tool.
- **`TransitionPayload` financial fields** (verified directly in `workflowOrchestrator.ts:54-94`): `booking_rate`, `down_payment`, `security_deposit`, `pet_fee`, `parking_rate_guest`, `guest_additional_fee` (pricing, set on the PENDING_REVIEW→docs transition), `parking_rate_paid` (parking settlement), `sd_additional_expenses`/`sd_additional_profits`/`sd_additional_expense_items`/`sd_additional_profit_items`/`sd_refund_amount` (SD refund), `guest_balance_paid_amount` (checkout balance settlement). This is the authoritative list the Tier-2 "financial payload" escalation rule checks against (§5) — no invented field names.
- **No standalone single-booking read endpoint exists** — `list-bookings` is the only booking read surface; a new minimal `get-booking` edge function is a confirmed, required gap-fill, not an assumption.
- **No generic "edit booking field" endpoint exists** outside the transition payload above and `cancel-booking` — this bounds the v1 write tool catalog (§Architecture 2): there's no separate "edit guest PII" tool to build because no backend exists for it yet.
- **Two-layer AI pattern to extend, not duplicate**: `_shared/socialInboxAiService.ts` (`tryGeminiReply`/`tryGroqReply`, Gemini `gemini-2.5-flash` via raw `fetch`, `GEMINI_API_KEYS` round-robin + Groq fallback `meta-llama/llama-4-scout-17b-16e-instruct`) + `_shared/inboxAiGuestContext.ts` (`buildAiGroundingFacts` — fixed guest-safe field allowlist) + `_shared/inboxAiSafetyGuard.ts` (`assertSafeGuestReply` — deterministic post-generation check for leaked names/ungrounded amounts). None of these do function/tool-calling today — this feature needs a **new** shared client (`geminiToolCallClient.ts`) that adds tool declarations + structured output on top of the same key-rotation/fallback machinery, not a modification of the narrowly-scoped inbox path.
- **RLS/table convention** (`supabase/migrations/20260910120000_social_inbox.sql` and confirmed repeated in `20260719153000_web_guest_chat.sql`, `20260912120000_inbox_rls_permissions.sql`): every table gets `ENABLE ROW LEVEL SECURITY` + one `SELECT ... TO authenticated` policy gated by a small per-feature `SECURITY DEFINER` helper (e.g. `user_can_access_org_inbox(p_org_id)`); all writes go through the edge functions' service-role client, bypassing RLS. This plan's tables get their own `user_can_access_ai_dashboard_assistant_org(p_org_id)` helper, same shape.
- **Dashboard shell mount point**: `ui/src/features/dashboard/bookings/components/AdminLayout.tsx` (`AdminLayoutShell`, ~line 267) wraps `<GmailReconnectProvider><Outlet/></GmailReconnectProvider>` and is shared by `OrgAdminShell`/`PropertyAdminShell`/`ParkingAdminShell`/`SuperAdminShell` — the correct, only sane mount point for a persistent launcher. No command palette / cmd-k / global search exists anywhere in the dashboard today.
- **Settings-page convention**: `useAppSettings.ts` — plain TanStack Query `useQuery`/`useMutation` hitting a scoped edge function URL via `scopedFunctionsUrl`/`scopedOrgFunctionsUrl` (`ui/.../org/lib/adminApiScope.ts`), manual draft-state diffing, **not** RHF/zod (reserved for record-editing forms). `edgeClient.ts`'s `callEdgeFunction<T>()` is the typed fetch wrapper (e.g. `useOrgPermissions.ts` → `org-access?org_slug=...`).
- **No streaming pattern exists anywhere in `supabase/functions`** (grep for `text/event-stream`/`ReadableStream` returned nothing) — full-turn (non-streaming) JSON responses are the pragmatic v1 choice; see Architecture §1.
- **No billing/subscription/quota infrastructure exists anywhere** (verified by full-repo grep) — the usage-metering table is a blank slate.
- Config convention: existing admin functions declare `verify_jwt = false` in `supabase/config.toml` (auth enforced in-handler, not at Kong) — new functions follow the same shape.

## Architecture

### 1. Connection/execution model

**Endpoints** (both `serveAuthenticated`, `verify_jwt = false`, matching every existing admin function):

- `dashboard-assistant-chat` (POST) — main turn endpoint. Body: `{ conversationId?: string, orgSlug: string, pageContext: { propertyId?: string, bookingId?: string }, message: string }`. `pageContext` is the route the chat panel was opened from/is currently viewing and is load-bearing: it's what the Tier-2 "different booking/property than currently in view" escalation rule compares every tool call's target against. The frontend passes it on **every** turn, not just at panel-open.
- `dashboard-assistant-confirm` (POST) — executes a previously-proposed Tier-2 action. Body: `{ conversationId, actionId, confirm: boolean }`. Deliberately a separate endpoint so a Tier-2 action can only ever be executed by an explicit, isolated confirm call — never as a side effect of the model "changing its mind" mid-generation or a retried chat POST.

**Turn flow inside `dashboard-assistant-chat`:**

1. `resolveOrgAccessContext(req)` (no required permission — establishes org membership) resolves `{ user, org, permissions }`; if `pageContext.propertyId` is set, `resolvePropertyAccessContext(req, pageContext.propertyId)` additionally resolves property-level `permissions[]` (no gate yet — happens per-tool in step 6). Neither resolving → 403, same failure mode as every other admin endpoint.
2. **Kill switch checks, cheapest-first, fail closed**: `ai_dashboard_assistant_global_settings.enabled` (missing/false → hard stop) → `ai_dashboard_assistant_org_settings.enabled` for this org (missing row → disabled; opt-in, not opt-out) → if `pageContext.propertyId` is in that row's `disabled_property_ids`, stop too.
3. **Quota check**: read/upsert `ai_dashboard_assistant_usage_daily` for `(org_id, today)`; compare `message_count`/monthly sum against `ai_dashboard_assistant_org_settings.daily_message_limit`/`monthly_message_limit`. Over limit → return a normal assistant `{type:'text'}` block plus `upgradeHook: true` (frontend renders a stubbed "Upgrade for more" CTA, no real billing call).
4. **Grounding**: new `_shared/dashboardAssistantContext.ts#buildHostSafeGroundingFacts(orgId, propertyId, permissions)` — the "host-safe" analogue of `buildAiGroundingFacts`, except it _conditionally includes_ fact sections based on the resolved `permissions[]` (no finance facts without `finance:view`, no maintenance facts without `maintenance:view`, property facts only for accessible properties). This is what makes grounding permission-scoped rather than a fixed allowlist.
5. **Model call**: new `_shared/geminiToolCallClient.ts` extends `socialInboxAiService.ts`'s key-rotation pattern with `tools: [...]` function declarations (fixed catalog, §2) and a strict `responseSchema` for `{ replyBlocks: ChatBlock[] }` (§3). System prompt carries assistant persona + explicit tool-use policy ("never claim an action succeeded unless a tool call actually returned success; never invent booking data not present in Known facts or a tool result").
6. **Tool-calling loop**, bounded to 4 round-trips per turn (hard cap — a model stuck requesting tools is a cost/availability bug, not a feature): every requested tool call is executed by `_shared/dashboardAssistantTools.ts`, which independently re-derives the required permission for that specific tool and re-runs `resolveScopedPropertyAccess`/`resolveFinanceAssetAccess` against the **original request's JWT** — never anything the model asserts. Tier 0/1 results feed back into the next model turn; Tier 2 tool calls are **not** executed inline — they short-circuit the loop and return an `action_confirmation` block with `status: 'proposed'` plus a persisted `ai_dashboard_assistant_pending_actions` row.
7. **Post-generation safety guard** (`_shared/dashboardAssistantSafetyGuard.ts`) runs before the response is persisted or returned — see §5.
8. Persist user + assistant messages to `ai_dashboard_assistant_messages`, bump `ai_dashboard_assistant_usage_daily` counters, return the assistant message's `blocks[]`.

**Streaming — explicitly non-streaming for v1.** No SSE/streaming pattern exists anywhere in this codebase today, and unlike the voice plan's audio problem, nothing here needs a persistent duplex connection: the response is a bounded set of typed JSON blocks, and a `booking_card` block can't render until its backing tool call has already completed anyway. Reuses the exact non-streaming `fetch` pattern `tryGeminiReply` already uses. Token-level SSE streaming is deferred to Phase 6 as pure polish, not a v1 blocker.

**Frontend entry**: `AiAssistantLauncherButton.tsx` mounted in `AdminLayout.tsx` next to `<GmailReconnectProvider>` (visible only when both kill-switch layers are on, via new `useAiAssistantAccess.ts` — same shape as `useOrgPermissions.ts`), opening `AiAssistantPanel.tsx` as a **slide-over**, not a full-screen takeover (the admin needs to keep glancing at the underlying dashboard while chatting, and `pageContext` needs the current route live anyway).

### 2. Tool/action design

Fixed catalog; each tool re-checks its own permission key inside the executor (defense-in-depth — the model choosing to call a tool is never sufficient, the executor's own RBAC check is):

| Tool                                                                 | Wraps                                                                                                          | Permission re-check                    | Tier              |
| -------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | -------------------------------------- | ----------------- |
| `search_knowledge_base(query)`                                       | new `ai_dashboard_assistant_knowledge_base` table (Postgres FTS)                                               | base access only                       | 0                 |
| `explain_booking_status(status)`                                     | `STATUS_HUMAN_LABEL` + deterministic "what unblocks next" lookup                                               | base access only                       | 0                 |
| `get_booking(bookingId)`                                             | **new** `get-booking` function (fills verified gap) — booking fetch + `verifyBookingBelongsToProperty`         | `bookings:view`                        | 0                 |
| `list_bookings(filters)`                                             | `list-bookings`                                                                                                | `bookings:view` / `org:bookings:view`  | 0                 |
| `get_available_transitions(bookingId)`                               | `statusMachine.availableTransitions(fromStatus, {manual:true})`                                                | `bookings:view`                        | 0                 |
| `get_dashboard_stats(range)`                                         | `dashboard-stats`                                                                                              | `bookings:view` / `org:dashboard:view` | 0                 |
| `get_finance_summary(range)` / `list_finance_bookings(filters)`      | `finance-summary` / `finance-bookings` via `resolveFinanceAssetAccess`                                         | `finance:view`                         | 0                 |
| `get_maintenance_summary(range)` / `list_maintenance_items(filters)` | `maintenance-summary` / `maintenance-items`                                                                    | `maintenance:view`                     | 0                 |
| `sync_booking_integrations(bookingId)`                               | `sync-booking-integrations` (idempotent Calendar/Sheets re-sync, no status change)                             | `bookings:edit`                        | 1                 |
| `run_receipt_validation(bookingId)`                                  | `validate-booking-receipts` (AI verdict re-check, no financial change)                                         | `bookings:edit`                        | 1                 |
| `propose_transition_booking(bookingId, toStatus, payload?)`          | `WorkflowOrchestrator.transition()` (mirrors `transition-booking`)                                             | `bookings:workflow`                    | classified per §5 |
| `propose_cancel_booking(bookingId)`                                  | `WorkflowOrchestrator.transition(..., 'CANCELLED', ...)` (mirrors `cancel-booking`, incl. its Telegram notify) | `bookings:workflow`                    | always 2          |

No standalone "edit financial field" or "edit guest PII" tool in v1 — no backend for arbitrary field edits exists today, so financial/PII fields are only reachable inside a `propose_transition_booking` payload, which is exactly why those payload fields are a Tier-2 escalation axis rather than their own tool.

### 3. Rich structured UI in chat

Fixed discriminated-union block schema, validated server-side (Zod) before ever reaching the client — the model fills data fields of pre-built templates, never emits HTML/scripts/arbitrary DOM:

```ts
type ChatBlock =
  | { type: 'text'; text: string }
  | {
      type: 'booking_card';
      bookingId: string;
      guestName: string;
      status: BookingStatus;
      checkIn: string;
      checkOut: string;
      propertyName: string;
      balanceDue: number | null;
    }
  | { type: 'stat_list'; title: string; items: Array<{ label: string; value: string }> }
  | {
      type: 'data_table';
      title: string;
      columns: string[];
      rows: Array<Record<string, string | number>>;
    }
  | { type: 'link_list'; title: string; links: Array<{ label: string; href: string }> }
  | {
      type: 'action_confirmation';
      actionId: string;
      toolName: string;
      riskTier: 'tier1_auto' | 'tier2_confirmed';
      summary: string;
      details: Array<{ label: string; value: string }>;
      status: 'proposed' | 'confirmed' | 'executed' | 'denied' | 'expired';
    };
```

Rendered by `ChatBlockRenderer.tsx` dispatching on `block.type` to components under `ui/src/features/dashboard/ai-assistant/components/blocks/` (`BookingCardBlock.tsx`, `StatListBlock.tsx`, `DataTableBlock.tsx`, `LinkListBlock.tsx`, `ActionConfirmationBlock.tsx`). `ActionConfirmationBlock` renders two ways: `tier1_auto` as an inert "done automatically" pill + "View booking" link (already happened, no button); `tier2_confirmed` with `status:'proposed'` as a Confirm/Cancel button pair posting to `dashboard-assistant-confirm`. Unknown block types are dropped and logged, never rendered raw.

### 4. Data model (new migration, e.g. `supabase/migrations/2026XXXX_ai_dashboard_assistant.sql`)

- `ai_dashboard_assistant_global_settings` — singleton kill switch: `enabled BOOLEAN NOT NULL DEFAULT FALSE`, `updated_by`, `updated_at`.
- `ai_dashboard_assistant_org_settings` — one row per org (`organization_id UUID UNIQUE NOT NULL REFERENCES organizations(id)`): `enabled BOOLEAN NOT NULL DEFAULT FALSE`, `disabled_property_ids UUID[] NOT NULL DEFAULT '{}'` (org-wide opt-in with per-property opt-out), `daily_message_limit INT NOT NULL DEFAULT 50`, `monthly_message_limit INT NOT NULL DEFAULT 1000`, `daily_write_action_limit INT NOT NULL DEFAULT 20`, `updated_by`, `updated_at`.
- `ai_dashboard_assistant_conversations` — `id`, `organization_id`, `user_id UUID NOT NULL REFERENCES auth.users(id)`, `property_id UUID NULL` (opened-from context), `title TEXT`, `last_message_at`, `created_at`, `updated_at`. Index `(organization_id, user_id, last_message_at DESC)`. **Private per user** — no shared/team-visible threads.
- `ai_dashboard_assistant_messages` — `id`, `conversation_id UUID NOT NULL REFERENCES ai_dashboard_assistant_conversations(id) ON DELETE CASCADE`, `role TEXT CHECK (role IN ('user','assistant'))`, `content_text TEXT`, `blocks JSONB NOT NULL DEFAULT '[]'`, `tool_calls JSONB NOT NULL DEFAULT '[]'` (redacted request/response pairs, debugging + audit), `created_at`. Index `(conversation_id, created_at ASC)`.
- `ai_dashboard_assistant_pending_actions` — Tier-2 proposals awaiting confirm: `id`, `conversation_id`, `message_id`, `user_id` (only the proposing user may confirm), `tool_name`, `input_payload JSONB`, `risk_tier`, `status TEXT CHECK (status IN ('pending','confirmed','executed','denied','expired')) DEFAULT 'pending'`, `expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '15 minutes'`, `created_at`.
- `ai_dashboard_assistant_usage_daily` — `id`, `organization_id`, `usage_date DATE`, `message_count INT DEFAULT 0`, `write_action_count INT DEFAULT 0`, `UNIQUE(organization_id, usage_date)` — the future-paid-tier foundation, incremented via `ON CONFLICT ... DO UPDATE`.
- `ai_dashboard_assistant_action_audit` — new audit trail (confirmed missing infra): `id`, `organization_id`, `property_id`, `booking_id UUID NULL REFERENCES guest_submissions(id) ON DELETE SET NULL`, `user_id NOT NULL`, `conversation_id`, `message_id`, `tool_name`, `risk_tier TEXT CHECK (risk_tier IN ('tier1_auto','tier2_confirmed'))`, `input_payload JSONB`, `result_status TEXT CHECK (result_status IN ('success','failed','denied'))`, `result_summary TEXT`, `created_at`. Indexes `(organization_id, created_at DESC)` and `(booking_id, created_at DESC)` — the latter powers a read-only "Actions taken by AI assistant" panel on the booking detail page.
- `ai_dashboard_assistant_knowledge_base` — synced from route guides: `id`, `route_guide_path`, `route_path`, `question`, `answer`, `updated_at`, `UNIQUE(route_guide_path, question)`. Populated by `scripts/sync-ai-knowledge-base.ts`.

RLS: `ENABLE ROW LEVEL SECURITY` on every table; one `SELECT` policy per table gated by a new `public.user_can_access_ai_dashboard_assistant_org(p_org_id)` `SECURITY DEFINER` helper (same shape as `user_can_access_org_inbox`); `_conversations`/`_messages`/`_pending_actions` additionally scoped `AND user_id = auth.uid()` (private-per-user, not just private-per-org). All writes go through the edge functions' service-role client, matching every other table in this codebase.

### 5. Guardrails

**Tiered confirmation model** — computed by `_shared/dashboardAssistantRiskClassifier.ts#classifyActionRisk()`, never by the model, as independent rule axes (highest tier wins):

- **Tier 0 (always allowed, no confirmation, by construction)**: any read tool — never touches `WorkflowOrchestrator`.
- **Tier 1 (auto-executed, always surfaced with a "done automatically" notice, never silent)**: `sync_booking_integrations`, `run_receipt_validation` (idempotent, no financial/status change); `propose_transition_booking` where **all** hold: the edge is in the primary `TRANSITION_GRAPH[from]` (not `MANUAL_OVERRIDE_GRAPH`), `toStatus !== 'CANCELLED'`, and it is **not** `PENDING_SD_REFUND → COMPLETED` (refund finalization is always Tier 2, even though it's a primary-graph edge), and the payload contains no changed non-null value for any of the verified financial fields (`booking_rate`, `down_payment`, `security_deposit`, `pet_fee`, `parking_rate_guest`, `guest_additional_fee`, `parking_rate_paid`, `sd_additional_expenses`, `sd_additional_profits`, `sd_refund_amount`, `guest_balance_paid_amount`). In practice the clean Tier-1 case is exactly the brief's own example: `PENDING_DOCUMENTS → READY_FOR_CHECKIN` once documents are ready, no new pricing payload.
- **Tier 2 (explicit confirm-click required)**: any transition to `CANCELLED`; any `MANUAL_OVERRIDE_GRAPH`-only edge (force-advance or backward recovery); `PENDING_SD_REFUND → COMPLETED`; any transition payload carrying a changed value for a financial field (list above); any booking/property target that doesn't match `pageContext` (cross-scope escalation — the assistant never silently acts on a booking the admin isn't currently looking at); `propose_cancel_booking` unconditionally. **Bulk actions** (model requesting more than one write tool call in a single turn) are always forced to Tier 2 regardless of each action's individual tier — blast radius matters, not just per-action risk.
- **Hard block (outright rejection, not a confirmable tier)**: a tool name outside the fixed catalog, or a permission re-check failure (requesting user's `permissions[]` lacks the tool's required key) — returns a plain refusal, never a confirmation prompt, since offering to confirm an action the user structurally cannot take would itself leak intent/capability.

**Permission-scoped context builder**: `buildHostSafeGroundingFacts()` (§1 step 4) — same shape as `buildAiGroundingFacts`, section-gated by resolved `permissions[]` instead of a fixed allowlist.

**Independent post-generation/post-tool-call safety guard** (`_shared/dashboardAssistantSafetyGuard.ts`), two distinct jobs, extending `assertSafeGuestReply`'s "guard is independent of the prompt" principle from text-leakage to action-safety:

1. **Data-leakage check** (post-generation): every numeric/name field in a rendered block is matched against the actual grounding facts loaded for _this specific request_ or an executed tool result; anything ungrounded is rejected and the block dropped/replaced, generalizing `assertSafeGuestReply`'s amount/name matching from free text to structured block fields.
2. **Action-safety check** (pre-execution, runs immediately before _every_ tool call — Tier 0/1 auto or Tier 2 on-confirm): re-derives risk tier from the booking's **current** DB state (not the tier stored at proposal time — state can change between proposal and confirm) and hard-throws if the independently-computed tier disagrees with what's about to execute. This makes the guard non-bypassable: even a classifier bug that misclassifies a Tier-2 action as Tier-1 is caught here, because this check re-derives from `canTransition()`/the payload/the scope comparison itself rather than trusting the earlier classification.

### 6. Admin configuration UI

- **Super-admin (global kill switch)**: small new card — the second platform-wide runtime flag in the app (the voice plan is the first) — one boolean, one edge function (`dashboard-assistant-global-settings`).
- **Org level (opt-in + quota config)**: new section in the org settings composition, following `PropertyOperationalSettingsSections.tsx`'s family and `useAppSettings.ts`'s manual draft-state hook (not RHF/zod) — enable toggle, per-property disable checkboxes (`disabled_property_ids`), numeric inputs for the three limits. New `useAiDashboardAssistantSettings.ts` hook hitting `dashboard-assistant-settings` (GET/PATCH), same shape as `useAppSettings`.

## Phase breakdown

1. **Spike**: validate Gemini's function-calling + `responseSchema` structured output against the `ChatBlock` union and tool catalog end-to-end with fixture data (confirm `gemini-2.5-flash` is accurate enough for tool selection, or whether it needs a stronger model tier — an open cost/accuracy question this plan can't resolve without testing), and confirm the route-guide markdown → knowledge-base extraction script correctly parses all 61 "Host-facing knowledge" sections.
2. **Data model + backend foundation**: the 7-table migration (§4), `_shared/dashboardAssistantContext.ts`, `dashboardAssistantRiskClassifier.ts`, `dashboardAssistantSafetyGuard.ts`, `geminiToolCallClient.ts`, the new `get-booking` function, `scripts/sync-ai-knowledge-base.ts`, `dashboard-assistant-settings`/`dashboard-assistant-global-settings` CRUD, quota-check logic.
3. **Tool set**: `_shared/dashboardAssistantTools.ts` implementing all tools from §2 with per-tool permission re-checks, `dashboard-assistant-chat`'s bounded tool-calling loop, `dashboard-assistant-confirm` for Tier-2 execution against `ai_dashboard_assistant_pending_actions`; curl-test deliberately as a low-permission (VIEWER) member to prove the executor rejects even when the model "agrees" to try.
4. **Frontend chat UI + rich blocks**: `AiAssistantLauncherButton`/`AiAssistantPanel` mounted in `AdminLayout.tsx`, `ChatThread`/`ChatComposer`, the five block components + `ChatBlockRenderer`, `useAiAssistantChat`/`useAiAssistantConversations` hooks, conversation history list.
5. **Admin config UI**: org settings section (enable + per-property disable list + quota numbers) wired to `dashboard-assistant-settings`, super-admin global kill-switch card wired to `dashboard-assistant-global-settings`.
6. **Hardening**: exhaustive risk-classifier walk over every `TRANSITION_GRAPH`/`MANUAL_OVERRIDE_GRAPH` edge (not spot-checked — this is the core safety mechanism), tool-loop timeout/runaway protection, pending-action expiry sweep, quota-exceeded UX polish, the booking-detail "Actions taken by AI assistant" audit viewer, mobile pass on the slide-over panel, accessibility pass (focus trap, ARIA live region, keyboard-operable confirm/cancel), and — only now, as pure polish — SSE token streaming if turn latency warrants it.

## Explicit non-goals (for this plan / v1)

- No real billing/Stripe integration — quota is a soft cap with a stubbed "upgrade for more" hook only.
- No voice/audio input for this assistant — text chat only; voice is the separate, independent sibling plan.
- No free-form AI-generated HTML/markdown-with-embedded-widgets in chat responses — strictly the fixed `ChatBlock` schema.
- No direct/arbitrary booking financial-field or guest-PII-field edit tool outside a `propose_transition_booking` payload — no backend for that exists yet, and even the payload-carried fields that do exist are Tier 2.
- No parking-specific tool set (parking bookings/broadcast/settings) in v1's initial catalog — same architecture extends later as a fast-follow.
- No cross-org actions, ever — hard block, not a confirmation tier.
- No autonomous/scheduled/background assistant runs (e.g. a nightly cleanup job) — strictly synchronous, user-initiated turns.
- No token-level SSE streaming in v1 — full-turn JSON responses, deferred to Phase 6 polish.
- No custom/fine-tuned model — same Gemini 2.5-flash + Groq fallback pattern as the rest of the codebase.
- No shared/team-visible conversation threads — each conversation is private to the user who created it.

## Verification plan (no automated test suite exists in this repo)

1. `bun run type-check`, `bun run lint`, `bun run build` after each phase.
2. Local Supabase: apply the new migration, run `mcp__supabase__get_advisors` against all 7 new tables before the backend phase is done — particular attention to `ai_dashboard_assistant_pending_actions`/`_action_audit` not being selectable across org/user boundaries.
3. `bun run dev:api` + curl-test `dashboard-assistant-chat`/`dashboard-assistant-confirm` directly: (a) as an owner, ask a Tier-0 read question, confirm no call reaches `WorkflowOrchestrator`; (b) as a VIEWER-role property member, ask it to check a guest in, confirm the tool executor's permission re-check rejects it even though the model attempted the call (proves defense-in-depth, not prompt-only enforcement); (c) as a MANAGER, propose a Tier-1 transition and confirm it auto-executes with a corresponding `ai_dashboard_assistant_action_audit` row; (d) propose a Tier-2 `CANCELLED` transition, confirm it returns a proposal only, then call `-confirm` twice and confirm the second call is a clean no-op/already-executed error, not a double-cancel.
4. Manually (or via a small throwaway script) walk every `from → to` pair in `TRANSITION_GRAPH` and `MANUAL_OVERRIDE_GRAPH` against `classifyActionRisk()` and confirm each lands in the intended tier — exhaustive, not spot-checked, since this is the core safety mechanism of the whole feature.
5. Manual Playwright MCP pass: open the assistant from an org dashboard page, ask a stats question (confirm `stat_list` renders), ask "what's checking in today" (confirm `booking_card` blocks), ask it to check in a ready booking (confirm the Tier-1 auto notice), ask it to cancel a booking (confirm the Tier-2 confirm button appears, click it, confirm the booking's status updates on the underlying bookings page after refetch).
6. Manually verify both kill-switch layers independently (global off hides/blocks the launcher everywhere; org opted-out hides it for that org only) and the quota path (lower `daily_message_limit` to 1 for a test org, confirm the graceful upgrade-stub message appears instead of a crash).

## Critical files

- `supabase/functions/_shared/orgAuth.ts`, `_shared/propertyScope.ts` — RBAC primitives every tool executor's defense-in-depth re-check reuses directly.
- `supabase/functions/_shared/statusMachine.ts` — `canTransition`/`availableTransitions`/`TRANSITION_GRAPH`/`MANUAL_OVERRIDE_GRAPH`, the deterministic source of truth both the risk classifier and the action-safety guard read.
- `supabase/functions/_shared/workflowOrchestrator.ts` — `WorkflowOrchestrator.transition()`, the single mutation entry point every write tool ultimately calls; `TransitionPayload` type for the financial-field escalation list.
- `supabase/functions/_shared/socialInboxAiService.ts`, `_shared/inboxAiGuestContext.ts`, `_shared/inboxAiSafetyGuard.ts` — key-rotation/fallback machinery and the "scoped facts + independent guard" pattern extracted into `geminiToolCallClient.ts` and extended with tool-calling.
- `supabase/functions/_shared/financeAssetScope.ts` (`resolveFinanceAssetAccess`) — the finance-specific access resolver finance read tools must use instead of `resolveScopedPropertyAccess`.
- `supabase/functions/_shared/orgTeamPermissions.ts`, `propertyTeamPermissions.ts`, `parkingTeamPermissions.ts` — permission-id catalogs reused directly as tool-gating keys.
- `supabase/migrations/20260910120000_social_inbox.sql` — RLS/`SECURITY DEFINER`-helper convention this feature's migration mirrors.
- `docs/guides/routes/**/*.md` — the 61 guides' "Host-facing knowledge" Q&A sections `scripts/sync-ai-knowledge-base.ts` ingests.
- `ui/src/features/dashboard/bookings/components/AdminLayout.tsx` — mount point for the launcher/panel.
- `ui/src/features/dashboard/bookings/hooks/useAppSettings.ts`, `ui/src/features/dashboard/org/components/property-settings/PropertyOperationalSettingsSections.tsx` — settings-page draft-state pattern for the new org config section.
- **New**: `supabase/migrations/2026XXXX_ai_dashboard_assistant.sql`; `supabase/functions/dashboard-assistant-chat/index.ts`, `dashboard-assistant-confirm/index.ts`, `dashboard-assistant-settings/index.ts`, `dashboard-assistant-global-settings/index.ts`, `get-booking/index.ts`; `supabase/functions/_shared/dashboardAssistantContext.ts`, `dashboardAssistantTools.ts`, `dashboardAssistantRiskClassifier.ts`, `dashboardAssistantSafetyGuard.ts`, `geminiToolCallClient.ts`; `scripts/sync-ai-knowledge-base.ts`; `ui/src/features/dashboard/ai-assistant/**` (panel, blocks, hooks).
