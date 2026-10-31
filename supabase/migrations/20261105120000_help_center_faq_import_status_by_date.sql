-- Import commit: past stays → Imported; today/future → Pending Review (batch-linked).

UPDATE public.help_center_faqs
SET answer = $$Yes. Use Import beside New booking (property bookings only). Upload a CSV or Excel file, or download your Google Sheet as Excel or CSV first, then confirm the column mapping and review the rows. Past stays commit as Imported; today and future stays show Pending Review but still appear when you filter by Imported. No new-booking emails or calendar events on import.$$
WHERE category = 'Bookings' AND question = $$Can I bulk-import bookings from a spreadsheet?$$;
