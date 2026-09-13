import { toast } from 'sonner';

import type { PlanFeatureKey } from '@/features/dashboard/plans/lib/planFeatures';
import {
  openUpgradeModalFromBridge,
  hasUpgradeModalOpener,
} from '@/features/dashboard/plans/lib/upgradeModalBridge';

import { friendlyToastError, isTechnicalToastMessage } from '@/lib/feedback/toastMessages';

/** Thrown when an edge function returns 429 + upgradeHook. */
export class AiQuotaExceededClientError extends Error {
  readonly upgradeHook = true;

  constructor(
    message?: string,
    readonly feature?: PlanFeatureKey
  ) {
    super(message ?? 'AI usage limit reached');
    this.name = 'AiQuotaExceededClientError';
  }
}

type ToastAiQuotaOptions = {
  openUpgradeModal?: (feature: PlanFeatureKey) => void;
  feature?: PlanFeatureKey;
};

/** Surfaces upgrade CTA when edge functions return upgradeHook. */
/** Surfaces upgrade CTA when edge functions return upgradeHook. */
export function toastAiQuotaExceeded(message?: string, options?: ToastAiQuotaOptions): void {
  const raw = message ?? 'AI usage limit reached';
  if (isTechnicalToastMessage(raw)) {
    toast.error(friendlyToastError(raw, 'This is busy right now. Try again in a moment.'));
    return;
  }
  const isCreditMessage = /credit/i.test(raw);
  toast.error(raw, {
    action: {
      label: isCreditMessage ? 'Buy credits' : 'Upgrade',
      onClick: () => {
        if (isCreditMessage) {
          toast.message('Buy more AI credits (coming soon). Contact support for a manual top-up.');
          return;
        }
        const feature = options?.feature ?? 'aiMarketingGeneration';
        const openModal = options?.openUpgradeModal ?? openUpgradeModalFromBridge;
        if (options?.openUpgradeModal || hasUpgradeModalOpener()) {
          openModal(feature);
          return;
        }
        toast.message('AI upgrade billing is coming soon. Contact support for higher limits.');
      },
    },
  });
}

export function isAiQuotaResponse(
  body: unknown
): body is { upgradeHook?: boolean; error?: string; feature?: string } {
  return Boolean(
    body && typeof body === 'object' && (body as { upgradeHook?: boolean }).upgradeHook
  );
}

export function isAiQuotaError(error: unknown): error is AiQuotaExceededClientError {
  return error instanceof AiQuotaExceededClientError;
}

type EdgeEnvelope = {
  success?: boolean;
  error?: string;
  upgradeHook?: boolean;
  feature?: string;
  data?: unknown;
};

function parseFeatureKey(value: string | undefined): PlanFeatureKey | undefined {
  if (!value) return undefined;
  return value as PlanFeatureKey;
}

/** Parse `{ success, data }` edge JSON; throws AiQuotaExceededClientError on quota responses. */
export async function parseEdgeJsonOrQuota<T>(res: Response): Promise<T> {
  const json = (await res.json()) as EdgeEnvelope;
  throwIfUpgradeHookFromJson(json, res);
  if (!json.success) {
    throw new Error(json.error ?? 'Request failed');
  }
  return json.data as T;
}

/** Use after `res.json()` when the body may include upgradeHook (avoids reading the stream twice). */
export function throwIfUpgradeHookFromJson(json: EdgeEnvelope, res: Response): void {
  if (json.upgradeHook || res.status === 429) {
    throw new AiQuotaExceededClientError(json.error, parseFeatureKey(json.feature));
  }
}

/** Check a parsed edge envelope before unwrap (inbox-style responses). */
export function throwIfAiQuota(json: EdgeEnvelope, res: Response): void {
  if (json.upgradeHook || res.status === 429) {
    throw new AiQuotaExceededClientError(json.error, parseFeatureKey(json.feature));
  }
}

export function handleAiMutationError(error: Error): void {
  if (isAiQuotaError(error)) {
    toastAiQuotaExceeded(error.message, { feature: error.feature ?? 'aiMarketingGeneration' });
    return;
  }
  toast.error(friendlyToastError(error, 'Request failed'));
}
