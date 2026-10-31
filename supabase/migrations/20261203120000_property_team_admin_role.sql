-- Property team: collapse MANAGER/STAFF/VIEWER → ADMIN; seed permission templates.
-- Access-preserving: STAFF rows get permissions intersected with the legacy Staff preset
-- (runtime capStaffMemberPermissions removed in the same release).

ALTER TABLE public.property_members
  DROP CONSTRAINT IF EXISTS property_members_role_id_format;

ALTER TABLE public.property_invitations
  DROP CONSTRAINT IF EXISTS property_invitations_role_id_format;

-- Normalize STAFF effective permissions before role_id changes.
UPDATE public.property_members
SET
  permissions = COALESCE(
    (
      SELECT jsonb_agg(to_jsonb(perm))
      FROM jsonb_array_elements_text(permissions) AS perm
      WHERE perm IN (
        'bookings:view',
        'bookings:edit',
        'bookings:workflow',
        'maintenance:view',
        'maintenance:edit',
        'notifications:view',
        'templates:view',
        'pricing:view',
        'inbox:view',
        'inbox:reply'
      )
    ),
    '[]'::jsonb
  ),
  saved_permissions = CASE
    WHEN saved_permissions IS NULL THEN NULL
    ELSE COALESCE(
      (
        SELECT jsonb_agg(to_jsonb(perm))
        FROM jsonb_array_elements_text(saved_permissions) AS perm
        WHERE perm IN (
          'bookings:view',
          'bookings:edit',
          'bookings:workflow',
          'maintenance:view',
          'maintenance:edit',
          'notifications:view',
          'templates:view',
          'pricing:view',
          'inbox:view',
          'inbox:reply'
        )
      ),
      '[]'::jsonb
    )
  END
WHERE role_id = 'STAFF';

UPDATE public.property_invitations
SET permissions = COALESCE(
  (
    SELECT jsonb_agg(to_jsonb(perm))
    FROM jsonb_array_elements_text(permissions) AS perm
    WHERE perm IN (
      'bookings:view',
      'bookings:edit',
      'bookings:workflow',
      'maintenance:view',
      'maintenance:edit',
      'notifications:view',
      'templates:view',
      'pricing:view',
      'inbox:view',
      'inbox:reply'
    )
  ),
  '[]'::jsonb
)
WHERE role_id = 'STAFF';

UPDATE public.property_members
SET role_id = 'ADMIN'
WHERE role_id IN ('MANAGER', 'STAFF', 'VIEWER');

UPDATE public.property_invitations
SET role_id = 'ADMIN'
WHERE role_id IN ('MANAGER', 'STAFF', 'VIEWER');

ALTER TABLE public.property_members
  ADD CONSTRAINT property_members_role_id_format CHECK (
    role_id = 'ADMIN'
    OR role_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  );

ALTER TABLE public.property_invitations
  ADD CONSTRAINT property_invitations_role_id_format CHECK (
    role_id = 'ADMIN'
    OR role_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  );

COMMENT ON TABLE public.property_custom_roles IS
  'Named permission templates assignable on one property (Full Access, Operations, Read Only, or custom).';

-- Seed default templates on every property (idempotent by name).
INSERT INTO public.property_custom_roles (property_id, name, permissions)
SELECT p.id, seed.name, seed.permissions
FROM public.properties p
CROSS JOIN (
  VALUES
    (
      'Full Access',
      '[
        "bookings:view","bookings:edit","bookings:workflow",
        "finance:view","finance:edit","pricing:view","pricing:edit",
        "maintenance:view","maintenance:edit","notifications:view","notifications:edit",
        "templates:view","templates:edit","settings:view","settings:edit",
        "team:view","team:invite","team:manage",
        "inbox:view","inbox:reply","inbox:manage","import:manage"
      ]'::jsonb
    ),
    (
      'Operations',
      '[
        "bookings:view","bookings:edit","bookings:workflow",
        "maintenance:view","maintenance:edit","notifications:view",
        "templates:view","pricing:view","inbox:view","inbox:reply"
      ]'::jsonb
    ),
    (
      'Read Only',
      '[
        "bookings:view","maintenance:view","notifications:view",
        "templates:view","pricing:view","team:view","inbox:view"
      ]'::jsonb
    )
) AS seed(name, permissions)
WHERE NOT EXISTS (
  SELECT 1
  FROM public.property_custom_roles existing
  WHERE existing.property_id = p.id
    AND lower(trim(existing.name)) = lower(trim(seed.name))
);
