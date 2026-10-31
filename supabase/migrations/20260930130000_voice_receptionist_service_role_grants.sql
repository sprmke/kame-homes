-- voice_receptionist tables had RLS enabled but no role grants — edge functions
-- (service_role) failed with "permission denied for table voice_receptionist_*".
-- Same pattern as 20260913120000_social_inbox_service_role_grants.sql.

GRANT ALL ON public.voice_receptionist_global_settings TO service_role;
GRANT ALL ON public.voice_receptionist_settings TO service_role;
GRANT ALL ON public.voice_receptionist_sessions TO service_role;
