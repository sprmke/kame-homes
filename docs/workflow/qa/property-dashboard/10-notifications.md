---
title: 'QA — Property Notifications'
status: active
updated: 2026-08-30
---

# 10 — Notifications

Route: `/org/:orgSlug/property/:propertySlug/notifications`

## Looks good

- Activity + six Telegram modules in one hub.
- Enable toggle plan-gated `telegramNotifications` (Starter+); edit/preview free.
- Deep links `?module=` work per guide.
- **Phase 3 (Chat module):** Enable without token allowed; **Save and test** after token; fake token → **Invalid bot token…** toast (server validation).
- **Phase 4:** Chat **Connected**; **Send preview** → **Preview sent**; shared **Save and test** → **Saved — @kamehome_maintenance_bot**.

## Issues

| Sev | Issue                                                                                       | Evidence  |
| --- | ------------------------------------------------------------------------------------------- | --------- |
| P2  | Six bots / modules is a lot of setup for a solo host — high time-to-value                   | Host lens |
| P2  | Shared bot token empty while modules already connected — Save and test disabled until paste | Phase 4   |
| P3  | Shared bot token guidance is good but still easy to misconfigure Chat IDs                   | Guide     |

## Improvements

- “Quick start”: one bot + one ops chat preset that enables Operations + Chat together.
- Prefill / “Use module token” for shared bot when modules already connected.
- Dashboard attention should deep-link into Activity with filter.

## Doc gaps

- Guide dated 2026-08-18 but content still matches; bump `updated` when next edited.

## Evidence

Live page load; Phase 3 invalid-token toast; Phase 4 Preview sent + Saved bot username; guide `notifications.md`.
