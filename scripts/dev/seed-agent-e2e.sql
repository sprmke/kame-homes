-- Local-only setup for the agentic AI scenario tests (supabase/functions/tests/agentic*.integration_test.ts).
-- Safe to re-run. Never run against a hosted project: it turns the AI features on and upgrades a plan.
--   docker exec -i supabase_db_guest-form-management psql -U postgres -d postgres < scripts/dev/seed-agent-e2e.sql

-- GoTrue cannot read seeded auth users whose token columns are NULL (admin/users returns 500).
UPDATE auth.users SET
  confirmation_token = COALESCE(confirmation_token, ''),
  recovery_token = COALESCE(recovery_token, ''),
  email_change_token_new = COALESCE(email_change_token_new, ''),
  email_change = COALESCE(email_change, ''),
  email_change_token_current = COALESCE(email_change_token_current, ''),
  reauthentication_token = COALESCE(reauthentication_token, ''),
  phone_change = COALESCE(phone_change, ''),
  phone_change_token = COALESCE(phone_change_token, '')
WHERE confirmation_token IS NULL OR recovery_token IS NULL OR email_change_token_new IS NULL
   OR email_change IS NULL OR email_change_token_current IS NULL OR reauthentication_token IS NULL
   OR phone_change IS NULL OR phone_change_token IS NULL;

UPDATE public.ai_platform_global_settings SET enabled = true;
UPDATE public.ai_dashboard_assistant_global_settings SET enabled = true;

INSERT INTO public.ai_dashboard_assistant_org_settings (organization_id, enabled)
SELECT id, true FROM public.organizations WHERE slug = 'kame-homes'
ON CONFLICT (organization_id) DO UPDATE SET enabled = true;

DO $$
DECLARE
  v_org UUID;
  v_prop UUID;
  v_sub UUID;
  v_plan UUID;
BEGIN
  SELECT id INTO v_org FROM public.organizations WHERE slug = 'kame-homes';
  SELECT id INTO v_prop FROM public.properties WHERE organization_id = v_org AND slug = 'kame-home';
  SELECT id INTO v_plan FROM public.pricing_plans WHERE code = 'pro';
  IF v_org IS NULL OR v_prop IS NULL OR v_plan IS NULL THEN
    RAISE NOTICE 'seed-agent-e2e: kame-homes / kame-home / pro plan not found, plan step skipped';
    RETURN;
  END IF;
  SELECT id INTO v_sub FROM public.org_subscriptions
    WHERE organization_id = v_org AND status IN ('active', 'trialing', 'past_due') LIMIT 1;
  IF v_sub IS NULL THEN
    INSERT INTO public.org_subscriptions (organization_id, plan_id, pricing_model, status, source)
    VALUES (v_org, v_plan, 'subscription', 'active', 'admin') RETURNING id INTO v_sub;
  ELSE
    UPDATE public.org_subscriptions SET plan_id = v_plan WHERE id = v_sub;
  END IF;
  INSERT INTO public.org_subscription_properties (org_subscription_id, property_id)
  VALUES (v_sub, v_prop) ON CONFLICT (property_id) DO NOTHING;
END $$;
