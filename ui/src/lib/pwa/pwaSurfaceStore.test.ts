import { describe, expect, it } from 'vitest';

import {
  activePwaSurface,
  PWA_SURFACE_PRIORITY,
  type PwaSurface,
} from '@/lib/pwa/pwaSurfaceStore';

function claimed(surfaces: PwaSurface[]) {
  const base: Record<PwaSurface, boolean> = {
    kill: false,
    'force-update': false,
    offline: false,
    update: false,
    push: false,
    install: false,
  };
  for (const surface of surfaces) base[surface] = true;
  return base;
}

describe('activePwaSurface', () => {
  it('returns null when nothing claims a slot', () => {
    expect(activePwaSurface(claimed([]))).toBeNull();
  });

  it('picks the highest priority claimant', () => {
    expect(activePwaSurface(claimed(['install', 'update']))).toBe('update');
    expect(activePwaSurface(claimed(['install', 'offline']))).toBe('offline');
    expect(activePwaSurface(claimed(['force-update', 'kill']))).toBe('kill');
  });

  it('keeps the documented order', () => {
    const order: PwaSurface[] = ['kill', 'force-update', 'offline', 'update', 'push', 'install'];
    for (let i = 1; i < order.length; i += 1) {
      expect(PWA_SURFACE_PRIORITY[order[i - 1]!]).toBeGreaterThan(PWA_SURFACE_PRIORITY[order[i]!]);
    }
  });

  it('is stable for a single claimant', () => {
    expect(activePwaSurface(claimed(['push']))).toBe('push');
  });
});
