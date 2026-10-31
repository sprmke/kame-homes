-- Close the remaining SECURITY DEFINER execute gap from the pre-production
-- audit: RLS helpers and the activity-log delete trigger were granted to
-- PUBLIC by default. Anon/authenticated callers must not RPC them via
-- PostgREST. Policies still evaluate them as the table owner after
-- GRANT EXECUTE TO authenticated (the only role those policies target).
--
-- activity-log: N/A — grant/revoke only; no org-scoped row mutation.

REVOKE ALL ON FUNCTION public.user_can_access_guest_submission_property(UUID)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.user_can_access_guest_submission_property(UUID)
  TO authenticated;

REVOKE ALL ON FUNCTION public.user_can_access_guest_submission_parking(UUID)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.user_can_access_guest_submission_parking(UUID)
  TO authenticated;

REVOKE ALL ON FUNCTION public.user_can_access_guest_submission_broadcast_org(UUID)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.user_can_access_guest_submission_broadcast_org(UUID)
  TO authenticated;

-- Current helper (third arg added in 20261301170000). Also drop the leftover
-- two-arg overload if it still exists so PostgREST cannot call the old shape.
DROP FUNCTION IF EXISTS public.user_can_access_guest_submission(UUID, UUID);
REVOKE ALL ON FUNCTION public.user_can_access_guest_submission(UUID, UUID, UUID)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.user_can_access_guest_submission(UUID, UUID, UUID)
  TO authenticated;

REVOKE ALL ON FUNCTION public.user_can_access_org_inbox(UUID)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.user_can_access_org_inbox(UUID)
  TO authenticated;

REVOKE ALL ON FUNCTION public.user_can_access_guest_web_conversation(UUID)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.user_can_access_guest_web_conversation(UUID)
  TO authenticated;

REVOKE ALL ON FUNCTION public.user_can_access_org_notifications(UUID)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.user_can_access_org_notifications(UUID)
  TO authenticated;

REVOKE ALL ON FUNCTION public.user_can_access_org_support_tickets(UUID)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.user_can_access_org_support_tickets(UUID)
  TO authenticated;

REVOKE ALL ON FUNCTION public.user_can_access_ai_dashboard_assistant_org(UUID)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.user_can_access_ai_dashboard_assistant_org(UUID)
  TO authenticated;

REVOKE ALL ON FUNCTION public.activity_log_delete_net()
  FROM PUBLIC, anon, authenticated;
