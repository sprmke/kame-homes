import type {
  CampaignCategory,
  CampaignTemplateDef,
} from '@/features/dashboard/marketing/lib/designCanvasTypes';
import {
  DESIGN_FORMAT_DIMENSIONS,
  type DesignTemplateFormat,
} from '@/features/dashboard/marketing/lib/templateRegistry';

const ORANGE = '#e8752a';
const CREAM = '#fff8f0';
const RED = '#dc2626';
const ALL_FORMATS: DesignTemplateFormat[] = ['instagram-post', 'instagram-story', 'facebook-post'];

type BaseCampaignTemplate = {
  baseId: string;
  name: string;
  category: CampaignCategory;
  formats: DesignTemplateFormat[];
  preview: { primary: string; secondary?: string };
  preservePresetPalette?: boolean;
  presetAccent?: string;
};

const BASE_TEMPLATES: BaseCampaignTemplate[] = [
  {
    baseId: 'promo-500-off',
    name: '₱500 off',
    category: 'promo',
    formats: ALL_FORMATS,
    preview: { primary: ORANGE, secondary: CREAM },
  },
  {
    baseId: 'promo-300-off',
    name: '₱300 off',
    category: 'promo',
    formats: ALL_FORMATS,
    preview: { primary: '#24a88e', secondary: '#174c43' },
  },
  {
    baseId: 'promo-10-off',
    name: '10% off',
    category: 'promo',
    formats: ALL_FORMATS,
    preview: { primary: '#ea580c', secondary: CREAM },
  },
  {
    baseId: 'promo-free-breakfast',
    name: 'Free breakfast',
    category: 'promo',
    formats: ALL_FORMATS,
    preview: { primary: '#f59e0b', secondary: CREAM },
  },
  {
    baseId: 'promo-free-parking',
    name: 'Free parking',
    category: 'promo',
    formats: ALL_FORMATS,
    preview: { primary: '#2563eb', secondary: '#dbeafe' },
  },
  {
    baseId: 'slots-1',
    name: 'Last 1 slot',
    category: 'slots',
    formats: ALL_FORMATS,
    preview: { primary: '#2563eb', secondary: '#ffffff' },
  },
  {
    baseId: 'slots-3',
    name: 'Last 3 slots',
    category: 'slots',
    formats: ALL_FORMATS,
    preview: { primary: ORANGE, secondary: '#ffffff' },
  },
  {
    baseId: 'slots-5',
    name: 'Last 5 slots',
    category: 'slots',
    formats: ALL_FORMATS,
    preview: { primary: RED, secondary: '#ffffff' },
  },
  {
    baseId: 'giveaway',
    name: 'Giveaway',
    category: 'giveaway',
    formats: ALL_FORMATS,
    preview: { primary: RED, secondary: ORANGE },
  },
  {
    baseId: 'giveaway-raffle',
    name: 'Giveaway raffle',
    category: 'giveaway',
    formats: ALL_FORMATS,
    preview: { primary: '#b91c1c', secondary: '#fbbf24' },
    preservePresetPalette: true,
    presetAccent: '#fbbf24',
  },
  {
    baseId: 'fully-booked',
    name: 'Fully booked',
    category: 'fully-booked',
    formats: ALL_FORMATS,
    preview: { primary: '#292524', secondary: RED },
    preservePresetPalette: true,
    presetAccent: '#1c1917',
  },
  {
    baseId: 'fully-booked-waitlist',
    name: 'Join waitlist',
    category: 'fully-booked',
    formats: ALL_FORMATS,
    preview: { primary: '#24a88e', secondary: CREAM },
  },
  {
    baseId: 'review-quote',
    name: 'Quote card',
    category: 'reviews',
    formats: ALL_FORMATS,
    preview: { primary: '#24a88e', secondary: CREAM },
  },
  {
    baseId: 'review-photo-quote',
    name: 'Photo + quote',
    category: 'reviews',
    formats: ALL_FORMATS,
    preview: { primary: '#ea580c', secondary: CREAM },
  },
  {
    baseId: 'review-stars',
    name: 'Stars stack',
    category: 'reviews',
    formats: ALL_FORMATS,
    preview: { primary: '#b45309', secondary: CREAM },
  },
];

export const DESIGN_CAMPAIGN_TEMPLATES: CampaignTemplateDef[] = BASE_TEMPLATES.flatMap((base) =>
  base.formats.map((format) => ({
    id: `${base.baseId}-${format}`,
    name: base.name,
    category: base.category,
    format,
    preview: base.preview,
    preservePresetPalette: base.preservePresetPalette,
    presetAccent: base.presetAccent,
  }))
);

export function campaignTemplatesForFormat(
  format: DesignTemplateFormat,
  category?: CampaignCategory
) {
  return DESIGN_CAMPAIGN_TEMPLATES.filter(
    (t) => t.format === format && (!category || t.category === category)
  );
}

export function getCampaignTemplate(id: string) {
  return DESIGN_CAMPAIGN_TEMPLATES.find((t) => t.id === id);
}

export function campaignTemplateBaseId(id: string) {
  const template = getCampaignTemplate(id);
  if (!template) return id;
  return id.replace(`-${template.format}`, '');
}

export { DESIGN_FORMAT_DIMENSIONS };
