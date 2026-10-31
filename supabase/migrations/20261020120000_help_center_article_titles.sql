-- Adds route guide title to the knowledge base so the Help Center Documentation
-- module can group Q&A entries into readable articles per guide.
-- Docs: docs/workflow/in-progress/help-support-center.md, "Content pipeline" section.

ALTER TABLE public.ai_dashboard_assistant_knowledge_base
  ADD COLUMN IF NOT EXISTS route_guide_title TEXT;
