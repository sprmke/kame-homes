-- Phase 1 (cost-abuse §2.2): drop anonymous writes on guest PII buckets.
-- Reads stay public until signed-URL cutover (Phase 2). Uploads already use service role.

-- payment-receipts
DROP POLICY IF EXISTS "Allow public uploads to payment-receipts" ON storage.objects;
DROP POLICY IF EXISTS "Allow public updates to payment-receipts" ON storage.objects;
DROP POLICY IF EXISTS "Allow public deletes from payment-receipts" ON storage.objects;

CREATE POLICY "Service role write payment-receipts"
  ON storage.objects FOR ALL TO service_role
  USING (bucket_id = 'payment-receipts')
  WITH CHECK (bucket_id = 'payment-receipts');

-- valid-ids (align UPDATE/DELETE with siblings)
DROP POLICY IF EXISTS "Allow uploads to valid-ids" ON storage.objects;

CREATE POLICY "Service role write valid-ids"
  ON storage.objects FOR ALL TO service_role
  USING (bucket_id = 'valid-ids')
  WITH CHECK (bucket_id = 'valid-ids');

-- pet-vaccinations
DROP POLICY IF EXISTS "Allow public uploads to pet-vaccinations" ON storage.objects;
DROP POLICY IF EXISTS "Allow public updates to pet-vaccinations" ON storage.objects;
DROP POLICY IF EXISTS "Allow public deletes from pet-vaccinations" ON storage.objects;

CREATE POLICY "Service role write pet-vaccinations"
  ON storage.objects FOR ALL TO service_role
  USING (bucket_id = 'pet-vaccinations')
  WITH CHECK (bucket_id = 'pet-vaccinations');

-- pet-images
DROP POLICY IF EXISTS "Allow public uploads to pet-images" ON storage.objects;
DROP POLICY IF EXISTS "Allow public updates to pet-images" ON storage.objects;
DROP POLICY IF EXISTS "Allow public deletes from pet-images" ON storage.objects;

CREATE POLICY "Service role write pet-images"
  ON storage.objects FOR ALL TO service_role
  USING (bucket_id = 'pet-images')
  WITH CHECK (bucket_id = 'pet-images');

-- parking-endorsements
DROP POLICY IF EXISTS "Allow public uploads to parking-endorsements" ON storage.objects;
DROP POLICY IF EXISTS "Allow public updates to parking-endorsements" ON storage.objects;
DROP POLICY IF EXISTS "Allow public deletes from parking-endorsements" ON storage.objects;

CREATE POLICY "Service role write parking-endorsements"
  ON storage.objects FOR ALL TO service_role
  USING (bucket_id = 'parking-endorsements')
  WITH CHECK (bucket_id = 'parking-endorsements');

COMMENT ON POLICY "Service role write payment-receipts" ON storage.objects IS
  'Cost-abuse Phase 1: block anon storage writes; edge functions upload via service role.';
