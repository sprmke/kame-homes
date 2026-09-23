import { describe, expect, it } from 'vitest';

import { setSwRegistration, getSwRegistration, whenSwReady, pingVersionCheck } from '@/lib/pwa/swRegistration';

describe('setSwRegistration', () => {

  it('setSwRegistration is exported', () => {
    expect(typeof setSwRegistration).toBe('function');
  });

});

describe('getSwRegistration', () => {

  it('getSwRegistration is exported', () => {
    expect(typeof getSwRegistration).toBe('function');
  });

});

describe('whenSwReady', () => {

  it('whenSwReady is exported', () => {
    expect(typeof whenSwReady).toBe('function');
  });

});

describe('pingVersionCheck', () => {

  it('pingVersionCheck is exported', () => {
    expect(typeof pingVersionCheck).toBe('function');
  });

});
