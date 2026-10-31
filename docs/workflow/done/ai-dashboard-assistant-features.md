---
title: 'AI Dashboard Assistant — Feature List'
status: v1 + v2 + attachment parity shipped
tags: [workflow, done, ai, reference]
updated: 2026-09-02
stage: done
---

# AI Dashboard Assistant — what shipped

A companion reference to [`ai-platform-hardening-handoff.md`](./ai-platform-hardening-handoff.md) (full build log), [`ai-dashboard-assistant-v2-full-coverage.md`](./ai-dashboard-assistant-v2-full-coverage.md) (v2 phases), and [`ai-assistant-attachment-actions-and-coverage.md`](./ai-assistant-attachment-actions-and-coverage.md) (attachment + parity — **done**). This doc lists **what the feature actually does today**, in plain terms. Manual test flows: [`docs/guides/testing/ai-dashboard-assistant-manual.md`](../../guides/testing/ai-dashboard-assistant-manual.md). Full tool catalog: [`docs/architecture/ai-dashboard-assistant.md`](../../architecture/ai-dashboard-assistant.md) (**99 tools**).

## What it is

A chat assistant embedded in the admin dashboard. Hosts and property managers can ask natural-language questions about their operational data and, for a fixed set of actions, ask the assistant to make changes — with guardrails that scale to how risky the action is.

## Core capabilities

### 1. Ask questions about live data (read-only, always allowed)

- **Search the knowledge base** — "how does PENDING_DOCUMENTS work?", "what does Ready for Check-in mean?" — answered from the 219 Q&A entries synced from the 67 operator route guides, not the model's memory.
- **Look up a single booking** — status, guest name, dates, property, balance due, and files already on the booking (approved GAF, receipts, IDs) as in-chat previews.
- **List bookings** — filtered by property, status, or date range.
- **See what a booking can do next** — the exact set of status transitions available right now, same source of truth the workflow panel uses.
- **Guide a booking through remaining steps** — a stepper that matches the booking pipeline (done / current / upcoming). Confirming the current step still uses the same Confirm card as any other status move — it does not batch the whole journey.
- **Dashboard stats** — check-ins/check-outs/occupancy for a property or the whole org.
- **Finance summary** — income, expenses, net for a property (only visible to users with finance access).
- **Finance bookings list** — bookings with finance figures for a property.
- **Maintenance summary** — open/completed maintenance items for a property (only visible to users with maintenance access).
- **Maintenance items list** — scheduled maintenance for a property.

None of these can ever modify data — they're wired so a read tool physically cannot call the booking-transition machinery.

### 2. Take action, with three levels of trust

Every action the assistant can propose is automatically classified into one of three tiers **by reading the same rules the rest of the app already enforces** — never by asking the AI model to judge its own risk:

| Tier                            | What it means                                                                                                                                                                                          | Example                                                                                |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------- |
| **Tier 0 — Read**               | No confirmation, ever — it's just a question.                                                                                                                                                          | "How many bookings are pending review?"                                                |
| **Tier 1 — Done automatically** | A safe, forward, non-financial action executes immediately; the assistant tells you it did it.                                                                                                         | "Move this booking to Ready for Check-in" (once documents are ready, no price changes) |
| **Tier 2 — Needs your OK**      | Anything destructive, a backward/override move, anything touching money, or anything on a booking you're not currently looking at — the assistant proposes it and waits for an explicit Confirm click. | "Cancel this booking", any refund finalization, any price/deposit change               |

Concretely, write actions span bookings (transitions, cancel, document apply, workflow emails), finance/maintenance CRUD, org/team/property/parking settings (allowlisted fields), pricing (single-date), parking claim/decline, inbox reply (text + web attachments), Meta publish (URL or chat attachment), marketing drafts, support ticket create, verification/listing-auth submit, channel sync, public-page template pick, and more — each with the tier rules in the architecture doc.

If the assistant tries to act on a booking or property the host isn't currently viewing, or bundles more than one write action into a single request, that also automatically escalates to Tier 2 — "confirm before we touch something you didn't ask about."

### 3. Guardrails that don't trust the AI model

- Every tool independently re-checks the requesting user's actual permissions against the database — the model asking for something is never sufficient on its own.
- Immediately before any action executes (whether auto-run or confirmed), the risk tier is **recomputed from the booking's current status** — not the status from when the action was first proposed. If anything changed in between, the mismatch blocks execution.
- Every chat response is checked that its numbers and facts actually came from real data loaded for that request — not invented by the model.
- A confirmed Tier-2 action can only be executed once, by the same person who asked for it, through a separate confirm step — never as a side effect of the model "changing its mind" or a retried request.
- Tier-2 proposals expire after 15 minutes if nobody confirms them.

### 4. Where you see it

- A floating assistant button on every admin dashboard page (org, property, and parking admin views) — hidden on super-admin pages and hidden entirely if the assistant isn't turned on.
- A slide-over chat panel: ask a question, get an answer rendered as readable cards (booking cards, stat lists, tables, links, file previews, photos, a booking-journey stepper, suggested follow-up chips) — never raw text dumps or hallucinated HTML.
- **Starter prompts:** new chat centers a **Questions / Actions** mode switch (filled teal pill, not page tabs) and **5** prompt cards. Tapping one sends it as a message. With no context pinned, prompts are a **random** pool covering bookings, finance, maintenance, parking, inbox, marketing, team, pricing, Help & Support, and Telegram. Once the host pins context (a booking, a property, a finance item, …), the prompts switch to that module's **most common questions and actions, ranked**; pinning several modules together mixes each module's top prompts fairly instead of favoring one module. All prompts map to tools that exist (or knowledge-base how-tos).
- **Mid-conversation pill suggestions:** each pinned context chip in the composer is also a button (text shifts to the primary teal on hover or while open) that opens a compact **Questions / Actions** popover with that single module's ranked prompts. Tapping a prompt sends it as a new chat message carrying the currently pinned context — so the host can drill into one pinned module mid-conversation without retyping. The X still removes the pin.
- **Composer attachments + context pin:** paperclip menu (Photo / File) and a **module quick-picker** beside the message box. Attached files can be **applied onto a booking** (approved GAF, IDs, receipts, …) via Confirm — not vision-only. Pinning adds a chip (`attachedContext`).
- **Context pickers by module** (icon on that page's composer):
  - Bookings / dashboard — stays, grouped by check-in month
  - Properties / plans / settings — properties
  - Team — org, property, or parking members
  - Finance — income/expense rows
  - Maintenance — reminders
  - Parking bookings — parking stays
  - Inbox — conversations, filterable by Web / Facebook / Instagram
  - Marketing — templates
  - Calendar / parking pricing — a date on the month grid
  - Notifications — Staff / Finance / Maintenance / Marketing / Admin
  - Public pages / templates — Stay guide (and any other custom pages)
  - Help & Support — tickets
- **History:** clock icon lists your chats grouped by day, with search. Titles wrap (UUIDs stripped for the preview). Trash deletes that conversation after confirm — only yours, and it cannot be undone.
- Every proposed action renders as a card with **Confirm** / **Cancel** buttons; once resolved it flips to "done automatically" / "cancelled" / "expired" so the history stays readable.
- **Canvas:** a long table (more than 8 rows) or a booking-journey stepper shows a compact card in the thread with **Open**. On a laptop the sheet widens and the canvas sits beside chat; on a phone the canvas replaces chat until **Back**. Suggested chips **fill** the message box — they do not send.
- **Booking detail pages** show a read-only "Actions taken by AI assistant" trail — every automatic or confirmed action taken on that specific booking, with when and what.

### 5. Who controls it

- **Platform-wide switch** (super-admin) — turns the assistant off everywhere in one click, independent of every other AI feature in the app.
- **Per-org switch** (org owner/admin) — each organization opts in; off by default.
- **Per-property opt-out** — an org can enable the assistant overall but exclude specific properties.
- **Daily and monthly message limits** + **daily write-action limit** per org, configurable in org settings — hitting the limit shows a friendly "upgrade for more" message instead of failing.

## Attachment apply & host upload parity (2026-09)

Hosts attach files in the composer (≤3 × 4 MB). The assistant can **apply** those files to the same backend slots as the dashboard — always Tier 2 Confirm, with **overwrite warnings** when a slot already has a file. Apply works **later in the same conversation** via stored `attachmentPath` (path allowlist: `{orgId}/{userId}/{conversationId}/…`).

| Area                               | What chat can do                                                                                                                                     |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Booking documents**              | All `upload-booking-asset` types (GAF, pet, IDs, receipts, parking, SD refund). Optional **compound** upload + mark GAF/pet complete in one confirm. |
| **Workflow emails**                | All five `send-booking-workflow-email` kinds — external_send Send button.                                                                            |
| **Org / property / parking media** | Team logo, property gallery, parking cover, GAF signature, external review images, template section/inline images.                                   |
| **Verification & listing auth**    | Org verification assets + submit; listing authorization proofs + submit.                                                                             |
| **GCash QR**                       | Stage image for property **or** parking — OTP commit still required in Payment settings (no bypass).                                                 |
| **Inbox**                          | Web chat replies with optional attachments; Meta DMs text-only.                                                                                      |
| **Support**                        | List/get/create tickets with optional attachments.                                                                                                   |
| **Marketing**                      | Publish to Meta using a chat attachment or https URL.                                                                                                |
| **Ops**                            | Channel sync status + sync now; public page template selection; finance/maintenance update/delete.                                                   |
| **Guidance (deep-link)**           | New booking modal, CSV import wizard, notification/Telegram settings — honest UI finish when no safe write API exists.                               |

Shared upload logic lives in `_shared/bookingAssetUpload.ts`, `assistantAttachmentApply.ts`, and sibling `*Upload.ts` helpers — thin edge endpoints call the same modules.

## What it can't do (by design, not by accident)

- No parking **broadcast** fan-out from chat (claim/decline of a single parking stay is available).
- No **bulk / multi-date pricing** writes from chat (single-date tools only until diff-preview design).
- No **property/parking payment-method PATCH**, email automation toggles, or doc-requirement overrides from chat until dedicated validators exist (OTP parity).
- No **admin booking field edits** via chat — create/import/deep-link only; use booking detail or Guest Form modal.
- No **notification preference writes** or **Telegram credential PATCH** from chat — read + deep-link to Notifications.
- No **import CSV auto-commit** from chat — Import UI owns preview/confirm.
- No **ticket thread replies** or status changes from chat — Tickets workspace only.
- No direct editing of arbitrary booking fields beyond allowlisted tools.
- No cross-organization actions, ever.
- No unattended/scheduled runs — every action is a direct result of something a signed-in user typed.
- No real-time token streaming — replies arrive as a complete message, not word-by-word.
