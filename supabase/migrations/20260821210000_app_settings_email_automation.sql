-- Per-property email routing + automation toggles (moved from org_settings).

ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS automation_toggles JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.app_settings.automation_toggles IS
  'Per-property master switches for automated emails (emailNewBookingRequest, emailGafRequest, …).';

-- Backfill email columns from org_settings when property row is empty.
UPDATE public.app_settings AS a
SET
  email_to = COALESCE(NULLIF(TRIM(a.email_to), ''), NULLIF(TRIM(o.email_to), '')),
  email_reply_to = COALESCE(NULLIF(TRIM(a.email_reply_to), ''), NULLIF(TRIM(o.email_reply_to), '')),
  parking_owner_emails = COALESCE(
    NULLIF(TRIM(a.parking_owner_emails), ''),
    NULLIF(TRIM(o.parking_owner_emails), '')
  ),
  sd_refund_cron_email_lead_minutes = COALESCE(
    a.sd_refund_cron_email_lead_minutes,
    o.sd_refund_cron_email_lead_minutes
  ),
  sd_refund_cron_max_checkout_age_days = COALESCE(
    a.sd_refund_cron_max_checkout_age_days,
    o.sd_refund_cron_max_checkout_age_days
  ),
  default_parking_rate_guest = COALESCE(
    a.default_parking_rate_guest,
    o.default_parking_rate_guest
  ),
  automation_toggles = CASE
    WHEN a.automation_toggles = '{}'::jsonb AND o.automation_toggles IS NOT NULL
      THEN o.automation_toggles
    ELSE a.automation_toggles
  END
FROM public.properties AS p
JOIN public.org_settings AS o ON o.organization_id = p.organization_id
WHERE a.property_id = p.id;
