-- Stay Guide page config v1 -> v2 backfill.
-- Plan: docs/workflow/in-progress/stay-guide-showcase-templates.md (Phase 1)
-- Runbook: docs/archive/operations/migration-runbook.md
--
-- v1: per-section { visible } flags + chapters[]. v2: PropertyShowcase-style
-- palette/typography/motion + a flat, reorderable sections[]. The runtime
-- `normalizeStayGuideConfig` upgrades any missed / newly-written v1 row on read,
-- so this backfill is best-effort — it just keeps stored rows clean.

DO $$
DECLARE
  r RECORD;
  v_chapters jsonb;
  v_sections jsonb;
  v_ordered_ids text[];
  v_sorted_chapters text[];
  v_id text;
  v_idx int;
  v_first_chapter_slot int;
BEGIN
  FOR r IN
    SELECT id, config
    FROM public.public_page_configs
    WHERE page_type = 'stay_guide'
      AND (config->>'version' = '1' OR jsonb_typeof(config->'chapters') = 'array')
  LOOP
    v_chapters := COALESCE(r.config->'chapters', '[]'::jsonb);

    -- chapter ids ordered by their saved `order` (fallback: default order)
    SELECT COALESCE(array_agg(cid ORDER BY ord, def_ord), ARRAY[]::text[])
    INTO v_sorted_chapters
    FROM (
      SELECT
        d.cid,
        d.def_ord,
        COALESCE(
          (SELECT (c->>'order')::numeric
             FROM jsonb_array_elements(v_chapters) c
            WHERE c->>'id' = d.cid
            LIMIT 1),
          d.def_ord
        ) AS ord
      FROM (VALUES
        ('getting-in', 0),
        ('make-yourself-at-home', 1),
        ('before-you-go', 2)
      ) AS d(cid, def_ord)
    ) s;

    -- default full order, then drop the sorted chapters into the chapter band
    v_ordered_ids := ARRAY[
      'hero','passCard','checkInDocuments','gallery','quickNav',
      'getting-in','make-yourself-at-home','before-you-go','host'
    ];
    v_first_chapter_slot := array_position(v_ordered_ids, 'getting-in');
    FOR v_idx IN 1 .. array_length(v_sorted_chapters, 1) LOOP
      v_ordered_ids[v_first_chapter_slot + v_idx - 1] := v_sorted_chapters[v_idx];
    END LOOP;

    v_sections := '[]'::jsonb;
    FOR v_idx IN 1 .. array_length(v_ordered_ids, 1) LOOP
      v_id := v_ordered_ids[v_idx];
      IF v_id IN ('getting-in','make-yourself-at-home','before-you-go') THEN
        v_sections := v_sections || jsonb_build_object(
          'id', v_id,
          'order', v_idx - 1,
          'visible', COALESCE(
            (SELECT (c->>'visible')::boolean
               FROM jsonb_array_elements(v_chapters) c
              WHERE c->>'id' = v_id
              LIMIT 1),
            true
          ),
          'accentColor', (
            SELECT NULLIF(c->>'accentColor', '')
              FROM jsonb_array_elements(v_chapters) c
             WHERE c->>'id' = v_id
             LIMIT 1
          )
        );
      ELSE
        v_sections := v_sections || jsonb_build_object(
          'id', v_id,
          'order', v_idx - 1,
          'visible', CASE v_id
            WHEN 'hero' THEN true
            WHEN 'passCard' THEN COALESCE((r.config->'stayPassCard'->>'visible')::boolean, true)
            WHEN 'checkInDocuments' THEN COALESCE((r.config->'checkInDocuments'->>'visible')::boolean, true)
            WHEN 'gallery' THEN COALESCE((r.config->'galleryCarousel'->>'visible')::boolean, true)
            WHEN 'quickNav' THEN COALESCE((r.config->'quickNavTabs'->>'visible')::boolean, true)
            WHEN 'host' THEN COALESCE((r.config->'helpSection'->>'visible')::boolean, true)
            ELSE true
          END
        );
      END IF;
    END LOOP;

    UPDATE public.public_page_configs
    SET config = jsonb_build_object(
          'version', 2,
          'published', true,
          'palette', jsonb_build_object(
            'mode', 'default',
            'accent', 'brand',
            'customAccent', NULL,
            'customPaletteBase', NULL,
            'overlay', 'soft'
          ),
          'typography', jsonb_build_object('displayFont', 'jakarta', 'scale', 'md'),
          'motion', jsonb_build_object('intensity', 'standard', 'parallax', true, 'canvas', true),
          'sections', v_sections
        ),
        updated_at = now()
    WHERE id = r.id;
  END LOOP;
END $$;
