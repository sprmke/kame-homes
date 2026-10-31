-- Search typeahead / See-all fixtures (local + db reset).
-- Goal: typing `azure` returns ≥4 properties, ≥4 parkings, ≥3 developments
-- so the typeahead preview (max 3) shows **See all**.
-- Safe to re-run: ON CONFLICT / fixed UUIDs.

-- ── Developments (name unique globally) ──────────────────────────────
INSERT INTO developments (
  id, slug, name, developer_name, type, status, location, city, description,
  cover_image_url, settings
)
VALUES
  (
    'a1111111-1111-4111-8111-111111111101',
    'azure-urban-resort-residences',
    'Azure Urban Resort Residences',
    'Century Properties',
    'CONDOMINIUM',
    'ACTIVE',
    'Parañaque, Metro Manila',
    'Parañaque',
    'Search fixture — sibling Azure development for typeahead See all.',
    'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=1200&q=85',
    jsonb_build_object(
      'images', jsonb_build_array(
        'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=1200&q=85',
        'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=1200&q=85'
      )
    )
  ),
  (
    'a1111111-1111-4111-8111-111111111102',
    'azure-north-bay',
    'Azure North Bay',
    'Century Properties',
    'CONDOMINIUM',
    'ACTIVE',
    'San Fernando, Pampanga',
    'San Fernando',
    'Search fixture — Azure North Bay promenade cluster.',
    'https://images.unsplash.com/photo-1599423300746-b62533397364?w=1200&q=85',
    jsonb_build_object(
      'images', jsonb_build_array(
        'https://images.unsplash.com/photo-1599423300746-b62533397364?w=1200&q=85',
        'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1200&q=85'
      )
    )
  ),
  (
    'a1111111-1111-4111-8111-111111111103',
    'azure-north-phase-2',
    'Azure North Residences Phase 2',
    'Century Properties',
    'CONDOMINIUM',
    'ACTIVE',
    'San Fernando, Pampanga',
    'San Fernando',
    'Search fixture — Phase 2 tower cluster for typeahead.',
    'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=1200&q=85',
    jsonb_build_object(
      'images', jsonb_build_array(
        'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=1200&q=85',
        'https://images.unsplash.com/photo-1518780664697-55e3ad937233?w=1200&q=85'
      )
    )
  )
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  status = 'ACTIVE',
  city = EXCLUDED.city,
  location = EXCLUDED.location,
  cover_image_url = EXCLUDED.cover_image_url,
  settings = EXCLUDED.settings,
  updated_at = now();

-- ── Properties (tower ∈ Monaco|Bali|Barbados; unique ACTIVE tower+unit) ──
-- Org: Kame (405ea07f-…) — same as kame-homes / parking seed org.
INSERT INTO properties (
  id, organization_id, name, slug, type, status, residence_name,
  max_guests, tower, unit_number, tower_and_unit, city, address, settings
)
VALUES
  (
    'b2222222-2222-4222-8222-222222222201',
    '405ea07f-cc21-4bcc-b540-28729be79f0d',
    'Azure North Studio',
    'azure-north-studio',
    'CONDO',
    'ACTIVE',
    'Azure North Residences',
    2,
    'Bali',
    '1101',
    'Bali 1101',
    'San Fernando',
    'Azure North Residences, San Fernando, Pampanga',
    jsonb_build_object(
      'city', 'San Fernando',
      'coverImage', 'https://images.unsplash.com/photo-1602002418082-a4443e081dd1?w=800&q=80',
      'images', jsonb_build_array(
        'https://images.unsplash.com/photo-1602002418082-a4443e081dd1?w=800&q=80',
        'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800&q=80'
      )
    )
  ),
  (
    'b2222222-2222-4222-8222-222222222202',
    '405ea07f-cc21-4bcc-b540-28729be79f0d',
    'Azure North 1BR Lagoon',
    'azure-north-1br',
    'CONDO',
    'ACTIVE',
    'Azure North Residences',
    3,
    'Bali',
    '1205',
    'Bali 1205',
    'San Fernando',
    'Azure North Residences, San Fernando, Pampanga',
    jsonb_build_object(
      'city', 'San Fernando',
      'coverImage', 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=800&q=80',
      'images', jsonb_build_array(
        'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=800&q=80',
        'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800&q=80'
      )
    )
  ),
  (
    'b2222222-2222-4222-8222-222222222203',
    '405ea07f-cc21-4bcc-b540-28729be79f0d',
    'Azure North 2BR Family',
    'azure-north-2br',
    'CONDO',
    'ACTIVE',
    'Azure North Residences',
    5,
    'Barbados',
    '1508',
    'Barbados 1508',
    'San Fernando',
    'Azure North Residences, San Fernando, Pampanga',
    jsonb_build_object(
      'city', 'San Fernando',
      'coverImage', 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800&q=80',
      'images', jsonb_build_array(
        'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800&q=80',
        'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800&q=80'
      )
    )
  ),
  (
    'b2222222-2222-4222-8222-222222222204',
    '405ea07f-cc21-4bcc-b540-28729be79f0d',
    'Azure North Bali Tower 1BR',
    'azure-bali-1br',
    'CONDO',
    'ACTIVE',
    'Azure North Residences',
    3,
    'Bali',
    '2103',
    'Bali 2103',
    'San Fernando',
    'Azure North Residences, San Fernando, Pampanga',
    jsonb_build_object(
      'city', 'San Fernando',
      'coverImage', 'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=800&q=80',
      'images', jsonb_build_array(
        'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=800&q=80',
        'https://images.unsplash.com/photo-1499793983690-e29da59ef1c2?w=800&q=80'
      )
    )
  )
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  status = 'ACTIVE',
  residence_name = EXCLUDED.residence_name,
  city = EXCLUDED.city,
  settings = EXCLUDED.settings,
  updated_at = now();

-- ── Parkings (unique residence+tower+level+slot) ─────────────────────
INSERT INTO parkings (
  id, organization_id, name, slug, status, residence_name, tower, level,
  slot_label, parking_type, rate_per_night, settings
)
VALUES
  (
    'c3333333-3333-4333-8333-333333333301',
    '405ea07f-cc21-4bcc-b540-28729be79f0d',
    'Azure Monaco - Level 2 - Slot 27',
    'monaco-level-2-slot-27',
    'ACTIVE',
    'Azure North Residences',
    'Monaco',
    'Level 2',
    '27',
    'inside_tower',
    350,
    jsonb_build_object(
      'coverImage', 'https://images.unsplash.com/photo-1590674899484-f5649e4292cf?w=800&q=80',
      'images', jsonb_build_array(
        'https://images.unsplash.com/photo-1590674899484-f5649e4292cf?w=800&q=80'
      )
    )
  ),
  (
    'c3333333-3333-4333-8333-333333333302',
    '405ea07f-cc21-4bcc-b540-28729be79f0d',
    'Azure Bali - B1 - Slot 01',
    'bali-b1-slot-01',
    'ACTIVE',
    'Azure North Residences',
    'Bali',
    'B1',
    '01',
    'inside_tower',
    320,
    jsonb_build_object(
      'coverImage', 'https://images.unsplash.com/photo-1568605117037-7b3c22336e38?w=800&q=80',
      'images', jsonb_build_array(
        'https://images.unsplash.com/photo-1568605117037-7b3c22336e38?w=800&q=80'
      )
    )
  ),
  (
    'c3333333-3333-4333-8333-333333333303',
    '405ea07f-cc21-4bcc-b540-28729be79f0d',
    'Azure Barbados - B2 - Slot 12',
    'barbados-b2-slot-12',
    'ACTIVE',
    'Azure North Residences',
    'Barbados',
    'B2',
    '12',
    'inside_tower',
    300,
    jsonb_build_object(
      'coverImage', 'https://images.unsplash.com/photo-1621939514649-280e2ee02510?w=800&q=80',
      'images', jsonb_build_array(
        'https://images.unsplash.com/photo-1621939514649-280e2ee02510?w=800&q=80'
      )
    )
  ),
  (
    'c3333333-3333-4333-8333-333333333304',
    '405ea07f-cc21-4bcc-b540-28729be79f0d',
    'Azure Bay - Ground - Slot 05',
    'azure-bay-ground-slot-05',
    'ACTIVE',
    'Azure North Residences',
    'Monaco',
    'Ground',
    '05',
    'outside_tower',
    280,
    jsonb_build_object(
      'coverImage', 'https://images.unsplash.com/photo-1558981403-c5f9899a28bc?w=800&q=80',
      'images', jsonb_build_array(
        'https://images.unsplash.com/photo-1558981403-c5f9899a28bc?w=800&q=80'
      )
    )
  )
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  status = 'ACTIVE',
  residence_name = EXCLUDED.residence_name,
  settings = EXCLUDED.settings,
  updated_at = now();
