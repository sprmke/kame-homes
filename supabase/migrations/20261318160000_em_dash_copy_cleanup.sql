-- Copy cleanup: remove em dashes from copy stored in the database.
--
-- The app, email templates and route guides no longer use em dashes (see
-- .cursor/rules/human-copy.mdc). This brings rows seeded before that pass in
-- line without overwriting copy a host has already edited: every update below
-- matches the exact shipped text before rewriting it.
--
-- Sources:
--   host_playbook_articles       20261308120000_host_analytics_foundation.sql
--   telegram_admin_settings      20260702120000_telegram_admin_settings.sql
--   social_reply_templates       _shared/inboxDefaultQuickReplies.ts (seeded per org)
--   activity_log trigger         20261306150100_activity_log_guest_submissions_trigger.sql

-- ─── Analytics playbook articles (Analytics → Playbook) ─────────────────────

UPDATE public.host_playbook_articles
SET body_md = 'A thoughtful reply to a review, especially a critical one, signals to future guests that you''re an attentive host. It also gives you the last word on the listing page.'
WHERE slug = 'reply-to-every-review'
  AND body_md = 'A thoughtful reply to a review — especially a critical one — signals to future guests that you''re an attentive host. It also gives you the last word on the listing page.';

UPDATE public.host_playbook_articles
SET body_md = 'Your response time is in a strong range right now. Keep the habits that got you there (notifications on, Quick Replies set up for common questions) so it doesn''t slip.'
WHERE slug = 'keep-response-streak-going'
  AND body_md = 'Your response time is in a strong range right now — keep the habits that got you there (notifications on, Quick Replies set up for common questions) so it doesn''t slip.';

-- ─── Telegram admin default template (sent to hosts) ────────────────────────

UPDATE public.telegram_admin_settings
SET pending_docs_template = E'⚠️ Pending Documents - Check-in Today\n\nGuest: {{primary_guest_name}}\nCheck-in: {{check_in_date}} at {{check_in_time}}\nStill needed: {{pending_docs_list}}\nStatus: {{status_label}}\n\n{{booking_link}}'
WHERE id = 1
  AND pending_docs_template = E'⚠️ Pending Documents — Check-in Today\n\nGuest: {{primary_guest_name}}\nCheck-in: {{check_in_date}} at {{check_in_time}}\nStill needed: {{pending_docs_list}}\nStatus: {{status_label}}\n\n{{booking_link}}';

-- ─── Guest Inbox quick replies already seeded per organization ──────────────

UPDATE public.social_reply_templates
SET body_text = 'You can check our available dates here: {{calendar_link}}. Let me know your preferred check-in and check-out and I’ll confirm for you.'
WHERE title = 'Availability'
  AND body_text = 'You can check our available dates here: {{calendar_link}} — let me know your preferred check-in and check-out and I’ll confirm for you.';

UPDATE public.social_reply_templates
SET body_text = 'Check-in is from 2:00 PM and check-out is by 12:00 PM (Asia/Manila). Early check-in may be possible if the unit is ready. Just ask.'
WHERE title = 'Check-in'
  AND body_text = 'Check-in is from 2:00 PM and check-out is by 12:00 PM (Asia/Manila). Early check-in may be possible if the unit is ready — just ask.';

UPDATE public.social_reply_templates
SET body_text = 'We’re in Azure North, San Fernando, Pampanga. Map pin: {{map_link}}. I can send the exact unit address once your dates are confirmed.'
WHERE title = 'Location'
  AND body_text = 'We’re in Azure North, San Fernando, Pampanga. Map pin: {{map_link}} — I can send the exact unit address once your dates are confirmed.';

UPDATE public.social_reply_templates
SET body_text = 'Thanks for reaching out, {{guest_name}}! Let me know if you have any other questions. Happy to help with your stay.'
WHERE title = 'Follow-up'
  AND body_text = 'Thanks for reaching out, {{guest_name}}! Let me know if you have any other questions — happy to help with your stay.';

-- ─── Activity log summary written by the guest_submissions trigger ──────────

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
         WHEN TG_OP = 'DELETE' THEN ' - booking deleted'
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

REVOKE ALL ON FUNCTION public.activity_log_guest_submissions() FROM PUBLIC;
