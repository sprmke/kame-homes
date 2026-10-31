---
stage: done
title: 'Notifications — shared Telegram bot token'
status: done
tags: [planning, notifications, telegram]
updated: 2026-08-02
---

# Notifications — shared Telegram bot token

## Goal

Let hosts configure Telegram once, reuse one bot across all notification modules, and still override per module when needed.

## Decisions (do not re-litigate)

1. **One bot token is enough** for all modules at Kame Homes scale — Marketing, Staff, Operations, Finance, Maintenance, and Chat combined stay well within Telegram API limits. Cron sends are deduped; Chat is the highest-frequency source but still low volume for a single property.
2. **Recommended setup:** **one bot token** + **separate Chat ID per module** (ops group, staff group, marketing group, inbox group, etc.). The shared token card pre-fills module bot fields; each module still stores its own encrypted token and chat id in its `telegram_*_settings` row.
3. **Per-module token override stays supported** — edit the bot token on any module to use a different BotFather bot (separate bot identity, credential rotation, or isolation). No requirement to use different tokens.
4. **Find chat ID scanner** is setup-only: shown while a module is **not** Connected; hidden after a successful **Connect**. Reappears if the host edits bot token or chat id (Connect resets).
5. **Credential display:** connected fields show **@bot username** and **group chat title** by default; **Reveal** / **Hide** toggles raw token / chat ID.
6. **Storage:** `telegram_global_bot_token_encrypted` on `app_settings` (property) and `parking_settings` (parking). API: `telegram-global-settings` edge function (`notifications:edit`).

## Shipped UI

- **Shared bot token** card at top of property and parking Notifications pages — Test token (`getMe`), Save, BotFather help dialog.
- Module cards: enable toggle → Telegram connection (bot + chat + Connect) → manage cards after connect.
- Module **CardDescription** on each section (what that module sends).
- Inline **?** help on bot token and chat id labels; tabbed help dialog (BotFather + chat ID lookup + scan steps).

## When to use separate bots per module

Optional, not required for reliability:

- Distinct bot names/avatars in Telegram member lists
- Revoke or rotate one module without touching others
- Very active Chat inbox sharing the **same** group as other alerts (same-chat rate soft limits)

## Docs

- `docs/guides/routes/org/property/notifications.md`
- `docs/guides/routes/org/parking/notifications.md`
- `docs/PROJECT.md` — `telegram-global-settings` API row

## Implementation map

| Concern                                     | Path                                                                                   |
| ------------------------------------------- | -------------------------------------------------------------------------------------- |
| Shared token card                           | `ui/.../TelegramGlobalBotTokenCard.tsx`                                                |
| Module layout + hide scanner when connected | `ui/.../TelegramNotificationModuleLayout.tsx`, `PropertyTelegramCredentialsFields.tsx` |
| Global token hook                           | `ui/.../useTelegramGlobalBotToken.ts`                                                  |
| Edge function                               | `supabase/functions/telegram-global-settings/index.ts`                                 |
| Migration                                   | `supabase/migrations/20261001140000_telegram_global_bot_token.sql`                     |
