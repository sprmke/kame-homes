---
stage: done
title: 'AI Dashboard Assistant — Turn progress, thinking transparency & task plans'
status: done
tags: [planning, ai, dashboard, ux]
updated: 2026-08-31
---

# AI Dashboard Assistant — Turn progress, thinking transparency & task plans

Make the dashboard assistant feel like ChatGPT Agent / Claude / Cursor: hosts see **what the AI is doing** during a turn (not just three dots), get an honest **activity timeline** after multi-tool turns, and — for complex workflows — a **task plan checklist** with live step status.

Related: [`../../architecture/ai-dashboard-assistant.md`](../../architecture/ai-dashboard-assistant.md) · [`../done/ai-dashboard-assistant.md`](../done/ai-dashboard-assistant.md) · [`../../guides/testing/ai-dashboard-assistant-manual.md`](../../guides/testing/ai-dashboard-assistant-manual.md)

## Goal

The assistant today is a black box: send message → bouncing dots → finished cards. That hides 66 tools, multi-round Gemini loops, grounding, and safety checks — and makes Pro-tier “smart assistant” value invisible.

Ship process visibility in three layers:

1. **During the turn** — phased progress UI (generic until SSE lands, then live tool events).
2. **After the turn** — collapsible `activity_timeline` block built from real server-side tool execution (never model-invented).
3. **Multi-step workflows** — `task_plan` block (Cursor-style checklist) for 2+ tool turns or explicit “walk me through…” guides; live updates via SSE in Phase 1b.

## Scope

### In

| Phase  | Deliverable                                                                                                                                        |
| ------ | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| **1a** | Shared tool label map (UI + edge), `activity_timeline` block, `TurnActivityRecorder`, richer `AssistantTurnProgress`, post-turn timeline in thread |
| **1b** | SSE on `dashboard-assistant-chat`, client `EventSource`, live tool/plan events during wait                                                         |
| **2**  | `task_plan` block + `TaskPlanBlock` UI, hydrate from tool rounds + booking journey, SSE `plan` / `plan_update` events                              |
| **3**  | Stream text blocks, cancel in-flight turn, regenerate, elapsed timer                                                                               |

### Out (this plan)

- Raw chain-of-thought / full Gemini thinking tokens (summarized bullets only, if ever).
- Fake tool names during wait before SSE (Phase 1a uses honest generic phases only).
- Scheduled/recurring agent tasks (ChatGPT-style).
- Raising `MAX_TOOL_ROUNDS` beyond 4 (separate backlog item; document in architecture when changed).
- True Gemini token streaming (post-synthesis chunk preview only).

## Approach

### Transport

| Phase | Pattern                                                                                                                                          |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1a    | Single POST; server appends `activity_timeline` to `blocks[]`; client shows generic phased wait UI                                               |
| 1b+   | `Accept: text/event-stream` on same endpoint; JSON lines: `phase`, `tool_start`, `tool_done`, `plan`, `plan_update`, `text_*`, `blocks`, `error` |

### New block types (application-hydrated, not in Gemini schema)

```typescript
// activity_timeline — appended by TurnActivityRecorder after each turn
{ type: 'activity_timeline', entries: ActivityTimelineEntry[] }

// task_plan — Phase 2; multi-step agent checklist
{ type: 'task_plan', title: string, steps: TaskPlanStep[] }
```

Both skip numeric grounding (same as `stepper` / `quick_actions`).

### Shared tool labels

Single map in `supabase/functions/_shared/assistantToolLabels.ts` mirrored in `ui/src/features/dashboard/ai-assistant/lib/assistantToolLabels.ts` — **keep in sync** on every new tool. Used by activity timeline, SSE events, and `BookingAiAssistantAuditCard`.

### SSE event contract (Phase 1b+)

```typescript
type AssistantStreamEvent =
  | { type: 'phase'; phase: 'understanding' | 'planning' | 'executing' | 'synthesizing' | 'safety' }
  | { type: 'tool_start'; toolName: string; label: string }
  | { type: 'tool_done'; toolName: string; ok: boolean; durationMs: number }
  | { type: 'plan'; steps: TaskPlanStep[] }
  | { type: 'plan_update'; stepId: string; status: 'pending' | 'running' | 'done' | 'failed' }
  | { type: 'text_start' }
  | { type: 'text_chunk'; delta: string }
  | { type: 'blocks'; blocks: ChatBlock[]; conversationId: string }
  | { type: 'error'; message: string; aborted?: boolean };
```

## Implementation tasks

### Phase 1a — Post-turn activity + honest wait UI

- [x] Plan doc + workflow index
- [x] `supabase/functions/_shared/assistantToolLabels.ts` — all 66 tools, `progress` / `done` / `failed` variants
- [x] `ui/.../lib/assistantToolLabels.ts` — mirror
- [x] `supabase/functions/_shared/dashboardAssistantActivity.ts` — `TurnActivityRecorder`, `prependActivityTimeline`
- [x] `dashboardAssistantSafetyGuard.ts` — `activity_timeline` on `ChatBlock` + `KNOWN_BLOCK_TYPES`; skip grounding
- [x] `dashboard-assistant-chat/index.ts` — record understanding → tools → synthesizing → safety; prepend timeline when tools ran
- [x] `ui/.../lib/aiAssistantApi.ts` — `ActivityTimelineEntry`, `activity_timeline` on `ChatBlock`
- [x] `ActivityTimelineBlock.tsx` — collapsible “What I did” (collapsed when ≤2 entries)
- [x] `AssistantTurnProgress.tsx` — replace dots; generic phases + elapsed seconds
- [x] `ChatThread.tsx` — use `AssistantTurnProgress`; pass `sendStartedAtMs`
- [x] `ChatBlockRenderer.tsx` — render `activity_timeline`
- [x] `BookingAiAssistantAuditCard.tsx` — import shared `assistantToolLabels`
- [ ] Manual test: booking lookup, multi-tool finance query, Tier-2 proposal short-circuit

### Phase 1b — SSE live progress

- [x] `dashboard-assistant-chat/index.ts` — branch on `Accept: text/event-stream`; `ReadableStream` encoder
- [x] Emit events at each tool start/done, synthesis start, safety check
- [x] `ui/.../lib/assistantStream.ts` — `streamChatMessage()` with fetch reader + JSON fallback
- [x] `useAiAssistantChat.ts` — `turnProgress` state from stream
- [x] `AssistantTurnProgress.tsx` — live tool rows when stream events present
- [x] `cors.ts` — `accept` in Allow-Headers
- [x] Update `docs/architecture/edge-functions.md` + `docs/architecture/ai-dashboard-assistant.md`

### Phase 2 — Task plan block

- [x] `task_plan` on `ChatBlock` (UI + safety guard)
- [x] `dashboardAssistantActivity.ts` — `TurnTaskPlanRecorder` when 2+ tools in one round (accumulates across rounds)
- [x] `TaskPlanBlock.tsx` — checklist UI
- [x] SSE `plan` / `plan_update` during execution
- [ ] Hydrate plan steps on Tier-2 short-circuit (confirm nested on current step) — deferred; booking journey uses `stepper`
- [x] Route guide + manual test guide update

### Phase 3 — Delivery polish

- [x] Stream `text` block chunks in SSE (`text_start`, `text_chunk` with paint delays)
- [x] Cancel → AbortController + server turn abort + cleanup uncommitted user row; client reloads thread
- [x] Regenerate last turn via `regenerate: true` (no duplicate user row; attachments rejected)
- [x] Usage meter in panel header (`todayMessageCount / dailyMessageLimit`)
- [x] Production hardening (2026-08-31): history-during-send abort, synthesizing phase after tools, Tier-2 synth status before prepend, safer abort detection

## Files (primary)

| Area          | Path                                                                                   |
| ------------- | -------------------------------------------------------------------------------------- |
| Edge labels   | `supabase/functions/_shared/assistantToolLabels.ts`                                    |
| Edge activity | `supabase/functions/_shared/dashboardAssistantActivity.ts`                             |
| Chat turn     | `supabase/functions/dashboard-assistant-chat/index.ts`                                 |
| Block types   | `supabase/functions/_shared/dashboardAssistantSafetyGuard.ts`                          |
| UI labels     | `ui/src/features/dashboard/ai-assistant/lib/assistantToolLabels.ts`                    |
| UI API types  | `ui/src/features/dashboard/ai-assistant/lib/aiAssistantApi.ts`                         |
| Progress      | `ui/src/features/dashboard/ai-assistant/components/AssistantTurnProgress.tsx`          |
| Timeline      | `ui/src/features/dashboard/ai-assistant/components/blocks/ActivityTimelineBlock.tsx`   |
| Task plan     | `ui/src/features/dashboard/ai-assistant/components/blocks/TaskPlanBlock.tsx` (Phase 2) |
| Hook          | `ui/src/features/dashboard/ai-assistant/hooks/useAiAssistantChat.ts`                   |
| Thread        | `ui/src/features/dashboard/ai-assistant/components/ChatThread.tsx`                     |

## Docs to update

| When          | Doc                                                                                         |
| ------------- | ------------------------------------------------------------------------------------------- |
| Phase 1a ship | `docs/architecture/ai-dashboard-assistant.md` § Response blocks                             |
| Phase 1b ship | `docs/PROJECT.md` API table, `docs/architecture/edge-functions.md`                          |
| Phase 2 ship  | `docs/guides/routes/` (help-support AI chat section if behavior visible), manual test guide |
| Done          | Move this file to `docs/workflow/done/`, update scratchpads                                 |

## Progress log

| Date       | Phase     | Notes                                                                         |
| ---------- | --------- | ----------------------------------------------------------------------------- |
| 2026-08-30 | Plan      | Created; analysis from agent session                                          |
| 2026-08-30 | 1a        | Shipped — labels, activity_timeline, AssistantTurnProgress                    |
| 2026-08-30 | 1b        | Shipped — SSE stream + live turnProgress UI                                   |
| 2026-08-30 | 2         | Shipped — task_plan block + TurnTaskPlanRecorder (multi-tool batches)         |
| 2026-08-30 | 3         | Shipped — text streaming, cancel, regenerate, usage meter in header           |
| 2026-08-31 | Hardening | Production review fixes — regenerate API, cancel cleanup, stream paint, races |

## Open questions

- **Gemini thinking summary:** defer; tool activity gives most of the “smart” feel without exposing raw reasoning.
- **Default collapse:** timeline collapsed when ≤2 entries; expanded when 3+ tools — tune after dogfooding.

## Exit criteria

- [x] Host sees phased progress during every send (not bare dots).
- [x] Multi-tool turns show collapsible “What I did” with real tool labels and durations.
- [x] SSE live updates work on local `./dev.sh` stack (client always requests stream; falls back to JSON).
- [x] Multi-step batches show `task_plan` with step statuses updating live (2+ tools in one Gemini round).
- [x] No fake tool names before backend events exist.
- [x] Cancel / regenerate / history-switch races handled without orphan or duplicate messages.
- [ ] Manual browser QA (§2.4 of manual test guide).
- [ ] `bun run ci:quality` passes (repo-wide; may include unrelated failures).
