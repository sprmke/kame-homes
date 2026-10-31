-- Azure North Residences: default pool fee and schedule for guest/AI context.

UPDATE developments
SET
  settings = settings
    || jsonb_build_object(
      'poolFee', 200,
      'poolSchedule', '7 AM to 7 PM. Maintenance every Tuesday.'
    ),
  updated_at = now()
WHERE slug = 'azure-north-residences'
  AND (
    NOT (settings ? 'poolFee')
    OR (settings->>'poolFee') IS NULL
    OR btrim(COALESCE(settings->>'poolSchedule', '')) = ''
  );
