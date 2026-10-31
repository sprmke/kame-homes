import type { DesignTemplateFormat } from '@/features/dashboard/marketing/lib/templateRegistry';

export type CampaignCategory =
  'promo' | 'slots' | 'giveaway' | 'fully-booked' | 'reviews' | 'custom';

export const CAMPAIGN_CATEGORY_LABELS: Record<CampaignCategory, string> = {
  promo: 'Promos',
  slots: 'Last slots',
  giveaway: 'Giveaway',
  'fully-booked': 'Fully booked',
  reviews: 'Reviews',
  custom: 'Custom',
};

export type DesignBindingMedia = {
  url: string;
  type: 'image' | 'video';
};

export type DesignBinding = {
  propertyName: string;
  propertyPhoto: string | null;
  /** Ordered gallery from property settings (primary first). */
  propertyMedia?: DesignBindingMedia[];
  nightlyRate: string;
  availabilityText: string;
  monthLabel: string;
  monthShort: string;
  openSlots: Array<{ dateNum: string; dayName: string }>;
  /** Guest-review seed fields (Marketing Reviews presets). */
  reviewQuote?: string;
  reviewAuthor?: string;
  reviewRating?: number;
  reviewAttribution?: string;
  reviewStars?: string;
  reviewPhoto?: string | null;
  sourceReviewId?: string | null;
};

export type CampaignTemplateDef = {
  id: string;
  name: string;
  category: CampaignCategory;
  format: DesignTemplateFormat;
  preview: { primary: string; secondary?: string };
  preservePresetPalette?: boolean;
  /** Fixed accent hex when `preservePresetPalette` is true. */
  presetAccent?: string;
};

/** @deprecated Use `VideoCategory` from `video/videoCategories.ts` — Video has its own axis. */
export type VideoCampaignCategory = string;

export type VideoTemplateFields = {
  headline: string;
  subheadline: string;
  promoLine: string;
  ctaLine: string;
  slotLabels: string[];
  rulesLine: string;
};
