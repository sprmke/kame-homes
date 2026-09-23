import { describe, expect, it } from 'vitest';

import { isGuestEmbedPreview, withGuestEmbedPreviewUrl, GUEST_EMBED_PREVIEW_QUERY } from '@/features/guest/lib/guestEmbedPreview';

describe('isGuestEmbedPreview', () => {

  it('isGuestEmbedPreview is exported', () => {
    expect(typeof isGuestEmbedPreview).toBe('function');
  });

});

describe('withGuestEmbedPreviewUrl', () => {

  it('withGuestEmbedPreviewUrl is exported', () => {
    expect(typeof withGuestEmbedPreviewUrl).toBe('function');
  });

});

describe('GUEST_EMBED_PREVIEW_QUERY', () => {
  it('is defined', () => {
    expect(GUEST_EMBED_PREVIEW_QUERY).toBeDefined();
  });
});
