-- Help & Support FAQ table — curated cross-cutting Q&A, distinct from the raw
-- per-guide ai_dashboard_assistant_knowledge_base entries. Read-only for hosts;
-- writes go through service-role edge functions (super-admin CRUD, added later).
-- Docs: docs/workflow/in-progress/help-support-center.md, Module 4.

CREATE TABLE IF NOT EXISTS public.help_center_faqs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  is_published BOOLEAN NOT NULL DEFAULT TRUE,
  source_route_guide_path TEXT,
  created_by TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_help_center_faqs_category_sort_order
  ON public.help_center_faqs (category, sort_order);

COMMENT ON TABLE public.help_center_faqs IS
  'Curated cross-cutting FAQ items for the Help & Support FAQ module — seeded once from ai_dashboard_assistant_knowledge_base, then maintained via super-admin CRUD.';

DROP TRIGGER IF EXISTS update_help_center_faqs_updated_at ON public.help_center_faqs;
CREATE TRIGGER update_help_center_faqs_updated_at
  BEFORE UPDATE ON public.help_center_faqs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

GRANT ALL ON public.help_center_faqs TO service_role;

-- ─── RLS ─────────────────────────────────────────────────────────────────────
-- Reads open to any signed-in dashboard user (not tenant-scoped, same as the
-- knowledge base table). All writes go through service-role edge functions.

ALTER TABLE public.help_center_faqs ENABLE ROW LEVEL SECURITY;

CREATE POLICY help_center_faqs_select ON public.help_center_faqs
  FOR SELECT
  TO authenticated
  USING (is_published = TRUE);
