-- Edge functions use service_role; without table GRANTs Postgres returns 42501 even with RLS bypass.
-- See 20260910150000_property_pricing_grants.sql.

GRANT SELECT, INSERT, UPDATE, DELETE ON public.property_smart_pricing_settings TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.property_smart_pricing_runs TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.property_smart_pricing_recommendations TO service_role;
