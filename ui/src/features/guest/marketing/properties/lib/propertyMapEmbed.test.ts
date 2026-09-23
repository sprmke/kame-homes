import { describe, expect, it } from 'vitest';

import { parseLatLngFromMapsUrl, buildOpenStreetMapEmbedSrc, buildLegacyGoogleMapEmbedSrc, buildGoogleMapsEmbedApiSrc, hasPropertyMapCoordinates, resolvePropertyMapEmbedSrc } from '@/features/guest/marketing/properties/lib/propertyMapEmbed';

describe('parseLatLngFromMapsUrl', () => {

  it('parseLatLngFromMapsUrl is exported', () => {
    expect(typeof parseLatLngFromMapsUrl).toBe('function');
  });

});

describe('buildOpenStreetMapEmbedSrc', () => {

  it('buildOpenStreetMapEmbedSrc is exported', () => {
    expect(typeof buildOpenStreetMapEmbedSrc).toBe('function');
  });

});

describe('buildLegacyGoogleMapEmbedSrc', () => {

  it('buildLegacyGoogleMapEmbedSrc is exported', () => {
    expect(typeof buildLegacyGoogleMapEmbedSrc).toBe('function');
  });

});

describe('buildGoogleMapsEmbedApiSrc', () => {

  it('buildGoogleMapsEmbedApiSrc is exported', () => {
    expect(typeof buildGoogleMapsEmbedApiSrc).toBe('function');
  });

});

describe('hasPropertyMapCoordinates', () => {

  it('hasPropertyMapCoordinates is exported', () => {
    expect(typeof hasPropertyMapCoordinates).toBe('function');
  });

});

describe('resolvePropertyMapEmbedSrc', () => {

  it('resolvePropertyMapEmbedSrc is exported', () => {
    expect(typeof resolvePropertyMapEmbedSrc).toBe('function');
  });

});
