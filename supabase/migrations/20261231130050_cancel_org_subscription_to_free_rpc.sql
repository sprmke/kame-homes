-- Atomic paid→Free downgrade: unenroll properties, audit events, cancel subscription row.

CREATE OR REPLACE FUNCTION public.cancel_org_subscription_to_free(
  p_org_subscription_id UUID,
  p_target_plan_id UUID,
  p_previous_status TEXT,
  p_changed_by UUID DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_property_id UUID;
  v_previous_plan_id UUID;
BEGIN
  SELECT plan_id
  INTO v_previous_plan_id
  FROM public.org_subscriptions
  WHERE id = p_org_subscription_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Org subscription not found';
  END IF;

  FOR v_property_id IN
    SELECT property_id
    FROM public.org_subscription_properties
    WHERE org_subscription_id = p_org_subscription_id
  LOOP
    INSERT INTO public.org_subscription_events (
      org_subscription_id,
      event_type,
      property_id,
      created_by
    ) VALUES (
      p_org_subscription_id,
      'property_removed',
      v_property_id,
      p_changed_by
    );
  END LOOP;

  DELETE FROM public.org_subscription_properties
  WHERE org_subscription_id = p_org_subscription_id;

  UPDATE public.org_subscriptions
  SET status = 'canceled',
      price_php_snapshot = 0
  WHERE id = p_org_subscription_id;

  INSERT INTO public.org_subscription_events (
    org_subscription_id,
    event_type,
    previous_plan_id,
    new_plan_id,
    previous_status,
    new_status,
    note,
    created_by
  ) VALUES (
    p_org_subscription_id,
    'status_changed',
    v_previous_plan_id,
    p_target_plan_id,
    p_previous_status,
    'canceled',
    'Host downgraded to Free',
    p_changed_by
  );
END;
$$;

REVOKE ALL ON FUNCTION public.cancel_org_subscription_to_free(UUID, UUID, TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cancel_org_subscription_to_free(UUID, UUID, TEXT, UUID) TO service_role;

COMMENT ON FUNCTION public.cancel_org_subscription_to_free IS
  'Self-serve paid→Free downgrade — unenrolls all properties and cancels the subscription atomically.';
