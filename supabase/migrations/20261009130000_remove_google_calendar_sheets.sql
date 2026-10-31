-- Remove Google Calendar and Google Sheets integration columns.
-- Calendar/Sheets features were removed from the app (CASA cost); Gmail
-- OAuth (gmail_mail_integration, gmail.readonly scope) is unaffected.

ALTER TABLE app_settings DROP COLUMN IF EXISTS google_calendar_id;
ALTER TABLE app_settings DROP COLUMN IF EXISTS sync_calendar;
ALTER TABLE app_settings DROP COLUMN IF EXISTS google_spreadsheet_id;
ALTER TABLE app_settings DROP COLUMN IF EXISTS sync_sheets;

ALTER TABLE parking_settings DROP COLUMN IF EXISTS calendar_connected;
ALTER TABLE parking_settings DROP COLUMN IF EXISTS sheets_connected;
