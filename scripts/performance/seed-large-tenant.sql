-- Large-tenant synthetic seed for local query plans and load tests.
-- Run only through scripts/performance/seed-large-tenant.sh (it refuses non-local hosts).
--
-- Creates one isolated org/property/connection with:
--   10,000 bookings, 50,000 finance line items, 20,000 social messages.
-- Idempotent: deletes the prior seed rows for the fixed ids before inserting.
-- PII is synthetic. Never point this at hosted Supabase.

BEGIN;

DO $do$
DECLARE
  v_owner uuid;
BEGIN
  SELECT id INTO v_owner FROM auth.users ORDER BY created_at LIMIT 1;
  IF v_owner IS NULL THEN
    RAISE EXCEPTION 'seed-large-tenant: no auth.users row; run the normal local seed first';
  END IF;

  INSERT INTO public.organizations (id, owner_id, name, slug, settings, host_modes)
  VALUES (
    'aaaaaaaa-0000-4000-8000-000000000001',
    v_owner,
    'Synthetic Load Org',
    'synthetic-load-org',
    '{}'::jsonb,
    ARRAY[]::text[]
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.properties (id, organization_id, name, slug, type, status, settings)
  VALUES (
    'aaaaaaaa-0000-4000-8000-000000000002',
    'aaaaaaaa-0000-4000-8000-000000000001',
    'Synthetic Load Property',
    'synthetic-load-property',
    'PROPERTY',
    'ACTIVE',
    '{}'::jsonb
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.social_channel_connections (
    id, organization_id, platform, external_account_id, status
  )
  VALUES (
    'aaaaaaaa-0000-4000-8000-000000000003',
    'aaaaaaaa-0000-4000-8000-000000000001',
    'web',
    'synthetic-load-connection',
    'connected'
  )
  ON CONFLICT (id) DO NOTHING;
END
$do$;

DELETE FROM public.guest_submissions
WHERE property_id = 'aaaaaaaa-0000-4000-8000-000000000002';
DELETE FROM public.finance_line_items
WHERE property_id = 'aaaaaaaa-0000-4000-8000-000000000002';
DELETE FROM public.social_conversations
WHERE connection_id = 'aaaaaaaa-0000-4000-8000-000000000003';

INSERT INTO public.guest_submissions (
  id, guest_facebook_name, primary_guest_name, guest_phone_number, guest_address,
  check_in_date, check_out_date, number_of_nights, find_us, payment_receipt_url,
  unit_owner, tower_and_unit_number, owner_onsite_contact_person, owner_contact_number,
  status, property_id, created_at, status_updated_at
)
SELECT
  gen_random_uuid(),
  'load-guest-' || g,
  'Load Guest ' || g,
  '0917' || lpad((g % 10000000)::text, 7, '0'),
  'Synthetic address ' || g,
  to_char(DATE '2025-01-01' + (g % 900), 'MM-DD-YYYY'),
  to_char(DATE '2025-01-03' + (g % 900), 'MM-DD-YYYY'),
  2,
  'load-test',
  '',
  'Synthetic Owner',
  'Tower ' || (1 + (g % 4)) || ' Unit ' || (100 + (g % 300)),
  'Synthetic Contact',
  '09170000000',
  (ARRAY['PENDING_REVIEW', 'PENDING_DOCUMENTS', 'READY_FOR_CHECKIN', 'COMPLETED', 'CANCELLED'])[1 + (g % 5)],
  'aaaaaaaa-0000-4000-8000-000000000002',
  now() - ((g % 365) || ' days')::interval,
  now() - ((g % 365) || ' days')::interval
FROM generate_series(1, 10000) g;

INSERT INTO public.finance_line_items (
  id, property_id, kind, label, amount, category, occurred_on, notes, created_at
)
SELECT
  gen_random_uuid(),
  'aaaaaaaa-0000-4000-8000-000000000002',
  CASE WHEN g % 3 = 0 THEN 'income' ELSE 'expense' END,
  'Synthetic line ' || g,
  (10 + (g % 490))::numeric(12,2),
  CASE WHEN g % 3 = 0 THEN 'Booking revenue' ELSE 'Operations' END,
  DATE '2025-01-01' + (g % 365),
  'load-test',
  now() - ((g % 365) || ' days')::interval
FROM generate_series(1, 50000) g;

INSERT INTO public.social_conversations (
  id, organization_id, connection_id, platform, conversation_type,
  external_thread_id, last_message_at, created_at, updated_at
)
SELECT
  ('bbbbbbbb-0000-4000-8000-' || lpad(g::text, 12, '0'))::uuid,
  'aaaaaaaa-0000-4000-8000-000000000001',
  'aaaaaaaa-0000-4000-8000-000000000003',
  'web',
  'dm',
  'synthetic-thread-' || g,
  now() - ((g % 30) || ' days')::interval,
  now() - ((g % 365) || ' days')::interval,
  now() - ((g % 30) || ' days')::interval
FROM generate_series(1, 100) g;

INSERT INTO public.social_messages (
  id, organization_id, conversation_id, direction, external_message_id,
  body_text, sent_at, created_at
)
SELECT
  gen_random_uuid(),
  'aaaaaaaa-0000-4000-8000-000000000001',
  ('bbbbbbbb-0000-4000-8000-' || lpad((1 + (g % 100))::text, 12, '0'))::uuid,
  CASE WHEN g % 2 = 0 THEN 'inbound' ELSE 'outbound' END,
  'synthetic-message-' || g,
  'Synthetic load-test message ' || g,
  now() - ((g % 365) || ' days')::interval,
  now() - ((g % 365) || ' days')::interval
FROM generate_series(1, 20000) g;

ANALYZE public.guest_submissions;
ANALYZE public.finance_line_items;
ANALYZE public.social_messages;
ANALYZE public.social_conversations;

\if :commit
COMMIT;
\echo 'seed-large-tenant: committed'
\else
ROLLBACK;
\echo 'seed-large-tenant: rolled back (pass --commit to keep)'
\endif
