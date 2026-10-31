-- Allow Excel uploads in import-uploads (CSV was v1-only).
UPDATE storage.buckets
SET
  allowed_mime_types = ARRAY[
    'text/csv',
    'application/csv',
    'text/plain',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
    'application/vnd.ms-excel.sheet.macroenabled.12'
  ]::text[],
  file_size_limit = 15728640
WHERE id = 'import-uploads';

COMMENT ON TABLE import_batches IS
  'Booking import wizard batches (CSV/Excel) — admin-only via import-* edge functions.';
COMMENT ON TABLE import_batch_rows IS
  'Staged import rows for preview/commit; one row per source line.';
