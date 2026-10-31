-- Edge functions use service_role; without table GRANTs Postgres returns 42501 even with RLS bypass.
-- See 20260702190000_service_role_grants_gmail_maintenance_finance.sql, 20260905110000_property_template_contents_grants.sql.

GRANT SELECT, INSERT, UPDATE, DELETE ON public.property_pricing_date_overrides TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.property_pricing_date_overrides_id_seq TO service_role;
