import { describe, expect, it } from 'vitest';

import type { MarketingGenerationReference } from '@/features/dashboard/marketing/lib/marketingGenerationTypes';
import {
  findListingPhotoReference,
  isListingPhotoReference,
  listingPhotoFileName,
  listingPhotoFileStem,
} from '@/features/dashboard/marketing/lib/marketingListingPhotoReference';

const URL_A = 'https://example.supabase.co/storage/v1/object/public/property-media/a.jpg';
const URL_B = 'https://example.supabase.co/storage/v1/object/public/property-media/b.jpg';

function reference(fileName: string | null): MarketingGenerationReference {
  return {
    id: fileName ?? 'none',
    organization_id: 'org',
    property_id: 'property',
    media_type: 'image',
    storage_path: `marketing-ai-refs/property/${fileName}`,
    public_url: `https://cdn.test/${fileName}`,
    mime_type: 'image/webp',
    file_name: fileName,
    byte_size: 1,
    width: null,
    height: null,
    duration_seconds: null,
    last_used_at: null,
  } as MarketingGenerationReference;
}

describe('listing photo references', () => {
  it('derives a stable, URL-specific stem', () => {
    expect(listingPhotoFileStem(URL_A)).toBe(listingPhotoFileStem(URL_A));
    expect(listingPhotoFileStem(URL_A)).not.toBe(listingPhotoFileStem(URL_B));
    expect(listingPhotoFileStem(URL_A)).toMatch(/^listing-[0-9a-f]{8}$/);
  });

  it('picks the extension from the mime type', () => {
    expect(listingPhotoFileName(URL_A, 'image/png')).toMatch(/\.png$/);
    expect(listingPhotoFileName(URL_A, 'image/webp')).toMatch(/\.webp$/);
    expect(listingPhotoFileName(URL_A, 'image/jpeg')).toMatch(/\.jpg$/);
  });

  it('finds an earlier copy even when the optimizer changed the extension', () => {
    const copy = reference(`${listingPhotoFileStem(URL_A)}.webp`);
    const library = [reference('balcony.jpg'), copy];
    expect(findListingPhotoReference(library, URL_A)).toBe(copy);
    expect(findListingPhotoReference(library, URL_B)).toBeNull();
  });

  it('tells listing copies apart from host uploads', () => {
    expect(isListingPhotoReference(reference(listingPhotoFileName(URL_A, 'image/jpeg')))).toBe(
      true
    );
    expect(isListingPhotoReference(reference('listing-photo.jpg'))).toBe(false);
    expect(isListingPhotoReference(reference(null))).toBe(false);
  });
});
