import { describe, expect, it } from 'vitest';

import {
  floatTo16BitPCM,
  int16ToBase64,
  base64ToInt16,
  computeRms,
} from '@/features/guest/chat/lib/voiceAudioCodec';

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

describe('PCM16 base64 round trip', () => {
  it('preserves samples across the base64 boundary', () => {
    const samples = new Int16Array(5000);
    for (let i = 0; i < samples.length; i++) samples[i] = ((i * 37) % 65536) - 32768;
    expect(Array.from(base64ToInt16(int16ToBase64(samples)))).toEqual(Array.from(samples));
  });

  it('encodes only the view of a larger buffer', () => {
    const backing = new Int16Array([1, 2, 3, 4]);
    expect(Array.from(base64ToInt16(int16ToBase64(backing.subarray(1, 3))))).toEqual([2, 3]);
  });
});
