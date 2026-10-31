-- Demo data for org `kame-home` + property `monaco-2612` (finance + maintenance + bookings).
-- Safe to re-run: clears prior demo_seed rows for this property only.
-- Run: bun run seed:monaco-2612  (or supabase db query --local -f scripts/dev/seed-monaco-2612-demo-data.sql)

DO $$
DECLARE
  v_org_id UUID;
  v_prop_id UUID;
  v_receipt TEXT := 'https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=800&q=80';
  v_id TEXT := 'https://images.unsplash.com/photo-1589829085413-56de8ae18c73?w=800&q=80';
  v_pet TEXT := 'https://images.unsplash.com/photo-1543466835-00a7907e9de1?w=800&q=80';
  v_vax TEXT := 'https://images.unsplash.com/photo-1584515933487-779824d15320?w=800&q=80';
BEGIN
  SELECT id INTO v_org_id FROM public.organizations WHERE slug = 'kame-home' LIMIT 1;
  SELECT id INTO v_prop_id
  FROM public.properties
  WHERE slug = 'monaco-2612' AND organization_id = v_org_id
  LIMIT 1;

  IF v_org_id IS NULL OR v_prop_id IS NULL THEN
    RAISE NOTICE 'seed-monaco-2612: kame-home / monaco-2612 not found — skipped';
    RETURN;
  END IF;

  DELETE FROM public.guest_submissions
  WHERE property_id = v_prop_id AND booking_source = 'demo_seed';
  DELETE FROM public.finance_line_items
  WHERE property_id = v_prop_id AND created_by = 'demo_seed';
  DELETE FROM public.maintenance_items
  WHERE property_id = v_prop_id AND created_by = 'demo_seed';

  -- Also replace sparse manual test rows so August export matches a full ledger.
  DELETE FROM public.guest_submissions WHERE property_id = v_prop_id;

  INSERT INTO public.guest_submissions (
    id, property_id, status, booking_source,
    guest_facebook_name, primary_guest_name, guest_email, guest_phone_number, guest_address,
    check_in_date, check_out_date, check_in_time, check_out_time,
    nationality, number_of_adults, number_of_children, number_of_nights,
    guest2_name, guest_special_requests, find_us, find_us_details,
    need_parking, car_plate_number, car_brand_model, car_color,
    parking_rate_guest, parking_rate_paid,
    has_pets, pet_name, pet_breed, pet_age, pet_type, pet_vaccination_date, pet_vaccination_url, pet_image_url,
    guest_additional_fee,
    payment_receipt_url, valid_id_url,
    unit_owner, tower_and_unit_number, owner_onsite_contact_person, owner_contact_number,
    booking_rate, down_payment, balance, security_deposit, pet_fee,
    guest_balance_paid_amount, status_updated_at, created_at, updated_at
  ) VALUES
  -- July (completed history)
  (
    'd2612001-0001-4001-8001-000000000001', v_prop_id, 'COMPLETED', 'demo_seed',
    'June Vale', 'June A. Vale', 'june.vale.demo@example.com', '09171230101',
    '1 Lake Shore, Tagaytay',
    '07-04-2026', '07-06-2026', '14:00', '11:00',
    'Filipino', 2, 0, 2, 'Kyle Vale', 'Anniversary weekend', 'Airbnb', NULL,
    TRUE, 'JUL 1001', 'Toyota Vios', 'White', 350.00, 350.00,
    FALSE, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL,
    v_receipt, v_id,
    'Michael Manlulu', 'Monaco 2612', 'Michael D Manlulu', '09625647541',
    5600.00, 2000.00, 0.00, 1600.00, NULL,
    3600.00, '2026-07-06 12:00:00+08', '2026-06-20 09:00:00+08', now()
  ),
  (
    'd2612001-0001-4001-8001-000000000002', v_prop_id, 'COMPLETED', 'demo_seed',
    'Lia Parks', 'Lia B. Parks', 'lia.parks.demo@example.com', '09171230102',
    '22 Espana Blvd, Manila',
    '07-18-2026', '07-20-2026', '14:00', '11:00',
    'Filipino', 1, 0, 2, NULL, 'Quiet room preferred', 'Instagram', NULL,
    FALSE, NULL, NULL, NULL, NULL, NULL,
    FALSE, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL,
    v_receipt, v_id,
    'Michael Manlulu', 'Monaco 2612', 'Michael D Manlulu', '09625647541',
    5200.00, 2000.00, 0.00, 1600.00, NULL,
    3200.00, '2026-07-20 12:00:00+08', '2026-06-22 10:00:00+08', now()
  ),
  (
    'd2612001-0001-4001-8001-000000000003', v_prop_id, 'PENDING_SD_REFUND', 'demo_seed',
    'Mike F. Jones', 'Mike F. Jones', 'mike.jones.demo@example.com', '09171230103',
    '9 Bel-Air, Makati',
    '07-13-2026', '07-15-2026', '14:00', '11:00',
    'Filipino', 2, 0, 2, NULL, NULL, 'Facebook', NULL,
    FALSE, NULL, NULL, NULL, NULL, NULL,
    FALSE, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL,
    v_receipt, v_id,
    'Michael Manlulu', 'Monaco 2612', 'Michael D Manlulu', '09625647541',
    5598.00, 2500.00, 0.00, 1800.00, NULL,
    3098.00, '2026-07-15 14:00:00+08', '2026-07-01 09:00:00+08', now()
  ),
  -- August (primary test month — mixed pipeline + completed)
  (
    'd2612001-0001-4001-8001-000000000011', v_prop_id, 'COMPLETED', 'demo_seed',
    'Ben Cruz', 'Ben A. Cruz', 'ben.cruz.demo@example.com', '09171230002',
    '45 Rizal Ave, Angeles City',
    '08-01-2026', '08-03-2026', '14:00', '11:00',
    'Filipino', 2, 1, 2, 'Carla Cruz', 'Extra towels please', 'Facebook', NULL,
    FALSE, NULL, NULL, NULL, NULL, NULL,
    FALSE, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 500.00,
    v_receipt, v_id,
    'Michael Manlulu', 'Monaco 2612', 'Michael D Manlulu', '09625647541',
    5600.00, 2000.00, 0.00, 1600.00, NULL,
    3600.00, '2026-08-03 12:00:00+08', '2026-07-25 10:00:00+08', now()
  ),
  (
    'd2612001-0001-4001-8001-000000000012', v_prop_id, 'COMPLETED', 'demo_seed',
    'Dana Lim', 'Dana P. Lim', 'dana.lim.demo@example.com', '09171230003',
    '88 Ayala Ave, Makati',
    '08-04-2026', '08-06-2026', '15:00', '11:00',
    'Filipino', 1, 0, 2, NULL, 'Early check-in if possible', 'Instagram', NULL,
    TRUE, 'XYZ 7788', 'Honda Civic', 'Black', 400.00, 400.00,
    FALSE, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL,
    v_receipt, v_id,
    'Michael Manlulu', 'Monaco 2612', 'Michael D Manlulu', '09625647541',
    5200.00, 2000.00, 0.00, 1600.00, NULL,
    3200.00, '2026-08-06 12:00:00+08', '2026-07-28 11:00:00+08', now()
  ),
  (
    'd2612001-0001-4001-8001-000000000013', v_prop_id, 'PENDING_SD_REFUND', 'demo_seed',
    'Eli Santos', 'Eli R. Santos', 'eli.santos.demo@example.com', '09171230004',
    '3 Lakeview Dr, Tagaytay',
    '08-07-2026', '08-09-2026', '14:00', '11:00',
    'Filipino', 2, 0, 2, 'Faye Santos', 'Late check-out needed', 'Friend', 'College classmate',
    FALSE, NULL, NULL, NULL, NULL, NULL,
    FALSE, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL,
    v_receipt, v_id,
    'Michael Manlulu', 'Monaco 2612', 'Michael D Manlulu', '09625647541',
    5800.00, 2500.00, 0.00, 1800.00, NULL,
    3300.00, '2026-08-09 14:00:00+08', '2026-07-30 08:00:00+08', now()
  ),
  (
    'd2612001-0001-4001-8001-000000000014', v_prop_id, 'READY_FOR_CHECKOUT', 'demo_seed',
    'Gina Torres', 'Gina L. Torres', 'gina.torres.demo@example.com', '09171230005',
    '19 Capas St, Tarlac',
    '08-10-2026', '08-12-2026', '14:00', '11:00',
    'Filipino', 3, 0, 2, 'Hank Torres', 'Need extra pillows', 'Airbnb', NULL,
    TRUE, 'DEF 5566', 'Mitsubishi Xpander', 'Silver', 350.00, 350.00,
    TRUE, 'Mochi', 'Poodle', '2 years old', 'Dog', '01-15-2026', v_vax, v_pet,
    750.00,
    v_receipt, v_id,
    'Michael Manlulu', 'Monaco 2612', 'Michael D Manlulu', '09625647541',
    7200.00, 3000.00, 0.00, 2000.00, 500.00,
    4200.00, now(), '2026-08-01 09:00:00+08', now()
  ),
  (
    'd2612001-0001-4001-8001-000000000015', v_prop_id, 'CANCELLED', 'demo_seed',
    'Sarah D. Miller', 'Sarah D. Miller', 'sarah.miller.demo@example.com', '09171230016',
    '12 Mabini St, San Fernando',
    '08-11-2026', '08-12-2026', '14:00', '11:00',
    'Filipino', 2, 0, 1, NULL, NULL, 'Direct', NULL,
    FALSE, NULL, NULL, NULL, NULL, NULL,
    FALSE, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL,
    v_receipt, v_id,
    'Michael Manlulu', 'Monaco 2612', 'Michael D Manlulu', '09625647541',
    2799.00, 1000.00, 1799.00, 1500.00, NULL,
    NULL, '2026-08-10 09:00:00+08', '2026-08-05 09:00:00+08', now()
  ),
  (
    'd2612001-0001-4001-8001-000000000016', v_prop_id, 'PENDING_REVIEW', 'demo_seed',
    'Emma D. Johnson', 'Emma D. Johnson', 'emma.johnson.demo@example.com', '09171230017',
    '77 Ortigas Ave, Pasig',
    '08-13-2026', '08-14-2026', '14:00', '11:00',
    'Filipino', 2, 0, 1, 'Jake Johnson', NULL, 'Direct', NULL,
    TRUE, 'GHI 9900', 'Ford Ranger', 'Gray', 400.00, NULL,
    FALSE, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 600.00,
    v_receipt, v_id,
    'Michael Manlulu', 'Monaco 2612', 'Michael D Manlulu', '09625647541',
    2799.00, 1000.00, 1799.00, 1500.00, NULL,
    NULL, '2026-08-08 16:00:00+08', '2026-08-02 10:00:00+08', now()
  ),
  (
    'd2612001-0001-4001-8001-000000000017', v_prop_id, 'PENDING_DOCUMENTS', 'demo_seed',
    'Jane B. Brown', 'Jane B. Brown', 'jane.brown.demo@example.com', '09171230018',
    '5 BGC High St, Taguig',
    '08-19-2026', '08-20-2026', '14:00', '11:00',
    'Filipino', 2, 0, 1, 'Leo Brown', 'Quiet room requested', 'Direct', NULL,
    TRUE, 'JKL 1122', 'Nissan Navara', 'Red', 450.00, NULL,
    FALSE, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL,
    v_receipt, v_id,
    'Michael Manlulu', 'Monaco 2612', 'Michael D Manlulu', '09625647541',
    2799.00, 800.00, 1999.00, 1500.00, NULL,
    NULL, '2026-08-08 11:00:00+08', '2026-08-04 12:00:00+08', now()
  ),
  (
    'd2612001-0001-4001-8001-000000000018', v_prop_id, 'READY_FOR_CHECKIN', 'demo_seed',
    'Iris Tan', 'Iris K. Tan', 'iris.tan.demo@example.com', '09171230006',
    '21 Maginhawa, Quezon City',
    '08-22-2026', '08-25-2026', '14:00', '11:00',
    'Filipino', 2, 0, 3, 'Jake Tan', 'Anniversary stay', 'Tiktok', NULL,
    TRUE, 'MNO 3344', 'Toyota Vios', 'Blue', 350.00, 350.00,
    FALSE, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL,
    v_receipt, v_id,
    'Michael Manlulu', 'Monaco 2612', 'Michael D Manlulu', '09625647541',
    8400.00, 3500.00, 4900.00, 2000.00, NULL,
    NULL, '2026-08-08 13:00:00+08', '2026-08-03 16:00:00+08', now()
  ),
  (
    'd2612001-0001-4001-8001-000000000019', v_prop_id, 'PENDING_REVIEW', 'demo_seed',
    'Vera Ng', 'Vera H. Ng', 'vera.ng.demo@example.com', '09171230013',
    '30 Shaw Blvd, Mandaluyong',
    '08-26-2026', '08-29-2026', '14:00', '11:00',
    'Filipino', 4, 0, 3, 'Will Ng', 'Family trip — extra pillows', 'Airbnb', NULL,
    FALSE, NULL, NULL, NULL, NULL, NULL,
    TRUE, 'Coco', 'Shih Tzu', '3 years old', 'Dog', '03-01-2026', v_vax, v_pet,
    900.00,
    v_receipt, v_id,
    'Michael Manlulu', 'Monaco 2612', 'Michael D Manlulu', '09625647541',
    9800.00, 4000.00, 5800.00, 2500.00, 500.00,
    NULL, '2026-08-08 17:00:00+08', '2026-08-07 08:00:00+08', now()
  ),
  -- September (upcoming)
  (
    'd2612001-0001-4001-8001-000000000021', v_prop_id, 'READY_FOR_CHECKIN', 'demo_seed',
    'Xander Co', 'Xander I. Co', 'xander.co.demo@example.com', '09171230014',
    '8 Forbes Park, Makati',
    '09-02-2026', '09-05-2026', '14:00', '11:00',
    'Filipino', 2, 0, 3, 'Yna Co', 'Late arrival around 8pm', 'Tiktok', NULL,
    TRUE, 'PQR 7788', 'Honda Civic', 'White', 350.00, NULL,
    FALSE, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL,
    v_receipt, v_id,
    'Michael Manlulu', 'Monaco 2612', 'Michael D Manlulu', '09625647541',
    8700.00, 3500.00, 5200.00, 2000.00, NULL,
    NULL, '2026-08-08 19:00:00+08', '2026-08-04 19:00:00+08', now()
  );

  INSERT INTO public.finance_line_items (
    id, property_id, kind, label, amount, category, occurred_on, notes,
    receipt_path, created_by, paid_at, telegram_reminder_enabled
  ) VALUES
  ('d2612002-0002-4002-8002-000000000001', v_prop_id, 'expense', 'Condo dues — August',
    8500.00, 'Amortization', '2026-08-01', 'Monthly association dues',
    v_receipt, 'demo_seed', '2026-08-01 10:00:00+08', FALSE),
  ('d2612002-0002-4002-8002-000000000002', v_prop_id, 'expense', 'Meralco bill',
    3200.00, 'Utilities', '2026-08-05', 'July usage billed in August',
    v_receipt, 'demo_seed', '2026-08-06 09:00:00+08', FALSE),
  ('d2612002-0002-4002-8002-000000000003', v_prop_id, 'expense', 'Maynilad water',
    680.00, 'Utilities', '2026-08-05', NULL,
    NULL, 'demo_seed', '2026-08-06 09:05:00+08', FALSE),
  ('d2612002-0002-4002-8002-000000000004', v_prop_id, 'expense', 'Turnover cleaning',
    1500.00, 'Cleaning', '2026-08-03', 'After Ben Cruz stay',
    v_receipt, 'demo_seed', '2026-08-03 16:00:00+08', FALSE),
  ('d2612002-0002-4002-8002-000000000005', v_prop_id, 'expense', 'Turnover cleaning',
    1500.00, 'Cleaning', '2026-08-06', 'After Dana Lim stay',
    v_receipt, 'demo_seed', '2026-08-05 15:00:00+08', FALSE),
  ('d2612002-0002-4002-8002-000000000006', v_prop_id, 'expense', 'Linens & toiletries restock',
    2100.00, 'Supplies', '2026-08-08', 'Towels, soap, garbage bags',
    v_receipt, 'demo_seed', NULL, TRUE),
  ('d2612002-0002-4002-8002-000000000007', v_prop_id, 'expense', 'Facebook ads — August',
    2500.00, 'Marketing', '2026-08-10', 'Boost for mid-month vacancies',
    NULL, 'demo_seed', NULL, FALSE),
  ('d2612002-0002-4002-8002-000000000008', v_prop_id, 'expense', 'Housekeeper stipend',
    4000.00, 'Staff', '2026-08-15', 'Biweekly cleaning retainer',
    NULL, 'demo_seed', NULL, TRUE),
  ('d2612002-0002-4002-8002-000000000009', v_prop_id, 'expense', 'AC filter replacement',
    950.00, 'Maintenance', '2026-08-12', 'Living room unit',
    v_receipt, 'demo_seed', '2026-08-12 14:00:00+08', FALSE),
  ('d2612002-0002-4002-8002-000000000010', v_prop_id, 'income', 'Parking rental — slot B2',
    3500.00, 'Other', '2026-08-01', 'Monthly slot lease to neighbor',
    NULL, 'demo_seed', '2026-08-01 11:00:00+08', FALSE),
  ('d2612002-0002-4002-8002-000000000011', v_prop_id, 'income', 'Late checkout fee',
    800.00, 'Other', '2026-08-07', 'Eli Santos late checkout',
    NULL, 'demo_seed', '2026-08-07 18:00:00+08', FALSE),
  ('d2612002-0002-4002-8002-000000000012', v_prop_id, 'expense', 'Internet (PLDT)',
    1899.00, 'Utilities', '2026-08-20', 'Fiber plan',
    NULL, 'demo_seed', NULL, TRUE),
  -- July + September for period navigation
  ('d2612002-0002-4002-8002-000000000021', v_prop_id, 'expense', 'Condo dues — July',
    8500.00, 'Amortization', '2026-07-01', 'Monthly association dues',
    v_receipt, 'demo_seed', '2026-07-01 10:00:00+08', FALSE),
  ('d2612002-0002-4002-8002-000000000022', v_prop_id, 'income', 'Parking rental — slot B2',
    3500.00, 'Other', '2026-07-01', 'Monthly slot lease to neighbor',
    NULL, 'demo_seed', '2026-07-01 11:00:00+08', FALSE),
  ('d2612002-0002-4002-8002-000000000023', v_prop_id, 'expense', 'Condo dues — September',
    8500.00, 'Amortization', '2026-09-01', 'Monthly association dues',
    NULL, 'demo_seed', NULL, TRUE),
  ('d2612002-0002-4002-8002-000000000024', v_prop_id, 'expense', 'Meralco bill',
    3400.00, 'Utilities', '2026-09-05', 'August usage billed in September',
    NULL, 'demo_seed', NULL, TRUE);

  INSERT INTO public.maintenance_items (
    id, property_id, label, category, scheduled_on, notes,
    recurrence_interval, telegram_reminder_enabled, telegram_due_date, telegram_days_before,
    completed_at, created_by
  ) VALUES
  ('d2612003-0003-4003-8003-000000000001', v_prop_id,
    'Deep clean living area', 'Cleaning', '2026-08-03',
    'Post-checkout deep clean before next guest',
    NULL, FALSE, NULL, 3, '2026-08-03 17:00:00+08', 'demo_seed'),
  ('d2612003-0003-4003-8003-000000000002', v_prop_id,
    'Replace shower head', 'Plumbing', '2026-08-06',
    'Guest reported weak pressure',
    NULL, TRUE, '2026-08-06', 2, '2026-08-06 15:00:00+08', 'demo_seed'),
  ('d2612003-0003-4003-8003-000000000003', v_prop_id,
    'Pest control spray', 'Pest Control', '2026-08-09',
    'Quarterly kitchen + balcony treatment',
    'quarterly', TRUE, '2026-08-09', 3, NULL, 'demo_seed'),
  ('d2612003-0003-4003-8003-000000000004', v_prop_id,
    'Check smoke detectors', 'Safety', '2026-08-11',
    'Battery test all detectors',
    'yearly', TRUE, '2026-08-11', 5, NULL, 'demo_seed'),
  ('d2612003-0003-4003-8003-000000000005', v_prop_id,
    'Wash comforter set', 'Amenities', '2026-08-12',
    'Before Iris Tan checkout turnover',
    NULL, FALSE, NULL, 3, NULL, 'demo_seed'),
  ('d2612003-0003-4003-8003-000000000006', v_prop_id,
    'Fridge gasket inspection', 'Appliance', '2026-08-15',
    'Seal looks worn near freezer door',
    NULL, TRUE, '2026-08-15', 3, NULL, 'demo_seed'),
  ('d2612003-0003-4003-8003-000000000007', v_prop_id,
    'Restock cleaning supplies', 'Supplies', '2026-08-18',
    'Bleach, microfiber cloths, trash bags',
    'monthly', FALSE, NULL, 3, NULL, 'demo_seed'),
  ('d2612003-0003-4003-8003-000000000008', v_prop_id,
    'Outlet cover replacement', 'Electrical', '2026-08-22',
    'Bedroom cracked cover',
    NULL, FALSE, NULL, 3, NULL, 'demo_seed'),
  ('d2612003-0003-4003-8003-000000000009', v_prop_id,
    'Balcony drain clear', 'Plumbing', '2026-08-25',
    'Rainy season clog risk',
    NULL, TRUE, '2026-08-25', 4, NULL, 'demo_seed'),
  ('d2612003-0003-4003-8003-000000000010', v_prop_id,
    'AC filter clean', 'Appliance', '2026-08-28',
    'Monthly filter rinse',
    'monthly', TRUE, '2026-08-28', 2, NULL, 'demo_seed'),
  -- July completed + September upcoming
  ('d2612003-0003-4003-8003-000000000011', v_prop_id,
    'AC filter clean', 'Appliance', '2026-07-15',
    'Monthly filter rinse',
    'monthly', TRUE, '2026-07-15', 2, '2026-07-15 11:00:00+08', 'demo_seed'),
  ('d2612003-0003-4003-8003-000000000012', v_prop_id,
    'Replace hallway bulb', 'Electrical', '2026-07-25',
    'Warm LED replacement',
    NULL, FALSE, NULL, 3, '2026-07-25 16:00:00+08', 'demo_seed'),
  ('d2612003-0003-4003-8003-000000000013', v_prop_id,
    'Deep clean before September', 'Cleaning', '2026-09-01',
    'Pre busy season turnover',
    NULL, TRUE, '2026-09-01', 3, NULL, 'demo_seed'),
  ('d2612003-0003-4003-8003-000000000014', v_prop_id,
    'Water heater descale', 'Plumbing', '2026-09-12',
    'Annual maintenance',
    'yearly', TRUE, '2026-09-12', 5, NULL, 'demo_seed');

  RAISE NOTICE 'seed-monaco-2612: loaded demo data for property %', v_prop_id;
END $$;
