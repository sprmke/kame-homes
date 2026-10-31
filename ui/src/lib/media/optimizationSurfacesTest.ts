import { describe, expect, it } from 'vitest';

import {
  isSurfaceOptimizationEnabled,
  rolloutGroupForSurface,
} from '@/lib/media/optimizationSurfaces';

describe('rolloutGroupForSurface', () => {
  it('maps known surface ids to their rollout group', () => {
    expect(rolloutGroupForSurface('org-settings-logo')).toBe('settings');
    expect(rolloutGroupForSurface('property-template-section_image')).toBe('settings');
    expect(rolloutGroupForSurface('property-media')).toBe('galleries');
    expect(rolloutGroupForSurface('parking-media')).toBe('galleries');
    expect(rolloutGroupForSurface('guest-profile-avatar')).toBe('guest-profile');
    expect(rolloutGroupForSurface('support-ticket-attachment')).toBe('guest-profile');
    expect(rolloutGroupForSurface('guest-form-validId')).toBe('guest-documents');
    expect(rolloutGroupForSurface('booking-asset-payment_receipt')).toBe('guest-documents');
    expect(rolloutGroupForSurface('guest-review-media')).toBe('guest-documents');
  });

  it('prefers the longest matching prefix', () => {
    // `parking-settings` must win over a hypothetical `parking` prefix.
    expect(rolloutGroupForSurface('parking-settings-gcash-qr')).toBe('settings');
    expect(rolloutGroupForSurface('parking-media')).toBe('galleries');
  });

  it('returns null for an unknown surface', () => {
    expect(rolloutGroupForSurface('totally-unknown-surface')).toBeNull();
  });
});

describe('isSurfaceOptimizationEnabled (env unset → "default")', () => {
  it('enables every non-document group', () => {
    expect(isSurfaceOptimizationEnabled('org-settings-logo')).toBe(true);
    expect(isSurfaceOptimizationEnabled('property-media')).toBe(true);
    expect(isSurfaceOptimizationEnabled('guest-profile-avatar')).toBe(true);
    expect(isSurfaceOptimizationEnabled('support-ticket-attachment')).toBe(true);
    expect(isSurfaceOptimizationEnabled('marketing-export')).toBe(true);
  });

  it('holds back guest-documents until the §9.7 OCR gate runs', () => {
    expect(isSurfaceOptimizationEnabled('guest-form-validId')).toBe(false);
    expect(isSurfaceOptimizationEnabled('booking-asset-payment_receipt')).toBe(false);
    expect(isSurfaceOptimizationEnabled('guest-review-media')).toBe(false);
  });

  it('fails open for an unknown surface (optimization only; the ceiling still applies)', () => {
    expect(isSurfaceOptimizationEnabled('brand-new-unmapped-surface')).toBe(true);
  });
});
