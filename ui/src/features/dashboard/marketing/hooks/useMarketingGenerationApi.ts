/**
 * Shared fetch plumbing for the Generate tab.
 *
 * `parseEdgeJsonOrQuota` treats every 429 as an AI-quota error, but this surface has
 * two other kinds: the per-user rate limit and the concurrency cap, both of which are
 * "wait a moment", not "upgrade your plan". Sending those through the upgrade toast
 * would be misleading, so they get their own branch here.
 */

import { toast } from 'sonner';

import {
  AiQuotaExceededClientError,
  toastAiQuotaExceeded,
} from '@/features/dashboard/org/lib/aiQuotaToast';
import { getSessionJwt } from '@/features/dashboard/org/lib/edgeClient';
import type { PlanFeatureKey } from '@/features/dashboard/plans/lib/planFeatures';

import { friendlyToastError } from '@/lib/feedback/toastMessages';
import {
  FeatureUnavailableMutationError,
  throwIfFeatureUnavailableBody,
  toastFeatureUnavailable,
} from '@/lib/featureAvailability/featureUnavailableError';

const DEFAULT_QUOTA_FEATURE: PlanFeatureKey = 'aiMarketingImageGeneration';

export class GenerationRetryableError extends Error {
  readonly retryable = true;

  constructor(message: string) {
    super(message);
    this.name = 'GenerationRetryableError';
  }
}

/** A request the server refused or failed, with whatever row it saved (failed jobs). */
export class GenerationRequestError extends Error {
  readonly data: unknown;
  readonly status: number;

  constructor(message: string, status: number, data: unknown) {
    super(message);
    this.name = 'GenerationRequestError';
    this.status = status;
    this.data = data;
  }
}

/** The failed job a generate request still saved (a new conversation exists then too). */
export function failedJobFromError(
  error: unknown
): { id: string; sessionId?: string | null } | null {
  if (!(error instanceof GenerationRequestError)) return null;
  const job = (error.data as { job?: { id?: unknown; sessionId?: unknown } } | undefined)?.job;
  if (!job || typeof job.id !== 'string') return null;
  return {
    id: job.id,
    sessionId: typeof job.sessionId === 'string' ? job.sessionId : null,
  };
}

type EdgeEnvelope = {
  success?: boolean;
  data?: unknown;
  error?: string;
  upgradeHook?: boolean;
  retryable?: boolean;
  rateLimited?: boolean;
  feature?: string;
};

/**
 * `feature` is which plan gate this specific request is about (image vs video generation),
 * so a 429 upgrade prompt names the tier that actually unlocks it — video's per-feature
 * sub-cap triggers far more easily than images' (a clip is 7-50x an image's credits), so
 * getting this wrong sends the host to the wrong plan/CTA.
 */
export async function generationFetch<T>(
  url: string,
  init?: RequestInit,
  feature: PlanFeatureKey = DEFAULT_QUOTA_FEATURE
): Promise<T> {
  const jwt = await getSessionJwt();
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${jwt}`,
      ...(init?.headers ?? {}),
    },
  });

  const json = (await res.json().catch(() => ({}))) as EdgeEnvelope;

  if (res.status === 503) {
    throwIfFeatureUnavailableBody(json);
  }

  if (res.status === 429) {
    if (json.upgradeHook) {
      throw new AiQuotaExceededClientError(json.error, feature);
    }
    throw new GenerationRetryableError(json.error ?? 'Too many requests. Try again shortly.');
  }
  if (!res.ok || !json.success) {
    throw new GenerationRequestError(
      json.error ?? `Request failed (${res.status})`,
      res.status,
      json.data
    );
  }
  return json.data as T;
}

export function handleGenerationError(error: Error): void {
  if (error instanceof FeatureUnavailableMutationError) {
    toastFeatureUnavailable(error.payload.error);
    return;
  }
  if (error instanceof AiQuotaExceededClientError) {
    toastAiQuotaExceeded(error.message, { feature: error.feature ?? DEFAULT_QUOTA_FEATURE });
    return;
  }
  toast.error(friendlyToastError(error, 'Could not generate that. Try again.'));
}

export const MARKETING_GENERATIONS_QUERY_KEY = 'marketing-generations';
export const MARKETING_AI_SESSIONS_QUERY_KEY = 'marketing-ai-sessions';
export const MARKETING_GENERATION_JOB_QUERY_KEY = 'marketing-generation-job';
export const MARKETING_GENERATION_REFERENCES_QUERY_KEY = 'marketing-generation-references';
