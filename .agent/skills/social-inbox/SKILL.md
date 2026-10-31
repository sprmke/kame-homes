---
name: social-inbox
description: Guest Inbox at property and parking — Meta OAuth, webhooks, unified threads, quick replies, AI suggest/auto-reply. Use when implementing or extending ui/src/features/dashboard/inbox or social-inbox / meta-inbox edge functions.
---

# Social Guest Inbox skill

## Routes

| Scope    | UI path                                      | Page                    |
| -------- | -------------------------------------------- | ----------------------- |
| Property | `/org/:orgSlug/property/:propertySlug/inbox` | `PropertyInboxPage.tsx` |
| Parking  | `/org/:orgSlug/parking/:parkingSlug/inbox`   | `ParkingInboxPage.tsx`  |

Org `/org/:orgSlug/inbox` redirects to Properties. Shared shell: `InboxPage.tsx`. Guides: `docs/guides/routes/org/property/inbox.md`, `org/parking/inbox.md`.

## Architecture map

| Layer            | Path                                                                                                                                                                                                                                                                                                                                                                                                      |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Types (server)   | `supabase/functions/_shared/socialInboxTypes.ts`                                                                                                                                                                                                                                                                                                                                                          |
| Scope resolve    | `supabase/functions/_shared/metaInboxScope.ts`                                                                                                                                                                                                                                                                                                                                                            |
| Inbox auth       | `supabase/functions/_shared/inboxAccess.ts`                                                                                                                                                                                                                                                                                                                                                               |
| DB helpers       | `supabase/functions/_shared/socialInboxService.ts`                                                                                                                                                                                                                                                                                                                                                        |
| Meta Graph       | `supabase/functions/_shared/metaInboxGraph.ts`                                                                                                                                                                                                                                                                                                                                                            |
| Connect/life     | `supabase/functions/_shared/metaInboxConnect.ts`, `metaInboxLifecycle.ts`                                                                                                                                                                                                                                                                                                                                 |
| Webhook ingest   | `supabase/functions/_shared/metaInboxWebhookHandler.ts`                                                                                                                                                                                                                                                                                                                                                   |
| AI replies       | `supabase/functions/_shared/socialInboxAiService.ts`                                                                                                                                                                                                                                                                                                                                                      |
| UI API           | `ui/src/features/dashboard/inbox/lib/inboxApi.ts`                                                                                                                                                                                                                                                                                                                                                         |
| UI hooks         | `ui/src/features/dashboard/inbox/hooks/useInbox.ts`                                                                                                                                                                                                                                                                                                                                                       |
| Insert menu      | `ui/src/features/dashboard/inbox/components/InboxInsertMenu.tsx` — composer `+` popover: property links, public pages, map link, payment methods text, booking search/auto-match; inserts plain URLs/text (no new message type); tap cards via `ui/src/lib/chat/parseChatRichBlocks.ts#urlLinkCardMeta`. Helpers: `lib/inboxBookingShareRows.ts`, `lib/inboxMatchBooking.ts`, `lib/inboxInsertContent.ts` |
| Host attachments | `upload-inbox-chat-asset/` + `lib/inboxChatAttachment.ts` — web chat paperclip (JPEG/PNG/WebP/PDF); Meta remains text-only in UI                                                                                                                                                                                                                                                                          |
| Doc share token  | `supabase/functions/_shared/bookingDocumentShareToken.ts`, `issue-booking-document-share-token/`, `get-guest-booking-document/` — durable GAF/Pet PDF share links (mirrors `guestStayGuide.ts`); see `docs/guides/routes/guest-booking-document.md`                                                                                                                                                       |

## Scope model

- **Org Meta** = `social_channel_connections` with `property_id`/`parking_id` null (default for all units). First property Meta connect creates this when missing.
- **Override** = row with `property_id` or `parking_id` set. Effective connection = override if connected, else org default.
- **Web** at property: `property_id` filter. Parking web guest chat deferred (`parking_id` column ready).
- **Meta threads (1A):** inherited scope shows full org Page thread list + “Using org Meta”.
- **Quick replies / Automation:** property is org-scoped (`social_reply_templates`/`social_inbox_settings` row with `parking_id IS NULL`); parking gets its own scoped row(s) (`parking_id` set) with parking-specific default quick replies (`_shared/inboxDefaultQuickReplies.ts#INBOX_DEFAULT_PARKING_QUICK_REPLIES`). Both are managed from the respective Manage UI (`inbox:manage`). Meta (Channels/Facebook/Instagram) is **property-only** — parking has no Meta connect UI and its platform filter is Chat (`web`) only (no **All** tab / switcher when a single channel is available).

Pass `property_id` or `parking_id` on every inbox edge call; `resolveInboxAccess` requires one of them. Any direct `social_inbox_settings` query must filter by `parking_id` (`.is('parking_id', null)` for the org/property-default row, `.eq('parking_id', ...)` for a parking row) — the column is no longer globally unique per `organization_id`.

## Permissions

| Property / parking |
| ------------------ |
| `inbox:view`       |
| `inbox:reply`      |
| `inbox:manage`     |

## Manage menu

1. **Messages** — property + parking
2. **Channels** — property only (`showChannelsTab`); parking has no Meta connect
3. **Quick replies** / **Automation** — property + parking (`showSettingsManageTabs`)

## Related rules

- `.cursor/rules/social-inbox.mdc`
- `.cursor/skills/meta-messaging/SKILL.md`
- Plan: `docs/workflow/done/inbox-org-property-parking.md`
