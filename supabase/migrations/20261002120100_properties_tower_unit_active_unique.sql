-- One public (ACTIVE) listing per Azure tower + unit. Multiple INACTIVE peers allowed for succession.

DROP INDEX IF EXISTS public.properties_tower_unit_unique;

CREATE UNIQUE INDEX IF NOT EXISTS properties_tower_unit_active_unique
  ON public.properties (lower(tower), unit_number)
  WHERE status = 'ACTIVE'
    AND tower IS NOT NULL
    AND unit_number IS NOT NULL;

COMMENT ON INDEX public.properties_tower_unit_active_unique IS
  'At most one ACTIVE property per Azure tower + unit; INACTIVE duplicates allowed for succession.';
