-- Align Azure North development parking levels with parking settings catalog (Level 1–3).
-- Remove deprecated marketing fields from settings JSON.

UPDATE developments
SET
  settings = (
    COALESCE(settings, '{}'::jsonb)
    - 'established'
    - 'totalUnits'
    - 'priceRangeMin'
    - 'priceRangeMax'
    - 'website'
  ) || jsonb_build_object(
    'parkingLevels', jsonb_build_array('Level 1', 'Level 2', 'Level 3')
  ),
  updated_at = now()
WHERE slug = 'azure-north-residences';
