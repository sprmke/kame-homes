-- Super Admin audit log — append-only record of platform-team mutations
-- (plan assigns, verification decisions, payout disbursements, AI kill-switch flips,
-- credit-wallet adjustments, FAQ/announcement/development edits).
-- Written fire-and-forget by _shared/superAdminAudit.ts; read only via
-- list-super-admin-audit (serveSuperAdmin). No RLS read path.

CREATE TABLE IF NOT EXISTS public.super_admin_audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id UUID REFERENCES auth.users (id) ON DELETE SET NULL,
  actor_email TEXT NOT NULL,
  action TEXT NOT NULL,
  target_type TEXT,
  target_id TEXT,
  summary TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_super_admin_audit_created
  ON public.super_admin_audit_events (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_super_admin_audit_target
  ON public.super_admin_audit_events (target_type, target_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_super_admin_audit_actor
  ON public.super_admin_audit_events (actor_email, created_at DESC);

COMMENT ON TABLE public.super_admin_audit_events IS
  'Append-only super-admin action log. Human-readable `summary`; structured before/after in `metadata`.';

ALTER TABLE public.super_admin_audit_events ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.super_admin_audit_events TO service_role;
