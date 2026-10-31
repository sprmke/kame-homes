---
title: 'Operations — operator guide'
status: active
tags: [guides, routes, org, property]
updated: 2026-08-17
---

# Operations — operator guide

> **Moved:** Operations workflow Telegram settings now live on **[Notifications](./notifications.md)** (`…/notifications?module=operations`).

Route (redirect): `/org/:orgSlug/property/:propertySlug/operations` → `…/notifications?module=operations`

> **Status:** Documented — redirect → Notifications

## Overview

Legacy route only. Opening Operations redirects to the unified **Notifications** page with the Operations Telegram module selected. There is no standalone Operations settings UI anymore.

---

## Host-facing knowledge

Operations Telegram settings have moved to the Notifications page. Opening the old Operations link takes you straight to the Operations section there, where you configure workflow alert templates and connect Telegram.

**Common host questions**

- Q: Where did Operations settings go?
  A: They're now under **Notifications** → **Operations**. The old Operations menu link redirects you there automatically.
- Q: What alerts does Operations cover?
  A: Booking workflow notifications, things like new bookings, status changes, and other admin alerts your team wants in Telegram.
- Q: Is this different from Staff or Marketing notifications?
  A: Yes. Operations is specifically for workflow alerts, while Staff and Marketing have their own modules on the same Notifications page, each with separate templates and schedules.

## Implementation map

| Concern     | Path                                                                          |
| ----------- | ----------------------------------------------------------------------------- |
| Settings UI | `ui/src/features/dashboard/bookings/components/TelegramAdminSettingsCard.tsx` |
| Edge        | `supabase/functions/telegram-admin-settings/`                                 |

See [notifications.md](./notifications.md) for the unified page layout and save paths.
---

## Testing

| Layer | Path / spec                                                     | Manual |
| ----- | --------------------------------------------------------------- | ------ |
| E2E   | `ui/e2e/features/auth/legacyRouteRedirectSmoke.spec.ts` (`@ci`) | —      |
| N/A   | Redirect-only route                                             | —      |
