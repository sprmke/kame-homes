import { useMutation } from '@tanstack/react-query';

import { buildRuleBasedPosterSpecs } from '@/features/dashboard/marketing/lib/poster/posterDefaults';
import {
  normalizePosterSpec,
  type PosterFacts,
  type PosterGoal,
  type PosterSpec,
} from '@/features/dashboard/marketing/lib/poster/posterSpec';
import { usePropertyIdParam, scopedFunctionsUrl } from '@/features/dashboard/org/lib/adminApiScope';
import {
  handleAiMutationError,
  isAiQuotaError,
  parseEdgeJsonOrQuota,
} from '@/features/dashboard/org/lib/aiQuotaToast';
import { getSessionJwt } from '@/features/dashboard/org/lib/edgeClient';

export type GeneratePostersInput = {
  goal: PosterGoal;
  prompt: string;
  facts: PosterFacts;
  brandColor: string | null;
  count?: number;
};

export type GeneratePostersResult = {
  specs: PosterSpec[];
  /** Facts whose `photos` line up with each spec's photoIndexes. */
  facts: PosterFacts;
  /** False when the AI director was unavailable and rule-based layouts were used. */
  aiDirected: boolean;
};

type DirectorResponse = {
  contentType: 'poster';
  variants: unknown[];
  photoUrls: string[];
};

export async function requestPosterSpecs(
  propertyId: string | null,
  input: GeneratePostersInput
): Promise<DirectorResponse> {
  const jwt = await getSessionJwt();
  const res = await fetch(scopedFunctionsUrl('generate-marketing-template', propertyId), {
    method: 'POST',
    headers: { Authorization: `Bearer ${jwt}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contentType: 'poster',
      goal: input.goal,
      prompt: input.prompt,
      count: input.count ?? 4,
      brandColor: input.brandColor,
      photoUrls: input.facts.photos.slice(0, 6),
      facts: {
        propertyName: input.facts.propertyName,
        brandName: input.facts.brandName,
        location: input.facts.location,
        checkIn: input.facts.checkIn,
        checkOut: input.facts.checkOut,
        securityDeposit: input.facts.securityDeposit,
        nightlyRate: input.facts.nightlyRate,
        amenities: input.facts.amenities,
      },
    }),
  });
  return parseEdgeJsonOrQuota<DirectorResponse>(res);
}

/**
 * AI art direction with a deterministic safety net: if the director call fails for
 * a reason other than quota (timeout, invalid output), the host still gets finished
 * rule-based posters from the same design system instead of an error.
 */
export async function generatePosters(
  propertyId: string | null,
  input: GeneratePostersInput
): Promise<GeneratePostersResult> {
  try {
    const response = await requestPosterSpecs(propertyId, input);
    const variants = Array.isArray(response?.variants) ? response.variants : [];
    const photoUrls = Array.isArray(response?.photoUrls)
      ? response.photoUrls.filter((url): url is string => typeof url === 'string' && url !== '')
      : [];
    const facts = photoUrls.length > 0 ? { ...input.facts, photos: photoUrls } : input.facts;
    const specs = variants.map((variant) => normalizePosterSpec(variant, facts));
    if (specs.length > 0) return { specs, facts, aiDirected: true };
  } catch (error) {
    // Quota / plan limits must surface (upgrade prompt), not be papered over.
    if (isAiQuotaError(error)) throw error;
  }
  return {
    specs: buildRuleBasedPosterSpecs(input.facts, input.goal, {
      accent: input.brandColor,
      count: input.count ?? 4,
    }),
    facts: input.facts,
    aiDirected: false,
  };
}

export function useGeneratePosters() {
  const propertyId = usePropertyIdParam();
  return useMutation({
    mutationFn: (input: GeneratePostersInput) => generatePosters(propertyId, input),
    onError: (error: Error) => handleAiMutationError(error),
  });
}
