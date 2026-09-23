import { describe, expect, it } from 'vitest';

import { configurePolotnoOverlays, isPolotnoOverlayDebugEnabled } from '@/features/dashboard/marketing/lib/polotno/configurePolotnoOverlays';

describe('configurePolotnoOverlays', () => {

  it('configurePolotnoOverlays is exported', () => {
    expect(typeof configurePolotnoOverlays).toBe('function');
  });

});

describe('isPolotnoOverlayDebugEnabled', () => {

  it('isPolotnoOverlayDebugEnabled is exported', () => {
    expect(typeof isPolotnoOverlayDebugEnabled).toBe('function');
  });

});
