import type { DesignBinding } from '@/features/dashboard/marketing/lib/designCanvasTypes';
import {
  firstReviewImageUrl,
  formatReviewAttributionFromReview,
  truncateReviewQuote,
  type MarketingGuestReview,
} from '@/features/dashboard/marketing/lib/marketingGuestReview';
import { resolveReviewDesignFields } from '@/features/dashboard/marketing/lib/marketingReviewDesignSeed';
import {
  pickBindingMediaAt,
  resolveDesignBindingMedia,
} from '@/features/dashboard/marketing/lib/propertyBindingMedia';
import type { VideoProject } from '@/features/dashboard/marketing/lib/video/videoProjectTypes';
import {
  defaultLayersForKind,
  persistSceneLayers,
} from '@/features/dashboard/marketing/lib/video/videoSceneLayers';
import { textsForStoryboardBeats } from '@/features/dashboard/marketing/lib/video/videoSceneTexts';
import { resolveVideoStoryboardRecipe } from '@/features/dashboard/marketing/lib/video/videoStoryboardRecipes';
import { defaultVideoFields } from '@/features/dashboard/marketing/lib/videoCampaignTemplates';

const REVIEW_VIDEO_TEMPLATES = new Set(['guest-love', 'stay-again']);

export function isReviewVideoTemplate(templateId: string): boolean {
  const base = templateId.replace(/-(instagram-story|instagram-post|landscape)$/, '');
  return REVIEW_VIDEO_TEMPLATES.has(base) || REVIEW_VIDEO_TEMPLATES.has(templateId);
}

/**
 * Apply a guest review onto an existing video project (Guest love / Stay again).
 * Updates scene texts + prefers review photos on early scenes.
 */
export function applyGuestReviewToVideoProject(
  project: VideoProject,
  review: MarketingGuestReview,
  binding: DesignBinding
): VideoProject {
  if (!review.socialSeedAllowed) return project;

  const fields = resolveReviewDesignFields(review, binding);
  const attribution = formatReviewAttributionFromReview(review);
  const defaults = defaultVideoFields(project.templateId, binding);
  const baseId = project.templateId.replace(/-(instagram-story|instagram-post|landscape)$/, '');
  const hookQuoteMax = baseId === 'stay-again' ? 90 : 140;
  const reviewSourceTexts = {
    ...defaults,
    subheadline: truncateReviewQuote(review.comment, hookQuoteMax) || fields.quote,
    promoLine: attribution,
  };
  const reviewImage = firstReviewImageUrl(review);

  const media = resolveDesignBindingMedia({
    propertyMedia: binding.propertyMedia,
    propertyPhoto: reviewImage || binding.propertyPhoto,
  });

  const recipe = resolveVideoStoryboardRecipe(project.templateId);

  const scenes = project.scenes.map((scene, index) => {
    const background = pickBindingMediaAt(media, index);
    const imageUrl = index === 0 && reviewImage ? reviewImage : background.url || scene.imageUrl;
    const mediaType =
      index === 0 && reviewImage
        ? ('image' as const)
        : background.mediaType || scene.backgroundMediaType;

    const clip = recipe.clips[index];
    const beats = clip?.textBeats ?? [];
    const texts = textsForStoryboardBeats(beats, reviewSourceTexts);

    const next = {
      ...scene,
      imageUrl,
      backgroundMediaType: mediaType,
      texts,
    };

    return persistSceneLayers(
      next,
      defaultLayersForKind(next.kind, next.imageUrl, next.texts, project.templateId)
    );
  });

  return {
    ...project,
    scenes,
    sourceReviewId: review.id,
  };
}
