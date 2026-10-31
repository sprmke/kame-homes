-- Public bucket for property listing photos and videos (gallery media).

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'property-media',
  'property-media',
  true,
  26214400,
  ARRAY[
    'image/jpeg', 'image/png', 'image/webp', 'image/gif',
    'image/heic', 'image/heif', 'image/bmp', 'image/tiff', 'image/avif', 'image/svg+xml',
    'video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo',
    'video/x-matroska', 'video/ogg', 'video/mpeg'
  ]::text[]
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Public read property-media" ON storage.objects;
DROP POLICY IF EXISTS "Service role write property-media" ON storage.objects;

CREATE POLICY "Public read property-media"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'property-media');

CREATE POLICY "Service role write property-media"
  ON storage.objects FOR ALL TO service_role
  USING (bucket_id = 'property-media')
  WITH CHECK (bucket_id = 'property-media');
