---
title: 'Guest Inbox — E2E runbook (local + staging)'
status: active
tags: [operations, inbox]
updated: 2026-08-02
---

# Guest Inbox — E2E runbook (local + staging)

Use this checklist to verify the inbox against **live Meta APIs** before Meta App Review or production rollout.

UI-only work can use mock mode (`VITE_INBOX_MOCK_DATA=true` or `?mock=true`). E2E requires mock **off**.

## Prerequisites

1. Migration **`20260910120000_social_inbox.sql`** applied (`supabase db reset` or push on staging).
2. Signed-in user has property **`inbox:view`**, **`inbox:reply`**, **`inbox:manage`** (org Owner/Admin inherit via property access).
3. Edge secrets in **`supabase/.env.local`** (see **`supabase/.env.example`** → Guest Inbox section):
   - `META_APP_ID`, `META_APP_SECRET`
   - `META_INBOX_TOKEN_ENCRYPTION_KEY` (`openssl rand -hex 32`)
   - `META_WEBHOOK_VERIFY_TOKEN` (any random string; must match Meta dashboard)
   - `META_OAUTH_ALLOWED_RETURN_ORIGINS=http://127.0.0.1:5173,http://localhost:5173`
4. UI: **`VITE_INBOX_MOCK_DATA`** unset or `false` in **`ui/.env.development`**; restart Vite after change.
5. AI suggest (optional): `GEMINI_API_KEYS` and/or `GROQ_API_KEY` in edge env.

## Meta developer app setup

1. Create or use a Meta app with **Facebook Login for Business** and **Webhooks**.
2. Add redirect URI (OAuth callback — public edge function):
   - Local: `http://127.0.0.1:54321/functions/v1/meta-inbox-oauth-callback`
   - Staging/prod: `https://<project-ref>.supabase.co/functions/v1/meta-inbox-oauth-callback`
3. Request permissions (see **[[meta-app-review|Meta app setup — Guest Inbox + Marketing Content Studio]]**):
   - `pages_messaging`, `pages_manage_metadata`, `pages_read_engagement`, `pages_show_list`
   - `instagram_manage_messages`, `business_management`
4. Development mode: add test users and a Facebook Page you admin; link Instagram Business to the Page.

**Local HTTPS (required for Meta OAuth):** Meta rejects `http://127.0.0.1` OAuth redirects. Run ngrok on port **54321**, set in **`supabase/.env.local`**:

```bash
PUBLIC_API_URL=https://<your-ngrok-host>
```

(`SUPABASE_PUBLIC_URL` is also copied to `PUBLIC_API_URL` on `./dev.sh` start — the CLI strips `SUPABASE_*` from the edge container.)

Restart **`./dev.sh`**. In Meta → **Facebook Login for Business → Settings**, add **Valid OAuth Redirect URI**:

```
https://<your-ngrok-host>/functions/v1/meta-inbox-oauth-callback
```

Copy exact URLs from **Inbox → Channels → Setup URLs** after restart.

## Webhook (required for inbound messages)

Meta must POST to your **`meta-inbox-webhook`** function.

### Local (tunnel)

1. Run `./dev.sh` (Supabase + edge functions + Vite). **`dev.sh` starts `ngrok http 54321` automatically** when `ngrok` is on PATH (skip with `SKIP_NGROK=1 ./dev.sh`). Copy the printed HTTPS URL into **`supabase/.env.local`** as `PUBLIC_API_URL`, then restart `./dev.sh` if you change it.
2. Meta → Webhooks → Page → Callback URL:
   ```
   https://<your-ngrok-host>/functions/v1/meta-inbox-webhook
   ```
3. Verify token: same as **`META_WEBHOOK_VERIFY_TOKEN`**.
4. Subscribe fields: `messages`, `message_echoes`, `messaging_postbacks`, `message_deliveries`, `message_reads` on **Page** and **Instagram** webhooks.

### Staging / production

Callback URL:

```
https://<project-ref>.supabase.co/functions/v1/meta-inbox-webhook
```

No tunnel needed; ensure secrets are set in Supabase Dashboard → Edge Functions.

## E2E test flow

| Step | Action                                                             | Expected                                                                                       |
| ---- | ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------- |
| 1    | Open `/org/:orgSlug/property/:propertySlug/inbox` (no mock banner) | Empty list shows **Connect Meta** or thread list                                               |
| 2    | **Channels** → **Connect**                                         | Meta OAuth; single Page connects immediately; multiple Pages → **Choose Facebook Page** dialog |
| 3    | Channels tab                                                       | Facebook + Instagram rows **connected** (webhook warning if subscribe failed)                  |
| 4    | Send a Messenger or IG DM to the Page                              | Webhook ingests; thread appears in list via Realtime                                           |
| 5    | Open thread, reply in composer                                     | Message sends; appears outbound; guest receives on platform                                    |
| 6    | **Suggest** (✨)                                                   | AI draft fills composer (needs Gemini/Groq)                                                    |
| 7    | **Quick replies** modal                                            | Create template; insert from composer                                                          |
| 8    | **Automation**                                                     | Save instructions; optional **Send automatically** + platform toggles                          |
| 9    | Mark read                                                          | Opening thread clears unread badge                                                             |
| 10   | **Disconnect** (Channels)                                          | Tokens removed; threads stop updating                                                          |

## Troubleshooting

| Symptom                                                     | Check                                                                                                                                                                                   |
| ----------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Connect button errors “Meta app credentials not configured” | `META_APP_ID` in edge env; restart functions                                                                                                                                            |
| Facebook “isn't using a secure connection” on Connect       | Set `PUBLIC_API_URL=https://<ngrok-host>` in `supabase/.env.local` (or `SUPABASE_PUBLIC_URL` — copied on `./dev.sh` start); add matching OAuth redirect URI in Meta; restart `./dev.sh` |
| `permission denied for table social_*`                      | Apply migration **`20260913120000_social_inbox_service_role_grants.sql`** (`supabase migration up` or db reset)                                                                         |
| OAuth “Invalid return origin”                               | `META_OAUTH_ALLOWED_RETURN_ORIGINS` includes your Vite origin                                                                                                                           |
| Connect succeeds, no threads                                | Webhook URL + verify token; ngrok still running locally                                                                                                                                 |
| Reply fails “window expired”                                | Meta 24h rule — send a new inbound message first                                                                                                                                        |
| Realtime not updating                                       | RLS + org membership; browser logged in as same user                                                                                                                                    |
| AI suggest 503                                              | Gemini/Groq keys; quota                                                                                                                                                                 |

## After local E2E passes

1. Record screencast per **[[meta-app-review|Meta app setup — Guest Inbox + Marketing Content Studio]]**.
2. Submit Meta App Review for Advanced Access.
3. Deploy edge secrets to production Supabase project.
4. Point production webhook to hosted **`meta-inbox-webhook`**.

## Known limits (v1)

- TikTok / Airbnb inbox channels: **not planned** — no public messaging API partnership; Channels UI is Meta-only.
- Property-level channel overrides: not implemented (org-scoped only).

## Related

- Route guide: **[[guides/routes/org/inbox]]**
- Permissions: **`inbox:*`** in **`propertyTeamPermissions.ts`** / parking equivalents
- Rule: **`.cursor/rules/social-inbox.mdc`**
