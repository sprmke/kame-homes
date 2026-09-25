/**
 * One HTTP mapping for AI failures, shared by every AI edge handler, so hosts never see provider
 * dumps (model ids, quota JSON, URLs) and each failure class gets a consistent status.
 */

import {
  isAiFeatureDisabledError,
  isAiPlatformDisabledError,
  isAiQuotaError,
} from '../aiUsageService.ts';
import {
  HOST_FACING_BUSY,
  HOST_FACING_GENERATION_FAILED,
  toHostFacingError,
} from '../hostFacingError.ts';
import { handleEdgeError, jsonError, jsonResponse } from '../httpResponse.ts';
import { AiOutputValidationError, AiProviderError } from './llmClient.ts';

export function aiErrorResponse(
  req: Request,
  err: unknown,
  logPrefix: string,
  fallback = HOST_FACING_GENERATION_FAILED
): Response | Promise<Response> {
  if (isAiQuotaError(err)) {
    return jsonResponse(req, { success: false, error: err.message, upgradeHook: true }, 429);
  }
  if (isAiPlatformDisabledError(err) || isAiFeatureDisabledError(err)) {
    return jsonError(req, err.message, 503);
  }
  if (err instanceof AiProviderError) {
    if (err.code === 'aborted') return jsonError(req, 'Request cancelled', 499);
    const busy = err.code === 'rate_limited' || err.code === 'timeout' || err.retryable;
    return jsonError(req, busy ? HOST_FACING_BUSY : toHostFacingError(err, fallback), 503);
  }
  if (err instanceof AiOutputValidationError) {
    return jsonError(req, fallback, 502);
  }
  return handleEdgeError(req, err, logPrefix);
}
