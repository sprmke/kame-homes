-- Host platform settings: service-role only (hosts read via list-host-announcements edge function).
-- Re-issued under a unique version. The original file shared 20261231140100 with
-- org_team_template_role_ids.sql, so this SQL never applied.

DROP POLICY IF EXISTS platform_host_settings_select ON public.platform_host_settings;
REVOKE SELECT ON public.platform_host_settings FROM authenticated;
