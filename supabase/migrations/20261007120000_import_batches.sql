-- Smart AI Data Importer — batch staging tables + private CSV upload bucket.

CREATE TABLE IF NOT EXISTS import_batches (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id    UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  property_id        UUID NOT NULL REFERENCES properties(id),
  created_by         TEXT NOT NULL,
  status             TEXT NOT NULL CHECK (status IN (
                        'uploaded','mapping','mapped','previewing','previewed',
                        'committing','committed','reverting','reverted','failed'
                      )) DEFAULT 'uploaded',
  original_file_name TEXT,
  storage_path       TEXT,
  column_headers     JSONB,
  column_mapping     JSONB,
  row_count          INTEGER,
  error              TEXT,
  committed_at       TIMESTAMPTZ,
  reverted_at        TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS import_batch_rows (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id              UUID NOT NULL REFERENCES import_batches(id) ON DELETE CASCADE,
  row_index             INTEGER NOT NULL,
  raw_data              JSONB NOT NULL,
  mapped_data           JSONB,
  resolved_property_id  UUID REFERENCES properties(id),
  validation_status     TEXT NOT NULL CHECK (validation_status IN ('valid','error','skipped')) DEFAULT 'valid',
  validation_errors     JSONB,
  committed_row_id      UUID,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (batch_id, row_index)
);

CREATE INDEX IF NOT EXISTS idx_import_batch_rows_batch ON import_batch_rows (batch_id);
CREATE INDEX IF NOT EXISTS idx_import_batches_org ON import_batches (organization_id, created_at DESC);

ALTER TABLE guest_submissions ADD COLUMN IF NOT EXISTS imported_from_batch_id UUID REFERENCES import_batches(id);
CREATE INDEX IF NOT EXISTS idx_guest_submissions_imported_batch
  ON guest_submissions (imported_from_batch_id) WHERE imported_from_batch_id IS NOT NULL;

ALTER TABLE import_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE import_batch_rows ENABLE ROW LEVEL SECURITY;
-- No policies: service role via edge functions only.

GRANT SELECT, INSERT, UPDATE, DELETE ON public.import_batches TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.import_batch_rows TO service_role;

-- Private bucket for CSV uploads (v1: text/csv only, ~15 MB).
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'import-uploads',
  'import-uploads',
  false,
  15728640,
  ARRAY['text/csv']::text[]
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Service role write import-uploads" ON storage.objects;

CREATE POLICY "Service role write import-uploads"
  ON storage.objects FOR ALL TO service_role
  USING (bucket_id = 'import-uploads')
  WITH CHECK (bucket_id = 'import-uploads');

COMMENT ON TABLE import_batches IS
  'CSV import wizard batches — admin-only via import-* edge functions.';
COMMENT ON TABLE import_batch_rows IS
  'Staged CSV rows for preview/commit; one row per source line.';
