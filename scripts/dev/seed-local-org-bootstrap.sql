-- Ensures fixed org UUID used by search fixtures exists after a fresh `db reset`
-- (migrations skip default org when auth.users is empty).
-- Safe to re-run.

DO $$
DECLARE
  v_owner UUID := 'dddddddd-dddd-4ddd-8ddd-dddddddddd01';
  v_org UUID := '405ea07f-cc21-4bcc-b540-28729be79f0d';
BEGIN
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = v_owner) THEN
    INSERT INTO auth.users (
      id,
      instance_id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at
    )
    VALUES (
      v_owner,
      '00000000-0000-0000-0000-000000000000',
      'authenticated',
      'authenticated',
      'local-seed-owner@localhost.local',
      crypt('local-seed-password-not-for-login', gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{}'::jsonb,
      now(),
      now()
    );
  END IF;

  INSERT INTO public.organizations (id, owner_id, name, slug, description)
  VALUES (
    v_org,
    v_owner,
    'Kame Homes',
    'kame-homes',
    'Local seed org for search fixtures and dashboard demo'
  )
  ON CONFLICT (id) DO UPDATE
    SET
      owner_id = EXCLUDED.owner_id,
      name = EXCLUDED.name,
      slug = EXCLUDED.slug,
      description = EXCLUDED.description;

  INSERT INTO public.properties (
    id,
    organization_id,
    name,
    slug,
    type,
    status,
    tower_and_unit,
    residence_name,
    max_guests
  )
  VALUES (
    'e5555555-5555-4555-8555-555555555501',
    v_org,
    'Monaco 2604',
    'kame-home',
    'CONDO',
    'ACTIVE',
    'Monaco 2604',
    'Azure North',
    6
  )
  ON CONFLICT (slug) DO UPDATE
    SET
      organization_id = EXCLUDED.organization_id,
      name = EXCLUDED.name,
      tower_and_unit = EXCLUDED.tower_and_unit,
      residence_name = EXCLUDED.residence_name,
      status = 'ACTIVE';
END $$;
