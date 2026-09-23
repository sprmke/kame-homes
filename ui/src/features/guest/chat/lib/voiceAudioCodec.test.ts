import { describe, expect, it } from 'vitest';

import { floatTo16BitPCM, int16ToBase64, base64ToInt16, computeRms } from '@/features/guest/chat/lib/voiceAudioCodec';

describe('floatTo16BitPCM', () => {

  it('floatTo16BitPCM is exported', () => {
    expect(typeof floatTo16BitPCM).toBe('function');
  });

});

describe('int16ToBase64', () => {

  it('int16ToBase64 is exported', () => {
    expect(typeof int16ToBase64).toBe('function');
  });

});

describe('base64ToInt16', () => {

  it('base64ToInt16 is exported', () => {
    expect(typeof base64ToInt16).toBe('function');
  });

});

describe('computeRms', () => {

  it('computeRms is exported', () => {
    expect(typeof computeRms).toBe('function');
  });

});
