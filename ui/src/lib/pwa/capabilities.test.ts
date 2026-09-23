import { describe, expect, it } from 'vitest';

import { isStandalone, isIos, isSafari, getPwaCapabilities } from '@/lib/pwa/capabilities';

describe('isStandalone', () => {

  it('isStandalone is exported', () => {
    expect(typeof isStandalone).toBe('function');
  });

});

describe('isIos', () => {

  it('isIos is exported', () => {
    expect(typeof isIos).toBe('function');
  });

});

describe('isSafari', () => {

  it('isSafari is exported', () => {
    expect(typeof isSafari).toBe('function');
  });

});

describe('getPwaCapabilities', () => {

  it('getPwaCapabilities is exported', () => {
    expect(typeof getPwaCapabilities).toBe('function');
  });

});
