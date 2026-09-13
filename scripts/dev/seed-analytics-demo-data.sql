-- Analytics QA fixture — rich bookings + page views for the full Analytics dashboard.
-- Target: org `kame-homes` + property `kame-home` (skips if missing).
-- Safe to re-run: deletes prior rows tagged `analytics_demo_seed`.
-- Apply: bun run seed:analytics-demo

DO $$
DECLARE
  v_org_id UUID;
  v_prop_id UUID;
  v_receipt TEXT := 'https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=800&q=80';
  v_id TEXT := 'https://images.unsplash.com/photo-1589829085413-56de8ae18c73?w=800&q=80';
BEGIN
  SELECT id INTO v_org_id FROM public.organizations WHERE slug = 'kame-homes' LIMIT 1;
  SELECT id INTO v_prop_id FROM public.properties WHERE slug = 'kame-home' AND organization_id = v_org_id LIMIT 1;

  IF v_org_id IS NULL OR v_prop_id IS NULL THEN
    RAISE NOTICE 'seed-analytics-demo-data: kame-homes / kame-home not found — skipped';
    RETURN;
  END IF;

  DELETE FROM public.property_page_views
  WHERE property_id = v_prop_id
    AND session_id LIKE 'analytics-demo-%';

  DELETE FROM public.guest_submissions WHERE booking_source = 'analytics_demo_seed';

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
  ('a4444444-4444-4444-8444-444444444401', v_prop_id, 'COMPLETED', 'analytics_demo_seed',
    'Ana Cruz', 'Ana M. Cruz', 'ana.cruz.analytics@example.com', '09180010001',
    '12 Ayala Ave, Makati', '08-02-2026', '08-04-2026', '14:00', '11:00',
    'Filipino', 2, 0, 2, 28, 'Ben Cruz', 30, NULL, 'Airbnb',
    FALSE, v_receipt, v_id, 'Michael Manlulu', 'Monaco 2604', 'Michael D Manlulu', '09625647541',
    5800, 2000, 0, 1600, 3800, '2026-08-04 12:00:00+08', '2026-07-15 10:00:00+08', now()),
  ('a4444444-4444-4444-8444-444444444402', v_prop_id, 'COMPLETED', 'analytics_demo_seed',
    'Rico Tan', 'Rico L. Tan', 'rico.tan.analytics@example.com', '09180010002',
    '88 IT Park, Cebu City', '08-05-2026', '08-07-2026', '14:00', '11:00',
    'Filipino', 1, 0, 2, 35, NULL, NULL, 'Early check-in', 'Facebook',
    FALSE, v_receipt, v_id, 'Michael Manlulu', 'Monaco 2604', 'Michael D Manlulu', '09625647541',
    5200, 2000, 0, 1600, 3200, '2026-08-07 12:00:00+08', '2026-07-20 09:00:00+08', now()),
  ('a4444444-4444-4444-8444-444444444403', v_prop_id, 'COMPLETED', 'analytics_demo_seed',
    'Ella Wu', 'Ella S. Wu', 'ella.wu.analytics@example.com', '09180010003',
    '5 Orchard Rd, Singapore', '08-08-2026', '08-11-2026', '14:00', '11:00',
    'Singaporean', 2, 1, 3, 42, 'Sam Wu', 8, NULL, 'Instagram',
    FALSE, v_receipt, v_id, 'Michael Manlulu', 'Monaco 2604', 'Michael D Manlulu', '09625647541',
    8700, 3000, 0, 2000, 5700, '2026-08-11 12:00:00+08', '2026-07-22 11:00:00+08', now()),
  ('a4444444-4444-4444-8444-444444444404', v_prop_id, 'COMPLETED', 'analytics_demo_seed',
    'Jon Reyes', 'Jon P. Reyes', 'jon.reyes.analytics@example.com', '09180010004',
    '22 Session Rd, Baguio', '08-12-2026', '08-14-2026', '14:00', '11:00',
    'Filipino', 2, 0, 2, 52, 'Mia Reyes', 49, NULL, 'Airbnb',
    FALSE, v_receipt, v_id, 'Michael Manlulu', 'Monaco 2604', 'Michael D Manlulu', '09625647541',
    5600, 2000, 0, 1600, 3600, '2026-08-14 12:00:00+08', '2026-07-28 08:00:00+08', now()),
  ('a4444444-4444-4444-8444-444444444405', v_prop_id, 'COMPLETED', 'analytics_demo_seed',
    'Liza Gomez', 'Liza R. Gomez', 'liza.gomez.analytics@example.com', '09180010005',
    '3 Roxas Blvd, Manila', '08-15-2026', '08-18-2026', '14:00', '11:00',
    'Filipino', 3, 0, 3, 31, 'Paolo Gomez', 29, 'Extra towels', 'Tiktok',
    FALSE, v_receipt, v_id, 'Michael Manlulu', 'Monaco 2604', 'Michael D Manlulu', '09625647541',
    8400, 3000, 0, 2000, 5400, '2026-08-18 12:00:00+08', '2026-08-01 09:00:00+08', now()),
  ('a4444444-4444-4444-8444-444444444406', v_prop_id, 'COMPLETED', 'analytics_demo_seed',
    'Mark Lim', 'Mark T. Lim', 'mark.lim.analytics@example.com', '09180010006',
    '14 Bonifacio Global City, Taguig', '08-19-2026', '08-21-2026', '14:00', '11:00',
    'Filipino', 2, 0, 2, 24, 'Joy Lim', 23, NULL, 'Friend',
    FALSE, v_receipt, v_id, 'Michael Manlulu', 'Monaco 2604', 'Michael D Manlulu', '09625647541',
    5400, 2000, 0, 1600, 3400, '2026-08-21 12:00:00+08', '2026-08-05 10:00:00+08', now()),
  ('a4444444-4444-4444-8444-444444444407', v_prop_id, 'COMPLETED', 'analytics_demo_seed',
    'Nora Santos', 'Nora V. Santos', 'nora.santos.analytics@example.com', '09180010007',
    '9 Lanang, Davao City', '08-22-2026', '08-25-2026', '14:00', '11:00',
    'Filipino', 2, 0, 3, 61, NULL, NULL, NULL, 'Airbnb',
    FALSE, v_receipt, v_id, 'Michael Manlulu', 'Monaco 2604', 'Michael D Manlulu', '09625647541',
    7800, 2500, 0, 1800, 5300, '2026-08-25 12:00:00+08', '2026-08-08 12:00:00+08', now()),
  ('a4444444-4444-4444-8444-444444444408', v_prop_id, 'COMPLETED', 'analytics_demo_seed',
    'Owen Park', 'Owen H. Park', 'owen.park.analytics@example.com', '09180010008',
    '77 EDSA, Quezon City', '08-26-2026', '08-28-2026', '14:00', '11:00',
    'Korean', 1, 0, 2, 19, NULL, NULL, NULL, 'Booking.com',
    FALSE, v_receipt, v_id, 'Michael Manlulu', 'Monaco 2604', 'Michael D Manlulu', '09625647541',
    5000, 2000, 0, 1600, 3000, '2026-08-28 12:00:00+08', '2026-08-10 15:00:00+08', now()),
  ('a4444444-4444-4444-8444-444444444409', v_prop_id, 'COMPLETED', 'analytics_demo_seed',
    'Paula Ng', 'Paula C. Ng', 'paula.ng.analytics@example.com', '09180010009',
    '18 Ortigas Center, Pasig', '08-29-2026', '08-31-2026', '14:00', '11:00',
    'Filipino', 2, 0, 2, 45, 'Ken Ng', 47, NULL, 'Airbnb',
    FALSE, v_receipt, v_id, 'Michael Manlulu', 'Monaco 2604', 'Michael D Manlulu', '09625647541',
    5600, 2000, 0, 1600, 3600, '2026-08-31 12:00:00+08', '2026-08-12 09:00:00+08', now()),

  -- September 2026 (selected period)
  ('a4444444-4444-4444-8444-444444444410', v_prop_id, 'COMPLETED', 'analytics_demo_seed',
    'Quinn Lee', 'Quinn J. Lee', 'quinn.lee.analytics@example.com', '09180010010',
    '4 Legazpi St, Manila', '09-01-2026', '09-03-2026', '14:00', '11:00',
    'Filipino', 2, 0, 2, 33, 'Rae Lee', 31, NULL, 'Airbnb',
    FALSE, v_receipt, v_id, 'Michael Manlulu', 'Monaco 2604', 'Michael D Manlulu', '09625647541',
    5800, 2000, 0, 1600, 3800, '2026-09-03 12:00:00+08', '2026-08-15 10:00:00+08', now()),
  ('a4444444-4444-4444-8444-444444444411', v_prop_id, 'COMPLETED', 'analytics_demo_seed',
    'Rita Chua', 'Rita F. Chua', 'rita.chua.analytics@example.com', '09180010011',
    '55 Mandaue, Cebu', '09-03-2026', '09-05-2026', '14:00', '11:00',
    'Filipino', 1, 0, 2, 27, NULL, NULL, NULL, 'Facebook',
    FALSE, v_receipt, v_id, 'Michael Manlulu', 'Monaco 2604', 'Michael D Manlulu', '09625647541',
    5200, 2000, 0, 1600, 3200, '2026-09-05 12:00:00+08', '2026-08-18 11:00:00+08', now()),
  ('a4444444-4444-4444-8444-444444444412', v_prop_id, 'COMPLETED', 'analytics_demo_seed',
    'Sam Ibarra', 'Sam D. Ibarra', 'sam.ibarra.analytics@example.com', '09180010012',
    '2 Salcedo, Makati', '09-05-2026', '09-08-2026', '14:00', '11:00',
    'American', 2, 1, 3, 38, 'Tess Ibarra', 36, 'Late checkout', 'Instagram',
    FALSE, v_receipt, v_id, 'Michael Manlulu', 'Monaco 2604', 'Michael D Manlulu', '09625647541',
    8400, 3000, 0, 2000, 5400, '2026-09-08 12:00:00+08', '2026-08-20 09:00:00+08', now()),
  ('a4444444-4444-4444-8444-444444444413', v_prop_id, 'COMPLETED', 'analytics_demo_seed',
    'Tina Morales', 'Tina G. Morales', 'tina.morales.analytics@example.com', '09180010013',
    '31 Iloilo City Proper', '09-08-2026', '09-10-2026', '14:00', '11:00',
    'Filipino', 2, 0, 2, 55, 'Gil Morales', 57, NULL, 'Airbnb',
    FALSE, v_receipt, v_id, 'Michael Manlulu', 'Monaco 2604', 'Michael D Manlulu', '09625647541',
    5600, 2000, 0, 1600, 3600, '2026-09-10 12:00:00+08', '2026-08-22 14:00:00+08', now()),
  ('a4444444-4444-4444-8444-444444444414', v_prop_id, 'COMPLETED', 'analytics_demo_seed',
    'Uma Patel', 'Uma K. Patel', 'uma.patel.analytics@example.com', '09180010014',
    '6 Kuala Lumpur, Malaysia', '09-10-2026', '09-12-2026', '14:00', '11:00',
    'Malaysian', 2, 0, 2, 29, 'Raj Patel', 31, NULL, 'Booking.com',
    FALSE, v_receipt, v_id, 'Michael Manlulu', 'Monaco 2604', 'Michael D Manlulu', '09625647541',
    5400, 2000, 0, 1600, 3400, '2026-09-12 12:00:00+08', '2026-08-25 10:00:00+08', now()),
  ('a4444444-4444-4444-8444-444444444415', v_prop_id, 'COMPLETED', 'analytics_demo_seed',
    'Vince Cole', 'Vince A. Cole', 'vince.cole.analytics@example.com', '09180010015',
    '90 Timog Ave, Quezon City', '09-12-2026', '09-15-2026', '14:00', '11:00',
    'Filipino', 3, 0, 3, 22, 'Wren Cole', 20, NULL, 'Tiktok',
    FALSE, v_receipt, v_id, 'Michael Manlulu', 'Monaco 2604', 'Michael D Manlulu', '09625647541',
    8100, 3000, 0, 2000, 5100, '2026-09-15 12:00:00+08', '2026-08-28 08:00:00+08', now()),
  ('a4444444-4444-4444-8444-444444444416', v_prop_id, 'COMPLETED', 'analytics_demo_seed',
    'Wren Diaz', 'Wren L. Diaz', 'wren.diaz.analytics@example.com', '09180010016',
    '7 Poblacion, Makati', '09-15-2026', '09-17-2026', '14:00', '11:00',
    'Filipino', 2, 0, 2, 67, NULL, NULL, NULL, 'Airbnb',
    FALSE, v_receipt, v_id, 'Michael Manlulu', 'Monaco 2604', 'Michael D Manlulu', '09625647541',
    5500, 2000, 0, 1600, 3500, '2026-09-17 12:00:00+08', '2026-09-01 09:00:00+08', now()),
  ('a4444444-4444-4444-8444-444444444417', v_prop_id, 'CANCELLED', 'analytics_demo_seed',
    'Xena Ortiz', 'Xena B. Ortiz', 'xena.ortiz.analytics@example.com', '09180010017',
    '44 Alabang, Muntinlupa', '09-18-2026', '09-20-2026', '14:00', '11:00',
    'Filipino', 2, 0, 2, 41, NULL, NULL, NULL, 'Facebook',
    FALSE, v_receipt, v_id, 'Michael Manlulu', 'Monaco 2604', 'Michael D Manlulu', '09625647541',
    5200, 2000, 0, 1600, 0, '2026-09-10 12:00:00+08', '2026-09-02 11:00:00+08', now()),

  -- Forward bookings (Oct–Nov 2026) for on-the-books + pace
  ('a4444444-4444-4444-8444-444444444418', v_prop_id, 'READY_FOR_CHECKIN', 'analytics_demo_seed',
    'Yael Kim', 'Yael S. Kim', 'yael.kim.analytics@example.com', '09180010018',
    '12 BGC, Taguig', '10-02-2026', '10-05-2026', '14:00', '11:00',
    'Korean', 2, 0, 3, 26, 'Min Kim', 28, NULL, 'Airbnb',
    FALSE, v_receipt, v_id, 'Michael Manlulu', 'Monaco 2604', 'Michael D Manlulu', '09625647541',
    8400, 3000, 0, 2000, 5400, '2026-09-08 12:00:00+08', '2026-09-05 10:00:00+08', now()),
  ('a4444444-4444-4444-8444-444444444419', v_prop_id, 'READY_FOR_CHECKIN', 'analytics_demo_seed',
    'Zoe Martin', 'Zoe R. Martin', 'zoe.martin.analytics@example.com', '09180010019',
    '3 Ermita, Manila', '10-08-2026', '10-10-2026', '14:00', '11:00',
    'Australian', 1, 0, 2, 34, NULL, NULL, NULL, 'Instagram',
    FALSE, v_receipt, v_id, 'Michael Manlulu', 'Monaco 2604', 'Michael D Manlulu', '09625647541',
    5600, 2000, 0, 1600, 3600, '2026-09-09 12:00:00+08', '2026-09-07 15:00:00+08', now()),
  ('a4444444-4444-4444-8444-444444444420', v_prop_id, 'READY_FOR_CHECKIN', 'analytics_demo_seed',
    'Ava Chen', 'Ava L. Chen', 'ava.chen.analytics@example.com', '09180010020',
    '21 Lahug, Cebu City', '10-12-2026', '10-15-2026', '14:00', '11:00',
    'Filipino', 2, 1, 3, 39, 'Leo Chen', 7, NULL, 'Airbnb',
    FALSE, v_receipt, v_id, 'Michael Manlulu', 'Monaco 2604', 'Michael D Manlulu', '09625647541',
    8700, 3000, 0, 2000, 5700, '2026-09-09 12:00:00+08', '2026-09-08 09:00:00+08', now()),
  ('a4444444-4444-4444-8444-444444444421', v_prop_id, 'PENDING_REVIEW', 'analytics_demo_seed',
    'Ben Ho', 'Ben W. Ho', 'ben.ho.analytics@example.com', '09180010021',
    '8 Taft Ave, Manila', '10-18-2026', '10-20-2026', '14:00', '11:00',
    'Filipino', 2, 0, 2, 48, 'Cara Ho', 46, NULL, 'Friend',
    FALSE, v_receipt, v_id, 'Michael Manlulu', 'Monaco 2604', 'Michael D Manlulu', '09625647541',
    5400, 1500, 3900, 1600, 1500, '2026-09-09 12:00:00+08', '2026-09-09 08:00:00+08', now()),
  ('a4444444-4444-4444-8444-444444444422', v_prop_id, 'READY_FOR_CHECKIN', 'analytics_demo_seed',
    'Cara Yu', 'Cara M. Yu', 'cara.yu.analytics@example.com', '09180010022',
    '16 Shaw Blvd, Mandaluyong', '11-01-2026', '11-04-2026', '14:00', '11:00',
    'Filipino', 2, 0, 3, 58, NULL, NULL, NULL, 'Airbnb',
    FALSE, v_receipt, v_id, 'Michael Manlulu', 'Monaco 2604', 'Michael D Manlulu', '09625647541',
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

  RAISE NOTICE 'seed-analytics-demo-data: loaded % bookings + page views for property %',
    22, v_prop_id;
END $$;
