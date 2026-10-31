-- Tighten inbox Realtime RLS: org owner or org ADMIN only (matches org:inbox:view edge gate).

CREATE OR REPLACE FUNCTION public.user_can_access_org_inbox(p_org_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organizations o
    WHERE o.id = p_org_id AND o.owner_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = p_org_id
      AND om.user_id = auth.uid()
      AND om.status = 'active'
      AND om.role_id = 'ADMIN'
  );
$$;

COMMENT ON FUNCTION public.user_can_access_org_inbox(UUID) IS
  'Org inbox Realtime read access — owner or org ADMIN (org:inbox:view). Property-only members excluded.';
