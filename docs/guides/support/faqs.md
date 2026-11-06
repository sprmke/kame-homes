---
title: 'Curated support FAQs'
status: active
tags: [guides, support, faqs, help-center]
updated: 2026-11-06
---

# Curated support FAQs

Cross-cutting answers that do not belong to a single route. Per-page behavior lives in
`docs/guides/routes/**`; this file is the reviewable source for `help_center_faqs` and the
public support page.

One `### Question` block per FAQ. Metadata:

- `category` must match a category in `helpFaqModules.ts`.
- `audience` is `host`, `guest`, or `public`.
- `source` is an optional route-guide path and must exist.
- `order` is optional; file order is the fallback.

Keep answers plain: no code, no database column names, no internal endpoint names, and no
em dashes.

---

### Can I own two separate organizations with one Google account?

- category: Getting Started
- audience: host
- source: docs/guides/routes/org/selector.md
- order: 10

No. Each account can own one organization. You can still be invited as an admin to other people's organizations.

### What's the difference between Owner and Admin?

- category: Getting Started
- audience: host
- source: docs/guides/routes/org/team.md
- order: 20

The owner can change organization settings, manage billing, and delete the organization. Invited members can run the pages their role allows, and can add properties only when that permission is included.

### Why does a team invite require a Gmail address?

- category: Getting Started
- audience: host
- source: docs/guides/routes/org/team.md
- order: 30

Hosts sign in with Google. The invite email must match the Google account the person will use to accept.

### What happens if I delete the organization?

- category: Getting Started
- audience: host
- source: docs/guides/routes/org/settings.md
- order: 40

Deletion is permanent and only allowed when there is no booking history and no blocking finance or maintenance records. You must type the organization slug to confirm. Your Google sign-in account stays; only this org and its properties are removed.

### Why can't I see the Add property button?

- category: Getting Started
- audience: host
- source: docs/guides/routes/org/properties.md
- order: 50

Adding a property needs that permission on your org role. Owners always have it. Invited members only see the button when their template or custom role includes it.

### What's the difference between Manager and Staff on a property team?

- category: Team & Permissions
- audience: host
- source: docs/guides/routes/org/property/team.md
- order: 10

Full Access includes finance, settings, team management, and notifications editing. Operations covers bookings and maintenance day to day plus inbox replies, but not finance, settings, or team management.

### How do property team invites work?

- category: Team & Permissions
- audience: host
- source: docs/guides/routes/org/property/team.md
- order: 20

Enter their Gmail address, choose a role, and they get an email link valid for seven days to accept and join this property.

### What's the difference between Manager, Staff, and Viewer on a parking team?

- category: Team & Permissions
- audience: host
- source: docs/guides/routes/org/parking/team.md
- order: 30

Managers have full parking access including team invites. Staff can handle operational work such as editing bookings and viewing pricing. Viewers can look but not change sensitive settings.

### Can a parking team member access my properties too?

- category: Team & Permissions
- audience: host
- source: docs/guides/routes/org/parking/team.md
- order: 40

Only if they are also invited at the org or property level. Parking invites grant access to this slot only.

### How many team seats does my plan include?

- category: Team & Permissions
- audience: host
- source: docs/guides/routes/org/team.md
- order: 50

Free includes the owner only. Starter includes 3 seats, Pro 5, Business 10, and Managed is unlimited. Org seats are shared across every property in the organization.

### What happens to team members if I downgrade?

- category: Team & Permissions
- audience: host
- source: docs/guides/routes/org/property/team.md
- order: 60

Nothing is deleted. Members above the new seat limit are disabled and marked Plan limit, with their roles and permissions saved. Upgrading again restores them automatically, oldest first.

### How do I create a new booking?

- category: Bookings
- audience: host
- source: docs/guides/routes/org/property/bookings.md
- order: 10

Use New booking in the page header. It opens the guest booking form for this property.

### Can I bulk-import bookings from a spreadsheet?

- category: Bookings
- audience: host
- source: docs/guides/routes/org/property/bookings.md
- order: 20

Yes. Use Import beside New booking on a property. Upload a CSV or Excel file, or download your Google Sheet as Excel or CSV first, then confirm the column mapping and review the rows. Past stays commit as Imported; today and future stays show Pending Review but still appear when you filter by Imported. No new-booking emails or calendar events are sent on import.

### Can I go back a step if I made a mistake on a booking?

- category: Bookings
- audience: host
- source: docs/guides/routes/org/property/bookings-detail.md
- order: 30

Yes. Return to step at the bottom left moves the booking to a previous status. Existing fields and documents get reset, and no emails go out. It always names the step you are moving to and asks you to confirm first.

### Does adding parking after review send the booking back to Pending Review?

- category: Bookings
- audience: host
- source: docs/guides/routes/org/property/bookings-detail.md
- order: 35

No. The booking keeps its current status and Parking shows as an outstanding step under Pending Documents. Once the booking is Ready for Check-in, the same parking step stays available as late parking. Complete the parking step before you proceed to the next stage.

### Why can't I cancel this booking?

- category: Bookings
- audience: host
- source: docs/guides/routes/org/property/bookings-detail.md
- order: 40

Cancelling is only available up to Ready for Check-in. Once a booking reaches Ready for Check-out the stay has already happened, so it gets finished or refunded instead of cancelled.

### Why don't I see a down payment or security deposit on an Airbnb booking?

- category: Bookings
- audience: host
- source: docs/guides/routes/org/property/bookings-detail.md
- order: 45

Airbnb collects the stay payment and any deposit on their platform, so those fields are hidden and left at zero. You still record the booking rate, pet fee, and any additional fee. The Pricing tab says Stay paid through Airbnb.

### Can I close calendar dates without creating a booking?

- category: Bookings
- audience: host
- source: docs/guides/routes/org/property/calendar.md
- order: 50

Yes. Select future available nights on the Pricing calendar and choose Block. Guests cannot select or submit those nights.

### Where do I see every stay and parking reservation in one list?

- category: Bookings
- audience: host
- source: docs/guides/routes/org/bookings.md
- order: 60

Open Bookings from the organization sidebar. It combines property stays and parking reservations, and the Booking type filter narrows the list to one kind.

### How do I add a parking reservation?

- category: Bookings
- audience: host
- source: docs/guides/routes/org/parking/bookings.md
- order: 70

Open the parking slot's Bookings page and use New booking. It opens the slot's booking form in a dialog without leaving the dashboard.

### How do I add a new parking slot?

- category: Parking
- audience: host
- source: docs/guides/routes/org/parkings.md
- order: 10

Tap Add parking, or use the plus menu in the sidebar switcher, then complete setup on the new slot's settings page.

### Is a standalone parking slot the same as parking tied to a stay booking on a property?

- category: Parking
- audience: host
- source: docs/guides/routes/org/parkings.md
- order: 20

No. These are standalone parking listings such as tower slots or motorcycle bays. Guest stays that only need parking at a rental unit are still managed under property bookings.

### What do guests actually see on a parking listing?

- category: Parking
- audience: host
- source: docs/guides/routes/org/parking/settings.md
- order: 30

Basic info, photos, location, and amenities flow to your public parking page. Keep the cover photo and description accurate before sharing the link. Guests pay through PayMongo at checkout, so there are no payment details to fill in.

### Why is there no Payment section on parking settings?

- category: Parking
- audience: host
- source: docs/guides/routes/org/parking/settings.md
- order: 55

Guests pay for parking through PayMongo when they book, so you do not enter payment methods for a slot. Anything saved there before is kept for history but is no longer used or shown.

### How do weekend parking rates work?

- category: Parking
- audience: host
- source: docs/guides/routes/org/parking/pricing.md
- order: 40

Friday through Sunday nights use the weekend nightly rate automatically. Monday through Thursday use the weekday rate unless you set a custom price on the calendar for those dates.

### Who can add or delete parking finance transactions?

- category: Parking
- audience: host
- source: docs/guides/routes/org/parking/finance.md
- order: 50

Team members with finance edit access for this parking slot. View-only roles can see summaries but not change lines.

### Can I hide a parking slot without deleting it?

- category: Parking
- audience: host
- source: docs/guides/routes/org/parking/settings.md
- order: 60

Yes. Open the slot's Settings and use Archive in the Danger Zone. It stops showing on your public parking page but keeps its reservations and settings, and you can restore it later.

### Why can't I add a parking slot?

- category: Parking
- audience: host
- source: docs/guides/routes/org/parkings.md
- order: 70

Adding a parking slot needs the Add parking permission. Owners always have it, and invited members only when their org role includes it.

### What's the difference between Archive and Delete for a property?

- category: Property Settings
- audience: host
- source: docs/guides/routes/org/property/settings.md
- order: 10

Archive hides the property from active use but keeps all bookings and history. Delete permanently removes an empty property, and it is blocked if any bookings exist, so use Archive instead for units with past stays.

### Why can't I restore my archived property?

- category: Property Settings
- audience: host
- source: docs/guides/routes/org/property/settings.md
- order: 12

Restore needs a verified listing and a current listing contract. A new listing has to be approved first, and an ended contract has to be renewed. The Danger Zone card tells you which one applies.

### Can guests still book a property I archived?

- category: Property Settings
- audience: host
- source: docs/guides/routes/org/property/settings.md
- order: 13

No. The public page and its direct booking link stop taking new bookings. Guests who already booked keep their form, trip page, and stay guide.

### Where do I configure which documents guests must submit (GAF, pet approval, etc.)?

- category: Property Settings
- audience: host
- source: docs/guides/routes/org/property/settings.md
- order: 20

Document requirements are set at the development level by the platform team, under Super Admin, Developments, Document Requirements. All properties in that development inherit the same list.

### Which templates do guests actually see?

- category: Property Settings
- audience: host
- source: docs/guides/routes/org/property/templates.md
- order: 30

The four standard templates (house rules, check-in instructions, check-out instructions, and parking reminders) appear on the guest stay guide during their booking window. Email templates are used for automated messages throughout the booking process.

### How do I get a shareable link for the stay guide?

- category: Property Settings
- audience: host
- source: docs/guides/routes/org/property/public-pages.md
- order: 40

There is not one link you can reuse. Each guest gets their own personal link automatically once their booking reaches ready-for-check-in.

### How do I edit the stay guide text or photos?

- category: Property Settings
- audience: host
- source: docs/guides/routes/org/property/public-pages.md
- order: 50

Open Public Pages, then Stay Guide, then Edit, then Content. Expand a section to change its text or upload a photo. Changes show in the live preview.

### Does archiving a property remove its bookings?

- category: Property Settings
- audience: host
- source: docs/guides/routes/org/properties.md
- order: 60

No. Archive keeps every booking and all history and only hides the property from active use. Delete is the action that removes a property, and it is blocked when bookings exist. Guests with a coming stay still get their form, trip page, and stay guide.

### Where do GAF and pet request emails go?

- category: Property Settings
- audience: host
- source: docs/guides/routes/org/property/settings.md
- order: 70

They go to the building admin email shown read-only in Email automations. It comes from your development's PMO email, which the platform team sets in Super Admin. If it is empty, GAF and pet emails cannot send, but it never blocks saving the rest of the page.

### What does free parking on your own slots do?

- category: Property Settings
- audience: host
- source: docs/guides/routes/org/property/settings.md
- order: 80

When a guest from this property books one of your own parking slots, they skip payment. Slots owned by other hosts are still paid. The option only appears when Allow Parking is on and you have at least one active parking slot, and it does nothing while Allow Parking is off.

### Why did the Parking owners field disappear?

- category: Property Settings
- audience: host
- source: docs/guides/routes/org/property/settings.md
- order: 90

Property parking broadcast emails were retired. Parking now uses Find parking and the shareable parking link, so there is no owner BCC list to maintain. Nothing you set there affects email today.

### Do I need a different Telegram bot for every notification module?

- category: Notifications
- audience: host
- source: docs/guides/routes/org/property/notifications.md
- order: 10

No. One shared bot token is enough. Save it once at the top and each module can reuse it, or override it with its own token if you want. Use different Chat IDs so each module posts to the right group.

### Can I turn off just one type of notification alert?

- category: Notifications
- audience: host
- source: docs/guides/routes/org/property/notifications.md
- order: 20

Yes. Each module (Chat, Marketing, Staff, Operations, Finance, and Maintenance) has its own Enable notifications toggle, so you can turn on only what you need.

### How do I pick a Telegram group for alerts?

- category: Notifications
- audience: host
- source: docs/guides/routes/org/property/notifications.md
- order: 30

Leave Chat ID empty, tap Scan for chats in that field, then choose your group from the dropdown. Add the bot to the group and send a message first if nothing appears.

### Can I test a notification module before turning it on?

- category: Notifications
- audience: host
- source: docs/guides/routes/org/property/notifications.md
- order: 40

Yes. Use Save and test in that module. It confirms the bot token and chat ID before alerts start.

### Why can't I reply to some Facebook or Instagram messages?

- category: Guest Communication
- audience: host
- source: docs/guides/routes/org/property/inbox.md
- order: 10

Meta only allows replies within 24 hours of the guest's last message. After that window closes, the guest needs to message you again before you can respond from here.

### Where do I set quick replies and automation for Guest Inbox?

- category: Guest Communication
- audience: host
- source: docs/guides/routes/org/property/inbox.md
- order: 20

On the property Inbox under Manage, then Quick replies or Automation. Those settings apply across your organization.

### Do I need to connect Facebook before I can publish marketing content?

- category: Guest Communication
- audience: host
- source: docs/guides/routes/org/property/marketing.md
- order: 30

Yes. Connect your Facebook Page and Instagram through Guest Inbox first. Without that, you can still design and download assets, just not publish them from here.

### Can I connect Facebook or Instagram to a parking inbox?

- category: Guest Communication
- audience: host
- source: docs/guides/routes/org/parking/inbox.md
- order: 40

No. Meta messaging is only available for property inboxes. Parking Guest Inbox is website chat only.

### Do parking quick replies apply to every slot?

- category: Guest Communication
- audience: host
- source: docs/guides/routes/org/parking/inbox.md
- order: 50

No. Quick replies and automation are stored for that parking listing only. Other slots keep their own setup.

### How do I get a finance report to send to my accountant?

- category: Billing & Finance
- audience: host
- source: docs/guides/routes/org/property/finance.md
- order: 10

Use Export report in the page header. You can export just the summary, just stays, just transactions, or a full combined report as a PDF for the date range you picked.

### A booking showed up in my Finance list. Did someone add it manually?

- category: Billing & Finance
- audience: host
- source: docs/guides/routes/org/property/finance.md
- order: 20

No. Every stay's income comes in automatically, alongside anything you add manually like expenses. You don't need to add booking income yourself.

### Can I see guest stay payments on the parking finance page?

- category: Billing & Finance
- audience: host
- source: docs/guides/routes/org/parking/finance.md
- order: 30

No. That ledger is for the parking slot's own operating transactions. Guest stay payments stay under each property's finance module.

### Can I edit just one occurrence of a recurring expense?

- category: Billing & Finance
- audience: host
- source: docs/guides/routes/org/property/finance.md
- order: 40

Yes. When you edit or delete a recurring transaction, you choose whether the change applies to that occurrence, that one and all future ones, or the whole series.

### Do the finance charts follow the date range I pick?

- category: Billing & Finance
- audience: host
- source: docs/guides/routes/org/property/finance.md
- order: 50

Yes. The summary cards, charts, and transaction list all use the selected range. Booking income is counted for the nights that fall inside it.

### Can I use my own category for an expense?

- category: Billing & Finance
- audience: host
- source: docs/guides/routes/org/property/finance.md
- order: 60

Yes. Pick Other (type your own), then type the category name and press Enter (or choose Use "..."). It saves with the transaction and works in filters, charts, and reports like the built-in categories.

### How do I get Telegram reminders for maintenance tasks?

- category: Maintenance & Operations
- audience: host
- source: docs/guides/routes/org/property/maintenance.md
- order: 10

Go to Notifications and open the Maintenance section to connect your Telegram bot and turn on reminders. The Maintenance page tracks the tasks; Notifications controls when alerts are sent.

### What alerts does the Operations notification module cover?

- category: Maintenance & Operations
- audience: host
- source: docs/guides/routes/org/property/operations.md
- order: 20

Booking workflow notifications, such as new bookings, status changes, and other admin alerts your team wants in Telegram.

### Can a maintenance reminder repeat on a schedule?

- category: Maintenance & Operations
- audience: host
- source: docs/guides/routes/org/property/maintenance.md
- order: 30

Yes. When you add or edit a reminder, set it as a recurring series. One-off tasks and completed history stay separate.

### Is exporting a maintenance report included on my plan?

- category: Maintenance & Operations
- audience: host
- source: docs/guides/routes/org/property/maintenance.md
- order: 40

Viewing reminders is included on every plan. PDF export needs the reporting feature, which starts on Starter, and the export permission on your team role.

### Can I use my own category for a maintenance task?

- category: Maintenance & Operations
- audience: host
- source: docs/guides/routes/org/property/maintenance.md
- order: 50

Yes. Pick Other (type your own), then type the category name and press Enter (or choose Use "..."). It saves with the reminder and works in filters, cards, and reports like the built-in categories.

### What can I ask the AI assistant?

- category: AI Assistant
- audience: host
- source: docs/guides/routes/org/assistant.md
- order: 10

Open the sparkles button on any dashboard page. A new chat has a Questions and Actions switcher with five starters on each side. Questions cover check-ins, occupancy, balances, maintenance, and what a status means. Actions can move a booking forward, re-check receipts, or cancel, and risky changes still ask you to confirm. Inbox conversations are not covered yet.

### Can I attach a receipt or GAF in the AI assistant chat?

- category: AI Assistant
- audience: host
- source: docs/guides/routes/org/assistant.md
- order: 20

Yes. Use the paperclip next to the message box for a photo or PDF, up to three files at 4 MB each. Use the calendar button to pin a stay so the assistant knows which booking you mean.

### Where does the AI assistant get its answers about my property?

- category: AI Assistant
- audience: host
- source: docs/guides/routes/org/assistant.md
- order: 30

It reads your live dashboard data and the help guides for the page you are on. It should say when it cannot find an answer instead of guessing. If it is unsure, open the relevant page or file a ticket.

### Is billing per property or per organization?

- category: Plans & Billing
- audience: host
- source: docs/guides/routes/org/plans.md
- order: 10

Pricing is per property, but you pay once for the whole organization. Every listing in the org is included automatically.

### What plan names will I see?

- category: Plans & Billing
- audience: host
- source: docs/guides/routes/org/plans.md
- order: 20

Free, Starter, Pro, Business, and Managed. Pro adds Marketing Content Studio, Airbnb calendar sync, and Smart Pricing. Business adds Meta publishing and the full AI toolkit.

### Can I change my plan at any time?

- category: Plans & Billing
- audience: host
- source: docs/guides/routes/org/plans.md
- order: 30

Yes. Owners can switch tiers, or change how many properties are covered, from Plans and Billing. Paid upgrades open PayMongo checkout and take effect once payment clears. Moving to Free applies immediately.

### What happens when I add a property on a paid plan?

- category: Plans & Billing
- audience: host
- source: docs/guides/routes/org/plans.md
- order: 40

The new property joins your subscription at the next checkout, or is enrolled right away when you already have an active plan. Billing always covers every property in the organization.

### What happens if I miss a payment?

- category: Plans & Billing
- audience: host
- source: docs/guides/routes/org/plans.md
- order: 50

The organization becomes past due and keeps full access during the grace period. After that it is suspended until you pay, and only Plans and Billing and Help and Support stay reachable.

### How do I get the Managed plan?

- category: Plans & Billing
- audience: host
- source: docs/guides/routes/org/plans.md
- order: 60

Managed is sales-assisted. Choose Contact sales on the Managed card, or file a ticket from Help and Support, and our team will confirm onboarding and pricing.

### What is Marketing Studio?

- category: Marketing Studio
- audience: host
- source: docs/guides/routes/org/property/marketing.md
- order: 10

It is where you create promotional content for a property: availability calendars, social posts, short videos, and AI-generated photos. You can download what you make or publish it to a connected Facebook Page or Instagram account.

### What is a theme?

- category: Marketing Studio
- audience: host
- source: docs/guides/routes/org/property/marketing.md
- order: 20

A theme is your look: colors, fonts, a background style, and a corner style. Calendars, posts, videos, and AI results made inside a theme use it, so the marketing looks like one brand.

### Can I edit something after AI makes it?

- category: Marketing Studio
- audience: host
- source: docs/guides/routes/org/property/marketing.md
- order: 30

Yes. Open the item from Your creations and keep editing by hand, or send a change request and compare versions. Nothing you already made is lost.

### Where does the text on an AI post come from?

- category: Marketing Studio
- audience: host
- source: docs/guides/routes/org/property/marketing.md
- order: 40

Times, deposit, and amenities come from your property settings word for word. The AI writes the headline and short lines, but it cannot add an amenity, price, or time you have not saved.

### Can I recover something I deleted?

- category: Marketing Studio
- audience: host
- source: docs/guides/routes/org/property/marketing.md
- order: 50

Yes, for 30 days. Use Undo right after deleting, or open History, choose Recently deleted, and restore it. After 30 days it is gone for good.

### What does the property Analytics page show?

- category: Analytics & Reports
- audience: host
- source: docs/guides/routes/org/property/analytics.md
- order: 10

It shows how this listing performs for the date range you pick: occupancy, rates, new bookings, guest mix, and where bookings come from.

### Why does occupancy look different from the dashboard?

- category: Analytics & Reports
- audience: host
- source: docs/guides/routes/org/property/analytics.md
- order: 20

Analytics uses a night-by-night calculation like the dashboard, but it lets you choose a custom range and always shows a period-over-period comparison.

### What does Unknown mean in Guest origins or Age?

- category: Analytics & Reports
- audience: host
- source: docs/guides/routes/org/property/analytics.md
- order: 30

Some bookings do not have a parseable address, nationality, or guest age. They are shown as their own bucket instead of being dropped, so the percentages stay honest.

### What does How you compare mean?

- category: Analytics & Reports
- audience: host
- source: docs/guides/routes/org/property/analytics.md
- order: 40

It shows your occupancy and average nightly rate against the median of other active Pro listings on Kame, not named competitors. It stays empty until enough peer listings have bookings in the same kind of period.

### Can I download an analytics report on Free?

- category: Analytics & Reports
- audience: host
- source: docs/guides/routes/org/property/analytics.md
- order: 50

Export PDF is on Pro. The button still shows on Free, and tapping it opens the plan upgrade options.

### When does a review become visible?

- category: Reviews & Reputation
- audience: host
- source: docs/guides/routes/org/property/reviews.md
- order: 10

Guest reviews stay hidden until both sides finish, or until 14 days after checkout pass. That gives each side a fair chance to write without seeing the other review first.

### Can I respond to a review and change the response later?

- category: Reviews & Reputation
- audience: host
- source: docs/guides/routes/org/property/reviews.md
- order: 20

Yes. You can write, edit, or remove your public response from Received. The guest is emailed only when the response first appears.

### What does Report do on a review?

- category: Reviews & Reputation
- audience: host
- source: docs/guides/routes/org/property/reviews.md
- order: 30

It sends the review to the platform team, who can keep or remove it. You can file up to two open reports per review.

### What is Auto-review?

- category: Reviews & Reputation
- audience: host
- source: docs/guides/routes/org/property/reviews.md
- order: 40

On Pro, Auto-review can post your guest review from a template a few days after checkout. It skips stays with issue tags, open maintenance, or a reduced deposit. It never posts a response on its own.

### Can I use a guest review in marketing?

- category: Reviews & Reputation
- audience: host
- source: docs/guides/routes/org/property/reviews.md
- order: 50

Yes. Use in marketing opens Marketing Studio on Posts with that review selected, so you can put it on a graphic.

### What is Public Pages?

- category: Public Pages
- audience: host
- source: docs/guides/routes/org/property/public-pages.md
- order: 10

Public Pages lists every guest URL for a property: Showcase, Stay Guide, the listing, and the operational pages such as calendar, booking form, messages, refund form, and guest review.

### What is Showcase?

- category: Public Pages
- audience: host
- source: docs/guides/routes/org/property/public-pages.md
- order: 20

Showcase is a shareable one-page landing link with animated templates. It is separate from your marketing listing and needs Pro or above for the live page.

### Why doesn't the refund or find-parking copy link work for a guest?

- category: Public Pages
- audience: host
- source: docs/guides/routes/org/property/public-pages.md
- order: 30

Find parking now copies a plain marketplace link, so it works without a booking. Refund and guest review links still need a specific stay: open Public Pages, go to Booking links, choose Copy link, then pick the stay. Only stays ready for check-out or pending SD refund are listed. Completed stays are hidden because the refund is already settled.

### Is there a Save button in the page editor?

- category: Public Pages
- audience: host
- source: docs/guides/routes/org/property/public-pages.md
- order: 40

On Pro and above, changes save automatically and the header shows Unsaved, Saving, then Saved. Below Pro, autosave is not included, so a Save button appears and opens the upgrade prompt instead of saving.

### Which public links are personal to one booking?

- category: Public Pages
- audience: host
- source: docs/guides/routes/org/property/public-pages.md
- order: 50

Stay guide, security-deposit refund, and guest review links are per booking. Calendar, booking form, listing, and find-parking links can be shared with any guest. Messages links also need stay dates, which you pick when you copy the link.

### Can I share a calendar link with dates already selected?

- category: Public Pages
- audience: host
- source: docs/guides/routes/org/property/public-pages.md
- order: 60

Yes. On the Calendar card choose Copy link, select the check-in and check-out dates, then Copy link. The guest opens the calendar with that range selected. You can also copy the calendar without dates.

### How do I block dates for a property?

- category: Pricing & Availability
- audience: host
- source: docs/guides/routes/org/property/pricing.md
- order: 10

Open Pricing, select future available nights, and choose Block. Guests cannot select or submit those nights. You can reopen all or part of the range later.

### Can I change the rate on a booked night?

- category: Pricing & Availability
- audience: host
- source: docs/guides/routes/org/property/pricing.md
- order: 20

No. A booked night shows the guest stay instead of a list price. Open the booking to see its amount and change pricing on the booking if needed.

### Will changing rates update existing bookings?

- category: Pricing & Availability
- audience: host
- source: docs/guides/routes/org/property/pricing.md
- order: 30

No. Bookings with saved pricing keep their amounts. Updated rates apply to future pricing reviews that do not already have saved amounts.

### How do I connect Airbnb or another OTA calendar?

- category: Pricing & Availability
- audience: host
- source: docs/guides/routes/org/property/pricing.md
- order: 40

Open Pricing, then Channel sync. Airbnb is the only provider offered today. Use From Airbnb to paste their export link, and To Airbnb to copy your Kame link back into Airbnb.

### Can I reopen only part of a blocked range?

- category: Pricing & Availability
- audience: host
- source: docs/guides/routes/org/property/pricing.md
- order: 50

Yes. Select the blocked nights you want to reopen and choose Unblock. The other nights stay blocked.

### Where do I find Activity?

- category: Activity & Audit
- audience: host
- source: docs/guides/routes/org/activity.md
- order: 10

Open Settings, find the Activity section, and choose Manage. The old direct Activity link opens the same view.

### How far back does the activity timeline go?

- category: Activity & Audit
- audience: host
- source: docs/guides/routes/org/activity.md
- order: 20

The default window is the last 90 days. Use the date filter to look at a different range.

### Can I see activity for just one property or parking slot?

- category: Activity & Audit
- audience: host
- source: docs/guides/routes/org/property/activity.md
- order: 30

Yes. The org Activity view includes every listing. Each property and parking slot also has its own Activity section limited to that listing.

### Who can export the activity log?

- category: Activity & Audit
- audience: host
- source: docs/guides/routes/org/activity.md
- order: 40

Owners and org admins can export the filtered view to CSV. Export is included on Starter and above, and on Free the button offers an upgrade. Viewing the log is free on every plan.

### Can I edit or delete an activity entry?

- category: Activity & Audit
- audience: host
- source: docs/guides/routes/org/activity.md
- order: 50

No. Activity is a read-only audit record, which is what makes it useful for checking who changed what.

### Where do I find a parking slot's activity?

- category: Activity & Audit
- audience: host
- source: docs/guides/routes/org/parking/activity.md
- order: 60

Open the parking **Settings**, find the **Activity** section, and choose **Manage**. It shows changes for that slot only, including reservation and payout actions.

### Where do I find announcements?

- category: Announcements
- audience: host
- source: docs/guides/routes/org/announcements.md
- order: 10

Open Announcements from the org sidebar, or More on a phone. A red dot means you still have unread notices.

### What does the red dot on Announcements mean?

- category: Announcements
- audience: host
- source: docs/guides/routes/org/announcements.md
- order: 20

You have at least one unread notice. Open each notice, or use Read all on a group, to clear the unread state.

### What is the difference between Platform and a development name?

- category: Announcements
- audience: host
- source: docs/guides/routes/org/announcements.md
- order: 30

Platform applies to all hosts. A development name applies only to properties and parkings linked to that development.

### Can I mark every announcement read at once?

- category: Announcements
- audience: host
- source: docs/guides/routes/org/announcements.md
- order: 40

Yes. Next to each group title, Platform or a development name, tap Read all when that group has unread notices.

### How does a guest see their bookings?

- category: Guest Portal
- audience: guest
- source: docs/guides/routes/account/trips.md
- order: 10

After signing in, the guest opens Trips in the account area. They need to use the same email they entered on the booking form.

### Which bookings appear under Trips?

- category: Guest Portal
- audience: guest
- source: docs/guides/routes/account/trips.md
- order: 20

Property stays only. Parking marketplace bookings are not listed in the guest Trips area.

### What is Stays in the guest account?

- category: Guest Portal
- audience: guest
- source: docs/guides/routes/account/stays.md
- order: 30

Stays is the guest's inbox for every conversation with hosts, across properties and parking slots, in one list.

### Can a guest change their profile without changing a booking?

- category: Guest Portal
- audience: guest
- source: docs/guides/routes/account/profile.md
- order: 40

Yes. Name, bio, phone, location, and photo are managed by the guest and stay separate from details already submitted on a booking.

### Can a guest save properties for later?

- category: Guest Portal
- audience: guest
- source: docs/guides/routes/account/favorites.md
- order: 50

Yes. Tapping the heart icon saves a property to Favorites. Favorites are private, do not hold dates, and stay with the guest's account across devices.

### How does a guest contact support?

- category: Guest Portal
- audience: guest
- source: docs/guides/routes/account/tickets.md
- order: 60

A guest opens the Contact page, picks a category, and signs in when prompted. The ticket then appears under Tickets in the account area, and replies also arrive by email.

### When does a guest earn a voucher?

- category: Vouchers & Rewards
- audience: guest
- source: docs/guides/routes/account/vouchers.md
- order: 10

After a completed stay, when the guest leaves a review and claims the next-stay reward.

### Where does a guest find their voucher?

- category: Vouchers & Rewards
- audience: guest
- source: docs/guides/routes/account/vouchers.md
- order: 20

In the account area under Vouchers. Ready vouchers link to book the same property again, and used vouchers stay listed for history.

### Can a guest transfer a voucher or stack two vouchers?

- category: Vouchers & Rewards
- audience: guest
- source: docs/guides/routes/account/vouchers.md
- order: 30

No. A voucher stays with the guest who earned it and applies to one future booking at the same property. Vouchers cannot be stacked.

### Does a voucher change the downpayment?

- category: Vouchers & Rewards
- audience: guest
- source: docs/guides/routes/account/vouchers.md
- order: 40

No. The downpayment stays as usual. The voucher reduces the booking rate when the host reviews pricing.

### How do hosts and guests sign in?

- category: Account & Security
- audience: public
- source: docs/guides/routes/auth.md
- order: 10

With a one-time code sent to an email address, or with a Google account. There is no password to create, remember, or reset.

### Is there a password I need to manage?

- category: Account & Security
- audience: public
- source: docs/guides/routes/auth.md
- order: 20

No. Sign-in works through a one-time email code or Google, by design. There is no password field and nothing to reset.

### Can a guest sign in with Facebook?

- category: Account & Security
- audience: public
- source: docs/guides/routes/auth.md
- order: 30

No. Guests sign in with a one-time email code or Google. Facebook is not offered as a sign-in option.

### Why is a guest asked to sign in partway through booking?

- category: Account & Security
- audience: public
- source: docs/guides/routes/auth.md
- order: 40

Guests can browse dates and fill out the form first. They are asked to verify their identity right before the booking is submitted, and they can also sign in from the Sign In link at any time.

### Can I have two host accounts with the same email?

- category: Account & Security
- audience: public
- source: docs/guides/routes/auth.md
- order: 50

No. Each email is one host account, and signing in opens the existing workspace. You cannot create a second organization with the same email.

### Does the public Support page show the same answers as Help and Support in the dashboard?

- category: Account & Security
- audience: public
- source: docs/guides/routes/legal.md
- order: 60

The public page shows published answers for guests and hosts. Signed-in hosts get the full Help and Support area, with guides, search, and tickets for their listings.

---

### How does a guest cancel a booking?

- category: Bookings
- audience: host
- source: docs/guides/routes/trip.md

Guests cancel from their trip page. They see the policy that applied when they booked, the next refund deadline and the exact refund before they confirm. Refunds are based on what the guest has actually paid, not the full stay value: a guest who paid only the down payment gets a percentage of that down payment back, and the security deposit is always refunded. With an instant policy they cancel right away while only the down payment is paid. With "Ask me first", custom or unset policies, or once the balance is paid, they send a request you approve or decline. If the guest paid nothing yet, the refund is zero and nothing is owed.

### Can I change my cancellation policy without changing existing bookings?

- category: Bookings
- audience: host
- source: docs/guides/routes/org/property/settings.md

Yes. The policy is copied onto each booking when the guest books, so a change only applies to new bookings. Property Settings shows how many upcoming bookings keep their current policy before you save. Guests on an existing booking keep the terms they agreed to.

### How do I send a refund after a cancellation?

- category: Bookings
- audience: host
- source: docs/guides/routes/org/property/bookings-detail.md

Open the cancelled booking. The Cancellation card shows the refund amount and whether the guest has added payout details. Send the money yourself, then add the receipt link and tap Mark refund sent. The guest gets a confirmation email and the refund is marked done.

### Why does the guest see a different cancellation policy than my listing?

- category: Bookings
- audience: host
- source: docs/guides/routes/trip.md

The trip page shows the policy the guest booked with, not your current listing policy. That is intentional: changing your policy should not rewrite an existing guest's terms. The booking detail shows "Policy changed" when the property policy has moved on.

### What happens if a guest cancels after check-in?

- category: Bookings
- audience: guest
- source: docs/guides/routes/trip.md

Guests cannot self-cancel after check-in. The host handles early departures and any goodwill refund from the booking. Host-initiated cancellations still work at any live stage and always refund what the guest paid before check-in.

### Can I cancel an Airbnb booking from Kame Space?

- category: Bookings
- audience: guest
- source: docs/guides/routes/trip.md

No. Calendar-synced Airbnb and other channel bookings are handled on the channel where they were made. The trip page says so and does not offer a cancel button.
