I---
title: 'Tasks To Prompt'
status: archived
tags: [planning]
updated: 2026-09-22
---

**Status legend:** ❌ cancelled / won't do · ✅ done · 🧪 for testing · 📋 planned (plan doc written) · 🚧 in progress · 🔵 pending / open

===

❌ Add main header in dashboard

Won't do — profile, theme toggle, and Explore/Host mode stay in the sidebar footer (`AdminLayout`); separate top header bar rejected.

→ **Won't do:** [`../wont-do/dashboard-top-header-bar.md`](../wont-do/dashboard-top-header-bar.md)
===

✅ Expand Inbox module to both org and property levels

Right now, we only have Inbox module at org level.

We should expand it and we should have menu and pages on property level.

The only differences are:

At org level:

- Web chat - we can display all property web chats and conversations. We have a view property link that redirects us to property dashboard
- Facebook/Instagram - this would be the default meta account. if user connect their meta account at org level, this should be reused and be the default meta account for all properties inbox module. Meaning, when we visit all properties, we will have automatically connected and reused meta account per property. Unless they manually connect to different meta account on specific properties. The initial connected meta account should be used and be the default meta account to all properties & parkings.

At property level:

- Web chat - scoped and only display the chat and conversations under specific property.
- Facebook/Instagram - we can connect different meta account per property.

Plan: `docs/workflow/done/inbox-org-property-parking.md` (includes parking)
===

✅ Support both property and parking bookings in /bookings module at org level.

We need to update /bookings module at org level to display info and available actions for both properties & parking.
Right now, only properties are working and visible there.
Adjust all views (table, card, calendar) to display properties & parking info and make sure all filters, and any supported functions for both module will work correctly.
Maybe at org level, we can remove the kanban board because we don't have workflow for parking bookings.

We should also update the stat cards, filters, and any actions available on bookings module at org level.
The end goal is that we should support both properties & parking modules in bookings module at org level.
===

✅ Refine Notifications module

- Shared bot token card (one token for all modules; pre-fills module fields; editable per module)
- Help dialogs (BotFather + chat ID)
- Module card descriptions
- Find chat ID scanner hidden after **Connected**

Original intake:

Let's offer an option to have global bot token which can be used for all modules.
So we will have a first card to input global/reusable bot token and a button to test if token is valid.
Once saved, this will be the default bot token value when a module is enabled, this is still editable and viewable.
But this is better because we can have a one bot token for all notification modules.

Also, on first card, we should have a help button and when we click it, we will provide a very detailed instructions on how to generate telegram bot token.

Then, for each module, when we will also have a help button for chat id, and with same flow, we will provide detailed guide on how to get tg chat id.

Lastly, let's provide card description for each section, for what each module is for.
===

✅ Update pricing menu/page to be "Calendar"

We will have different tabs or switch view inside our calendar page.

1. Default View - think of better name. similar with our calendar view in property dashboard where we can toggle view between booked guest info and price view
2. Pricing View - this is the current pricing page to configure pricing per booking. We should also have to support to block booking date

Guide: `docs/guides/routes/org/property/calendar.md`
===

✅ Improve dashboard UI at org & property level
===

✅ Make sure all media uploader default image is empty (ex. org logo). Please analyze all our dashboard image uploader and make sure we don't have static or default images that's tied to Kame Home (2604)
===

✅ Do not allow the following names for org and property name.

- Azure North
- Azure North Residence / s (this should be regex)
- Azure North Residence Official
- Azure North Official
- Azure Official
- or contains "Official"

Again, our detector should be smart and use detector, adding pre, post and between characters should not also be allowed. PLease be very smart. We are doing this so that hosts cannot register general names or use the any residence name and disguise as the official or main host/org/property

Make sure we apply this validation on onboarding, settings and all other locations
===

✅ Redesign property public pages layout/container

I'd like to redesign our property public layout pages to display a header where it contains minimal information like logo, dark mode toggle, and user icon. Reuse existing public header that we have make it minimal to our property public pages (form, calendar, sd refund, etc)

Let's also please cleanup our redirect to dashboard icon button and dark toggle mode that we have on existing pages.

Also, another thing that we need to improve is that we should display or redesign the property info, booking info.
===

✅ Refine all property public pages

→ **Done:** [`../done/public-operational-guest-pages-multi-tenant.md`](../done/public-operational-guest-pages-multi-tenant.md)
===

✅ Make google map view mode in search or public page listing

Shipped: [`../done/google-map-listing-view.md`](../done/google-map-listing-view.md). Real Google Maps on `/properties`, `/developments`, and `/search` category tabs. `/parkings` index map toggle still optional follow-up.
===

✅ Update each page browser title to be dynamic.

Public Pages - Kame Homes - ${page name}

Property public pages - ${Property Name} - ${page name}

Dashboard Org Level pages - ${Org Name} - ${page name}
Dashboard App Level pages - ${App Name} - ${page name}

Make sure we have a rule for this every time we update or create new pages.
Update both dashboard and public pages.

I'm sure there are other pages that we need to update to match exactly how we should update their name.
Please list them down and if you have suggestion to name differently or grouped or scoped
===

✅ UI/UX improvements

- Improve dashboard search, filter, sort and action buttons. Notice how we simplify it on mobile, maybe apply for desktop
- Improve pagination UI/UX
- Add table column sort
- Update modal to be scrollable inside modal content;
  \===

✅ Analyze our AI dashboard assistant and analyze the common questions and actions that host can ask/do.

This should be a tab within the chat history when they open our sidebar chat or when they click new chat.
These would be helpful list of questions and actions that host can do.

Let's generate 20 common questions and 20 actions, but only list 5 randomized items on our chat.

→ **Done:** starter prompts in the AI assistant panel. New chat centers a **Questions / Actions** mode switch (5 randomized prompt cards). Pool: `ui/src/features/dashboard/ai-assistant/lib/assistantSuggestions.ts`.
===

✅ Another feature that we need to do in our AI assistant chat is to support uploading images (ex. receipt, approved GAF) & files.
Beside from this, it's also helpful to add or include context of booked dates, so that host can select a booking and use it as reference to chat.
So we will have dropdowns for actions beside the input chat

→ **Done:** composer paperclip (Photo / File, JPEG/PNG/WebP/PDF, max 3 × 4 MB) and booking pin beside the input. Files stored in `ai-assistant-attachments`; pin sets `pageContext.bookingId` for that turn. See [`../done/ai-dashboard-assistant-features.md`](../done/ai-dashboard-assistant-features.md).
===

✅ Update brand color picker to provide pastel and good looking for different colors and still have an option to choose custom color from color picker

→ **Done:** pastel preset swatches + rainbow custom picker in `ui/src/features/dashboard/org/components/settings/BrandColorField.tsx`
===

✅ Display animated popup party when hosts open calendar and we have 20+ bookings this month

→ **Done:** `CalendarBookingCelebration` on Bookings calendar + property Calendar (`BUSY_MONTH_CELEBRATION_THRESHOLD = 20`); see [`../done/property-calendar-page.md`](../done/property-calendar-page.md)
===

✅ Add ability to share calendar?

→ **Done:** [`../done/inbox-share-links-and-files.md`](../done/inbox-share-links-and-files.md) — Inbox composer Share icon sends calendar/property/booking links; calendar link opens an in-place availability modal for guest and host.
===

✅ Socials at org and property level

We should refine how we can improve the socials management for org and property level to prevent any redundant fill up.
Provide a best UI/UX so that on property/parking level, we have option to reuse the same value of org level per fields.
Maybe, we will offer a global button that if click, we will make all social fields read only and populate it with org values.
Or maybe it's better if we have individual toggle per field? Or support both? Provide the best UI/UX for our scenario.

→ **Done:** per-field **Use org** inherit toggles on property settings (`SocialLinkInheritField`, `PropertySocialsBrandingSection`, `propertySocialLinks.ts`); parking settings reuse the same payment/social patterns where applicable.
===

✅ Generate more real world mock data

Generate more real world and hundreds of mock data for different properties, developments, parking, and other type of place so that we can fully test and simulate real world test data and fully verify if our search, filters, lazy load, and any app performance optimization implementation are working properly.

→ **Done (opt-in local seed):** `bun run seed:mock-listings` → `scripts/dev/generate-mock-listings-seed.mjs` (~320 properties / ~65 developments / ~225 parkings across 30 PH cities). Not wired into `db reset` — run manually when perf QA needs volume.
===

✅ Update all payment AI validation to make sure that we achieve the actual minimum amount, date is reasonable, etc

→ **Done:** `supabase/functions/_shared/receiptValidationService.ts` — `expectedMinimumAmountForReceiptKind` + `evaluateReceiptSanityWarnings` / `applyReceiptSanityChecks` for downpayment, balance, parking, and SD refund receipts (amount floor + Manila date reasonableness warnings).
===

✅ Update all dropdown from using default UI to standard dropdown UI

→ **Done:** removed legacy `native-select.tsx`; dashboard uses shadcn `Select` / combobox patterns (no raw `<select>` left in `ui/src`).
===

✅ Update all app, screen and skeleton loaders
===

✅ Generate not found page
===

✅ Make sure auth modal and auth page section is similar or aligned same order for consistency
===

✅ Next-stay voucher redemption (guest wallet + booking apply)

→ **Done:** [`../done/voucher-redemption.md`](../done/voucher-redemption.md) · awards: [`../done/property-guest-rewards-vouchers.md`](../done/property-guest-rewards-vouchers.md) · reveal styles: [`../done/voucher-reveal-styles.md`](../done/voucher-reveal-styles.md)
===

✅ Commission-based pricing (pay % of completed bookings)

Foundation schema exists but product was retired from live UI (2026-08-24) until fully shippable: host self-serve, Plans & Billing, public pricing, invoicing/PayMongo collection. Do not re-enable the catalog row without a plan.

→ **Pending:** `docs/architecture/plans-feature-matrix.md` § Pending: commission pricing · partial foundation: [`../done/host-plans-and-pricing-tiers.md`](../done/host-plans-and-pricing-tiers.md)
===

✅ Update dashboard AI assistant to support edit public page

→ **Partial:** public-page **context attach** shipped in [`../done/ai-assistant-universal-context-pickers.md`](../done/ai-assistant-universal-context-pickers.md) (`ChatComposerPublicPagePicker`). **Still open:** assistant-driven edits to Stay Guide / property landing content (use Page Editor or new tools).
===

✅ Update for-hosts landing page animation section with updated features and more refined text/voice

Rebuilt the Remotion dashboard tour into 19 variable-length chapters (~2m 54s) with high-fidelity route recreations, dedicated chapters for AI import, Airbnb sync, Guest Inbox, voice receptionist, Marketing Studio, Public Pages editor, and AI dashboard assistant.

→ **Done:** guide [`../../guides/routes/for-hosts.md`](../../guides/routes/for-hosts.md)
===

✅ In booking detail page, analyze if same primary guest name is recurring guest and respect voucher discount if enabled
===

🚧 Branch deployment guide + dev/staging environment

Meaning, I want to deploy our app in vercel with ou current branch with our new changes.

Same for supabase, but instead of having branch deployment with Suapabase which is not free. I want to create new supabase project with different account to intialize and setup everything.

The goal in the end is for us to deploy and see fully working application with our new changes.

Also, another important setup I'd like to have is to point or use supabase deployed dev in our local so that we don't need to run docker from our local to test and work locally. Meaning, when we have any supabase related changes locally, and test our app, I still want to see our changes and fully working on it with our local frontend. Meaning, when we are working locally, we can still work on it without running docker and without deploying our backend/supabase related changes to dev. Then, once good, we can deploy our changes to dev. I'm not sure how is this possible but this is how we do it on other projects and I'd like to implement in our app

→ **Runbook shipped; operator bootstrap pending:** [`../in-progress/ci-cd-environments/dev-staging-environment.md`](../in-progress/ci-cd-environments/dev-staging-environment.md) · index [`../in-progress/ci-cd-environments/README.md`](../in-progress/ci-cd-environments/README.md)
===

🚧 Improve marketing generate modal > suggestions thumbnail is confusing

Update marketing generate design suggestion thumbnail to be more closed to calendar template, design and video clips

→ **Related:** [`../done/marketing-module-refinement.md`](../done/marketing-module-refinement.md) (perf/AI-gen + generate-modal stepper shipped; Meta publish UX gaps split to [`../planned/marketing-meta-publishing-gaps.md`](../planned/marketing-meta-publishing-gaps.md))
===

🚧 Refine add pay parking and add/edit parking from booking detail page

→ **Partial:** `PayParkingModal` + header overflow action on booking detail (`BookingDetailPage`, `PayParkingModal.tsx`). **Still open:** polish edit-form parking tab UX and parking-on-booking flows beyond current modal.
===

🚧 Support normal auth and add auth pages like login, register, forgot password, profile page, etc. Plan to use easy sign on for modern auth approach?

→ **Partial:** guest `/for-guests/login` + `/for-guests/register` (email OTP + Google), host `/for-hosts/login` + `/for-hosts/register` (Google), guest account hub `/account/*` (profile, stays, messages, wishlist, settings). **Still open:** forgot-password / magic-link recovery flow.
===

🚧 Improve UI/UX of exported reports

Let's refine, improve and make the exported reports look more professional, neat, have proper spacing, does not look like AI generated report, clean and elegant, no broken text or UI, respect theme colors, etc.

Make sure we apply it to all exported reports and sub reports for all modules that supports reporting
===

🔵 Redesign hosts page to be similar UI with developments page.

Maybe add org photos/banner from org settings?

- http://localhost:5173/hosts/kame-homes
- http://localhost:5173/developments/azure-north-residences
  \===

🔵 Improve avatar video animation
===

🔵 Cleanup all env variables and example for both ui and supabase

EMAIL_TO / EMAIL_REPLY_TO
===

🔵 Make sure the SD refund payments is reflecting based on payment methods available from property settings
===

🔵 Improve parking details
===

🔵 Support org pincode for security
===

📋 Check current functionalities and features that we have that may cost us in billing and may use a lot of services and expensive tasks either on UI, database, backend and that may cost us so much money when we deploy to prod. List them down, provide solution and suggestion how to resolve and improve it. We also need to decide if we keep, improve or change it or totally remove it. We need to carefully analyze if the cost is worth it with the impact the feature offers.

Sept 2026 audit delivered (Resend free cap, rotated free AI keys, voice receptionist / Gemini Live, PostHog replay, Vercel Hobby, Supabase realtime/polling, storage, Google Maps guest-facing loads, PayMongo txn fees, Remotion/Jamendo licensing). Full cost-control + optimization plan (per-service super-admin limit matrix, `serviceGuard` + auto-degrade engine, `/admin/service-health` console, email/Telegram alerts, D1–D8 optimization workstream, plan-tier entitlement mapping; P0–P6):

→ **Planned:** [`../planned/super-admin-service-cost-monitoring.md`](../planned/super-admin-service-cost-monitoring.md)
===

🚧 Reschedule dropdown action from booking detail page
===

🔵 No privacy policy, cookie consent, terms & conditions & no exposed user data
===

📋 Guest review — add Facebook review step if possible

After guests submit their in-app Kame review (`/sd-form` step 1 or standalone `/properties/:slug/guest-review`), explore adding an optional **Facebook review** prompt or step when the property has a Facebook reviews URL configured (`facebookReviewsUrl` / `facebook_reviews_url`).

Legacy SD flow redirected guests to Facebook before the voucher reveal; the current flow is in-app only. Research whether we can deep-link to the host's Facebook review page, show a clear CTA after Kame review submit, and whether completion can be verified (or should stay honor-system). Implement only if feasible — do not block voucher/refund on Facebook completion unless we have a reliable signal.

→ **Planned:** [`../planned/guest-review-facebook-cta.md`](../planned/guest-review-facebook-cta.md)
===
