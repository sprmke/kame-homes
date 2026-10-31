-- Activity log — booking-detail direct-write capture.
--
-- Booking-detail field edits (and live-stage autosave) are written straight to
-- `guest_submissions` by the admin SPA under an end-user JWT — no edge function,
-- so `_shared/activityLog.ts` never sees them. This trigger fills that one gap.
--
-- Plan:  docs/workflow/planned/org-activity-audit-log.md  (§ Direct-write surfaces)
-- Skill: audit-logging
--
-- Design:
--   * WHEN clause fires ONLY for `authenticated` / `anon` JWTs. Service-role
--     writes (edge functions, orchestrator, crons, import) are skipped — those
--     paths call `logActivity` themselves with full context. This makes the
--     trigger a near-zero no-op on the hot path.
--   * `status` and every workflow column are EXCLUDED — transitions are logged by
--     `WorkflowOrchestrator`. This trigger only records guest-facing detail edits.
--   * `changes` values are NOT stored here (avoids PII redaction in SQL); the
--     changed allow-listed field names go into `metadata.changed_fields`. Full
--     value diffs would come from a future `update-booking` edge function.

CREATE OR REPLACE FUNCTION public.activity_log_guest_submissions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_row            public.guest_submissions;
  v_org            uuid;
  v_claims         json;
  v_jwt_role       text;
  v_actor_sub      uuid;
  v_actor_email    text;
  v_actor_type     text;
  v_action         text;
  v_severity       text;
  v_changed        text[] := ARRAY[]::text[];
  v_field          text;
  v_old_j          jsonb;
  v_new_j          jsonb;
  v_allow          text[] := ARRAY[
    'primary_guest_name','guest_facebook_name','guest_email','guest_phone_number','guest_address',
    'check_in_date','check_out_date','check_in_time','check_out_time',
    'number_of_adults','number_of_children','number_of_nights',
    'tower_and_unit_number','unit_owner','nationality',
    'booking_rate','down_payment','balance','security_deposit','pet_fee',
    'guest_additional_fee','parking_rate_guest','parking_rate_paid',
    'has_pets','pet_name','pet_type','pet_breed','need_parking','car_plate_number',
    'guest_requests_surprise_decor',
    'valid_id_url','payment_receipt_url','pet_vaccination_url','parking_endorsement_url',
    'approved_gaf_pdf_url','approved_pet_pdf_url'
  ];
BEGIN
  v_row := COALESCE(NEW, OLD);

  -- Resolve the org root; without one there is nothing to scope the row to.
  IF v_row.property_id IS NOT NULL THEN
    SELECT organization_id INTO v_org FROM public.properties WHERE id = v_row.property_id;
  END IF;
  IF v_org IS NULL AND v_row.parking_id IS NOT NULL THEN
    SELECT organization_id INTO v_org FROM public.parkings WHERE id = v_row.parking_id;
  END IF;
  IF v_org IS NULL THEN
    v_org := v_row.parking_request_organization_id;
  END IF;
  IF v_org IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- Actor from the request JWT claims.
  v_claims := nullif(current_setting('request.jwt.claims', true), '')::json;
  v_jwt_role := coalesce(v_claims ->> 'role', '');
  BEGIN
    v_actor_sub := nullif(v_claims ->> 'sub', '')::uuid;
  EXCEPTION WHEN others THEN
    v_actor_sub := NULL;
  END;
  v_actor_email := v_claims ->> 'email';
  v_actor_type := CASE WHEN v_jwt_role = 'anon' THEN 'guest' ELSE 'team_member' END;

  -- Keep the row even if the JWT sub is not a resolvable auth user (edge case):
  -- drop the FK reference rather than lose the audit entry.
  IF v_actor_sub IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM auth.users WHERE id = v_actor_sub) THEN
    v_actor_sub := NULL;
  END IF;

  IF TG_OP = 'INSERT' THEN
    v_action := 'booking.created';
    v_severity := 'info';
  ELSIF TG_OP = 'DELETE' THEN
    v_action := 'booking.deleted';
    v_severity := 'destructive';
  ELSE
    -- UPDATE — collect changed allow-listed fields; skip if none (workflow-only write).
    v_old_j := to_jsonb(OLD);
    v_new_j := to_jsonb(NEW);
    FOREACH v_field IN ARRAY v_allow LOOP
      IF (v_new_j -> v_field) IS DISTINCT FROM (v_old_j -> v_field) THEN
        v_changed := array_append(v_changed, v_field);
      END IF;
    END LOOP;
    IF array_length(v_changed, 1) IS NULL THEN
      RETURN NEW;
    END IF;
    v_action := 'booking.details_edited';
    v_severity := 'info';
  END IF;

  INSERT INTO public.activity_log (
    organization_id, property_id, parking_id, scope,
    actor_type, actor_user_id, actor_email, actor_role,
    action, category, severity,
    target_type, target_id, target_label,
    summary, metadata, source
  ) VALUES (
    v_org,
    v_row.property_id,
    v_row.parking_id,
    CASE WHEN v_row.property_id IS NOT NULL THEN 'property'
         WHEN v_row.parking_id  IS NOT NULL THEN 'parking'
         ELSE 'org' END,
    v_actor_type,
    v_actor_sub,
    v_actor_email,
    'db_trigger',
    v_action,
    'booking',
    v_severity,
    'booking',
    v_row.id::text,
    NULLIF(
      trim(coalesce(v_row.primary_guest_name, v_row.guest_facebook_name, '')
        || CASE WHEN v_row.check_in_date IS NOT NULL THEN ' · ' || v_row.check_in_date ELSE '' END),
      ''
    ),
    coalesce(
      NULLIF(trim(coalesce(v_row.primary_guest_name, v_row.guest_facebook_name, '')), ''),
      'A guest'
    )
    || CASE
         WHEN TG_OP = 'INSERT' THEN ' submitted a booking'
         WHEN TG_OP = 'DELETE' THEN ' — booking deleted'
         ELSE ' edited a booking (' || array_length(v_changed, 1)::text || ' field'
              || CASE WHEN array_length(v_changed, 1) = 1 THEN '' ELSE 's' END || ')'
       END,
    jsonb_build_object(
      'via', 'db_trigger',
      'op', TG_OP,
      'changed_fields', to_jsonb(v_changed)
    ),
    'db_trigger'
  );

  RETURN COALESCE(NEW, OLD);
EXCEPTION WHEN others THEN
  -- Never let an audit-write hiccup roll back a guest / admin booking write.
  RAISE WARNING 'activity_log_guest_submissions failed: %', sqlerrm;
  RETURN COALESCE(NEW, OLD);
END;
$fn$;

COMMENT ON FUNCTION public.activity_log_guest_submissions() IS
  'AFTER INSERT/UPDATE/DELETE on guest_submissions under an end-user JWT → one '
  'activity_log row (booking.created / booking.details_edited / booking.deleted). '
  'Service-role writes are skipped by the trigger WHEN clause.';

REVOKE ALL ON FUNCTION public.activity_log_guest_submissions() FROM PUBLIC;

DROP TRIGGER IF EXISTS trg_activity_log_guest_submissions ON public.guest_submissions;
CREATE TRIGGER trg_activity_log_guest_submissions
  AFTER INSERT OR UPDATE OR DELETE ON public.guest_submissions
  FOR EACH ROW
  WHEN (
    coalesce(
      nullif(current_setting('request.jwt.claims', true), '')::json ->> 'role',
      ''
    ) IN ('authenticated', 'anon')
  )
  EXECUTE FUNCTION public.activity_log_guest_submissions();
