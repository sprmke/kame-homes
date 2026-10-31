import { useMutation } from '@tanstack/react-query';

import type { CalendarTemplateTokens } from '@/features/dashboard/marketing/lib/calendarAiTokens';
import type { DesignTemplateTokens } from '@/features/dashboard/marketing/lib/designAiTokens';
import type { VideoTemplateTokens } from '@/features/dashboard/marketing/lib/videoAiTokens';
import { usePropertyIdParam, scopedFunctionsUrl } from '@/features/dashboard/org/lib/adminApiScope';
import {
  handleAiMutationError,
  parseEdgeJsonOrQuota,
} from '@/features/dashboard/org/lib/aiQuotaToast';
import { getSessionJwt } from '@/features/dashboard/org/lib/edgeClient';

export type GenerateMarketingTemplatePayload = {
  contentType: 'calendar' | 'design' | 'video';
  prompt: string;
  includeContext?: {
    propertyPhoto?: boolean;
    amenities?: boolean;
    availability?: boolean;
    orgLogo?: boolean;
    propertyName?: boolean;
    cta?: boolean;
  };
  amenitiesText?: string;
  availabilityText?: string;
  /** Design-only: describes what the generated design should say. Overrides category defaults. */
  content?: string;
  /** Calendar / Design style locks — folded into the model prompt server-side. */
  preferences?: {
    layoutArchetype?: string;
    fontPairing?: string;
    backgroundMood?: string;
    category?: string;
  };
};

export type GenerateMarketingTemplateResult =
  | { contentType: 'calendar'; tokens: CalendarTemplateTokens }
  | { contentType: 'design'; tokens: DesignTemplateTokens }
  | { contentType: 'video'; tokens: VideoTemplateTokens };

async function parseEdgeJson<T>(res: Response): Promise<T> {
  return parseEdgeJsonOrQuota<T>(res);
}

export async function generateMarketingTemplateRequest(
  propertyId: string | null,
  payload: GenerateMarketingTemplatePayload
): Promise<GenerateMarketingTemplateResult> {
  const jwt = await getSessionJwt();
  const res = await fetch(scopedFunctionsUrl('generate-marketing-template', propertyId), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${jwt}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  return parseEdgeJson(res);
}

export function useGenerateMarketingTemplate() {
  const propertyId = usePropertyIdParam();

  return useMutation({
    mutationFn: (payload: GenerateMarketingTemplatePayload) =>
      generateMarketingTemplateRequest(propertyId, payload),
    onError: (error: Error) => handleAiMutationError(error),
  });
}
