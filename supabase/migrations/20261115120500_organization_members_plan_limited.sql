-- Org team seat reconciliation (mirrors property_members.plan_limited from 20261108140000).

ALTER TABLE public.organization_members
  ADD COLUMN IF NOT EXISTS plan_limited BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.organization_members.plan_limited IS
  'True when status=inactive solely because the org exceeded its pooled teamManagement.maxMembers cap; auto-restored on upgrade before manual inactive rows.';
