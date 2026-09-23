import { describe, expect, it } from 'vitest';

import { dedupeLocationParts, parseShowcaseAddressParts, resolveShowcaseLocationFields, formatShowcaseAreaLabel, formatShowcaseStreetLine, formatShowcaseAddress, buildShowcaseLocationLabel, formatShowcaseMapsLink, shouldShowShowcaseStreetLine, hasShowcaseLocationContent } from '@/features/guest/marketing/showcase/lib/showcaseLocation';

describe('dedupeLocationParts', () => {

  it('dedupeLocationParts is exported', () => {
    expect(typeof dedupeLocationParts).toBe('function');
  });

});

describe('parseShowcaseAddressParts', () => {

  it('parseShowcaseAddressParts is exported', () => {
    expect(typeof parseShowcaseAddressParts).toBe('function');
  });

});

describe('resolveShowcaseLocationFields', () => {

  it('resolveShowcaseLocationFields is exported', () => {
    expect(typeof resolveShowcaseLocationFields).toBe('function');
  });

});

describe('formatShowcaseAreaLabel', () => {

  it('formatShowcaseAreaLabel is exported', () => {
    expect(typeof formatShowcaseAreaLabel).toBe('function');
  });

});

describe('formatShowcaseStreetLine', () => {

  it('formatShowcaseStreetLine is exported', () => {
    expect(typeof formatShowcaseStreetLine).toBe('function');
  });

});

describe('formatShowcaseAddress', () => {

  it('formatShowcaseAddress is exported', () => {
    expect(typeof formatShowcaseAddress).toBe('function');
  });

});

describe('buildShowcaseLocationLabel', () => {

  it('buildShowcaseLocationLabel is exported', () => {
    expect(typeof buildShowcaseLocationLabel).toBe('function');
  });

});

describe('formatShowcaseMapsLink', () => {

  it('formatShowcaseMapsLink is exported', () => {
    expect(typeof formatShowcaseMapsLink).toBe('function');
  });

});

describe('shouldShowShowcaseStreetLine', () => {

  it('shouldShowShowcaseStreetLine is exported', () => {
    expect(typeof shouldShowShowcaseStreetLine).toBe('function');
  });

});

describe('hasShowcaseLocationContent', () => {

  it('hasShowcaseLocationContent is exported', () => {
    expect(typeof hasShowcaseLocationContent).toBe('function');
  });

});

