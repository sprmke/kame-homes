-- Cutover shaping (20-shape-tenant-org.sql) can set tower_and_unit after
-- 20260821140000_properties_tower_unit_columns.sql backfill, leaving tower NULL.
-- Legacy residence_name "Azure North" also fails UI tower validation (canonical:
-- "Azure North Residences").

-- Re-parse tower + unit from tower_and_unit (idempotent).
UPDATE public.properties
SET
  tower = 'Monaco',
  unit_number = substring(tower_and_unit from 'Monaco\s+(\d{4})$'),
  updated_at = now()
WHERE tower IS NULL
  AND tower_and_unit ~* '^Monaco\s+\d{4}$';

UPDATE public.properties
SET
  tower = 'Bali',
  unit_number = substring(tower_and_unit from 'Bali\s+(\d{4})$'),
  updated_at = now()
WHERE tower IS NULL
  AND tower_and_unit ~* '^Bali\s+\d{4}$';

UPDATE public.properties
SET
  tower = 'Barbados',
  unit_number = substring(tower_and_unit from 'Barbados\s+(\d{4})$'),
  updated_at = now()
WHERE tower IS NULL
  AND tower_and_unit ~* '^Barbados\s+\d{4}$';

-- Canonical Azure North residence label for tower dropdown / validation.
UPDATE public.properties
SET
  residence_name = 'Azure North Residences',
  updated_at = now()
WHERE lower(trim(coalesce(residence_name, ''))) = 'azure north';

-- Primary Kame property (cutover slug + public marketing slug).
UPDATE public.properties
SET
  tower = coalesce(tower, 'Monaco'),
  unit_number = coalesce(nullif(trim(unit_number), ''), '2604'),
  tower_and_unit = coalesce(nullif(trim(tower_and_unit), ''), 'Monaco 2604'),
  residence_name = 'Azure North Residences',
  updated_at = now()
WHERE slug IN ('monaco-2604', 'kame-home')
  AND (
    tower IS NULL
    OR lower(trim(coalesce(residence_name, ''))) IN ('azure north', '')
  );
