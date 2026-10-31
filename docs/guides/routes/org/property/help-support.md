---
title: 'Property Help & Support'
status: active
tags: [guides, routes, org, property, help-support]
updated: 2026-09-05
---

# Property Help & Support

Route: `/org/:orgSlug/property/:propertySlug/help-support` (+ `/docs`, `/tickets`, `/tickets/new`, `/tickets/:ticketId`)

Announcements moved to dedicated sidebar route: [Announcements](./announcements.md) (`/announcements`). Legacy `/help-support/announcements` redirects there.

> **Status:** Documented

## Progress overview

| Section | E2E | Validation | Docs | Notes                                                    |
| ------- | --- | ---------- | ---- | -------------------------------------------------------- |
| FAQs    | Yes | N/A        | Yes  | Default view; up to eight property-scoped published FAQs |
| Guides  | Yes | N/A        | Yes  | Topic tiles, then articles for the chosen topic          |
| Tickets | Yes | Yes        | Yes  | Fill-height inbox: 400px list, docked composer           |
| Ask AI  | Yes | N/A        | Yes  | Opens the existing assistant panel, no new UI            |

## Overview

Property team members open Help & Support to find answers, chat with the AI assistant, and contact the Kame Homes team. FAQs, Guides, and Tickets stay under the same Help & Support title. Four clickable summary cards (same style as Finance and Bookings) stay at the top, with Ask AI last; FAQs, Guides, and Tickets swap the content below. Platform and development **Announcements** live on the dedicated [Announcements](./announcements.md) sidebar item. Visible to **every** non–plan-limited property team member (same baseline as the Help nav item). Route guard (`RequirePropertyPermission`) does **not** require `bookings:view` — plan-limited members still hit the plan gate.

## Host-facing knowledge

This is where you go if you're stuck, found something broken, or want to ask us something directly. FAQs cover common questions, Guides cover each page in more detail, Ask AI answers from your data, and Tickets is where you write to our team.

**Common host questions**

- Q: How do I report something broken?
  A: Open Help & Support, go to Tickets, tap New, choose Broken, describe what happened, and attach a screenshot or short video if you can. Our team gets notified right away. The ticket you were reading stays on the page behind the form.
- Q: Which ticket type should I pick?
  A: Broken if a page or feature isn't working. Idea if you want a feature added. Question if you need to know how something works. Business for billing, plans, or partnerships.
- Q: How do I know when someone replies to my ticket?
  A: You'll get an email. You can also open Tickets any time to see the latest status and read the conversation.
- Q: Can I reply after my ticket is closed?
  A: Closed tickets can't take new messages until you tap **Reopen ticket**. Resolved tickets still accept replies — that moves the ticket back to In progress.
- Q: Can I attach a video?
  A: Yes. Tickets about something broken can include up to 3 files — images up to 10 MB (compressed automatically before upload) or short videos up to 50 MB. Trim or compress a longer clip first; videos aren't re-encoded for you.
- Q: What's the difference between Ask AI and a ticket?
  A: Ask AI answers questions about your bookings and data right away. A ticket goes to our support team. Use a ticket when something is broken, you have an idea, or the assistant can't help.
- Q: What's the difference between FAQs and Guides?
  A: FAQs are the short common answers. Open Guides when you want the full picture for a page.
- Q: Do I need a specific role to see Help & Support?
  A: No. Every team member can see it, the same as the Dashboard.
- Q: Why do these FAQs differ from the organization Help page?
  A: Each Help & Support page shows common answers for that level — organization, this property, or a parking listing.

## FAQs

### Sections

Persistent **Help & Support** title and subtitle. Four clickable summary cards stay at the top: **FAQs**, **Guides**, **Tickets**, **Ask AI**. On desktop (`xl+`) they sit in one four-column row; below that they wrap as two columns (centered). The selected card uses a primary inset ring and tint. A centered title and one-line description sit under the cards for the active module. FAQs is selected on the default route. Content is up to eight published FAQs scoped to this **property** mount — one from each of bookings, property settings, property team, notifications, guest communication, finance, maintenance, and AI Assistant (in that order). Matched via category plus `source_route_guide_path` under `org/property/…` for team/finance. Org portfolio and parking-slot FAQs are omitted. No search. Guides and Tickets swap only the content below the cards. Clicking the already-selected Guides or Tickets card returns to FAQs. Accordion items are exclusive (one open at a time) with comfortable spacing.

### Behavior / edge cases

Ask AI does not navigate. It calls `openAiAssistant()`, which opens the existing assistant slide-over already mounted in `AdminLayoutShell` when the property plan includes **`aiDashboardAssistant`** (Business and above) and org/platform kill-switches allow it. If the plan tier blocks the assistant, the same click opens the **subscription upgrade** modal instead of doing nothing. That signal is one-shot: switching org, property, or parking remounts the admin shell and must not reopen the panel from a leftover request. Guides and Tickets keep nested URLs (`/docs`, `/tickets`) for deep links, but they are the same Help & Support page: the title, subtitle, and four cards stay mounted. Switching modules only replaces the content below the cards — it does not replay the admin page-enter animation.

## Guides

### Sections

Topic tiles first (Organization, Property, Parking, Guest pages), each with a centered title and a short description. No search on the tile grid. Opening a topic shows a larger centered title, the topic description, Back on the same row, then search for that topic’s articles. Article titles strip internal suffixes such as "operator guide" and URL paths. Articles are the Host-facing knowledge Q&A sections from every route guide (this one included), synced by `scripts/sync-ai-knowledge-base.ts` into `ai_dashboard_assistant_knowledge_base`. Super-admin-only guides (`docs/guides/routes/admin/**`) are excluded.

## Tickets

List, new ticket, and conversation live in one Tickets workspace (`/tickets`, `/tickets/new`, `/tickets/:ticketId`). The workspace fills remaining height under the Help cards (same fill-main pattern as Guest Inbox). Desktop is a split pane: ticket list at `lg:w-[min(100%,400px)]`, thread in the rest. The list header is **My Tickets** on the left, **New** on the right. **New** opens a modal (bottom sheet on phone) so the current thread stays visible; `/tickets/new` still opens that modal for deep links. Closing it without submitting asks to discard if the draft has content, then returns to the ticket you were on. Desktop with tickets auto-selects the first row so the idle “Pick a ticket” pane is skipped. Phone shows one pane at a time; Back lives in the thread header (`lg:hidden`), not above the split.

### Fields

| Field              | Category         | Storage                              | Validation                                                                                                                                                                         |
| ------------------ | ---------------- | ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Category           | all              | `support_tickets.category`           | Required: Broken, Idea, Question, or Business                                                                                                                                      |
| Subject            | all              | `support_tickets.subject`            | Required, ≤200 chars. Desktop: shares a row with Urgency (Broken) or reach-you (Business)                                                                                          |
| Description        | all              | first `support_ticket_messages`      | Required, ≤5000 chars                                                                                                                                                              |
| Severity           | Bug report       | `category_fields.severity`           | Required: low / medium / high (defaults to medium)                                                                                                                                 |
| Page URL           | Bug report       | `category_fields.page_url`           | Auto-filled, hidden                                                                                                                                                                |
| Browser info       | Bug report       | `category_fields.browser_info`       | Auto-filled, hidden                                                                                                                                                                |
| Attachments        | Bug report       | Storage `support-ticket-attachments` | Optional. 0–3 files. Images (`CONTENT`-optimized before upload) ≤ 10 MB; video ≤ 50 MB (not transcoded). `validateUploadFile` per kind; dashed dropzone + previews. HEIC accepted. |
| Contact preference | Business inquiry | `category_fields.contact_preference` | Required, ≤200 chars                                                                                                                                                               |

Required fields show a red `*`. Submit stays disabled until Subject and Details are filled (plus reach-you for Business), and any in-progress attachment upload finishes. Idea no longer has a “why it would help” field.

### Save path

1. Host attaches files (if any) → **`upload-support-ticket-attachment`** (POST, multipart) → private storage path returned.
2. Submit → **`submit-support-ticket`** (POST) → creates `support_tickets` row + first `support_ticket_messages` row (`sender_type='host'`).
3. Team notify email sent to `SUPPORT_TEAM_EMAIL` (best-effort — failure doesn't block submission).

## Ticket list and conversation

Lists the caller's own tickets with a status badge (Open / In progress / Resolved / Closed). Opening a row shows the reply thread in the same Tickets workspace. The thread is sticky header + status banner + scrolling messages + a docked composer when replies are allowed (bordered box, paperclip attach, Send on the right). Enter sends; Shift+Enter inserts a newline. Reply attach uses the paperclip control (up to 3 files) — the dashed dropzone stays on the new-ticket form only.

**Status flow (submitter):**

| Status             | Composer | Behavior                                                                                          |
| ------------------ | -------- | ------------------------------------------------------------------------------------------------- |
| Open / In progress | Shown    | Normal replies                                                                                    |
| Resolved           | Shown    | Banner explains resolution; placeholder “Reply to reopen…”; reply moves ticket to **In progress** |
| Closed             | Hidden   | Banner + **Reopen ticket** button; reopen sets status to **Open**, then composer returns          |

Empty and load-error states stay inside the list pane under **My Tickets** (icon well + title + retry). Closed rows in the list render slightly muted. New ticket compose is a modal, not a second pane.

## API reference

| Action               | Endpoint                                |
| -------------------- | --------------------------------------- |
| List articles        | `GET list-help-center-articles`         |
| List FAQs            | `GET list-help-center-faqs`             |
| Submit ticket        | `POST submit-support-ticket`            |
| List my tickets      | `GET list-support-tickets`              |
| Get ticket + thread  | `GET get-support-ticket`                |
| Reply to ticket      | `POST reply-support-ticket`             |
| Reopen closed ticket | `POST reopen-support-ticket`            |
| Upload attachment    | `POST upload-support-ticket-attachment` |

**Unsaved changes.** Leaving after editing asks to **Discard** or **Keep editing** (nothing is saved until you submit). Shared guard: [`unsaved-changes.md`](../../../../architecture/unsaved-changes.md).

## Implementation map

| Concern            | Path                                                                                                                                                                                                                                                                                                           |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Pages              | `ui/src/features/dashboard/help-support/pages/*.tsx` (`HelpSupportOverviewPage`, `HelpDocumentationPage`, `TicketsWorkspacePage`)                                                                                                                                                                              |
| Layout             | `ui/src/features/dashboard/help-support/components/HelpSupportLayout.tsx` (shell stays mounted; outlet only)                                                                                                                                                                                                   |
| Page enter         | `ui/src/features/dashboard/bookings/lib/adminPageTransitionKey.ts` — Help & Support subtree shares one animation key                                                                                                                                                                                           |
| Module nav         | `HelpSupportModuleNav.tsx` — `StatCard` / `StatCardGrid` from `@/components/shared/StatCard`                                                                                                                                                                                                                   |
| Section intro      | `HelpSectionIntro.tsx` — centered title + description under the cards                                                                                                                                                                                                                                          |
| Common FAQs        | `HelpCenterFaqAccordion.tsx` + `helpFaqModules.ts#pickCommonFaqs` — org = Getting Started (+ portfolio Parking); property = one per ops category (incl. AI); parking = slot/team/finance                                                                                                                       |
| Components         | `NewTicketModal.tsx` (compose overlay + discard confirm), `TicketThreadPanel.tsx` (inbox thread + status banner + docked composer), `TicketStatusBanner.tsx`, `TicketReplyComposer.tsx`, `TicketMessageBubble.tsx`, `TicketAttachmentDropzone.tsx` (`dropzone` + `composer` variants), `TicketComposeForm.tsx` |
| Hooks              | `ui/src/features/dashboard/help-support/hooks/*.ts`                                                                                                                                                                                                                                                            |
| API client         | `ui/src/features/dashboard/help-support/lib/supportTicketApi.ts`                                                                                                                                                                                                                                               |
| Edge functions     | `supabase/functions/{submit,list,get,reply}-support-ticket*`, `upload-support-ticket-attachment`, `list-help-center-{articles,faqs}`                                                                                                                                                                           |
| Scope resolution   | `supabase/functions/_shared/supportTicketScope.ts`                                                                                                                                                                                                                                                             |
| Route registration | `ui/src/features/dashboard/help-support/routes/index.tsx`                                                                                                                                                                                                                                                      |

---

## Testing

| Layer | Path / spec            | Manual                      |
| ----- | ---------------------- | --------------------------- |
| N/A   | Help docs + tickets UI | Manual QA when copy changes |

## Related docs

- [Route index](../../README.md)
- [Property Announcements](./announcements.md)
- [Org Help & Support](../help-support.md)
- [Parking Help & Support](../parking/help-support.md)
- [Super-admin ticket management](../../admin/support.md)
- [`docs/PROJECT.md`](../../../PROJECT.md)
- [`docs/workflow/in-progress/help-support-center.md`](../../../workflow/in-progress/help-support-center.md)

## Pending / follow-ups

- [ ] Super-admin ticket reply/status UI is at `/admin/support` — see [admin/support.md](../../admin/support.md).
