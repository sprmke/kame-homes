/** AI Studio output options shared by the create form and the example gallery. */
import type { AiStudioOutput } from '@/features/dashboard/marketing/lib/marketingStudioRoute';
import type { PosterGoal } from '@/features/dashboard/marketing/lib/poster/posterSpec';
import type { DesignTemplateFormat } from '@/features/dashboard/marketing/lib/templateRegistry';
import type { PlanFeatureKey } from '@/features/dashboard/plans/lib/planFeatures';

export const POST_GOALS: Array<{ value: PosterGoal; label: string; hint: string }> = [
  { value: 'vibe', label: 'Vibe', hint: 'A feel-good moment' },
  { value: 'promo', label: 'Promo', hint: 'A deal or discount' },
  { value: 'amenity-spotlight', label: 'Amenities', hint: 'One amenity, up close' },
  { value: 'feature-spotlight', label: 'Feature', hint: 'One standout feature' },
  { value: 'stay-info', label: 'Stay info', hint: 'Check-in, house rules' },
];

export const POST_FORMATS: Array<{
  value: DesignTemplateFormat;
  label: string;
  width: number;
  height: number;
}> = [
  { value: 'instagram-portrait', label: 'Portrait', width: 4, height: 5 },
  { value: 'instagram-post', label: 'Square', width: 1, height: 1 },
  { value: 'instagram-story', label: 'Story', width: 9, height: 16 },
  { value: 'facebook-post', label: 'Facebook', width: 40, height: 21 },
];

export const OUTPUT_FEATURE: Record<AiStudioOutput, PlanFeatureKey> = {
  post: 'aiMarketingGeneration',
  image: 'aiMarketingImageGeneration',
  video: 'aiMarketingVideoGeneration',
};
