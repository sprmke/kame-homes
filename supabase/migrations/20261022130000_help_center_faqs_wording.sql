-- Rewords a handful of help_center_faqs seeded in 20261021130000 — same facts,
-- simpler and less choppy phrasing (mainly dropping the "X — Y" sentence
-- pattern from the copy shown on the host-facing Help & Support page).

UPDATE public.help_center_faqs
SET answer = $$Use New booking in the page header. It opens the guest booking form for this property.$$
WHERE category = 'Bookings' AND question = $$How do I create a new booking?$$;

UPDATE public.help_center_faqs
SET answer = $$Yes. Use Import beside New booking (property bookings only). Upload a CSV or Excel file, or download your Google Sheet as Excel or CSV first, then confirm the column mapping and review the rows. Imported bookings start in Imported status and don't trigger new-booking emails or calendar events.$$
WHERE category = 'Bookings' AND question = $$Can I bulk-import bookings from a spreadsheet?$$;

UPDATE public.help_center_faqs
SET answer = $$Yes. Return to <step> at the bottom left moves the booking to a previous status. Existing fields and documents get reset, and no emails go out. It always names the step you're moving to and asks you to confirm first.$$
WHERE category = 'Bookings' AND question = $$Can I go back a step if I made a mistake on a booking?$$;

UPDATE public.help_center_faqs
SET answer = $$Archive hides the property from active use but keeps all bookings and history. Delete permanently removes an empty property, and it's blocked if any bookings exist, so use Archive instead for units with past stays.$$
WHERE category = 'Property Settings' AND question = $$What's the difference between Archive and Delete for a property?$$;

UPDATE public.help_center_faqs
SET answer = $$There isn't one link you can reuse. Each guest gets their own personal link automatically once their booking reaches ready-for-check-in.$$
WHERE category = 'Property Settings' AND question = $$How do I get a shareable link for the stay guide?$$;

UPDATE public.help_center_faqs
SET answer = $$No, one shared bot token is enough. Save it once at the top and each module can reuse it, or override it with its own token if you want. Use different Chat IDs so each module posts to the right group.$$
WHERE category = 'Notifications' AND question = $$Do I need a different Telegram bot for every notification module?$$;

UPDATE public.help_center_faqs
SET answer = $$Yes. Each module (Chat, Marketing, Staff, Operations, Finance, Maintenance) has its own Enable notifications toggle, so you can turn on only what you need.$$
WHERE category = 'Notifications' AND question = $$Can I turn off just one type of notification alert?$$;

UPDATE public.help_center_faqs
SET answer = $$Yes. Connect your Facebook Page and Instagram through Guest Inbox first. Without that, you can still design and download assets, just not publish them from here.$$
WHERE category = 'Guest Communication' AND question = $$Do I need to connect Facebook before I can publish marketing content?$$;

UPDATE public.help_center_faqs
SET answer = $$Use Export report in the page header. You can export just the summary, just stays, just transactions, or a full combined report as a PDF for the date range you picked.$$
WHERE category = 'Billing & Finance' AND question = $$How do I get a finance report to send to my accountant?$$;

UPDATE public.help_center_faqs
SET question = $$A booking showed up in my Finance list. Did someone add it manually?$$,
    answer = $$No. Every stay's income comes in automatically, alongside anything you add manually like expenses. You don't need to add booking income yourself.$$
WHERE category = 'Billing & Finance' AND question = $$Why does a booking show up in my Finance list — did someone add it manually?$$;

UPDATE public.help_center_faqs
SET answer = $$Booking workflow notifications: new bookings, status changes, and other admin alerts your team wants in Telegram.$$
WHERE category = 'Maintenance & Operations' AND question = $$What alerts does the Operations notification module cover?$$;

UPDATE public.help_center_faqs
SET answer = $$Open the sparkles button on any dashboard page. A new chat has a Questions / Actions switcher with five starters on each side. Questions cover check-ins, occupancy, balances, maintenance, and what a status means. Actions can move a booking forward, re-check receipts, or cancel a booking, though risky changes still ask you to confirm first. Parking, inbox, and marketing aren't covered yet.$$
WHERE category = 'AI Assistant' AND question = $$What can I ask the AI assistant?$$;
