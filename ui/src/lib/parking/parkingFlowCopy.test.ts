import { describe, expect, it } from 'vitest';

import { parkingStatusBadge, parkingStatusGuest, parkingStatusProperty } from '@/lib/parking/parkingFlowCopy';

describe('parkingStatusBadge', () => {

  it('parkingStatusBadge is exported', () => {
    expect(typeof parkingStatusBadge).toBe('function');
  });

});

describe('parkingStatusGuest', () => {

  it('parkingStatusGuest is exported', () => {
    expect(typeof parkingStatusGuest).toBe('function');
  });

});

describe('parkingStatusProperty', () => {

  it('parkingStatusProperty is exported', () => {
    expect(typeof parkingStatusProperty).toBe('function');
  });

});
