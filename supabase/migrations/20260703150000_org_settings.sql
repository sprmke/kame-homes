-- Org-scoped operator settings (email routing, automation, guest links/branding).
-- Property-scoped app_settings retains payment, GAF, and Google integration IDs.

CREATE TABLE IF NOT EXISTS public.org_settings (
  id BIGSERIAL PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  email_to TEXT,
  email_reply_to TEXT,
  parking_owner_emails TEXT,
  sd_refund_cron_email_lead_minutes INTEGER
    CHECK (
      sd_refund_cron_email_lead_minutes IS NULL
      OR (sd_refund_cron_email_lead_minutes >= 0 AND sd_refund_cron_email_lead_minutes <= 10080)
    ),
  sd_refund_cron_max_checkout_age_days INTEGER
    CHECK (
      sd_refund_cron_max_checkout_age_days IS NULL
      OR (sd_refund_cron_max_checkout_age_days >= 0 AND sd_refund_cron_max_checkout_age_days <= 365)
    ),
  public_guest_app_origin TEXT,
  facebook_reviews_url TEXT,
  email_logo_url TEXT,
  default_parking_rate_guest NUMERIC(12, 2)
    CHECK (default_parking_rate_guest IS NULL OR default_parking_rate_guest > 0),
  CONSTRAINT org_settings_organization_id_unique UNIQUE (organization_id)
);

CREATE INDEX IF NOT EXISTS idx_org_settings_organization_id
  ON public.org_settings (organization_id);

COMMENT ON TABLE public.org_settings IS
  'Organization-wide email routing, automation tuning, and guest-facing links/branding.';

DROP TRIGGER IF EXISTS update_org_settings_updated_at ON public.org_settings;
CREATE TRIGGER update_org_settings_updated_at
  BEFORE UPDATE ON public.org_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE public.org_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org owner can read own org_settings"
  ON public.org_settings FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.organizations o
      WHERE o.id = org_settings.organization_id AND o.owner_id = auth.uid()
    )
  );

CREATE POLICY "Org owner can insert own org_settings"
  ON public.org_settings FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.organizations o
      WHERE o.id = org_settings.organization_id AND o.owner_id = auth.uid()
    )
  );

CREATE POLICY "Org owner can update own org_settings"
  ON public.org_settings FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.organizations o
      WHERE o.id = org_settings.organization_id AND o.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.organizations o
      WHERE o.id = org_settings.organization_id AND o.owner_id = auth.uid()
    )
  );

GRANT SELECT, INSERT, UPDATE ON public.org_settings TO authenticated;
GRANT ALL ON public.org_settings TO service_role;

-- Backfill from property-scoped app_settings when property_id already exists
-- (added later in 20260821120000 on fresh resets).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'app_settings'
      AND column_name = 'property_id'
  ) THEN
    INSERT INTO public.org_settings (
      organization_id,
      email_to,
      email_reply_to,
      parking_owner_emails,
      sd_refund_cron_email_lead_minutes,
      sd_refund_cron_max_checkout_age_days,
      public_guest_app_origin,
      facebook_reviews_url,
      email_logo_url,
      default_parking_rate_guest
    )
    SELECT
      o.id,
      src.email_to,
      src.email_reply_to,
      src.parking_owner_emails,
      src.sd_refund_cron_email_lead_minutes,
      src.sd_refund_cron_max_checkout_age_days,
      src.public_guest_app_origin,
      src.facebook_reviews_url,
      src.email_logo_url,
      src.default_parking_rate_guest
    FROM public.organizations o
    LEFT JOIN LATERAL (
      SELECT a.*
      FROM public.properties p
      INNER JOIN public.app_settings a ON a.property_id = p.id
      WHERE p.organization_id = o.id
      ORDER BY p.created_at ASC
      LIMIT 1
    ) src ON TRUE
    WHERE NOT EXISTS (
      SELECT 1 FROM public.org_settings os WHERE os.organization_id = o.id
    )
    ON CONFLICT (organization_id) DO NOTHING;
  END IF;
END $$;

-- Legacy singleton row → default org when property rows had no org-level copy yet.
INSERT INTO public.org_settings (
  organization_id,
  email_to,
  email_reply_to,
  parking_owner_emails,
  sd_refund_cron_email_lead_minutes,
  sd_refund_cron_max_checkout_age_days,
  public_guest_app_origin,
  facebook_reviews_url,
  email_logo_url,
  default_parking_rate_guest
)
SELECT
  o.id,
  legacy.email_to,
  legacy.email_reply_to,
  legacy.parking_owner_emails,
  legacy.sd_refund_cron_email_lead_minutes,
  legacy.sd_refund_cron_max_checkout_age_days,
  legacy.public_guest_app_origin,
  legacy.facebook_reviews_url,
  legacy.email_logo_url,
  legacy.default_parking_rate_guest
FROM public.organizations o
CROSS JOIN LATERAL (
  SELECT *
  FROM public.app_settings
  WHERE id = 1
  LIMIT 1
) legacy
WHERE o.slug = 'kame-home'
  AND NOT EXISTS (
    SELECT 1 FROM public.org_settings os WHERE os.organization_id = o.id
  )
ON CONFLICT (organization_id) DO NOTHING;
