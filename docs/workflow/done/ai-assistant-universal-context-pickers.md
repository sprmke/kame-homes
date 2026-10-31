---
title: 'AI dashboard assistant — universal per-module context pickers & rich response blocks'
status: shipped
tags: [workflow, done, ai-assistant, dashboard]
updated: 2026-08-19
stage: done
kind: plan
---

# AI dashboard assistant — universal per-module context pickers & rich response blocks

## Context

`docs/workflow/intake/_to-plan.md:636-657` (🔵, unplanned) asks for the booking-picker pattern — click a button, get a searchable list of bookings to pin as chat context — to be generalized to **every** dashboard module (finance, maintenance, calendar/pricing, team, marketing, chat/inbox, notifications, templates/public pages, settings, help & support), plus richer AI response formats (tables/images/links/flows/diagrams) and smoother multi-step action flows (e.g. guiding a booking through its full status journey), with a UI that can escalate out of the chat bubble into a center/overlay surface when content doesn't fit inline.

Three research passes this session (codebase, not live docs) established the real shape of the gap:

- **The backend is not the bottleneck.** All 65 tools (36 read, 29 write) across all 8 planned phases are already shipped per `docs/architecture/ai-dashboard-assistant.md` (bookings, finance, maintenance, org & team, property settings, parking, pricing, guest inbox, marketing studio). The assistant can already read and write nearly everything the intake item asks for.
- **The UI hasn't caught up to the tool catalog.** Only one context picker exists — `ChatComposerBookingPicker.tsx` for bookings. There's no property/team/finance/maintenance/parking/inbox/marketing/pricing/notification/public-page/ticket picker. The starter-suggestion pool is explicitly scoped to bookings/finance/maintenance only (`ai-dashboard-assistant-features.md:62`).
- **The response format is fixed and deliberately narrow.** `ChatBlock` is a 7-member discriminated union (`text`, `booking_card`, `stat_list`, `data_table`, `link_list`, `file_list`, `action_confirmation`) defined in two places that must stay in sync — frontend `ui/src/features/dashboard/ai-assistant/lib/aiAssistantApi.ts:4-38` and backend `supabase/functions/_shared/dashboardAssistantSafetyGuard.ts:99-134` — plus `KNOWN_BLOCK_TYPES` in the same file and `BLOCKS_RESPONSE_SCHEMA` in `supabase/functions/dashboard-assistant-chat/index.ts:72-138`. There's no image, flow/stepper, or "suggested next action" block, and no overlay/canvas surface — the panel is a single `sm:max-w-xl` right-side `Sheet`.

**Two scope decisions locked in with the user before this plan was written:**

1. Ship the deterministic **`stepper` block only** for multi-step flows in v1 (covers the booking-journey example exactly). A free-form `flow_diagram` block (Mermaid, new ~500KB lazy-loaded dependency) is written up as a non-goal / Phase 7 stretch, not built now.
2. Phase 2 (per-module pickers) is written as **all 11 modules**, sequenced by value, so nothing is missed — but it's understood implementation can stop after the high-value ones (property, team, finance, maintenance, parking, inbox, marketing) if time-boxed, with pricing/Telegram/public-pages/tickets last since they're small fixed lists or low-traffic pages.

This plan covers: generalizing the single-booking-pin mechanism into a multi-item, multi-type "attached context" system; a two-tier picker UX (module quick-picker + cross-module command palette); three new block types (`image`, `stepper`, `quick_actions`) plus a canvas overlay for content too rich for the chat bubble; a read-only "plan the booking journey" tool that renders as a stepper without changing how transitions execute; and the starter-suggestions/docs sync that ties it together. It does **not** add new write tools, change the Tier-0/1/2 safety model, or touch `workflowOrchestrator.ts`/`statusMachine.ts` transition logic — every new surface is either read-only or re-uses an existing propose/confirm tool.

## Key existing systems this plan builds on (verified this session)

- **Booking picker pattern to generalize** — `ui/src/features/dashboard/ai-assistant/components/ChatComposerBookingPicker.tsx` (286 lines): anchored `Popover` (`side="top"`, rendered into the panel's own `overlayContainer` portal), search-filtered list from `useBookings` (`bookings/hooks/useBookings.ts`), grouped by check-in month, current-page booking pinned to top. Selection produces a `PinnedBooking { id, propertyId, label }` held in `ChatComposer.tsx:47` local state, rendered as a removable chip (`ChatComposer.tsx:95-109`), and merged into `pageContext` on send (`useAiAssistantChat.ts:88-91`).
- **Chat panel shell** — `AiAssistantPanel.tsx:83-196`, a `Sheet` (`side="right"`, `sm:max-w-xl`) with an internal `view: 'chat' | 'history'` state and its own absolutely-positioned overlay-root div (`:189-192`) used as the portal container for the composer's popovers so they stack correctly inside the sheet.
- **Block contract (must stay triple-synced on every new type)** — frontend `ChatBlock` union: `ui/src/features/dashboard/ai-assistant/lib/aiAssistantApi.ts:4-38`; backend mirror + `KNOWN_BLOCK_TYPES`: `supabase/functions/_shared/dashboardAssistantSafetyGuard.ts:99-140ish`; Gemini structured-output schema `BLOCKS_RESPONSE_SCHEMA`: `supabase/functions/dashboard-assistant-chat/index.ts:72-138`; render dispatch: `ui/src/features/dashboard/ai-assistant/components/ChatBlockRenderer.tsx:19-44` (unknown types are silently dropped — the safe default to preserve).
- **"Never trust the model for structured facts" pattern to reuse for the new `stepper` block** — `supabase/functions/_shared/dashboardAssistantBlocks.ts#hydrateAssistantBlocksFromTools` (`:249-347`) fills block fields straight from raw tool results rather than the model's restated text. The new stepper block must be built the same way: the model calls a read tool, application code (not the LLM) turns the tool's structured result into the rendered steps.
- **Booking status state machine (read-only reuse only)** — `ui/src/features/dashboard/bookings/lib/workflow.ts` client-side / `supabase/functions/_shared/statusMachine.ts` server-side: `TRANSITION_GRAPH`, `MANUAL_OVERRIDE_GRAPH`, `bookingPipeline()`, `nextStep()`, `requiredSubForm`. The new journey tool only _reads_ this graph; it never adds transition logic of its own, and execution still goes through the existing `toolProposeTransitionBooking` (Tier computed by `dashboardAssistantRiskClassifier.ts#classifyActionRisk:245-259`) one step at a time via `workflowOrchestrator.ts#transition()`.
- **Risk/safety layer (untouched by this plan)** — `dashboardAssistantRiskClassifier.ts` (Tier 0/1/2 sets, bulk/cross-scope escalation) and `dashboardAssistantSafetyGuard.ts` (`assertBlocksGrounded`, `assertActionSafeToExecute`). New blocks must pass grounding; no new write tool is introduced, so no new tier classification is needed except registering the new read tool as Tier 0 (trivial, same bucket as `get_booking`).
- **Per-module data hooks to reuse for pickers** (verified present, no new data-fetching to build):

  | Module                      | Hook(s)                                                                                                    | File                                                   |
  | --------------------------- | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
  | Bookings                    | `useBookings`                                                                                              | `bookings/hooks/useBookings.ts`                        |
  | Properties                  | `useProperties`                                                                                            | `org/hooks/useOrganizations.ts`                        |
  | Parkings (entity)           | `useParkings`                                                                                              | `org/hooks/useOrganizations.ts`                        |
  | Parking bookings            | _(inline query in `ParkingBookingsPage.tsx` — no dedicated hook yet; extract one mirroring `useBookings`)_ | `parking/pages/ParkingBookingsPage.tsx`                |
  | Team (org/property/parking) | `useOrgTeam`, `usePropertyTeam`, `useParkingTeam`                                                          | `team/hooks/`                                          |
  | Finance                     | `useFinanceLineItems`                                                                                      | `finance/hooks/useFinanceLineItems.ts`                 |
  | Maintenance                 | `useMaintenanceItems`                                                                                      | `maintenance/hooks/useMaintenanceItems.ts`             |
  | Pricing                     | `usePropertyPricing`, `useParkingPricing`                                                                  | `pricing/hooks/`, `parking/hooks/useParkingPricing.ts` |
  | Inbox                       | `useInbox`                                                                                                 | `inbox/hooks/useInbox.ts`                              |
  | Marketing                   | `useMarketingTemplates`                                                                                    | `marketing/hooks/useMarketingTemplates.ts`             |
  | Notifications (in-app)      | `useNotifications`                                                                                         | `notifications/hooks/useNotifications.ts`              |
  | Telegram module config      | `useTelegram{Admin,Finance,Maintenance,Marketing,Staff}Settings`                                           | `notifications/hooks/`                                 |
  | Custom/public pages         | `useCustomPages`                                                                                           | `custom-pages/hooks/useCustomPages.ts`                 |
  | Help & Support tickets      | `useSupportTickets`                                                                                        | `help-support/hooks/useSupportTickets.ts`              |

- **No command-palette component exists yet** — `ui/src/components/ui/` has `dialog.tsx`, `sheet.tsx`, `bottom-sheet.tsx`, `alert-dialog.tsx`, but no `command.tsx`. Adding the cross-module picker means running `bunx shadcn add command` (pulls in `cmdk`), a new dependency.
- **Route/permission gating is uniform per module** — `team/lib/{org,property,parking}Permissions.ts`, `PROPERTY_SECTION_VIEW_PERMISSION` (`team/lib/propertyPermissions.ts:56-70`). The picker registry (below) keys off these same section ids so a picker is only offered where the host already has view access — no new permission model needed.

## UI/UX design — how this maps onto known chat-context patterns

Three UI shapes cover every case in this feature, each already precedented by mainstream AI products, applied to GFM's existing right-side `Sheet` panel:

1. **Anchored module quick-picker (keep today's pattern, generalize it).** Small-to-medium option sets, one module at a time — same shape as ChatGPT's `@`-mention, Cursor's `@file`, Linear's inline reference picker: a `Popover` off a toolbar button, filtered list, no context switch. This is what `ChatComposerBookingPicker` already does; it becomes one adapter among many on a shared generic component.
2. **Command-palette overlay for cross-module search ("Search everything").** When the option set is large or spans modules (e.g. "attach that maintenance reminder from last month" while sitting on the Finance page), a Raycast/Linear/Superhuman-style `Cmd/Ctrl+K` centered `CommandDialog` (shadcn `command.tsx` + `cmdk`) with grouped, fuzzy-searched results across all reusable hooks above. Opens from a "Search all modules…" row inside the quick-picker, or its own shortcut.
3. **Canvas overlay for content too rich for the chat bubble.** Modeled on Claude Artifacts / ChatGPT Canvas / Notion AI's side-peek: the inline thread always keeps a compact card (title + 1-2 line summary + "Open" button); the full render — large `data_table` (>8 rows), any `stepper`, or the command palette itself — lives in a second, wider panel. Desktop: the chat `Sheet` narrows and the canvas takes the rest of the width (split view). Mobile/tablet (375/768px per the `mobile-responsive` skill): canvas replaces the chat full-screen with a "Back to chat" affordance, never a second competing sheet.

This keeps the existing narrow chat `Sheet` legible while giving big content its own space — without introducing a fourth UI shape.

## Data contract changes

Replace the single booking-pin fields with a generalized, typed list. This is a clean replace, not a back-compat shim — nothing outside this feature area consumes these types.

**Frontend** (`ui/src/features/dashboard/ai-assistant/lib/`):

- New `AttachedContextItem` union in a new `lib/attachedContext.ts`: `{ type: 'booking' | 'property' | 'parking_booking' | 'team_member' | 'finance_item' | 'maintenance_item' | 'pricing_date' | 'inbox_conversation' | 'marketing_template' | 'notification_module' | 'public_page' | 'ticket'; id: string; label: string; propertyId?: string | null }`.
- `ChatSendInput` (`lib/chatAttachments.ts:22-28`) gains `attachedContext: AttachedContextItem[]`, replacing the singular `bookingId`/`propertyId`/`bookingLabel` fields (derive the booking-typed convenience fields where still needed, e.g. `pageBookingId` pin-to-top, from the array).
- `ChatComposer.tsx` local state becomes `attachedContext: AttachedContextItem[]` (was `pinnedBooking: PinnedBooking | null`); chip row (`:95-131`) maps over the array instead of a single optional value, one icon per `type`.

**Backend** (`supabase/functions/dashboard-assistant-chat/index.ts`):

- `pageContext` parsing (`:182-185`) stays as today (route-derived ambient scope: `propertyId`, `bookingId`) — this is the "what page am I on" signal, distinct from the new explicit attachment list.
- New `attachedContext` array parsed from the request body alongside `pageContext`, validated per-type (id format, RBAC-visible to this org/property — reuse the same `verifyPropertyAccess`/`verifyOrgAccess` calls already made for `pageContext`).
- System prompt builder generalizes the existing single `pinnedBookingLine` (`:300-302`) into a loop emitting one line per attached item, grouped by type, e.g. _"The host attached: Booking #1234 (Jane Doe, PENDING_DOCUMENTS); Maintenance reminder 'Pool pump service' (due 2026-08-20)."_
- Tool argument resolution helpers (`resolveTargetProperty`, `resolveBookingProperty`, `:181-210`) extended to check `attachedContext` for a matching type before falling back to `pageContext` — same precedence rule as today (explicit args → attachment → ambient page context).
- `classifyActionRisk`'s cross-scope escalation (`dashboardAssistantRiskClassifier.ts:218-228,241`) already compares a tool call's target against `pageContext`; extend the comparison set to include anything in `attachedContext` so pinning, say, a specific finance item doesn't itself trigger a false cross-scope escalation when the model acts on it.

## Component architecture

- **`ChatComposerContextPicker.tsx`** (new, generic) — the shared popover shell: search input, grouped/virtualized row list, "This page" pin-to-top slot, footer "Search all modules…" escalation row. Takes `items`, `renderRow`, `searchHaystack`, `groupBy`, `pageEntityId`, `onSelect` as props.
- **`ChatComposerBookingPicker.tsx`** becomes a thin adapter passing `useBookings` + the existing row renderer/grouping into the generic component — verify pixel-identical behavior after the refactor (this is a pure extraction, not a rewrite, done first so every later picker rides the same, already-proven UX).
- **`contextPickerRegistry.ts`** (new) — maps a module/section id (the same ids as `PROPERTY_SECTION_VIEW_PERMISSION`) to: entity type(s) offered, the hook to call, row renderer, singular/plural labels. The composer's "+" button reads the current route's module from this registry to decide which quick-picker(s) to surface as the fast path; anything not covered (or explicitly "search everything") routes to the command palette.
- **`ChatContextCommandPalette.tsx`** (new) — `CommandDialog` (after adding shadcn `command`), grouped sections per module pulling from the same registry + hooks, fuzzy search via `cmdk`'s built-in filtering.
- **`ChatCanvasOverlay.tsx`** (new) — the wider secondary panel described above; receives a block (or the command palette) and a `close` handler; owns the desktop split-view vs. mobile full-screen-replace layout logic.
- Composer attachment chips (`ChatComposer.tsx:95-131`) generalize to iterate `attachedContext`, one small type icon per chip (booking/property/finance/maintenance/team/inbox/marketing/pricing/notification/page/ticket) for scannability at a glance, matching the multi-attachment chip pattern used by ChatGPT/Cursor/Notion AI today.

## New response block types

Add to the triple-synced contract (frontend `aiAssistantApi.ts`, backend `dashboardAssistantSafetyGuard.ts` + `KNOWN_BLOCK_TYPES`, `BLOCKS_RESPONSE_SCHEMA`, `ChatBlockRenderer.tsx`):

| Block           | Shape                                                                                                                                                                         | Built by                                                                                                                                                                     | Renderer notes                                                                                                                                                                             |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `image`         | `{ type: 'image'; title: string; url: string; alt: string }`                                                                                                                  | Model requests via existing signed-URL tool results (property photos, marketing template thumbnails, design previews) — URL must be grounding-checked like `file_list` today | Inline `<img>`, not a preview-modal (distinct from `file_list`'s doc-preview use case)                                                                                                     |
| `stepper`       | `{ type: 'stepper'; title: string; steps: Array<{ label: string; status: 'done' \| 'current' \| 'upcoming'; description?: string; actionBlock?: ActionConfirmationBlock }> }` | **Application code only**, from a new read tool's structured result (never model free text) — mirrors `hydrateAssistantBlocksFromTools`                                      | Reuse the visual language of the existing `BookingStepper`/`WorkflowPanel` stage rail (`bookings/components/workflow-panel/`) so it looks native, not bolted on. Canvas-worthy by default. |
| `quick_actions` | `{ type: 'quick_actions'; actions: Array<{ label: string; prompt: string }> }`                                                                                                | Model, but constrained to short label/prompt strings only (no numeric literals, no URLs — cheap to ground-check, no new safety-guard surface)                                | Chip row below the message; tapping fills (not sends) the composer with `prompt`, letting the host edit before sending — a pure UX affordance, not itself an executable action             |

`assertBlocksGrounded` (`dashboardAssistantSafetyGuard.ts:169-215`) gets one addition per new type: `image.url` checked the same way as `file_list.files[].url` today; `stepper` is exempt from free-text grounding since it's application-constructed, not model-authored (same trust boundary as today's `hydrateAssistantBlocksFromTools` outputs); `quick_actions` skips numeric/URL checks by design (there are none to check).

## Booking journey read tool

New Tier-0 tool `plan_booking_journey(bookingId)` in `dashboardAssistantTools.ts`, alongside the existing `toolGetAvailableTransitions` (`:390`): calls the same `statusMachine.ts#bookingPipeline`/`nextStep` used by the client-side stepper today, returns the ordered list of remaining stages (including required sub-forms like `pricing`/`parking`/`guest_balance`/`sd_refund`) as structured data. `dashboardAssistantBlocks.ts` turns that result into a `stepper` block deterministically. **Execution is unchanged**: the host (or the model, per-turn) still calls `toolProposeTransitionBooking` one stage at a time, each rendered as its own embedded `action_confirmation` inside the current step of the stepper — no batch/bulk execution is introduced, preserving the architecture doc's explicit "never build bulk execution" stance and keeping `workflowOrchestrator.ts` as the sole transition path.

## Phase breakdown

### Phase 1 — Foundation: generalized attachment contracts

- [x] `AttachedContextItem` type (frontend `lib/attachedContext.ts`) + backend mirror/validation in `dashboard-assistant-chat/index.ts`
- [x] `ChatSendInput`/`ChatComposer` state migrated from single `pinnedBooking` to `attachedContext[]`; multi-chip row
- [x] System prompt builder generalized from `pinnedBookingLine` to a per-item loop
- [x] `resolveTargetProperty`/`resolveBookingProperty` extended to check `attachedContext` before `pageContext`
- [x] Extract `ChatComposerContextPicker.tsx` (generic) from `ChatComposerBookingPicker.tsx`; booking picker becomes its first adapter — verify no UX regression
- **Docs (same change)**: `docs/architecture/ai-dashboard-assistant.md` §"context model" updated to describe `attachedContext[]` replacing the single booking pin

### Phase 2 — Per-module quick pickers (registry + adapters, sequenced by value)

- [x] `contextPickerRegistry.ts` skeleton (module id → picker config)
- [x] 2a. Property picker (`useProperties`)
- [x] 2b. Team member picker — org/property/parking (`useOrgTeam`/`usePropertyTeam`/`useParkingTeam`)
- [x] 2c. Finance line item picker (`useFinanceLineItems`)
- [x] 2d. Maintenance item picker (`useMaintenanceItems`)
- [x] 2e. Parking booking picker — extract a `useParkingBookings` hook from `ParkingBookingsPage.tsx` first, then adapt
- [x] 2f. Inbox conversation picker, filterable by platform web/Facebook/Instagram (`useInbox`)
- [x] 2g. Marketing template picker (`useMarketingTemplates`)
- [x] 2h. Pricing date/range picker — bespoke small calendar-cell selector (different shape than list pickers; not a registry list adapter)
- [x] 2i. Notification/Telegram module picker — small fixed list (staff/finance/maintenance/marketing/admin), not a searchable data list
- [x] 2j. Custom/public page picker — small fixed list (`useCustomPages`, currently one page type)
- [x] 2k. Help & Support ticket picker (`useSupportTickets`)
- **Docs (same change)**: `docs/workflow/done/ai-dashboard-assistant-features.md` gets a "context pickers by module" bullet list as each sub-phase ships; `docs/guides/testing/ai-dashboard-assistant-manual.md` gets one manual-QA row per picker

### Phase 3 — Command palette overlay

- [x] `bunx shadcn add command` (adds `cmdk`) — hand-wrote `ui/src/components/ui/command.tsx` (`cmdk`); no `components.json` in this repo
- [x] `ChatContextCommandPalette.tsx` — grouped cross-module search over the same registry/hooks from Phase 2
- [x] "Search all modules…" escalation row wired into every Phase-2 quick-picker's footer
- **Docs (same change)**: architecture doc §UI updated with the two-tier picker model

### Phase 4 — New block types + canvas overlay

- [x] `image`, `stepper`, `quick_actions` added to the triple-synced `ChatBlock` contract (frontend, backend safety guard, `BLOCKS_RESPONSE_SCHEMA`, renderer switch)
- [x] `assertBlocksGrounded` extended per new type
- [x] `ChatCanvasOverlay.tsx` — split view (desktop) / full-screen replace (mobile, 375/768px breakpoints per `mobile-responsive` skill) — invoke that skill for this component
- [x] Inline compact-card + "Open in canvas" affordance for canvas-worthy blocks (`data_table` >8 rows, any `stepper`)
- **Docs (same change)**: architecture doc §3 block catalog table gets the 3 new rows; testing manual gets canvas-open/close flows

### Phase 5 — Booking journey orchestration

- [x] `plan_booking_journey` Tier-0 tool in `dashboardAssistantTools.ts`, reusing `statusMachine.ts#bookingPipeline`/`nextStep`
- [x] `dashboardAssistantBlocks.ts` hydration: tool result → `stepper` block, each step's current stage embeds the existing `action_confirmation` for that transition
- [x] Confirm no change to `toolProposeTransitionBooking`/`workflowOrchestrator.ts`/tier classification — this phase is additive-only
- **Docs (same change)**: architecture doc tool catalog gets `plan_booking_journey`; done-log gets the "guide me through a booking's remaining steps" host-facing capability

### Phase 6 — Starter suggestions & full docs sync

- [x] `assistantSuggestions.ts` — expand `ASSISTANT_QUESTIONS`/`ASSISTANT_ACTIONS` to cover parking, inbox, marketing, team, pricing, notifications, help & support (today: bookings/finance/maintenance only)
- [x] Full pass over `docs/architecture/ai-dashboard-assistant.md`, `docs/workflow/done/ai-dashboard-assistant-features.md`, `docs/guides/testing/ai-dashboard-assistant-manual.md` for consistency (these three already drifted from each other per this session's research — reconcile as part of landing this feature, not separately)
- [x] `route-guides` skill pass if any per-page composer/panel behavior changed enough to warrant a route-guide update

## Non-goals

- No new write tools and no change to the Tier 0/1/2 model, `dashboardAssistantRiskClassifier.ts` escalation rules, or `workflowOrchestrator.ts`/`statusMachine.ts` transition logic.
- No batch/bulk execution of multiple transitions or actions in one confirm — the stepper visualizes the journey; each stage is still confirmed individually, per the architecture doc's explicit "never build bulk execution" stance.
- No `flow_diagram`/Mermaid block, no free-form model-authored diagrams — deferred per the scope decision above; revisit only if a real use case beyond linear/branching steps appears.
- No token-level streaming (separate, pre-existing gap, not part of this feature).
- No changes to the platform AI credit/quota enforcement system (`aiUsageService.ts`/`aiCreditLedger.ts`) — new tool calls (picker searches don't call the model at all; `plan_booking_journey` is one more Tier-0 tool call, same cost class as `get_available_transitions`) ride the existing quota accounting unchanged.
- No new backend CRUD for pricing dates, Telegram config, or public pages beyond what's already shipped — Phase 2h/2i/2j are read-only pickers over existing small/fixed lists.

## Verification

1. `bun run type-check && bun run lint && bun run build` after each phase.
2. Manual E2E per the existing curl-first pattern in `docs/guides/testing/ai-dashboard-assistant-manual.md` §10 for any new/changed tool (`plan_booking_journey`), since this repo has no automated test suite.
3. Browser pass via `./dev.sh` for each new picker: open the assistant panel from the target module's page, confirm the quick-picker surfaces the right entity type, confirm the chip appears/removes correctly, confirm the attached item's id reaches the backend (check the resulting response references the pinned entity).
4. Command palette: verify cross-module search returns correctly grouped results and that "Search all modules…" is reachable from every Phase-2 picker.
5. Canvas overlay: verify split view at 1024px+, full-screen replace at 375px/768px (mobile-responsive skill's standard breakpoints), and that closing the canvas returns focus to the chat thread without losing composer state.
6. Stepper: on a booking with pending stages, ask "guide me through this booking's remaining steps," confirm the rendered stepper matches `bookings/lib/workflow.ts#bookingPipeline` for that same booking in the regular UI, and that confirming a stage's embedded action still round-trips through `dashboard-assistant-confirm` exactly as today's standalone `action_confirmation` blocks do.
7. Re-run the existing manual test doc's guardrail sections (permission re-check, cross-scope escalation, quota) unchanged, to confirm the new attachment model didn't loosen any existing check.
