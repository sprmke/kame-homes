-- Edge functions insert via service_role. GRANT ALL ON TABLE does not include SERIAL/BIGSERIAL
-- sequences — inserts then fail with "permission denied for sequence …_id_seq" (42501).
-- See org_settings on create-organization; property_pricing fix in 20260910150000.

DO $$
DECLARE
  seq record;
BEGIN
  FOR seq IN
    SELECT c.relname AS seq_name
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind = 'S'
  LOOP
    EXECUTE format(
      'GRANT USAGE, SELECT ON SEQUENCE public.%I TO service_role',
      seq.seq_name
    );
  END LOOP;
END $$;
