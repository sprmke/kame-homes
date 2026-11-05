---
title: 'Chat templates in Inbox and AI Assistant'
status: active
tags: [workflow, in-progress, inbox, templates, ai-assistant]
updated: 2026-10-28
stage: in-progress
kind: plan
---

# Chat templates in Inbox and AI Assistant

Use a property's standard and custom templates from the Templates page inside chat: send them to a guest from the Inbox composer, and attach them to the AI Assistant as context.

## Progress

| Phase                       | State | Notes                                                                                                                                                                                                                                                                                  |
| --------------------------- | ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Data + server            | Done  | Migration, `chatTemplateMessage.ts`, `social-inbox-send` template path, `chat-templates` list/preview, audit action                                                                                                                                                                    |
| 2. Inbox UI                 | Done  | Insert menu Templates section, preview sheet with full screen, rich bubble, guest card, mock preview data                                                                                                                                                                              |
| 3. AI Assistant             | Done  | `property_template` type, catalog row, prompt injection, module suggestions, pinned-chip preview                                                                                                                                                                                       |
| 4. Docs + tests             | Done  | Route guides, edge/data docs, Deno unit tests, 2 `@ci` Playwright specs                                                                                                                                                                                                                |
| 5. Assistant answer quality | Done  | Attached template copy is injected into the prompt; `get_property_template_content` tool reads any non-email template by key/name; deterministic fallback answers from attached/tool template text instead of "Which listing or dates should I use?"; prompt forbids page-only answers |

Manual QA left: send a template from a live web thread and open it on the guest side; send to a Facebook/Instagram thread and confirm the flattened text; attach a template in the AI Assistant, ask what it says, then ask again after the pin is removed (tool path). Local `db:migrate` is blocked by a pre-existing `gmail_listener_state` migration on this database, not by this change.

Follow-up (not blocking): `RichTextDisplay.tsx` carries a copy of the property-template rich-text CSS so guest chat does not import TipTap. Extract the shared style constant from `RichTextEditor.tsx` in a dedicated refactor pass so the editor and chat renderer cannot drift.

## Goal

A host can pick **Stay guide / custom** templates (never email templates) from:

1. Property Inbox composer → Insert (`+`) → **Templates**.
2. AI Assistant composer → Pin context → **Templates**.

Selecting a template shows the full preview before it is sent or attached. Web chat renders the template as a rich card that matches Templates preview. Meta DMs receive flattened text. The AI Assistant receives the template body as untrusted context.

## Decisions

| Decision           | Choice                                                                                                                                       |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Source of truth    | `property_template_contents` (property-scoped). No new template library.                                                                     |
| Categories         | `standard` and `custom` only. `email` is excluded everywhere.                                                                                |
| Message storage    | `social_messages.message_kind` + `template_snapshot` JSONB. Snapshot at send time so edits and deletes never rewrite history.                |
| Web chat rendering | Rich card in the bubble. Tapping opens the full preview in a `ResponsiveModal` (bottom sheet below `lg`).                                    |
| Meta DMs           | Server flattens the rendered template to plain text. Message stays `text` so host and guest see the same thing.                              |
| AI context         | New attached type `property_template`; server injects the template body as untrusted context.                                                |
| Plans              | No new key. Standard templates are free; custom templates already inherit `customTemplates` (Starter+) because they cannot exist without it. |
| Permissions        | Inbox listing uses `inbox:view`; sending uses `inbox.messages:edit` through the existing reply capability. AI listing uses `templates:view`. |
| Audit              | `inbox.chat_template_sent` via `logActivity`, after the message row is written.                                                              |

## Phase 1: data and server

- Migration: `social_messages.message_kind` (`text` | `template`, default `text`) and `social_messages.template_snapshot` JSONB.
- `_shared/chatTemplateMessage.ts`:
  - load a non-email property template by key, for standard and `custom-*`;
  - resolve placeholders from property branding, conversation participant, and an optional matched booking;
  - strip unresolved tokens;
  - flatten HTML to plain text for Meta, previews, and conversation subject lines.
- `social-inbox-send`: accept `templateKey` and optional `bookingId`; validate the template belongs to the conversation's property; render; write the snapshot; emit the audit event.
- `chat-templates` edge function: read-only list for the Inbox picker. Requires `inbox:view` and returns non-email templates for the property.

## Phase 2: Inbox UI

- Insert (`+`) menu gets a **Templates** section above Snippets. Rows show the template name and category.
- Selecting a row opens `ChatTemplatePreviewDialog`: template name, category, optional section image, sanitized rich body, and one primary action.
  - Web: **Send**.
  - Meta: **Send** (server flattens).
- `ChatMessageBubble` accepts a template snapshot and renders `ChatTemplateCard`: title, two-line excerpt, expand affordance.
- Same card renders in the guest web chat thread. Tapping opens the same preview.
- Template messages cannot be edited. Unsend stays available.
- Optimistic send is skipped for template messages; the thread refetches on success.

## Phase 3: AI Assistant

- Add `property_template` to attached context types, UI mirror, icon map, and catalog group **Templates**.
- Catalog loads `usePropertyTemplates`, filters email, labels rows by template name with the updated date as subtitle.
- Server verifies property access from `propertyId`, loads the template, strips HTML, and appends it to the attached-context prompt inside `inlineUntrusted`.
- The Templates page's assistant picker now highlights **Templates** instead of public pages.

## Phase 4: docs and tests

- Route guides: `org/property/inbox.md`, `org/assistant.md`, `org/property/templates.md`.
- Unit tests: template render and flatten (Deno), attached-context parsing (existing suites).
- E2E: Inbox Insert → Templates → preview → send → bubble → expand; AI picker shows Templates.
- `bun run ci:quality` plus targeted Deno and Playwright runs.

## Out of scope

- Sending email templates from chat.
- Editing or creating templates from chat.
- Parking templates (parking has no templates module; the Templates section stays hidden).
- Voice receptionist template context.
