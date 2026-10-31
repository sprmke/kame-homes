-- Platform-level developments (maps to properties.residence_name / parkings.residence_name)

CREATE TABLE IF NOT EXISTS developments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL UNIQUE,
  developer_name TEXT,
  type TEXT NOT NULL DEFAULT 'CONDOMINIUM'
    CHECK (type IN ('CONDOMINIUM', 'SUBDIVISION', 'MIXED_USE', 'TOWNHOUSE', 'COMMERCIAL')),
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE')),
  location TEXT,
  city TEXT,
  description TEXT,
  cover_image_url TEXT,
  settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS developments_status_idx ON developments (status);
CREATE INDEX IF NOT EXISTS developments_city_idx ON developments (city);

-- Seed Azure North from marketing mock (idempotent)
INSERT INTO developments (
  slug,
  name,
  developer_name,
  type,
  status,
  location,
  city,
  description,
  cover_image_url,
  settings
)
VALUES (
  'azure-north-residences',
  'Azure North Residences',
  'Century Properties',
  'CONDOMINIUM',
  'ACTIVE',
  'San Fernando City, Pampanga',
  'San Fernando City',
  'Azure North Residences is a premier waterfront development in San Fernando City, Pampanga. Inspired by the luxurious Azure Urban Resort in Parañaque, Azure North brings the resort-living lifestyle to Central Luzon with its stunning lagoon pool, lush landscapes, and world-class amenities. Towers include Monaco, Bali, and Barbados, with ground parking at the Bay promenade.',
  'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=1200&q=85',
  jsonb_build_object(
    'images', jsonb_build_array(
      'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=1200&q=85',
      'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=1200&q=85',
      'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=1200&q=85',
      'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=1200&q=85'
    ),
    'amenities', jsonb_build_array(
      'Lagoon Pool',
      'Gym & Fitness Center',
      'Clubhouse',
      'Basketball Court',
      'Jogging Trail',
      'Children''s Play Area',
      '24/7 Security',
      'CCTV Surveillance',
      'Function Rooms',
      'Commercial Strip'
    ),
    'website', 'https://centuryproperties.ph',
    'established', 2019,
    'totalUnits', 1400,
    'priceRangeMin', 2800,
    'priceRangeMax', 6500,
    'propertyTowers', jsonb_build_array('Monaco', 'Bali', 'Barbados'),
    'parkingTowers', jsonb_build_array('Monaco', 'Bali', 'Barbados', 'Bay'),
    'parkingLevels', jsonb_build_array('B1', 'B2', 'B3', 'G')
  )
)
ON CONFLICT (slug) DO NOTHING;
