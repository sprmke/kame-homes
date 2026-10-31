import type { DesignBinding } from '@/features/dashboard/marketing/lib/designCanvasTypes';

/** Stock interiors used when property media is unavailable (thumbnails + default video scenes). */
export const MARKETING_THUMB_STOCK_PHOTOS = [
  'https://images.unsplash.com/photo-1602002418082-a4443e081dd1?w=800&q=80',
  'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800&q=80',
  'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800&q=80',
] as const;

const STOCK_BINDING_MEDIA = MARKETING_THUMB_STOCK_PHOTOS.map((url) => ({
  url,
  type: 'image' as const,
}));

/** Generic binding for preset thumbnail generation — avoids waiting on property API data. */
export const DEFAULT_MARKETING_THUMB_BINDING: DesignBinding = {
  propertyName: 'Sample Property',
  propertyPhoto: MARKETING_THUMB_STOCK_PHOTOS[0],
  propertyMedia: [...STOCK_BINDING_MEDIA],
  nightlyRate: '₱2,799 / night',
  availabilityText: '3 open nights this month',
  monthLabel: 'July 2026',
  monthShort: 'July',
  openSlots: [
    { dateNum: '12', dayName: 'Sun' },
    { dateNum: '18', dayName: 'Sat' },
    { dateNum: '25', dayName: 'Sat' },
  ],
};

export const DEFAULT_MARKETING_THUMB_PROPERTY_NAME = DEFAULT_MARKETING_THUMB_BINDING.propertyName;

export function resolveMarketingThumbBinding(binding?: DesignBinding): DesignBinding {
  if (binding?.propertyMedia?.length || binding?.propertyPhoto) return binding;
  return DEFAULT_MARKETING_THUMB_BINDING;
}
