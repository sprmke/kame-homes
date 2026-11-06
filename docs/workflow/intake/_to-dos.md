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

- ✅ Update property settings and photos.
- ✅ iCal sync to Airbnb
  → **Done:** [`../done/airbnb-calendar-sync.md`](../done/airbnb-calendar-sync.md)
- 📋 Live identity verification to simplify real identity checks
  → **In progress:** [`../planned/live-identity-verification.md`](../planned/live-identity-verification.md)
- 🚧 Booking detail: email sent history, quick resend, and view sent email content.
- 🔵 Cleanup tasks
  - Cleanup unused settings and email templates related to Parking.
  - Clean up unused env variables.
  - Store env variables and keep a current backup per environment.
  - Update and clean CI/CD after the legacy to multi-tenant migration.
  - List every third-party service. Add monitoring and alerts for errors, plus cost and limit tracking.
  - Able to sync data from hosting to local. → **Done:** `bun run sync:prod-data` (prod → local only).
- 📋 AI-supported marketing scheduling and strategy
  → **In progress:** [`../planned/marketing-meta-publishing-gaps.md`](../planned/marketing-meta-publishing-gaps.md)
- 🔵 Refine the archive and delete property flow.
- 🚧 Refine cancellation policy settings and the overall cancellation process.
  → **In progress:** [`../in-progress/cancellation-policy-and-process.md`](../in-progress/cancellation-policy-and-process.md)
- ✅ On/off dashboard pages, sections, features or buttons from super admin, with a visible reason
  → **Done:** [`../done/feature-availability-controls.md`](../done/feature-availability-controls.md) · QA: [`../for-testing/feature-availability-controls.md`](../for-testing/feature-availability-controls.md)
- 🚧 Improve and refine default amenities and house rules
- 🚧 Refine and improve cancellation policy options
  → **In progress:** [`../in-progress/cancellation-policy-and-process.md`](../in-progress/cancellation-policy-and-process.md)
- ✅ Fix issue where google map is not rendering properly on both dashboard and public page
- ✅ Display warning message if user refresh the page when editing on a page (ex. Settings). Right now, we only display the default browser warning and not our custom popup modal warning
- ✅ Cleanup usages of "—" on email templates and across the app. If we need to use it, then please ensure that we use the normal "-". But please analyze carefully if it's good UX to use - at all. Then make sure to apply all usages across the entire app that it's still using it. From UI, email templates and other locations that we are using it from our app.
- Refine templates
- ✅ Improve activity modal from settings to be the same modal size or I think it's better if we have navigation here to view the activity detail and we can back to it instead of opening it on a new modal
- ✅ Fix super admin UI issue on this: https://kamespace.com/admin/orgs/kame-homes
- ✅ Why stay guide and showcase public page editor is not loading at all (root cause: `public-page-configs` edge function boot error from a duplicate `const row`; also added error states so a failed config no longer leaves the skeleton up forever)
- ✅ Why "Save Changes" button on settings page is showing when we have new changes but disabled
- ✅ Improve marketing landing page to not use dynamic image on "What do you want to make?" and have our fixed static assets. Also please address and remove the accent color that looks ugly specially on dark mode
- ✅ Require OTP when we save any changes from Templates page/module
- Refine and further improve the marketing default generated marketing materials/examples/templates. They all look very ugly!
- Refine landing page
- ✅ Optional Resend hygiene: send From a dedicated subdomain (e.g. `notify.kamespace.com`) instead of apex `mail@kamespace.com`. Requires new Resend domain + DNS, then `RESEND_FROM_EMAIL` flip (`kamewave`). Image-hosting insight is already fixed in code via CID inlining (`sendResendEmail`).
- Refine Channel sync modal
- Reposition light/dark switch
- Improve paid/pro subscription badge/flow
- Control for auto transition to ready for check-in status?
- Refine edit booking detail page
- Make sure updated with new changes and features that we have
  - Subscriptions tier & validation
  - Team access
  - Updated tests (unit, e2e, integration)
  - Updated guide docs for support Q/A and guides
- Improve ? helper notes from tooltip to a new whole modal with detailed instruction and graphics/images
  - Pricing -> Channel Sync

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
