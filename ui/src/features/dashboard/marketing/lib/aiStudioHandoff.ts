import type { MarketingGenerationReference } from '@/features/dashboard/marketing/lib/marketingGenerationTypes';

/**
 * One-shot handoff into a new AI Studio creation ("Make a clip from this photo"): the
 * photo is already in the reference library, the new clip form picks it up once.
 */
let pending: MarketingGenerationReference | null = null;

export function setPendingAiStartPhoto(reference: MarketingGenerationReference): void {
  pending = reference;
}

export function takePendingAiStartPhoto(): MarketingGenerationReference | null {
  const reference = pending;
  pending = null;
  return reference;
}
