---
title: 'Staff — operator guide'
status: active
tags: [guides, routes, org, property]
updated: 2026-08-17
---

# Staff — operator guide

> **Moved:** Staff Telegram settings now live on **[Notifications](./notifications.md)** (`…/notifications?module=staff`).

Route (redirect): `/org/:orgSlug/property/:propertySlug/staff` → `…/notifications?module=staff`

> **Status:** Documented — redirect → Notifications

## Overview

Legacy route only. Opening Staff redirects to the unified **Notifications** page with the Staff Telegram module selected. There is no standalone Staff settings UI anymore.

---

## Host-facing knowledge

Staff Telegram settings have moved to the Notifications page. The old Staff link redirects you to the Staff section there, where you set daily summary times and message templates for your on-site team.

**Common host questions**

- Q: Where do I configure staff Telegram alerts now?
  A: Go to **Notifications** → **Staff**. Your old Staff settings URL redirects there automatically.
- Q: What kind of messages does the Staff bot send?
  A: Scheduled daily summaries plus customizable templates, like check-in/check-out reminders or task lists you set up for your cleaning or front-desk team.
- Q: Can I use the same Telegram bot for Staff and Operations?
  A: Each module on Notifications connects separately, so you can use different bots or chat groups for staff summaries versus booking workflow alerts if you prefer.

## Implementation map

| Concern     | Path                                                                          |
| ----------- | ----------------------------------------------------------------------------- |
| Settings UI | `ui/src/features/dashboard/bookings/components/TelegramStaffSettingsCard.tsx` |
| Edge        | `supabase/functions/telegram-staff-settings/`                                 |

See [notifications.md](./notifications.md) for the unified page layout and save paths.
---

## Testing

| Layer | Path / spec                                                     | Manual |
| ----- | --------------------------------------------------------------- | ------ |
| E2E   | `ui/e2e/features/auth/legacyRouteRedirectSmoke.spec.ts` (`@ci`) | —      |
| N/A   | Redirect-only route                                             | —      |
