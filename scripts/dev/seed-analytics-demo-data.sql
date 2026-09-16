-- Analytics QA fixture — rich bookings + page views + a mock AI Performance Review.
-- Target property (first match): monaco-2612 → azure-north-2br → kame-home.
-- Safe to re-run: deletes prior fixture rows for that property (*.analytics@example.com)
-- and demo reviews (model = 'analytics-demo').
-- Apply: bun run seed:analytics-demo

DO $$
DECLARE
  v_prop_id UUID;
  v_prop_slug TEXT;
  v_org_id UUID;
  v_org_slug TEXT;
  v_unit_label TEXT := 'Monaco 2612';
  v_receipt TEXT := 'https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=800&q=80';
  v_id TEXT := 'https://images.unsplash.com/photo-1589829085413-56de8ae18c73?w=800&q=80';
  v_pricing_link TEXT;
  v_bookings_link TEXT;
BEGIN
  SELECT p.id, p.slug, p.organization_id, o.slug
  INTO v_prop_id, v_prop_slug, v_org_id, v_org_slug
  FROM public.properties p
  JOIN public.organizations o ON o.id = p.organization_id
  WHERE p.slug IN ('monaco-2612', 'azure-north-2br', 'kame-home')
  ORDER BY CASE p.slug
    WHEN 'monaco-2612' THEN 1
    WHEN 'azure-north-2br' THEN 2
    WHEN 'kame-home' THEN 3
  END
  LIMIT 1;

  IF v_prop_id IS NULL THEN
    RAISE NOTICE 'seed-analytics-demo-data: no target property found — skipped';
    RETURN;
  END IF;

  IF v_prop_slug = 'kame-home' THEN
    v_unit_label := 'Monaco 2604';
  ELSIF v_prop_slug = 'azure-north-2br' THEN
    v_unit_label := 'Azure North 2BR';
  END IF;

  v_pricing_link := format('/org/%s/property/%s/pricing', v_org_slug, v_prop_slug);
  v_bookings_link := format('/org/%s/property/%s/bookings', v_org_slug, v_prop_slug);

  DELETE FROM public.property_page_views
  WHERE property_id = v_prop_id
    AND session_id LIKE 'analytics-demo-%';

  DELETE FROM public.guest_submissions
  WHERE id::text LIKE 'a4444444-%'
     OR (property_id = v_prop_id AND guest_email LIKE '%.analytics@example.com');

  DELETE FROM public.property_analytics_reviews
  WHERE property_id = v_prop_id
    AND (
      model = 'analytics-demo'
      OR id IN (
        'a4444444-4444-4444-8444-444444444431',
        'a4444444-4444-4444-8444-444444444432'
      )
    );

  INSERT INTO public.guest_submissions (
    id, property_id, status, booking_source,
    guest_facebook_name, primary_guest_name, guest_email, guest_phone_number, guest_address,
    check_in_date, check_out_date, check_in_time, check_out_time,
    nationality, number_of_adults, number_of_children, number_of_nights,
    primary_guest_age, guest2_name, guest2_age,
    guest_special_requests, find_us,
    need_parking, payment_receipt_url, valid_id_url,
    unit_owner, tower_and_unit_number, owner_onsite_contact_person, owner_contact_number,
    booking_rate, down_payment, balance, security_deposit,
    guest_balance_paid_amount, status_updated_at, created_at, updated_at
  ) VALUES
  -- August 2026 (prior period baseline)
  ('a4444444-4444-4444-8444-444444444401', v_prop_id, 'COMPLETED', 'airbnb',
    'Ana Cruz', 'Ana M. Cruz', 'ana.cruz.analytics@example.com', '09180010001',
    '12 Ayala Ave, Makati', '08-02-2026', '08-04-2026', '14:00', '11:00',
    'Filipino', 2, 0, 2, 28, 'Ben Cruz', 30, NULL, 'Airbnb',
    FALSE, v_receipt, v_id, 'Michael Manlulu', v_unit_label, 'Michael D Manlulu', '09625647541',
    5800, 2000, 0, 1600, 3800, '2026-08-04 12:00:00+08', '2026-07-15 10:00:00+08', now()),
  ('a4444444-4444-4444-8444-444444444402', v_prop_id, 'COMPLETED', 'Direct',
    'Rico Tan', 'Rico L. Tan', 'rico.tan.analytics@example.com', '09180010002',
    '88 IT Park, Cebu City', '08-05-2026', '08-07-2026', '14:00', '11:00',
    'Filipino', 1, 0, 2, 35, NULL, NULL, 'Early check-in', 'Website',
    FALSE, v_receipt, v_id, 'Michael Manlulu', v_unit_label, 'Michael D Manlulu', '09625647541',
    5200, 2000, 0, 1600, 3200, '2026-08-07 12:00:00+08', '2026-07-20 09:00:00+08', now()),
  ('a4444444-4444-4444-8444-444444444403', v_prop_id, 'COMPLETED', 'instagram',
    'Ella Wu', 'Ella S. Wu', 'ella.wu.analytics@example.com', '09180010003',
    '5 Orchard Rd, Singapore', '08-08-2026', '08-11-2026', '14:00', '11:00',
    'Singaporean', 2, 1, 3, 42, 'Sam Wu', 8, NULL, 'Instagram',
    FALSE, v_receipt, v_id, 'Michael Manlulu', v_unit_label, 'Michael D Manlulu', '09625647541',
    8700, 3000, 0, 2000, 5700, '2026-08-11 12:00:00+08', '2026-07-22 11:00:00+08', now()),
  ('a4444444-4444-4444-8444-444444444404', v_prop_id, 'COMPLETED', 'airbnb',
    'Jon Reyes', 'Jon P. Reyes', 'jon.reyes.analytics@example.com', '09180010004',
    '22 Session Rd, Baguio', '08-12-2026', '08-14-2026', '14:00', '11:00',
    'Filipino', 2, 0, 2, 52, 'Mia Reyes', 49, NULL, 'Airbnb',
    FALSE, v_receipt, v_id, 'Michael Manlulu', v_unit_label, 'Michael D Manlulu', '09625647541',
    5600, 2000, 0, 1600, 3600, '2026-08-14 12:00:00+08', '2026-07-28 08:00:00+08', now()),
  ('a4444444-4444-4444-8444-444444444405', v_prop_id, 'COMPLETED', 'tiktok',
    'Liza Gomez', 'Liza R. Gomez', 'liza.gomez.analytics@example.com', '09180010005',
    '3 Roxas Blvd, Manila', '08-15-2026', '08-18-2026', '14:00', '11:00',
    'Filipino', 3, 0, 3, 31, 'Paolo Gomez', 29, 'Extra towels', 'Tiktok',
    FALSE, v_receipt, v_id, 'Michael Manlulu', v_unit_label, 'Michael D Manlulu', '09625647541',
    8400, 3000, 0, 2000, 5400, '2026-08-18 12:00:00+08', '2026-08-01 09:00:00+08', now()),
  ('a4444444-4444-4444-8444-444444444406', v_prop_id, 'COMPLETED', 'referral',
    'Mark Lim', 'Mark T. Lim', 'mark.lim.analytics@example.com', '09180010006',
    '14 Bonifacio Global City, Taguig', '08-19-2026', '08-21-2026', '14:00', '11:00',
    'Filipino', 2, 0, 2, 24, 'Joy Lim', 23, NULL, 'Friend',
    FALSE, v_receipt, v_id, 'Michael Manlulu', v_unit_label, 'Michael D Manlulu', '09625647541',
    5400, 2000, 0, 1600, 3400, '2026-08-21 12:00:00+08', '2026-08-05 10:00:00+08', now()),
  ('a4444444-4444-4444-8444-444444444407', v_prop_id, 'COMPLETED', 'airbnb',
    'Nora Santos', 'Nora V. Santos', 'nora.santos.analytics@example.com', '09180010007',
    '9 Lanang, Davao City', '08-22-2026', '08-25-2026', '14:00', '11:00',
    'Filipino', 2, 0, 3, 61, NULL, NULL, NULL, 'Airbnb',
    FALSE, v_receipt, v_id, 'Michael Manlulu', v_unit_label, 'Michael D Manlulu', '09625647541',
    7800, 2500, 0, 1800, 5300, '2026-08-25 12:00:00+08', '2026-08-08 12:00:00+08', now()),
  ('a4444444-4444-4444-8444-444444444408', v_prop_id, 'COMPLETED', 'booking',
    'Owen Park', 'Owen H. Park', 'owen.park.analytics@example.com', '09180010008',
    '77 EDSA, Quezon City', '08-26-2026', '08-28-2026', '14:00', '11:00',
    'Korean', 1, 0, 2, 19, NULL, NULL, NULL, 'Booking.com',
    FALSE, v_receipt, v_id, 'Michael Manlulu', v_unit_label, 'Michael D Manlulu', '09625647541',
    5000, 2000, 0, 1600, 3000, '2026-08-28 12:00:00+08', '2026-08-10 15:00:00+08', now()),
  ('a4444444-4444-4444-8444-444444444409', v_prop_id, 'COMPLETED', 'airbnb',
    'Paula Ng', 'Paula C. Ng', 'paula.ng.analytics@example.com', '09180010009',
    '18 Ortigas Center, Pasig', '08-29-2026', '08-31-2026', '14:00', '11:00',
    'Filipino', 2, 0, 2, 45, 'Ken Ng', 47, NULL, 'Airbnb',
    FALSE, v_receipt, v_id, 'Michael Manlulu', v_unit_label, 'Michael D Manlulu', '09625647541',
    5600, 2000, 0, 1600, 3600, '2026-08-31 12:00:00+08', '2026-08-12 09:00:00+08', now()),

  -- September 2026 (selected period)
  ('a4444444-4444-4444-8444-444444444410', v_prop_id, 'COMPLETED', 'airbnb',
    'Quinn Lee', 'Quinn J. Lee', 'quinn.lee.analytics@example.com', '09180010010',
    '4 Legazpi St, Manila', '09-01-2026', '09-03-2026', '14:00', '11:00',
    'Filipino', 2, 0, 2, 33, 'Rae Lee', 31, NULL, 'Airbnb',
    FALSE, v_receipt, v_id, 'Michael Manlulu', v_unit_label, 'Michael D Manlulu', '09625647541',
    5800, 2000, 0, 1600, 3800, '2026-09-03 12:00:00+08', '2026-08-15 10:00:00+08', now()),
  ('a4444444-4444-4444-8444-444444444411', v_prop_id, 'COMPLETED', 'Direct',
    'Rita Chua', 'Rita F. Chua', 'rita.chua.analytics@example.com', '09180010011',
    '55 Mandaue, Cebu', '09-03-2026', '09-05-2026', '14:00', '11:00',
    'Filipino', 1, 0, 2, 27, NULL, NULL, NULL, 'Website',
    FALSE, v_receipt, v_id, 'Michael Manlulu', v_unit_label, 'Michael D Manlulu', '09625647541',
    5200, 2000, 0, 1600, 3200, '2026-09-05 12:00:00+08', '2026-08-18 11:00:00+08', now()),
  ('a4444444-4444-4444-8444-444444444412', v_prop_id, 'COMPLETED', 'instagram',
    'Sam Ibarra', 'Sam D. Ibarra', 'sam.ibarra.analytics@example.com', '09180010012',
    '2 Salcedo, Makati', '09-05-2026', '09-08-2026', '14:00', '11:00',
    'American', 2, 1, 3, 38, 'Tess Ibarra', 36, 'Late checkout', 'Instagram',
    FALSE, v_receipt, v_id, 'Michael Manlulu', v_unit_label, 'Michael D Manlulu', '09625647541',
    8400, 3000, 0, 2000, 5400, '2026-09-08 12:00:00+08', '2026-08-20 09:00:00+08', now()),
  ('a4444444-4444-4444-8444-444444444413', v_prop_id, 'COMPLETED', 'airbnb',
    'Tina Morales', 'Tina G. Morales', 'tina.morales.analytics@example.com', '09180010013',
    '31 Iloilo City Proper', '09-08-2026', '09-10-2026', '14:00', '11:00',
    'Filipino', 2, 0, 2, 55, 'Gil Morales', 57, NULL, 'Airbnb',
    FALSE, v_receipt, v_id, 'Michael Manlulu', v_unit_label, 'Michael D Manlulu', '09625647541',
    5600, 2000, 0, 1600, 3600, '2026-09-10 12:00:00+08', '2026-08-22 14:00:00+08', now()),
  ('a4444444-4444-4444-8444-444444444414', v_prop_id, 'COMPLETED', 'booking',
    'Uma Patel', 'Uma K. Patel', 'uma.patel.analytics@example.com', '09180010014',
    '6 Kuala Lumpur, Malaysia', '09-10-2026', '09-12-2026', '14:00', '11:00',
    'Malaysian', 2, 0, 2, 29, 'Raj Patel', 31, NULL, 'Booking.com',
    FALSE, v_receipt, v_id, 'Michael Manlulu', v_unit_label, 'Michael D Manlulu', '09625647541',
    5400, 2000, 0, 1600, 3400, '2026-09-12 12:00:00+08', '2026-08-25 10:00:00+08', now()),
  ('a4444444-4444-4444-8444-444444444415', v_prop_id, 'COMPLETED', 'Direct',
    'Vince Cole', 'Vince A. Cole', 'vince.cole.analytics@example.com', '09180010015',
    '90 Timog Ave, Quezon City', '09-12-2026', '09-15-2026', '14:00', '11:00',
    'Filipino', 3, 0, 3, 22, 'Wren Cole', 20, NULL, 'Website',
    FALSE, v_receipt, v_id, 'Michael Manlulu', v_unit_label, 'Michael D Manlulu', '09625647541',
    8100, 3000, 0, 2000, 5100, '2026-09-15 12:00:00+08', '2026-08-28 08:00:00+08', now()),
  ('a4444444-4444-4444-8444-444444444416', v_prop_id, 'COMPLETED', 'airbnb',
    'Wren Diaz', 'Wren L. Diaz', 'wren.diaz.analytics@example.com', '09180010016',
    '7 Poblacion, Makati', '09-15-2026', '09-17-2026', '14:00', '11:00',
    'Filipino', 2, 0, 2, 67, NULL, NULL, NULL, 'Airbnb',
    FALSE, v_receipt, v_id, 'Michael Manlulu', v_unit_label, 'Michael D Manlulu', '09625647541',
    5500, 2000, 0, 1600, 3500, '2026-09-17 12:00:00+08', '2026-09-01 09:00:00+08', now()),
  ('a4444444-4444-4444-8444-444444444417', v_prop_id, 'CANCELLED', 'facebook',
    'Xena Ortiz', 'Xena B. Ortiz', 'xena.ortiz.analytics@example.com', '09180010017',
    '44 Alabang, Muntinlupa', '09-18-2026', '09-20-2026', '14:00', '11:00',
    'Filipino', 2, 0, 2, 41, NULL, NULL, NULL, 'Facebook',
    FALSE, v_receipt, v_id, 'Michael Manlulu', v_unit_label, 'Michael D Manlulu', '09625647541',
    5200, 2000, 0, 1600, 0, '2026-09-10 12:00:00+08', '2026-09-02 11:00:00+08', now()),

  -- Forward bookings (Oct–Nov 2026) for on-the-books + pace
  ('a4444444-4444-4444-8444-444444444418', v_prop_id, 'READY_FOR_CHECKIN', 'airbnb',
    'Yael Kim', 'Yael S. Kim', 'yael.kim.analytics@example.com', '09180010018',
    '12 BGC, Taguig', '10-02-2026', '10-05-2026', '14:00', '11:00',
    'Korean', 2, 0, 3, 26, 'Min Kim', 28, NULL, 'Airbnb',
    FALSE, v_receipt, v_id, 'Michael Manlulu', v_unit_label, 'Michael D Manlulu', '09625647541',
    8400, 3000, 0, 2000, 5400, '2026-09-08 12:00:00+08', '2026-09-05 10:00:00+08', now()),
  ('a4444444-4444-4444-8444-444444444419', v_prop_id, 'READY_FOR_CHECKIN', 'Direct',
    'Zoe Martin', 'Zoe R. Martin', 'zoe.martin.analytics@example.com', '09180010019',
    '3 Ermita, Manila', '10-08-2026', '10-10-2026', '14:00', '11:00',
    'Australian', 1, 0, 2, 34, NULL, NULL, NULL, 'Website',
    FALSE, v_receipt, v_id, 'Michael Manlulu', v_unit_label, 'Michael D Manlulu', '09625647541',
    5600, 2000, 0, 1600, 3600, '2026-09-09 12:00:00+08', '2026-09-07 15:00:00+08', now()),
  ('a4444444-4444-4444-8444-444444444420', v_prop_id, 'READY_FOR_CHECKIN', 'airbnb',
    'Ava Chen', 'Ava L. Chen', 'ava.chen.analytics@example.com', '09180010020',
    '21 Lahug, Cebu City', '10-12-2026', '10-15-2026', '14:00', '11:00',
    'Filipino', 2, 1, 3, 39, 'Leo Chen', 7, NULL, 'Airbnb',
    FALSE, v_receipt, v_id, 'Michael Manlulu', v_unit_label, 'Michael D Manlulu', '09625647541',
    8700, 3000, 0, 2000, 5700, '2026-09-09 12:00:00+08', '2026-09-08 09:00:00+08', now()),
  ('a4444444-4444-4444-8444-444444444421', v_prop_id, 'PENDING_REVIEW', 'referral',
    'Ben Ho', 'Ben W. Ho', 'ben.ho.analytics@example.com', '09180010021',
    '8 Taft Ave, Manila', '10-18-2026', '10-20-2026', '14:00', '11:00',
    'Filipino', 2, 0, 2, 48, 'Cara Ho', 46, NULL, 'Friend',
    FALSE, v_receipt, v_id, 'Michael Manlulu', v_unit_label, 'Michael D Manlulu', '09625647541',
    5400, 1500, 3900, 1600, 1500, '2026-09-09 12:00:00+08', '2026-09-09 08:00:00+08', now()),
  ('a4444444-4444-4444-8444-444444444422', v_prop_id, 'READY_FOR_CHECKIN', 'airbnb',
    'Cara Yu', 'Cara M. Yu', 'cara.yu.analytics@example.com', '09180010022',
    '16 Shaw Blvd, Mandaluyong', '11-01-2026', '11-04-2026', '14:00', '11:00',
    'Filipino', 2, 0, 3, 58, NULL, NULL, NULL, 'Airbnb',
    FALSE, v_receipt, v_id, 'Michael Manlulu', v_unit_label, 'Michael D Manlulu', '09625647541',
    8100, 2500, 0, 2000, 5600, '2026-09-08 12:00:00+08', '2026-09-06 11:00:00+08', now());

  INSERT INTO public.property_page_views (
    property_id, viewed_at, session_id, referrer_host, device_class, is_bot
  )
  SELECT
    v_prop_id,
    ts,
    'analytics-demo-' || gs::text,
    ref,
    dev,
    FALSE
  FROM (
    VALUES
      ('2026-09-01 09:12:00+08'::timestamptz, 'google.com', 'mobile'),
      ('2026-09-02 14:30:00+08'::timestamptz, 'instagram.com', 'mobile'),
      ('2026-09-03 11:05:00+08'::timestamptz, 'facebook.com', 'desktop'),
      ('2026-09-04 18:22:00+08'::timestamptz, 'google.com', 'mobile'),
      ('2026-09-05 08:45:00+08'::timestamptz, NULL, 'mobile'),
      ('2026-09-06 16:10:00+08'::timestamptz, 'tiktok.com', 'mobile'),
      ('2026-09-07 10:00:00+08'::timestamptz, 'google.com', 'tablet'),
      ('2026-09-08 13:40:00+08'::timestamptz, 'airbnb.com', 'desktop'),
      ('2026-09-09 07:55:00+08'::timestamptz, 'google.com', 'mobile'),
      ('2026-09-09 20:15:00+08'::timestamptz, 'facebook.com', 'mobile'),
      ('2026-08-28 12:00:00+08'::timestamptz, 'google.com', 'desktop'),
      ('2026-08-29 15:30:00+08'::timestamptz, 'instagram.com', 'mobile')
  ) AS v(ts, ref, dev)
  CROSS JOIN generate_series(1, 12) AS gs;

  UPDATE public.property_analytics_reviews
  SET is_latest = FALSE
  WHERE property_id = v_prop_id
    AND is_latest = TRUE;

  INSERT INTO public.property_analytics_reviews (
    id, property_id, organization_id,
    period_start, period_end, generated_at, generated_by, model,
    headline, score, score_delta, payload, is_latest
  ) VALUES
  (
    'a4444444-4444-4444-8444-444444444431',
    v_prop_id, v_org_id,
    '2026-08-01', '2026-08-31',
    '2026-09-01 00:20:00+08', NULL, 'analytics-demo',
    'August stayed almost full at a stable nightly rate.',
    74, NULL,
    jsonb_build_object(
      'strengths', jsonb_build_array(
        jsonb_build_object(
          'title', 'Calendar was nearly full',
          'evidence', 'Nine completed stays covered most of August with little open inventory.'
        )
      ),
      'improvements', jsonb_build_array(),
      'avoid', jsonb_build_array(),
      'metricsSnapshot', jsonb_build_object('source', 'analytics-demo', 'period', '2026-08')
    ),
    FALSE
  ),
  (
    'a4444444-4444-4444-8444-444444444432',
    v_prop_id, v_org_id,
    '2026-09-01', '2026-09-30',
    '2026-09-15 00:30:00+08', NULL, 'analytics-demo',
    'Occupancy cooled after a full August. Nightly rate held.',
    66, -8,
    jsonb_build_object(
      'strengths', jsonb_build_array(
        jsonb_build_object(
          'title', 'Nightly rate held',
          'evidence', 'Avg nightly rate is about PHP 2,774 this month, only 1.5% below August.'
        ),
        jsonb_build_object(
          'title', 'October already has stays on the books',
          'evidence', 'Four October stays and one early-November stay are confirmed or in review.'
        ),
        jsonb_build_object(
          'title', 'Bookings come from more than one channel',
          'evidence', 'Airbnb leads, with Facebook, Instagram, Booking.com, TikTok, and referrals also contributing.'
        )
      ),
      'improvements', jsonb_build_array(
        jsonb_build_object(
          'title', 'Fill the remaining September nights',
          'why', 'Occupancy is about 63% this month, down sharply from a packed August.',
          'action', 'Release leftover blocked dates and price the open nights.',
          'expectedImpact', 'A few extra stays would lift occupancy without cutting the base rate.',
          'deepLink', v_pricing_link,
          'articleSlugs', jsonb_build_array('audit-blocked-dates', 'shorten-lead-time-gaps')
        ),
        jsonb_build_object(
          'title', 'Collect the unpaid October balance',
          'why', 'One October stay still has PHP 3,900 outstanding before check-in.',
          'action', 'Send a balance reminder from Bookings before the guest arrives.',
          'expectedImpact', 'Clears the collections risk without waiting until check-in day.',
          'deepLink', v_bookings_link,
          'articleSlugs', jsonb_build_array('collect-outstanding-balances')
        )
      ),
      'avoid', jsonb_build_array(
        jsonb_build_object(
          'title', 'Do not slash the base rate after one softer month',
          'why', 'ADR held while occupancy dropped. A blanket discount would give up rate for nights that may still book.',
          'deepLink', v_pricing_link
        ),
        jsonb_build_object(
          'title', 'Do not ignore the cancelled Facebook stay',
          'why', 'One cancellation in an 8-booking month is not a pattern yet, but a second one would be.',
          'deepLink', v_bookings_link
        )
      ),
      'metricsSnapshot', jsonb_build_object('source', 'analytics-demo', 'period', '2026-09')
    ),
    TRUE
  );

  RAISE NOTICE 'seed-analytics-demo-data: loaded % bookings + page views + AI review for property % (%)',
    22, v_prop_id, v_prop_slug;
END $$;
