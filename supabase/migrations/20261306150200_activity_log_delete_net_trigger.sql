-- Activity log — belt-and-braces AFTER DELETE net on the top-level tenant tables.
--
-- Every delete path for organizations / properties / parkings goes through an edge
-- function today (delete-organization / delete-property / delete-parking), and each
-- emits its own `org.deleted` / `property.deleted` / `parking.deleted` activity row
-- with full actor context. This trigger only fills the gap those cannot cover: a
-- direct authenticated PostgREST delete (end-user JWT), which should never happen
-- but would otherwise leave no trace.
--
-- Guard: the WHEN clause fires only for `authenticated` / `anon` JWT roles, so the
-- service-role cascade deletes performed by edge functions (which already self-log)
-- are skipped and never double-logged. Scope is the three top-level tables only —
-- child tables (property_members, finance_*, …) are intentionally excluded so a
-- cascade delete does not fan out into one row per child.

CREATE OR REPLACE FUNCTION public.activity_log_delete_net()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id uuid;
  v_property_id uuid;
  v_parking_id uuid;
  v_scope text;
  v_action text;
  v_target_type text;
  v_label text;
  v_claims json;
  v_actor_user_id uuid;
  v_actor_email text;
BEGIN
  IF TG_TABLE_NAME = 'organizations' THEN
    v_org_id := OLD.id;
    v_scope := 'org';
    v_action := 'org.deleted';
    v_target_type := 'organization';
    v_label := OLD.name;
  ELSIF TG_TABLE_NAME = 'properties' THEN
    v_org_id := OLD.organization_id;
    v_property_id := OLD.id;
    v_scope := 'property';
    v_action := 'property.deleted';
    v_target_type := 'property';
    v_label := OLD.name;
  ELSIF TG_TABLE_NAME = 'parkings' THEN
    v_org_id := OLD.organization_id;
    v_parking_id := OLD.id;
    v_scope := 'parking';
    v_action := 'parking.deleted';
    v_target_type := 'parking';
    v_label := OLD.name;
  ELSE
    RETURN OLD;
  END IF;

  IF v_org_id IS NULL THEN
    RETURN OLD;
  END IF;

  v_claims := nullif(current_setting('request.jwt.claims', true), '')::json;
  BEGIN
    v_actor_user_id := (v_claims ->> 'sub')::uuid;
  EXCEPTION WHEN others THEN
    v_actor_user_id := NULL;
  END;
  IF v_actor_user_id IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = v_actor_user_id) THEN
    v_actor_user_id := NULL;
  END IF;
  v_actor_email := v_claims ->> 'email';

  INSERT INTO public.activity_log (
    organization_id, property_id, parking_id, scope,
    actor_type, actor_user_id, actor_email, actor_role,
    action, category, severity,
    target_type, target_id, target_label,
    summary, metadata, source
  )
  VALUES (
    v_org_id, v_property_id, v_parking_id, v_scope,
    'team_member', v_actor_user_id, v_actor_email, NULL,
    v_action, CASE WHEN v_scope = 'org' THEN 'org' ELSE v_scope END, 'destructive',
    v_target_type, OLD.id::text, v_label,
    'A ' || v_target_type || ' was deleted', '{"via":"db_trigger_net"}'::jsonb, 'db_trigger'
  );

  RETURN OLD;
EXCEPTION WHEN others THEN
  RAISE WARNING 'activity_log_delete_net failed (non-fatal): %', SQLERRM;
  RETURN OLD;
END;
$$;

COMMENT ON FUNCTION public.activity_log_delete_net() IS
  'Belt-and-braces AFTER DELETE net for direct end-user deletes of organizations/properties/parkings; service-role cascade deletes are skipped by the trigger WHEN clause.';

DROP TRIGGER IF EXISTS trg_activity_log_delete_net_org ON public.organizations;
CREATE TRIGGER trg_activity_log_delete_net_org
AFTER DELETE ON public.organizations
FOR EACH ROW
WHEN (
  coalesce(
    nullif(current_setting('request.jwt.claims', true), '')::json ->> 'role',
    ''
  ) IN ('authenticated', 'anon')
)
EXECUTE FUNCTION public.activity_log_delete_net();

DROP TRIGGER IF EXISTS trg_activity_log_delete_net_property ON public.properties;
CREATE TRIGGER trg_activity_log_delete_net_property
AFTER DELETE ON public.properties
FOR EACH ROW
WHEN (
  coalesce(
    nullif(current_setting('request.jwt.claims', true), '')::json ->> 'role',
    ''
  ) IN ('authenticated', 'anon')
)
EXECUTE FUNCTION public.activity_log_delete_net();

DROP TRIGGER IF EXISTS trg_activity_log_delete_net_parking ON public.parkings;
CREATE TRIGGER trg_activity_log_delete_net_parking
AFTER DELETE ON public.parkings
FOR EACH ROW
WHEN (
  coalesce(
    nullif(current_setting('request.jwt.claims', true), '')::json ->> 'role',
    ''
  ) IN ('authenticated', 'anon')
)
EXECUTE FUNCTION public.activity_log_delete_net();
