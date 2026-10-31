-- Replace monaco-2612 gallery with curated mock hospitality photos (Unsplash).
-- Same stock set used by marketing mockProperties / showcase preview mocks.
-- Run: bun run seed:monaco-2612-media
-- Idempotent: overwrites properties.settings.media for kame-home / monaco-2612 only.

DO $$
DECLARE
  v_org_id uuid;
  v_prop_id uuid;
  v_media jsonb;
BEGIN
  SELECT id INTO v_org_id FROM organizations WHERE slug = 'kame-home' LIMIT 1;
  IF v_org_id IS NULL THEN
    RAISE NOTICE 'seed-monaco-2612-media: org kame-home not found — skipped';
    RETURN;
  END IF;

  SELECT id INTO v_prop_id
  FROM properties
  WHERE slug = 'monaco-2612' AND organization_id = v_org_id
  LIMIT 1;

  IF v_prop_id IS NULL THEN
    RAISE NOTICE 'seed-monaco-2612-media: property monaco-2612 not found — skipped';
    RETURN;
  END IF;

  -- Max 9 images (PROPERTY_MEDIA limit). External URLs (no storagePath) are valid.
  v_media := jsonb_build_array(
    jsonb_build_object(
      'id', 'mock-media-01',
      'url', 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=1600&q=85',
      'type', 'image',
      'order', 0,
      'isPrimary', true,
      'caption', 'Living space'
    ),
    jsonb_build_object(
      'id', 'mock-media-02',
      'url', 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1600&q=85',
      'type', 'image',
      'order', 1,
      'isPrimary', false,
      'caption', 'Exterior'
    ),
    jsonb_build_object(
      'id', 'mock-media-03',
      'url', 'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=1600&q=85',
      'type', 'image',
      'order', 2,
      'isPrimary', false,
      'caption', 'Architecture'
    ),
    jsonb_build_object(
      'id', 'mock-media-04',
      'url', 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=1600&q=85',
      'type', 'image',
      'order', 3,
      'isPrimary', false,
      'caption', 'Lounge'
    ),
    jsonb_build_object(
      'id', 'mock-media-05',
      'url', 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=1600&q=85',
      'type', 'image',
      'order', 4,
      'isPrimary', false,
      'caption', 'Bedroom'
    ),
    jsonb_build_object(
      'id', 'mock-media-06',
      'url', 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=1600&q=85',
      'type', 'image',
      'order', 5,
      'isPrimary', false,
      'caption', 'Kitchen'
    ),
    jsonb_build_object(
      'id', 'mock-media-07',
      'url', 'https://images.unsplash.com/photo-1602002418082-a4443e081dd1?w=1600&q=85',
      'type', 'image',
      'order', 6,
      'isPrimary', false,
      'caption', 'Pool terrace'
    ),
    jsonb_build_object(
      'id', 'mock-media-08',
      'url', 'https://images.unsplash.com/photo-1499793983690-e29da59ef1c2?w=1600&q=85',
      'type', 'image',
      'order', 7,
      'isPrimary', false,
      'caption', 'Waterfront'
    ),
    jsonb_build_object(
      'id', 'mock-media-09',
      'url', 'https://images.unsplash.com/photo-1518780664697-55e3ad937233?w=1600&q=85',
      'type', 'image',
      'order', 8,
      'isPrimary', false,
      'caption', 'Retreat'
    )
  );

  UPDATE properties
  SET
    settings = jsonb_set(COALESCE(settings, '{}'::jsonb), '{media}', v_media, true),
    updated_at = now()
  WHERE id = v_prop_id;

  RAISE NOTICE 'seed-monaco-2612-media: set % mock gallery images on property %',
    jsonb_array_length(v_media),
    v_prop_id;
END $$;
