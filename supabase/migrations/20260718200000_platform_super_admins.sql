-- Platform super-admins (optional persistence; env SUPER_ADMIN_EMAILS is the bootstrap gate).
CREATE TABLE IF NOT EXISTS public.platform_super_admins (
  user_id UUID PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.platform_super_admins IS
  'Users with platform super-admin access. Bootstrap via SUPER_ADMIN_EMAILS; rows can be added for audit/persistence.';

ALTER TABLE public.platform_super_admins ENABLE ROW LEVEL SECURITY;
