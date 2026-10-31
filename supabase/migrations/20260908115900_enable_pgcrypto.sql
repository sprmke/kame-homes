-- Fresh hosted Supabase projects may not ship with pgcrypto enabled.
-- Required for gen_random_bytes() in team invitation token defaults
-- (20260908120000_property_team_rbac, org_team, parking_team_rbac).
-- gen_random_uuid() works without this on PG 13+; gen_random_bytes() does not.

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
