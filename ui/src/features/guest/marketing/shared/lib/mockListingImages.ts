export type ListingImageKind = 'property' | 'development' | 'parking';

const UNSPLASH_PROPERTY_IMAGES = [
  'https://images.unsplash.com/photo-1602002418082-a4443e081dd1?w=800&q=80',
  'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=800&q=80',
  'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800&q=80',
  'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800&q=80',
  'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800&q=80',
] as const;

const UNSPLASH_DEVELOPMENT_IMAGES = [
  'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=1200&q=85',
  'https://images.unsplash.com/photo-1599423300746-b62533397364?w=1200&q=85',
  'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1200&q=85',
  'https://images.unsplash.com/photo-1486325212027-8081e485255e?w=1200&q=85',
] as const;

const UNSPLASH_PARKING_IMAGES = [
  'https://images.unsplash.com/photo-1590674899484-f5649e4292cf?w=800&q=80',
  'https://images.unsplash.com/photo-1568605117037-7b3c22336e38?w=800&q=80',
  'https://images.unsplash.com/photo-1621939514649-280e2ee02510?w=800&q=80',
  'https://images.unsplash.com/photo-1558981403-c5f9899a28bc?w=800&q=80',
] as const;

/** Mock host avatar when org logo is unavailable locally. */
export const MOCK_HOST_AVATAR_URL =
  'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=200&q=80';

export const LISTING_PLACEHOLDER_PROPERTY = UNSPLASH_PROPERTY_IMAGES[0];

const IMAGE_POOLS: Record<ListingImageKind, readonly string[]> = {
  property: UNSPLASH_PROPERTY_IMAGES,
  development: UNSPLASH_DEVELOPMENT_IMAGES,
  parking: UNSPLASH_PARKING_IMAGES,
};

function hashSeed(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash + seed.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

export function listingPlaceholderImage(kind: ListingImageKind, seed = 'default'): string {
  const pool = IMAGE_POOLS[kind];
  return pool[hashSeed(seed) % pool.length] ?? pool[0] ?? LISTING_PLACEHOLDER_PROPERTY;
}

export function resolveListingImages(
  images: string[] | undefined | null,
  kind: ListingImageKind,
  seed = 'default'
): string[] {
  const filtered = (images ?? []).map((url) => url.trim()).filter(Boolean);
  if (filtered.length > 0) return filtered;
  return [listingPlaceholderImage(kind, seed)];
}

export function resolveListingCoverImage(
  images: string[] | undefined | null,
  coverImage: string | null | undefined,
  kind: ListingImageKind,
  seed = 'default'
): string {
  const cover = coverImage?.trim();
  if (cover) return cover;

  const firstImage = (images ?? []).map((url) => url.trim()).find(Boolean);
  if (firstImage) return firstImage;

  return listingPlaceholderImage(kind, seed);
}
