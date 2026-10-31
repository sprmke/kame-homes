-- Org Activity & Audit Log — Phase 5: realtime "new activity" signal.
--
-- Plan:  docs/workflow/in-progress/org-activity-audit-log.md  (Phase 5)
-- Read:  list-activity-log  ·  Writer: _shared/activityLog.ts
--
-- activity_log stays deny-all under RLS (no SELECT policy — reads go only through
-- list-activity-log behind verifyOrgAccess). So postgres_changes streaming is not
-- an option. Instead an AFTER INSERT trigger pushes a *minimal* signal
-- (ids + category + severity — never summary / changes / metadata / actor) onto a
-- private per-org Realtime Broadcast topic. Clients subscribe to
-- `activity:org:<organization_id>` and refetch through list-activity-log, which
-- still enforces full listing-scoped visibility. No row content ever leaves the
-- edge read path.
--
-- The trigger can NEVER fail or slow the audit write: it is wrapped so any error
-- (missing realtime.send on an old local stack, transient failure) is swallowed
-- and the activity_log INSERT always commits.

-- ── Broadcast trigger ────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.activity_log_broadcast()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, realtime, pg_temp
AS $fn$
BEGIN
  -- realtime.send lands only on recent Supabase stacks; skip cleanly elsewhere.
  IF to_regprocedure('realtime.send(jsonb, text, text, boolean)') IS NULL THEN
    RETURN NEW;
  END IF;

  PERFORM realtime.send(
    jsonb_build_object(
      'id', NEW.id,
      'organization_id', NEW.organization_id,
      'property_id', NEW.property_id,
      'parking_id', NEW.parking_id,
      'scope', NEW.scope,
      'category', NEW.category,
      'severity', NEW.severity,
      'created_at', NEW.created_at
    ),
    'activity',
    'activity:org:' || NEW.organization_id::text,
    true  -- private topic — gated by the realtime.messages policy below
  );
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Audit completeness beats the live signal — never fail the INSERT.
    RETURN NEW;
END;
$fn$;

COMMENT ON FUNCTION public.activity_log_broadcast() IS
  'AFTER INSERT on activity_log — pushes a minimal (ids + category + severity) '
  'signal to the private Realtime topic activity:org:<organization_id>. Wrapped '
  'so it can never fail or slow the activity_log write.';

REVOKE ALL ON FUNCTION public.activity_log_broadcast() FROM PUBLIC;

DROP TRIGGER IF EXISTS trg_activity_log_broadcast ON public.activity_log;
CREATE TRIGGER trg_activity_log_broadcast
  AFTER INSERT ON public.activity_log
  FOR EACH ROW EXECUTE FUNCTION public.activity_log_broadcast();

-- ── Private-topic authorization ─────────────────────────────────────────────
-- Reuse the same coarse "is this user in the org" check the Notification Center
-- realtime channel uses (public.user_can_access_org_notifications, added in
-- 20261015120000_notifications.sql): org owner or an active organization_members
-- row. Property-/parking-only members without an org row simply get no live
-- signal and fall back to pull-to-refresh — a safe degradation.

CREATE OR REPLACE FUNCTION public.user_can_read_activity_broadcast(p_topic TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_raw TEXT := substring(p_topic FROM '^activity:org:(.+)$');
  v_org UUID;
BEGIN
  IF v_raw IS NULL
     OR v_raw !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    RETURN FALSE;
  END IF;
  v_org := v_raw::uuid;
  RETURN public.user_can_access_org_notifications(v_org);
END;
$fn$;

COMMENT ON FUNCTION public.user_can_read_activity_broadcast(TEXT) IS
  'RLS helper for realtime.messages — true when the current user may subscribe to '
  'the private activity:org:<uuid> Broadcast topic (org owner / active org '
  'member). Returns false on a malformed topic.';

REVOKE ALL ON FUNCTION public.user_can_read_activity_broadcast(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.user_can_read_activity_broadcast(TEXT) TO authenticated;

DO $$
BEGIN
  IF to_regclass('realtime.messages') IS NULL THEN
    RAISE NOTICE 'realtime.messages not present — skipping activity broadcast policy';
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'realtime'
      AND tablename = 'messages'
      AND policyname = 'activity_log_broadcast_read'
  ) THEN
    EXECUTE $pol$
      CREATE POLICY activity_log_broadcast_read ON realtime.messages
        FOR SELECT TO authenticated
        USING (
          realtime.messages.extension = 'broadcast'
          AND public.user_can_read_activity_broadcast(realtime.topic())
        )
    $pol$;
  END IF;
END;
$$;
