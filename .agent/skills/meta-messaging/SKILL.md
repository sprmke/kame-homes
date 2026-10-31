---
name: meta-messaging
description: Meta Messenger + Instagram inbox integration — OAuth, webhooks, send API, App Review checklist. Use when working on meta-inbox-* edge functions or Meta developer app setup.
---

# Meta Messaging skill

## Products required

- **Messenger Platform** (Facebook Page DMs)
- **Instagram** → Messenger API for Instagram (DMs)

## Env vars

| Var                                 | Purpose                                         |
| ----------------------------------- | ----------------------------------------------- |
| `META_APP_ID`                       | Facebook app id                                 |
| `META_APP_SECRET`                   | App secret (webhook signature + token exchange) |
| `META_INBOX_TOKEN_ENCRYPTION_KEY`   | 32-byte AES key (64 hex chars)                  |
| `META_WEBHOOK_VERIFY_TOKEN`         | GET webhook verification string                 |
| `META_OAUTH_ALLOWED_RETURN_ORIGINS` | SPA origins for OAuth return                    |

## Webhook URL

`{SUPABASE_URL}/functions/v1/meta-inbox-webhook`

Subscribe fields: `messages`, `message_echoes`, `messaging_postbacks`, `message_deliveries`, `message_reads`.

## OAuth scopes

`pages_messaging`, `pages_manage_metadata`, `pages_read_engagement`, `pages_show_list`, `instagram_manage_messages`, `business_management`

## Key Graph endpoints

| Action    | Endpoint                                                     |
| --------- | ------------------------------------------------------------ |
| Page list | `GET /me/accounts`                                           |
| Subscribe | `POST /{page-id}/subscribed_apps`                            |
| Send DM   | `POST /{page-id}/messages`                                   |
| Backfill  | `GET /{page-id}/conversations?platform=messenger\|instagram` |

## App Review checklist

See **`docs/archive/operations/meta-app-review.md`**. Screencast must show: sign in → Channels → Connect with Meta → receive message → reply from Guest Inbox.

## Policy reminders

- 24-hour standard messaging window for promotional content
- Human Agent tag (manual only) extends to 7 days — not implemented in v1
- No cold outbound DMs
