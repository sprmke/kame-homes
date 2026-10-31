-- Phase 2 (cost-abuse §2.2): private guest PII buckets; drop public SELECT.
-- Edge functions sign URLs on read (get-form, get-booking-asset-url).

UPDATE storage.buckets
SET public = false
WHERE id IN (
  'payment-receipts',
  'valid-ids',
  'pet-vaccinations',
  'pet-images',
  'parking-endorsements'
);

DROP POLICY IF EXISTS "Allow public reads from payment-receipts" ON storage.objects;
DROP POLICY IF EXISTS "Allow public access to valid-ids" ON storage.objects;
DROP POLICY IF EXISTS "Allow public reads from pet-vaccinations" ON storage.objects;
DROP POLICY IF EXISTS "Allow public reads from pet-images" ON storage.objects;
DROP POLICY IF EXISTS "Allow public reads from parking-endorsements" ON storage.objects;
