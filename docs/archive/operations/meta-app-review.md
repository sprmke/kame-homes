---
title: 'Meta app setup — Guest Inbox + Marketing Content Studio'
status: active
tags: [operations]
updated: 2026-08-02
---

# Meta app setup — Guest Inbox + Marketing Content Studio

Complete guide for configuring your Meta app so **Connect with Meta** in Kame succeeds with **all** OAuth scopes (inbox messaging + content publishing).

If OAuth shows **Invalid Scopes: pages_manage_posts, instagram_content_publish**, the permission names are correct — your app has not added the matching **use cases** yet. Follow this doc first, then reconnect.

**Related:** local E2E checklist → [inbox-e2e-runbook.md](./inbox-e2e-runbook.md)

---

## What Kame requests on connect

On **Org → Inbox → Channels → Connect with Meta**, edge code requests these scopes (`metaInboxConfig.ts` → `getMetaOAuthScopes()`):

| Scope                       | Used for                                                 |
| --------------------------- | -------------------------------------------------------- |
| `pages_show_list`           | List Facebook Pages the user manages (Page picker)       |
| `pages_read_engagement`     | Read Page engagement; dependency for several permissions |
| `pages_manage_metadata`     | Subscribe Page webhooks, read Page settings              |
| `pages_messaging`           | **Guest Inbox** — Messenger DMs to the Page              |
| `pages_manage_posts`        | **Marketing** — publish photo posts to Facebook Page     |
| `instagram_basic`           | Instagram account ID / profile metadata                  |
| `instagram_manage_messages` | **Guest Inbox** — Instagram DMs                          |
| `instagram_content_publish` | **Marketing** — publish IG feed posts, stories, reels    |
| `business_management`       | Business Manager assets; required when Pages live in BM  |

**Escape hatch:** set `META_OAUTH_EXCLUDE_PUBLISHING_SCOPES=1` in edge env to request inbox scopes only (temporary workaround while configuring publishing use cases).

---

## Prerequisites

1. **Meta app type:** Business app at [developers.facebook.com](https://developers.facebook.com) (not a “Consumer” gaming app).
2. **Login product:** **Facebook Login for Business** (or Facebook Login with Business configuration) — Kame uses Page tokens via Facebook Login, not Instagram Login-only OAuth.
3. **Assets:**
   - A **Facebook Page** you admin
   - An **Instagram Professional** account (Business or Creator) **linked to that Page**
   - For publishing tests: your Meta user must have **CREATE_CONTENT** (or **MANAGE**) on the Page / IG account
4. **Roles:** Until App Review completes, only **app admins, developers, and testers** can complete OAuth without errors. Add your Facebook account under **App roles** → **Roles**.

---

## Scope → Meta use case mapping

Meta’s dashboard groups permissions under **Use cases**. Add the use cases below, then **Customize** each and tick the permissions listed.

| Kame scope                  | Add this use case (dashboard name may vary slightly)                                                                                             | Permissions to enable inside the use case |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------- |
| `pages_show_list`           | **Manage Pages** or **Engage with customers on Messenger from Instagram & Facebook**                                                             | `pages_show_list`                         |
| `pages_read_engagement`     | Same as above (Page / messaging use cases)                                                                                                       | `pages_read_engagement`                   |
| `pages_manage_metadata`     | **Manage Pages** and/or messaging use case                                                                                                       | `pages_manage_metadata`                   |
| `pages_messaging`           | **Engage with customers on Messenger from Instagram & Facebook**                                                                                 | `pages_messaging`                         |
| `instagram_manage_messages` | **Engage with customers on Messenger from Instagram & Facebook**                                                                                 | `instagram_manage_messages`               |
| `business_management`       | Often auto-included with Page/messaging use cases; if missing, add **Manage business assets** or enable under **Business management** permission | `business_management`                     |
| `pages_manage_posts`        | **Manage everything on your Page** (or **Manage Pages** → content publishing section)                                                            | `pages_manage_posts`                      |
| `instagram_basic`           | **Manage messaging & content on Instagram** or **Instagram API with Facebook Login**                                                             | `instagram_basic`                         |
| `instagram_content_publish` | **Manage messaging & content on Instagram** (content publishing)                                                                                 | `instagram_content_publish`               |

**Minimum use cases to add (recommended set):**

1. **Engage with customers on Messenger from Instagram & Facebook** — inbox scopes
2. **Manage everything on your Page** (or **Manage Pages**) — `pages_manage_posts`
3. **Manage messaging & content on Instagram** — `instagram_basic`, `instagram_content_publish` (and often comments/messages if not already covered)

If a use case is not in your app yet: **App dashboard → Use cases → Add use cases →** search and add the three above.

---

## You only see “Messenger from Meta” (common)

If your screen looks like **Use cases → Customize → Messenger from Meta → Permissions and features**, you are in the **messaging** use case only. That list will show `pages_messaging`, `instagram_manage_messages`, `pages_manage_metadata`, etc. — but **not** `pages_manage_posts` or `instagram_content_publish`. Those permissions belong to **other use cases** you must add separately.

### Get `pages_manage_posts`

1. Click **← Use cases** (top left breadcrumb) to leave Messenger customize
2. On the use cases overview, click **Add use cases**
3. Search and add **Manage everything on your Page** (sometimes labeled **Manage Pages**)
4. Open that new use case → **Customize** → **Permissions and features**
5. Find **`pages_manage_posts`** — if Status is empty, click **+ Add**
6. Also add **`pages_read_engagement`** if not already **Ready for testing**
7. Set both to **Ready for testing**

### Get `instagram_content_publish`

1. From **Use cases** overview → **Add use cases** again
2. Add **Manage messaging and content on Instagram** (Meta docs: [Instagram use case](https://developers.facebook.com/docs/instagram-platform/instagram-api-with-facebook-login/create-a-meta-app-with-instagram/))
3. **Customize** that use case
4. In the left sidebar under the Instagram use case, select **API setup with Facebook Login** (not “Instagram Login” — Kame uses Facebook Login + Page token)
5. Click **Add all required permissions** for **content management**, or manually **+ Add**:
   - `instagram_basic`
   - `instagram_content_publish` (dashboard may show **`instagram_content_publishing`** — same purpose; enable whichever Meta lists for Facebook Login)
   - `pages_read_engagement`, `pages_show_list` (dependencies)
6. Set to **Ready for testing**

### If “Manage everything on your Page” is not in Add use cases

1. **Add use cases → Other** → create/configure a business app
2. Or add **Manage Pages** from the catalog
3. Meta sometimes greys out incompatible pairs — Messenger + Page management is usually **compatible**; add Page use case alongside Messenger

### “Add more use cases” modal — what to tick

When you click **Add more to this use case** or **Add use cases**, Meta shows a filter sidebar:

| Filter                     | What to pick for Kame                                                                |
| -------------------------- | ------------------------------------------------------------------------------------ |
| **Content management** (5) | Look here for **Instagram** content / API setup (not in the first “Featured” scroll) |
| **Business messaging** (1) | Usually already covered if you have **Messenger from Meta**                          |
| **All**                    | Scroll down to find **Manage everything on your Page**                               |

**Check these boxes:**

1. **Manage everything on your Page** — flag icon, “Publish content and videos, moderate posts…” → enables **`pages_manage_posts`**
2. Under **Content management** filter — add the Instagram use case (name varies):
   - **Manage messaging and content on Instagram**, or
   - **Instagram API** / content publishing option  
     → enables **`instagram_content_publish`** after you customize → **API setup with Facebook Login**

Click **Save**, then customize each new use case → **Permissions and features** → **+ Add** on any permission not yet **Ready for testing**.

You do **not** need Marketing API, Threads API, WhatsApp, or oEmbed for Kame inbox + marketing publish.

### After adding both use cases

Wait 2–5 minutes, then **Connect with Meta** in Kame again. The **Invalid Scopes** dialog should stop listing `pages_manage_posts` and `instagram_content_publish`.

## Step-by-step — Meta Developer Dashboard

### 1. Open your app

1. Go to [developers.facebook.com/apps](https://developers.facebook.com/apps)
2. Select the app whose `META_APP_ID` is in `supabase/.env.local`
3. Confirm **App mode** — **Development** is fine for admins/testers; **Live** requires App Review for non-role users

### 2. Add use cases

1. Left nav → **Use cases** (or **Add use cases** on the app home)
2. Click **Add use cases**
3. Add:
   - **Engage with customers on Messenger from Instagram & Facebook**
   - **Manage everything on your Page** (wording may be **Manage Pages**)
   - **Manage messaging & content on Instagram**
4. Save

### 3. Customize permissions per use case

For **each** use case → **Customize** (or **Permissions and features**):

**Engage with customers on Messenger from Instagram & Facebook**

- [ ] `pages_show_list`
- [ ] `pages_read_engagement`
- [ ] `pages_manage_metadata`
- [ ] `pages_messaging`
- [ ] `instagram_manage_messages`
- [ ] `business_management` (if shown)

**Manage everything on your Page / Manage Pages**

- [ ] `pages_show_list` (if not already)
- [ ] `pages_read_engagement` (if not already)
- [ ] `pages_manage_posts`

**Manage messaging & content on Instagram**

- [ ] `instagram_basic`
- [ ] `instagram_content_publish`
- [ ] `instagram_manage_messages` (if not already on messaging use case)

Set each permission to **Ready for testing** when the dashboard offers that toggle (required before OAuth accepts the scope for developers).

### 4. Facebook Login settings

1. Left nav → **Facebook Login for Business** (or **Facebook Login** → **Settings**)
2. **Valid OAuth Redirect URIs** — add exactly:
   ```
   {PUBLIC_API_URL}/functions/v1/meta-inbox-oauth-callback
   ```
   Examples:
   - Local via ngrok: `https://xxxx.ngrok-free.app/functions/v1/meta-inbox-oauth-callback`
   - Production: `https://<project-ref>.supabase.co/functions/v1/meta-inbox-oauth-callback`
3. **Client OAuth login:** Yes
4. **Web OAuth login:** Yes
5. Save changes

Match `PUBLIC_API_URL` / `SUPABASE_PUBLIC_URL` in edge env — see [inbox-e2e-runbook.md](./inbox-e2e-runbook.md).

### 5. Webhooks (Guest Inbox)

1. Left nav → **Webhooks**
2. **Page** object → **Subscribe**
   - **Callback URL:** `{PUBLIC_API_URL}/functions/v1/meta-inbox-webhook`
   - **Verify token:** same as `META_WEBHOOK_VERIFY_TOKEN` in edge env
   - **Fields:** `messages`, `message_echoes`, `messaging_postbacks`, `message_deliveries`, `message_reads`
3. **Instagram** object → **Subscribe** (for IG DMs)
   - Same callback URL and verify token
   - **Fields:** `messages`

After connect, Kame also calls `subscribed_apps` on the Page — webhook subscription in the dashboard must exist first.

### 6. App roles (Development mode)

1. **App roles → Roles**
2. Add your Facebook account as **Administrator** or **Developer**
3. Under **Testers**, add any other accounts that should connect before App Review

### 7. Connect in Kame

1. Restart edge functions (or redeploy) so `getMetaOAuthScopes()` is loaded
2. Kame admin → **Org → Inbox → Channels → Connect with Meta**
3. Log in with a Facebook account that **admins the Page** and has access to the linked Instagram account
4. Grant all requested permissions
5. If multiple Pages: pick the correct Page in **Choose Facebook Page**

**Marketing publish** uses the same connection — no second OAuth. After connect, test **Property → Marketing →** export → **Publish**.

---

## Troubleshooting

### “Invalid Scopes: pages_manage_posts, instagram_content_publish”

- The scope string in code is valid; the app **use case** does not include that permission yet.
- Fix: complete **§2–3** above, set permissions to **Ready for testing**, wait a few minutes, retry OAuth.
- Temporary: `META_OAUTH_EXCLUDE_PUBLISHING_SCOPES=1` to connect inbox only.

### “Invalid Scopes” for inbox permissions

- Add **Engage with customers on Messenger from Instagram & Facebook** use case.
- Enable `pages_messaging`, `instagram_manage_messages`, etc.

### OAuth redirect mismatch

- Redirect URI in Meta must **exactly** match `metaInboxOAuthRedirectUri()` (no trailing slash mismatch).

### Connected but no Instagram in picker

- Link IG Professional account to the Page in Meta Business Suite → **Settings → Linked accounts**.
- Reconnect Meta in Kame.

### Publish fails after connect

- **Development mode:** only role users can use advanced permissions.
- **Instagram publish:** App Review + Advanced Access for `instagram_content_publish` for non-admin guests.
- **Media URL:** Meta requires public HTTPS URLs — Kame uploads exports to `property-media` storage first.

---

## App Review (production / Live mode)

Submit when inbox + marketing flows work for app role users in Development mode.

### Permissions to document in submission

**Guest Inbox**

- `pages_messaging`, `pages_manage_metadata`, `pages_read_engagement`, `pages_show_list`
- `instagram_manage_messages`
- `business_management`

**Marketing Content Studio**

- `pages_manage_posts`
- `instagram_basic`, `instagram_content_publish`

### Screencast — Guest Inbox (2–3 min)

1. Sign in to Kame admin (Google OAuth)
2. **Org → Inbox → Channels → Connect with Meta**
3. Show Facebook Login + Page selection
4. Open **Messages**; show inbound Messenger or Instagram DM
5. Reply from composer; optional **Suggest** AI draft

### Screencast — Marketing publish (1–2 min)

1. **Property → Marketing →** Calendar or Design tab
2. Export creative → **Publish**
3. Select Facebook Page or Instagram, add caption, publish
4. Show post on Page or IG feed (or story)

### Privacy / compliance

- Privacy policy URL in Meta app **Settings → Basic**
- Data deletion: disconnect via **Inbox → Channels** removes stored tokens
- Page tokens encrypted at rest (`META_INBOX_TOKEN_ENCRYPTION_KEY`)

### Common rejection fixes

- Show **Facebook Page messaging**, not IG-only
- Show **Facebook Login for Business** Page picker
- Webhook must return 200 quickly
- Use case descriptions must match actual Kame screens (Inbox + Marketing)

---

## Kame env vars (reference)

| Variable                               | Purpose                                                |
| -------------------------------------- | ------------------------------------------------------ |
| `META_APP_ID` / `META_APP_SECRET`      | Meta app credentials                                   |
| `META_WEBHOOK_VERIFY_TOKEN`            | Webhook verification                                   |
| `META_INBOX_TOKEN_ENCRYPTION_KEY`      | Encrypt Page tokens at rest                            |
| `META_OAUTH_ALLOWED_RETURN_ORIGINS`    | SPA origins after OAuth (local Vite URLs)              |
| `PUBLIC_API_URL`                       | HTTPS base for OAuth redirect + webhook                |
| `META_OAUTH_EXCLUDE_PUBLISHING_SCOPES` | Set `1` to skip publishing scopes (inbox-only connect) |
| `META_OAUTH_EXTRA_SCOPES`              | Optional comma-separated extra scopes                  |

Implementation: `supabase/functions/_shared/metaInboxConfig.ts`, `metaInboxGraph.ts#buildMetaOAuthUrl`.
