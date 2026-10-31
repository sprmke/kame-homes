-- Remove admin "mark nested docs incomplete" flags. Completion is completedAt /
-- approvedPdfUrl (and parking_completed_at) only.

ALTER TABLE guest_submissions
  DROP COLUMN IF EXISTS gaf_manual_incomplete,
  DROP COLUMN IF EXISTS pet_manual_incomplete;

COMMENT ON COLUMN guest_submissions.document_requirement_completions IS
  'Per documentRequirement id: { completedAt, approvedPdfUrl }';

UPDATE guest_submissions
SET document_requirement_completions = (
  SELECT COALESCE(jsonb_object_agg(key, value - 'manualIncomplete'), '{}'::jsonb)
  FROM jsonb_each(document_requirement_completions)
)
WHERE document_requirement_completions IS NOT NULL
  AND document_requirement_completions <> '{}'::jsonb
  AND EXISTS (
    SELECT 1
    FROM jsonb_each(document_requirement_completions) AS e(key, value)
    WHERE jsonb_typeof(value) = 'object' AND value ? 'manualIncomplete'
  );
