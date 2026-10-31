---
title: 'Telegram marketing reminders'
status: active
tags: [reference, marketing]
updated: 2026-08-02
---

# Telegram marketing reminders

Marketing messages to a **Telegram** group (or channel) for **Kame Homes** guest-form ops: scheduled **daily** runs at configurable **Asia/Manila** times (default three slots), plus **new booking** and **cancellation** triggers. Copy lives in Postgres (`telegram_marketing_settings`); admins edit templates under **Admin → Marketing** (`/marketing`).

Canonical API and env names also appear in **[`docs/architecture/edge-functions.md`](../architecture/edge-functions.md)** and **[`docs/architecture/validation-and-env.md`](../architecture/validation-and-env.md)**.

---

## 1. Behavior summary

| Trigger          | When                                                                                                                                                                                                                                                                                            | Message source                                                                                                                                                                                                                                                                              |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Scheduled**    | **`pg_cron`** runs **`telegram-marketing-cron`** at **daily times** configured in **`telegram_marketing_settings.daily_reminder_times_manila`** (Manila clock, default **10:00 / 15:00 / 21:00** — each mapped to UTC as `minute hour * * *`; jobs named **`telegram-marketing-daily-slot-*`**) | **Always** `daily_default_template`. **Additionally**, when the **nearest free check-in** is **fewer than** `urgency_days_threshold` **calendar days** away, also sends `daily_urgency_template` (often `{{urgency_text}}` + `{{month_name}}` / `{{dates_list}}` or `{{available_dates}}`). |
| **New booking**  | First **insert** of a guest row from **`submit-form`** (predetermined UUID, no prior row)                                                                                                                                                                                                       | `new_booking_template` with `{{month_name}}`, `{{dates_list}}` (up to `new_booking_dates_limit` days in the **current calendar month**), optional `{{available_dates}}`                                                                                                                     |
| **Cancellation** | After **`cancel-booking`** succeeds (`WorkflowOrchestrator` → `CANCELLED`)                                                                                                                                                                                                                      | `cancellation_template` with `{{cancellation_dates}}` (freed stay window)                                                                                                                                                                                                                   |

**Availability model (single property):** each non-`CANCELLED` booking blocks overnight nights from **check-in** (inclusive) to **check-out** (exclusive), on **Asia/Manila** calendar dates. A **check-in** on day _D_ is "available" if night _D_ is not blocked. This matches the guest calendar mental model; it does not model minimum stay length.

**Toggles** on the Marketing page: `enabled`, `notify_on_new_booking`, `notify_on_cancellation`. If **`TELEGRAM_BOT_TOKEN`** or **`TELEGRAM_CHAT_ID`** is unset, all sends are skipped (warning in Edge logs only).

---

## 2. Template placeholders

Use **exact** token spelling (case-sensitive). Values come from the **live booking calendar** (non-`CANCELLED` stays, Manila dates). If data cannot be resolved, sends fail with an error (no fake/sample dates).

| Placeholder              | Used in                                                                      |
| ------------------------ | ---------------------------------------------------------------------------- |
| `{{available_dates}}`    | Daily urgency; new booking (optional) — next free check-ins                  |
| `{{month_name}}`         | Daily urgency; new booking — current calendar month name                     |
| `{{dates_list}}`         | Daily urgency; new booking — day numbers for free dates this month           |
| `{{urgency_text}}`       | Daily urgency — `today,` \| `tomorrow,` \| `this` from nearest free check-in |
| `{{cancellation_dates}}` | Cancellation — freed stay window from check-in / check-out                   |

Default rows are seeded in migration **`20260614120000_telegram_marketing_settings.sql`**. Cron slot column + RPC **`20260615105000_telegram_marketing_cron_slots.sql`**.

---

## 3. Edge Functions

| Function                          | Auth                                       | Notes                                                                                                                                                                                                                                                                                     |
| --------------------------------- | ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`telegram-marketing-cron`**     | `verify_jwt = false`                       | `POST` with `{}` body. If **`TELEGRAM_CRON_SECRET`** is set in Edge secrets, require header **`X-Telegram-Cron-Secret: <same>`**. Otherwise only the usual anon **`Authorization`** from `pg_net` is required.                                                                            |
| **`telegram-marketing-settings`** | `verify_jwt = false`; **`verifyAdminJwt`** | **GET** / **PATCH** as above. **PATCH** with **`dailyReminderTimesManila`** updates **`daily_reminder_times_manila`** and calls **`sync_telegram_marketing_daily_cron_jobs`** (drops legacy **`telegram-marketing-daily-manila`** when present). **POST** = manual Telegram tests — §3.1. |

### 3.1 Admin diagnostics & previews (`POST telegram-marketing-settings`)

JSON body must include **`action`**.

| `action`                                                            | Extra fields                                                                                         | Behavior                                                                                                                                                                                                                            |
| ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `verify_telegram_env`                                               | —                                                                                                    | Calls Telegram **`getMe`** + **`getChat`** using normalized **`TELEGRAM_*`** from Edge env (admin diagnostics).                                                                                                                     |
| `send_draft_preview` (alias: `send_draft_with_sample_placeholders`) | **`text`** (required, ≤4000); optional **`checkInYmd` / `checkOutYmd`** for `{{cancellation_dates}}` | Resolves `{{placeholders}}` from the **live booking calendar** (Manila); **400** if data is missing — no sample/fake dates. UI **Send preview** on each template; cancellation uses Manila today → tomorrow when dates are omitted. |
| `render_draft_preview`                                              | Same body as **`send_draft_preview`**                                                                | Same resolution path as **`send_draft_preview`**, but returns **`{ renderedText, placeholders? }`** without sending Telegram. Powers the in-app **Preview** tab on **Admin → Marketing**.                                           |

Scenario **Send preview** ignores automation toggles so you can verify wiring without turning sends on.

---

## 4. Step-by-step deployment (Supabase Cloud)

1. **Merge and migrate**
   - Deploy **`20260614120000_telegram_marketing_settings.sql`** then **`20260615105000_telegram_marketing_cron_slots.sql`** (`supabase db push` or Dashboard SQL).

2. **Deploy Edge Functions**

   ```bash
   supabase functions deploy telegram-marketing-cron
   supabase functions deploy telegram-marketing-settings
   ```

   Redeploy **`submit-form`** and **`cancel-booking`** so they include `_shared/telegramMarketing.ts` and the new hooks.

3. **Edge secrets (Dashboard → Edge Functions → Secrets)**
   - **`TELEGRAM_BOT_TOKEN`** — from [@BotFather](https://t.me/BotFather).
   - **`TELEGRAM_CHAT_ID`** — numeric group id (often negative for supergroups).
   - **`TELEGRAM_CRON_SECRET`** _(recommended)_ — long random string; same value will be sent as **`X-Telegram-Cron-Secret`** from `pg_cron`.

4. **Smoke test (curl)**
   - Without cron secret:
     ```bash
     curl -sS -X POST "${SUPABASE_URL}/functions/v1/telegram-marketing-cron" \
       -H "Authorization: Bearer ${ANON_KEY}" \
       -H "Content-Type: application/json" \
       -d '{}'
     ```
   - With cron secret:
     ```bash
     curl -sS -X POST "${SUPABASE_URL}/functions/v1/telegram-marketing-cron" \
       -H "Authorization: Bearer ${ANON_KEY}" \
       -H "Content-Type: application/json" \
       -H "X-Telegram-Cron-Secret: ${TELEGRAM_CRON_SECRET}" \
       -d '{}'
     ```
     Expect `{"success":true,"sent":true,"mode":"default"|"urgency",...}`. Check **Edge Logs** if `sent` is false.

5. **`pg_cron` — two paths**
   - **Recommended:** Sign in → **Marketing** (**`/marketing`**), set **Daily reminder times** (Asia/Manila), templates, toggles → **Save** (**PATCH**). That persists **`daily_reminder_times_manila`** and invokes **`sync_telegram_marketing_daily_cron_jobs`** (requires migration **`20260615105000_…`**). Cron jobs **`telegram-marketing-daily-slot-0`** … **`slot-N`** appear in **Integrations → Cron**; **`telegram-marketing-daily-manila`** (old single-job name) is removed on save. If the toast warns that **`cronSync`** failed, fix Postgres / Vault (**`project_url`**, **`anon_key`**, optional **`telegram_cron_secret`**) then **Save** again — DB settings still apply.
   - **Manual / disaster recovery:** Uncomment **Option A** or **Option B** in **`supabase/snippets/telegram-marketing-cron.sql`**, Vault secrets **`project_url`**, **`anon_key`**, optionally **`telegram_cron_secret`**, once in SQL. The Marketing **Save** path still works afterward and replaces **`telegram-marketing-daily-slot-*`**.

6. **Legacy note**

   The old single-expression **`0 2,7,13 * * *`** (**10 / 15 / 21 Manila**) is superseded once you run the slots migration and **Save** from Marketing (defaults recreate those wall-clock sends).

---

## 5. Local development

- **`supabase functions serve`** exposes **`telegram-marketing-cron`** and **`telegram-marketing-settings`**. Add tokens to **`supabase/.env.local`** (same variable names as Edge secrets).
- **No** `pg_cron` fire loop locally by default — invoke with **curl** as above (`SUPABASE_URL` = `http://127.0.0.1:54321`, anon key from `supabase status`).
- **Marketing UI**: open **`http://localhost:5173/marketing`** while signed in as an allow-listed admin.

---

## 6. Security notes

- **`telegram-marketing-cron`** is not gated by `verifyAdminJwt`; treat the URL as **semi-internal** (same pattern as `sd-refund-cron`). Prefer **`TELEGRAM_CRON_SECRET`** + Vault-backed header in production.
- **`telegram-marketing-settings`** is **admin-only** via **`verifyAdminJwt`**.
- Never commit **`TELEGRAM_BOT_TOKEN`** to git.

---

## 7. Related files

| Area                 | Path                                                                                                                                                                                                                            |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Shared send + copy   | `supabase/functions/_shared/telegramMarketing.ts`, **`telegramMarketingCronSync.ts`**                                                                                                                                           |
| Manila calendar math | `supabase/functions/_shared/calendarAvailabilityManila.ts`                                                                                                                                                                      |
| DB helpers           | `supabase/functions/_shared/databaseService.ts` (**`syncTelegramMarketingDailyCronJobs`**, `getTelegramMarketingSettings`, `updateTelegramMarketingSettings`), migration **`20260615105000_telegram_marketing_cron_slots.sql`** |
| Cron entrypoint      | `supabase/functions/telegram-marketing-cron/index.ts`                                                                                                                                                                           |
| Settings API         | `supabase/functions/telegram-marketing-settings/index.ts`                                                                                                                                                                       |
| Marketing UI         | `ui/src/features/dashboard/bookings/pages/AdminMarketingPage.tsx`, `ui/src/features/dashboard/bookings/components/TelegramMarketingSettingsCard.tsx`                                                                            |
| Hooks                | `ui/src/features/dashboard/bookings/hooks/useTelegramMarketingSettings.ts`                                                                                                                                                      |
| `config.toml`        | `[functions.telegram-marketing-cron]`, `[functions.telegram-marketing-settings]`                                                                                                                                                |

---

## 8. Operational FAQ

**Q: GET `/telegram-marketing-settings` returns 400 / `Failed to load Telegram marketing settings` in production.**  
A: The Edge function reads table **`telegram_marketing_settings`**. If that migration never ran on the **hosted** project, PostgREST returns an error (often “relation does not exist”). Apply **`supabase/migrations/20260614120000_telegram_marketing_settings.sql`** via **Dashboard → SQL** or **`supabase link` + `supabase db push`**, then retry. Confirm **Edge secrets** **`SUPABASE_URL`** and **`SUPABASE_SERVICE_ROLE_KEY`** match this project (wrong project ref also breaks reads).

**Q: Cron returns 401 Unauthorized.**  
A: **`TELEGRAM_CRON_SECRET`** is set on Edge but **`pg_net`** is not sending **`X-Telegram-Cron-Secret`**, or values mismatch. Unset the Edge secret to match a simpler dev setup, or fix Vault + headers.

**Q: I saved reminder times but Integrations → Cron did not update / toast says reschedule failed.**  
A: **`sync_telegram_marketing_daily_cron_jobs`** must exist (migration **`20260615105000_telegram_marketing_cron_slots.sql`**). Cron needs **`pg_cron` + `pg_net`**; **`net.http_post`** command still reads Vault **`project_url`**, **`anon_key`**, optionally **`telegram_cron_secret`** (same as the snippet). Check Edge function **`telegram-marketing-settings`** logs for the **`cronSync`** error string.

**Q: No Telegram message but `success: true`.**  
A: Check `mode: "disabled"` or `mode: "no_env"` — Marketing **`enabled`** off, or missing bot token / chat id.

**Q: New booking message not sent.**  
A: Only fires on **first insert** (no existing row for the submitted UUID). Edits to an existing booking do not fire. Also check **`notify_on_new_booking`**.

**Q: Cancellation message not sent.**  
A: Check **`notify_on_cancellation`** and **`enabled`**. Telegram runs **after** a successful orchestrator cancel.

**Q: Cron jobs show “Succeeded” but I never see “Pa up and share…” (daily default) in the group.**  
A: (1) **Event vs schedule** — “Available next dates: …” and “…due to guest cancellation” come from **new booking** / **cancel**, not the daily cron. (2) **Old behavior** — cron used to send **only** urgency when the next free check-in was within `urgency_days_threshold` days, so the default line could disappear for weeks; current code sends **default every run** plus urgency when tight. (3) **`TELEGRAM_CRON_SECRET`** — if set on Edge but Vault `telegram_cron_secret` does not match, `pg_cron` still “succeeds” while the function returns **401** and nothing is posted. Align secrets or unset Edge `TELEGRAM_CRON_SECRET`. (4) Check **Edge → `telegram-marketing-cron` logs** after a slot run for JSON `{ sent, mode, defaultSent, urgencySent, … }`.

**Q: Telegram returns `Bad Request: chat not found` on test sends.**  
A: The **`TELEGRAM_BOT_TOKEN`** and **`TELEGRAM_CHAT_ID`** in the Edge runtime must belong together: **`getChat`** for that id must succeed for **this** bot (add the bot to the group/channel, use the supergroup numeric id, restart **`functions serve`** after editing **`supabase/.env.local`**). On **Marketing**, **Verify bot** runs **`verify_telegram_env`** (`POST` with `action: verify_telegram_env`) and shows **`getMe` / `getChat`** plus normalized **`chat_id`**, **first codepoint** of the secret’s first character (ASCII `-` is `45`; a Word/PDF “minus” is often **8722**, which the server maps to `-`), and whether the normalized id starts with ASCII `-`. **`TELEGRAM_CHAT_ID`** must be **digits only** (optional leading `-`); strip quotes, `@` names — the server normalizes BOM/CR/wrapping quotes, Unicode dash/minus glyphs, and whitespace.

**Q: How do I test from Marketing without enabling automation?**  
A: Use **Send test** for daily / new booking / cancellation, or **Send preview** on each template. Placeholders use the **live calendar** (or cancellation date fields for `{{cancellation_dates}}`). Those calls use **`POST`** with `action` and **ignore** `enabled` / `notify_*` (see §3.1).
