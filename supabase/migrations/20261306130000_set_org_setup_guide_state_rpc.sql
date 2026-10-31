-- Atomic merge of organizations.settings.setupGuide only (Setup Guide meta).
-- Edge `setup-guide-state` is the access gate; this RPC is service_role-only.

CREATE OR REPLACE FUNCTION public.set_org_setup_guide_state(
  p_org_id uuid,
  p_patch jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_settings jsonb;
  v_guide jsonb;
  v_patch jsonb;
BEGIN
  IF p_org_id IS NULL THEN
    RAISE EXCEPTION 'org id is required';
  END IF;

  v_patch := COALESCE(p_patch, '{}'::jsonb);
  IF jsonb_typeof(v_patch) <> 'object' THEN
    RAISE EXCEPTION 'patch must be a json object';
  END IF;

  SELECT COALESCE(settings, '{}'::jsonb)
  INTO v_settings
  FROM public.organizations
  WHERE id = p_org_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'organization not found';
  END IF;

  v_guide := COALESCE(v_settings->'setupGuide', '{}'::jsonb);
  IF jsonb_typeof(v_guide) <> 'object' THEN
    v_guide := '{}'::jsonb;
  END IF;

  -- Top-level key merge: arrays/scalars in the patch replace; sibling settings keys untouched.
  v_guide := v_guide || v_patch;
  v_settings := jsonb_set(v_settings, '{setupGuide}', v_guide, true);

  UPDATE public.organizations
  SET
    settings = v_settings,
    updated_at = now()
  WHERE id = p_org_id;

  RETURN v_guide;
END;
$$;

REVOKE ALL ON FUNCTION public.set_org_setup_guide_state(uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_org_setup_guide_state(uuid, jsonb) TO service_role;

COMMENT ON FUNCTION public.set_org_setup_guide_state(uuid, jsonb) IS
  'Atomically merges a patch into organizations.settings.setupGuide without clobbering sibling settings keys.';
