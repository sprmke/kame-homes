import { describe, expect, it } from 'vitest';

import {
  canBridgeConceptToListPublic,
  isNearbyQuery,
  nearbyCategoryFromQuery,
  nearbyDisplayLabel,
  resolveClientSearchIntent,
} from '@/features/guest/search/lib/searchIntents';

describe('searchIntents', () => {
  it('detects nearby queries', () => {
    expect(isNearbyQuery('near me')).toBe(true);
    expect(isNearbyQuery('Cebu City')).toBe(false);
  });

  it('parses nearby category tokens', () => {
    expect(nearbyCategoryFromQuery('nearby parkings')).toBe('parkings');
    expect(nearbyCategoryFromQuery('near me')).toBe(null);
    expect(nearbyDisplayLabel('parkings')).toBe('Nearby parkings');
  });

  it('resolves concept intents', () => {
    const condo = resolveClientSearchIntent('condo');
    expect(condo.kind).toBe('concept');
    if (condo.kind === 'concept') {
      expect(condo.conceptId).toBe('condo');
      expect(condo.propertyTypes).toContain('CONDO');
    }
  });

  it('bridges hard-type concepts to list-public', () => {
    const condo = resolveClientSearchIntent('condo');
    expect(condo.kind).toBe('concept');
    if (condo.kind === 'concept') {
      expect(canBridgeConceptToListPublic(condo)).toBe(true);
    }

    const beach = resolveClientSearchIntent('beach');
    expect(beach.kind).toBe('concept');
    if (beach.kind === 'concept') {
      expect(canBridgeConceptToListPublic(beach)).toBe(false);
    }
  });

  it('falls back to literal for unknown text', () => {
    expect(resolveClientSearchIntent('Azure North Residences')).toEqual({
      kind: 'literal',
      query: 'Azure North Residences',
    });
  });
});
