import { describe, expect, it } from 'vitest';

import { setMediaTelemetrySink, emitMediaOptimization } from '@/lib/media/mediaTelemetry';

describe('setMediaTelemetrySink', () => {

  it('setMediaTelemetrySink is exported', () => {
    expect(typeof setMediaTelemetrySink).toBe('function');
  });

});

describe('emitMediaOptimization', () => {

  it('emitMediaOptimization is exported', () => {
    expect(typeof emitMediaOptimization).toBe('function');
  });

});
