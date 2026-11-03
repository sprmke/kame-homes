---
title: 'PWA real-device QA sheet'
status: active
tags: [testing, pwa, manual, device]
updated: 2026-11-02
---

# PWA real-device QA sheet

Manual checks that cannot be automated: install flows, in-app browsers, real push
delivery, iOS storage separation, splash screens, and rotation.

Run this for every release that touches the PWA (manifest, service worker,
`ui/src/lib/pwa/**`, `ui/src/components/pwa/**`, `ui/src/features/launch/**`,
`scripts/pwa/**`, `push-*` edge functions).

Record the result per device in the table at the end. Any ❌ blocks the release.

## Devices

| Platform        | Browser                           |
| --------------- | --------------------------------- |
| Android 13+     | Chrome, Samsung Internet, Firefox |
| iPhone          | Safari (iOS 17, 18, 26), Chrome   |
| iPad            | Safari                            |
| macOS           | Safari (Add to Dock)              |
| Windows / macOS | Chrome, Edge, Firefox (desktop)   |

Plus **in-app browsers** on both platforms: Facebook, Messenger, Instagram
(the PH guest traffic path — these must never see an install offer).

## Scenarios

Mark each ✅ / ❌ / N/A and note the build id (Help & Support → App card).

### 1. Install offer

- [ ] A first-time anonymous visitor sees **no** floating install offer on any page.
- [ ] The offer never appears on `/properties/:slug/form`, `/sd-form`,
      `/pay-parking`, `/onboarding`, `/for-hosts/login`, or with a sheet open.
- [ ] Inside Facebook / Messenger / Instagram, no offer appears (guest or host).
- [ ] A signed-in host on a phone gets the offer after a value moment (or the 2nd
      session within 7 days), as a **bottom sheet**, not a floating card.
- [ ] Desktop Chrome host gets a quiet chip on the 3rd session, not a modal.
- [ ] Dismissing it hides it for 14 days; the 2nd dismissal is 30 days; the 3rd is
      90 days; after the 4th only the menu entry remains.
- [ ] "Don't ask again" ends proactive offers permanently.
- [ ] iOS Safari shows the version-correct Share guide (iOS 26: Share is behind
      the "…" button in the tab bar).
- [ ] macOS Safari 17+ shows "File → Add to Dock".
- [ ] The permanent entry (More sheet / footer / Help & Support) opens the right
      flow and is hidden once installed.

### 2. Install + first launch

- [ ] Install from Chrome (Android) and confirm the rich dialog shows screenshots
      and the description.
- [ ] Home-screen label matches the app name (not "Kame Space").
- [ ] First launch shows the welcome sheet once, and never again.
- [ ] On iOS the installed app starts signed out: sign-in inside the app works and
      returns to the same screen.
- [ ] The launch screen (splash) matches the app theme; no white flash, including
      in dark mode.
- [ ] No portrait lock: rotate a tablet on the calendar, finance and an editor.

### 3. Launch routing + shortcuts

- [ ] Opening the installed app lands on the last used property/parking dashboard,
      never the public marketplace.
- [ ] `Bookings`, `Inbox` and `Check-ins` shortcuts each open the right screen.
- [ ] The Check-ins shortcut lists only today's arrivals (Asia/Manila date).
- [ ] A signed-out host device opens the host sign-in, then returns to the shortcut.
- [ ] A host who lost access to the last property still lands somewhere usable.

### 4. Offline

- [ ] Airplane mode after one visit: the installed app still boots and opens the
      last dashboard.
- [ ] Bookings, Inbox and the stay guide render their last data with a visible
      "offline" strip that does **not** cover the page header.
- [ ] A never-visited deep link offline shows the offline page, not a browser error.
- [ ] The offline page's "Try again" button works.
- [ ] Queue an inbox reply while offline: it appears optimistically, then sends
      once when the connection returns (exactly once).
- [ ] Mark a notification read while offline: it applies and syncs later.
- [ ] Fill part of the booking form, kill the app, reopen: the restore prompt
      appears and restores correctly (and does not fight a `bookingId` prefill).
- [ ] Submitting the booking form while offline keeps the button disabled with a
      clear message; answers are kept.
- [ ] Send a guest portal message (text only) while offline: it shows as sending,
      then lands exactly once when the connection returns.
- [ ] While offline, bookings / inbox / notifications show "Updated Nm ago".
- [ ] In the installed app, pull down from the top of Bookings and Inbox: the
      spinner appears and the list refreshes. Scrolling still feels normal.
- [ ] Apply an update while scrolled halfway down Bookings: after the reload the
      list is at the same offset, not the top.

### 5. Updates

- [ ] Deploy a new build with the app open on a clean page: it updates on its own
      within one foreground cycle (or shows the "Update ready" prompt).
- [ ] With a dirty form open, the app does **not** reload; the prompt appears and
      "Later" hides it for 4 hours.
- [ ] Two tabs open: one applies, the other reloads only when clean.
- [ ] Setting `forceUpdateBelow` shows the blocking update sheet without wiping data.

### 6. Push

- [ ] Enabling notifications works on Android, desktop and iOS 16.4+ (installed).
- [ ] A booking transition delivers a push with the app closed, backgrounded and
      foregrounded (foreground shows an in-app toast, one notification only).
- [ ] Tapping the notification opens the right booking/thread and switches tenant.
- [ ] The app-icon badge shows the unread count while the app is closed, and clears
      when read.
- [ ] A property-only or parking-only team member receives the notification.
- [ ] Reading a notification in-app removes it from the OS tray.
- [ ] Mute **Messages** on the Notifications page, then trigger an inbox message:
      no OS push, but the bell still shows the unread row.
- [ ] Turn on quiet hours covering the current time: no OS push for a booking
      event; a calendar-sync failure still arrives.
- [ ] Toggle a preference with no connection: the control is disabled and an
      inline "You are offline" line shows instead of a failed save.

### 7. Auth and payments inside the installed app

- [ ] Google sign-in (host and guest) returns to the app with the session.
- [ ] Meta connect (inbox) completes in standalone.
- [ ] PayMongo hosted checkout (plans, AI credits) returns to the app.
- [ ] No flow sends a magic link that would open in the browser instead of the app.

### 8. In-app browsers

- [ ] A Facebook/Messenger visitor can complete a booking form end to end.
- [ ] No install prompt, and no dead "Install" entry point.
- [ ] The guest sign-in path inside the in-app browser works.

### 9. Old-domain retirement (only once the domain move is live)

- [ ] An app installed from the legacy host updates to the retirement worker and
      lands on the canonical origin on the same path.
- [ ] Queued offline changes are either drained first or listed to the user.
- [ ] Push subscriptions re-enable after reinstalling from the new origin.

## Results

| Device | Browser | Build | Result | Notes |
| ------ | ------- | ----- | ------ | ----- |
|        |         |       |        |       |
