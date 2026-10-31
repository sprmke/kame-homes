/**
 * SQL ↔ TS parity for the public listing search index
 * (migration 20261316126800_public_listing_search_index.sql).
 *
 * The index re-implements TS derivations in SQL (place labels, slugs, coordinates,
 * ratings, prices, capacity). This test fails the moment either side drifts:
 *   1. SQL helpers vs TS helpers on hand-picked edge cases.
 *   2. Every indexed row vs the TS derivation of its source rows.
 *
 * Runs against the local stack only:
 *   LOCAL_LISTING_SEARCH_LIVE=1 deno test --allow-net --allow-env --allow-read --allow-import \
 *     supabase/functions/tests/publicListingSearchParity.integration_test.ts
 */

import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import { LOCAL_SUPABASE_SERVICE_ROLE_KEY, LOCAL_SUPABASE_URL } from './_localSupabaseEnv.ts';
import {
  normalizeCityPlace,
  propertyPlaceLabel,
  readSettingsString,
  toLocationSlug,
} from '../_shared/listingPlace.ts';
import { listApprovedPublicExternalReviews } from '../_shared/propertyExternalReviews.ts';
import { resolveListingCoords } from '../_shared/publicGeoScope.ts';
import { rankTextMatch } from '../_shared/publicSearch.ts';
import { slugifyName } from '../_shared/slugUtils.ts';

const enabled = Deno.env.get('LOCAL_LISTING_SEARCH_LIVE') === '1';

const headers = {
  apikey: LOCAL_SUPABASE_SERVICE_ROLE_KEY,
  Authorization: `Bearer ${LOCAL_SUPABASE_SERVICE_ROLE_KEY}`,
  'Content-Type': 'application/json',
};

async function rpc<T>(fn: string, body: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${LOCAL_SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${fn}: ${res.status} ${await res.text()}`);
  return (await res.json()) as T;
}

async function selectAll(
  table: string,
  select: string,
  orderBy = 'id'
): Promise<Record<string, unknown>[]> {
  const rows: Record<string, unknown>[] = [];
  for (let from = 0; ; from += 1000) {
    const res = await fetch(
      `${LOCAL_SUPABASE_URL}/rest/v1/${table}?select=${encodeURIComponent(select)}&order=${orderBy}`,
      { headers: { ...headers, Range: `${from}-${from + 999}` } }
    );
    if (!res.ok) throw new Error(`${table}: ${res.status} ${await res.text()}`);
    const page = (await res.json()) as Record<string, unknown>[];
    rows.push(...page);
    if (page.length < 1000) return rows;
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function strictNumber(settings: Record<string, unknown>, key: string): number | null {
  const value = settings[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function close(a: number | null, b: number | null): boolean {
  if (a == null || b == null) return a === b;
  return Math.abs(a - b) < 1e-9;
}

Deno.test({
  name: 'SQL helpers match TS helpers on edge cases',
  ignore: !enabled,
  async fn() {
    const places: Array<[string | null, string | null, Record<string, unknown>]> = [
      ['Parañaque', null, {}],
      ['  Makati City ', 'Azure North Residences', {}],
      ['Bonifacio Global City', 'Taguig City', {}],
      ['BGC, Taguig', null, {}],
      [null, null, { city: '  Tagaytay City' }],
      [null, null, {}],
      ['', '  ', { city: '' }],
      ['City', null, {}],
      ['Sta. Rosa', 'Laguna', {}],
      ['Iloilo City, Iloilo', null, {}],
    ];
    for (const [city, residence, settings] of places) {
      const expected = propertyPlaceLabel({ city, residence_name: residence, settings });
      const label = await rpc<string>('pls_property_place_label', {
        city,
        residence_name: residence,
        settings,
      });
      assertEquals(label, expected, `place label for ${JSON.stringify([city, residence])}`);
      assertEquals(await rpc<string>('pls_location_slug', { place: label }), toLocationSlug(label));
    }

    for (const raw of ['Davao City', ' Quezon City ', '', '   ', 'City', 'Las Piñas City']) {
      assertEquals(
        await rpc<string>('pls_normalize_city_place', { value: raw }),
        normalizeCityPlace(raw)
      );
    }

    for (const raw of ['Azure North Residences', '  The Rise -- Makati! ', 'É', '---']) {
      assertEquals(await rpc<string>('pls_slugify_name', { value: raw }), slugifyName(raw));
    }

    const coordCases: Array<[Record<string, unknown>, string | null]> = [
      [{ latitude: 14.5, longitude: 121.0 }, null],
      [{ latitude: '14.5', longitude: ' 121 ' }, null],
      [{ latitude: 'abc', longitude: 121 }, 'Azure North'],
      [{ latitude: 'Infinity', longitude: 1 }, null],
      [{}, 'azure north residences'],
      [{ latitude: 1 }, null],
    ];
    for (const [settings, residence] of coordCases) {
      const expected = resolveListingCoords(settings, residence);
      const lat = await rpc<number | null>('pls_listing_lat', {
        settings,
        residence_name: residence,
      });
      const lng = await rpc<number | null>('pls_listing_lng', {
        settings,
        residence_name: residence,
      });
      assertEquals(lat, expected?.lat ?? null, `lat for ${JSON.stringify(settings)}`);
      assertEquals(lng, expected?.lng ?? null, `lng for ${JSON.stringify(settings)}`);
    }

    const reviewCases: unknown[] = [
      [],
      [{ moderationStatus: 'approved', starRating: 4 }],
      [{ moderationStatus: ' Approved ', starRating: '3.5' }],
      [{ moderationStatus: 'approved', starRating: null }],
      [{ moderationStatus: 'approved', starRating: 9 }],
      [{ moderationStatus: 'approved', starRating: '' }],
      [{ moderationStatus: 'pending', starRating: 1 }],
      [{ moderationStatus: 'approved', starRating: 2.5 }, 'junk', null],
      Array.from({ length: 7 }, () => ({ moderationStatus: 'approved', starRating: 1 })),
    ];
    for (const reviews of reviewCases) {
      const approved = listApprovedPublicExternalReviews(reviews);
      const stats = await rpc<{ rating_sum: number; rating_count: number }>(
        'pls_external_review_stats',
        { reviews }
      );
      assertEquals(stats.rating_count, approved.length, `count for ${JSON.stringify(reviews)}`);
      assertEquals(
        stats.rating_sum,
        approved.reduce((sum, review) => sum + review.rating, 0),
        `sum for ${JSON.stringify(reviews)}`
      );
    }

    const rankCases: Array<[string, string[]]> = [
      ['azure', ['Azure North', 'San Fernando']],
      ['north', ['Azure North Residences']],
      ['fernando', ['San Fernando, Pampanga']],
      ['ando', ['San Fernando']],
      ['makati', ['Makati']],
      ['x', ['Azure']],
      ['condo', ['Azure-Condo/Unit']],
      ['san fer', ['Azure San Fernando']],
      ['a.b', ['x a.b', 'aXb']],
      ['(1)', ['Unit (1)']],
      ['c++', ['Tower C++']],
      ['azure', ['  Azure  ']],
      ['tower', ['North-Tower', null as unknown as string]],
    ];
    for (const [query, fields] of rankCases) {
      assertEquals(
        await rpc<number>('pls_text_rank', { query, fields }),
        rankTextMatch(query, ...fields),
        `rank for ${query}`
      );
    }
  },
});

Deno.test({
  name: 'every indexed property matches its TS derivation',
  ignore: !enabled,
  async fn() {
    const [properties, appSettings, reviews, index] = await Promise.all([
      selectAll(
        'properties',
        'id,slug,name,type,city,residence_name,max_guests,settings,status,created_at'
      ),
      selectAll('app_settings', 'id,property_id,weekday_nightly_rate,external_reviews'),
      selectAll('guest_reviews', 'id,property_id,star_rating'),
      selectAll(
        'public_listing_search',
        'id,family,slug,place_label,place_slug,type_key,price,bedrooms,capacity,amenity_ids,lat,lng,rating,review_count'
      ),
    ]);

    const settingsByProperty = new Map(appSettings.map((row) => [row.property_id, row]));
    const reviewsByProperty = new Map<string, number[]>();
    for (const review of reviews) {
      const list = reviewsByProperty.get(review.property_id as string) ?? [];
      list.push(Number(review.star_rating));
      reviewsByProperty.set(review.property_id as string, list);
    }
    const indexed = new Map(
      index.filter((row) => row.family === 'property').map((row) => [row.id, row])
    );

    const active = properties.filter((row) => row.status === 'ACTIVE');
    assertEquals(indexed.size, active.length, 'one index row per ACTIVE property');

    for (const row of active) {
      const idx = indexed.get(row.id);
      if (!idx) throw new Error(`missing index row for property ${row.id}`);
      const settings = asRecord(row.settings);
      const place = propertyPlaceLabel({
        city: row.city as string | null,
        residence_name: row.residence_name as string | null,
        settings,
      });
      assertEquals(idx.place_label, place, `place for ${row.slug}`);
      assertEquals(idx.place_slug, toLocationSlug(place), `slug for ${row.slug}`);
      assertEquals(idx.type_key, String(row.type ?? '').toLowerCase());

      const app = settingsByProperty.get(row.id);
      const rate = app?.weekday_nightly_rate != null ? Number(app.weekday_nightly_rate) : 2799;
      assertEquals(Number(idx.price), rate, `price for ${row.slug}`);

      const coords = resolveListingCoords(settings, row.residence_name as string | null);
      assertEquals(close(idx.lat as number | null, coords?.lat ?? null), true, `lat ${row.slug}`);
      assertEquals(close(idx.lng as number | null, coords?.lng ?? null), true, `lng ${row.slug}`);

      const guestRatings = reviewsByProperty.get(row.id as string) ?? [];
      const external = listApprovedPublicExternalReviews(app?.external_reviews);
      const count = guestRatings.length + external.length;
      const sum =
        guestRatings.reduce((total, value) => total + value, 0) +
        external.reduce((total, review) => total + review.rating, 0);
      assertEquals(idx.review_count, count, `review count ${row.slug}`);
      assertEquals(
        idx.rating == null ? null : Number(idx.rating),
        count > 0 ? Math.round((sum / count) * 10) / 10 : null,
        `rating ${row.slug}`
      );

      const maxAdults = strictNumber(settings, 'maxAdults');
      const maxChildren = strictNumber(settings, 'maxChildren') ?? 0;
      const maxGuests = row.max_guests as number | null;
      const capacity =
        maxGuests && maxGuests > 0
          ? maxGuests
          : maxAdults != null
            ? Math.max(Math.floor(maxAdults + Math.max(maxChildren, 0)), 1)
            : null;
      assertEquals(idx.capacity, capacity, `capacity ${row.slug}`);
      assertEquals(
        idx.bedrooms ?? null,
        strictNumber(settings, 'bedrooms'),
        `bedrooms ${row.slug}`
      );

      const amenities = Array.isArray(settings.enabledAmenities)
        ? [
            ...new Set(
              (settings.enabledAmenities as unknown[])
                .filter((entry): entry is string => typeof entry === 'string')
                .map((entry) => entry.trim())
                .filter(Boolean)
            ),
          ].sort()
        : [];
      assertEquals([...(idx.amenity_ids as string[])].sort(), amenities, `amenities ${row.slug}`);
    }
  },
});

Deno.test({
  name: 'every indexed development and parking matches its TS derivation',
  ignore: !enabled,
  async fn() {
    const [developments, parkings, parkingSettings, index] = await Promise.all([
      selectAll('developments', 'id,slug,name,city,settings,status'),
      selectAll('parkings', 'id,slug,residence_name,settings,status'),
      selectAll('parking_settings', 'parking_id,weekday_nightly_rate', 'parking_id'),
      selectAll(
        'public_listing_search',
        'id,family,place_label,place_slug,price,price_max,lat,lng,residence_slug'
      ),
    ]);
    const byKey = new Map(index.map((row) => [`${row.family}:${row.id}`, row]));

    for (const row of developments.filter((dev) => dev.status === 'ACTIVE')) {
      const idx = byKey.get(`development:${row.id}`);
      if (!idx) throw new Error(`missing index row for development ${row.id}`);
      const settings = asRecord(row.settings);
      const place = normalizeCityPlace(row.city);
      assertEquals(idx.place_label, place);
      assertEquals(idx.place_slug, toLocationSlug(place));
      const priceMin = strictNumber(settings, 'priceRangeMin') ?? 0;
      assertEquals(Number(idx.price), priceMin);
      assertEquals(Number(idx.price_max), strictNumber(settings, 'priceRangeMax') ?? priceMin);
      const coords = resolveListingCoords(settings, row.name as string);
      assertEquals(close(idx.lat as number | null, coords?.lat ?? null), true);
      assertEquals(close(idx.lng as number | null, coords?.lng ?? null), true);
    }

    const rateByParking = new Map(
      parkingSettings.map((row) => [row.parking_id, row.weekday_nightly_rate])
    );
    for (const row of parkings.filter((parking) => parking.status === 'ACTIVE')) {
      const idx = byKey.get(`parking:${row.id}`);
      if (!idx) throw new Error(`missing index row for parking ${row.id}`);
      const place = normalizeCityPlace(readSettingsString(row.settings, 'city'));
      assertEquals(idx.place_label, place, `place for parking ${row.slug}`);
      assertEquals(idx.place_slug, toLocationSlug(place));
      const rate = rateByParking.get(row.id);
      assertEquals(Number(idx.price), rate != null ? Number(rate) : 300);
      const residence = (row.residence_name as string | null)?.trim() || null;
      assertEquals(idx.residence_slug ?? null, residence ? slugifyName(residence) : null);
      const coords = resolveListingCoords(row.settings, row.residence_name as string | null);
      assertEquals(close(idx.lat as number | null, coords?.lat ?? null), true);
      assertEquals(close(idx.lng as number | null, coords?.lng ?? null), true);
    }
  },
});

async function patch(table: string, filter: string, body: Record<string, unknown>): Promise<void> {
  const res = await fetch(`${LOCAL_SUPABASE_URL}/rest/v1/${table}?${filter}`, {
    method: 'PATCH',
    headers: { ...headers, Prefer: 'return=minimal' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`patch ${table}: ${res.status} ${await res.text()}`);
}

async function insert(table: string, body: Record<string, unknown>): Promise<Record<string, unknown>> {
  const res = await fetch(`${LOCAL_SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: { ...headers, Prefer: 'return=representation' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`insert ${table}: ${res.status} ${await res.text()}`);
  return ((await res.json()) as Record<string, unknown>[])[0]!;
}

async function remove(table: string, filter: string): Promise<void> {
  const res = await fetch(`${LOCAL_SUPABASE_URL}/rest/v1/${table}?${filter}`, {
    method: 'DELETE',
    headers,
  });
  if (!res.ok) throw new Error(`delete ${table}: ${res.status} ${await res.text()}`);
}

async function indexRow(family: string, id: string): Promise<Record<string, unknown> | null> {
  const res = await fetch(
    `${LOCAL_SUPABASE_URL}/rest/v1/public_listing_search?family=eq.${family}&id=eq.${id}&select=*`,
    { headers }
  );
  const rows = (await res.json()) as Record<string, unknown>[];
  return rows[0] ?? null;
}

Deno.test({
  name: 'index triggers follow listing, price, review, status, and block changes',
  ignore: !enabled,
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    const [property] = await selectAll('properties', 'id,slug,settings,status');
    const propertyId = property!.id as string;
    const originalSettings = property!.settings as Record<string, unknown>;
    const [appRow] = (await selectAll(
      'app_settings',
      'id,property_id,weekday_nightly_rate,external_reviews'
    )).filter((row) => row.property_id === propertyId);

    try {
      // settings.city → place label / slug (city column follows via the existing sync trigger).
      await patch('properties', `id=eq.${propertyId}`, {
        settings: { ...originalSettings, city: 'Zzz Parity City' },
      });
      assertEquals((await indexRow('property', propertyId))?.place_slug, 'zzz-parity');

      // Price + approved external review → price / rating.
      if (appRow) {
        await patch('app_settings', `id=eq.${appRow.id}`, {
          weekday_nightly_rate: 4321,
          external_reviews: [
            ...((appRow.external_reviews as unknown[]) ?? []).slice(0, 4),
            { id: 'parity-test', moderationStatus: 'approved', starRating: 1 },
          ],
        });
        const row = await indexRow('property', propertyId);
        assertEquals(Number(row?.price), 4321);
        const result = await rpc<{ total: number; ids: string[] }>('search_public_properties', {
          p: { minPrice: 4321, maxPrice: 4321, placeSlug: 'zzz-parity', limit: 5 },
        });
        assertEquals(result.ids, [propertyId]);
      }

      // Owner block → excluded from an overlapping date search, included after it.
      const block = await insert('property_blocked_dates', {
        property_id: propertyId,
        start_date: '2031-01-10',
        end_date: '2031-01-12',
      });
      const blocked = await rpc<{ ids: string[] }>('search_public_properties', {
        p: { placeSlug: 'zzz-parity', checkIn: '2031-01-11', checkOut: '2031-01-13', limit: 5 },
      });
      assertEquals(blocked.ids, []);
      const free = await rpc<{ ids: string[] }>('search_public_properties', {
        p: { placeSlug: 'zzz-parity', checkIn: '2031-01-12', checkOut: '2031-01-14', limit: 5 },
      });
      assertEquals(free.ids, [propertyId], 'checkout-exclusive block end');
      await remove('property_blocked_dates', `id=eq.${block.id}`);

      // INACTIVE → removed from the index; ACTIVE → back.
      await patch('properties', `id=eq.${propertyId}`, { status: 'INACTIVE' });
      assertEquals(await indexRow('property', propertyId), null);
      await patch('properties', `id=eq.${propertyId}`, { status: 'ACTIVE' });
      assertEquals((await indexRow('property', propertyId))?.place_slug, 'zzz-parity');
    } finally {
      await patch('properties', `id=eq.${propertyId}`, {
        settings: originalSettings,
        status: property!.status,
      });
      if (appRow) {
        await patch('app_settings', `id=eq.${appRow.id}`, {
          weekday_nightly_rate: appRow.weekday_nightly_rate,
          external_reviews: appRow.external_reviews,
        });
      }
    }
  },
});

Deno.test({
  name: 'parking blocks and charged-rate changes reach the parking index',
  ignore: !enabled,
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    const [parking] = await selectAll('parkings', 'id,slug,settings');
    const parkingId = parking!.id as string;
    const [settingsRow] = (
      await selectAll('parking_settings', 'parking_id,weekday_nightly_rate', 'parking_id')
    ).filter((row) => row.parking_id === parkingId);
    const place = (await indexRow('parking', parkingId))?.place_slug as string;

    try {
      if (settingsRow) {
        await patch('parking_settings', `parking_id=eq.${parkingId}`, { weekday_nightly_rate: 777 });
        assertEquals(Number((await indexRow('parking', parkingId))?.price), 777);
      }

      const block = await insert('parking_blocked_dates', {
        parking_id: parkingId,
        start_date: '2031-02-01',
        end_date: '2031-02-03',
      });
      const blocked = await rpc<{ ids: string[] }>('search_public_parkings', {
        p: { placeSlug: place, checkIn: '2031-02-02', checkOut: '2031-02-04', limit: 500 },
      });
      assertEquals(blocked.ids.includes(parkingId), false);
      await remove('parking_blocked_dates', `id=eq.${block.id}`);
      const open = await rpc<{ ids: string[] }>('search_public_parkings', {
        p: { placeSlug: place, checkIn: '2031-02-02', checkOut: '2031-02-04', limit: 500 },
      });
      assertEquals(open.ids.includes(parkingId), true);
    } finally {
      if (settingsRow) {
        await patch('parking_settings', `parking_id=eq.${parkingId}`, {
          weekday_nightly_rate: settingsRow.weekday_nightly_rate,
        });
      }
    }
  },
});

type RpcResult = {
  total: number;
  ids: string[];
  facets: Record<string, Array<Record<string, unknown>>> | null;
};

Deno.test({
  name: 'RPC facets are disjunctive and totals match facet counts',
  ignore: !enabled,
  async fn() {
    const all = await rpc<RpcResult>('search_public_properties', { p: { facets: true, limit: 0 } });
    const types = (all.facets!.types as Array<{ value: string; count: number }>) ?? [];
    if (types.length < 2) return;
    const [first, second] = types;

    const one = await rpc<RpcResult>('search_public_properties', {
      p: { facets: true, limit: 0, types: [first!.value] },
    });
    assertEquals(one.total, first!.count, 'selected type total equals its facet count');
    const siblings = (one.facets!.types as Array<{ value: string; count: number }>).map((t) => t.value);
    assertEquals(siblings.includes(second!.value), true, 'sibling type stays selectable');

    const both = await rpc<RpcResult>('search_public_properties', {
      p: { facets: false, limit: 0, types: [first!.value, second!.value] },
    });
    assertEquals(both.total, first!.count + second!.count, 'multi-select is OR within a dimension');

    // Amenities are AND-ed: two amenities never return more than either alone.
    const amenities = (all.facets!.amenities as Array<{ id: string }>).slice(0, 2).map((a) => a.id);
    if (amenities.length === 2) {
      const [a, b] = await Promise.all(
        amenities.map((id) =>
          rpc<RpcResult>('search_public_properties', { p: { limit: 0, amenities: [id] } })
        )
      );
      const ab = await rpc<RpcResult>('search_public_properties', {
        p: { limit: 0, amenities },
      });
      assertEquals(ab.total <= Math.min(a!.total, b!.total), true);
    }

    const parkingAll = await rpc<RpcResult>('search_public_parkings', {
      p: { facets: true, limit: 0, locations: ['inside_tower'] },
    });
    const locationValues = (parkingAll.facets!.locations as Array<{ value: string }>).map(
      (l) => l.value
    );
    assertEquals(locationValues.length > 1, true, 'parking location facet keeps siblings');
  },
});

Deno.test({
  name: 'search modes: literal ranks exact/prefix first, concept and browse are bounded',
  ignore: !enabled,
  async fn() {
    const indexRows = await selectAll('public_listing_search', 'id,family,name');
    const properties = indexRows.filter((row) => row.family === 'property');
    const nameById = new Map(properties.map((row) => [row.id as string, String(row.name)]));
    const name = String(properties[0]!.name);
    const literal = await rpc<RpcResult>('search_public_properties', {
      p: { textMode: 'literal', q: name, order: 'rank', limit: 5 },
    });
    assertEquals(
      nameById.get(literal.ids[0]!)?.trim().toLowerCase(),
      name.trim().toLowerCase(),
      'exact name match ranks first'
    );

    const page = await rpc<RpcResult>('search_public_properties', {
      p: { order: 'name', limit: 10, offset: 0 },
    });
    const next = await rpc<RpcResult>('search_public_properties', {
      p: { order: 'name', limit: 10, offset: 10 },
    });
    assertEquals(
      page.ids.some((id) => next.ids.includes(id)),
      false,
      'pages never overlap (deterministic order)'
    );

    const concept = await rpc<RpcResult>('search_public_properties', {
      p: { textMode: 'concept', terms: ['zzzz-no-such-term'], order: 'rank', limit: 5 },
    });
    assertEquals(concept.total, 0);
  },
});

Deno.test({
  name: 'development filter and links resolve through the development name',
  ignore: !enabled,
  async fn() {
    const devs = await selectAll('developments', 'id,slug,name,status');
    for (const dev of devs.filter((d) => d.status === 'ACTIVE').slice(0, 5)) {
      const result = await rpc<RpcResult>('search_public_properties', {
        p: { developments: [dev.slug], facets: true, limit: 500 },
      });
      const props = await selectAll('properties', 'id,residence_name,status');
      const expected = props.filter(
        (p) =>
          p.status === 'ACTIVE' &&
          String(p.residence_name ?? '').trim().toLowerCase() ===
            String(dev.name).trim().toLowerCase()
      );
      assertEquals(result.total, expected.length, `properties in ${dev.slug}`);
    }
  },
});
