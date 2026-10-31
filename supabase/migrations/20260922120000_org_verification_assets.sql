-- Org host verification proofs (IDs, ownership docs). PRIVATE — service role only.
-- Paths live in organizations.settings.verification; never expose publicly.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'org-verification-assets',
  'org-verification-assets',
  FALSE,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
ON CONFLICT (id) DO UPDATE SET
  public             = EXCLUDED.public,
  file_size_limit    = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Service role full access to org-verification-assets" ON storage.objects;

CREATE POLICY "Service role full access to org-verification-assets"
  ON storage.objects FOR ALL TO service_role
  USING (bucket_id = 'org-verification-assets')
  WITH CHECK (bucket_id = 'org-verification-assets');
