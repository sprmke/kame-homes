-- Clear database linter 0029 (authenticated_security_definer_function_executable)
-- without breaking RLS.
--
-- Plan: docs/workflow/in-progress/supabase-capacity-and-operational-readiness.md
--
-- These 10 helpers are SECURITY DEFINER predicates used by RLS policies. The
-- policies need `authenticated` to execute them, but PostgREST should not expose
-- them at /rest/v1/rpc. Moving them to a schema that is not in the API's exposed
-- schema list removes the endpoint while keeping policy evaluation intact:
-- policy expressions store the function OID, so they follow the function across
-- a schema move.
--
-- `private` is intentionally not exposed by PostgREST (db-schemas defaults to
-- public, graphql_public). Anon gets no access.
--
-- activity-log: N/A (schema move and grants only; no row mutation).

CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC;
GRANT USAGE ON SCHEMA private TO authenticated, service_role;

ALTER FUNCTION public.user_can_access_ai_dashboard_assistant_org(uuid) SET SCHEMA private;
ALTER FUNCTION public.user_can_access_guest_submission(uuid, uuid, uuid) SET SCHEMA private;
ALTER FUNCTION public.user_can_access_guest_submission_broadcast_org(uuid) SET SCHEMA private;
ALTER FUNCTION public.user_can_access_guest_submission_parking(uuid) SET SCHEMA private;
ALTER FUNCTION public.user_can_access_guest_submission_property(uuid) SET SCHEMA private;
ALTER FUNCTION public.user_can_access_guest_web_conversation(uuid) SET SCHEMA private;
ALTER FUNCTION public.user_can_access_org_inbox(uuid) SET SCHEMA private;
ALTER FUNCTION public.user_can_access_org_notifications(uuid) SET SCHEMA private;
ALTER FUNCTION public.user_can_access_org_support_tickets(uuid) SET SCHEMA private;
ALTER FUNCTION public.user_can_read_activity_broadcast(text) SET SCHEMA private;

-- This helper calls three other moved helpers by name, so update its body too.
CREATE OR REPLACE FUNCTION private.user_can_access_guest_submission(
  p_property_id uuid,
  p_parking_id uuid,
  p_broadcast_org_id uuid DEFAULT NULL::uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'private', 'public', 'pg_temp'
AS $function$
  SELECT
    (p_property_id IS NOT NULL AND private.user_can_access_guest_submission_property(p_property_id))
    OR
    (p_parking_id IS NOT NULL AND private.user_can_access_guest_submission_parking(p_parking_id))
    OR
    (p_broadcast_org_id IS NOT NULL AND private.user_can_access_guest_submission_broadcast_org(p_broadcast_org_id));
$function$;

-- This helper calls another moved helper by name, so update its body too.
CREATE OR REPLACE FUNCTION private.user_can_read_activity_broadcast(p_topic text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'private', 'public', 'pg_temp'
AS $function$
DECLARE
  v_raw TEXT := substring(p_topic FROM '^activity:org:(.+)$');
  v_org UUID;
BEGIN
  IF v_raw IS NULL
     OR v_raw !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    RETURN FALSE;
  END IF;
  v_org := v_raw::uuid;
  RETURN private.user_can_access_org_notifications(v_org);
END;
$function$;

REVOKE ALL ON FUNCTION private.user_can_access_guest_submission(uuid, uuid, uuid)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.user_can_read_activity_broadcast(text)
  FROM PUBLIC, anon;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA private FROM PUBLIC, anon;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA private TO authenticated, service_role;

COMMENT ON SCHEMA private IS
  'Non-exposed helpers used by RLS policies. Not part of the PostgREST API surface.';
