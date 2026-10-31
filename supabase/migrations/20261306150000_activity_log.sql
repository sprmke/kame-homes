-- Org Activity & Audit Log — one append-only timeline of every meaningful action
-- taken across an organization (team members, org owner, super-admins acting on
-- the org, the AI dashboard assistant, guests on public pages, crons, webhooks),
-- surfaced at org / property / parking scope.
--
-- Plan:   docs/workflow/planned/org-activity-audit-log.md
-- Writer: supabase/functions/_shared/activityLog.ts (fire-and-forget, never throws)
-- Read:   list-activity-log / activity-log-export (serveAuthenticated + verifyOrgAccess)
--
-- Modeled on super_admin_audit_events (20261305130000): no RLS read path, loose
-- references (an audit trail must survive parent deletes), single-INSERT writes.
-- Differences: composite PK (id, created_at) so Phase-6 declarative monthly
-- partitioning on created_at needs no table rewrite; append-only enforced by a
-- BEFORE UPDATE OR DELETE trigger that blocks service_role too.

CREATE TABLE IF NOT EXISTS public.activity_log (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Scope — every row belongs to exactly one org (the query root); property_id /
  -- parking_id narrow it. NO foreign keys: history is retained (orphaned but
  -- intact) after an org / property / parking is deleted, until retention ages it out.
  organization_id UUID NOT NULL,
  property_id UUID,
  parking_id UUID,
  scope TEXT NOT NULL CHECK (scope IN ('org', 'property', 'parking')),

  -- Actor — snapshot of who acted, resolved at write time by buildActorContext().
  actor_type TEXT NOT NULL CHECK (
    actor_type IN (
      'org_owner', 'team_member', 'super_admin', 'ai_assistant',
      'guest', 'public', 'system', 'cron', 'webhook', 'integration', 'email_inbound'
    )
  ),
  actor_user_id UUID REFERENCES auth.users (id) ON DELETE SET NULL,
  actor_email TEXT,
  actor_display_name TEXT,
  actor_role TEXT,
  actor_member_id UUID,

  -- Event
  action TEXT NOT NULL,
  category TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'info'
    CHECK (severity IN ('info', 'notice', 'warning', 'destructive')),

  -- Target
  target_type TEXT,
  target_id TEXT,
  target_label TEXT,

  -- Human + structured payload
  summary TEXT NOT NULL,
  changes JSONB,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- Request context
  request_id TEXT,
  ip_prefix TEXT,
  user_agent TEXT,
  source TEXT NOT NULL DEFAULT 'dashboard'
    CHECK (
      source IN (
        'dashboard', 'public_form', 'ai_assistant', 'cron',
        'webhook', 'telegram', 'email_inbound', 'db_trigger'
      )
    ),

  PRIMARY KEY (id, created_at),

  -- Scope/target coherence — a scoped row must carry its scoping id.
  CONSTRAINT activity_log_scope_target_chk CHECK (
    (scope = 'property' AND property_id IS NOT NULL)
    OR (scope = 'parking' AND parking_id IS NOT NULL)
    OR (scope = 'org')
  ),

  -- Backstop against pathological payloads (the TS writer caps changes at ~8 KB
  -- and sets metadata.truncated). Generous so a real mutation is never rejected.
  CONSTRAINT activity_log_changes_size_chk CHECK (
    changes IS NULL OR pg_column_size(changes) <= 262144
  ),
  CONSTRAINT activity_log_metadata_size_chk CHECK (
    pg_column_size(metadata) <= 262144
  )
);

-- ── Indexes — sized to the real filter combinations, id in the sort key for a
--    clean keyset cursor. No speculative indexes. ──────────────────────────────

CREATE INDEX IF NOT EXISTS idx_activity_log_org_feed
  ON public.activity_log (organization_id, created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_activity_log_property_feed
  ON public.activity_log (organization_id, property_id, created_at DESC, id DESC)
  WHERE property_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_activity_log_parking_feed
  ON public.activity_log (organization_id, parking_id, created_at DESC, id DESC)
  WHERE parking_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_activity_log_category
  ON public.activity_log (organization_id, category, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_activity_log_actor
  ON public.activity_log (organization_id, actor_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_activity_log_target
  ON public.activity_log (organization_id, target_type, target_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_activity_log_destructive
  ON public.activity_log (organization_id, created_at DESC)
  WHERE severity = 'destructive';

CREATE INDEX IF NOT EXISTS idx_activity_log_created_brin
  ON public.activity_log USING BRIN (created_at);

COMMENT ON TABLE public.activity_log IS
  'Append-only org activity / audit timeline. Written fire-and-forget by '
  '_shared/activityLog.ts; read only via list-activity-log / activity-log-export. '
  'No RLS read path. Loose references (no FKs) so history survives parent deletes.';
COMMENT ON COLUMN public.activity_log.changes IS
  'Redacted field-level diff [{ field, from, to }], size-capped at write.';
COMMENT ON COLUMN public.activity_log.ip_prefix IS
  'Client IP truncated to /24 (v4) or /48 (v6) — never the full address.';
COMMENT ON COLUMN public.activity_log.metadata IS
  'Structured extras (amounts, counts, ids, related_event_ref, assistant_conversation_id).';

-- ── Append-only enforcement — blocks service_role too, so a stray edge-function
--    bug can never rewrite history. Only the retention job (Phase 6) opts out by
--    setting activity_log.allow_purge = 'on' in its own transaction. ───────────

CREATE OR REPLACE FUNCTION public.activity_log_block_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $fn$
BEGIN
  IF current_setting('activity_log.allow_purge', true) = 'on' AND TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION 'activity_log is append-only (attempted %)', TG_OP
    USING ERRCODE = 'restrict_violation';
END;
$fn$;

COMMENT ON FUNCTION public.activity_log_block_mutation() IS
  'Rejects UPDATE / DELETE on activity_log. DELETE is allowed only when '
  'activity_log.allow_purge = ''on'' (set by the retention job).';

REVOKE ALL ON FUNCTION public.activity_log_block_mutation() FROM PUBLIC;

DROP TRIGGER IF EXISTS trg_activity_log_append_only ON public.activity_log;
CREATE TRIGGER trg_activity_log_append_only
  BEFORE UPDATE OR DELETE ON public.activity_log
  FOR EACH ROW EXECUTE FUNCTION public.activity_log_block_mutation();

-- ── Access — edge-function only, exactly like super_admin_audit_events. ───────

ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.activity_log TO service_role;
-- No RLS read policy: reads go through list-activity-log (service-role client
-- behind verifyOrgAccess + org.activity:view).
