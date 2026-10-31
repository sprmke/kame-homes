#!/usr/bin/env node
/**
 * Generate a large, realistic mock dataset (properties, developments, parkings) for
 * local perf/QA testing of public search, filters, map, and lazy-load ("See more" /
 * pagination). Not part of `db reset` — opt-in only, run: `bun run seed:mock-listings`.
 *
 * Writes idempotent SQL (ON CONFLICT by slug/name) to temp/mock-listings-seed.sql,
 * then applies it to the local Supabase Postgres container. Deterministic (seeded RNG)
 * so reruns update the same rows instead of duplicating.
 */

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const OUT_DIR = join(ROOT, 'temp');
const OUT_FILE = join(OUT_DIR, 'mock-listings-seed.sql');
const ORG_ID = '405ea07f-cc21-4bcc-b540-28729be79f0d'; // Kame Homes — local dev org
const DOCKER_CONTAINER = 'supabase_db_guest-form-management';

// ─── Seeded RNG (mulberry32) — deterministic across reruns ──────────────────
function mulberry32(seed) {
  let a = seed;
  return function rand() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20260822);
const randInt = (min, max) => Math.floor(rand() * (max - min + 1)) + min;
const randFloat = (min, max, step = 1) => {
  const raw = min + rand() * (max - min);
  return Math.round(raw / step) * step;
};
const pick = (arr) => arr[randInt(0, arr.length - 1)];
const pickN = (arr, n) => {
  const pool = [...arr];
  const out = [];
  for (let i = 0; i < n && pool.length > 0; i++) {
    out.push(pool.splice(randInt(0, pool.length - 1), 1)[0]);
  }
  return out;
};
const jitter = (base, pct) => base * (1 + (rand() * 2 - 1) * pct);
// Additive jitter in degrees for lat/lng — ~0.01° ≈ 1.1km, keeps points within the named city.
const jitterCoord = (base, maxDeltaDegrees) => base + (rand() * 2 - 1) * maxDeltaDegrees;

// ─── SQL helpers ──────────────────────────────────────────────────────────
const esc = (s) => String(s).replace(/'/g, "''");
const sqlStr = (s) => (s == null ? 'NULL' : `'${esc(s)}'`);
const sqlNum = (n) => (n == null ? 'NULL' : String(n));
const jsonb = (obj) => `'${esc(JSON.stringify(obj))}'::jsonb`;

function slugify(text) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

const usedSlugs = new Set();
function uniqueSlug(base) {
  let slug = slugify(base);
  let n = 2;
  while (usedSlugs.has(slug)) {
    slug = `${slugify(base)}-${n++}`;
  }
  usedSlugs.add(slug);
  return slug;
}

const usedNames = new Set();
function uniqueName(base) {
  let name = base;
  let n = 2;
  while (usedNames.has(name.toLowerCase())) {
    name = `${base} ${n++}`;
  }
  usedNames.add(name.toLowerCase());
  return name;
}

// ─── Reference data ───────────────────────────────────────────────────────
const CITIES = [
  { city: 'Makati', province: 'Metro Manila', lat: 14.5547, lng: 121.0244, vibe: 'metro' },
  { city: 'Taguig', province: 'Metro Manila', lat: 14.551, lng: 121.0509, vibe: 'metro' },
  { city: 'Quezon City', province: 'Metro Manila', lat: 14.676, lng: 121.0437, vibe: 'metro' },
  { city: 'Pasig', province: 'Metro Manila', lat: 14.5764, lng: 121.0851, vibe: 'metro' },
  { city: 'Mandaluyong', province: 'Metro Manila', lat: 14.5794, lng: 121.0359, vibe: 'metro' },
  { city: 'Manila', province: 'Metro Manila', lat: 14.5995, lng: 120.9842, vibe: 'metro' },
  { city: 'Parañaque', province: 'Metro Manila', lat: 14.4793, lng: 121.0198, vibe: 'metro' },
  { city: 'Muntinlupa', province: 'Metro Manila', lat: 14.4081, lng: 121.0415, vibe: 'metro' },
  { city: 'Pasay', province: 'Metro Manila', lat: 14.5378, lng: 121.0014, vibe: 'metro' },
  { city: 'San Fernando', province: 'Pampanga', lat: 15.0349, lng: 120.6897, vibe: 'provincial' },
  { city: 'Angeles', province: 'Pampanga', lat: 15.145, lng: 120.593, vibe: 'provincial' },
  { city: 'Cebu City', province: 'Cebu', lat: 10.3157, lng: 123.8854, vibe: 'metro' },
  { city: 'Lapu-Lapu', province: 'Cebu', lat: 10.3103, lng: 123.9494, vibe: 'beach' },
  { city: 'Davao City', province: 'Davao del Sur', lat: 7.1907, lng: 125.4553, vibe: 'metro' },
  { city: 'Baguio', province: 'Benguet', lat: 16.4023, lng: 120.596, vibe: 'mountain' },
  { city: 'Tagaytay', province: 'Cavite', lat: 14.1153, lng: 120.9621, vibe: 'mountain' },
  { city: 'Malay', province: 'Aklan', lat: 11.9674, lng: 121.9248, vibe: 'beach' },
  { city: 'El Nido', province: 'Palawan', lat: 11.1949, lng: 119.4116, vibe: 'beach' },
  { city: 'Puerto Princesa', province: 'Palawan', lat: 9.7392, lng: 118.7353, vibe: 'beach' },
  { city: 'Iloilo City', province: 'Iloilo', lat: 10.7202, lng: 122.5621, vibe: 'provincial' },
  { city: 'Bacolod', province: 'Negros Occidental', lat: 10.6765, lng: 122.9509, vibe: 'provincial' },
  { city: 'Nasugbu', province: 'Batangas', lat: 14.0728, lng: 120.6317, vibe: 'beach' },
  { city: 'Subic', province: 'Zambales', lat: 14.8285, lng: 120.2827, vibe: 'beach' },
  { city: 'Santa Rosa', province: 'Laguna', lat: 14.3123, lng: 121.1114, vibe: 'provincial' },
  { city: 'Antipolo', province: 'Rizal', lat: 14.5878, lng: 121.176, vibe: 'mountain' },
  { city: 'Dumaguete', province: 'Negros Oriental', lat: 9.3103, lng: 123.308, vibe: 'provincial' },
  { city: 'General Luna', province: 'Surigao del Norte', lat: 9.7894, lng: 126.155, vibe: 'beach' },
  { city: 'Vigan', province: 'Ilocos Sur', lat: 17.5747, lng: 120.3869, vibe: 'provincial' },
  { city: 'Batangas City', province: 'Batangas', lat: 13.7565, lng: 121.0583, vibe: 'provincial' },
  { city: 'Zamboanga City', province: 'Zamboanga del Sur', lat: 6.9214, lng: 122.079, vibe: 'metro' },
];

const VIBE_PROPERTY_TYPES = {
  metro: ['condo', 'condo', 'condo', 'apartment', 'apartment', 'hotel', 'house'],
  beach: ['resort', 'resort', 'villa', 'villa', 'house', 'condo'],
  mountain: ['cabin', 'cabin', 'house', 'villa', 'townhouse'],
  provincial: ['house', 'house', 'townhouse', 'apartment', 'villa'],
};

const VIBE_DEV_TYPES = {
  metro: ['CONDOMINIUM', 'CONDOMINIUM', 'MIXED_USE'],
  beach: ['CONDOMINIUM', 'SUBDIVISION'],
  mountain: ['SUBDIVISION', 'TOWNHOUSE'],
  provincial: ['SUBDIVISION', 'TOWNHOUSE', 'COMMERCIAL'],
};

const DEV_NAME_PARTS = {
  metro: {
    prefix: ['The', 'One', 'Park', 'Skyline', 'Metro', 'Central', 'Uptown', 'Vertis'],
    core: ['Grand', 'Horizon', 'Vantage', 'Meridian', 'Solstice', 'Axis', 'Summit', 'Prime'],
    suffix: ['Residences', 'Towers', 'Suites', 'Place', 'Heights', 'Enclave'],
  },
  beach: {
    prefix: ['Blue', 'Coral', 'Azure', 'Coastal', 'Tide', 'Lagoon', 'Sunset'],
    core: ['Cove', 'Bay', 'Shore', 'Reef', 'Wave', 'Palm', 'Breeze'],
    suffix: ['Resort', 'Villas', 'Residences', 'Beach Homes', 'Cabanas'],
  },
  mountain: {
    prefix: ['Pine', 'Highland', 'Cloud', 'Ridge', 'Forest', 'Summit'],
    core: ['Crest', 'Valley', 'Grove', 'Peak', 'Wood', 'Mist'],
    suffix: ['Estates', 'Cabins', 'Retreat', 'Lodge', 'Homes'],
  },
  provincial: {
    prefix: ['Green', 'Camella', 'Villa', 'Sunrise', 'Heritage', 'Golden'],
    core: ['Fields', 'Meadows', 'Garden', 'Plains', 'Brook', 'Vista'],
    suffix: ['Subdivision', 'Homes', 'Village', 'Estates', 'Park'],
  },
};

const AMENITY_BASE = ['wifi', 'aircon', 'tv', 'kitchen', 'refrigerator', 'smoke_alarm', 'fire_extinguisher'];
const AMENITY_POOL = [
  'heating', 'washer', 'dryer', 'iron', 'hair_dryer', 'microwave', 'stove', 'oven', 'coffee',
  'dishes', 'dining_area', 'netflix', 'karaoke', 'pool', 'gym', 'hot_tub', 'sauna', 'elevator',
  'parking', 'ev_charger', 'balcony', 'garden', 'bbq', 'beach_access', 'outdoor_dining',
  'security', 'cctv', 'safe', 'crib', 'high_chair', 'pets_allowed', 'first_aid',
];
const VIBE_AMENITY_FAVORS = {
  metro: ['elevator', 'gym', 'pool', 'security', 'cctv', 'parking'],
  beach: ['beach_access', 'pool', 'outdoor_dining', 'bbq', 'garden'],
  mountain: ['garden', 'bbq', 'heating', 'security', 'outdoor_dining'],
  provincial: ['garden', 'parking', 'bbq', 'security', 'pets_allowed'],
};

// Curated, known-good Unsplash photo IDs by scene — reused/extended from existing seed fixtures.
const IMAGES = {
  condoInterior: [
    '1602002418082-a4443e081dd1', '1522708323590-d24dbb6b0267', '1502672260266-1c1ef2d93688',
    '1512917774080-9991f1c4c750', '1484154218962-a197022b5858', '1493809842364-78817add7ffb',
  ],
  houseExterior: [
    '1600585154340-be6161a56a0c', '1600607687939-ce8a6c25118c', '1580587771525-78b9dba3b914',
    '1518780664697-55e3ad937233', '1568605114967-8130f3a36994',
  ],
  beachResort: [
    '1499793983690-e29da59ef1c2', '1571896349842-33c89424de2d', '1540541338287-41700207dee6',
    '1520250497591-112f2f40a3f4', '1571003123894-1f0594d2b5d9',
  ],
  cabinMountain: [
    '1449158743715-0a90ebb6d2d8', '1518602164578-cd0074062767', '1601918774946-25832a4be0d6',
  ],
  developmentCover: [
    '1545324418-cc1a3fa10c00', '1560448204-e02f11c3d0e2', '1599423300746-b62533397364',
    '1600596542815-ffad4c1539a9',
  ],
  parking: [
    '1590674899484-f5649e4292cf', '1568605117037-7b3c22336e38', '1621939514649-280e2ee02510',
    '1558981403-c5f9899a28bc', '1571055107559-3e67626fa8be',
  ],
};
const img = (id, w = 800) => `https://images.unsplash.com/photo-${id}?w=${w}&q=80`;

const TYPE_IMAGE_BUCKET = {
  condo: 'condoInterior', apartment: 'condoInterior', hotel: 'condoInterior',
  house: 'houseExterior', townhouse: 'houseExterior', villa: 'beachResort',
  resort: 'beachResort', cabin: 'cabinMountain',
};

function imagesFor(type, count) {
  const bucket = IMAGES[TYPE_IMAGE_BUCKET[type] ?? 'condoInterior'];
  const chosen = [];
  for (let i = 0; i < count; i++) chosen.push(img(bucket[(i + randInt(0, bucket.length - 1)) % bucket.length]));
  return [...new Set(chosen)];
}

const TYPE_PROFILE = {
  studio: { bedrooms: 0, bathrooms: 1, guests: [2, 3] },
  '1br': { bedrooms: 1, bathrooms: 1, guests: [2, 4] },
  '2br': { bedrooms: 2, bathrooms: 2, guests: [4, 6] },
  '3br': { bedrooms: 3, bathrooms: 2, guests: [6, 8] },
};

function unitProfileFor(propertyType) {
  if (propertyType === 'condo' || propertyType === 'apartment' || propertyType === 'hotel') {
    return pick(['studio', '1br', '1br', '2br', '2br', '3br']);
  }
  return pick(['2br', '3br', '3br']);
}

function bedroomsFor(propertyType, unit) {
  if (unit) return TYPE_PROFILE[unit].bedrooms;
  const table = { house: [3, 5], villa: [3, 6], cabin: [1, 3], resort: [2, 5], townhouse: [2, 4] };
  const [min, max] = table[propertyType] ?? [2, 4];
  return randInt(min, max);
}

function guestsFor(propertyType, unit, bedrooms) {
  if (unit) return randInt(...TYPE_PROFILE[unit].guests);
  return Math.max(2, bedrooms * 2 + randInt(0, 2));
}

const VIBE_BASE_RATE = {
  metro: { condo: 2400, apartment: 2200, hotel: 3200, house: 5500 },
  beach: { resort: 7500, villa: 8500, house: 4500, condo: 4000 },
  mountain: { cabin: 3800, house: 4200, villa: 6000, townhouse: 3200 },
  provincial: { house: 2000, townhouse: 1900, apartment: 1600, villa: 3200 },
};

function priceFor(vibe, type, bedrooms) {
  const base = VIBE_BASE_RATE[vibe]?.[type] ?? 2500;
  const bedroomBump = 1 + bedrooms * 0.18;
  const weekday = Math.round(jitter(base * bedroomBump, 0.25) / 50) * 50;
  const weekend = Math.round(weekday * (1.08 + rand() * 0.1) / 50) * 50;
  return { weekday, weekend };
}

// ─── Generation ────────────────────────────────────────────────────────────
const developments = []; // { slug, name, developerName, type, location, city, description, coverImage, images, amenities, priceMin, priceMax, lat, lng, vibe }
const properties = []; // sql row objects
const parkings = [];
const pricingRows = []; // { slug, weekday, weekend }

const DEVELOPER_NAMES = [
  'Century Properties', 'Ayala Land', 'SM Development Corp', 'Filinvest Land',
  'Megaworld', 'Rockwell Land', 'DMCI Homes', 'Robinsons Land', 'Vista Land',
  'Shang Properties', 'Sta. Lucia Land', 'Cebu Landmasters',
];

for (const cityInfo of CITIES) {
  const { city, province, lat, lng, vibe } = cityInfo;
  const devTypesForCity = VIBE_DEV_TYPES[vibe];
  const devCount = vibe === 'metro' ? randInt(2, 3) : randInt(1, 2);
  const cityDevs = [];

  for (let i = 0; i < devCount; i++) {
    const parts = DEV_NAME_PARTS[vibe];
    const name = uniqueName(`${pick(parts.prefix)} ${pick(parts.core)} ${pick(parts.suffix)}`);
    const devType = pick(devTypesForCity);
    const slug = uniqueSlug(name);
    const devLat = jitterCoord(lat, 0.02);
    const devLng = jitterCoord(lng, 0.02);
    const devImages = [...new Set(pickN(IMAGES.developmentCover, 2).map((id) => img(id)))];
    const amenities = pickN(
      [...new Set([...AMENITY_BASE, ...VIBE_AMENITY_FAVORS[vibe], ...AMENITY_POOL])],
      randInt(6, 10)
    );
    const priceMin = 1600 + randInt(0, 4) * 500;
    const priceMax = priceMin + randInt(4, 12) * 1000;
    const dev = {
      slug,
      name,
      developerName: pick(DEVELOPER_NAMES),
      type: devType,
      location: `${city}, ${province}`,
      city,
      description: `${name} is a ${devType.toLowerCase().replace('_', ' ')} development in ${city}, ${province}.`,
      coverImage: devImages[0] ?? img(pick(IMAGES.developmentCover)),
      images: devImages,
      amenities,
      priceRangeMin: priceMin,
      priceRangeMax: priceMax,
      lat: devLat,
      lng: devLng,
      established: randInt(2012, 2024),
    };
    developments.push(dev);
    cityDevs.push(dev);
  }

  // ── Properties: some tied to a development, some standalone (houses/villas) ──
  const propTypesForCity = VIBE_PROPERTY_TYPES[vibe];
  const propertyCount = vibe === 'metro' ? randInt(11, 15) : randInt(7, 11);

  for (let i = 0; i < propertyCount; i++) {
    const type = pick(propTypesForCity);
    const tieToDev = ['condo', 'apartment', 'hotel', 'resort'].includes(type) && cityDevs.length > 0;
    const dev = tieToDev ? pick(cityDevs) : null;
    const unit = ['condo', 'apartment', 'hotel'].includes(type) ? unitProfileFor(type) : null;
    const bedrooms = bedroomsFor(type, unit);
    const bathrooms = unit ? TYPE_PROFILE[unit].bathrooms : Math.max(1, Math.ceil(bedrooms * 0.7));
    const guests = guestsFor(type, unit, bedrooms);

    const unitLabel = unit === 'studio' ? 'Studio' : unit ? `${unit.toUpperCase()}` : null;
    const nameBase = dev
      ? `${dev.name.split(' ').slice(0, 2).join(' ')} ${unitLabel ?? pick(['Suite', 'Unit'])} ${randInt(101, 2599)}`
      : `${pick(['Cozy', 'Modern', 'Charming', 'Spacious', 'Elegant', 'Serene'])} ${bedrooms}BR ${type === 'villa' ? 'Villa' : type === 'cabin' ? 'Cabin' : type === 'resort' ? 'Resort House' : 'Home'} in ${city}`;
    const name = uniqueName(nameBase);
    const slug = uniqueSlug(name);

    const { weekday, weekend } = priceFor(vibe, type, bedrooms);
    const amenities = pickN(
      [...new Set([...AMENITY_BASE, ...VIBE_AMENITY_FAVORS[vibe], ...AMENITY_POOL])],
      randInt(8, 16)
    );

    const propLat = jitterCoord(dev ? dev.lat : lat, 0.01);
    const propLng = jitterCoord(dev ? dev.lng : lng, 0.01);
    const images = imagesFor(type, randInt(4, 6));

    const settings = {
      city,
      coverImage: images[0],
      images,
      enabledAmenities: amenities,
      bedrooms,
      bathrooms,
      maxAdults: Math.max(1, guests - 1),
      maxChildren: 1,
      latitude: propLat,
      longitude: propLng,
    };

    properties.push({
      orgId: ORG_ID,
      name,
      slug,
      type,
      address: dev ? `${dev.name}, ${city}, ${province}` : `${city}, ${province}`,
      towerAndUnit: dev && unitLabel ? `${pick(['Tower A', 'Tower B', 'Tower C', 'North Wing', 'South Wing'])} ${randInt(5, 40)}${randInt(0, 1) ? '0' : ''}${randInt(1, 9)}` : null,
      residenceName: dev ? dev.name : null,
      maxGuests: guests,
      city,
      settings,
    });

    pricingRows.push({ slug, weekday, weekend });
  }

  // ── Parkings: only for condo-style developments ──────────────────────────
  const condoDevs = cityDevs.filter((d) => d.type === 'CONDOMINIUM' || d.type === 'MIXED_USE');
  for (const dev of condoDevs) {
    const slotCount = randInt(4, 8);
    const towers = pickN(['Tower A', 'Tower B', 'Tower C', 'North Wing', 'South Wing'], randInt(1, 3));
    const usedCombos = new Set();

    for (let i = 0; i < slotCount; i++) {
      const tower = pick(towers);
      const level = pick(['B1', 'B2', 'B3', 'Ground', 'Level 2', 'Level 3']);
      let slotLabel;
      let combo;
      let guard = 0;
      do {
        slotLabel = String(randInt(1, 60)).padStart(2, '0');
        combo = `${dev.name}|${tower}|${level}|${slotLabel}`;
        guard += 1;
      } while (usedCombos.has(combo) && guard < 20);
      usedCombos.add(combo);

      const parkingType = level === 'Ground' ? pick(['outside_tower', 'motorcycle']) : 'inside_tower';
      const rate = Math.round(jitter(vibe === 'metro' ? 320 : 250, 0.3) / 10) * 10;
      const name = `${dev.name.split(' ').slice(0, 2).join(' ')} - ${level} - Slot ${slotLabel}`;
      const slug = uniqueSlug(`${dev.slug}-${tower}-${level}-slot-${slotLabel}`);

      parkings.push({
        orgId: ORG_ID,
        name: uniqueName(name),
        slug,
        residenceName: dev.name,
        tower,
        level,
        slotLabel,
        parkingType,
        ratePerNight: rate,
        acceptedVehicleTypes: parkingType === 'motorcycle' ? ['motorcycle'] : ['car'],
        settings: {
          city,
          coverImage: img(pick(IMAGES.parking)),
          images: [img(pick(IMAGES.parking))],
          features: pickN(['covered', 'cctv', 'guarded', 'wide_space', 'ev_charger'], randInt(1, 3)),
          latitude: jitterCoord(dev.lat, 0.005),
          longitude: jitterCoord(dev.lng, 0.005),
        },
      });
    }
  }
}

// ─── SQL rendering ──────────────────────────────────────────────────────────
function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

const lines = [];
lines.push('-- AUTO-GENERATED by scripts/dev/generate-mock-listings-seed.mjs — do not hand-edit.');
lines.push('-- Hundreds of realistic PH properties/developments/parkings for local search,');
lines.push('-- filter, map, and lazy-load QA. Idempotent (ON CONFLICT by slug/name); NOT part');
lines.push('-- of `db reset` — apply manually via `bun run seed:mock-listings`.');
lines.push(`-- Generated: ${new Date().toISOString()} — ${developments.length} developments, ` +
  `${properties.length} properties, ${parkings.length} parkings.`);
lines.push('');
lines.push('BEGIN;');
lines.push('');

// Developments
lines.push('-- ── Developments ──────────────────────────────────────────────────────');
for (const batch of chunk(developments, 100)) {
  lines.push('INSERT INTO developments (');
  lines.push('  slug, name, developer_name, type, status, location, city, description,');
  lines.push('  cover_image_url, settings');
  lines.push(') VALUES');
  lines.push(
    batch
      .map(
        (d) =>
          `  (${sqlStr(d.slug)}, ${sqlStr(d.name)}, ${sqlStr(d.developerName)}, ${sqlStr(d.type)}, 'ACTIVE', ` +
          `${sqlStr(d.location)}, ${sqlStr(d.city)}, ${sqlStr(d.description)}, ${sqlStr(d.coverImage)}, ` +
          `${jsonb({
            images: d.images,
            amenities: d.amenities,
            priceRangeMin: d.priceRangeMin,
            priceRangeMax: d.priceRangeMax,
            established: d.established,
            latitude: d.lat,
            longitude: d.lng,
          })})`
      )
      .join(',\n')
  );
  lines.push('ON CONFLICT (slug) DO UPDATE SET');
  lines.push('  name = EXCLUDED.name, status = \'ACTIVE\', developer_name = EXCLUDED.developer_name,');
  lines.push('  type = EXCLUDED.type, location = EXCLUDED.location, city = EXCLUDED.city,');
  lines.push('  description = EXCLUDED.description, cover_image_url = EXCLUDED.cover_image_url,');
  lines.push('  settings = EXCLUDED.settings, updated_at = now();');
  lines.push('');
}

// Properties
lines.push('-- ── Properties ────────────────────────────────────────────────────────');
for (const batch of chunk(properties, 100)) {
  lines.push('INSERT INTO properties (');
  lines.push('  organization_id, name, slug, type, status, address, tower_and_unit,');
  lines.push('  residence_name, max_guests, city, settings');
  lines.push(') VALUES');
  lines.push(
    batch
      .map(
        (p) =>
          `  (${sqlStr(p.orgId)}, ${sqlStr(p.name)}, ${sqlStr(p.slug)}, ${sqlStr(p.type)}, 'ACTIVE', ` +
          `${sqlStr(p.address)}, ${sqlStr(p.towerAndUnit)}, ${sqlStr(p.residenceName)}, ${sqlNum(p.maxGuests)}, ` +
          `${sqlStr(p.city)}, ${jsonb(p.settings)})`
      )
      .join(',\n')
  );
  lines.push('ON CONFLICT (slug) DO UPDATE SET');
  lines.push('  name = EXCLUDED.name, status = \'ACTIVE\', address = EXCLUDED.address,');
  lines.push('  tower_and_unit = EXCLUDED.tower_and_unit, residence_name = EXCLUDED.residence_name,');
  lines.push('  max_guests = EXCLUDED.max_guests, city = EXCLUDED.city, settings = EXCLUDED.settings,');
  lines.push('  updated_at = now();');
  lines.push('');
}

// Parkings
lines.push('-- ── Parkings ──────────────────────────────────────────────────────────');
for (const batch of chunk(parkings, 100)) {
  lines.push('INSERT INTO parkings (');
  lines.push('  organization_id, name, slug, status, residence_name, tower, level, slot_label,');
  lines.push('  parking_type, rate_per_night, accepted_vehicle_types, settings');
  lines.push(') VALUES');
  lines.push(
    batch
      .map(
        (p) =>
          `  (${sqlStr(p.orgId)}, ${sqlStr(p.name)}, ${sqlStr(p.slug)}, 'ACTIVE', ${sqlStr(p.residenceName)}, ` +
          `${sqlStr(p.tower)}, ${sqlStr(p.level)}, ${sqlStr(p.slotLabel)}, ${sqlStr(p.parkingType)}, ` +
          `${sqlNum(p.ratePerNight)}, ARRAY[${p.acceptedVehicleTypes.map(sqlStr).join(', ')}]::text[], ` +
          `${jsonb(p.settings)})`
      )
      .join(',\n')
  );
  lines.push('ON CONFLICT (slug) DO UPDATE SET');
  lines.push('  name = EXCLUDED.name, status = \'ACTIVE\', residence_name = EXCLUDED.residence_name,');
  lines.push('  tower = EXCLUDED.tower, level = EXCLUDED.level, slot_label = EXCLUDED.slot_label,');
  lines.push('  parking_type = EXCLUDED.parking_type, rate_per_night = EXCLUDED.rate_per_night,');
  lines.push('  accepted_vehicle_types = EXCLUDED.accepted_vehicle_types, settings = EXCLUDED.settings,');
  lines.push('  updated_at = now();');
  lines.push('');
}

// Pricing (app_settings) — one statement per batch, joined by slug subquery.
lines.push('-- ── Pricing (app_settings.weekday/weekend_nightly_rate) ─────────────────');
for (const batch of chunk(pricingRows, 150)) {
  lines.push('INSERT INTO app_settings (property_id, weekday_nightly_rate, weekend_nightly_rate)');
  lines.push('SELECT p.id, v.weekday, v.weekend');
  lines.push('FROM (VALUES');
  lines.push(
    batch.map((r) => `  (${sqlStr(r.slug)}, ${sqlNum(r.weekday)}, ${sqlNum(r.weekend)})`).join(',\n')
  );
  lines.push(') AS v(slug, weekday, weekend)');
  lines.push('JOIN properties p ON p.slug = v.slug');
  lines.push('ON CONFLICT (property_id) WHERE property_id IS NOT NULL DO UPDATE SET');
  lines.push('  weekday_nightly_rate = EXCLUDED.weekday_nightly_rate,');
  lines.push('  weekend_nightly_rate = EXCLUDED.weekend_nightly_rate,');
  lines.push('  updated_at = now();');
  lines.push('');
}

lines.push('COMMIT;');

if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(OUT_FILE, lines.join('\n'), 'utf8');
console.log(
  `Wrote ${OUT_FILE}\n` +
    `  developments: ${developments.length}\n  properties:   ${properties.length}\n  parkings:     ${parkings.length}`
);

// ─── Apply to local Supabase Postgres (docker) ──────────────────────────────
const shouldApply = !process.argv.includes('--no-apply');
if (shouldApply) {
  try {
    execFileSync('docker', ['inspect', DOCKER_CONTAINER], { stdio: 'ignore' });
  } catch {
    console.log(
      `\nLocal Supabase container "${DOCKER_CONTAINER}" not found/running — skipping apply.\n` +
        `Run \`./dev.sh\` or \`bun run start:supabase\` first, then re-run this script,\n` +
        `or apply manually:\n  docker exec -i ${DOCKER_CONTAINER} psql -U postgres -d postgres < ${OUT_FILE}`
    );
    process.exit(0);
  }

  console.log(`\nApplying to local Postgres (${DOCKER_CONTAINER})…`);
  const sql = lines.join('\n');
  execFileSync('docker', ['exec', '-i', DOCKER_CONTAINER, 'psql', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1'], {
    input: sql,
    stdio: ['pipe', 'inherit', 'inherit'],
  });
  console.log('Done.');
}
