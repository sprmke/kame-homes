-- One-time seed for help_center_faqs — curated from the vetted "Host-facing
-- knowledge" Q&A already synced into ai_dashboard_assistant_knowledge_base
-- (scripts/sync-ai-knowledge-base.ts). Reuses the exact vetted wording rather
-- than paraphrasing. Ongoing curation happens via the super-admin FAQ editor.
-- Docs: docs/workflow/in-progress/help-support-center.md, Module 4.

INSERT INTO public.help_center_faqs (category, question, answer, sort_order, source_route_guide_path)
VALUES
  -- Getting Started
  ($$Getting Started$$, $$Can I own two separate organizations with one Google account?$$,
   $$No. Each account can own one organization. You can still be invited as an admin to other people's organizations.$$,
   10, 'docs/guides/routes/org/selector.md'),
  ($$Getting Started$$, $$What's the difference between Owner and Admin?$$,
   $$Both can work across all properties and manage the team. Only the owner can change organization settings (including delete org) and add new properties. Admins handle day-to-day operations on existing listings.$$,
   20, 'docs/guides/routes/org/team.md'),
  ($$Getting Started$$, $$Why does a team invite require a Gmail address?$$,
   $$Hosts sign in with Google. The invite email must match the Google account the person will use to accept.$$,
   30, 'docs/guides/routes/org/team.md'),
  ($$Getting Started$$, $$What happens if I delete the organization?$$,
   $$Deletion is permanent and only allowed when there is no booking history (and no blocking finance or maintenance records). You must type the organization slug to confirm. Your Google sign-in account stays; only this org and its properties are removed.$$,
   40, 'docs/guides/routes/org/settings.md'),
  ($$Getting Started$$, $$Why can't I see the Add property button?$$,
   $$Only the organization owner (and platform admin) can create new properties. Org admins can view and edit existing ones but not add listings.$$,
   50, 'docs/guides/routes/org/properties.md'),

  -- Team & Permissions
  ($$Team & Permissions$$, $$What's the difference between Manager and Staff on a property team?$$,
   $$Managers can access finance, settings, team management, and notifications editing. Staff can handle bookings and maintenance day-to-day but can't invite team members or change property settings.$$,
   10, 'docs/guides/routes/org/property/team.md'),
  ($$Team & Permissions$$, $$How do property team invites work?$$,
   $$Enter their Gmail address (they sign in with Google), choose a role, and they'll get an email link valid for seven days to accept and join this property.$$,
   20, 'docs/guides/routes/org/property/team.md'),
  ($$Team & Permissions$$, $$What's the difference between Manager, Staff, and Viewer on a parking team?$$,
   $$Managers have full access including team invites. Staff can handle operational work (e.g. edit bookings and view pricing). Viewers can look but not change sensitive settings.$$,
   30, 'docs/guides/routes/org/parking/team.md'),
  ($$Team & Permissions$$, $$Can a parking team member access my properties too?$$,
   $$Only if they're also invited at the org or property level. Parking invites grant access to this slot only.$$,
   40, 'docs/guides/routes/org/parking/team.md'),

  -- Bookings
  ($$Bookings$$, $$How do I create a new booking?$$,
   $$Use New booking in the page header — it opens the guest booking form for this property.$$,
   10, 'docs/guides/routes/org/property/bookings.md'),
  ($$Bookings$$, $$Can I bulk-import bookings from a spreadsheet?$$,
   $$Yes — use Import beside New booking (property bookings only). Upload a CSV or Excel file (or download your Google Sheet as Excel/CSV first), confirm column mapping, then review the rows. Imported bookings start in Imported status and do not trigger new-booking emails or calendar events.$$,
   20, 'docs/guides/routes/org/property/bookings.md'),
  ($$Bookings$$, $$Can I go back a step if I made a mistake on a booking?$$,
   $$Yes — Return to <step> at the bottom left moves the booking to a previous status. Existing fields and documents will be reset, and no emails will be sent. It always names the step you're moving to and asks you to confirm.$$,
   30, 'docs/guides/routes/org/property/bookings-detail.md'),
  ($$Bookings$$, $$Why can't I cancel this booking?$$,
   $$Cancelling is only available up to Ready for Check-in. Once a booking reaches Ready for Check-out the stay has already happened, so it gets finished or refunded instead of cancelled.$$,
   40, 'docs/guides/routes/org/property/bookings-detail.md'),
  ($$Bookings$$, $$Can I close calendar dates without creating a booking?$$,
   $$Yes. Select future available nights and choose Block. Guests cannot select or submit those nights.$$,
   50, 'docs/guides/routes/org/property/calendar.md'),

  -- Parking
  ($$Parking$$, $$How do I add a new parking slot?$$,
   $$Tap Add parking (or use the + menu in the sidebar switcher), then complete setup on the new slot's settings page.$$,
   10, 'docs/guides/routes/org/parkings.md'),
  ($$Parking$$, $$Is a standalone parking slot the same as parking tied to a stay booking on a property?$$,
   $$No. These are standalone parking listings (tower slots, motorcycle bays, etc.). Guest stays that only need parking at a rental unit are still managed under property bookings.$$,
   20, 'docs/guides/routes/org/parkings.md'),
  ($$Parking$$, $$What do guests actually see on a parking listing?$$,
   $$Everything in basic info, photos, location, amenities, and payment flows to your public parking page. Keep cover photo, description, and GCash details accurate before sharing the link.$$,
   30, 'docs/guides/routes/org/parking/settings.md'),
  ($$Parking$$, $$How do weekend parking rates work?$$,
   $$Friday through Sunday nights use the weekend nightly rate automatically. Monday–Thursday use the weekday rate unless you set a custom price on the calendar for those dates.$$,
   40, 'docs/guides/routes/org/parking/pricing.md'),
  ($$Parking$$, $$Who can add or delete parking finance transactions?$$,
   $$Team members with finance edit access for this parking slot. View-only roles can see summaries but not change lines.$$,
   50, 'docs/guides/routes/org/parking/finance.md'),

  -- Property Settings
  ($$Property Settings$$, $$What's the difference between Archive and Delete for a property?$$,
   $$Archive hides the property from active use but keeps all bookings and history. Delete permanently removes an empty property and is blocked if any bookings exist — use Archive for units with past stays.$$,
   10, 'docs/guides/routes/org/property/settings.md'),
  ($$Property Settings$$, $$Where do I configure which documents guests must submit (GAF, pet approval, etc.)?$$,
   $$Document requirements are set at the development level by the platform team (Super Admin → Developments → Document Requirements). All properties in that development inherit the same list.$$,
   20, 'docs/guides/routes/org/property/settings.md'),
  ($$Property Settings$$, $$Which templates do guests actually see?$$,
   $$The four standard templates (house rules, check-in instructions, check-out instructions, parking reminders) appear on the guest stay guide during their booking window. Email templates are used for automated messages throughout the booking process.$$,
   30, 'docs/guides/routes/org/property/templates.md'),
  ($$Property Settings$$, $$How do I get a shareable link for the stay guide?$$,
   $$There isn't a single static link — each guest gets a personalized, token-gated link automatically when their booking reaches ready-for-check-in.$$,
   40, 'docs/guides/routes/org/property/custom-pages.md'),

  -- Notifications
  ($$Notifications$$, $$Do I need a different Telegram bot for every notification module?$$,
   $$No — one shared bot token is enough. Save it once at the top; each module can reuse it or override with its own token. Use different Chat IDs so each module posts to the right group.$$,
   10, 'docs/guides/routes/org/property/notifications.md'),
  ($$Notifications$$, $$Can I turn off just one type of notification alert?$$,
   $$Yes — each module (Chat, Marketing, Staff, Operations, Finance, Maintenance) has its own Enable notifications toggle so you can opt in only to what you need.$$,
   20, 'docs/guides/routes/org/property/notifications.md'),
  ($$Notifications$$, $$How do I pick a Telegram group for alerts?$$,
   $$Leave Chat ID empty, tap Scan for chats in that field, then choose your group from the dropdown. Add the bot to the group and send a message first if nothing appears.$$,
   30, 'docs/guides/routes/org/property/notifications.md'),

  -- Guest Communication
  ($$Guest Communication$$, $$Why can't I reply to some Facebook or Instagram messages?$$,
   $$Meta only allows replies within 24 hours of the guest's last message. After that window closes, you'll need the guest to message you again before you can respond from here.$$,
   10, 'docs/guides/routes/org/property/inbox.md'),
  ($$Guest Communication$$, $$Where do I set quick replies and automation for Guest Inbox?$$,
   $$On the property Inbox under Manage → Quick replies / Automation. Those settings apply across your organization.$$,
   20, 'docs/guides/routes/org/property/inbox.md'),
  ($$Guest Communication$$, $$Do I need to connect Facebook before I can publish marketing content?$$,
   $$Yes — connect your Facebook Page and Instagram through Guest Inbox first. Without that, you can still design and download assets but not publish from here.$$,
   30, 'docs/guides/routes/org/property/marketing.md'),

  -- Billing & Finance
  ($$Billing & Finance$$, $$How do I get a finance report to send to my accountant?$$,
   $$Use Export report in the page header — you can export just the summary, just stays, just transactions, or a full combined report as a PDF for the selected date range.$$,
   10, 'docs/guides/routes/org/property/finance.md'),
  ($$Billing & Finance$$, $$Why does a booking show up in my Finance list — did someone add it manually?$$,
   $$No — every stay's income is pulled in automatically alongside anything you add manually (like expenses). You don't need to add booking income yourself.$$,
   20, 'docs/guides/routes/org/property/finance.md'),
  ($$Billing & Finance$$, $$Can I see guest stay payments on the parking finance page?$$,
   $$No. That ledger is for the parking slot's own operating transactions. Guest stay payments stay under each property's finance module.$$,
   30, 'docs/guides/routes/org/parking/finance.md'),

  -- Maintenance & Operations
  ($$Maintenance & Operations$$, $$How do I get Telegram reminders for maintenance tasks?$$,
   $$Go to Notifications and open the Maintenance section to connect your Telegram bot and turn on reminders. The Maintenance page tracks the tasks; Notifications controls when alerts are sent.$$,
   10, 'docs/guides/routes/org/property/maintenance.md'),
  ($$Maintenance & Operations$$, $$What alerts does the Operations notification module cover?$$,
   $$Booking workflow notifications — things like new bookings, status changes, and other admin alerts your team wants in Telegram.$$,
   20, 'docs/guides/routes/org/property/operations.md'),

  -- AI Assistant
  ($$AI Assistant$$, $$What can I ask the AI assistant?$$,
   $$Open the sparkles button on any dashboard page. A new chat has a Questions / Actions switcher with five starters on each side. Questions cover check-ins, occupancy, balances, maintenance, and what a status means. Actions can move a booking forward, re-check receipts, or cancel — risky changes still ask you to confirm. Parking, inbox, and marketing are not covered yet.$$,
   10, 'docs/guides/routes/org/settings.md'),
  ($$AI Assistant$$, $$Can I attach a receipt or GAF in the AI assistant chat?$$,
   $$Yes. Use the paperclip next to the message box for a photo or PDF (up to three files, 4 MB each). Use the calendar button to pin a stay so the assistant knows which booking you mean.$$,
   20, 'docs/guides/routes/org/settings.md');
