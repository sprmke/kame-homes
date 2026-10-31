-- Distinct tower + unit_number on properties (global unique pair for Azure units).

ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS tower TEXT,
  ADD COLUMN IF NOT EXISTS unit_number TEXT;

COMMENT ON COLUMN public.properties.tower IS
  'Azure tower name (Monaco | Bali | Barbados). Part of global unit identity.';

COMMENT ON COLUMN public.properties.unit_number IS
  'Four-digit unit number within the tower. Part of global unit identity.';

-- Backfill from legacy tower_and_unit where possible
UPDATE public.properties
SET
  tower = 'Monaco',
  unit_number = substring(tower_and_unit from 'Monaco\s+(\d{4})$')
WHERE tower IS NULL
  AND tower_and_unit ~ '^Monaco\s+\d{4}$';

UPDATE public.properties
SET
  tower = 'Bali',
  unit_number = substring(tower_and_unit from 'Bali\s+(\d{4})$')
WHERE tower IS NULL
  AND tower_and_unit ~ '^Bali\s+\d{4}$';

UPDATE public.properties
SET
  tower = 'Barbados',
  unit_number = substring(tower_and_unit from 'Barbados\s+(\d{4})$')
WHERE tower IS NULL
  AND tower_and_unit ~ '^Barbados\s+\d{4}$';

ALTER TABLE public.properties
  DROP CONSTRAINT IF EXISTS properties_unit_number_format_check;

ALTER TABLE public.properties
  ADD CONSTRAINT properties_unit_number_format_check
  CHECK (unit_number IS NULL OR unit_number ~ '^\d{4}$');

ALTER TABLE public.properties
  DROP CONSTRAINT IF EXISTS properties_tower_allowed_check;

ALTER TABLE public.properties
  ADD CONSTRAINT properties_tower_allowed_check
  CHECK (tower IS NULL OR tower IN ('Monaco', 'Bali', 'Barbados'));

CREATE UNIQUE INDEX IF NOT EXISTS properties_tower_unit_unique
  ON public.properties (lower(tower), unit_number)
  WHERE tower IS NOT NULL AND unit_number IS NOT NULL;
