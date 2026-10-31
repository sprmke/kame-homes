/**
 * Deno tests for propertySettingsClone Phase 0 helpers.
 * Run: bun run test:edge (or deno test on this file).
 */

import { assertEquals, assertThrows } from 'https://deno.land/std@0.208.0/assert/mod.ts';

import {
  assertRegistryIdsValid,
  IDENTITY_STRIP_KEYS,
  listRegisteredCloneGroupIds,
  PROPERTY_SETTINGS_CLONE_GROUPS,
  runCloneGroup,
  sanitizeIdentity,
  sanitizeSettingsIdentity,
} from './propertySettingsClone.ts';
import {
  CLONE_GROUP_IDS,
  type CloneGroup,
  type GroupPayload,
} from './propertySettingsCloneTypes.ts';

const UI_CATALOG_PATH = new URL(
  '../../../ui/src/features/dashboard/org/lib/copyPropertySettingsGroups.ts',
  import.meta.url
);

Deno.test('CLONE_GROUP_IDS has unique stable keys', () => {
  assertEquals(new Set(CLONE_GROUP_IDS).size, CLONE_GROUP_IDS.length);
});

Deno.test('sanitizeIdentity strips identity and scoping keys', () => {
  const payload: GroupPayload = {
    id: 1,
    property_id: 'src',
    organization_id: 'org',
    name: 'Source',
    slug: 'source',
    brand_color: '#123456',
    weekday_rate: 2500,
  };
  const cleaned = sanitizeIdentity(payload);
  for (const key of IDENTITY_STRIP_KEYS) {
    assertEquals(cleaned[key], undefined);
  }
  assertEquals(cleaned.brand_color, '#123456');
  assertEquals(cleaned.weekday_rate, 2500);
});

Deno.test('sanitizeSettingsIdentity strips geo / place fields only', () => {
  const cleaned = sanitizeSettingsIdentity({
    city: 'Cebu',
    description: 'Nice stay',
    latitude: 10.3,
    enabledAmenities: ['wifi'],
  });
  assertEquals(cleaned.city, undefined);
  assertEquals(cleaned.latitude, undefined);
  assertEquals(cleaned.description, 'Nice stay');
  assertEquals(cleaned.enabledAmenities, ['wifi']);
});

Deno.test('Phase 1 registry registers known ids and assertRegistryIdsValid passes', () => {
  assertEquals(PROPERTY_SETTINGS_CLONE_GROUPS.length > 0, true);
  assertEquals(listRegisteredCloneGroupIds().includes('branding'), true);
  assertRegistryIdsValid();
});

Deno.test('runCloneGroup dryRun returns applied without calling write', async () => {
  let writeCalled = false;
  const group: CloneGroup = {
    id: 'branding',
    label: 'Brand',
    editLeaves: ['settings.socials:edit'],
    defaultOn: true,
    read: async () => ({ brand_color: '#000' }),
    sanitize: (p) => sanitizeIdentity(p),
    hasNonDefault: async () => true,
    write: async () => {
      writeCalled = true;
    },
  };

  const outcome = await runCloneGroup({
    group,
    payload: { brand_color: '#abc', property_id: 'x' },
    targetCtx: { propertyId: 't1', organizationId: 'o1' },
    options: {},
    dryRun: true,
  });

  assertEquals(outcome.status, 'applied');
  if (outcome.status === 'applied') {
    assertEquals(outcome.alreadyCustomized, true);
  }
  assertEquals(writeCalled, false);
});

Deno.test('runCloneGroup records failure without throwing', async () => {
  const group: CloneGroup = {
    id: 'amenities',
    label: 'Amenities',
    editLeaves: ['settings.amenities:edit'],
    defaultOn: true,
    read: async () => ({}),
    sanitize: (p) => p,
    hasNonDefault: async () => false,
    write: async () => {
      throw new Error('boom');
    },
  };

  const outcome = await runCloneGroup({
    group,
    payload: {},
    targetCtx: { propertyId: 't1', organizationId: 'o1' },
    options: {},
    dryRun: false,
  });

  assertEquals(outcome.status, 'failed');
  if (outcome.status === 'failed') {
    assertEquals(outcome.failure.group, 'amenities');
    assertEquals(outcome.failure.error, 'boom');
  }
});

Deno.test('UI catalog COPY_PROPERTY_SETTINGS_GROUP_IDS matches edge CLONE_GROUP_IDS', async () => {
  const source = await Deno.readTextFile(UI_CATALOG_PATH);
  const match = source.match(
    /export const COPY_PROPERTY_SETTINGS_GROUP_IDS = \[([\s\S]*?)\] as const;/
  );
  if (!match) {
    throw new Error('Could not find COPY_PROPERTY_SETTINGS_GROUP_IDS in UI catalog');
  }
  const uiIds = [...match[1].matchAll(/'([a-zA-Z]+)'/g)].map((m) => m[1]);
  assertEquals(uiIds, [...CLONE_GROUP_IDS]);
});

Deno.test('assertRegistryIdsValid throws on unknown id', () => {
  const fake: CloneGroup = {
    id: 'branding',
    label: 'x',
    editLeaves: ['settings.socials:edit'],
    defaultOn: true,
    read: async () => ({}),
    sanitize: (p) => p,
    hasNonDefault: async () => false,
    write: async () => {},
  };
  // Temporarily push an invalid id via mutation of a copy — use Object.assign trick
  const bad = { ...fake, id: 'notARealGroup' as CloneGroup['id'] };
  PROPERTY_SETTINGS_CLONE_GROUPS.push(bad);
  try {
    assertThrows(() => assertRegistryIdsValid(), Error, 'Unknown clone group id');
  } finally {
    PROPERTY_SETTINGS_CLONE_GROUPS.pop();
  }
});
