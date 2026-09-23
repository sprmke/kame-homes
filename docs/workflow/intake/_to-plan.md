---
title: 'Claude To Plan'
status: archived
tags: [planning]
updated: 2026-09-24
---

**Status legend:** ❌ cancelled / won't do · ✅ done · 📋 planned (plan doc written) · 🚧 in progress · 🔵 pending / open

===

❌ Do ground up redesign in dashboard UI to not make it look like AI generated app

Even after multiple redesign changes, it looks and feel like our dashboard UI looks like AI generated dashboard app.
We need to do /impeccable critique, audit then do plan, shape, document then do layout, optimize, bolder & polish.
The end goal is to make our boring or current dashboard UI to level up and looks more beautiful, elegant, clean & professional, animated & interactive that offers best UI/UX and specially, does not look like AI generated design and application.
You can refer to our public pages design. See how elegant and clean it is.

We can separate our dashboard redesign to different phases. Maybe start with base styles, fonts & sizing, colors & theme and designs, etc. Then, next phases are structural change, text copy change, alignment, responsiveness, etc.

Just make sure that we don't change or affect any public related pages that we have. make sure not even one single style on our public pages will be affected. We need to make sure that the design in our dashboard is scoped & isolated and will not affect our public UIs.

# → **Won't do:** [`../wont-do/dashboard-ground-up-redesign.md`](../wont-do/dashboard-ground-up-redesign.md) — incremental dashboard polish only; no dedicated ground-up pass

✅ Improve for-hosts landing page

For host mode, we should improve the landing page for /for-hosts that showcase all the features and functionalities that we have from our dashboard. I want to have a stunning, looks very professional, animated landing page that showcase all the features that we have for our system.

Reviews section from hosts is also good. We can use mock data for now.

# We should also need to update our header menus for hosts mode

✅ Refine Property Templates page

We should have a tab for standard, email and other templates.
Then, we should support for host to add new template for each tab/category.
===

✅ OPTION A: Improve stay guide UI/UX page

The stay guide page looks very plain and not appealing at all. This needs to be mobile friendly, looks professional, interactive and has wow factor so that when hosts send this link to their guests, they will be happy using it.

# → **Done:** [`../done/custom-pages-module.md`](../done/custom-pages-module.md) (Option B; Option A is stay-guide slice of same plan)

✅ OPTION B: Templated configurable & shareable custom pages

Generate 3-5 templated stunning and professional looking landing pages/stay guide pages that contains these standard templates, property information and booking information for hosts to send their to their guests.

<Provide sample designs here>

On the dashboard, we will have new menu and page for "Custom Pages" where they can selected templated pages that's configurable and shareable.
Maybe we will offer a simplified website editor?

# → **Done:** [`../done/custom-pages-module.md`](../done/custom-pages-module.md)

✅ Make our main public search bar fully working

Let's analyze all public data that we have for developments, properties, parkings, etc and based from our data, we need to have a solid implementation on how our main search bar is going to work, this should be smart, cached, and fully working similar on how popular apps offer search bar that can find, filter, search and suggest information based on our search inputs that we have (where, when, |who).

Let's implement a smart search bar that can understand what the user wants to search and based from it, provide info or suggest common or similar search input text.

Our search should suggest information for where. And when they click search button, we should have smart and suggest results.

See how popular apps do this and make sure we have similar UI/UX and search results/suggestion.

Make sure that filtered result are animated and we display it elegantly. Not sure if we need to redirect it new /search result page or we can just display and update our content section based on result.

# → **Done:** [`../done/smart-search-bar.md`](../done/smart-search-bar.md)

✅ Make filters fully working

Once we finalized and have fully working search bar and functionality, we should also update and make our filter works fully end to end.

Based on which route or module we are, we should provide smart filter options and make sure all options are smartly suggested and all of it should properly filter our results/items.

The goal is to have a very smart filter sidebar section to filter any data that we have on different modules & pages.

We should also refine and update our sort options based on our data and make sure this will also work properly.

# → **Done:** [`../done/smart-filters.md`](../done/smart-filters.md)

✅ Marketing 1: Improve Marketing Calendar Templates

Right now, our marketing calendar templates look simple and okay.
They do not look beautiful, stunning, eye catching, and doesn't have that wow factor.
Please improve all these templates and provide better categories. Each template should have different characteristics, showcase all settings available for calendar customization, different fonts, element shapes/border/spacing/colors, etc.
The end goal is the every template looks so good where host cannot select which one to choose because they all look good!
===

✅ Marketing 2: Improve Marketing Design Templates & Customizablity

Same with calendar templates above. Right now, our canvas template are too plain and does not look good.The
goal is that each template should be production ready and "instagramable" and ready to publish with confidence and excitement to their social platforms.
===

✅ Marketing 3: Improve Marketing Video Templates & Customizablity

Same with marketing design templates goal.

# → **Follow-up (Quiet Coast Motion):** from-scratch Video redo — Video-only categories + storyboard recipes. Spec: `docs/archive/superpowers/specs/marketing-video-quiet-coast-motion-design.md`. Plan: `docs/workflow/done/marketing-video-quiet-coast-motion.md`.

✅ Marketing 4: Use AI to generate marketing calendar, design and video templates

Now that we made some improvements on marketing calendar, canvas and video editors, I want to really extend by having AI feature that will generate design and video templates from scratch that looks very beautiful, elegant, instagrammable and has wow factor to hosts.

The generated result can be configured by some prompts, suggestions, etc (please make some research how popular media editors do AI generated flow).

We can also make some research if there's a free or low cost API that can do this. Either the AI generates the calendar, canvas and video from scratch or custom or it's own way, OR it will reads and build new designs based on our existing technologies, templates and settings that we have for each marketing module.

The end goal is that with the help of AI, we should be able to generate calendar, canvas and video templates for our hosts that's still using our booking or property information and some prompts/settings.

# → **Done:** [`../done/marketing-ai-generated-templates.md`](../done/marketing-ai-generated-templates.md) (calendar, design, and video AI generate shipped)

✅ Refine footer & create public pages

Footer trimmed; About/Contact/Support/Cookies routes live; Terms/Privacy/Cookie Policy grounded in product copy.

# → **Done:** [`../done/refine-footer-public-pages.md`](../done/refine-footer-public-pages.md)

✅ Refine our route guides to have complete context for each page & section in our app

Let's refine and update our /docs/guides directory and make sure we have documentation for all features, flow, logic and complete understanding on what's available and happening for each pages and section in our app.

Make sure we always update and add any new routes or updated any missed routes. Revisit each guide doc routes and make sure we update with our latest changes available.

This document will be helpful in our project while we develop it and my goal is to provide this docs when we integrate AI chat in our dashboard to provide better response and context to hosts when they ask something about some app knowledge, features, flow, process, etc

# The goal of this docs is to become a context and product knowledge for our AI receptionist & dashboard AI assistant features

✅ Extend chat app to have real-time chat with AI receptionist

I want to extend our normal real-time chat app to provide an option for guests to try out our AI receptionist to talk and answer their inquiries.
When they enable it or try it, we will have different interface where we display an animated and cute turtle that speaks and have conversation with out guest. I'm thinking where we have a button to talk to our receptionist, and when they click it, it will start a session or recording and guest can talk to it, display real-time detect words/conversation and display the response of our receptionist in real time.

Basically like Siri or alexa with animated talking cute turtle. Same with our normal AI auto-reply, it should have access to property, booking information but limits to sensitive data that a normal guests should not know.

Please plan and make a research if there's already existing libraries, technologies that we can use that's FREE (or very low cost), app performant, and can production ready.

Also, please consider the session time, AI token usages, and other important things to plan and consider with this feature.

All the settings should be configurable in our admin dashboard as well. If we can choose between voices, and other settings, etc, that would be great!

I think there are a lot of existing projects like this, what we need to plan and refine is this should be production grade level, will not introduce any issues or security risks, it should not crash, and it should be easy to use and helpful for guests.

# → **Done:** [`../done/ai-voice-receptionist.md`](../done/ai-voice-receptionist.md)

# 🚧 AI receptionist production-readiness review

Harden the shipped guest voice receptionist for production: current Gemini Live protocol, transcript integrity, atomic session lifecycle, tiered guest-safe context, guardrails, reconnects, low-latency conversation UX, privacy, observability, automated tests, and staged rollout.

# → **In progress:** [`../in-progress/ai-receptionist-production-readiness.md`](../in-progress/ai-receptionist-production-readiness.md)

✅ Provide chat app that can access and manage entire dashboard

Another big module that I'd like to support is to have a chat app that can access and manage entire dashboard. This should be a chat app that can understand natural language, and can do actions like booking, check-in, check-out, etc. It should be able to understand the context of the conversation and respond accordingly.

What we want is to simplify all property management with the help of AI. It should have access to our APIs, get information, execute actions based on context.

The chat response or suggestion should have a good looking UI/UX within the chat, we should display different kind of UI elements like cards, lists, buttons, etc. to make it more interactive and helpful.

This should be very smart and it will act like an assistant that have all information on how our system and every feature work, the flow and process, it should be very helpful and can suggest helpful actions and information to our host so that they can manage their property more efficiently and easily without the needs to do everything manually and this will also reduce complexity of understanding the whole app, process, logic and flow.

This is a very important feature that will make our system much more powerful and helpful and reasons for user to subscribe and use our system.

Again, this should not provide any sensitive or execute any harmful actions that may affect the system. We should implement a strong guard rails or security measures for this feature.

Also, we need to make sure that this is connected to our AI receptionist, or may share same util, process, flow since both of these modules are using AI.
We need to plan the architecture, flow, process for both module to build a production ready chat app.

Also, this should be tied app with our pricing and subscription module so that we can limit the free usages of this feature to a certain amount and charge for additional usage.

# → **Done:** [`../done/ai-dashboard-assistant.md`](../done/ai-dashboard-assistant.md) · v2 full coverage: [`../done/ai-dashboard-assistant-v2-full-coverage.md`](../done/ai-dashboard-assistant-v2-full-coverage.md)

✅ Booking from listing e2e

I want you to review our whole booking end to end flow and make sure it's production ready. When a guest book from our listing page or from our guest form. Please review each step, flow and process that we have. Improve UI/UX or flow that we need to improve.

The end goal is to make sure that we don't miss any important step or process for e2e booking process. Make sure we provide the best UX as much as possible to our guest.

# Do /impeccable critique, audit, review, harden & polish of our current e2e booking process and list down things that we can improve and create superpowers executable plan for it.

✅ Optimize how AI integrated in our app

Make a research and find the best optimal way to connect our application with AI for faster info retrieval, action execution, etc.

Maybe we can use our docs guide or obsedian vault or RAG/light RAG or something like graphify? Or if there's better library or technology that we can use.

Also, I'm wondering if having docs/guides for each page of the app is the best optimal way to document and use this for AI to have context of our entire application?

The goal is to find and implement the best way to document each flow, logic, process of each feature, pages, sections that's happening on our entire application that's fastest, optimal, and best lowest token consumption. It should be production ready

Let's update our implementation that's using or relying with AI like the AI-auto reply, AI receptionist, and other future related features that will use AI.

# → **Done:** [`../done/docs-obsidian-tooling-sync.md`](../done/docs-obsidian-tooling-sync.md)

✅ In app notification for chat & other activity

When we receive new chat or guest message from inbox, we should display a toast or notification message on our app as long as we are using the app and even we are not on inbox page.

For now, I think this would be helpful for chat events, but if you can see other features and functionality that you think we can add to our notification. Feel free to suggest and plan it as well

Maybe analyze all the activities, events and actions that we have on Notifications page module as support in app notification on all activities, events or actions that you think it's helpful to display within our app.

Analyze how popular apps how handle this and make sure we implement the way possible and make sure it will not result to any kind of performance or heavy process issues.

# → **Done:** [`../done/in-app-notifications.md`](../done/in-app-notifications.md)

✅ Smart import data with use of AI

# Shipped: [`../done/smart-ai-data-importer.md`](../done/smart-ai-data-importer.md) + [`../done/import-preview-fix-queue.md`](../done/import-preview-fix-queue.md)

✅ Avail parking e2e flow

Phase 1: Plan how host received parking booking
The first phase than we need to finalize for parking e2e is how host should receive and handle parking bookings. Should we follow how property bookings? Create new workflow and different status for parking? Also, how we should notify parking host that they received parking and need immediate review? Same telegram flow?

    Phase 0: Update parking registration, settings, etc
      - Update parking registration to ask for type (car, motor)
      - Update parking dimension to list of car type we can accommodate? In relation to height clearance
    Phase 1a: How do we notify both side (host & guest) about the parking request
      - Host side:
        - For immediate booking, use broadcast notif? First to accept will get the booking, if not process after 5 or 10mins, send new broadcast request.
        - How host will accept, reject, manage, send parking endorsement, etc
      - Guest side:
        - We should have realtime update if someone avail our parking, parking status, how guest can get and view parking endorsement
    Phase 1b: Create or reuse property detail page for parking detail page & edit form
      - Parking host should be able or required to modify their parking size/dimension so that we know if a certain car is fit or not when we connect or provide parking to guests
    Phase 1c: Create new workflow, actions & status for parking e2e flow
    Phase 1d: Update bookings page to support updated flow, changes (list, kanban?)
    Phase 1e: Review, refine, finalize and make sure it's production ready, multi-tenant/property/user, etc

Phase 2a: Get immediate parking

- When a guest avail a same day or on the spot look for available parking slot
- What's the logic or process to get the best parking available
  - Check-in & check-out
  - Respect tower unless bay
  - Is car going to fit on parking dimension
- Parking expiration: when host did not accept or process parking after a certain period, we will pass and look for other parking host
  - 15mins expiration for booking. 1hr expiration for non-same day/upcoming bookings
- Flow when we don't find available parking, do refund & notify guests?

Phase 2b: Look for parking after a confirmed booking from other host/property (upcoming/advance parking booking)

- When a guest book a property and require parking, and host does not have any parking, we should plan a way to automatically search and look for available parking on the same booking date/s and we should notify parking host to accept and manage it.
- Mostly same flow and logic with immediate parking flow

Phase 3: Finalize how we display parking from our listing

How are we going to display or provide UI/UX when guests/user wants to find a parking.
Same UI that we have now? But what if that parking host is not responsive anymore? Or not replying immediately?

- Should provide few ways to get parking?
  - A: Same UI listing we have for properties
  - B: Find/search available parking based on filters

Phase 4: Manual & Physical on site tasks:

- Picture different type of parking (tower, bay). Edit and add parking slot number dynamically
- Measure dimension and height clearance

# → **Done (Phase 0 & Phase 1):** [`../done/parking-e2e-phase1-overview.md`](../done/parking-e2e-phase1-overview.md) (+ companions in `done/`). Phases 2–5, 7–8 **done**; Phase 6 + production-readiness **planned:** [`../planned/parking-e2e-later-phases.md`](../planned/parking-e2e-later-phases.md).

✅ Help & Support page (org + property level)

Now that we have the AI assistant in the dashboard, build a Help & Support page for hosts at both org and property level: Documentation (from docs/guides Host-facing knowledge, filtered to never expose sensitive/internal info), AI Chat (opens the existing dashboard assistant sidebar), Ticket/App Support (dynamic per-category fields — bug/inquiry/suggestion/business — replied to from a new super-admin page), and FAQs (20-50 items generated from the docs). Every docs/guides change should stay synced to whatever powers this automatically.

# → **Done:** [`../done/help-support-center.md`](../done/help-support-center.md)

✅ Free trial, subscription and payments to use app

# Related (shipped): [`../done/paymongo-subscription-billing.md`](../done/paymongo-subscription-billing.md) · [`host-plans-pricing-page`](../done/host-plans-pricing-page.md) · [`feature-gating-subscription-upgrade`](../done/feature-gating-subscription-upgrade.md) · [`host-plans-and-pricing-tiers`](../done/host-plans-and-pricing-tiers.md).

✅ Able to send documents through chat

In our Inbox > Chat section. it's also helpful for our hosts if they can send the available links, files, documents, etc that we have per property & booking.
Best examples of this are:

Files: Approved GAF, Approved Pet, Parking Endorsement,
Links: Stay Guide, Property, Calendar, Messages

Let's put a new icon for these beside the Quick reply & suggest section.

# → **Done:** [`../done/inbox-share-links-and-files.md`](../done/inbox-share-links-and-files.md) — Inbox composer Share icon; durable GAF/Pet share links; calendar link opens in-place availability modal (2026-08-22)

✅ Plans & Pricing

Now, I think we are ready to implement the plans & pricing for our application.
Now, we have different separate plans for this which will be work on next phases.
For this, we need to create a foundation plan to implement the plans & pricing.

First, we need to build the Plans page for this. Generate the best UI/UX for payment, displaying different plans, end to end flow of subscribing & payment, etc.

For the pricing tiers, check for this plan:
docs/workflow/done/ai-usage-metering-credits-foundation.md

For payment integration with Pay mongo, check for this plan:
docs/workflow/done/paymongo-subscription-billing.md

For the AI credits usage, check for this plan:
docs/workflow/done/ai-usage-metering-credits-foundation.md

Again, the goal of this plan is scoped only to build the Pricing page.
Do not work on these referenced plan. We will work on it one by one.

# → **Done:** [`../done/host-plans-pricing-page.md`](../done/host-plans-pricing-page.md) (host Plans page + PayMongo checkout) · tiers foundation: [`../done/host-plans-and-pricing-tiers.md`](../done/host-plans-and-pricing-tiers.md) · PayMongo: [`../done/paymongo-subscription-billing.md`](../done/paymongo-subscription-billing.md) · feature gating: [`../done/feature-gating-subscription-upgrade.md`](../done/feature-gating-subscription-upgrade.md) · AI credits: [`../done/ai-usage-metering-credits-foundation.md`](../done/ai-usage-metering-credits-foundation.md)

✅ Host plans and pricing tiers for property listings
Based on all the features that we have, we should analyze all thea features & functionalities that we have and create different pricing tiers.
Also, we need these pricing to be easy to understand for hosts and not looks very complicated.
The idea that I have in mind is we will have 4 tiers of pricing for our hosts.
For now, this is for property listing. We can plan the parking later on.

Level 1:
Free forever
Basic features to use our dashboard

Level 2:
P349/month/listing

Automated booking flow
Verified badge
Telegram notification
Mange team members

Level 3:
P499/month/listing

Everything from previous

- Recommended badge
- Always visible in top 20 search/recommended list
- Up to 5 marketing download/publish per group
- AI validations
- AI tokens: 1000 credits
- Marketing features
- Custom pages

Level 4:
P1499/month/listing

Everything from previous

- Always visible in top 10 search/recommended list
- Up to 5 marketing download/publish per group
- AI dashboard assistant
- AI receptionist
- AI marketing generation
- AI chat auto-reply to chat app, facebook & instagram
- AI tokens: x10

Level 5:
P3499/month/listing

- We will invite our admin as team member to give access to org/property
- Then, we will handle everything
- From bookings management, manual reply to chat inquiries
- Edit marketing designs, manual and scheduled post to Facebook & Instagram

Extra AI token in org: PXXX/1000 credits.

Again, these are just the initial pricing. This should not be final and we need to plan and implement this that' it's easy to configure the pricing from our super admin.

There's also another pricing model that user can choose of which is commission based on the successful/completed booking. But we can plan this further but make sure that our plan is also considered this and can easily support this pricing model.

# → **Partial foundation only (retired from live UI 2026-08-24):** schema + `COMPLETED` ledger hook in [`../done/host-plans-and-pricing-tiers.md`](../done/host-plans-and-pricing-tiers.md). **Not host-selectable** — catalog row inactive; super-admin/public/host Plans exclude it until a full commission product (self-serve + collection) is planned and shipped. See `docs/architecture/plans-feature-matrix.md` § Pending: commission pricing.

✅ Integrate paymongo for payment subscription to our app

Now, want I you to plan is how we can integrate Paymongo as payment platform when hosts subscribe to our application.
For now, let's also support Paymongo as payment to subscribe to our app and not offer hosts to support Paymongo to accept payment using it. That is needs to be plan and finalized since this Paymongo fees is little expensive as well.
Right now, our goal is to create a detailed and executable e2e plan to integrate Paymongo in our app.
We need to make sure our implementation is solid, secure, and handles payment smoothly and apply the fallback or standard approach when payment failed.
Then, on super admin, we should have new menu and settings there to configure the accepted banks and bank information that we support to accept payment. For the payment methods or cards, I want to use the lowest fee as much as possible, upon checking, I think it's the QR Ph, we can also support paying with Maribank or Maya. I think those 3 methods are the lowest.
For the actual amount, this maybe vary and to follow up, but I want you that our implementation is ready to support different pricing.
Also, please give me detailed step how to properly set Paymongo, how to setup sandbox or test account and real account.
Please create a detailed plan for this and put it on our planned directory

# → **Done:** [`../done/paymongo-subscription-billing.md`](../done/paymongo-subscription-billing.md) (checkout, webhook, cron, suspension gate — env setup required for live)

✅ Allow features based on subscription plan & show payment subscription modal

Now that we build the pricing page, integrate payment subscription flow, etc.
The next part that we need to do is to check all each pages and features that we have on our app, and implement the validation of access based on subscription plan. Then, we should also display our subscription or payment modal if a feature they are trying to access is not within their plan.

The important part here is we should analyze each feature and functionality and we should display the subscription modal on the best UX possible. My end goal is that user can still play around on these features but to do important action, that's when they need to pay or subscribe.

Best example of this is that on marketing module, I would like user to access and see the potential of the feature so that we can showcase every feature that we have. They can edit, create template but the preview should have watermark and they need to publish or save that's when we display the subscription or payment modal to fully use each feature that we have.

The goal of this plan is to analyze the paid features that we have, check when's and what's the best time or moment we will display these subscription modal.

Again, please generate a detailed plan and separate docs for this so that we have mapping the flow and when we are triggering the payment gate modal.

# → **Done:** [`../done/feature-gating-subscription-upgrade.md`](../done/feature-gating-subscription-upgrade.md) (deferrals: custom pages create, automated booking toggle, search visibility tier)

✅ Provide easy way for host to select context for each module we have for Ai dashboard assistant

This is similar to the booking action button where whe nwe click it, it give us the list of list of bookings which can be added a context to our chat.
Now, the goal is to apply the same goal for all the modules that we have on our dashboard. Starting from bookings, then:

- Booking workflow: Able to understand each status context, all possible actions, next transition tasks, items and remaining/pending tasks
- Able to add finance transactions, maintenance reminders
- Calendar pricing per date, base rates, etc
- Available team members, add new team member
- Marketing: List down available templates, add new template for 3 categories (calendar, design, video)
- Chat: Able to select chat conversation from our chat, facebook, instagram
- Notifications: List of all notifications, and able to configure each telegram notification modules
- Templates: List down available templates, edit & improve it and add custom pages
- Public pages: List down and get access to public pages
- Settings: Able to get current setting for each category, able to edit and configure each field and settings that we have
- Help & Support: Access available guide docs, faqs, access and create new ticket

Basically, the goal is provide all available context and possible actions that host can do for each pages and modules that we have so that user can manage their listing everything without living the chat app.
We should all have access and provide the best suitable response format like tables, images, link, flow, diagram, etc. The goal is to always provide the best and helpful suggestions and next actions for every response.
We should also be smart and able to provide a seamless connection for multi flow or multi steps actions or flow. Example of this is our booking flow when transitioning status from start to complete.

With these so much info, we need to generate the best UI/UX for this within the chat, if a dropdown will not fit or best UI to display and provide long information or multi flow, we can also display the options or actions or flow or diagram in the center and on top/overlay on the conversation content. Make a research and analyze how popular apps handle such scenario and generate the best UI/UX for this please.

# → **Done:** [`../done/ai-assistant-universal-context-pickers.md`](../done/ai-assistant-universal-context-pickers.md)

✅ Make public pages editable via a host-facing Page Editor (left controls / right realtime preview)

I think the next module that we need is to make our public pages editable.
Meaning, instead of open page, we will have edit button page.
And clicking it will open our page editor. On our page editor, host can edit and configure the content that we have for our public pages.
Analyze each public pages and check which content, controls, features that we can make configurable. From styling, show/hide content, toggle flow or certain functionality. Let's try to make everything much flexible and configurable as much as possible.

Example: For stay guide, we will list down all the templates available, add or remove templates on the page, configure positioning and styling, etc.

One important thing to consider is that if a certain setting is already configurable via setting, we need to remove that from our property settings so that we have single source of truth and no redundant control settings. This is also good so that our property settings will be lessen.

Please generate the best UI/UX for our page editor please and make sure that we have controls section on the left side and realtime update preview on the right side.

We to ensure that this management and editing of page content would not be too technical and too overwhelming for our hosts. This should be easy to the eyes, comfortable and easy to use and navigate and balance of advanced and easy to use.

If we can also update our existing public pages list as well, that would be great. I don't think listing grid items like this is the best UI for this? PLease analyze and improve as well

# → **Done:** [`../done/page-editor-public-pages.md`](../done/page-editor-public-pages.md) — Stay Guide + Property Landing Page Editor, gallery redesign, Settings migration (Phases 0–7); Phase 8 backlog deferred (2026-08-20)

✅ Harden guest inbox meta facebook and instagram module

One big module that we need to review the implementation carefully is the Inbox Meta facebook and instagram implementation. I want you to do deep checking and review and make sure that our module there is complete and production ready. Make sure we don't have poor implementation, restructure or recode that module if needed so that we have good implementation, production ready and scalable solutions.

One major thing I would like you to refine and improve is that refetching of new messages every time we visit Inbox page. Right now, We need to disconnect and reconnect to fetch new message. That should be automatic please.

Also, I think Meta has only window period for auto-reply or to able reply? If that's the case, we should improve the UI/UX and display messages that cannot be reply and improve the UI or message that only the messages within the period is visible to our chat.

Also, I want you to refine and improve how we save and store conversations and how we cache them and invalidate them. We need to make sure that this module will not cause any performance issues, security concern, etc.

Also, we should have solid implementation and flow for disconnection and clearing of messages and provide best UI/UX when we connect to a page and fetch messages.

Also, I want you to visit if we can support the comments on facebook post on Facebook & Instagram, if not, then let's remove that!

# → **Done:** [`../done/guest-inbox-meta-hardening.md`](../done/guest-inbox-meta-hardening.md) — webhook health-check/resubscribe, non-destructive disconnect, HUMAN_AGENT 7-day tag, comment scope removed, backfill + error UX hardening (2026-08-20)

✅ Org portfolio pricing bundles (Pro ≤3 / Business ≤5 / Business Plus ≤10)

Pivot from strict per-property billing to org-scoped portfolio caps for Pro/Business tiers while keeping Free/Starter/Managed/Commission per-property.

# → **Planned:** [`../planned/pricing-portfolio-bundling.md`](../planned/pricing-portfolio-bundling.md)

✅ Accurately track AI usages for each AI actions and features, decide limit granularity, prep for paid AI credits

# → **Done:** [`../done/ai-usage-metering-credits-foundation.md`](../done/ai-usage-metering-credits-foundation.md) — Phases 1–3 shipped (attribution, credit ledger, enforcement, wallet UI). Phase 4 paid top-up deferred.

✅ Property guest rewards & vouchers (Reviews split)

# → **Done:** [`../done/property-guest-rewards-vouchers.md`](../done/property-guest-rewards-vouchers.md)

✅ Voucher reveal styles (host-selectable animation)

Spin the wheel, slot scroll/reel (current), flip card — property setting under Reviews & vouchers; guest `/sd-form` + guest-review.

# → **Done:** [`../done/voucher-reveal-styles.md`](../done/voucher-reveal-styles.md)

✅ Guest Review after booking

Standalone `/properties/:slug/guest-review`, SD form review section, edge functions, feedback tags + photo upload.

# → **Done:** [`../done/guest-review-module-refinement.md`](../done/guest-review-module-refinement.md)

✅ Refine AI settings from property & super admin settings

# → **Done (Phases 1–3):** meter UI shipped — [`../done/ai-usage-metering-credits-foundation.md`](../done/ai-usage-metering-credits-foundation.md). Phase 4 paid top-up still backlog.

✅ Finalize plans & billing
I noticed some limitation are not respected on free tier like team members, etc.
Also, make sure we update org level pages & section & elements to display plans pills & badge as well. Like team members per org
Clicking continue to payment should redirect user to org level, plans & billing page and billing tab?
We also need to make sure that we cover and require payment when we add more properties

# → **Done:** [`../done/finalize-plans-billing.md`](../done/finalize-plans-billing.md)

✅ Also, here are the things we need to adjust and make sure we add from our tasks list:

Bookings

-

Finance

- Update our plan to include finance reporting should be on starter plan. But access to finance is free

Maintenance

- maintenance export/reporting should be on starter plan as well

Team

- Add team member if reached limit should display our upgrade plan modal

Marketing

- make sure download, publish button (if there's meta connected), display upgrade plan modal
- make the preview overlay more evident and rendered multiple times to fill the whole canvas for calendar, canvas and video. Meaning, I want these overlay to have many text that covers entire canvas. Also, use "Kame Homes" instead of "Preview"?
- clicking generate inside the generate modal should open display our upgrade plan modal.

Notifications

- Update our plan so that free only include in-app notification but telegram notification should be on starter plan
- For free plan, editing or clicking save and test tg or enabling telegram cards/modules should display our upgrade plan modal

Inbox

- Update our plan to support Meta chat to business tier. Clicking connect to Meta will display our upgrade plan modal
- Then for normal chat, I'm still wondering if I should free this or move it to starter plan? Please analyze and decide what's best tier is this feature
- Free user can still open quick replies and automation so that they know what are the features we can offer

Templates

- Make each wisywig editor to have a blurry overlay but i still want each text to be readable for both edit and preview mode.
- Free can still open placeholders and reset
- Clicking add custom template should open our upgrade plan modal

Public pages

- For free users, let's still display the pages, user still can edit but let's remove the autosave feature and display manual save button if user edited something, and upon clicking save, it will open our upgrade plan modal

Settings

- Settings section that require paid plan should be hidden our secondary menu and card section. Analyze each section carefully and only display it if current plan achieve it

Check other pages, public pages, sections, modules, flow, process and make sure we covered everything

Make sure we update our plan cards and compare plans for all the new changes please.

Also, it's helpful if we can add a badge that displays the different plan tier required to make it work. Either on menu, section, buttons, elements. Just make sure that we display this beautiful and look professional how big apps display this so that user knows if a specific feature require higher plan. Also, of course, do not display a badge if user already had that paid plan unless a higher plan is required to enable that feature.

Also, our upgrade plan modal should be dynamic and display the tier needed for specific feature that they action. Also, please include on another phase in our plan that we should be smart and also handle what if user avail starter plan, then, want to upgrade to next plan. The pricing should be smart and less than the actual current price - already paid plan price. Maybe reuse our upgrade to existing modal that we have when we click upgrade plan? Or maybe, use same layout but change content that's more aligned to action user wants to do? Decide best UI/UX for this.

Also, for security as well, we need to make sure that these limitations are not UI only. Meaning, technical user can still open dev tools, remove the overlay elements and see the actual real data. We need to make sure that implement a mechanism to make it secure if user do that and make sure backend implementations still respect our plan tiers. The goal is to have a security or mechanism to prevent user to hack or do tricky things to achieve result by not paying paid plan and modifying elements in the UI.

Please also improve our upgrade plan modal text or content and UI so that user easily understand that they need to upgrade to access or do that action

# Make sure as well that we updated the necessary docs for all these changes please

===

✅ Sitewide automated testing (unit + Playwright + CI)

Vitest + Deno + mocked Playwright across all modules/pages; CI gates on develop/prod; agents keep tests in sync with every change. Cursor / Claude Code / OpenCode tooling included.

# → **Done:** [`../done/sitewide-automated-testing.md`](../done/sitewide-automated-testing.md)

===

🧪 Cost, abuse, and security production readiness

Review the whole app for high usage / API cost, AI spend, brute force, missing rate limits, and security holes. Implement restrictions, validations, and optimizations so guests and hosts cannot run up Gemini, Resend, Maps, or Edge bills. Include a pentest / abuse-script plan.

→ **For testing:** [`../for-testing/cost-abuse-security-production-readiness.md`](../for-testing/cost-abuse-security-production-readiness.md)

===

🧪 Production readiness audit and remediation

Full develop-track audit: deduplicate existing cost/abuse/testing/parking work, close net-new Critical/High code gaps (guest write tokens, live developments/similar stays, workflow CAS, CI public RL check, voice preview quota, Meta webhook RL), publish go/no-go gates. Operator P0 keys stay on the pending-from-user doc.

→ **For testing:** [`../for-testing/production-readiness-audit-and-remediation.md`](../for-testing/production-readiness-audit-and-remediation.md)

===

🧪 Analyze entire app pages & features and brainstorm how AI can help us for each feature

Analyze the entire codebase, pages and features that we have, and see how AI can help hosts, guests, admin, and us developers on anything

Example:

- Use AI to analyze and suggest marketing strategies
- Use AI to help managing finance, analyze big expenses, how to fix and suggest financial strats, etc

# → **Plan / backlog:** [`../planned/ai-opportunities-roadmap.md`](../planned/ai-opportunities-roadmap.md)

🚧 Onboarding verification simplify

Step 2 Property Rights (Parking Rights when parking-only) from existing verification-rights values. Step 3 Valid ID + Facebook Page screenshot only. Listing Verified: proof of ownership. Listing Recommended: additional proof + Azure PMO. Listing go-live stays on listing base approve.

# → **In progress:** [`../in-progress/onboarding-verification-simplify.md`](../in-progress/onboarding-verification-simplify.md) · spec: [`onboarding-verification-simplify-design.md`](./onboarding-verification-simplify-design.md)

🚧 Refine booking detail page, edit and workflow

- Improve UI/UX of entire booking detail page and edit form
- Improve UI/UX and refine each elements, sections, modal, actions, process, status, logic and flow for booking e2e flow and make sure it's production ready
  - ✅ Update implementation for automated gmail listener to use resend reply/hooks to prevent the need of Google CASA approval → **Done:** [`remove-google-calendar-sheets.md`](../done/remove-google-calendar-sheets.md)
  - ✅ Entirely remove or limit access for google calendar and sheets sync → **Done:** [`remove-google-calendar-sheets.md`](../done/remove-google-calendar-sheets.md)
  - Check and refine all automation triggers for each step/status
  - Update AI validation logic, display, etc
  - Refine and improve UI/UX for each step/status

# → **In progress:** [`../in-progress/booking-workflow-multi-tenancy.md`](../in-progress/booking-workflow-multi-tenancy.md)

🚧 Marketing 5: Refine & finalize Marketing module

- Make sure each module is optimized. Right now, something looks broken and when we visit the page and each tab, the app becomes kinda laggy and have performance issues. The thumbnails are not loading properly, creating new item somewhat breaks other thumbnails, switching to other orientation feels like rendering broken thumbnails, playing video preview does not fully play the video, it requires 2-3x click to fully play it which is broken.
- Make sure AI generations for 3 modules are production ready, renders beautiful designs, content are engaging and easy to read, designs and videos are instagrammable and ready to post, etc.
- If app is connected to social platform like Facebook and Instagram, make sure we support quick and easy publishing for post & story.

# → **In progress:** [`../in-progress/marketing-module-refinement.md`](../in-progress/marketing-module-refinement.md) — perf/thumbnail/playback bugs + AI-gen/publish correctness fixes shipped; Meta scheduling/confirmation gaps remain open

🚧 Do an ground up redesign for mobile view

I want to have a rebuilt or groundup redesign for mobile view to make our app look and feels like a native mobile app.
Not just simply a website or page that's adjusted to be responsive to different resolution.
We need to consider the best UI/UX for each page, section and components that we have in our app
The end goal is when we resize to mobile view, it should look and feel like a native mobile app where we have main navigation on the bottom, mobile element animation and transitions, etc

Apply to all pages including both public and dashboard pages

# → **In progress:** [`../in-progress/mobile-native-redesign.md`](../in-progress/mobile-native-redesign.md)

🚧 Document, refine, finalize booking detail & workflow

I want you to carefully review our booking detail page, booking edit and booking workflow and see how we can improve, refine, make other flow, logic and settings to be configurable from our property settings and make the whole flow to be multi users and multi property. What we have in prod, we are focused and only support Kame Home 2604. Now we are building our system to be used with different tenant, users, multi-properties, multi residence or property type and I want every little things to be configurable and refined for production used.

I believe we already have docs for this, I just want you to review our latest implementation and make sure it's up to date, then create a one file doc that documents everything.

After that, I want you to list down tasks, suggestion and improvements that we need to do to make our booking workflow to be used by different users and properties.

The current booking status that we have is only applied for Azure North residence, again we should have config for this residence.

Also, I want you to review each section, field, settings, flow, logic & process and if there's something we can improve or change, please suggest it.

Also, for parking request step, skip this for now. The whole flow for this will be TBD later on.

Also, another important thing I'd like to improve is to automate everything as much as possible. Right now, there's still some step or transition that require manual admin transition. Analyze and check how we can automate everything.

The end goal is after this, our booking detail, edit and workflow is refined & finalize and production ready.

# → **In progress:** [`../in-progress/booking-workflow-multi-tenancy.md`](../in-progress/booking-workflow-multi-tenancy.md) · v1 slice **done:** [`../done/booking-workflow-configurable-docs.md`](../done/booking-workflow-configurable-docs.md)

🚧 CI/CD + multi-tenant environments — [`multi-tenant-dev-prod-environments.md`](../in-progress/ci-cd-environments/multi-tenant-dev-prod-environments.md) · matrix [`ci-cd-environment-matrix.md`](../../archive/operations/ci-cd-environment-matrix.md)

**Now:** `develop` → `dev.kamehomes.space` → **fwor…** (`cd-dev.yml` + Vercel Preview). Legacy unchanged (`main` → `kamehomes.space` → **zftt…**).

**Pending at prod release (Phase B):**

- Create **MULTI_TENANT_PROD** Supabase project
- Implement **`scripts/migrate/legacy-to-mt-prod/`** — Postgres + Storage **`zftt…` → mt-prod**
- Merge **`develop` → `main`**; **`kame-homes`** Production branch = **`main`** (not a `production` git branch)
- Wire **`app.kamehomes.space`** + Vercel Production `VITE_*` → mt-prod
- Google OAuth **prod** client + Auth on mt-prod
- Enable GitHub **`production`** secrets + **`cd-prod.yml`**

# Design: [`ci-cd-dev-prod-design.md`](../in-progress/ci-cd-environments/ci-cd-dev-prod-design.md) · plan: [`ci-cd-dev-prod.md`](../in-progress/ci-cd-environments/ci-cd-dev-prod.md) · index [`ci-cd-environments/README.md`](../in-progress/ci-cd-environments/README.md)

🚧 Review, refine and improve e2e of booking flow/page

Overlaps booking detail/workflow refinement — tracked under booking multi-tenancy backlog.

# → **In progress:** [`../in-progress/booking-workflow-multi-tenancy.md`](../in-progress/booking-workflow-multi-tenancy.md)

🚧 Review implementation on the following modules

Review the implementation on the following modules and make sure we simplify, recode, improve and make sure it's production ready and does not contain trash code or changes, poor implemented features caused by AI vibe coding. Be a 10x senior software engineering and review the following modules and make sure it met our standards and they are all production ready and will not cause any performance issue or security and lastly, make sure everything is still working properly

- Marketing — partial: [`../in-progress/marketing-module-refinement.md`](../in-progress/marketing-module-refinement.md) (perf/AI-gen fixes shipped; Meta publish gaps open)
- Inbox (Meta chats) — **done:** [`../done/guest-inbox-meta-hardening.md`](../done/guest-inbox-meta-hardening.md)
- Real-time web chat app (host & guest side)
  \===

🚧 Host verification tiers (Phase 3 partial)

Phases 1–2 shipped (Verified/Recommended modal polish, Tier 2 docs, admin queue priority). Browse search boost for Recommended hosts deferred until public listings API.

# → **In progress:** [`../in-progress/host-verification-tiers.md`](../in-progress/host-verification-tiers.md) · scope split shipped: [`../done/verification-scope-split.md`](../done/verification-scope-split.md)

🚧 Stay Guide page templates parity (Showcase engine)

# → **In progress:** [`../in-progress/stay-guide-showcase-templates.md`](../in-progress/stay-guide-showcase-templates.md)

✅ Airbnb / OTA calendar sync

# → **In progress:** [`../in-progress/airbnb-calendar-sync.md`](../in-progress/airbnb-calendar-sync.md)

🚧 Org-level granular team permissions

# → **In progress:** [`../in-progress/org-granular-team-permissions.md`](../in-progress/org-granular-team-permissions.md) · property catalog shipped: [`../done/granular-team-permissions.md`](../done/granular-team-permissions.md)

🚧 Scheduled marketing posts/story

# → **In progress:** Meta scheduling/confirmation gaps — [`../in-progress/marketing-module-refinement.md`](../in-progress/marketing-module-refinement.md)

✅ Improve onboarding flow

Refine the full host onboarding flow end to end — not just the left showcase panel.

- Left section: auto-play carousel (or similar) of animated dashboard features; interactive, professional, responsive at all breakpoints.
- Right section / steps: review org → property → verification → first listing setup for clarity, fewer dead ends, and better progress signaling.
- Align with verification tiers, plans gating, and post-onboarding first actions (settings completion, public pages, inbox connect).
- Reuse or extend `HostWorkspaceSidePanel` / `onboarding-host-workspace-showcase` patterns where they still fit.

# → **Partial:** [`../done/onboarding-host-workspace-showcase.md`](../done/onboarding-host-workspace-showcase.md) (auth left panel only). Full flow polish remains open.

# 🔵 Host/Guest booking payment e2e

# 🔵 Invoice generator? Or provide invoice every after successful booking

# 🔵 Guest chat to confirmed booking flow e2e

# 🔵 Redesign our main landing page

# 📋 Implement Sentry & Posthog

PostHog implemented (UI: error tracking + analytics + session replay + feature flags via `posthog-js`/`@posthog/react`, source map upload via `@posthog/rollup-plugin`; edge: `posthog-node` wired into every function — `handleEdgeError` + `serveCronPost` choke points, plus the handful of pre-`serveEdge.ts` functions that call `serve()` directly). Sentry deferred — see `docs/architecture/integrations.md` §9.5.

→ **Planned:** [`../planned/posthog-analytics-production-readiness.md`](../planned/posthog-analytics-production-readiness.md) — product analytics + error tracking to production (taxonomy, server conversions, legal, two projects). Sentry still deferred. Do not turn session replay on until Phase 5 of that plan.

# 🔵 Offer ads within the app

# 🔵 Display announcements per development from super admin

# 🔵 Monitoring for suspicious or unusual activities from super admin

🚧 Prod readiness checklist

- Frontend
- Backend & APIs
- Database
- Storage
- Auth / Permissions
- Hosting & Deployment
- Cloud Computing
- CI/CD & Version control
- Security & RLS
- Rate Limiting
- Caching & CDN
- Load Balancing & Scalability
- Error Tracking & Logs
- Analytics
- SDLC Testing
- Availability & Recovery
  \===

🔵 Review each dashboard pages, section & actions based on user role

After we refine the roles & permissions that we have on both org and property level, we need to revisit and review each pages within the dashboard and make sure that each section, elements, action, process, flow, basically everything is well thought and only be accessible based on user role

# → Unblocked by [`../done/granular-team-permissions.md`](../done/granular-team-permissions.md) (property granular catalog shipped). Org follow-on: [`../in-progress/org-granular-team-permissions.md`](../in-progress/org-granular-team-permissions.md). Audit against live leaf ids remains open.

# 🔵 Pool fee should be configurable via development settings and we need to adjust AI receptionist or AI tool that beside on reading property & booking info, we should also check which development it's under the current property and have access to development information just like the amenities, pool fee, schedule of pool, requirements, guides, etc

# 🔵 Create marketing video ads for our app with remotion that features our core & main features

# 🔵 Support google map directions from use current area to properties/places

# 🔵 Cancellation Process

# 🔵 Redesign for hosts landing page

# 🔵 Manage how to give free AI credits to new users, give discount for special events/occasions

# 🔵 Refine and finalize team permissions

# 🔵 Think and plan how AI can help us manage pricing better

# 🔵 Redesign explore landing page

# 🔵 Community group chat

# 🔵 Support to buy more AI credits on Plans

# 🔵 When we have multiple properties, we should plan a way for hosts to share and reuse settings or configurations or design for from a property to other properties. Review each property pages, module, flow and check which one we can reuse and re-share to other properties

🔵 Super admin — org, property, host, and listing management

Expand `/admin/*` so operators can manage the platform without SQL or ad-hoc support:

- **Orgs** — list/search, view owner, plan/subscription state, suspend or impersonation-safe read-only drill-down.
- **Properties & parking** — list/filter by org, verification/plan badges, featured visibility, basic edit or flag actions.
- **Hosts** — tie org owner + members to listings; quick links to approvals queue and support tickets.
- **Plans & billing** — read org entitlements, manual overrides (credits, comp tier) where product allows.

# → **Partial today:** approvals, app settings, support tickets, PayMongo config. Full org/property/host CRUD and plan visibility still open.

✅ Super admin — manage "Coming soon" surfaces

Super-admin UI to configure which product areas show **Coming soon** (or are hidden) app-wide — e.g. public `/services`, gated marketing features, AI credit top-up stubs, Page Editor "other guest pages", and future modules before launch.

- Central config (DB or app settings) keyed by feature/surface id.
- Dashboard + public consumers read the same flag so hosts/guests see consistent copy.
- Optional scheduled enable date or environment override (dev vs prod).

# → **Related:** [`../done/page-editor-public-pages.md`](../done/page-editor-public-pages.md) (optional Coming soon badge on non-editable guest pages); [`services.md`](../../guides/routes/services.md) (UI-only coming soon).

✅ Marketing — edit guest review page design

Let hosts customize the guest review experience from the **Marketing** module (or Public Pages / Page Editor sibling), similar to Stay Guide and Property Landing:

- Template or canvas presets for `/guest-review` (and optionally SD form review step) — typography, colors, hero/brand, thank-you state.
- Reuse marketing design editor / Polotno patterns where sensible; preview with sample booking context.
- Single source of truth — avoid duplicating controls already on property settings unless marketing owns visual layer only.

# → **Related:** guest review shipped [`../done/guest-review-module-refinement.md`](../done/guest-review-module-refinement.md); Page Editor defers guest-review edit [`../done/page-editor-public-pages.md`](../done/page-editor-public-pages.md).

🔵 Another big change I would like to implement is to refine the whole parking e2e flow.
Right now, I feel like it's not yet production ready and there are missing features and things that can be improved.
Let's separate this to multiple phases with multiple tasks per phase and address my main concerns:

#1. Improve overall searching and accept flow

Right now, I feel like we can improve the overall UI/UX and flow when searching of parking. I want to update the UI/UX to feel and look like we are looking a grab driver flow. When guest look for a parking, we should implement the standard and robust flow on picking the best available parking owners on that date and the first one to accept it will get the parking. We should also consider the check-in and check-out time based on guest selection and make sure it will not clash or have any conflicts with previous checkout and next day check-in.

After accepting a parking we should improve and complete the whole e2e flow. What I'm thinking is that when there's a found parking:

- Guest: should be able to use the host payment method and connect it with paymongo. guest can pay via paymongo and after successful payment transaction, we should automatically trigger host to send email to development/pmo email and cc guest on the parking endorsement email.
- Host: after guest successfully paid parking, we automatically send an parking endorsement email to development/pmo email and cc guest on that email. if possible, we should be able to send copy of email screenshot to guest within our app UI.

I think it's better if we can implement paymongo for parking payment transaction here so that we detected if guest paid successfully or not.

Guest can cancel parking request if not yet paid. We should implement a security or anti spam mechanism as well so that user cannot spam this request and annoy parking host.
Also, I think we should plan and implement the best way to notify available parking owners and not just do simple broadcast notification and email to all parking owners which kinda annoying specially if someone is fast on accepting bookings. Maybe do batch request? Or check how grab and other big apps do this searching for available parking and implement the best way for this approach.

Once accepted, both guest and host cannot cancel.
Once parking endorsement is sent to the guest, both guest & parking owner can chat and communicate.
We should also share both guest and parking owner email and contact number.
Also, provide contact number for admin incase parking owner is not answering and guest encounter issues on parking?

For the payment, we should do paymongo split payout so that we can profit for every successful parking connection between guest and owner.
From super admin, we should have new menu and should be able to configure how much is the minimum percentage we get for successful endorsement. The default percentage is 10%. Then we can also configure the minimum weekend rate and weekday rate that we offer to our guest or just use fixed P400?

Also, one important thing is that we should never display or tell how much guest paid to parking owners.

Because, I'm thinking to have a ranking system which parking owners are priority:
The most priority is the lowest price available on that specific date and time range.
Example, if the parking owner only priced it at 250 gross,
for guest, we offer fixed P400,
then for owners, we should also less the 250 gross - 10% service fee.
So the total guest paid is 400, the total profit we earn is 400-250=150 +25 (10% service fee) = 175
and total parking owner net is 225.

Also, make sure that we display how the gross, service fee and net on parking pricing page.
We should also smartly have ranking system which owner should we prioritize when guest looking for a parking.
Also, display the computation and other important info like how priority is computed or ranked:

- like lowest price has highest priority,
- second if guest has smooth arrival & did not encounter any issues or double parking, etc.
- then third is how fast parking owner accept booking and response to guest chat

We should also display that parking reservation is strictly non-refundable on geust side.

We should support a toggle setting from host to auto-accept and auto-send parking endorsement after guest paid the parking or should be manual acceptance.

Please review all my notes here and I'm sure there are some cases that I missed, edge cases that we need to review and support.
Make sure we handle everything is this require payment related and we should be able to handle errors properly, etc.
Also, when payment become successful but the process of sending email failed or canceled by user by some reason, we need to make sure that when guest revisit our page, there should be a fallback or a button to request or re-request parking endorsement once payment is valid and successful.

#2. Update property booking workflow to use our new parking e2e flow instead of doing email broadcast to parking owners

We need to cleanup our existing implementation and existing settings and configuration on how we get a parking when guest wants to avail paid parking on property booking.
I think right now, we are doing broadcast emails based on the list of parking owner emails from env. We need to cleanup and connect our new parking e2e flow with this scenario.

But we need to plan how we can make this automated as well?

#3. Shareable parking registration link from host for direct booking

From the dashboard, there should be a copyable link for parking owner hosts where they can share their parking registration form link and guest can use this so that they can book parking directly.

# We should apply all the same logic and flow that we have from above except that this is direct booking and guest needs to manually fill up their information, car details and pay the parking.
