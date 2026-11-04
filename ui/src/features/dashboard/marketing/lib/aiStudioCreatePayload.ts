/**
 * Turns the AI Studio create form into the request it sends. Pure, so the examples
 * (`aiStudioSamples.ts`) can be checked against the exact mapping Generate uses.
 */
import type { GenerateMarketingMediaPayload } from '@/features/dashboard/marketing/hooks/useGenerateMarketingMedia';
import {
  composeGenerationPrompt,
  type VideoCameraMoveId,
  type VideoSoundMode,
} from '@/features/dashboard/marketing/lib/marketingGenerationOptions';
import {
  DEFAULT_VIDEO_DURATION,
  DRAFT_VIDEO_RESOLUTION,
  type ImageSize,
  type VideoResolution,
} from '@/features/dashboard/marketing/lib/marketingGenerationPricing';
import type { MarketingGenerationTier } from '@/features/dashboard/marketing/lib/marketingGenerationTypes';
import type {
  PosterArchetypeId,
  PosterGoal,
} from '@/features/dashboard/marketing/lib/poster/posterSpec';
import type { DesignTemplateFormat } from '@/features/dashboard/marketing/lib/templateRegistry';

export type AiCreateRequest =
  | {
      output: 'post';
      goal: PosterGoal;
      format: DesignTemplateFormat;
      prompt: string;
      /** From an example: this layout leads the batch when it passes layout QA. */
      preferredArchetype: PosterArchetypeId | null;
      sampleId: string | null;
    }
  | {
      output: 'image' | 'video';
      prompt: string;
      aspect: string;
      payload: GenerateMarketingMediaPayload;
      sampleId: string | null;
    };

export type AiCreateFormState = {
  output: 'post' | 'image' | 'video';
  text: string;
  goal: PosterGoal;
  format: DesignTemplateFormat;
  aspect: string;
  lookId: string | null;
  tier: MarketingGenerationTier;
  imageSize: ImageSize;
  resolution: VideoResolution;
  allowHighResolution: boolean;
  cameraMove: VideoCameraMoveId;
  sound: VideoSoundMode;
  enhance: boolean;
  referenceIds: string[];
  /** Example applied to the form, if any. */
  sampleId: string | null;
  preferredArchetype: PosterArchetypeId | null;
};

/** 720p unless 1080p is allowed and quality is above Draft. */
export function effectiveVideoResolution(
  state: Pick<AiCreateFormState, 'tier' | 'resolution' | 'allowHighResolution'>
): VideoResolution {
  return state.tier === 'draft' || !state.allowHighResolution
    ? DRAFT_VIDEO_RESOLUTION
    : state.resolution;
}

export function buildAiCreateRequest(state: AiCreateFormState): AiCreateRequest {
  const description = state.text.trim();
  if (state.output === 'post') {
    return {
      output: 'post',
      goal: state.goal,
      format: state.format,
      prompt: description,
      preferredArchetype: state.preferredArchetype,
      sampleId: state.sampleId,
    };
  }
  const hasStartFrame = state.output === 'video' && state.referenceIds.length > 0;
  // A clip's start photo sets the light, so the look is not sent with one.
  const prompt = composeGenerationPrompt(description, hasStartFrame ? null : state.lookId);
  const attribution = state.sampleId ? { sampleId: state.sampleId } : {};
  if (state.output === 'video') {
    return {
      output: 'video',
      prompt: description,
      aspect: state.aspect,
      sampleId: state.sampleId,
      payload: {
        mediaType: 'video',
        prompt,
        qualityTier: state.tier,
        aspectRatio: state.aspect,
        resolution: effectiveVideoResolution(state),
        durationSeconds: DEFAULT_VIDEO_DURATION,
        referenceIds: state.referenceIds,
        cameraMove: state.cameraMove,
        sound: state.sound,
        enhancePrompt: state.enhance,
        ...attribution,
      },
    };
  }
  return {
    output: 'image',
    prompt: description,
    aspect: state.aspect,
    sampleId: state.sampleId,
    payload: {
      mediaType: 'image',
      prompt,
      qualityTier: state.tier,
      aspectRatio: state.aspect,
      imageSize: state.tier === 'draft' ? '1K' : state.imageSize,
      referenceIds: state.referenceIds,
      enhancePrompt: state.enhance,
      ...attribution,
    },
  };
}
