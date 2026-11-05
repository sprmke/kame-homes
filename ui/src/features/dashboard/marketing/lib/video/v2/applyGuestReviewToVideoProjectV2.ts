import type { DesignBinding } from '@/features/dashboard/marketing/lib/designCanvasTypes';
import type { MarketingGuestReview } from '@/features/dashboard/marketing/lib/marketingGuestReview';
import {
  applyGuestReviewToVideoProject,
  isReviewVideoTemplate,
} from '@/features/dashboard/marketing/lib/video/applyGuestReviewToVideoProject';
import { migrateVideoProjectV1 } from '@/features/dashboard/marketing/lib/video/v2/migrateVideoProjectV1';
import type { VideoProjectV2 } from '@/features/dashboard/marketing/lib/video/v2/videoProjectV2Types';
import { buildDefaultVideoProject } from '@/features/dashboard/marketing/lib/video/videoProjectDefaults';

/**
 * Seed a guest review into a v2 project. The review layout comes from the Guest love / Stay
 * again recipes, so the template is rebuilt with the review's quote and photo (the same result
 * v1 gave), then the host's own music and audio tracks are carried over. A project that is not
 * a review template switches to Guest love.
 */
export function applyGuestReviewToVideoProjectV2(
  project: VideoProjectV2,
  review: MarketingGuestReview,
  binding: DesignBinding
): VideoProjectV2 {
  if (!review.socialSeedAllowed) return project;
  const templateId = isReviewVideoTemplate(project.templateId) ? project.templateId : 'guest-love';
  const category = templateId === project.templateId ? project.campaignCategory : 'reviews';
  const v1 = applyGuestReviewToVideoProject(
    buildDefaultVideoProject(templateId, category, binding, project.format),
    review,
    binding
  );
  const seeded = migrateVideoProjectV1(v1);
  const keptAudio = project.tracks.filter((track) => track.kind === 'audio' && track.items.length);
  return {
    ...seeded,
    format: project.format,
    background: project.background,
    tracks: [...seeded.tracks.filter((track) => track.kind !== 'audio'), ...keptAudio],
    sourceReviewId: review.id,
  };
}
