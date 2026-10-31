-- Org team: allow template UUID role_ids; migrate legacy ADMIN rows to seeded templates.

ALTER TABLE public.organization_members
  DROP CONSTRAINT IF EXISTS organization_members_role_id_check;

ALTER TABLE public.organization_invitations
  DROP CONSTRAINT IF EXISTS organization_invitations_role_id_check;

-- Match legacy ADMIN rows to a seeded template by exact permissions JSON (prefer Full Access > Operations > Read Only).
UPDATE public.organization_members om
SET role_id = matched.template_id
FROM (
  SELECT
    om_inner.id AS member_id,
    (
      SELECT ocr.id
      FROM public.organization_custom_roles ocr
      WHERE ocr.organization_id = om_inner.organization_id
        AND ocr.permissions = om_inner.permissions
      ORDER BY CASE lower(trim(ocr.name))
        WHEN 'full access' THEN 1
        WHEN 'operations' THEN 2
        WHEN 'read only' THEN 3
        ELSE 4
      END
      LIMIT 1
    ) AS template_id
  FROM public.organization_members om_inner
  WHERE om_inner.role_id = 'ADMIN'
) AS matched
WHERE om.id = matched.member_id
  AND matched.template_id IS NOT NULL;

-- Fallback: legacy ADMIN preset → Operations template.
UPDATE public.organization_members om
SET role_id = ocr.id
FROM public.organization_custom_roles ocr
WHERE om.role_id = 'ADMIN'
  AND ocr.organization_id = om.organization_id
  AND lower(trim(ocr.name)) = 'operations';

UPDATE public.organization_invitations oi
SET role_id = matched.template_id
FROM (
  SELECT
    oi_inner.id AS invitation_id,
    (
      SELECT ocr.id
      FROM public.organization_custom_roles ocr
      WHERE ocr.organization_id = oi_inner.organization_id
        AND ocr.permissions = oi_inner.permissions
      ORDER BY CASE lower(trim(ocr.name))
        WHEN 'full access' THEN 1
        WHEN 'operations' THEN 2
        WHEN 'read only' THEN 3
        ELSE 4
      END
      LIMIT 1
    ) AS template_id
  FROM public.organization_invitations oi_inner
  WHERE oi_inner.role_id = 'ADMIN'
) AS matched
WHERE oi.id = matched.invitation_id
  AND matched.template_id IS NOT NULL;

UPDATE public.organization_invitations oi
SET role_id = ocr.id
FROM public.organization_custom_roles ocr
WHERE oi.role_id = 'ADMIN'
  AND ocr.organization_id = oi.organization_id
  AND lower(trim(ocr.name)) = 'operations';

COMMENT ON COLUMN public.organization_members.role_id IS
  'Org hub role template UUID from organization_custom_roles (Full Access / Operations / Read Only / custom). Legacy ADMIN migrated on 20261231140100.';

COMMENT ON COLUMN public.organization_invitations.role_id IS
  'Org hub role template UUID from organization_custom_roles. Legacy ADMIN migrated on 20261231140100.';
