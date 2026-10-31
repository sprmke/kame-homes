-- Edge functions use service_role; developments table was missing grants.

GRANT SELECT, INSERT, UPDATE, DELETE ON public.developments TO service_role;
