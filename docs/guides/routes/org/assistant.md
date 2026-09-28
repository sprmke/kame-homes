---
title: 'AI mode (full-page assistant) — operator guide'
status: active
tags: [guides, routes, ai, assistant]
updated: 2026-09-28
---

# AI mode (full-page assistant) — operator guide

Route: every `/org/:orgSlug/…`, `/org/:orgSlug/property/:propertySlug/…` and `/org/:orgSlug/parking/:parkingSlug/…` page, in **AI** mode. Query params: `?chat=<conversationId>`, `?canvas=off`, `?mode=ai|advanced` (one-shot).

> **Status:** Documented. Plan and decisions: [`workflow/in-progress/ai-chat-mode.md`](../../../workflow/in-progress/ai-chat-mode.md).

## Progress overview

| Section                     | E2E save | Validation | Docs | Notes                                                    |
| --------------------------- | -------- | ---------- | ---- | -------------------------------------------------------- |
| Mode toggle + preference    | Done     | Done       | Done | Server + local cache; `?mode=`; Cmd/Ctrl+J               |
| Rail (chats, scope)         | Partial  | Done       | Done | Rename / pin / archive / delete / search; list is mocked |
| Chat column + composer      | Done     | Done       | Done | Shared with the Advanced sheet                           |
| Briefing home               | Done     | —          | Done | Read-only cards                                          |
| Page canvas                 | Done     | —          | Done | Resize, close, Open in Advanced                          |
| Open handoffs (`open_page`) | Done     | Done       | Done | Allowlisted screens, permission re-checked               |
| Feedback                    | Done     | Done       | Done | Thumbs up / down per reply                               |
| Phone / tablet              | Done     | —          | Done | Single bottom layer; canvas full screen with Back        |
| Slash commands + @mentions  | Done     | Done       | Done | `/` actions and prompts, `@` pins context                |
| Memory                      | Done     | Done       | Done | Own preferences; house style needs AI settings edit      |

---

## Overview

Hosts choose between **Advanced** (the classic dashboard with the assistant in a bottom-right panel) and **AI** (a chat-first workspace). In AI mode the real dashboard pages open in a canvas beside the chat, so anything the assistant cannot do in chat is one tap away on the exact screen. Switching keeps the conversation, the draft and the page.

---

## Host-facing knowledge

AI mode turns the dashboard into a chat workspace. Ask questions or ask for changes in plain words; the page you were on stays open beside the chat, and the assistant can open any screen for you with an **Open** button. Changes that matter still ask you to confirm first. Switch back to **Advanced** at any time; your chat and the page stay where they were.

**Common host questions**

- Q: How do I switch to AI mode?
  A: Use the **Advanced | AI** switch at the top of the sidebar, in your account menu, or on your phone at the top of the screen or under **More**. On a computer you can also press Cmd+J (Mac) or Ctrl+J (Windows).
- Q: I don't see the AI switch.
  A: AI mode appears only when the AI assistant is turned on for your organization and your role can use the assistant. If it shows a lock, your plan does not include the assistant yet; tap it to see upgrade options.
- Q: The assistant says "AI is off". How do I turn it on?
  A: Tap **Open AI settings** on that card. It takes you to the AI section in Settings, where you can switch AI on for your organization. If you don't see the button, ask your organization owner to turn it on.
- Q: The assistant says it is turned off by the platform admin.
  A: AI has been turned off for the whole platform, so it can't be turned on from your Settings. Contact support if you need it.
- Q: Will I lose my chat or my page when I switch?
  A: No. The same conversation, your unsent message and the page you had open carry over in both directions.
- Q: What are the cards on the empty chat screen?
  A: They show what needs attention today, like bookings waiting for review or check-ins. Tap one to ask the assistant about it.
- Q: Can the assistant do everything for me?
  A: It can answer questions and make most everyday changes after you confirm. Some things always happen on their own screen, like connecting Facebook, paying for a plan, editing designs, or deleting a property. For those it gives you an **Open** button that takes you straight there.
- Q: How do I find an old conversation?
  A: Your chats are listed on the left (or under the clock icon on your phone). Search by name, and use the menu on a chat to rename, pin, archive or delete it.
- Q: How do I edit what I asked?
  A: Hover your message and tap the pencil, or press the Up arrow in an empty message box. The answer after it is replaced. Changes that were already made are not undone.
- Q: What do the thumbs do?
  A: They tell us whether an answer helped, so we can improve the assistant. Tap the same thumb again to remove it.
- Q: Can the assistant remember how I like things?
  A: Yes. Say "remember that…" in the chat, or open **Memory** (the brain button at the top of the chat, or type /memory). Your preferences are private to you. Admins can also add a house style that applies to everyone in your organization. Memory never lets the assistant skip a confirmation.
- Q: What are the / and @ shortcuts?
  A: Type / in the message box for quick commands like /today, /review or /memory. Type @ to attach a booking, listing or other item so the assistant knows what you mean.
- Q: Can I open a booking from a list the assistant shows?
  A: Yes. Tap any row in the table, or a booking card, to open that booking.
- Q: Why do some words show as bold or in a box?
  A: The assistant highlights key words, like a status or a count. Copy gives you plain text without the formatting.
- Q: Why does a step say it failed?
  A: Some checks only work in certain places, like a finance check that needs one listing. Hover or tap the ? next to the step to see why. The answer still uses what the other checks found.
- Q: Can I make the page wider?
  A: Yes. Drag the thin handle between the chat and the page. Close the page with the X, or bring it back with **Show page**.

This section is written for an AI assistant to quote directly to hosts — no code, no DB column names, no internal endpoint names.

---

## Mode toggle + preference

| Item            | Storage                                                                           | Rule                                                                          |
| --------------- | --------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Dashboard mode  | `user_ui_preferences.dashboard_mode` + localStorage `kame-admin-ui-mode:<userId>` | `advanced` or `ai`; server wins on load unless the host switched this session |
| Platform switch | `ai_dashboard_assistant_global_settings.ai_mode_enabled`                          | Super admin, default off; needs the assistant kill switch on too              |

### Save path

1. Toggle / Cmd+J / `?mode=` → `PATCH user-ui-preferences { dashboardMode }` (fire and forget) + localStorage.
2. The layout switches inside a View Transition (framer fallback, 150ms fade with reduced motion). On phone / tablet, entering AI adds `?canvas=off` so the chat shows first.

### Gating

Hidden when the kill switch, the org assistant opt-in, the per-property disable list, `assistant:view`, or the platform AI mode switch blocks it; never on `/admin/*`. Plan-blocked (`aiDashboardAssistant`) shows a lock that opens the upgrade modal. A saved `ai` silently falls back to Advanced whenever AI mode is not usable. While access loads, the cached mode is kept (no flash).

---

## Rail (desktop) / chats drawer (phone, tablet)

Scope switcher, **New chat**, notifications bell, chat list (Pinned, Today, Yesterday, Earlier; server search; Load more), mode toggle, usage (`today/limit`), account menu. Rail collapses to 64px (saved per viewer); below a 1200px screen it stays collapsed while a page is open, and its collapse button is hidden until the page closes. Row menu: Rename (inline, 80 chars), Pin / Unpin, Archive (also unpins), Delete (confirm). Below `lg` the list opens as a bottom sheet (phone) or left drawer (tablet).

---

## Chat column + composer

Same thread and composer as the Advanced sheet (one shared session). Assistant turns render unboxed at up to 760px; hover row: Copy, Regenerate (last turn), thumbs. User messages: pencil to edit and resend. Composer: Enter sends, Shift+Enter newline, Up arrow edits the last message, Esc stops a reply, 1–8 lines. Offline banner disables sending but keeps the draft. Type `/` for commands (`/new`, `/review`, `/today`, `/balance`, `/finance`, `/maintenance`, `/inbox`, `/mode` when the switch is usable, `/memory`, `/help`); `@` lists bookings, listings and other items to pin as context. After an error, **Retry** re-runs the turn. Stopping before the reply is saved puts the text back in the box.

### AI is off

Which switch is off decides what the host sees. `GET dashboard-assistant-settings` returns `aiBlocker` (`platform` \| `organization` \| null); a blocked chat turn returns `aiBlocker` (`platform` \| `organization` \| `property`) with the error, then settings and access refetch.

| Blocker                                                             | Viewer                                                  | What shows                                                                                                   |
| ------------------------------------------------------------------- | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Org AI master switch                                                | Owner, platform admin or `org.settings.aiPlatform:edit` | Composer replaced by **AI is off** + **Open AI settings** → `/org/:orgSlug/settings#section-ai`              |
| Property AI switch (reported by a turn only)                        | Same                                                    | **AI is off for this property** + **Open AI settings** (turning the org switch on re-enables every property) |
| Either of the above                                                 | Anyone else                                             | Same card, asks them to contact the owner (no button)                                                        |
| Platform switch or `dashboard_assistant` missing from the allowlist | Everyone                                                | Composer stays. Sending shows the red error "The AI assistant is turned off by the platform admin." + Retry  |

Hosts cannot lift a platform block, so it never shows the card or a link. The card shows before the host types for an org block, and after a failed turn for a property block. A mini switch on the card slides to on when the CTA is hovered or focused (no motion with reduced motion). **Try again** shows when a failed turn can be retried. Turning AI on in Settings refreshes the assistant queries, so the composer comes back without a reload. Resolver: `lib/assistantAiOff.ts` (unit tested).

---

## Memory

Opened from the Memory button (brain icon; AI rail next to the bell, and the Advanced sheet header) or `/memory`. Same dialog on both surfaces (bottom sheet on phone).

| Field            | Storage                                                                | Validation                                                                                                                               |
| ---------------- | ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Your preferences | `ai_dashboard_assistant_memories` (`kind = preference`, own `user_id`) | 1–300 chars, whitespace collapsed; safety-bypass text rejected; duplicates rejected (case, spacing and a closing period ignored); max 20 |
| House style      | same table (`kind = house_style`, org-wide)                            | Same rules; max 10; add / remove needs owner, platform admin or `org.settings.aiAssistant:edit` (read-only otherwise)                    |

Save path: **Add** (or Enter) → `POST dashboard-assistant-memory` → row inserted → list refetches. Trash → `DELETE ?id=`. House style changes log `ai.config_changed`. Closing with an unsent draft asks Save / Discard / Keep editing (`useGuardedClose`). The assistant can also save a preference itself with `remember_preference` (Tier 1) when the host asks it to remember something. Every turn reads the list into the prompt as data; it never overrides confirmation or permission rules.

---

## Briefing home (empty thread)

Greeting plus up to 6 cards from the same numbers as the dashboard (pending review, awaiting documents, check-ins, check-outs, SD refunds, unpaid balances) and 4 starter chips. Tapping a card sends its question. Refreshes every minute.

---

## Page canvas

The current route renders in a card beside the chat (desktop), resizable with the gutter or arrow keys (560px to 60vw, keeping the chat at least 360px; default 55vw capped at 900px, saved per viewer). Below a 1200px screen the left rail stays collapsed while a page is open so both fit; closing the page brings it back. Header: page title, **Open in Advanced**, close (X / Esc). Closing goes to the scope root with `?canvas=off`; **Show page** reopens it. Below `lg` the canvas covers the screen with **Back**. The page stays mounted when switching modes. The pane sets `data-canvas-size` (`medium` < 760px) so wide `lg:` / `xl:` grids collapse to 2 columns and Settings / Templates drop their side nav; page and card headers wrap their actions below the title.

---

## Open handoffs

When a task is done in the UI (connect Meta, checkout, OTP, editors, booking create or edit, import commit, deletes, payment credentials), the reply includes an **Open** card. The server checks the host can view that section before returning the link. In AI mode it opens in the canvas and keeps `?chat=`; in Advanced it navigates and closes the sheet.

Booking tables in answers link each row to its booking detail page the same way (booking cards already did). The server matches rows to bookings from that turn's tool results (`rowTargets`); rows it cannot match stay plain text. In AI mode the table stays open in the chat column so the host can open the next row.

Reply text renders markdown instead of showing the symbols: bold, italic, strikethrough, inline code, https links, headings, quotes, dividers and pipe tables (shared `ChatRichBody` + `lib/chat/inlineMarkdown.ts`). Stat, flow and table cells format the same way. **Copy** pastes plain text without the markers.

---

## API reference

| Action                                      | Endpoint                                                                             |
| ------------------------------------------- | ------------------------------------------------------------------------------------ |
| Read / save mode                            | `GET` / `PATCH user-ui-preferences`                                                  |
| Platform AI mode switch                     | `PATCH dashboard-assistant-global-settings { aiModeEnabled }`                        |
| Availability                                | `GET dashboard-assistant-settings` (`platformEnabled`, `aiModeEnabled`, `aiBlocker`) |
| Briefing cards                              | `GET dashboard-assistant-briefing`                                                   |
| Chat list / rename / pin / archive / delete | `GET` / `PATCH` / `DELETE dashboard-assistant-conversations`                         |
| Send, regenerate, edit & resend             | `POST dashboard-assistant-chat` (`editMessageId`)                                    |
| Thumbs                                      | `POST dashboard-assistant-feedback`                                                  |
| Memory list / add / remove                  | `GET` / `POST` / `DELETE dashboard-assistant-memory`                                 |

---

## Implementation map

| Concern        | Path                                                                                                                                                                                                                                                                                                                                                                                                                        |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Layout         | `ui/src/features/dashboard/bookings/components/AdminLayout.tsx`                                                                                                                                                                                                                                                                                                                                                             |
| Mode           | `ui/src/features/dashboard/ai-assistant/components/DashboardModeProvider.tsx`, `DashboardModeToggle.tsx`, `lib/dashboardMode.ts`, `lib/modeTransition.ts`                                                                                                                                                                                                                                                                   |
| Session        | `ui/src/features/dashboard/ai-assistant/components/AiAssistantSessionProvider.tsx`, `lib/aiAssistantSessionContext.ts`, `hooks/useAiAssistantChat.ts`                                                                                                                                                                                                                                                                       |
| AI mode chrome | `ui/src/features/dashboard/ai-assistant/components/full-page/AiModeChrome.tsx`, `BriefingHome.tsx`                                                                                                                                                                                                                                                                                                                          |
| Canvas         | `ui/src/features/dashboard/ai-assistant/hooks/useCanvasResize.ts`, `lib/canvasWidth.ts`, `lib/assistantScope.ts`                                                                                                                                                                                                                                                                                                            |
| Memory         | `components/AssistantMemoryDialog.tsx`, `AssistantMemoryButton.tsx`, `hooks/useAssistantMemory.ts`, `supabase/functions/dashboard-assistant-memory`, `_shared/dashboardAssistantMemory.ts`                                                                                                                                                                                                                                  |
| Shared chat    | `ChatThread.tsx`, `SessionChatComposer.tsx`, `AssistantStatusNotices.tsx`, `AssistantAiOffCard.tsx`, `ConversationHistoryList.tsx`, `blocks/OpenPageBlock.tsx`, `blocks/DataTableBlock.tsx` (row links; server match in `_shared/dashboardAssistantBlocks.ts`)                                                                                                                                                              |
| AI off         | `lib/assistantAiOff.ts`, `lib/assistantStream.ts#aiBlockerFromError`, `_shared/aiUsageService.ts#resolveAiFeatureBlocker` / `aiDisabledScope`                                                                                                                                                                                                                                                                               |
| Edge functions | `supabase/functions/user-ui-preferences`, `dashboard-assistant-briefing`, `dashboard-assistant-feedback`, `dashboard-assistant-conversations`, `dashboard-assistant-chat`                                                                                                                                                                                                                                                   |
| Shared (edge)  | `_shared/dashboardAssistantRoutes.ts`, `_shared/dashboardAssistantNavigationTools.ts`, `_shared/dashboardAssistantParity.ts`, `_shared/dashboardStatsScope.ts`                                                                                                                                                                                                                                                              |
| Tests          | `ui/e2e/features/assistant/assistantAiMode.spec.ts`, `lib/assistantSurfaceParity.test.ts`, `supabase/functions/tests/assistantParityManifest.test.ts`, `tests/aiChatModeLocal.integration_test.ts`, `_shared/dashboardAssistantBlocks_test.ts` (table row targets), `ui/src/lib/chat/inlineMarkdown.test.ts` + `parseChatRichBlocks.test.ts` (markdown), `_shared/assistantToolFailureReason_test.ts` (failed step reasons) |

---

## Related docs

- [`architecture/ai-dashboard-assistant.md`](../../../architecture/ai-dashboard-assistant.md) §9
- [`PROJECT.md`](../../../PROJECT.md) § AI Dashboard Assistant
- [`testing/ai-dashboard-assistant-manual.md`](../../testing/ai-dashboard-assistant-manual.md) § AI mode

## Pending / follow-ups

- [ ] Canvas grid collapse covers standard `grid-cols-*` grids and `AdminPageHeader`; flex-based two-pane layouts still use viewport breakpoints.
