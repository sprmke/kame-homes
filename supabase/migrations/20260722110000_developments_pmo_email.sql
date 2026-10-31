-- PMO email (GAF/pet approvals) is configured per development, not per property.
-- Fresh-reset: app_settings.property_id is added in 20260821120000.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'app_settings'
      AND column_name = 'property_id'
  ) THEN
    UPDATE developments d
    SET
      settings = COALESCE(d.settings, '{}'::jsonb) || jsonb_build_object(
        'pmoEmail',
        COALESCE(
          NULLIF(TRIM(d.settings->>'pmoEmail'), ''),
          (
            SELECT NULLIF(TRIM(a.email_to), '')
            FROM properties p
            JOIN app_settings a ON a.property_id = p.id
            WHERE p.residence_name = d.name
            ORDER BY p.created_at ASC NULLS LAST
            LIMIT 1
          ),
          'stlmonaco.theresortresidences@azurenorth.com.ph'
        )
      ),
      updated_at = now()
    WHERE slug = 'azure-north-residences';
  ELSE
    UPDATE developments d
    SET
      settings = COALESCE(d.settings, '{}'::jsonb) || jsonb_build_object(
        'pmoEmail',
        COALESCE(
          NULLIF(TRIM(d.settings->>'pmoEmail'), ''),
          'stlmonaco.theresortresidences@azurenorth.com.ph'
        )
      ),
      updated_at = now()
    WHERE slug = 'azure-north-residences';
  END IF;
END $$;
