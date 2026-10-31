-- Dashboard demo data for local / db reset (bookings + finance + maintenance).
-- Target: org `kame-homes` + property `kame-home` (Jul–Oct 2026 look full; Oct = mostly 1-night).
-- Safe to re-run: deletes prior rows tagged booking_source/created_by = 'demo_seed'.
-- Mock receipt/ID images: Unsplash (same pattern as marketing fixtures).

DO $$
DECLARE
  v_org_id UUID;
  v_prop_id UUID;
  v_azure_studio UUID := 'b2222222-2222-4222-8222-222222222201';
  v_azure_1br UUID := 'b2222222-2222-4222-8222-222222222202';
  v_receipt TEXT := 'https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=800&q=80';
  v_id TEXT := 'https://images.unsplash.com/photo-1589829085413-56de8ae18c73?w=800&q=80';
  v_pet TEXT := 'https://images.unsplash.com/photo-1543466835-00a7907e9de1?w=800&q=80';
  v_vax TEXT := 'https://images.unsplash.com/photo-1584515933487-779824d15320?w=800&q=80';
BEGIN
  SELECT id INTO v_org_id FROM public.organizations WHERE slug = 'kame-homes' LIMIT 1;
  SELECT id INTO v_prop_id FROM public.properties WHERE slug = 'kame-home' AND organization_id = v_org_id LIMIT 1;

  IF v_org_id IS NULL OR v_prop_id IS NULL THEN
    RAISE NOTICE 'seed-dashboard-demo-data: kame-homes / kame-home not found — skipped';
    RETURN;
  END IF;

  DELETE FROM public.guest_submissions WHERE booking_source = 'demo_seed';
  DELETE FROM public.finance_line_items WHERE created_by = 'demo_seed';
  DELETE FROM public.maintenance_items WHERE created_by = 'demo_seed';

  -- ═══════════════════════════════════════════════════════════════════════════
  -- Bookings — Monaco 2604 / kame-homes org (near-full Jul / Aug / Sep calendars, varied statuses)
  -- ═══════════════════════════════════════════════════════════════════════════
  INSERT INTO public.guest_submissions (
    id, property_id, status, booking_source,
    guest_facebook_name, primary_guest_name, guest_email, guest_phone_number, guest_address,
    check_in_date, check_out_date, check_in_time, check_out_time,
    nationality, number_of_adults, number_of_children, number_of_nights,
    guest2_name, guest_special_requests, find_us, find_us_details,
    need_parking, car_plate_number, car_brand_model, car_color,
    has_pets, pet_name, pet_breed, pet_age, pet_type, pet_vaccination_date, pet_vaccination_url, pet_image_url,
    payment_receipt_url, valid_id_url,
    unit_owner, tower_and_unit_number, owner_onsite_contact_person, owner_contact_number,
    booking_rate, down_payment, balance, security_deposit, pet_fee,
    guest_balance_paid_amount, status_updated_at, created_at, updated_at
  ) VALUES
  -- ── July 2026 (mostly completed) ──────────────────────────────────────────
  (
    'c3333333-3333-4333-8333-333333333341', v_prop_id, 'COMPLETED', 'demo_seed',
    'June Vale', 'June A. Vale', 'june.vale.demo@example.com', '09171230101',
    '1 Lake Shore, Tagaytay',
    '07-01-2026', '07-03-2026', '14:00', '11:00',
    'Filipino', 2, 0, 2, 'Kyle Vale', 'Anniversary weekend', 'Airbnb', NULL,
    TRUE, 'JUL 1001', 'Toyota Vios', 'White',
    FALSE, NULL, NULL, NULL, NULL, NULL, NULL, NULL,
    v_receipt, v_id,
    'Michael Manlulu', 'Monaco 2604', 'Michael D Manlulu', '09625647541',
    5600.00, 2000.00, 0.00, 1600.00, NULL,
    3600.00, '2026-07-03 12:00:00+08', '2026-06-20 09:00:00+08', now()
  ),
  (
    'c3333333-3333-4333-8333-333333333342', v_prop_id, 'COMPLETED', 'demo_seed',
    'Lia Parks', 'Lia B. Parks', 'lia.parks.demo@example.com', '09171230102',
    '22 Espana Blvd, Manila',
    '07-03-2026', '07-05-2026', '14:00', '11:00',
    'Filipino', 1, 0, 2, NULL, 'Quiet room preferred', 'Instagram', NULL,
    FALSE, NULL, NULL, NULL,
    FALSE, NULL, NULL, NULL, NULL, NULL, NULL, NULL,
    v_receipt, v_id,
    'Michael Manlulu', 'Monaco 2604', 'Michael D Manlulu', '09625647541',
    5000.00, 2000.00, 0.00, 1600.00, NULL,
    3000.00, '2026-07-05 12:00:00+08', '2026-06-22 10:00:00+08', now()
  ),
  (
    'c3333333-3333-4333-8333-333333333343', v_prop_id, 'COMPLETED', 'demo_seed',
    'Marco Diaz', 'Marco C. Diaz', 'marco.diaz.demo@example.com', '09171230103',
    '9 Bel-Air, Makati',
    '07-05-2026', '07-08-2026', '14:00', '11:00',
    'Filipino', 2, 1, 3, 'Nina Diaz', 'Extra towels please', 'Facebook', NULL,
    TRUE, 'JUL 2002', 'Honda Civic', 'Black',
    FALSE, NULL, NULL, NULL, NULL, NULL, NULL, NULL,
    v_receipt, v_id,
    'Michael Manlulu', 'Monaco 2604', 'Michael D Manlulu', '09625647541',
    7800.00, 3000.00, 0.00, 2000.00, NULL,
    4800.00, '2026-07-08 12:00:00+08', '2026-06-25 11:00:00+08', now()
  ),
  (
    'c3333333-3333-4333-8333-333333333344', v_prop_id, 'COMPLETED', 'demo_seed',
    'Owen Frost', 'Owen D. Frost', 'owen.frost.demo@example.com', '09171230104',
    '15 Greenhills, San Juan',
    '07-08-2026', '07-10-2026', '14:00', '11:00',
    'American', 2, 0, 2, 'Pam Frost', 'Late check-out needed', 'Airbnb', NULL,
    FALSE, NULL, NULL, NULL,
    TRUE, 'Buddy', 'Labrador', '4 years old', 'Dog', '02-10-2026', v_vax, v_pet,
    v_receipt, v_id,
    'Michael Manlulu', 'Monaco 2604', 'Michael D Manlulu', '09625647541',
    6200.00, 2500.00, 0.00, 1800.00, 500.00,
    3700.00, '2026-07-10 12:00:00+08', '2026-06-28 08:00:00+08', now()
  ),
  (
    'c3333333-3333-4333-8333-333333333345', v_prop_id, 'COMPLETED', 'demo_seed',
    'Quinn Hale', 'Quinn E. Hale', 'quinn.hale.demo@example.com', '09171230105',
    '3 Kapitolyo, Pasig',
    '07-10-2026', '07-12-2026', '14:00', '11:00',
    'Filipino', 2, 0, 2, 'Rita Hale', NULL, 'Tiktok', NULL,
    TRUE, 'JUL 3003', 'Mitsubishi Xpander', 'Silver',
    FALSE, NULL, NULL, NULL, NULL, NULL, NULL, NULL,
    v_receipt, v_id,
    'Michael Manlulu', 'Monaco 2604', 'Michael D Manlulu', '09625647541',
    5600.00, 2000.00, 0.00, 1600.00, NULL,
    3600.00, '2026-07-12 12:00:00+08', '2026-07-01 09:00:00+08', now()
  ),
  (
    'c3333333-3333-4333-8333-333333333346', v_prop_id, 'COMPLETED', 'demo_seed',
    'Sam Ibarra', 'Sam F. Ibarra', 'sam.ibarra.demo@example.com', '09171230106',
    '44 Tomas Morato, QC',
    '07-12-2026', '07-15-2026', '14:00', '11:00',
    'Filipino', 3, 0, 3, 'Tess Ibarra', 'Need extra pillows', 'Friend', 'Work colleague',
    FALSE, NULL, NULL, NULL,
    FALSE, NULL, NULL, NULL, NULL, NULL, NULL, NULL,
    v_receipt, v_id,
    'Michael Manlulu', 'Monaco 2604', 'Michael D Manlulu', '09625647541',
    8400.00, 3500.00, 0.00, 2000.00, NULL,
    4900.00, '2026-07-15 12:00:00+08', '2026-07-02 10:00:00+08', now()
  ),
  (
    'c3333333-3333-4333-8333-333333333347', v_prop_id, 'COMPLETED', 'demo_seed',
    'Uma James', 'Uma G. James', 'uma.james.demo@example.com', '09171230107',
    '8 Rockwell, Makati',
    '07-15-2026', '07-17-2026', '14:00', '11:00',
    'Filipino', 1, 0, 2, NULL, 'Early check-in if possible', 'Airbnb', NULL,
    FALSE, NULL, NULL, NULL,
    FALSE, NULL, NULL, NULL, NULL, NULL, NULL, NULL,
    v_receipt, v_id,
    'Michael Manlulu', 'Monaco 2604', 'Michael D Manlulu', '09625647541',
    5200.00, 2000.00, 0.00, 1600.00, NULL,
    3200.00, '2026-07-17 12:00:00+08', '2026-07-05 11:00:00+08', now()
  ),
  (
    'c3333333-3333-4333-8333-333333333348', v_prop_id, 'COMPLETED', 'demo_seed',
    'Vince Kwan', 'Vince H. Kwan', 'vince.kwan.demo@example.com', '09171230108',
    '19 BGC, Taguig',
    '07-17-2026', '07-20-2026', '14:00', '11:00',
    'Filipino', 2, 0, 3, 'Willa Kwan', 'Prefer higher floor', 'Instagram', NULL,
    TRUE, 'JUL 4004', 'Ford Ranger', 'Gray',
    FALSE, NULL, NULL, NULL, NULL, NULL, NULL, NULL,
    v_receipt, v_id,
    'Michael Manlulu', 'Monaco 2604', 'Michael D Manlulu', '09625647541',
    8700.00, 3500.00, 0.00, 2000.00, NULL,
    5200.00, '2026-07-20 12:00:00+08', '2026-07-08 12:00:00+08', now()
  ),
  (
    'c3333333-3333-4333-8333-333333333349', v_prop_id, 'COMPLETED', 'demo_seed',
    'Xena Lopez', 'Xena I. Lopez', 'xena.lopez.demo@example.com', '09171230109',
    '6 Alabang, Muntinlupa',
    '07-20-2026', '07-22-2026', '14:00', '11:00',
    'Filipino', 2, 0, 2, 'Yuri Lopez', NULL, 'Facebook', NULL,
    FALSE, NULL, NULL, NULL,
    FALSE, NULL, NULL, NULL, NULL, NULL, NULL, NULL,
    v_receipt, v_id,
    'Michael Manlulu', 'Monaco 2604', 'Michael D Manlulu', '09625647541',
    5600.00, 2000.00, 0.00, 1600.00, NULL,
    3600.00, '2026-07-22 12:00:00+08', '2026-07-10 09:00:00+08', now()
  ),
  (
    'c3333333-3333-4333-8333-333333333350', v_prop_id, 'COMPLETED', 'demo_seed',
    'Yves Mercado', 'Yves J. Mercado', 'yves.mercado.demo@example.com', '09171230110',
    '27 Commonwealth, QC',
    '07-22-2026', '07-25-2026', '14:00', '11:00',
    'Filipino', 4, 0, 3, 'Zia Mercado', 'Family trip', 'Airbnb', NULL,
    TRUE, 'JUL 5005', 'Nissan Navara', 'Red',
    FALSE, NULL, NULL, NULL, NULL, NULL, NULL, NULL,
    v_receipt, v_id,
    'Michael Manlulu', 'Monaco 2604', 'Michael D Manlulu', '09625647541',
    9800.00, 4000.00, 0.00, 2500.00, NULL,
    5800.00, '2026-07-25 12:00:00+08', '2026-07-12 14:00:00+08', now()
  ),
  (
    'c3333333-3333-4333-8333-333333333351', v_prop_id, 'CANCELLED', 'demo_seed',
    'Ada Nolasco', 'Ada K. Nolasco', 'ada.nolasco.demo@example.com', '09171230111',
    '11 Ortigas, Pasig',
    '07-14-2026', '07-16-2026', '14:00', '11:00',
    'Filipino', 2, 0, 2, NULL, 'Cancelled — schedule conflict', 'Others', 'Walk-in inquiry',
    FALSE, NULL, NULL, NULL,
    FALSE, NULL, NULL, NULL, NULL, NULL, NULL, NULL,
    v_receipt, v_id,
    'Michael Manlulu', 'Monaco 2604', 'Michael D Manlulu', '09625647541',
    5200.00, 1500.00, 3700.00, 1600.00, NULL,
    NULL, '2026-07-11 10:00:00+08', '2026-07-08 16:00:00+08', now()
  ),
  (
    'c3333333-3333-4333-8333-333333333352', v_prop_id, 'COMPLETED', 'demo_seed',
    'Bea Ortega', 'Bea L. Ortega', 'bea.ortega.demo@example.com', '09171230112',
    '50 Maginhawa, QC',
    '07-25-2026', '07-28-2026', '14:00', '11:00',
    'Filipino', 2, 0, 3, 'Ced Ortega', 'Quiet room requested', 'Instagram', NULL,
    FALSE, NULL, NULL, NULL,
    FALSE, NULL, NULL, NULL, NULL, NULL, NULL, NULL,
    v_receipt, v_id,
    'Michael Manlulu', 'Monaco 2604', 'Michael D Manlulu', '09625647541',
    8400.00, 3000.00, 0.00, 2000.00, NULL,
    5400.00, '2026-07-28 12:00:00+08', '2026-07-15 09:00:00+08', now()
  ),
  (
    'c3333333-3333-4333-8333-333333333301', v_prop_id, 'COMPLETED', 'demo_seed',
    'Ana Reyes', 'Ana M. Reyes', 'ana.reyes.demo@example.com', '09171230001',
    '12 Mabini St, San Fernando, Pampanga',
    '07-28-2026', '07-31-2026', '14:00', '11:00',
    'Filipino', 2, 0, 3, 'Luis Reyes', 'Quiet room preferred', 'Airbnb', NULL,
    TRUE, 'ABC 1234', 'Toyota Vios', 'White',
    FALSE, NULL, NULL, NULL, NULL, NULL, NULL, NULL,
    v_receipt, v_id,
    'Michael Manlulu', 'Monaco 2604', 'Michael D Manlulu', '09625647541',
    8400.00, 3000.00, 0.00, 2000.00, NULL,
    5400.00, '2026-07-31 12:00:00+08', '2026-07-20 09:00:00+08', now()
  ),
  (
    'c3333333-3333-4333-8333-333333333317', v_prop_id, 'IMPORTED', 'demo_seed',
    'Chris Dee', 'Chris M. Dee', 'chris.dee.demo@example.com', '09171230017',
    '17 Legazpi Village, Makati',
    '06-28-2026', '06-30-2026', '14:00', '11:00',
    'Filipino', 2, 0, 2, NULL, 'Imported historical stay (June)', 'Others', 'CSV import',
    FALSE, NULL, NULL, NULL,
    FALSE, NULL, NULL, NULL, NULL, NULL, NULL, NULL,
    v_receipt, v_id,
    'Michael Manlulu', 'Monaco 2604', 'Michael D Manlulu', '09625647541',
    4800.00, 4800.00, 0.00, 1500.00, NULL,
    0.00, '2026-06-30 12:00:00+08', '2026-06-15 08:00:00+08', now()
  ),

  -- ── August 2026 (pipeline + current stays) ────────────────────────────────
  (
    'c3333333-3333-4333-8333-333333333302', v_prop_id, 'COMPLETED', 'demo_seed',
    'Ben Cruz', 'Ben A. Cruz', 'ben.cruz.demo@example.com', '09171230002',
    '45 Rizal Ave, Angeles City',
    '08-01-2026', '08-03-2026', '14:00', '11:00',
    'Filipino', 2, 1, 2, 'Carla Cruz', 'Extra towels please', 'Facebook', NULL,
    FALSE, NULL, NULL, NULL,
    FALSE, NULL, NULL, NULL, NULL, NULL, NULL, NULL,
    v_receipt, v_id,
    'Michael Manlulu', 'Monaco 2604', 'Michael D Manlulu', '09625647541',
    5600.00, 2000.00, 0.00, 1600.00, NULL,
    3600.00, '2026-08-03 12:00:00+08', '2026-07-25 10:00:00+08', now()
  ),
  (
    'c3333333-3333-4333-8333-333333333303', v_prop_id, 'COMPLETED', 'demo_seed',
    'Dana Lim', 'Dana P. Lim', 'dana.lim.demo@example.com', '09171230003',
    '88 Ayala Ave, Makati',
    '08-03-2026', '08-05-2026', '15:00', '11:00',
    'Filipino', 1, 0, 2, NULL, 'Early check-in if possible', 'Instagram', NULL,
    TRUE, 'XYZ 7788', 'Honda Civic', 'Black',
    FALSE, NULL, NULL, NULL, NULL, NULL, NULL, NULL,
    v_receipt, v_id,
    'Michael Manlulu', 'Monaco 2604', 'Michael D Manlulu', '09625647541',
    5200.00, 2000.00, 0.00, 1600.00, NULL,
    3200.00, '2026-08-05 12:00:00+08', '2026-07-28 11:00:00+08', now()
  ),
  (
    'c3333333-3333-4333-8333-333333333304', v_prop_id, 'PENDING_SD_REFUND', 'demo_seed',
    'Eli Santos', 'Eli R. Santos', 'eli.santos.demo@example.com', '09171230004',
    '3 Lakeview Dr, Tagaytay',
    '08-05-2026', '08-07-2026', '14:00', '11:00',
    'Filipino', 2, 0, 2, 'Faye Santos', 'Late check-out needed', 'Friend', 'College classmate',
    FALSE, NULL, NULL, NULL,
    FALSE, NULL, NULL, NULL, NULL, NULL, NULL, NULL,
    v_receipt, v_id,
    'Michael Manlulu', 'Monaco 2604', 'Michael D Manlulu', '09625647541',
    5800.00, 2500.00, 0.00, 1800.00, NULL,
    3300.00, '2026-08-07 14:00:00+08', '2026-07-30 08:00:00+08', now()
  ),
  (
    'c3333333-3333-4333-8333-333333333305', v_prop_id, 'READY_FOR_CHECKOUT', 'demo_seed',
    'Gina Torres', 'Gina L. Torres', 'gina.torres.demo@example.com', '09171230005',
    '19 Capas St, Tarlac',
    '08-07-2026', '08-09-2026', '14:00', '11:00',
    'Filipino', 3, 0, 2, 'Hank Torres', 'Need extra pillows', 'Airbnb', NULL,
    TRUE, 'DEF 5566', 'Mitsubishi Xpander', 'Silver',
    TRUE, 'Mochi', 'Poodle', '2 years old', 'Dog', '01-15-2026', v_vax, v_pet,
    v_receipt, v_id,
    'Michael Manlulu', 'Monaco 2604', 'Michael D Manlulu', '09625647541',
    7200.00, 3000.00, 0.00, 2000.00, 500.00,
    4200.00, '2026-08-07 15:00:00+08', '2026-08-01 09:00:00+08', now()
  ),
  (
    'c3333333-3333-4333-8333-333333333306', v_prop_id, 'READY_FOR_CHECKIN', 'demo_seed',
    'Iris Tan', 'Iris K. Tan', 'iris.tan.demo@example.com', '09171230006',
    '77 Ortigas Ave, Pasig',
    '08-09-2026', '08-12-2026', '14:00', '11:00',
    'Filipino', 2, 0, 3, 'Jake Tan', 'Ground floor preferred', 'Tiktok', NULL,
    FALSE, NULL, NULL, NULL,
    FALSE, NULL, NULL, NULL, NULL, NULL, NULL, NULL,
    v_receipt, v_id,
    'Michael Manlulu', 'Monaco 2604', 'Michael D Manlulu', '09625647541',
    8400.00, 3500.00, 4900.00, 2000.00, NULL,
    NULL, '2026-08-08 16:00:00+08', '2026-08-02 10:00:00+08', now()
  ),
  (
    'c3333333-3333-4333-8333-333333333307', v_prop_id, 'PENDING_DOCUMENTS', 'demo_seed',
    'Kara Ong', 'Kara S. Ong', 'kara.ong.demo@example.com', '09171230007',
    '5 BGC High St, Taguig',
    '08-12-2026', '08-14-2026', '14:00', '11:00',
    'Filipino', 2, 0, 2, 'Leo Ong', 'Quiet room requested', 'Instagram', NULL,
    TRUE, 'GHI 9900', 'Ford Ranger', 'Gray',
    FALSE, NULL, NULL, NULL, NULL, NULL, NULL, NULL,
    v_receipt, v_id,
    'Michael Manlulu', 'Monaco 2604', 'Michael D Manlulu', '09625647541',
    6200.00, 2500.00, 3700.00, 1800.00, NULL,
    NULL, '2026-08-08 11:00:00+08', '2026-08-04 12:00:00+08', now()
  ),
  (
    'c3333333-3333-4333-8333-333333333308', v_prop_id, 'PENDING_REVIEW', 'demo_seed',
    'Mia Uy', 'Mia C. Uy', 'mia.uy.demo@example.com', '09171230008',
    '21 Maginhawa, Quezon City',
    '08-14-2026', '08-16-2026', '14:00', '11:00',
    'Filipino', 1, 0, 2, NULL, 'Prefer higher floor', 'Facebook', NULL,
    FALSE, NULL, NULL, NULL,
    FALSE, NULL, NULL, NULL, NULL, NULL, NULL, NULL,
    v_receipt, v_id,
    'Michael Manlulu', 'Monaco 2604', 'Michael D Manlulu', '09625647541',
    5000.00, 1500.00, 3500.00, 1600.00, NULL,
    NULL, '2026-08-08 18:00:00+08', '2026-08-06 14:00:00+08', now()
  ),
  (
    'c3333333-3333-4333-8333-333333333309', v_prop_id, 'PENDING_GAF', 'demo_seed',
    'Nina Go', 'Nina D. Go', 'nina.go.demo@example.com', '09171230009',
    '9 Seaside Blvd, Parañaque',
    '08-16-2026', '08-18-2026', '14:00', '11:00',
    'Filipino', 2, 1, 2, 'Owen Go', 'Extra towels please', 'Airbnb', NULL,
    FALSE, NULL, NULL, NULL,
    FALSE, NULL, NULL, NULL, NULL, NULL, NULL, NULL,
    v_receipt, v_id,
    'Michael Manlulu', 'Monaco 2604', 'Michael D Manlulu', '09625647541',
    6400.00, 2800.00, 3600.00, 1800.00, NULL,
    NULL, '2026-08-08 09:00:00+08', '2026-08-05 09:00:00+08', now()
  ),
  (
    'c3333333-3333-4333-8333-333333333310', v_prop_id, 'PENDING_PARKING_REQUEST', 'demo_seed',
    'Paul Sy', 'Paul E. Sy', 'paul.sy.demo@example.com', '09171230010',
    '14 Commonwealth Ave, QC',
    '08-18-2026', '08-20-2026', '14:00', '11:00',
    'Filipino', 2, 0, 2, 'Quinn Sy', 'Need parking near lobby', 'Others', 'Company referral',
    TRUE, 'JKL 1122', 'Nissan Navara', 'Red',
    FALSE, NULL, NULL, NULL, NULL, NULL, NULL, NULL,
    v_receipt, v_id,
    'Michael Manlulu', 'Monaco 2604', 'Michael D Manlulu', '09625647541',
    6100.00, 2500.00, 3600.00, 1800.00, NULL,
    NULL, '2026-08-08 10:00:00+08', '2026-08-05 15:00:00+08', now()
  ),
  (
    'c3333333-3333-4333-8333-333333333311', v_prop_id, 'PENDING_PET_REQUEST', 'demo_seed',
    'Rita Yu', 'Rita F. Yu', 'rita.yu.demo@example.com', '09171230011',
    '66 Katipunan Ave, QC',
    '08-20-2026', '08-22-2026', '14:00', '11:00',
    'Filipino', 2, 0, 2, 'Sam Yu', 'Travelling with small dog', 'Instagram', NULL,
    FALSE, NULL, NULL, NULL,
    TRUE, 'Coco', 'Shih Tzu', '3 years old', 'Dog', '03-01-2026', v_vax, v_pet,
    v_receipt, v_id,
    'Michael Manlulu', 'Monaco 2604', 'Michael D Manlulu', '09625647541',
    6500.00, 2500.00, 4000.00, 2000.00, 500.00,
    NULL, '2026-08-08 12:00:00+08', '2026-08-06 11:00:00+08', now()
  ),
  (
    'c3333333-3333-4333-8333-333333333312', v_prop_id, 'READY_FOR_CHECKIN', 'demo_seed',
    'Tess Wu', 'Tess G. Wu', 'tess.wu.demo@example.com', '09171230012',
    '2 Rockwell Dr, Makati',
    '08-22-2026', '08-25-2026', '14:00', '11:00',
    'Filipino', 2, 0, 3, 'Uma Wu', 'Anniversary stay — quiet please', 'Friend', 'Previous guest',
    TRUE, 'MNO 3344', 'Toyota Vios', 'Blue',
    FALSE, NULL, NULL, NULL, NULL, NULL, NULL, NULL,
    v_receipt, v_id,
    'Michael Manlulu', 'Monaco 2604', 'Michael D Manlulu', '09625647541',
    9000.00, 4000.00, 5000.00, 2000.00, NULL,
    NULL, '2026-08-08 13:00:00+08', '2026-08-03 16:00:00+08', now()
  ),
  (
    'c3333333-3333-4333-8333-333333333313', v_prop_id, 'PENDING_REVIEW', 'demo_seed',
    'Vera Ng', 'Vera H. Ng', 'vera.ng.demo@example.com', '09171230013',
    '30 Shaw Blvd, Mandaluyong',
    '08-25-2026', '08-28-2026', '14:00', '11:00',
    'Filipino', 4, 0, 3, 'Will Ng', 'Family trip — extra pillows', 'Airbnb', NULL,
    FALSE, NULL, NULL, NULL,
    FALSE, NULL, NULL, NULL, NULL, NULL, NULL, NULL,
    v_receipt, v_id,
    'Michael Manlulu', 'Monaco 2604', 'Michael D Manlulu', '09625647541',
    9800.00, 4000.00, 5800.00, 2500.00, NULL,
    NULL, '2026-08-08 17:00:00+08', '2026-08-07 08:00:00+08', now()
  ),
  (
    'c3333333-3333-4333-8333-333333333314', v_prop_id, 'READY_FOR_CHECKIN', 'demo_seed',
    'Xander Co', 'Xander I. Co', 'xander.co.demo@example.com', '09171230014',
    '8 Forbes Park, Makati',
    '08-28-2026', '08-31-2026', '14:00', '11:00',
    'Filipino', 2, 0, 3, 'Yna Co', 'Late arrival around 8pm', 'Tiktok', NULL,
    TRUE, 'PQR 7788', 'Honda Civic', 'White',
    FALSE, NULL, NULL, NULL, NULL, NULL, NULL, NULL,
    v_receipt, v_id,
    'Michael Manlulu', 'Monaco 2604', 'Michael D Manlulu', '09625647541',
    8700.00, 3500.00, 5200.00, 2000.00, NULL,
    NULL, '2026-08-08 19:00:00+08', '2026-08-04 19:00:00+08', now()
  ),
  (
    'c3333333-3333-4333-8333-333333333315', v_prop_id, 'CANCELLED', 'demo_seed',
    'Zed Park', 'Zed J. Park', 'zed.park.demo@example.com', '09171230015',
    '11 Alabang Hills, Muntinlupa',
    '08-10-2026', '08-13-2026', '14:00', '11:00',
    'Korean', 2, 0, 3, 'Amy Park', 'Cancelled — flight change', 'Airbnb', NULL,
    FALSE, NULL, NULL, NULL,
    FALSE, NULL, NULL, NULL, NULL, NULL, NULL, NULL,
    v_receipt, v_id,
    'Michael Manlulu', 'Monaco 2604', 'Michael D Manlulu', '09625647541',
    8400.00, 2000.00, 6400.00, 2000.00, NULL,
    NULL, '2026-08-06 10:00:00+08', '2026-08-01 12:00:00+08', now()
  ),

  -- ── September 2026 (upcoming pipeline — near-full) ────────────────────────
  (
    'c3333333-3333-4333-8333-333333333361', v_prop_id, 'READY_FOR_CHECKIN', 'demo_seed',
    'Aya Kim', 'Aya L. Kim', 'aya.kim.demo@example.com', '09171230016',
    '4 Bonifacio High St, Taguig',
    '08-31-2026', '09-03-2026', '14:00', '11:00',
    'Filipino', 2, 0, 3, 'Bo Kim', 'Month-end bridge stay', 'Instagram', NULL,
    FALSE, NULL, NULL, NULL,
    FALSE, NULL, NULL, NULL, NULL, NULL, NULL, NULL,
    v_receipt, v_id,
    'Michael Manlulu', 'Monaco 2604', 'Michael D Manlulu', '09625647541',
    9000.00, 3000.00, 6000.00, 2000.00, NULL,
    NULL, '2026-08-08 20:00:00+08', '2026-08-08 20:00:00+08', now()
  ),
  (
    'c3333333-3333-4333-8333-333333333362', v_prop_id, 'PENDING_DOCUMENTS', 'demo_seed',
    'Cora Bell', 'Cora N. Bell', 'cora.bell.demo@example.com', '09171230201',
    '18 Eastwood, QC',
    '09-03-2026', '09-05-2026', '14:00', '11:00',
    'Filipino', 2, 0, 2, 'Dan Bell', 'Need parking', 'Airbnb', NULL,
    TRUE, 'SEP 1101', 'Toyota Vios', 'Blue',
    FALSE, NULL, NULL, NULL, NULL, NULL, NULL, NULL,
    v_receipt, v_id,
    'Michael Manlulu', 'Monaco 2604', 'Michael D Manlulu', '09625647541',
    5800.00, 2000.00, 3800.00, 1600.00, NULL,
    NULL, now(), '2026-08-07 09:00:00+08', now()
  ),
  (
    'c3333333-3333-4333-8333-333333333363', v_prop_id, 'PENDING_REVIEW', 'demo_seed',
    'Eve Chen', 'Eve O. Chen', 'eve.chen.demo@example.com', '09171230202',
    '7 Salcedo Village, Makati',
    '09-05-2026', '09-08-2026', '14:00', '11:00',
    'Filipino', 2, 1, 3, 'Finn Chen', 'Kids travelling — crib if available', 'Facebook', NULL,
    FALSE, NULL, NULL, NULL,
    FALSE, NULL, NULL, NULL, NULL, NULL, NULL, NULL,
    v_receipt, v_id,
    'Michael Manlulu', 'Monaco 2604', 'Michael D Manlulu', '09625647541',
    9000.00, 3500.00, 5500.00, 2000.00, NULL,
    NULL, now(), '2026-08-08 11:00:00+08', now()
  ),
  (
    'c3333333-3333-4333-8333-333333333364', v_prop_id, 'PENDING_GAF', 'demo_seed',
    'Gwen Drew', 'Gwen P. Drew', 'gwen.drew.demo@example.com', '09171230203',
    '33 Shaw Blvd, Pasig',
    '09-08-2026', '09-10-2026', '14:00', '11:00',
    'Filipino', 2, 0, 2, 'Hugo Drew', NULL, 'Airbnb', NULL,
    FALSE, NULL, NULL, NULL,
    FALSE, NULL, NULL, NULL, NULL, NULL, NULL, NULL,
    v_receipt, v_id,
    'Michael Manlulu', 'Monaco 2604', 'Michael D Manlulu', '09625647541',
    5600.00, 2000.00, 3600.00, 1600.00, NULL,
    NULL, now(), '2026-08-06 15:00:00+08', now()
  ),
  (
    'c3333333-3333-4333-8333-333333333365', v_prop_id, 'READY_FOR_CHECKIN', 'demo_seed',
    'Ivy Espina', 'Ivy Q. Espina', 'ivy.espina.demo@example.com', '09171230204',
    '2 Ayala Triangle, Makati',
    '09-10-2026', '09-13-2026', '14:00', '11:00',
    'Filipino', 2, 0, 3, 'Joel Espina', 'Business trip — quiet please', 'Friend', 'HR referral',
    TRUE, 'SEP 2202', 'Honda Civic', 'Black',
    FALSE, NULL, NULL, NULL, NULL, NULL, NULL, NULL,
    v_receipt, v_id,
    'Michael Manlulu', 'Monaco 2604', 'Michael D Manlulu', '09625647541',
    8700.00, 3500.00, 5200.00, 2000.00, NULL,
    NULL, now(), '2026-08-05 12:00:00+08', now()
  ),
  (
    'c3333333-3333-4333-8333-333333333366', v_prop_id, 'PENDING_PARKING_REQUEST', 'demo_seed',
    'Kai Flores', 'Kai R. Flores', 'kai.flores.demo@example.com', '09171230205',
    '41 Fairview, QC',
    '09-13-2026', '09-15-2026', '14:00', '11:00',
    'Filipino', 2, 0, 2, 'Lia Flores', 'Large SUV — need tall clearance', 'Tiktok', NULL,
    TRUE, 'SEP 3303', 'Ford Ranger', 'White',
    FALSE, NULL, NULL, NULL, NULL, NULL, NULL, NULL,
    v_receipt, v_id,
    'Michael Manlulu', 'Monaco 2604', 'Michael D Manlulu', '09625647541',
    6000.00, 2500.00, 3500.00, 1800.00, NULL,
    NULL, now(), '2026-08-07 14:00:00+08', now()
  ),
  (
    'c3333333-3333-4333-8333-333333333367', v_prop_id, 'PENDING_PET_REQUEST', 'demo_seed',
    'Mira Gomez', 'Mira S. Gomez', 'mira.gomez.demo@example.com', '09171230206',
    '9 Katipunan, QC',
    '09-15-2026', '09-18-2026', '14:00', '11:00',
    'Filipino', 2, 0, 3, 'Nico Gomez', 'Travelling with cat', 'Instagram', NULL,
    FALSE, NULL, NULL, NULL,
    TRUE, 'Muffin', 'Persian Cat', '2 years old', 'Cat', '04-12-2026', v_vax, v_pet,
    v_receipt, v_id,
    'Michael Manlulu', 'Monaco 2604', 'Michael D Manlulu', '09625647541',
    9200.00, 3500.00, 5700.00, 2000.00, 500.00,
    NULL, now(), '2026-08-08 10:00:00+08', now()
  ),
  (
    'c3333333-3333-4333-8333-333333333368', v_prop_id, 'PENDING_REVIEW', 'demo_seed',
    'Omar Hassan', 'Omar T. Hassan', 'omar.hassan.demo@example.com', '09171230207',
    '14 Legazpi, Makati',
    '09-18-2026', '09-20-2026', '14:00', '11:00',
    'Filipino', 1, 0, 2, NULL, NULL, 'Airbnb', NULL,
    FALSE, NULL, NULL, NULL,
    FALSE, NULL, NULL, NULL, NULL, NULL, NULL, NULL,
    v_receipt, v_id,
    'Michael Manlulu', 'Monaco 2604', 'Michael D Manlulu', '09625647541',
    5200.00, 1500.00, 3700.00, 1600.00, NULL,
    NULL, now(), '2026-08-08 16:00:00+08', now()
  ),
  (
    'c3333333-3333-4333-8333-333333333369', v_prop_id, 'READY_FOR_CHECKIN', 'demo_seed',
    'Pia Inigo', 'Pia U. Inigo', 'pia.inigo.demo@example.com', '09171230208',
    '21 Poblacion, Makati',
    '09-20-2026', '09-23-2026', '14:00', '11:00',
    'Filipino', 2, 0, 3, 'Quin Inigo', 'Birthday surprise decor if allowed', 'Friend', 'Repeat guest',
    TRUE, 'SEP 4404', 'Mitsubishi Xpander', 'Silver',
    FALSE, NULL, NULL, NULL, NULL, NULL, NULL, NULL,
    v_receipt, v_id,
    'Michael Manlulu', 'Monaco 2604', 'Michael D Manlulu', '09625647541',
    9000.00, 4000.00, 5000.00, 2000.00, NULL,
    NULL, now(), '2026-08-04 18:00:00+08', now()
  ),
  (
    'c3333333-3333-4333-8333-333333333370', v_prop_id, 'PENDING_DOCUMENTS', 'demo_seed',
    'Rae Javier', 'Rae V. Javier', 'rae.javier.demo@example.com', '09171230209',
    '5 Cubao, QC',
    '09-23-2026', '09-25-2026', '14:00', '11:00',
    'Filipino', 2, 0, 2, 'Sid Javier', NULL, 'Facebook', NULL,
    FALSE, NULL, NULL, NULL,
    FALSE, NULL, NULL, NULL, NULL, NULL, NULL, NULL,
    v_receipt, v_id,
    'Michael Manlulu', 'Monaco 2604', 'Michael D Manlulu', '09625647541',
    5600.00, 2000.00, 3600.00, 1600.00, NULL,
    NULL, now(), '2026-08-08 12:00:00+08', now()
  ),
  (
    'c3333333-3333-4333-8333-333333333371', v_prop_id, 'PENDING_REVIEW', 'demo_seed',
    'Tara King', 'Tara W. King', 'tara.king.demo@example.com', '09171230210',
    '88 Tomas Morato, QC',
    '09-25-2026', '09-28-2026', '14:00', '11:00',
    'Filipino', 3, 0, 3, 'Uli King', 'Extra towels + pillows', 'Airbnb', NULL,
    TRUE, 'SEP 5505', 'Nissan Navara', 'Gray',
    FALSE, NULL, NULL, NULL, NULL, NULL, NULL, NULL,
    v_receipt, v_id,
    'Michael Manlulu', 'Monaco 2604', 'Michael D Manlulu', '09625647541',
    9300.00, 3500.00, 5800.00, 2200.00, NULL,
    NULL, now(), '2026-08-08 13:00:00+08', now()
  ),
  (
    'c3333333-3333-4333-8333-333333333372', v_prop_id, 'READY_FOR_CHECKIN', 'demo_seed',
    'Vera Lane', 'Vera X. Lane', 'vera.lane.demo@example.com', '09171230211',
    '16 Forbes, Makati',
    '09-28-2026', '09-30-2026', '14:00', '11:00',
    'Filipino', 2, 0, 2, 'Wes Lane', 'Month-end short stay', 'Instagram', NULL,
    FALSE, NULL, NULL, NULL,
    FALSE, NULL, NULL, NULL, NULL, NULL, NULL, NULL,
    v_receipt, v_id,
    'Michael Manlulu', 'Monaco 2604', 'Michael D Manlulu', '09625647541',
    5600.00, 2000.00, 3600.00, 1600.00, NULL,
    NULL, now(), '2026-08-07 17:00:00+08', now()
  ),
  (
    'c3333333-3333-4333-8333-333333333373', v_prop_id, 'CANCELLED', 'demo_seed',
    'Xan Young', 'Xan Y. Young', 'xan.young.demo@example.com', '09171230212',
    '3 Alabang Town Center area',
    '09-12-2026', '09-14-2026', '14:00', '11:00',
    'Filipino', 2, 0, 2, NULL, 'Cancelled — found alternative', 'Airbnb', NULL,
    FALSE, NULL, NULL, NULL,
    FALSE, NULL, NULL, NULL, NULL, NULL, NULL, NULL,
    v_receipt, v_id,
    'Michael Manlulu', 'Monaco 2604', 'Michael D Manlulu', '09625647541',
    5600.00, 1000.00, 4600.00, 1600.00, NULL,
    NULL, '2026-08-08 09:00:00+08', '2026-08-03 09:00:00+08', now()
  );

  -- ── October 2026: mostly 1-night stays (+ one 2-night, one 3-night) ────────
  -- Nights: 12×1 (Oct 1–12) + 3 (13–16) + 4×1 (16–20) + 2 (20–22) + 10×1 (22–Nov 1) = 31
  DECLARE
    v_oct_names TEXT[] := ARRAY[
      'Alex One', 'Blair One', 'Casey One', 'Drew One', 'Eden One', 'Fran One',
      'Gray One', 'Harper One', 'Indie One', 'Jules One', 'Kit One', 'Lane One',
      'Morgan One', 'Noel One', 'Oakley One', 'Parker One', 'Quinn One', 'Remy One',
      'Sage One', 'Tatum One', 'Urban One', 'Val One', 'Wren One', 'Yael One',
      'Zion One', 'Avery One'
    ];
    v_oct_statuses TEXT[] := ARRAY[
      'READY_FOR_CHECKIN', 'PENDING_REVIEW', 'PENDING_DOCUMENTS', 'READY_FOR_CHECKIN',
      'PENDING_REVIEW', 'PENDING_GAF', 'READY_FOR_CHECKIN', 'PENDING_REVIEW',
      'PENDING_DOCUMENTS', 'READY_FOR_CHECKIN', 'PENDING_PARKING_REQUEST', 'PENDING_REVIEW',
      'READY_FOR_CHECKIN', 'PENDING_REVIEW', 'PENDING_DOCUMENTS', 'READY_FOR_CHECKIN',
      'PENDING_REVIEW', 'PENDING_PET_REQUEST', 'READY_FOR_CHECKIN', 'PENDING_REVIEW',
      'PENDING_DOCUMENTS', 'READY_FOR_CHECKIN', 'PENDING_REVIEW', 'READY_FOR_CHECKIN',
      'PENDING_REVIEW', 'READY_FOR_CHECKIN'
    ];
    v_oct_cin DATE;
    v_oct_cout DATE;
    v_oct_i INT := 0;
    v_oct_idx INT;
    v_oct_name TEXT;
    v_oct_slug TEXT;
    v_oct_rate NUMERIC;
  BEGIN
    -- 1-night: Oct 1→2 … Oct 12→13
    FOR v_oct_i IN 1..12 LOOP
      v_oct_cin := DATE '2026-10-01' + (v_oct_i - 1);
      v_oct_cout := v_oct_cin + 1;
      v_oct_idx := v_oct_i;
      v_oct_name := v_oct_names[v_oct_idx];
      v_oct_slug := lower(replace(v_oct_name, ' ', '.'));
      v_oct_rate := 2800.00 + ((v_oct_i % 5) * 100);
      INSERT INTO public.guest_submissions (
        id, property_id, status, booking_source,
        guest_facebook_name, primary_guest_name, guest_email, guest_phone_number, guest_address,
        check_in_date, check_out_date, check_in_time, check_out_time,
        nationality, number_of_adults, number_of_children, number_of_nights,
        guest_special_requests, find_us,
        payment_receipt_url, valid_id_url,
        unit_owner, tower_and_unit_number, owner_onsite_contact_person, owner_contact_number,
        booking_rate, down_payment, balance, security_deposit,
        status_updated_at, created_at, updated_at
      ) VALUES (
        ('c3333333-3333-4333-8333-33333333' || lpad((400 + v_oct_idx)::text, 4, '0'))::uuid,
        v_prop_id, v_oct_statuses[v_oct_idx], 'demo_seed',
        v_oct_name, v_oct_name, v_oct_slug || '.demo@example.com',
        '0917123' || lpad((200 + v_oct_idx)::text, 4, '0'),
        'October single-night demo guest',
        to_char(v_oct_cin, 'MM-DD-YYYY'), to_char(v_oct_cout, 'MM-DD-YYYY'),
        '14:00', '11:00',
        'Filipino', 1, 0, 1,
        '1-night stay demo', 'Airbnb',
        v_receipt, v_id,
        'Michael Manlulu', 'Monaco 2604', 'Michael D Manlulu', '09625647541',
        v_oct_rate, 1000.00, v_oct_rate - 1000.00, 1500.00,
        now(), now() - ((30 - v_oct_i) || ' days')::interval, now()
      );
    END LOOP;

    -- 3-night: Oct 13→16
    INSERT INTO public.guest_submissions (
      id, property_id, status, booking_source,
      guest_facebook_name, primary_guest_name, guest_email, guest_phone_number, guest_address,
      check_in_date, check_out_date, check_in_time, check_out_time,
      nationality, number_of_adults, number_of_children, number_of_nights,
      guest2_name, guest_special_requests, find_us,
      need_parking, car_plate_number, car_brand_model, car_color,
      payment_receipt_url, valid_id_url,
      unit_owner, tower_and_unit_number, owner_onsite_contact_person, owner_contact_number,
      booking_rate, down_payment, balance, security_deposit,
      status_updated_at, created_at, updated_at
    ) VALUES (
      'c3333333-3333-4333-8333-333333334301', v_prop_id, 'READY_FOR_CHECKIN', 'demo_seed',
      'Three Night', 'Pat Three-Night', 'pat.three.demo@example.com', '09171230401',
      'Longer October stay (3 nights)',
      '10-13-2026', '10-16-2026', '14:00', '11:00',
      'Filipino', 2, 0, 3,
      'Sam Three-Night', '3-night stay demo — midweek', 'Airbnb',
      TRUE, 'OCT 3003', 'Honda Civic', 'Black',
      v_receipt, v_id,
      'Michael Manlulu', 'Monaco 2604', 'Michael D Manlulu', '09625647541',
      8400.00, 3000.00, 5400.00, 2000.00,
      now(), '2026-08-08 10:00:00+08', now()
    );

    -- 1-night: Oct 16→17 … Oct 19→20 (4 stays)
    FOR v_oct_i IN 0..3 LOOP
      v_oct_cin := DATE '2026-10-16' + v_oct_i;
      v_oct_cout := v_oct_cin + 1;
      v_oct_idx := 13 + v_oct_i;
      v_oct_name := v_oct_names[v_oct_idx];
      v_oct_slug := lower(replace(v_oct_name, ' ', '.'));
      v_oct_rate := 2800.00 + ((v_oct_i % 4) * 100);
      INSERT INTO public.guest_submissions (
        id, property_id, status, booking_source,
        guest_facebook_name, primary_guest_name, guest_email, guest_phone_number, guest_address,
        check_in_date, check_out_date, check_in_time, check_out_time,
        nationality, number_of_adults, number_of_children, number_of_nights,
        guest_special_requests, find_us,
        payment_receipt_url, valid_id_url,
        unit_owner, tower_and_unit_number, owner_onsite_contact_person, owner_contact_number,
        booking_rate, down_payment, balance, security_deposit,
        status_updated_at, created_at, updated_at
      ) VALUES (
        ('c3333333-3333-4333-8333-33333333' || lpad((400 + v_oct_idx)::text, 4, '0'))::uuid,
        v_prop_id, v_oct_statuses[v_oct_idx], 'demo_seed',
        v_oct_name, v_oct_name, v_oct_slug || '.demo@example.com',
        '0917123' || lpad((200 + v_oct_idx)::text, 4, '0'),
        'October single-night demo guest',
        to_char(v_oct_cin, 'MM-DD-YYYY'), to_char(v_oct_cout, 'MM-DD-YYYY'),
        '14:00', '11:00',
        'Filipino', 1, 0, 1,
        '1-night stay demo', 'Instagram',
        v_receipt, v_id,
        'Michael Manlulu', 'Monaco 2604', 'Michael D Manlulu', '09625647541',
        v_oct_rate, 1000.00, v_oct_rate - 1000.00, 1500.00,
        now(), now() - ((20 - v_oct_i) || ' days')::interval, now()
      );
    END LOOP;

    -- 2-night: Oct 20→22
    INSERT INTO public.guest_submissions (
      id, property_id, status, booking_source,
      guest_facebook_name, primary_guest_name, guest_email, guest_phone_number, guest_address,
      check_in_date, check_out_date, check_in_time, check_out_time,
      nationality, number_of_adults, number_of_children, number_of_nights,
      guest2_name, guest_special_requests, find_us,
      payment_receipt_url, valid_id_url,
      unit_owner, tower_and_unit_number, owner_onsite_contact_person, owner_contact_number,
      booking_rate, down_payment, balance, security_deposit,
      status_updated_at, created_at, updated_at
    ) VALUES (
      'c3333333-3333-4333-8333-333333334201', v_prop_id, 'PENDING_REVIEW', 'demo_seed',
      'Two Night', 'Rio Two-Night', 'rio.two.demo@example.com', '09171230402',
      'Weekend October stay (2 nights)',
      '10-20-2026', '10-22-2026', '14:00', '11:00',
      'Filipino', 2, 0, 2,
      'Sky Two-Night', '2-night stay demo — weekend', 'Facebook',
      v_receipt, v_id,
      'Michael Manlulu', 'Monaco 2604', 'Michael D Manlulu', '09625647541',
      5600.00, 2000.00, 3600.00, 1600.00,
      now(), '2026-08-08 11:00:00+08', now()
    );

    -- 1-night: Oct 22→23 … Oct 31→Nov 1 (10 stays)
    FOR v_oct_i IN 0..9 LOOP
      v_oct_cin := DATE '2026-10-22' + v_oct_i;
      v_oct_cout := v_oct_cin + 1;
      v_oct_idx := 17 + v_oct_i;
      v_oct_name := v_oct_names[v_oct_idx];
      v_oct_slug := lower(replace(v_oct_name, ' ', '.'));
      v_oct_rate := 2800.00 + ((v_oct_i % 5) * 100);
      INSERT INTO public.guest_submissions (
        id, property_id, status, booking_source,
        guest_facebook_name, primary_guest_name, guest_email, guest_phone_number, guest_address,
        check_in_date, check_out_date, check_in_time, check_out_time,
        nationality, number_of_adults, number_of_children, number_of_nights,
        guest_special_requests, find_us,
        payment_receipt_url, valid_id_url,
        unit_owner, tower_and_unit_number, owner_onsite_contact_person, owner_contact_number,
        booking_rate, down_payment, balance, security_deposit,
        status_updated_at, created_at, updated_at
      ) VALUES (
        ('c3333333-3333-4333-8333-33333333' || lpad((400 + v_oct_idx)::text, 4, '0'))::uuid,
        v_prop_id, v_oct_statuses[v_oct_idx], 'demo_seed',
        v_oct_name, v_oct_name, v_oct_slug || '.demo@example.com',
        '0917123' || lpad((200 + v_oct_idx)::text, 4, '0'),
        'October single-night demo guest',
        to_char(v_oct_cin, 'MM-DD-YYYY'), to_char(v_oct_cout, 'MM-DD-YYYY'),
        '14:00', '11:00',
        'Filipino', 1, 0, 1,
        '1-night stay demo', 'Tiktok',
        v_receipt, v_id,
        'Michael Manlulu', 'Monaco 2604', 'Michael D Manlulu', '09625647541',
        v_oct_rate, 1000.00, v_oct_rate - 1000.00, 1500.00,
        now(), now() - ((15 - v_oct_i) || ' days')::interval, now()
      );
    END LOOP;
  END;

  -- Sibling Azure properties (org dashboard multi-property texture)
  IF EXISTS (SELECT 1 FROM public.properties WHERE id = v_azure_studio) THEN
    INSERT INTO public.guest_submissions (
      id, property_id, status, booking_source,
      guest_facebook_name, primary_guest_name, guest_email, guest_phone_number, guest_address,
      check_in_date, check_out_date, check_in_time, check_out_time,
      nationality, number_of_adults, number_of_children, number_of_nights,
      find_us, payment_receipt_url, valid_id_url,
      unit_owner, tower_and_unit_number, owner_onsite_contact_person, owner_contact_number,
      booking_rate, down_payment, balance, security_deposit,
      guest_balance_paid_amount, status_updated_at, created_at, updated_at
    ) VALUES
    (
      'c3333333-3333-4333-8333-333333333381', v_azure_studio, 'COMPLETED', 'demo_seed',
      'Studio Jul', 'Lara N. Vale', 'lara.jul.demo@example.com', '09171230021',
      'Bali Tower guest',
      '07-10-2026', '07-13-2026', '14:00', '11:00',
      'Filipino', 2, 0, 3,
      'Airbnb', v_receipt, v_id,
      'Kame Homes', 'Bali 1101', 'Michael D Manlulu', '09625647541',
      4500.00, 1500.00, 0.00, 1500.00,
      3000.00, '2026-07-13 12:00:00+08', '2026-07-01 10:00:00+08', now()
    ),
    (
      'c3333333-3333-4333-8333-333333333321', v_azure_studio, 'READY_FOR_CHECKIN', 'demo_seed',
      'Studio Guest', 'Lara N. Vale', 'lara.vale.demo@example.com', '09171230021',
      'Bali Tower guest',
      '08-08-2026', '08-11-2026', '14:00', '11:00',
      'Filipino', 2, 0, 3,
      'Airbnb', v_receipt, v_id,
      'Kame Homes', 'Bali 1101', 'Michael D Manlulu', '09625647541',
      4500.00, 1500.00, 3000.00, 1500.00,
      NULL, now(), '2026-08-02 10:00:00+08', now()
    ),
    (
      'c3333333-3333-4333-8333-333333333322', v_azure_studio, 'PENDING_REVIEW', 'demo_seed',
      'Studio Guest 2', 'Mark O. Vale', 'mark.vale.demo@example.com', '09171230022',
      'Bali Tower guest',
      '08-18-2026', '08-20-2026', '14:00', '11:00',
      'Filipino', 1, 0, 2,
      'Facebook', v_receipt, v_id,
      'Kame Homes', 'Bali 1101', 'Michael D Manlulu', '09625647541',
      3200.00, 1000.00, 2200.00, 1200.00,
      NULL, now(), '2026-08-07 10:00:00+08', now()
    ),
    (
      'c3333333-3333-4333-8333-333333333382', v_azure_studio, 'PENDING_REVIEW', 'demo_seed',
      'Studio Sep', 'Mark O. Vale', 'mark.sep.demo@example.com', '09171230022',
      'Bali Tower guest',
      '09-12-2026', '09-15-2026', '14:00', '11:00',
      'Filipino', 2, 0, 3,
      'Instagram', v_receipt, v_id,
      'Kame Homes', 'Bali 1101', 'Michael D Manlulu', '09625647541',
      4800.00, 1500.00, 3300.00, 1500.00,
      NULL, now(), '2026-08-08 10:00:00+08', now()
    );
  END IF;

  IF EXISTS (SELECT 1 FROM public.properties WHERE id = v_azure_1br) THEN
    INSERT INTO public.guest_submissions (
      id, property_id, status, booking_source,
      guest_facebook_name, primary_guest_name, guest_email, guest_phone_number, guest_address,
      check_in_date, check_out_date, check_in_time, check_out_time,
      nationality, number_of_adults, number_of_children, number_of_nights,
      find_us, payment_receipt_url, valid_id_url,
      unit_owner, tower_and_unit_number, owner_onsite_contact_person, owner_contact_number,
      booking_rate, down_payment, balance, security_deposit,
      guest_balance_paid_amount, status_updated_at, created_at, updated_at
    ) VALUES
    (
      'c3333333-3333-4333-8333-333333333391', v_azure_1br, 'COMPLETED', 'demo_seed',
      'Lagoon Jul', 'Noel P. Day', 'noel.jul.demo@example.com', '09171230031',
      'Lagoon view unit',
      '07-18-2026', '07-21-2026', '14:00', '11:00',
      'Filipino', 2, 1, 3,
      'Airbnb', v_receipt, v_id,
      'Kame Homes', 'Bali 1205', 'Michael D Manlulu', '09625647541',
      7800.00, 3000.00, 0.00, 2000.00,
      4800.00, '2026-07-21 12:00:00+08', '2026-07-05 10:00:00+08', now()
    ),
    (
      'c3333333-3333-4333-8333-333333333331', v_azure_1br, 'COMPLETED', 'demo_seed',
      'Lagoon Guest', 'Noel P. Day', 'noel.day.demo@example.com', '09171230031',
      'Lagoon view unit',
      '08-02-2026', '08-05-2026', '14:00', '11:00',
      'Filipino', 2, 1, 3,
      'Airbnb', v_receipt, v_id,
      'Kame Homes', 'Bali 1205', 'Michael D Manlulu', '09625647541',
      7800.00, 3000.00, 0.00, 2000.00,
      4800.00, '2026-08-05 12:00:00+08', '2026-07-28 10:00:00+08', now()
    ),
    (
      'c3333333-3333-4333-8333-333333333332', v_azure_1br, 'READY_FOR_CHECKOUT', 'demo_seed',
      'Lagoon Guest 2', 'Olive Q. Day', 'olive.day.demo@example.com', '09171230032',
      'Lagoon view unit',
      '08-08-2026', '08-10-2026', '14:00', '11:00',
      'Filipino', 2, 0, 2,
      'Instagram', v_receipt, v_id,
      'Kame Homes', 'Bali 1205', 'Michael D Manlulu', '09625647541',
      5200.00, 2000.00, 0.00, 1600.00,
      3200.00, now(), '2026-08-03 10:00:00+08', now()
    ),
    (
      'c3333333-3333-4333-8333-333333333392', v_azure_1br, 'READY_FOR_CHECKIN', 'demo_seed',
      'Lagoon Sep', 'Olive Q. Day', 'olive.sep.demo@example.com', '09171230032',
      'Lagoon view unit',
      '09-08-2026', '09-11-2026', '14:00', '11:00',
      'Filipino', 2, 0, 3,
      'Facebook', v_receipt, v_id,
      'Kame Homes', 'Bali 1205', 'Michael D Manlulu', '09625647541',
      8100.00, 3000.00, 5100.00, 2000.00,
      NULL, now(), '2026-08-06 10:00:00+08', now()
    );
  END IF;

  -- ═══════════════════════════════════════════════════════════════════════════
  -- Finance — July / August / September
  -- ═══════════════════════════════════════════════════════════════════════════
  INSERT INTO public.finance_line_items (
    id, property_id, kind, label, amount, category, occurred_on, notes,
    receipt_path, created_by, paid_at, telegram_reminder_enabled
  ) VALUES
  -- July
  (
    'c4444444-4444-4444-8444-444444444421', v_prop_id, 'expense', 'Condo dues — July',
    8500.00, 'Amortization', '2026-07-01', 'Monthly association dues',
    v_receipt, 'demo_seed', '2026-07-01 10:00:00+08', FALSE
  ),
  (
    'c4444444-4444-4444-8444-444444444422', v_prop_id, 'expense', 'Meralco bill',
    2980.00, 'Utilities', '2026-07-05', 'June usage billed in July',
    v_receipt, 'demo_seed', '2026-07-06 09:00:00+08', FALSE
  ),
  (
    'c4444444-4444-4444-8444-444444444423', v_prop_id, 'expense', 'Maynilad water',
    640.00, 'Utilities', '2026-07-05', NULL,
    NULL, 'demo_seed', '2026-07-06 09:05:00+08', FALSE
  ),
  (
    'c4444444-4444-4444-8444-444444444424', v_prop_id, 'expense', 'Turnover cleaning',
    1500.00, 'Cleaning', '2026-07-08', 'After Marco Diaz stay',
    v_receipt, 'demo_seed', '2026-07-08 16:00:00+08', FALSE
  ),
  (
    'c4444444-4444-4444-8444-444444444425', v_prop_id, 'expense', 'Turnover cleaning',
    1500.00, 'Cleaning', '2026-07-15', 'After Sam Ibarra stay',
    v_receipt, 'demo_seed', '2026-07-15 15:00:00+08', FALSE
  ),
  (
    'c4444444-4444-4444-8444-444444444426', v_prop_id, 'expense', 'Linens restock',
    1800.00, 'Supplies', '2026-07-12', 'Pillowcases + bath mats',
    v_receipt, 'demo_seed', '2026-07-12 11:00:00+08', FALSE
  ),
  (
    'c4444444-4444-4444-8444-444444444427', v_prop_id, 'expense', 'Facebook ads — July',
    2200.00, 'Marketing', '2026-07-10', 'Mid-year occupancy push',
    NULL, 'demo_seed', '2026-07-11 10:00:00+08', FALSE
  ),
  (
    'c4444444-4444-4444-8444-444444444428', v_prop_id, 'expense', 'Housekeeper stipend',
    4000.00, 'Staff', '2026-07-15', 'Biweekly cleaning retainer',
    NULL, 'demo_seed', '2026-07-15 12:00:00+08', FALSE
  ),
  (
    'c4444444-4444-4444-8444-444444444429', v_prop_id, 'expense', 'Internet (PLDT)',
    1899.00, 'Utilities', '2026-07-20', 'Fiber plan',
    NULL, 'demo_seed', '2026-07-20 09:00:00+08', FALSE
  ),
  (
    'c4444444-4444-4444-8444-444444444430', v_prop_id, 'income', 'Parking rental — slot B2',
    3500.00, 'Other', '2026-07-01', 'Monthly slot lease to neighbor',
    NULL, 'demo_seed', '2026-07-01 11:00:00+08', FALSE
  ),
  (
    'c4444444-4444-4444-8444-444444444431', v_prop_id, 'income', 'Extra guest fee',
    1000.00, 'Other', '2026-07-22', 'Yves Mercado party of 4',
    NULL, 'demo_seed', '2026-07-22 18:00:00+08', FALSE
  ),
  -- August
  (
    'c4444444-4444-4444-8444-444444444401', v_prop_id, 'expense', 'Condo dues — August',
    8500.00, 'Amortization', '2026-08-01', 'Monthly association dues',
    v_receipt, 'demo_seed', '2026-08-01 10:00:00+08', FALSE
  ),
  (
    'c4444444-4444-4444-8444-444444444402', v_prop_id, 'expense', 'Meralco bill',
    3200.00, 'Utilities', '2026-08-05', 'July usage billed in August',
    v_receipt, 'demo_seed', '2026-08-06 09:00:00+08', FALSE
  ),
  (
    'c4444444-4444-4444-8444-444444444403', v_prop_id, 'expense', 'Maynilad water',
    680.00, 'Utilities', '2026-08-05', NULL,
    NULL, 'demo_seed', '2026-08-06 09:05:00+08', FALSE
  ),
  (
    'c4444444-4444-4444-8444-444444444404', v_prop_id, 'expense', 'Turnover cleaning',
    1500.00, 'Cleaning', '2026-08-03', 'After Ben Cruz stay',
    v_receipt, 'demo_seed', '2026-08-03 16:00:00+08', FALSE
  ),
  (
    'c4444444-4444-4444-8444-444444444405', v_prop_id, 'expense', 'Turnover cleaning',
    1500.00, 'Cleaning', '2026-08-05', 'After Dana Lim stay',
    v_receipt, 'demo_seed', '2026-08-05 15:00:00+08', FALSE
  ),
  (
    'c4444444-4444-4444-8444-444444444406', v_prop_id, 'expense', 'Linens & toiletries restock',
    2100.00, 'Supplies', '2026-08-08', 'Towels, soap, garbage bags',
    v_receipt, 'demo_seed', NULL, TRUE
  ),
  (
    'c4444444-4444-4444-8444-444444444407', v_prop_id, 'expense', 'Facebook ads — August',
    2500.00, 'Marketing', '2026-08-10', 'Boost for mid-month vacancies',
    NULL, 'demo_seed', NULL, FALSE
  ),
  (
    'c4444444-4444-4444-8444-444444444408', v_prop_id, 'expense', 'Housekeeper stipend',
    4000.00, 'Staff', '2026-08-15', 'Biweekly cleaning retainer',
    NULL, 'demo_seed', NULL, TRUE
  ),
  (
    'c4444444-4444-4444-8444-444444444409', v_prop_id, 'expense', 'AC filter replacement',
    950.00, 'Maintenance', '2026-08-12', 'Living room unit',
    v_receipt, 'demo_seed', '2026-08-12 14:00:00+08', FALSE
  ),
  (
    'c4444444-4444-4444-8444-444444444410', v_prop_id, 'income', 'Parking rental — slot B2',
    3500.00, 'Other', '2026-08-01', 'Monthly slot lease to neighbor',
    NULL, 'demo_seed', '2026-08-01 11:00:00+08', FALSE
  ),
  (
    'c4444444-4444-4444-8444-444444444411', v_prop_id, 'income', 'Late checkout fee',
    800.00, 'Other', '2026-08-07', 'Eli Santos late checkout',
    NULL, 'demo_seed', '2026-08-07 18:00:00+08', FALSE
  ),
  (
    'c4444444-4444-4444-8444-444444444412', v_prop_id, 'expense', 'Internet (PLDT)',
    1899.00, 'Utilities', '2026-08-20', 'Fiber plan',
    NULL, 'demo_seed', NULL, TRUE
  ),
  -- September (upcoming / unpaid texture)
  (
    'c4444444-4444-4444-8444-444444444441', v_prop_id, 'expense', 'Condo dues — September',
    8500.00, 'Amortization', '2026-09-01', 'Monthly association dues',
    NULL, 'demo_seed', NULL, TRUE
  ),
  (
    'c4444444-4444-4444-8444-444444444442', v_prop_id, 'expense', 'Meralco bill',
    3400.00, 'Utilities', '2026-09-05', 'August usage billed in September',
    NULL, 'demo_seed', NULL, TRUE
  ),
  (
    'c4444444-4444-4444-8444-444444444443', v_prop_id, 'expense', 'Maynilad water',
    720.00, 'Utilities', '2026-09-05', NULL,
    NULL, 'demo_seed', NULL, FALSE
  ),
  (
    'c4444444-4444-4444-8444-444444444444', v_prop_id, 'expense', 'Housekeeper stipend',
    4000.00, 'Staff', '2026-09-15', 'Biweekly cleaning retainer',
    NULL, 'demo_seed', NULL, TRUE
  ),
  (
    'c4444444-4444-4444-8444-444444444445', v_prop_id, 'expense', 'Facebook ads — September',
    2800.00, 'Marketing', '2026-09-08', 'Q3 occupancy push',
    NULL, 'demo_seed', NULL, FALSE
  ),
  (
    'c4444444-4444-4444-8444-444444444446', v_prop_id, 'expense', 'Internet (PLDT)',
    1899.00, 'Utilities', '2026-09-20', 'Fiber plan',
    NULL, 'demo_seed', NULL, TRUE
  ),
  (
    'c4444444-4444-4444-8444-444444444447', v_prop_id, 'expense', 'Kitchen supplies restock',
    1600.00, 'Supplies', '2026-09-12', 'Cookware + trash bags',
    NULL, 'demo_seed', NULL, FALSE
  ),
  (
    'c4444444-4444-4444-8444-444444444448', v_prop_id, 'income', 'Parking rental — slot B2',
    3500.00, 'Other', '2026-09-01', 'Monthly slot lease to neighbor',
    NULL, 'demo_seed', NULL, TRUE
  ),
  (
    'c4444444-4444-4444-8444-444444444449', v_prop_id, 'expense', 'Plumbing parts',
    850.00, 'Maintenance', '2026-09-18', 'Balcony drain fittings',
    NULL, 'demo_seed', NULL, FALSE
  ),
  -- October
  (
    'c4444444-4444-4444-8444-444444444461', v_prop_id, 'expense', 'Condo dues — October',
    8500.00, 'Amortization', '2026-10-01', 'Monthly association dues',
    NULL, 'demo_seed', NULL, TRUE
  ),
  (
    'c4444444-4444-4444-8444-444444444462', v_prop_id, 'expense', 'Meralco bill',
    3100.00, 'Utilities', '2026-10-05', 'September usage billed in October',
    NULL, 'demo_seed', NULL, TRUE
  ),
  (
    'c4444444-4444-4444-8444-444444444463', v_prop_id, 'expense', 'Turnover cleaning (1-night cadence)',
    1200.00, 'Cleaning', '2026-10-08', 'High-frequency single-night turnovers',
    NULL, 'demo_seed', NULL, FALSE
  ),
  (
    'c4444444-4444-4444-8444-444444444464', v_prop_id, 'expense', 'Housekeeper stipend',
    4500.00, 'Staff', '2026-10-15', 'Extra hours for 1-night turnovers',
    NULL, 'demo_seed', NULL, TRUE
  ),
  (
    'c4444444-4444-4444-8444-444444444465', v_prop_id, 'income', 'Parking rental — slot B2',
    3500.00, 'Other', '2026-10-01', 'Monthly slot lease to neighbor',
    NULL, 'demo_seed', NULL, TRUE
  ),
  (
    'c4444444-4444-4444-8444-444444444466', v_prop_id, 'expense', 'Internet (PLDT)',
    1899.00, 'Utilities', '2026-10-20', 'Fiber plan',
    NULL, 'demo_seed', NULL, TRUE
  );

  -- ═══════════════════════════════════════════════════════════════════════════
  -- Maintenance — July (mostly done) / August / September (upcoming)
  -- ═══════════════════════════════════════════════════════════════════════════
  INSERT INTO public.maintenance_items (
    id, property_id, label, category, scheduled_on, notes,
    recurrence_interval, telegram_reminder_enabled, telegram_due_date, telegram_days_before,
    completed_at, created_by
  ) VALUES
  -- July
  (
    'c5555555-5555-4555-8555-555555555521', v_prop_id,
    'Deep clean after June stay', 'Cleaning', '2026-07-03',
    'Post-checkout deep clean',
    NULL, FALSE, NULL, 3,
    '2026-07-03 17:00:00+08', 'demo_seed'
  ),
  (
    'c5555555-5555-4555-8555-555555555522', v_prop_id,
    'Unclog kitchen sink', 'Plumbing', '2026-07-08',
    'Guest reported slow drain',
    NULL, TRUE, '2026-07-08', 1,
    '2026-07-08 14:00:00+08', 'demo_seed'
  ),
  (
    'c5555555-5555-4555-8555-555555555523', v_prop_id,
    'AC filter clean', 'Appliance', '2026-07-15',
    'Monthly filter rinse',
    'monthly', TRUE, '2026-07-15', 2,
    '2026-07-15 11:00:00+08', 'demo_seed'
  ),
  (
    'c5555555-5555-4555-8555-555555555524', v_prop_id,
    'Restock toiletries', 'Supplies', '2026-07-20',
    'Shampoo, soap, tissue',
    'monthly', FALSE, NULL, 3,
    '2026-07-20 10:00:00+08', 'demo_seed'
  ),
  (
    'c5555555-5555-4555-8555-555555555525', v_prop_id,
    'Replace hallway bulb', 'Electrical', '2026-07-25',
    'Warm LED replacement',
    NULL, FALSE, NULL, 3,
    '2026-07-25 16:00:00+08', 'demo_seed'
  ),
  (
    'c5555555-5555-4555-8555-555555555526', v_prop_id,
    'Wash duvet covers', 'Amenities', '2026-07-28',
    'Before Ana Reyes checkout turnover',
    NULL, FALSE, NULL, 3,
    '2026-07-28 15:00:00+08', 'demo_seed'
  ),
  -- August
  (
    'c5555555-5555-4555-8555-555555555501', v_prop_id,
    'Deep clean living area', 'Cleaning', '2026-08-03',
    'Post-checkout deep clean before next guest',
    NULL, FALSE, NULL, 3,
    '2026-08-03 17:00:00+08', 'demo_seed'
  ),
  (
    'c5555555-5555-4555-8555-555555555502', v_prop_id,
    'Replace shower head', 'Plumbing', '2026-08-06',
    'Guest reported weak pressure',
    NULL, TRUE, '2026-08-06', 2,
    '2026-08-06 15:00:00+08', 'demo_seed'
  ),
  (
    'c5555555-5555-4555-8555-555555555503', v_prop_id,
    'Pest control spray', 'Pest Control', '2026-08-09',
    'Quarterly kitchen + balcony treatment',
    'quarterly', TRUE, '2026-08-09', 3,
    NULL, 'demo_seed'
  ),
  (
    'c5555555-5555-4555-8555-555555555504', v_prop_id,
    'Check smoke detectors', 'Safety', '2026-08-11',
    'Battery test all detectors',
    'yearly', TRUE, '2026-08-11', 5,
    NULL, 'demo_seed'
  ),
  (
    'c5555555-5555-4555-8555-555555555505', v_prop_id,
    'Wash comforter set', 'Amenities', '2026-08-12',
    'Before Iris Tan checkout turnover',
    NULL, FALSE, NULL, 3,
    NULL, 'demo_seed'
  ),
  (
    'c5555555-5555-4555-8555-555555555506', v_prop_id,
    'Fridge gasket inspection', 'Appliance', '2026-08-15',
    'Seal looks worn near freezer door',
    NULL, TRUE, '2026-08-15', 3,
    NULL, 'demo_seed'
  ),
  (
    'c5555555-5555-4555-8555-555555555507', v_prop_id,
    'Restock cleaning supplies', 'Supplies', '2026-08-18',
    'Bleach, microfiber cloths, trash bags',
    'monthly', FALSE, NULL, 3,
    NULL, 'demo_seed'
  ),
  (
    'c5555555-5555-4555-8555-555555555508', v_prop_id,
    'Outlet cover replacement', 'Electrical', '2026-08-22',
    'Bedroom cracked cover',
    NULL, FALSE, NULL, 3,
    NULL, 'demo_seed'
  ),
  (
    'c5555555-5555-4555-8555-555555555509', v_prop_id,
    'Balcony drain clear', 'Plumbing', '2026-08-25',
    'Rainy season clog risk',
    NULL, TRUE, '2026-08-25', 4,
    NULL, 'demo_seed'
  ),
  (
    'c5555555-5555-4555-8555-555555555510', v_prop_id,
    'AC filter clean', 'Appliance', '2026-08-28',
    'Monthly filter rinse',
    'monthly', TRUE, '2026-08-28', 2,
    NULL, 'demo_seed'
  ),
  -- September
  (
    'c5555555-5555-4555-8555-555555555541', v_prop_id,
    'Deep clean living area', 'Cleaning', '2026-09-03',
    'After Aya Kim bridge stay',
    NULL, FALSE, NULL, 3,
    NULL, 'demo_seed'
  ),
  (
    'c5555555-5555-4555-8555-555555555542', v_prop_id,
    'Water heater flush', 'Plumbing', '2026-09-08',
    'Semi-annual descaling',
    NULL, TRUE, '2026-09-08', 3,
    NULL, 'demo_seed'
  ),
  (
    'c5555555-5555-4555-8555-555555555543', v_prop_id,
    'AC filter clean', 'Appliance', '2026-09-15',
    'Monthly filter rinse',
    'monthly', TRUE, '2026-09-15', 2,
    NULL, 'demo_seed'
  ),
  (
    'c5555555-5555-4555-8555-555555555544', v_prop_id,
    'Restock toiletries', 'Supplies', '2026-09-12',
    'Shampoo, soap, tissue',
    'monthly', FALSE, NULL, 3,
    NULL, 'demo_seed'
  ),
  (
    'c5555555-5555-4555-8555-555555555545', v_prop_id,
    'Fire extinguisher check', 'Safety', '2026-09-20',
    'Expiry + pressure gauge',
    'yearly', TRUE, '2026-09-20', 5,
    NULL, 'demo_seed'
  ),
  (
    'c5555555-5555-4555-8555-555555555546', v_prop_id,
    'Wash comforter set', 'Amenities', '2026-09-23',
    'Mid-month linen rotation',
    NULL, FALSE, NULL, 3,
    NULL, 'demo_seed'
  ),
  (
    'c5555555-5555-4555-8555-555555555547', v_prop_id,
    'Microwave fuse check', 'Appliance', '2026-09-26',
    'Intermittent power cut reported',
    NULL, TRUE, '2026-09-26', 2,
    NULL, 'demo_seed'
  ),
  (
    'c5555555-5555-4555-8555-555555555548', v_prop_id,
    'Balcony plant trim', 'Amenities', '2026-09-29',
    'Keep railing clear for photos',
    NULL, FALSE, NULL, 3,
    NULL, 'demo_seed'
  ),
  -- October
  (
    'c5555555-5555-4555-8555-555555555561', v_prop_id,
    'Linen swap (1-night cadence)', 'Cleaning', '2026-10-05',
    'Extra set for same-day turnovers',
    NULL, TRUE, '2026-10-05', 2,
    NULL, 'demo_seed'
  ),
  (
    'c5555555-5555-4555-8555-555555555562', v_prop_id,
    'AC filter clean', 'Appliance', '2026-10-15',
    'Monthly filter rinse',
    'monthly', TRUE, '2026-10-15', 2,
    NULL, 'demo_seed'
  ),
  (
    'c5555555-5555-4555-8555-555555555563', v_prop_id,
    'Restock toiletries', 'Supplies', '2026-10-12',
    'High usage from single-night guests',
    'monthly', FALSE, NULL, 3,
    NULL, 'demo_seed'
  ),
  (
    'c5555555-5555-4555-8555-555555555564', v_prop_id,
    'Mattress protector check', 'Amenities', '2026-10-22',
    'After 2-night weekend stay',
    NULL, FALSE, NULL, 3,
    NULL, 'demo_seed'
  ),
  (
    'c5555555-5555-4555-8555-555555555565', v_prop_id,
    'Smoke detector test', 'Safety', '2026-10-28',
    'Quick monthly press-test',
    NULL, TRUE, '2026-10-28', 3,
    NULL, 'demo_seed'
  );

  RAISE NOTICE 'seed-dashboard-demo-data: seeded Jul–Oct bookings/finance/maintenance for kame-home';
END $$;
