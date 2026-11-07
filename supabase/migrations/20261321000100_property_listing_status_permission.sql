-- Rename the Settings leaf that gates listing lifecycle actions:
--   settings.dangerZone:edit  →  settings.listingStatus:edit
--
-- "Danger Zone" mixed a reversible action (pause/archive) with an irreversible one (delete).
-- The new leaf keeps the server allow-list honest; delete stays owner-only and is not gated
-- by any team leaf. Existing custom roles and pending invitations are remapped so nobody
-- loses access on the rename.
--
-- Plan: docs/workflow/in-progress/property-archive-and-delete-lifecycle.md (P2).

CREATE OR REPLACE FUNCTION public._gfm_rename_permission_id(
  raw JSONB,
  from_id TEXT,
  to_id TEXT
)
RETURNS JSONB
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT COALESCE(
    (
      SELECT jsonb_agg(
        DISTINCT CASE WHEN value = from_id THEN to_id ELSE value END
      )
      FROM jsonb_array_elements_text(raw) AS value
    ),
    '[]'::jsonb
  );
$$;

COMMENT ON FUNCTION public._gfm_rename_permission_id(JSONB, TEXT, TEXT) IS
  'Replaces one permission id inside a JSONB array. Used for renamed team leaves.';

UPDATE public.property_members
SET permissions = public._gfm_rename_permission_id(
    permissions,
    'settings.dangerZone:edit',
    'settings.listingStatus:edit'
  )
WHERE permissions @> '"settings.dangerZone:edit"'::jsonb;

UPDATE public.property_members
SET saved_permissions = public._gfm_rename_permission_id(
    saved_permissions,
    'settings.dangerZone:edit',
    'settings.listingStatus:edit'
  )
WHERE saved_permissions IS NOT NULL
  AND saved_permissions @> '"settings.dangerZone:edit"'::jsonb;

UPDATE public.property_invitations
SET permissions = public._gfm_rename_permission_id(
    permissions,
    'settings.dangerZone:edit',
    'settings.listingStatus:edit'
  )
WHERE permissions @> '"settings.dangerZone:edit"'::jsonb;

UPDATE public.property_custom_roles
SET permissions = public._gfm_rename_permission_id(
    permissions,
    'settings.dangerZone:edit',
    'settings.listingStatus:edit'
  )
WHERE permissions @> '"settings.dangerZone:edit"'::jsonb;
