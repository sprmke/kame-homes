-- AI companion conversation-QA seed (Phase 0).
-- Target: org `kame-home` / property `monaco-2612` (owner sprmke.dev@gmail.com).
-- Safe to re-run: deletes prior rows tagged booking_source/created_by/external_thread_id
-- with the `ai_qa_seed` prefix.
-- Complements existing demo_seed bookings so the assistant has every status, overdue
-- maintenance, pending inbox threads, holiday rates, a blocked range, and extra finance.

DO $$
DECLARE
  v_org_id UUID;
  v_prop_id UUID;
  v_owner_id UUID;
  v_web_connection UUID;
  v_receipt TEXT := 'https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=800&q=80';
  v_id TEXT := 'https://images.unsplash.com/photo-1589829085413-56de8ae18c73?w=800&q=80';
  v_gaf TEXT := 'https://files.example.test/bookings/ai-qa/approved-gaf.pdf';
  v_today DATE := (now() AT TIME ZONE 'Asia/Manila')::date;
BEGIN
  SELECT id, owner_id INTO v_org_id, v_owner_id
    FROM public.organizations WHERE slug = 'kame-home' LIMIT 1;
  SELECT id INTO v_prop_id
    FROM public.properties WHERE slug = 'monaco-2612' AND organization_id = v_org_id LIMIT 1;
  SELECT id INTO v_web_connection
    FROM public.social_channel_connections
    WHERE organization_id = v_org_id AND platform = 'web' LIMIT 1;

  IF v_org_id IS NULL OR v_prop_id IS NULL THEN
    RAISE NOTICE 'seed-ai-qa: kame-home / monaco-2612 not found — skipped';
    RETURN;
  END IF;

  -- ── Cleanup prior seed ────────────────────────────────────────────────────
  DELETE FROM public.guest_submissions WHERE booking_source = 'ai_qa_seed';
  DELETE FROM public.finance_line_items WHERE created_by = 'ai_qa_seed';
  DELETE FROM public.maintenance_items WHERE created_by = 'ai_qa_seed';
  DELETE FROM public.social_messages
    WHERE conversation_id IN (
      SELECT id FROM public.social_conversations
      WHERE organization_id = v_org_id AND external_thread_id LIKE 'ai_qa_seed:%'
    );
  DELETE FROM public.social_conversations
    WHERE organization_id = v_org_id AND external_thread_id LIKE 'ai_qa_seed:%';
  DELETE FROM public.property_pricing_date_overrides
    WHERE property_id = v_prop_id
      AND pricing_date IN (DATE '2026-12-24', DATE '2026-12-25', DATE '2026-12-31');
  DELETE FROM public.property_blocked_dates
    WHERE property_id = v_prop_id AND note = 'ai_qa_seed';

  -- ── Kill switches + AI mode on for the property owner ─────────────────────
  UPDATE public.ai_dashboard_assistant_global_settings
    SET enabled = true, ai_mode_enabled = true, updated_at = now()
    WHERE id = true;
  INSERT INTO public.ai_dashboard_assistant_org_settings (
    organization_id, enabled, disabled_property_ids,
    daily_message_limit, monthly_message_limit, updated_by, updated_at
  ) VALUES (v_org_id, true, '{}', 500, 10000, v_owner_id, now())
  ON CONFLICT (organization_id) DO UPDATE
    SET enabled = true,
        daily_message_limit = 500,
        monthly_message_limit = 10000,
        updated_at = now();
  DELETE FROM public.ai_dashboard_assistant_usage_daily
    WHERE organization_id = v_org_id;
  INSERT INTO public.user_ui_preferences (user_id, dashboard_mode, updated_at)
  VALUES (v_owner_id, 'ai', now())
  ON CONFLICT (user_id) DO UPDATE SET dashboard_mode = 'ai', updated_at = now();
  -- Local "Pro" is the Growth catalog row (`aiDashboardAssistant` / `aiReceptionist` are off
  -- until Business). QA needs AI mode and the voice booth, so lift those flags on this org only.
  UPDATE public.org_subscriptions
    SET feature_overrides = coalesce(feature_overrides, '{}'::jsonb)
      || jsonb_build_object(
        'aiDashboardAssistant', true,
        'aiChatAutoReply', true,
        'aiReceptionist', true
      )
    WHERE organization_id = v_org_id;
  INSERT INTO public.social_inbox_settings (
    organization_id, auto_reply_enabled, auto_reply_mode, platform_toggles
  )
  SELECT v_org_id, true, 'send', '{"web": true}'::jsonb
  WHERE NOT EXISTS (
    SELECT 1 FROM public.social_inbox_settings
    WHERE organization_id = v_org_id AND parking_id IS NULL
  );
  UPDATE public.social_inbox_settings
    SET auto_reply_enabled = true,
        auto_reply_mode = 'send',
        platform_toggles = coalesce(platform_toggles, '{}'::jsonb) || '{"web": true}'::jsonb
    WHERE organization_id = v_org_id AND parking_id IS NULL;
  -- Empty allowed_features = every feature. A non-empty list is exclusive; local is often
  -- {voice_receptionist,dashboard_assistant} after the voice backfill, which blocks guest
  -- auto-reply (inbox_auto_reply) and host Suggest (inbox_suggest).
  UPDATE public.ai_platform_global_settings
    SET enabled = true,
        allowed_features = ARRAY(
          SELECT DISTINCT f
          FROM unnest(
            COALESCE(allowed_features, '{}'::text[])
            || ARRAY['inbox_suggest', 'inbox_auto_reply']::text[]
          ) AS f
        )
    WHERE id = 1
      AND cardinality(COALESCE(allowed_features, '{}'::text[])) > 0;
  UPDATE public.ai_platform_global_settings
    SET default_daily_call_limit = GREATEST(coalesce(default_daily_call_limit, 200), 2000),
        default_monthly_call_limit = GREATEST(coalesce(default_monthly_call_limit, 5000), 20000)
    WHERE id = 1;
  INSERT INTO public.ai_platform_org_settings (
    organization_id, enabled, daily_call_limit, monthly_call_limit,
    daily_credit_limit, monthly_credit_limit, plan_credit_allowance, updated_at
  ) VALUES (v_org_id, true, 2000, 20000, 100000, 1000000, 1000000, now())
  ON CONFLICT (organization_id) DO UPDATE
    SET enabled = true,
        daily_call_limit = 2000,
        monthly_call_limit = 20000,
        daily_credit_limit = 100000,
        monthly_credit_limit = 1000000,
        plan_credit_allowance = 1000000,
        updated_at = now();
  UPDATE public.ai_platform_global_settings
    SET default_daily_call_limit = GREATEST(coalesce(default_daily_call_limit, 0), 2000),
        default_monthly_call_limit = GREATEST(coalesce(default_monthly_call_limit, 0), 20000),
        default_daily_credit_limit = GREATEST(coalesce(default_daily_credit_limit, 0), 100000),
        default_monthly_credit_limit = GREATEST(coalesce(default_monthly_credit_limit, 0), 1000000)
    WHERE id = 1;
  UPDATE public.ai_platform_org_settings
    SET daily_call_limit = 2000,
        monthly_call_limit = 20000,
        daily_credit_limit = 100000,
        monthly_credit_limit = 1000000,
        plan_credit_allowance = 1000000
    WHERE organization_id = v_org_id;
  DELETE FROM public.ai_platform_usage_daily
    WHERE organization_id = v_org_id;
  DELETE FROM public.ai_platform_property_usage_daily
    WHERE organization_id = v_org_id;
  INSERT INTO public.ai_platform_org_credit_wallet (organization_id, balance_credits)
  VALUES (v_org_id, 1000000)
  ON CONFLICT (organization_id) DO UPDATE SET balance_credits = 1000000;

  -- Voice booth QA (local). Prod rollout stays 0 until canary.
  UPDATE public.ai_platform_global_settings
    SET enabled = true,
        voice_receptionist_rollout_percentage = 100,
        voice_receptionist_health_status = 'unknown',
        voice_receptionist_health_checked_at = NULL,
        allowed_features = CASE
          WHEN cardinality(COALESCE(allowed_features, '{}'::text[])) = 0 THEN allowed_features
          ELSE ARRAY(
            SELECT DISTINCT f
            FROM unnest(COALESCE(allowed_features, '{}'::text[]) || ARRAY['voice_receptionist']::text[]) AS f
          )
        END
    WHERE id = 1;
  INSERT INTO public.ai_voice_receptionist_org_settings (
    organization_id, enabled, voice_id, disabled_property_ids, updated_at
  ) VALUES (v_org_id, true, 'Kore', '{}'::uuid[], now())
  ON CONFLICT (organization_id) DO UPDATE
    SET enabled = true,
        disabled_property_ids = ARRAY[]::uuid[],
        updated_at = now();
  INSERT INTO public.ai_platform_property_settings (
    property_id, organization_id, feature_configs, updated_at
  ) VALUES (
    v_prop_id,
    v_org_id,
    jsonb_build_object(
      'voice_receptionist', jsonb_build_object(
        'max_session_seconds', 540,
        'max_sessions_per_guest_per_day', 80,
        'max_concurrent_sessions', 4
      )
    ),
    now()
  )
  ON CONFLICT (property_id) DO UPDATE
    SET feature_configs = coalesce(public.ai_platform_property_settings.feature_configs, '{}'::jsonb)
      || jsonb_build_object(
        'voice_receptionist',
        coalesce(public.ai_platform_property_settings.feature_configs -> 'voice_receptionist', '{}'::jsonb)
          || jsonb_build_object(
            'max_session_seconds', 540,
            'max_sessions_per_guest_per_day', 80,
            'max_concurrent_sessions', 4
          )
      ),
        updated_at = now();

  -- ── Bookings covering every live status ───────────────────────────────────
  INSERT INTO public.guest_submissions (
    id, property_id, status, booking_source,
    guest_facebook_name, primary_guest_name, guest_email, guest_phone_number, guest_address,
    check_in_date, check_out_date, check_in_time, check_out_time,
    nationality, number_of_adults, number_of_children, number_of_nights,
    guest_special_requests, find_us,
    payment_receipt_url, valid_id_url, approved_gaf_pdf_url,
    unit_owner, tower_and_unit_number, owner_onsite_contact_person, owner_contact_number,
    booking_rate, down_payment, balance, security_deposit, guest_balance_paid_amount,
    status_updated_at, created_at, updated_at
  ) VALUES
    -- PENDING_REVIEW, checking in tomorrow
    (
      'a1a10001-0000-4000-8000-000000000001', v_prop_id, 'PENDING_REVIEW', 'ai_qa_seed',
      'Ana Reyes', 'Ana Reyes', 'ana.reyes.aiqa@example.test', '09171110001', 'Makati',
      to_char(v_today + 1, 'MM-DD-YYYY'), to_char(v_today + 4, 'MM-DD-YYYY'),
      '14:00', '11:00', 'Filipino', 2, 0, 3, 'Late check-in around 8pm', 'Direct',
      v_receipt, v_id, NULL,
      'Michael Manlulu', 'Monaco 2612', 'Michael D Manlulu', '09625647541',
      9600, 1500, 8100, 2000, 1500,
      now(), now() - interval '2 hours', now()
    ),
    -- PENDING_DOCUMENTS, checking in 2 days
    (
      'a1a10001-0000-4000-8000-000000000002', v_prop_id, 'PENDING_DOCUMENTS', 'ai_qa_seed',
      'Juan dela Cruz', 'Juan dela Cruz', 'juan.dc.aiqa@example.test', '09171110002', 'Quezon City',
      to_char(v_today + 2, 'MM-DD-YYYY'), to_char(v_today + 5, 'MM-DD-YYYY'),
      '14:00', '11:00', 'Filipino', 2, 1, 3, 'Early check-in if possible', 'Facebook',
      v_receipt, v_id, NULL,
      'Michael Manlulu', 'Monaco 2612', 'Michael D Manlulu', '09625647541',
      9600, 1500, 8100, 2000, 1500,
      now(), now() - interval '1 day', now()
    ),
    -- READY_FOR_CHECKIN today, unpaid remaining balance
    (
      'a1a10001-0000-4000-8000-000000000003', v_prop_id, 'READY_FOR_CHECKIN', 'ai_qa_seed',
      'Maria Santos', 'Maria Santos', 'maria.santos.aiqa@example.test', '09171110003', 'Cebu City',
      to_char(v_today, 'MM-DD-YYYY'), to_char(v_today + 2, 'MM-DD-YYYY'),
      '14:00', '11:00', 'Filipino', 2, 0, 2, 'Surprise decor for anniversary', 'Direct',
      v_receipt, v_id, v_gaf,
      'Michael Manlulu', 'Monaco 2612', 'Michael D Manlulu', '09625647541',
      6400, 1500, 4900, 2000, 1500,
      now(), now() - interval '5 days', now()
    ),
    -- READY_FOR_CHECKOUT tomorrow
    (
      'a1a10001-0000-4000-8000-000000000004', v_prop_id, 'READY_FOR_CHECKOUT', 'ai_qa_seed',
      'Grace Tan', 'Grace Tan', 'grace.tan.aiqa@example.test', '09171110004', 'Davao',
      to_char(v_today - 2, 'MM-DD-YYYY'), to_char(v_today + 1, 'MM-DD-YYYY'),
      '14:00', '11:00', 'Filipino', 1, 0, 3, NULL, 'Airbnb',
      v_receipt, v_id, v_gaf,
      'Michael Manlulu', 'Monaco 2612', 'Michael D Manlulu', '09625647541',
      9600, 1500, 0, 2000, 8100,
      now(), now() - interval '8 days', now()
    ),
    -- PENDING_SD_REFUND, checked out yesterday
    (
      'a1a10001-0000-4000-8000-000000000005', v_prop_id, 'PENDING_SD_REFUND', 'ai_qa_seed',
      'Leo Cruz', 'Leo Cruz', 'leo.cruz.aiqa@example.test', '09171110005', 'Pasig',
      to_char(v_today - 4, 'MM-DD-YYYY'), to_char(v_today - 1, 'MM-DD-YYYY'),
      '14:00', '11:00', 'Filipino', 2, 0, 3, NULL, 'Direct',
      v_receipt, v_id, v_gaf,
      'Michael Manlulu', 'Monaco 2612', 'Michael D Manlulu', '09625647541',
      9600, 1500, 0, 2000, 8100,
      now(), now() - interval '10 days', now()
    ),
    -- COMPLETED last week
    (
      'a1a10001-0000-4000-8000-000000000006', v_prop_id, 'COMPLETED', 'ai_qa_seed',
      'Pedro Lim', 'Pedro Lim', 'pedro.lim.aiqa@example.test', '09171110006', 'Taguig',
      to_char(v_today - 12, 'MM-DD-YYYY'), to_char(v_today - 9, 'MM-DD-YYYY'),
      '14:00', '11:00', 'Filipino', 3, 1, 3, NULL, 'Direct',
      v_receipt, v_id, v_gaf,
      'Michael Manlulu', 'Monaco 2612', 'Michael D Manlulu', '09625647541',
      9600, 1500, 0, 2000, 8100,
      now() - interval '8 days', now() - interval '20 days', now()
    ),
    -- CANCELLED
    (
      'a1a10001-0000-4000-8000-000000000007', v_prop_id, 'CANCELLED', 'ai_qa_seed',
      'Liza Cruz', 'Liza Cruz', 'liza.cruz.aiqa@example.test', '09171110007', 'Mandaluyong',
      to_char(v_today + 10, 'MM-DD-YYYY'), to_char(v_today + 13, 'MM-DD-YYYY'),
      '14:00', '11:00', 'Filipino', 2, 0, 3, NULL, 'Direct',
      v_receipt, v_id, NULL,
      'Michael Manlulu', 'Monaco 2612', 'Michael D Manlulu', '09625647541',
      9600, 1500, 8100, 2000, 0,
      now() - interval '1 day', now() - interval '3 days', now()
    ),
    -- COMPLETED earlier this year so occupancy trend is not a flat zero
    (
      'a1a10001-0000-4000-8000-000000000008', v_prop_id, 'COMPLETED', 'ai_qa_seed',
      'Nina Park', 'Nina Park', 'nina.park.aiqa@example.test', '09171110008', 'Makati',
      '05-12-2026', '05-16-2026',
      '14:00', '11:00', 'Filipino', 2, 0, 4, NULL, 'Airbnb',
      v_receipt, v_id, v_gaf,
      'Michael Manlulu', 'Monaco 2612', 'Michael D Manlulu', '09625647541',
      12800, 1500, 0, 2000, 11300,
      TIMESTAMP '2026-05-20', TIMESTAMP '2026-05-01', now()
    ),
    (
      'a1a10001-0000-4000-8000-000000000009', v_prop_id, 'COMPLETED', 'ai_qa_seed',
      'Omar Diaz', 'Omar Diaz', 'omar.diaz.aiqa@example.test', '09171110009', 'Cebu City',
      '07-08-2026', '07-11-2026',
      '14:00', '11:00', 'Filipino', 2, 1, 3, NULL, 'Direct',
      v_receipt, v_id, v_gaf,
      'Michael Manlulu', 'Monaco 2612', 'Michael D Manlulu', '09625647541',
      9600, 1500, 0, 2000, 8100,
      TIMESTAMP '2026-07-15', TIMESTAMP '2026-06-20', now()
    ),
    (
      'a1a10001-0000-4000-8000-000000000010', v_prop_id, 'COMPLETED', 'ai_qa_seed',
      'Pia Gomez', 'Pia Gomez', 'pia.gomez.aiqa@example.test', '09171110010', 'Quezon City',
      '09-18-2026', '09-22-2026',
      '14:00', '11:00', 'Filipino', 2, 0, 4, NULL, 'Booking.com',
      v_receipt, v_id, v_gaf,
      'Michael Manlulu', 'Monaco 2612', 'Michael D Manlulu', '09625647541',
      12800, 1500, 0, 2000, 11300,
      TIMESTAMP '2026-09-25', TIMESTAMP '2026-09-01', now()
    );

  -- ── Overdue + upcoming maintenance ────────────────────────────────────────
  INSERT INTO public.maintenance_items (
    id, property_id, label, category, scheduled_on, notes, completed_at, created_by, created_at, updated_at
  ) VALUES
    (
      'a1a10002-0000-4000-8000-000000000001', v_prop_id,
      'AC not cooling in unit 12A', 'repair', v_today - 4,
      'Guest reported on check-in.', NULL, 'ai_qa_seed', now(), now()
    ),
    (
      'a1a10002-0000-4000-8000-000000000002', v_prop_id,
      'Leaking faucet', 'repair', v_today - 7,
      NULL, NULL, 'ai_qa_seed', now(), now()
    ),
    (
      'a1a10002-0000-4000-8000-000000000003', v_prop_id,
      'Deep clean after checkout', 'cleaning', v_today + 1,
      NULL, NULL, 'ai_qa_seed', now(), now()
    ),
    (
      'a1a10002-0000-4000-8000-000000000004', v_prop_id,
      'Replace hallway bulbs', 'repair', v_today - 20,
      NULL, now() - interval '18 days', 'ai_qa_seed', now() - interval '21 days', now()
    );

  -- ── Three months of operating expenses so finance charts have a trend ─────
  INSERT INTO public.finance_line_items (
    id, property_id, kind, label, amount, category, occurred_on, notes, created_by, created_at, updated_at
  ) VALUES
    ('a1a10003-0000-4000-8000-000000000001', v_prop_id, 'expense', 'August cleaning', 6000, 'cleaning', DATE '2026-08-15', NULL, 'ai_qa_seed', now(), now()),
    ('a1a10003-0000-4000-8000-000000000002', v_prop_id, 'expense', 'August utilities', 4300, 'utilities', DATE '2026-08-28', NULL, 'ai_qa_seed', now(), now()),
    ('a1a10003-0000-4000-8000-000000000003', v_prop_id, 'expense', 'September cleaning', 6200, 'cleaning', DATE '2026-09-15', NULL, 'ai_qa_seed', now(), now()),
    ('a1a10003-0000-4000-8000-000000000004', v_prop_id, 'expense', 'September utilities', 4100, 'utilities', DATE '2026-09-28', NULL, 'ai_qa_seed', now(), now()),
    ('a1a10003-0000-4000-8000-000000000005', v_prop_id, 'expense', 'October cleaning', 6400, 'cleaning', DATE '2026-10-15', NULL, 'ai_qa_seed', now(), now()),
    ('a1a10003-0000-4000-8000-000000000006', v_prop_id, 'expense', 'October utilities', 3900, 'utilities', DATE '2026-10-18', NULL, 'ai_qa_seed', now(), now()),
    ('a1a10003-0000-4000-8000-000000000007', v_prop_id, 'income', 'October extra parking', 900, 'parking', DATE '2026-10-10', NULL, 'ai_qa_seed', now(), now());

  -- ── Holiday overrides + a blocked range (end_date is exclusive) ────────────
  INSERT INTO public.property_pricing_date_overrides (property_id, pricing_date, nightly_rate)
  VALUES
    (v_prop_id, DATE '2026-12-24', 5500),
    (v_prop_id, DATE '2026-12-25', 5500),
    (v_prop_id, DATE '2026-12-31', 6500)
  ON CONFLICT (property_id, pricing_date) DO UPDATE SET nightly_rate = EXCLUDED.nightly_rate;

  INSERT INTO public.property_blocked_dates (
    property_id, start_date, end_date, note, source, created_by
  ) VALUES (
    v_prop_id, DATE '2026-12-27', DATE '2026-12-29', 'ai_qa_seed', 'manual', v_owner_id
  );

  -- ── Pending inbox threads (need a web connection) ─────────────────────────
  IF v_web_connection IS NOT NULL THEN
    INSERT INTO public.social_conversations (
      id, organization_id, property_id, connection_id, platform, conversation_type,
      external_thread_id, participant_name, subject_preview,
      last_message_at, last_inbound_at, unread_count, reply_status
    ) VALUES
      (
        'a1a10004-0000-4000-8000-000000000001', v_org_id, v_prop_id, v_web_connection,
        'web', 'dm', 'ai_qa_seed:juan', 'Juan dela Cruz',
        'Can I check in early on Dec 21?',
        now() - interval '40 minutes', now() - interval '40 minutes', 2, 'pending'
      ),
      (
        'a1a10004-0000-4000-8000-000000000002', v_org_id, v_prop_id, v_web_connection,
        'web', 'dm', 'ai_qa_seed:grace', 'Grace Tan',
        'Do you allow pets?',
        now() - interval '18 hours', now() - interval '18 hours', 1, 'pending'
      ),
      (
        'a1a10004-0000-4000-8000-000000000003', v_org_id, v_prop_id, v_web_connection,
        'web', 'dm', 'ai_qa_seed:ana', 'Ana Reyes',
        'What time is check-in?',
        now() - interval '2 days', now() - interval '2 days', 1, 'pending'
      );

    INSERT INTO public.social_messages (
      organization_id, conversation_id, direction, external_message_id, body_text,
      attachments, sent_at, is_ai_generated, source_mode
    ) VALUES
      (
        v_org_id, 'a1a10004-0000-4000-8000-000000000001', 'inbound',
        'ai_qa_seed:juan:1', 'Hi, can I check in early on Dec 21, around 11am?',
        '[]'::jsonb, now() - interval '40 minutes', false, 'text'
      ),
      (
        v_org_id, 'a1a10004-0000-4000-8000-000000000002', 'inbound',
        'ai_qa_seed:grace:1', 'Do you allow pets? We have a small dog.',
        '[]'::jsonb, now() - interval '18 hours', false, 'text'
      ),
      (
        v_org_id, 'a1a10004-0000-4000-8000-000000000003', 'inbound',
        'ai_qa_seed:ana:1', 'What time is check-in tomorrow?',
        '[]'::jsonb, now() - interval '2 days', false, 'text'
      );
  ELSE
    RAISE NOTICE 'seed-ai-qa: no web social_channel_connection — skipped inbox threads';
  END IF;

  RAISE NOTICE 'seed-ai-qa: seeded monaco-2612 for org kame-home';
END $$;
