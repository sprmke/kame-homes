---
stage: planned
title: 'Notifications page restructure (tabs, bounded activity feed, guidance)'
status: planned
tags: [planning, notifications, telegram, push, ux, mobile, performance, help]
updated: 2026-11-06
---

# Notifications page restructure

Rebuild the frame of the property and parking **Notifications** pages so each channel has its own
space, the activity feed stays a fixed size no matter how much history exists, and a
non-technical host can tell in one glance what the page is for.

**Hard constraint:** the Telegram module cards keep their current UI and UX. Only the wrapper
around them changes, plus optional helper copy that sits outside the cards.

Routes:

- `/org/:orgSlug/property/:propertySlug/notifications` (`bookings/pages/NotificationsPage.tsx`)
- `/org/:orgSlug/parking/:parkingSlug/notifications` (`parking/pages/ParkingNotificationsPage.tsx`)

Related: [`../in-progress/dashboard-contextual-help.md`](../in-progress/dashboard-contextual-help.md)
**§P3** (Notifications help). This plan **takes over P3.1, P3.2, P3.3, P3.4, P3.5, P3.7 and P3.8**.
P3.6 (Telegram field-level hints inside the cards) stays in the help plan because it edits the
cards.

---

## 1. Current state audit

### What the page is today

One long column inside `AdminSectionNavLayout` (secondary sidebar on `lg+`), in this order:

1. `SyncCenterCard` (only when offline changes are queued)
2. `PushNotificationsCard` (this device on/off)
3. `NotificationPreferencesCard` (8 push groups + quiet hours)
4. Activity feed (`InAppNotificationsSection` → `InAppNotificationsPanel variant="feed"`)
5. Telegram group: shared bot token card + 6 module sections (property) or 3 (parking)

### Problems found

| #   | Problem                                                                                                                                                                                                                                                                                                                                                                                          | Where                                                                   |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------- |
| P1  | **Activity feed has no height limit.** `variant="feed"` deliberately does not scroll itself; it pages on the outer page scroll. Every page loaded (20 rows each) pushes Telegram further down. After a few months, Telegram is effectively unreachable.                                                                                                                                          | `InAppNotificationsPanel.tsx` (`listScrollClassName` returns undefined) |
| P2  | **DOM grows without bound.** Infinite scroll appends pages forever; nothing is ever unmounted. A host who scrolls back a year renders hundreds of rows.                                                                                                                                                                                                                                          | same                                                                    |
| P3  | **Three unrelated channels share one scroll.** In-app history, phone push settings and Telegram bot setup are different jobs with different frequency (daily vs set once).                                                                                                                                                                                                                       | `NotificationsPage.tsx`                                                 |
| P4  | **Phone users get no navigation at all.** The secondary sidebar is `hidden lg:block`, so on 375/768px the page is one very long scroll with no jump points.                                                                                                                                                                                                                                      | `AdminSectionNavLayout.tsx:472`                                         |
| P5  | **Push settings sit above the feed.** Two settings cards (11 rows of switches) are the first thing a host sees, before any activity.                                                                                                                                                                                                                                                             | `InAppNotificationsSection.tsx`                                         |
| P6  | **All Telegram settings queries fire on page load**, even for a host who only came to read activity (6 `telegram-*-settings` GETs on property, 3 on parking).                                                                                                                                                                                                                                    | page mounts every `Telegram*SettingsCard`                               |
| P7  | **No explanation of the page.** Subtitle is "Manage in-app notifications and Telegram alerts for this property." Nothing says what "in-app" vs "push" vs "Telegram" means, who receives what, or that muting push does not hide Activity.                                                                                                                                                        | page header                                                             |
| P8  | **Org-wide feed on a property page is unexplained.** `notifications-list` filters by `organization_id` only, so the property page shows activity for every property and parking in the org. Correct behavior, but the page never says so.                                                                                                                                                        | `supabase/functions/notifications-list/index.ts`                        |
| P9  | **Bare empty state.** "No notifications yet." with no hint of what will appear or where to set up alerts.                                                                                                                                                                                                                                                                                        | `InAppNotificationsPanel.tsx`                                           |
| P10 | **Orphaned earlier draft.** `NotificationsHubShell`, `NotificationsHubTabs`, `NotificationsHubSummaryCards`, `NotificationsActivityView`, `useNotificationsHubView`, `useTelegramHubStats`, `notificationsHubSections.ts`, `notificationsHubPageCopy.ts` were built on 2026-10-24 and are **not mounted by any route**. The notifications skill and the help plan both describe them as if live. | `notifications/components/*`                                            |
| P11 | **Bell "View all" sends `?view=activity`**, which today's page ignores (it lands on Activity only because Activity happens to be first).                                                                                                                                                                                                                                                         | `NotificationBell.tsx:86`                                               |
| P12 | **Route guide drift.** The guide says the list "is capped in height inside the Activity card; scroll within the card loads the next page". The code does the opposite (P1).                                                                                                                                                                                                                      | `docs/guides/routes/org/property/notifications.md`                      |
| P13 | **Parking page has no edit-permission wrappers** around Telegram cards, unlike the property page (`pointer-events-none opacity-60` per module). Verify whether parking has its own notification permissions before copying the pattern.                                                                                                                                                          | `ParkingNotificationsPage.tsx`                                          |
| P14 | **Duplicated page logic.** Property and parking pages copy the same deep-link scroll effect, nav groups and section scaffolding.                                                                                                                                                                                                                                                                 | both pages                                                              |

### What is already good and must not change

- Every `Telegram*SettingsCard` and everything under `bookings/components/telegram-notifications/`
  (connection rows, Connect, Scan for chats, manage cards, template modals, placeholders).
- `TelegramNotificationsTelegramSection` (plan `TierBadge`, feature-availability panel, "Delivery
  paused" notice, settings-editable context). Reused as is.
- `TelegramGlobalBotTokenCard` and `TelegramNotificationsGlobalBotProvider`.
- Per-module permission wrappers on the property page.
- Activity row design (`InAppNotificationsPanel` rows, inbox platform pills, stay label, unread dot).
- Bell, slide-over sheet, toasts, realtime, mark-read optimistic updates.

### Reusable pieces from the earlier draft

Keep (already tested or already referenced):

- `notificationsPaths.ts#resolveNotificationsHubView`, `NOTIFICATIONS_HUB_VIEWS`,
  `notificationsHubViewQuery` (bell already uses it) + `notificationsPaths.test.ts`.
- `useNotificationsHubView` (`?view=` state, `replace: true`, legacy params cleanup).
- `NotificationsHubTabs` + `NotificationsHubPanel` (SlidingTabs, a11y ids, unread badge).
- `useGuardedViewSwitch` + `UnsavedChangesDialog` pattern for switching tabs with a dirty token.

Drop (they add height or duplicate the new design): `NotificationsHubShell`,
`NotificationsHubSummaryCards` (4 KPI tiles above the tabs push content down and repeat the tab
badge), `NotificationsActivityView`, `notificationsHubSections.ts`, `notificationsHubPageCopy.ts`,
and the two `NOTIFICATIONS_HELP_COPY` summary-card entries (move the "Connected" idea into the
Telegram overview instead).

---

## 2. Proposed information architecture

### Recommended: three tabs, one per channel

| Tab             | What it holds                                                                | How often a host uses it |
| --------------- | ---------------------------------------------------------------------------- | ------------------------ |
| **Activity**    | The in-app feed (same items as the bell), filters, mark all read, pagination | Daily                    |
| **Push alerts** | This device on/off, which groups buzz the phone, quiet hours                 | Set once, tweak rarely   |
| **Telegram**    | Shared bot token + module cards, unchanged                                   | Set once per module      |

Why three, not two: the push cards are settings, not activity. Leaving them on the Activity tab
keeps problem P5 (11 switches above the feed). Mapping tabs to channels also matches the "How
notifications work" explanation (bell, phone, Telegram), so the page teaches itself.

**Fallback (two tabs):** Activity + Telegram, with a **Push settings** button in the Activity
header that opens the two push cards in a `ResponsiveModal` (bottom sheet on phone). Same
components, one less tab. Choose this only if three pills do not fit at 375px with the unread
badge (verify in Phase 1; labels are short so they should fit).

`SyncCenterCard` stays **above the tabs**: it renders only when offline changes are queued, and it
matters on every tab.

### Desktop wireframe (lg+)

```
Notifications                                         (?) How notifications work
Bookings, guest messages and reminders for your org, in the app, on your phone, or in Telegram.

[ Activity (3) ] [ Push alerts ] [ Telegram • ]                 Mark all as read

┌ Activity ──────────────────────────────────────────── [ All | Unread ] ┐
│ Shows everything across your organization, not just this property.     │
│ TODAY                                                                   │
│  ● New booking · Unit 12           Aug 14 - 15            2h ago       │
│  ● Maria Santos  [Facebook]        "Is parking free?"     3h ago       │
│ YESTERDAY                                                               │
│    Ready for check-in · Unit 7                            1d ago       │
│  ... (scrolls inside the card, max height)                              │
├─────────────────────────────────────────────────────────────────────────┤
│  Showing 1-20                                   [ ‹ Newer ] [ Older › ] │
└─────────────────────────────────────────────────────────────────────────┘
```

### Telegram tab (desktop)

The secondary sidebar is replaced by a compact module overview that doubles as navigation and as
a status check. The cards below it are untouched.

```
Telegram                                  [Plan badge] [Get Help]
Send alerts to a Telegram chat or group, so your team sees them without opening the app.

┌ Your Telegram alerts ───────────────────────────────────────────────┐
│ Shared bot token   Saved                                            │
│ Chat          On        Marketing   Off       Staff        Off      │
│ Operations    Needs setup  Finance  On        Maintenance  Off      │
└─────────────────────────────────────────────────────────────────────┘   (each item jumps to its card)

[ TelegramGlobalBotTokenCard ]          unchanged
[ AdminSection: Chat ]                  unchanged
[ AdminSection: Marketing ] ...         unchanged
```

Status per module: **Off** (not enabled), **Needs setup** (enabled but token or chat ID missing,
same rule as `useTelegramHubStats#telegramModuleConnected`), **On** (enabled and connected).

### Phone wireframe (375px)

```
┌───────────────────────────┐
│ Notifications        (?)  │  brand hero, How it works as hero icon
├───────────────────────────┤
│[Activity 3][Push][Telegram]│  sticky under the pinned bar
│ [All | Unread]   Mark all │
│ TODAY                     │
│ ● New booking · Unit 12   │  natural height, no nested scroll
│ ● Maria Santos  Facebook  │
│ ...20 rows                │
│ [ ‹ Newer ]  [ Older › ]  │
└───────────────────────────┘
```

Telegram on phone: the overview becomes a horizontally scrollable chip row (name + status dot)
that scrolls to the card. Cards stack as they do today.

---

## 3. Activity tab design

### Bounded feed with page-based navigation

- **Page size 20** (unchanged server default). Only **one page is rendered** at a time, so the DOM
  never holds more than 20 rows regardless of history length.
- **Newer / Older** buttons in a footer. The API is cursor-based (`created_at < cursor`), which
  maps naturally to Newer/Older. No total count is needed; the footer shows "Showing 21-40".
- **Desktop:** the card has a max height (start at `max-h-[min(40rem,calc(100dvh-20rem))]`, tune in
  Phase 2) and scrolls inside, with the pager pinned at the bottom of the card. Changing page
  scrolls the list back to the top.
- **Phone:** no inner scroll (nested scroll areas are a known anti-pattern on touch). 20 rows at
  natural height plus the pager. The page is short enough that this is fine.
- **Implementation choice:** keep `useInfiniteQuery` and render only `data.pages[pageIndex]`.
  "Older" calls `fetchNextPage()` when the next page is not cached yet, then advances the index.
  This keeps the existing optimistic updates in `useMarkNotificationRead` /
  `useMarkAllNotificationsRead` working, because they write the `InfiniteData` shape. Switching
  to a plain `useQuery` per cursor would silently break them.
- Page index lives in component state, not the URL (a reload should land on the newest items).
  Reset to page 0 when the filter changes or when realtime adds new items while on page 0.
- Remove the IntersectionObserver path for `variant="feed"` (bell `sheet` variant unaffected).

### Inbox collapse across pages

`collapseInboxNotifications` runs on the rendered rows. With one page rendered, a conversation
could appear once on page 1 and once on page 2 (legacy per-message rows). Collapse within the
page is acceptable; new rows are already coalesced server-side (`createOrCoalesceNotification`).
Note it as a known edge case, do not build cross-page dedupe.

### Readability

- **Date group headers:** Today, Yesterday, This week, Earlier (Asia/Manila). Pure client-side
  over the rendered page.
- **Scope line** at the top of the card: "Shows everything across your organization, not just
  this property." (parking: "not just this parking slot"). Fixes P8 without a backend change.
- **All / Unread** segmented filter. Needs a read-only server param (`unread=1`) on
  `notifications-list`: anti-join on `notification_reads` for the current user. Verify the
  PostgREST embedded-null filter works with the existing `notification_reads!left(id)` select,
  otherwise filter with `NOT EXISTS` via an RPC. The badge count already comes from
  `unreadCount`, so no other change is needed.
- **Mark all as read** stays in the tab action slot (only when `unreadCount > 0`).
- **Stale data label** (`StaleDataLabel`) moves into the card header, small.

### Empty states (contextual-help P3.7)

| State               | Copy                                                                   | Action                            |
| ------------------- | ---------------------------------------------------------------------- | --------------------------------- |
| No items at all     | "Nothing yet. New bookings and guest messages will show up here."      | **Set up push alerts** → Push tab |
| Unread filter, none | "You're all caught up."                                                | **Show all**                      |
| Older page, none    | Pager hides **Older** (driven by `nextCursor`), so this never renders. | none                              |
| Load error          | Existing "Could not load notifications." + **Retry**                   | unchanged                         |

---

## 4. Push alerts tab

Contents: `PushNotificationsCard` then `NotificationPreferencesCard`, unchanged behavior.

Guidance added (contextual-help P3.4, P3.5), all through the sanctioned help components:

- One-line panel description: "Get a pop-up on this phone or computer, even when the app is closed."
- `InfoHint` on **Notifications on this device**: it is per device, iPhone needs Add to Home
  Screen first, and "blocked" means re-allowing the site in browser settings.
- `InfoHint` on **Push preferences**: "Turning a group off only stops the pop-up. It still shows
  in Activity." Verify in `notification-preferences` whether preferences are per user (the route
  guide says per account) before writing "only you" (help plan P3.9).
- Quiet hours label gets "(Philippine time)".

No changes to the toggles, saving, or toasts.

---

## 5. Telegram tab

- Wrap the existing block in `TelegramNotificationsTelegramSection` exactly as today. The plan
  badge, Get Help, availability panel and delivery-paused notice keep working with no edits.
- Remove `AdminSectionNavLayout`'s secondary sidebar for this page. Add a new
  `TelegramModulesOverview` component above the cards (Section 2 wireframe). It reads the same
  settings queries the cards already use (`useTelegram*Settings`), so it adds no network calls;
  extend `useTelegramHubStats` to return per-module status instead of only counts.
- `?module=finance` (from Finance, Maintenance, Property Settings → Integrations, post-sign-in
  routing, legacy redirects) opens the Telegram tab and scrolls to `#section-finance`.
- One-line panel description: "Send alerts to a Telegram chat or group, so your team sees them
  without opening the app."
- Module descriptions (`MODULE_DESCRIPTIONS`) stay; review wording with `human-copy` only.
- **Lazy mount:** the Telegram tab body (and its 6 settings queries) mounts only when the tab is
  opened. Fixes P6. Prefetch on tab hover/focus with `prefetchChunkOnce` style intent if the
  first open feels slow.
- Tab switching goes through `useGuardedViewSwitch`, so leaving the Telegram tab with a half-typed
  shared bot token prompts Save / Discard / Keep editing (existing E2E covers the leave-route case;
  add the tab-switch case).

---

## 6. Page-level guidance (contextual-help P3.1, P3.2)

All strings go in the help copy registry (`notificationsHelpCopy.ts`, typed `HelpCopyModule`),
not inline. Run `human-copy` on every string; no em dashes.

**Subtitle** (replaces the current one):

- Property: "Bookings, guest messages and reminders, in the app, on your phone, or in Telegram."
- Parking: same, with "reservations" in place of "bookings".

**`HowItWorksButton`** "How notifications work" in the page header (`hero` variant on phone):

1. Something happens: a new booking, a guest message, a check-in reminder.
2. It shows in **Activity** and the bell, for everyone on your team.
3. Turn on **Push alerts** to also get a pop-up on your phone or computer.
4. Connect **Telegram** to send it to a chat or group, for team members who live in Telegram.

Tip: "You can use all three. Each one is set up separately."

Plus a three-column channel table inside the dialog:

|                | Activity    | Push alerts               | Telegram                 |
| -------------- | ----------- | ------------------------- | ------------------------ |
| Where it shows | In this app | Phone or computer pop-up  | A Telegram chat or group |
| Setup          | None        | Turn on per device        | Bot token and chat, once |
| Good for       | Catching up | Not missing urgent things | Sharing with staff       |

Verify step 2 ("for everyone on your team") against `notificationsAccess.ts` recipients (org
owner + active org members; property-only members get the list but no realtime, per the
notifications skill). Reword if it is not true for every viewer.

**`IntroCard`** (first visit, dismiss for good per user and device, `featureKey:
'notifications.hub'`): "Activity shows what happened. Push and Telegram decide where else you hear
about it." with the How it works link. Only one IntroCard on the page.

**Tab hints (P3.3):** no `InfoHint` inside tab pills (nested button). Each panel starts with its
one-line description instead.

---

## 7. Shared structure (fixes P14)

New feature-local components in `ui/src/features/dashboard/notifications/`:

| File                                      | Role                                                                                        |
| ----------------------------------------- | ------------------------------------------------------------------------------------------- |
| `components/NotificationsHub.tsx`         | Page frame: SyncCenter, tabs, panels, guarded switch. Props: `tenantNoun`, `telegram` slot. |
| `components/NotificationsActivityTab.tsx` | Filter, scope line, bounded card, pager, empty states                                       |
| `components/NotificationsPushTab.tsx`     | Push cards + hints                                                                          |
| `components/NotificationsFeedPager.tsx`   | Newer / Older footer                                                                        |
| `components/TelegramModulesOverview.tsx`  | Status grid (desktop) / chip row (phone), jump to card                                      |
| `hooks/useNotificationsFeedPage.ts`       | Page index over `useNotificationsList('full')`, reset rules                                 |
| `lib/notificationsDateGroups.ts` (+ test) | Manila day buckets                                                                          |

Kept and extended: `NotificationsHubTabs` (add `push` view), `useNotificationsHubView`,
`resolveNotificationsHubView` (add `push`), `useTelegramHubStats` (per-module status).

Property and parking pages shrink to: page title, `AdminMobilePage`, `NotificationsHub` with their
own Telegram module list (the existing `AdminSection` + card JSX moves into the `telegram` slot
unchanged, permission wrappers included).

Deep-link resolution (one place, `resolveNotificationsHubView`):

| Inbound                                  | Opens                                           |
| ---------------------------------------- | ----------------------------------------------- |
| `?view=activity\|push\|telegram`         | That tab                                        |
| `?module=<valid module>`                 | Telegram, scrolls to module                     |
| `?module=marketing` on parking           | Telegram, scrolls to `parking` (existing alias) |
| `?section=activity`, `#section-activity` | Activity                                        |
| Nothing / unknown                        | Activity                                        |

The `AdminLayout` fill-main mode is still needed for the desktop inner scroll; confirm the
Notifications route keeps it once `AdminSectionNavLayout` is gone.

---

## 8. Phases

### Phase 1: Frame and tabs

- [ ] P1.1 Extend `NOTIFICATIONS_HUB_VIEWS` with `push`; update `resolveNotificationsHubView` and
      `notificationsPaths.test.ts` (view, module, legacy section/hash, unknown).
- [ ] P1.2 Build `NotificationsHub` with `NotificationsHubTabs` (3 tabs, unread badge on
      Activity, `FeatureStatusDot` on Telegram when `notifications.telegram` is off).
- [ ] P1.3 Guard tab switches with `useGuardedViewSwitch` + `UnsavedChangesDialog`.
- [ ] P1.4 Move property and parking pages onto `NotificationsHub`; drop `AdminSectionNavLayout`
      and the duplicated deep-link effects. Telegram JSX moves into the slot unchanged.
- [ ] P1.5 Lazy-mount each panel (only the active one renders). Scroll to `#section-<module>`
      after the Telegram panel mounts.
- [ ] P1.6 Check 375px fit for three pills + badge. If it does not fit, switch to the two-tab
      fallback (Section 2) before going further.
- [ ] P1.7 Update `PropertyNotificationsRouteSkeleton` / `ParkingNotificationsRouteSkeleton` /
      `NotificationsSkeleton` to the tab layout with real labels (skeleton-loaders rule).

### Phase 2: Bounded activity feed

- [ ] P2.1 `useNotificationsFeedPage` (page index over the infinite query, reset rules).
- [ ] P2.2 `NotificationsActivityTab`: bounded card on desktop, natural height on phone,
      `NotificationsFeedPager`, scroll-to-top on page change.
- [ ] P2.3 Render one page only in `InAppNotificationsPanel variant="feed"`; remove the
      sentinel/IntersectionObserver path for `feed` (keep `sheet` and `dropdown` as is).
- [ ] P2.4 Date group headers (`notificationsDateGroups.ts` + Vitest, Manila boundaries).
- [ ] P2.5 Scope line and new empty states.

### Phase 3: Unread filter (server)

- [ ] P3.1 `notifications-list`: optional `unread=1` param, read-only. Unit test the filter in
      `functions/tests/` with a mocked client, or a Deno test on the query builder.
- [ ] P3.2 Separate query key segment for the filter (still under `NOTIFICATIONS_KEY` so realtime
      invalidation and mark-read optimistic updates keep reaching it).
- [ ] P3.3 All / Unread segmented control; marking an item read on the Unread view keeps it
      visible until the next refetch (avoid rows jumping under the cursor).

### Phase 4: Telegram overview

- [ ] P4.1 Per-module status from `useTelegramHubStats` (Off / Needs setup / On) + shared token
      Saved / Not set.
- [ ] P4.2 `TelegramModulesOverview` grid (desktop) and chip row (phone), each item scrolls to its
      card and moves focus to the card heading.
- [ ] P4.3 Panel description line. No edits inside any Telegram card.

### Phase 5: Guidance

- [x] P5.1 Help copy registry entries — **partial**: `NOTIFICATIONS_HOW_IT_WORKS` shipped for property
      and parking (three channels + per-channel mute rule + Manila quiet hours). Subtitle, channel
      table, tab lines and empty states wait on the tab frame.
- [x] P5.2 `HowItWorksButton` (desktop header + phone hero) — shipped on both pages. `IntroCard`
      still pending.
- [ ] P5.3 Push tab `InfoHint`s after verifying preference scope and recipients.
- [ ] P5.4 Mark contextual-help P3.1 to P3.5, P3.7, P3.8 as delivered by this plan.

### Phase 6: Cleanup and docs

- [ ] P6.1 Delete `NotificationsHubShell`, `NotificationsHubSummaryCards`,
      `NotificationsActivityView`, `InAppNotificationsSection`, `notificationsHubSections.ts`,
      `notificationsHubPageCopy.ts`; remove their help copy entries and any copy-guard references.
- [ ] P6.2 Parking permission parity (P13): confirm whether parking has notification edit
      permissions; add wrappers only if it does, otherwise note N/A in the guide.
- [ ] P6.3 Docs (Section 10).

---

## 9. Verification

| Gate                | What                                                                                                                                                                                                                                                                                                                                                                        |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Vitest              | `notificationsPaths.test.ts` (push view, aliases), `notificationsDateGroups.test.ts`, pager reset logic in a pure helper                                                                                                                                                                                                                                                    |
| Deno                | `notifications-list` unread filter                                                                                                                                                                                                                                                                                                                                          |
| Playwright          | Update `ui/e2e/features/dashboard/notificationsHub.spec.ts`: opens on Activity; `?view=telegram`; `?module=finance` lands on Telegram + `#section-finance`; legacy anchor; pager shows 20 rows, Older loads 21-40 and the DOM still holds 20; dirty bot token prompts on tab switch and on route leave; Telegram settings requests do not fire until the Telegram tab opens |
| Other specs touched | `legacyRouteRedirectSmoke`, `dashboardModulesSmoke`, `moduleGates`, `axeSweep`, parking harness: re-run, fix selectors                                                                                                                                                                                                                                                      |
| Manual              | 375 / 768 / 1024 / 1440px, light and dark, both property and parking, AI mode canvas width                                                                                                                                                                                                                                                                                  |
| CI                  | `bun run ci:quality`                                                                                                                                                                                                                                                                                                                                                        |

Note from memory: `.test.tsx` component tests are silently ignored by Vitest here, so keep
testable logic in `.ts` helpers.

---

## 10. Docs to update in the same change

- `docs/guides/routes/org/property/notifications.md` and `docs/guides/routes/org/parking/notifications.md`
  (tabs, deep links, pager, overview; fix P12 drift).
- `docs/guides/support/faqs.md` + Host-facing knowledge (support-content), then
  `check:support-content` and `check:ai-knowledge-coverage`.
- `.agent/skills/notifications/SKILL.md` architecture map (remove the orphaned hub rows, add the
  new files).
- `docs/workflow/in-progress/dashboard-contextual-help.md` §P3 (cross-link, tick delivered items,
  drop the "not mounted" finding).
- `docs/guides/testing/` manual checklist if one exists for notifications.

Gates to state at the end: **Plans/RBAC: N/A** (no new gate; reuses `telegramNotifications`,
feature availability keys and existing module permissions). **activity-log: N/A** (read-only
filter, no new mutation). Unsaved changes: covered by the guarded tab switch.

---

## 11. Edge cases

1. Plan-limited member: `notifications-list` returns an empty list. Activity shows the empty
   state, not an error, and the pager is hidden.
2. Telegram feature off (`notifications.telegram`): tab still shows, with the existing
   unavailable panel and a status dot on the pill.
3. Realtime item arrives while on page 3: do not jump; the Activity badge updates. A small
   "New activity" link appears in the pager that returns to page 0.
4. Mark all as read while on page 3: optimistic update clears every cached page (existing logic).
5. `?module=` invalid for the tenant: falls back to Activity, not Telegram (existing rule).
6. Deep link to a module the user cannot edit: lands and scrolls; card shows the disabled
   wrapper as today.
7. Offline: pager buttons disabled with `NeedsConnectionHint` when the next page is not cached;
   cached pages stay browsable.
8. Very long guest names and body text: existing truncation and `line-clamp` stay.
9. Legacy per-message inbox rows split across pages: accepted (Section 3).
10. AI mode canvas (narrow container): tabs and overview use container width, not viewport.

---

## 12. Out of scope

- Any change inside Telegram cards or their modals (P3.6 of the help plan owns field hints).
- Notifications retention. Nothing prunes `notifications` today
  (`20261318170000_capacity_hardening.sql` leaves it alone). Paging makes the UI independent of
  table size; a retention policy is a separate product decision.
- Filtering the feed to the current property only. Possible later with a `property_id` param;
  for now the scope line explains it.
- Type filters (Bookings / Messages / Reviews) in Activity. Easy follow-up on top of Phase 3 using
  the preference group mapping, if hosts ask for it.
- Bell and slide-over sheet changes.
