-- FAQ provenance + audience for the docs -> support-content sync.
--
-- `origin = 'synced'` rows are owned by scripts/sync-ai-knowledge-base.ts
-- (from docs/guides/routes/** and docs/guides/support/faqs.md). The sync never
-- reads, updates, or deletes `origin = 'manual'` rows, which remain
-- super-admin authored.
--
-- Plan: docs/workflow/in-progress/support-content-and-faq-sync.md

ALTER TABLE public.help_center_faqs
  ADD COLUMN IF NOT EXISTS origin TEXT NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS audience TEXT NOT NULL DEFAULT 'host',
  ADD COLUMN IF NOT EXISTS content_key TEXT;

ALTER TABLE public.help_center_faqs
  DROP CONSTRAINT IF EXISTS help_center_faqs_origin_check;
ALTER TABLE public.help_center_faqs
  ADD CONSTRAINT help_center_faqs_origin_check
  CHECK (origin IN ('synced', 'manual'));

ALTER TABLE public.help_center_faqs
  DROP CONSTRAINT IF EXISTS help_center_faqs_audience_check;
ALTER TABLE public.help_center_faqs
  ADD CONSTRAINT help_center_faqs_audience_check
  CHECK (audience IN ('host', 'guest', 'public'));

-- The seeded rows are identified by having a source route guide and no content
-- key. Super-admin-created rows leave source_route_guide_path null.
UPDATE public.help_center_faqs
SET
  origin = 'synced',
  content_key = substr(
    trim(both '-' from regexp_replace(
      replace(replace(lower(category), '''', ''), '’', ''),
      '[^a-z0-9]+',
      '-',
      'g'
    )),
    1,
    120
  ) || '--' || substr(
    trim(both '-' from regexp_replace(
      replace(replace(lower(question), '''', ''), '’', ''),
      '[^a-z0-9]+',
      '-',
      'g'
    )),
    1,
    120
  )
WHERE source_route_guide_path IS NOT NULL
  AND content_key IS NULL;

-- Stable sync key. Null is allowed for manual rows, which have no key.
CREATE UNIQUE INDEX IF NOT EXISTS idx_help_center_faqs_content_key
  ON public.help_center_faqs (content_key);

-- Public read path: one audience + published filter, grouped by category/order.
CREATE INDEX IF NOT EXISTS idx_help_center_faqs_audience_published
  ON public.help_center_faqs (audience, is_published, category, sort_order);

COMMENT ON TABLE public.help_center_faqs IS
  'Curated cross-cutting Help Center FAQs. origin = synced is owned by the docs sync (docs/guides/support/faqs.md); origin = manual is super-admin authored and never touched by the sync.';

COMMENT ON COLUMN public.help_center_faqs.origin IS
  'synced = owned by the docs sync; manual = super-admin authored and never touched by the sync.';
COMMENT ON COLUMN public.help_center_faqs.audience IS
  'Who may see the FAQ: host, guest, or public (both host and guest surfaces).';
COMMENT ON COLUMN public.help_center_faqs.content_key IS
  'Stable sync key derived from category + question. Null on manual rows.';
