-- property_id on tables created after 20260629180000_multi_tenancy_foundation.sql
-- (app_settings, telegram_admin/finance/maintenance, maintenance_items).

ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS property_id UUID REFERENCES public.properties (id) ON DELETE CASCADE;

ALTER TABLE public.telegram_admin_settings
  ADD COLUMN IF NOT EXISTS property_id UUID REFERENCES public.properties (id) ON DELETE CASCADE;

ALTER TABLE public.telegram_finance_settings
  ADD COLUMN IF NOT EXISTS property_id UUID REFERENCES public.properties (id) ON DELETE CASCADE;

ALTER TABLE public.telegram_maintenance_settings
  ADD COLUMN IF NOT EXISTS property_id UUID REFERENCES public.properties (id) ON DELETE CASCADE;

ALTER TABLE public.maintenance_items
  ADD COLUMN IF NOT EXISTS property_id UUID REFERENCES public.properties (id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_maintenance_items_property_id
  ON public.maintenance_items (property_id);

DO $$
DECLARE
  v_prop_id UUID;
BEGIN
  SELECT p.id INTO v_prop_id
  FROM public.properties p
  WHERE p.slug = 'monaco-2604'
  ORDER BY p.created_at ASC
  LIMIT 1;

  IF v_prop_id IS NULL THEN
    SELECT p.id INTO v_prop_id
    FROM public.properties p
    ORDER BY p.created_at ASC
    LIMIT 1;
  END IF;

  IF v_prop_id IS NULL THEN
    RAISE NOTICE
      'multi_tenancy late tables: no property row yet — skip backfill (use /onboarding after sign-in)';
    RETURN;
  END IF;

  UPDATE public.app_settings SET property_id = v_prop_id WHERE property_id IS NULL;
  UPDATE public.telegram_admin_settings SET property_id = v_prop_id WHERE property_id IS NULL;
  UPDATE public.telegram_finance_settings SET property_id = v_prop_id WHERE property_id IS NULL;
  UPDATE public.telegram_maintenance_settings SET property_id = v_prop_id WHERE property_id IS NULL;
  UPDATE public.maintenance_items SET property_id = v_prop_id WHERE property_id IS NULL;
END $$;

ALTER TABLE public.maintenance_items
  ALTER COLUMN property_id SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS app_settings_property_id_unique
  ON public.app_settings (property_id)
  WHERE property_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS telegram_admin_settings_property_id_unique
  ON public.telegram_admin_settings (property_id)
  WHERE property_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS telegram_finance_settings_property_id_unique
  ON public.telegram_finance_settings (property_id)
  WHERE property_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS telegram_maintenance_settings_property_id_unique
  ON public.telegram_maintenance_settings (property_id)
  WHERE property_id IS NOT NULL;
