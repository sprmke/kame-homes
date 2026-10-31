import {
  resolveCampaignPalette,
  type CampaignPalette,
} from '@/features/dashboard/marketing/lib/designBrandColors';
import type {
  DesignBinding,
  VideoTemplateFields,
} from '@/features/dashboard/marketing/lib/designCanvasTypes';
import type { VideoCategory } from '@/features/dashboard/marketing/lib/video/videoCategories';
import {
  VIDEO_STORYBOARD_RECIPES,
  getVideoStoryboardRecipe,
} from '@/features/dashboard/marketing/lib/video/videoStoryboardRecipes';

export type VideoCampaignTemplateDef = {
  id: string;
  name: string;
  category: VideoCategory;
  preservePresetPalette?: boolean;
  presetAccent?: string;
};

/** Quiet Coast Motion library — ids match storyboard recipes. */
export const VIDEO_CAMPAIGN_TEMPLATES: VideoCampaignTemplateDef[] = VIDEO_STORYBOARD_RECIPES.map(
  (recipe) => ({
    id: recipe.id,
    name: recipe.name,
    category: recipe.category,
    preservePresetPalette: recipe.preservePresetPalette,
    presetAccent: recipe.presetAccent,
  })
);

export function videoTemplatesForCategory(category?: VideoCategory | string) {
  return VIDEO_CAMPAIGN_TEMPLATES.filter((t) => !category || t.category === category);
}

export function videoTemplatePalette(templateId: string, brandColor?: string): CampaignPalette {
  const template = getVideoCampaignTemplate(templateId) ?? getVideoStoryboardRecipe(templateId);
  return resolveCampaignPalette(brandColor, {
    preservePresetPalette: template?.preservePresetPalette,
    presetAccent: template?.presetAccent,
  });
}

export function defaultVideoFields(
  templateId: string,
  binding: DesignBinding
): VideoTemplateFields {
  const month = binding.monthShort.toUpperCase();
  const property = binding.propertyName;

  switch (templateId) {
    case 'quiet-morning':
      return {
        headline: 'SLOW MORNINGS',
        subheadline: 'Wake to quiet light',
        promoLine: 'Pool · Lounge · Soft beds',
        ctaLine: 'Book a stay',
        slotLabels: [],
        rulesLine: property,
      };
    case 'golden-hour':
      return {
        headline: 'GOLDEN HOUR',
        subheadline: 'Stay for the light',
        promoLine: 'Evenings worth keeping',
        ctaLine: 'See dates',
        slotLabels: [],
        rulesLine: property,
      };
    case 'poolside-calm':
      return {
        headline: 'POOLSIDE CALM',
        subheadline: '',
        promoLine: 'A still afternoon',
        ctaLine: 'Reserve',
        slotLabels: [],
        rulesLine: property,
      };
    case 'amenity-tour':
      return {
        headline: 'INSIDE THE STAY',
        subheadline: 'Open living',
        promoLine: 'Private pool',
        ctaLine: 'See available dates',
        slotLabels: [],
        rulesLine: property,
      };
    case 'weekday-cut':
      return {
        headline: 'WEEKDAY CUT',
        subheadline: 'UP TO',
        promoLine: '₱500 OFF',
        ctaLine: 'Mon–Thu stays',
        slotLabels: [],
        rulesLine: property,
      };
    case 'percent-off':
      return {
        headline: 'LIMITED OFFER',
        subheadline: 'UP TO',
        promoLine: '10% OFF',
        ctaLine: 'Book direct',
        slotLabels: [],
        rulesLine: property,
      };
    case 'rainy-day-rate':
      return {
        headline: 'RAINY DAY RATE',
        subheadline: 'UP TO',
        promoLine: '₱300 OFF',
        ctaLine: 'For weekday bookings',
        slotLabels: [],
        rulesLine: property,
      };
    case 'one-left':
      return {
        headline: 'ONE LEFT',
        subheadline: `FOR ${month}`,
        promoLine: '',
        ctaLine: 'Book now',
        slotLabels: binding.openSlots.slice(0, 1).map((s) => `${s.dateNum} · ${s.dayName}`),
        rulesLine: property,
      };
    case 'three-dates':
      return {
        headline: 'OPEN DATES',
        subheadline: `FOR ${month}`,
        promoLine: '',
        ctaLine: 'Book now',
        slotLabels: binding.openSlots.slice(0, 3).map((s) => `${s.dateNum} · ${s.dayName}`),
        rulesLine: property,
      };
    case 'this-weekend':
      return {
        headline: 'THIS WEEKEND',
        subheadline: '',
        promoLine: 'Last openings',
        ctaLine: 'Hold your spot',
        slotLabels: binding.openSlots.slice(0, 2).map((s) => `${s.dateNum} · ${s.dayName}`),
        rulesLine: property,
      };
    case 'guest-love':
      return {
        headline: 'GUESTS KEEP COMING BACK',
        subheadline: '“Felt like home the moment we arrived.”',
        promoLine: '- recent stay',
        ctaLine: 'Plan yours',
        slotLabels: [],
        rulesLine: property,
      };
    case 'stay-again':
      return {
        headline: 'MISS THIS PLACE?',
        subheadline: 'Your next quiet escape',
        promoLine: '',
        ctaLine: 'Book again',
        slotLabels: [],
        rulesLine: property,
      };
    case 'sold-out-stamp':
      return {
        headline: 'FULLY BOOKED',
        subheadline: `FOR ${month}`,
        promoLine: 'Watch for next openings',
        ctaLine: 'Follow for dates',
        slotLabels: [],
        rulesLine: property,
      };
    case 'join-waitlist':
      return {
        headline: 'JOIN THE WAITLIST',
        subheadline: `${month} is full`,
        promoLine: 'First in line for cancellations',
        ctaLine: 'Send a message',
        slotLabels: [],
        rulesLine: property,
      };
    case 'ber-months':
      return {
        headline: 'BER MONTHS',
        subheadline: 'Cooler nights',
        promoLine: 'Seasonal stay rates',
        ctaLine: 'Check availability',
        slotLabels: [],
        rulesLine: property,
      };
    case 'holiday-glow':
      return {
        headline: 'HOLIDAY GLOW',
        subheadline: 'Gather somewhere soft',
        promoLine: 'Festive weekend stays',
        ctaLine: 'Reserve early',
        slotLabels: [],
        rulesLine: property,
      };
    default:
      return {
        headline: property,
        subheadline: binding.nightlyRate,
        promoLine: binding.availabilityText,
        ctaLine: 'Book direct',
        slotLabels: [],
        rulesLine: property,
      };
  }
}

export function getVideoCampaignTemplate(id: string) {
  return VIDEO_CAMPAIGN_TEMPLATES.find((t) => t.id === id);
}
