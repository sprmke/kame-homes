-- document_requirements_workflow.sql

ALTER TABLE guest_submissions
  ADD COLUMN IF NOT EXISTS document_requirement_completions jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE app_settings
  ADD COLUMN IF NOT EXISTS document_requirements_override jsonb NULL,
  ADD COLUMN IF NOT EXISTS sync_calendar boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS sync_sheets boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN guest_submissions.document_requirement_completions IS
  'Per documentRequirement id: { completedAt, approvedPdfUrl, manualIncomplete }';
COMMENT ON COLUMN app_settings.document_requirements_override IS
  'When set, replaces developments.settings.workflowDefaults.documentRequirements wholesale';
COMMENT ON COLUMN app_settings.sync_calendar IS
  'When false, workflowOrchestrator skips CalendarService updates';
COMMENT ON COLUMN app_settings.sync_sheets IS
  'When false, workflowOrchestrator skips SheetsService updates';

-- Backfill from named columns (Azure / existing rows)
UPDATE guest_submissions
SET document_requirement_completions = jsonb_strip_nulls(
  jsonb_build_object(
    'gaf', jsonb_build_object(
      'completedAt', to_jsonb(gaf_completed_at),
      'approvedPdfUrl', to_jsonb(approved_gaf_pdf_url),
      'manualIncomplete', to_jsonb(COALESCE(gaf_manual_incomplete, false))
    ),
    'pet', jsonb_build_object(
      'completedAt', to_jsonb(pet_completed_at),
      'approvedPdfUrl', to_jsonb(approved_pet_pdf_url),
      'manualIncomplete', to_jsonb(COALESCE(pet_manual_incomplete, false))
    )
  )
)
WHERE document_requirement_completions = '{}'::jsonb
  AND (
    gaf_completed_at IS NOT NULL
    OR approved_gaf_pdf_url IS NOT NULL
    OR pet_completed_at IS NOT NULL
    OR approved_pet_pdf_url IS NOT NULL
    OR COALESCE(gaf_manual_incomplete, false)
    OR COALESCE(pet_manual_incomplete, false)
  );

-- Seed Azure North residence-type defaults (slug from existing seed)
UPDATE developments
SET settings = jsonb_set(
  COALESCE(settings, '{}'::jsonb),
  '{workflowDefaults}',
  '{
    "documentRequirements": [
      {
        "id": "gaf",
        "label": "GAF Request",
        "order": 1,
        "pdfTemplateId": "gaf",
        "approvalSource": "email-listener",
        "triggerCondition": "always",
        "calendarIcon": null
      },
      {
        "id": "pet",
        "label": "Pet Approval",
        "order": 2,
        "pdfTemplateId": "pet",
        "approvalSource": "email-listener",
        "triggerCondition": "has_pets",
        "calendarIcon": "🐶"
      }
    ]
  }'::jsonb,
  true
)
WHERE slug = 'azure-north-residences';
