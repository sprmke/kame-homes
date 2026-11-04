---
title: 'Tasks To Do'
status: active
tags: [planning, intake, backlog]
updated: 2026-11-04
stage: intake
kind: backlog
---

**Status legend:** ❌ cancelled / won't do · ✅ done · 🧪 for testing · 📋 planned (plan doc written) · 🚧 in progress · 🔵 pending / open

## Priority todos

- ✅ **Migration from the legacy prod app to the new app**
  Data, storage, auth, domains, email and repo are on the new stack. Closed 2026-11-03.
  → **Done:** [`../done/kamespace-02-legacy-prod-to-mt-prod-cutover.md`](../done/kamespace-02-legacy-prod-to-mt-prod-cutover.md)
- ✅ **Rename Kame Homes to Kame Space**
  Every label, text, env value, email template and third-party surface uses Kame Space. Guard green in CI.
  → **Done:** [`../done/kamespace-03-rebrand-kame-homes-to-kame-space.md`](../done/kamespace-03-rebrand-kame-homes-to-kame-space.md)
- ✅ **Move domain to kamespace.com**
  DNS, Vercel, Resend, DMARC, Supabase Auth, Turnstile, Meta, PostHog, Sentry, PayMongo and Google Business verified.
  → **Done:** [`../done/kamespace-04-domain-move-kamespace-com.md`](../done/kamespace-04-domain-move-kamespace-com.md)
- ✅ **Get Google services approval**
  Brand verification approved and published 2026-11-03. Remaining hardening is post-launch.
  → **Done:** [`../done/kamespace-05-google-services-verification.md`](../done/kamespace-05-google-services-verification.md) · hardening: [`../planned/google-services-production-hardening.md`](../planned/google-services-production-hardening.md)
- 🔵 **Get PayMongo approval**
  Business account approval and split payouts are still with PayMongo.

## Pre-release items

- 🔵 Update property settings and photos.
- 🔵 iCal sync to Airbnb
  → **Done:** [`../done/airbnb-calendar-sync.md`](../done/airbnb-calendar-sync.md)
- 📋 Live identity verification to simplify real identity checks
  → **Planned:** [`../planned/live-identity-verification.md`](../planned/live-identity-verification.md)
- 🔵 Booking detail: email sent history, quick resend, and view sent email content.
- 🔵 Cleanup tasks
  - Cleanup unused settings and email templates related to Parking.
  - Clean up unused env variables.
  - Store env variables and keep a current backup per environment.
  - Update and clean CI/CD after the legacy to multi-tenant migration.
  - List every third-party service. Add monitoring and alerts for errors, plus cost and limit tracking.
  - Able to sync data from hosting to local. → **Done:** `bun run sync:prod-data` (prod → local only).
- 📋 AI-supported marketing scheduling and strategy
  → **Planned:** [`../planned/marketing-meta-publishing-gaps.md`](../planned/marketing-meta-publishing-gaps.md)
- 🔵 Refine the archive and delete property flow.
- 🔵 Refine cancellation policy settings and the overall cancellation process.
- ✅ On/off dashboard pages, sections, features or buttons from super admin, with a visible reason
  → **Done:** [`../done/feature-availability-controls.md`](../done/feature-availability-controls.md) · QA: [`../for-testing/feature-availability-controls.md`](../for-testing/feature-availability-controls.md)
- Improve and refine default amenities and house rules
- Refine and improve cancellation policy options
- Fix issue where google map is not rendering properly on both dashboard and public page
- Add warning message if user refresh the page when editing on a page (ex. Settings)
- Cleanup usages of "—" on email templates and across the app
- Refine templates
- Improve activity modal from settings to be the same modal size or we have view and back UX
- Fix super admin UI issue on this: https://kamespace.com/admin/orgs/kame-homes
- Update super admin OTP from sprmke.dev@gmail.com to kameworks.tech@gmail.com
- Doing switch should display a toast message (atleast for "Notifications on this device")
- Why stay guide and showcase public page editor is not loading at all
-

## Post-release items

- 🔵 Add short helpful info for sections and features that need it (start with External Reviews).
- 🧪 Add templates (not email) to chat boxes across the app (AI assistant, Inbox)
  → **For testing:** [`../for-testing/chat-templates.md`](../for-testing/chat-templates.md)
- 🚧 AI Studio example photos and clips
  → **In progress:** [`../in-progress/ai-studio-sample-assets.md`](../in-progress/ai-studio-sample-assets.md)
- 🔵 Make table action columns consistent across pages (for example Maintenance).
- 🔵 Add a timeline view similar to Kame-Lends (Bookings, Finance, Maintenance).
- 🔵 Add a calendar or custom view to spot overlapping bookings and check the minimum cleaning window.
- 🔵 Refine public pages, their copy and open actions.
- 🔵 Refine the Reviews page.
- ✅ Returning to the dashboard opens the last visited listing at the correct level (org, property or parking).
- ✅ Use Sentry for error monitoring and PostHog for analytics
  → **Done:** [`../done/observability-sentry-posthog-split/README.md`](../done/observability-sentry-posthog-split/README.md)

Back to [intake index](./README.md).
