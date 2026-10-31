import { toast } from 'sonner';

import type { QueryClient } from '@tanstack/react-query';

import { friendlyToastError, isTechnicalToastMessage } from '@/lib/feedback/toastMessages';
import { invalidateFeatureAvailability } from '@/lib/featureAvailability/useFeatureAvailability';

export const FEATURE_UNAVAILABLE_CODE = 'FEATURE_UNAVAILABLE';

export type FeatureUnavailablePayload = {
  code: typeof FEATURE_UNAVAILABLE_CODE;
  error: string;
  feature?: string;
  reason?: string | null;
  expectedBackAt?: string | null;
};

export function parseFeatureUnavailable(body: unknown): FeatureUnavailablePayload | null {
  if (!body || typeof body !== 'object') return null;
  const record = body as Record<string, unknown>;
  if (record.code !== FEATURE_UNAVAILABLE_CODE) return null;
  const error = typeof record.error === 'string' ? record.error : null;
  if (!error) return null;
  return {
    code: FEATURE_UNAVAILABLE_CODE,
    error,
    feature: typeof record.feature === 'string' ? record.feature : undefined,
    reason: typeof record.reason === 'string' ? record.reason : null,
    expectedBackAt: typeof record.expectedBackAt === 'string' ? record.expectedBackAt : null,
  };
}

export function isFeatureUnavailableResponse(body: unknown): body is FeatureUnavailablePayload {
  return parseFeatureUnavailable(body) !== null;
}

export function toastFeatureUnavailable(message: string): void {
  const text = message.trim() || 'This feature is temporarily unavailable.';
  if (isTechnicalToastMessage(text)) {
    toast.error(friendlyToastError(text, 'This feature is off right now.'));
    return;
  }
  toast.error(text);
}

export class FeatureUnavailableMutationError extends Error {
  readonly payload: FeatureUnavailablePayload;

  constructor(payload: FeatureUnavailablePayload) {
    super(payload.error);
    this.name = 'FeatureUnavailableMutationError';
    this.payload = payload;
  }
}

export function throwIfFeatureUnavailableBody(body: unknown): void {
  const parsed = parseFeatureUnavailable(body);
  if (parsed) throw new FeatureUnavailableMutationError(parsed);
}

export function handleFeatureUnavailableMutationError(
  error: unknown,
  queryClient: QueryClient,
  jsonBody?: unknown
): boolean {
  const fromJson = jsonBody ? parseFeatureUnavailable(jsonBody) : null;
  if (fromJson) {
    toastFeatureUnavailable(fromJson.error);
    invalidateFeatureAvailability(queryClient);
    return true;
  }
  if (error instanceof FeatureUnavailableMutationError) {
    toastFeatureUnavailable(error.payload.error);
    invalidateFeatureAvailability(queryClient);
    return true;
  }
  return false;
}
