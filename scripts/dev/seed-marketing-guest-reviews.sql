-- Marketing Studio — mock guest reviews for local QA (Reviews sidebar + seed flows).
-- Targets the first matching property slug: monaco-2612 → azure-north-2br → kame-home.
-- Safe to re-run: removes prior rows tagged booking_source = 'marketing_review_seed'.
-- Apply: bun run seed:marketing-guest-reviews

DO $$
DECLARE
  v_prop_id UUID;
  v_prop_slug TEXT;
  v_receipt TEXT := 'https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=800&q=80';
  v_id TEXT := 'https://images.unsplash.com/photo-1589829085413-56de8ae18c73?w=800&q=80';
  v_stay_photo TEXT := 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800&q=80';
  v_pool_photo TEXT := 'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=800&q=80';
BEGIN
  SELECT p.id, p.slug
  INTO v_prop_id, v_prop_slug
  FROM public.properties p
  WHERE p.slug IN ('monaco-2612', 'azure-north-2br', 'kame-home')
  ORDER BY CASE p.slug
    WHEN 'monaco-2612' THEN 1
    WHEN 'azure-north-2br' THEN 2
    WHEN 'kame-home' THEN 3
  END
  LIMIT 1;

  IF v_prop_id IS NULL THEN
    RAISE NOTICE 'seed-marketing-guest-reviews: no target property found — skipped';
    RETURN;
  END IF;

  DELETE FROM public.guest_reviews
  WHERE booking_id IN (
    SELECT id FROM public.guest_submissions WHERE booking_source = 'marketing_review_seed'
  );
  DELETE FROM public.guest_submissions WHERE booking_source = 'marketing_review_seed';

  INSERT INTO public.guest_submissions (
    id, property_id, status, booking_source,
    guest_facebook_name, primary_guest_name, guest_email, guest_phone_number, guest_address,
    check_in_date, check_out_date, check_in_time, check_out_time,
    nationality, number_of_adults, number_of_nights,
    find_us, find_us_details,
    payment_receipt_url, valid_id_url,
    unit_owner, tower_and_unit_number, owner_onsite_contact_person, owner_contact_number,
    booking_rate, down_payment, balance, security_deposit,
    status_updated_at, created_at, updated_at
  ) VALUES
  (
    'd4444444-4444-4444-8444-444444444401', v_prop_id, 'COMPLETED', 'marketing_review_seed',
    'Maria Santos', 'Maria Santos', 'maria.review.demo@example.com', '09170000001', 'Makati',
    '08-01-2026', '08-03-2026', '14:00', '11:00',
    'Filipino', 2, 2,
    'Facebook', NULL,
    v_receipt, v_id,
    'Michael Manlulu', 'Monaco 2612', 'Michael D Manlulu', '09625647541',
    5200, 2000, 0, 1500,
    '2026-08-03 11:00:00+08', '2026-08-01 10:00:00+08', now()
  ),
  (
    'd4444444-4444-4444-8444-444444444402', v_prop_id, 'COMPLETED', 'marketing_review_seed',
    'James Chen', 'James Chen', 'james.review.demo@example.com', '09170000002', 'BGC',
    '08-05-2026', '08-07-2026', '14:00', '11:00',
    'Singaporean', 2, 2,
    'Instagram', NULL,
    v_receipt, v_id,
    'Michael Manlulu', 'Monaco 2612', 'Michael D Manlulu', '09625647541',
    5400, 2000, 0, 1500,
    '2026-08-07 11:00:00+08', '2026-08-03 10:00:00+08', now()
  ),
  (
    'd4444444-4444-4444-8444-444444444403', v_prop_id, 'COMPLETED', 'marketing_review_seed',
    'Ana Reyes', 'Ana Reyes', 'ana.review.demo@example.com', '09170000003', 'Quezon City',
    '08-08-2026', '08-10-2026', '14:00', '11:00',
    'Filipino', 3, 2,
    'Airbnb', NULL,
    v_receipt, v_id,
    'Michael Manlulu', 'Monaco 2612', 'Michael D Manlulu', '09625647541',
    5800, 2200, 0, 1600,
    '2026-08-10 11:00:00+08', '2026-08-05 10:00:00+08', now()
  ),
  (
    'd4444444-4444-4444-8444-444444444404', v_prop_id, 'COMPLETED', 'marketing_review_seed',
    'Liam Park', 'Liam Park', 'liam.review.demo@example.com', '09170000004', 'Pasig',
    '08-11-2026', '08-13-2026', '14:00', '11:00',
    'Korean', 2, 2,
    'Facebook', NULL,
    v_receipt, v_id,
    'Michael Manlulu', 'Monaco 2612', 'Michael D Manlulu', '09625647541',
    5100, 2000, 0, 1500,
    '2026-08-13 11:00:00+08', '2026-08-08 10:00:00+08', now()
  ),
  (
    'd4444444-4444-4444-8444-444444444405', v_prop_id, 'COMPLETED', 'marketing_review_seed',
    'Sofia Cruz', 'Sofia Cruz', 'sofia.review.demo@example.com', '09170000005', 'Taguig',
    '08-14-2026', '08-16-2026', '14:00', '11:00',
    'Filipino', 2, 2,
    'Facebook', NULL,
    v_receipt, v_id,
    'Michael Manlulu', 'Monaco 2612', 'Michael D Manlulu', '09625647541',
    5300, 2000, 0, 1500,
    '2026-08-16 11:00:00+08', '2026-08-11 10:00:00+08', now()
  ),
  (
    'd4444444-4444-4444-8444-444444444406', v_prop_id, 'COMPLETED', 'marketing_review_seed',
    'Noah Tan', 'Noah Tan', 'noah.review.demo@example.com', '09170000006', 'Mandaluyong',
    '08-17-2026', '08-19-2026', '14:00', '11:00',
    'Filipino', 2, 2,
    'Referral', NULL,
    v_receipt, v_id,
    'Michael Manlulu', 'Monaco 2612', 'Michael D Manlulu', '09625647541',
    5500, 2100, 0, 1600,
    '2026-08-19 11:00:00+08', '2026-08-14 10:00:00+08', now()
  ),
  (
    'd4444444-4444-4444-8444-444444444407', v_prop_id, 'COMPLETED', 'marketing_review_seed',
    'Ella Gomez', 'Ella Gomez', 'ella.review.demo@example.com', '09170000007', 'Cebu',
    '08-20-2026', '08-22-2026', '14:00', '11:00',
    'Filipino', 4, 2,
    'Facebook', NULL,
    v_receipt, v_id,
    'Michael Manlulu', 'Monaco 2612', 'Michael D Manlulu', '09625647541',
    6200, 2500, 0, 1800,
    '2026-08-22 11:00:00+08', '2026-08-17 10:00:00+08', now()
  ),
  (
    'd4444444-4444-4444-8444-444444444408', v_prop_id, 'COMPLETED', 'marketing_review_seed',
    'Ben Torres', 'Ben Torres', 'ben.review.demo@example.com', '09170000008', 'Davao',
    '08-23-2026', '08-25-2026', '14:00', '11:00',
    'Filipino', 2, 2,
    'Facebook', NULL,
    v_receipt, v_id,
    'Michael Manlulu', 'Monaco 2612', 'Michael D Manlulu', '09625647541',
    5400, 2000, 0, 1500,
    '2026-08-25 11:00:00+08', '2026-08-20 10:00:00+08', now()
  );

  INSERT INTO public.guest_reviews (
    id, property_id, booking_id, star_rating, review_text, media_urls,
    guest_display_name, feedback_tags, created_at
  ) VALUES
  (
    'e5555555-5555-5555-8555-555555555501', v_prop_id,
    'd4444444-4444-4444-8444-444444444401', 5,
    'Felt like home the moment we arrived. Spotless unit and the host replied within minutes.',
    jsonb_build_array(jsonb_build_object('url', v_stay_photo, 'type', 'image')),
    'Maria Santos', ARRAY['sparkling_clean', 'responsive_host', 'felt_at_home'],
    '2026-08-03 14:00:00+08'
  ),
  (
    'e5555555-5555-5555-8555-555555555502', v_prop_id,
    'd4444444-4444-4444-8444-444444444402', 5,
    'Easy check-in and the photos matched the listing perfectly. Would book again.',
    jsonb_build_array(jsonb_build_object('url', v_pool_photo, 'type', 'image')),
    'James Chen', ARRAY['easy_check_in', 'matched_listing'],
    '2026-08-07 16:30:00+08'
  ),
  (
    'e5555555-5555-5555-8555-555555555503', v_prop_id,
    'd4444444-4444-4444-8444-444444444403', 5,
    'Great location for weekend errands and the beds were super comfortable.',
    '[]'::jsonb,
    'Ana Reyes', ARRAY['great_location', 'comfortable_stay'],
    '2026-08-10 09:15:00+08'
  ),
  (
    'e5555555-5555-5555-8555-555555555504', v_prop_id,
    'd4444444-4444-4444-8444-444444444404', 4,
    'Quiet building and thoughtful touches in the kitchen. Minor dust under the sofa.',
    jsonb_build_array(jsonb_build_object('url', v_stay_photo, 'type', 'image')),
    'Liam Park', ARRAY['thoughtful_touches'],
    '2026-08-13 18:00:00+08'
  ),
  (
    'e5555555-5555-5555-8555-555555555505', v_prop_id,
    'd4444444-4444-4444-8444-444444444405', 5,
    'Pool area was pristine and check-in instructions were crystal clear.',
    jsonb_build_array(jsonb_build_object('url', v_pool_photo, 'type', 'image')),
    'Sofia Cruz', ARRAY['sparkling_clean', 'easy_check_in'],
    '2026-08-16 11:45:00+08'
  ),
  (
    'e5555555-5555-5555-8555-555555555506', v_prop_id,
    'd4444444-4444-4444-8444-444444444406', 5,
    'Well equipped for a family stay — extra towels, fast Wi‑Fi, and a smooth checkout.',
    '[]'::jsonb,
    'Noah Tan', ARRAY['well_equipped', 'comfortable_stay'],
    '2026-08-19 20:00:00+08'
  ),
  (
    'e5555555-5555-5555-8555-555555555507', v_prop_id,
    'd4444444-4444-4444-8444-444444444407', 5,
    'Sunset from the balcony was unreal. Host left a welcome note that made our day.',
    jsonb_build_array(jsonb_build_object('url', v_stay_photo, 'type', 'image')),
    'Ella Gomez', ARRAY['thoughtful_touches', 'great_location'],
    '2026-08-22 07:30:00+08'
  ),
  (
    'e5555555-5555-5555-8555-555555555508', v_prop_id,
    'd4444444-4444-4444-8444-444444444408', 4,
    'Good value for a short work trip. Responsive host when we needed late checkout.',
    '[]'::jsonb,
    'Ben Torres', ARRAY['good_value', 'responsive_host'],
    '2026-08-25 13:00:00+08'
  );

  RAISE NOTICE 'seed-marketing-guest-reviews: inserted 8 reviews for property % (%)',
    v_prop_slug, v_prop_id;
END $$;
