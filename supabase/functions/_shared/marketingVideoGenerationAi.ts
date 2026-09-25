/**
 * Veo 3.1 video generation for the Marketing Studio Generate tab (Phase 2).
 *
 * Request/response envelope verified against Google's current Veo REST reference
 * (ai.google.dev/gemini-api/docs/veo, 2026-09):
 *   POST models/{model}:predictLongRunning
 *     { instances:[{ prompt, referenceImages?:[{ image:{inlineData}, referenceType:'asset' }] }],
 *       parameters:{ aspectRatio, resolution, durationSeconds, personGeneration, negativePrompt? } }
 *   GET {operationName}
 *     { done, response?: { generateVideoResponse: { generatedSamples: [{ video: { uri } }] } },
 *       error?: { message } }
 *
 * Up to 3 `referenceImages` steer the subject/style; there is no multi-shot "starting
 * frame" support here (that would be the separate singular `image` field — a Phase 3
 * feature, not used yet).
 *
 * Two entry points:
 *   startMarketingVideoJob       — submits to :predictLongRunning, stores the operation name
 *   pollAndFinalizeMarketingVideoJob — polls Google, and on done:true runs the full
 *                                      finalize sequence (claim CAS -> download -> upload
 *                                      -> completion CAS -> bill). Both the poller endpoint
 *                                      and the cron sweeper call this same function so the
 *                                      double-finalize guard lives in exactly one place.
 */

import type { SupabaseClient } from './supabaseJs.ts';

import {
  AiProviderError,
  geminiModelPath,
  geminiRequest,
  geminiRequestWithKey,
  isGeminiConfigured,
} from './ai/llmTransport.ts';
import { type AiVideoModelConfig } from './aiModelRouter.ts';
import { recordAiUsage } from './aiUsageService.ts';
import {
  bumpMarketingVideoJobPoll,
  claimMarketingGenerationJobBilling,
  claimMarketingGenerationJobForFinalize,
  completeMarketingGenerationJob,
  failMarketingGenerationJob,
  getMarketingGenerationJob,
  markMarketingVideoJobProcessing,
  recordMarketingGenerationJobUsage,
  type MarketingGenerationJobRow,
} from './marketingGenerationJobs.ts';
import {
  extensionForVisualMime,
  fetchGeneratedVideoBytes,
  marketingGenerationStoragePath,
  uploadGenerationBytes,
} from './marketingGenerationStorage.ts';
import type { ReferenceInlineData } from './marketingImageGenerationAi.ts';

/** Per-attempt cap for Veo submit / poll HTTP calls (the generation itself runs async). */
const PROVIDER_TIMEOUT_MS = 30_000;

export class GenerationSafetyError extends Error {
  readonly code = 'safety_blocked';

  constructor(message = 'That prompt was blocked. Try rephrasing.') {
    super(message);
    this.name = 'GenerationSafetyError';
  }
}

export class GenerationProviderError extends Error {
  readonly code = 'provider_error';

  constructor(message: string) {
    super(message);
    this.name = 'GenerationProviderError';
  }
}

export function isGenerationSafetyError(error: unknown): error is GenerationSafetyError {
  return error instanceof GenerationSafetyError;
}

/**
 * `personGeneration: 'allow_adult'` is sent unconditionally — required in EU/UK/CH/MENA,
 * harmless elsewhere, and we cannot reliably infer the caller's region server-side.
 */
const PERSON_GENERATION = 'allow_adult';

export type StartMarketingVideoJobInput = {
  config: AiVideoModelConfig;
  prompt: string;
  negativePrompt?: string | null;
  aspectRatio: string;
  resolution: '720p' | '1080p';
  durationSeconds: number;
  references: ReferenceInlineData[];
};

/** Submits the job to Veo and stores the returned long-running operation name. */
export async function startMarketingVideoJob(
  sb: SupabaseClient,
  jobId: string,
  input: StartMarketingVideoJobInput
): Promise<MarketingGenerationJobRow> {
  if (!isGeminiConfigured()) {
    throw new GenerationProviderError('Video generation is not configured');
  }

  const body = {
    instances: [
      {
        prompt: input.prompt,
        ...(input.references.length > 0
          ? {
              referenceImages: input.references.map((reference) => ({
                image: { inlineData: reference },
                referenceType: 'asset',
              })),
            }
          : {}),
      },
    ],
    parameters: {
      aspectRatio: input.aspectRatio,
      resolution: input.resolution,
      durationSeconds: String(input.durationSeconds),
      personGeneration: PERSON_GENERATION,
      ...(input.negativePrompt ? { negativePrompt: input.negativePrompt } : {}),
    },
  };

  let json: { name?: string };
  try {
    json = (await geminiRequest(geminiModelPath(input.config.model, 'predictLongRunning'), body, {
      timeoutMs: PROVIDER_TIMEOUT_MS,
    })) as { name?: string };
  } catch (err) {
    if (err instanceof AiProviderError) throw new GenerationProviderError(err.message);
    throw err;
  }
  if (!json.name) {
    throw new GenerationProviderError('The model did not return an operation to track');
  }

  const updated = await markMarketingVideoJobProcessing(sb, jobId, json.name);
  if (!updated) {
    throw new GenerationProviderError('Job could not be marked as processing');
  }
  return updated;
}

type GoogleOperationResponse = {
  done?: boolean;
  error?: { message?: string };
  response?: {
    generateVideoResponse?: {
      generatedSamples?: Array<{ video?: { uri?: string } }>;
      raiMediaFilteredCount?: number;
    };
  };
};

/**
 * Polls a long-running operation. Operations belong to the Google project whose key created
 * them, so a 404 rotates to the next key; the key that answered is returned for the download.
 */
async function fetchOperationStatus(
  operationName: string
): Promise<{ status: GoogleOperationResponse; apiKey: string }> {
  try {
    const { json, apiKey } = await geminiRequestWithKey(operationName, null, {
      method: 'GET',
      timeoutMs: PROVIDER_TIMEOUT_MS,
      keySpecificStatuses: [404],
    });
    return { status: json as GoogleOperationResponse, apiKey };
  } catch (err) {
    if (err instanceof AiProviderError) {
      throw new GenerationProviderError(`Could not check generation status (${err.message})`);
    }
    throw err;
  }
}

export type PollAndFinalizeOutcome =
  | { kind: 'still_processing'; job: MarketingGenerationJobRow }
  | { kind: 'operation_failed'; job: MarketingGenerationJobRow | null }
  /** Another poller or the sweeper already claimed this job — caller should not log anything. */
  | { kind: 'claimed_by_other'; job: MarketingGenerationJobRow | null }
  /** Claim won, but the download/upload failed or a competing claim reclaimed it first — the
   *  job is left at `finalizing` (or already reclaimed to `processing`); sweeper pass 1/2 retry. */
  | { kind: 'not_finalized'; job: MarketingGenerationJobRow | null }
  | { kind: 'completed'; job: MarketingGenerationJobRow; creditsConsumed: number };

/**
 * Polls Google for one job and, when the operation is done, runs the full finalize
 * sequence. Both `get-marketing-generation-job` (has a live request/user) and
 * `marketing-generation-sweeper` (cron, no user) call this same function — the
 * double-finalize CAS guard therefore lives in exactly one place. Callers use the
 * returned `kind` only to decide what (if anything) to activity-log; this function
 * never touches the activity log itself since it doesn't know its caller's actor context.
 */
export async function pollAndFinalizeMarketingVideoJob(
  sb: SupabaseClient,
  job: MarketingGenerationJobRow
): Promise<PollAndFinalizeOutcome> {
  const operationName = job.provider_operation_name as string | null;
  if (!isGeminiConfigured() || !operationName) {
    return { kind: 'still_processing', job };
  }

  const { status, apiKey } = await fetchOperationStatus(operationName);

  if (!status.done) {
    const nextPollCount = Number(job.provider_poll_count ?? 0) + 1;
    await bumpMarketingVideoJobPoll(sb, String(job.id), nextPollCount);
    return { kind: 'still_processing', job: { ...job, provider_poll_count: nextPollCount } };
  }

  if (status.error || !status.response?.generateVideoResponse?.generatedSamples?.length) {
    const blocked = Number(status.response?.generateVideoResponse?.raiMediaFilteredCount ?? 0) > 0;
    const errorCode = blocked ? 'safety_blocked' : 'provider_error';
    const message = blocked
      ? 'That prompt was blocked. Try rephrasing.'
      : (status.error?.message ?? 'Video generation failed');
    const failed = await failMarketingGenerationJob(sb, String(job.id), errorCode, message);
    return { kind: 'operation_failed', job: failed };
  }

  const videoUri = status.response.generateVideoResponse.generatedSamples[0]?.video?.uri;
  if (!videoUri) {
    const failed = await failMarketingGenerationJob(
      sb,
      String(job.id),
      'provider_error',
      'The model did not return a video to download'
    );
    return { kind: 'operation_failed', job: failed };
  }

  // Compare-and-swap #1: only the winner may download, upload, and eventually bill.
  const claimToken = crypto.randomUUID();
  const claimed = await claimMarketingGenerationJobForFinalize(sb, String(job.id), claimToken);
  if (!claimed) {
    const current = await getMarketingGenerationJob(sb, String(job.id));
    return { kind: 'claimed_by_other', job: current };
  }

  let bytes: Uint8Array;
  let mimeType: string;
  try {
    const downloaded = await fetchGeneratedVideoBytes(videoUri, apiKey);
    bytes = downloaded.bytes;
    mimeType = downloaded.mimeType;
  } catch (err) {
    // Leave the row at `finalizing` — sweeper pass 1 reclaims it after 2 minutes and
    // pass 2 retries the download. We won the claim but did not finish, so no charge yet.
    console.error('[marketingVideoGenerationAi] download failed:', (err as Error).message);
    return { kind: 'not_finalized', job: claimed };
  }

  const storagePath = marketingGenerationStoragePath(
    String(claimed.property_id),
    String(claimed.id),
    extensionForVisualMime(mimeType)
  );
  let outputUrl: string;
  try {
    outputUrl = await uploadGenerationBytes(sb, storagePath, bytes, mimeType);
  } catch (err) {
    console.error('[marketingVideoGenerationAi] upload failed:', (err as Error).message);
    return { kind: 'not_finalized', job: claimed };
  }

  // The cost was already computed correctly at request time (assertValidVideoOptions +
  // estimateGenerationCostUsd, against the real resolved model config) and stored on the
  // job row — reuse it rather than reconstructing a model config here.
  const estimatedCostUsd = Number(claimed.estimated_cost_usd ?? 0);

  // Compare-and-swap #2: completion. Zero rows means the claim was reclaimed mid-flight
  // (sweeper pass 1 fired between our claim and here) — skip billing entirely.
  const completed = await completeMarketingGenerationJob(
    sb,
    String(claimed.id),
    'finalizing',
    {
      outputStoragePath: storagePath,
      outputUrl,
      outputMimeType: mimeType,
      outputBytes: bytes.byteLength,
      estimatedCostUsd,
    },
    claimToken
  );
  if (!completed) {
    return { kind: 'not_finalized', job: claimed };
  }

  // Claim billing before calling recordAiUsage, not after — the sweeper's billing-
  // repair pass can otherwise race a crash between recordAiUsage succeeding and the
  // stamp below, double-billing. See claimMarketingGenerationJobBilling's doc comment.
  let creditsConsumed = 0;
  if (await claimMarketingGenerationJobBilling(sb, String(completed.id))) {
    const usage = await recordAiUsage({
      organizationId: String(completed.organization_id),
      propertyId: String(completed.property_id),
      feature: 'marketing_video_generate',
      provider: 'gemini',
      model: String(completed.model),
      durationSeconds: Number(completed.duration_seconds ?? 0),
      estimatedCostUsd,
      actorUserId: (completed.triggered_by as string | null) ?? null,
      actorType: 'staff',
    });
    creditsConsumed = usage.creditsConsumed;
    await recordMarketingGenerationJobUsage(sb, String(completed.id), {
      creditsConsumed: usage.creditsConsumed,
      usageEventId: usage.usageEventId,
    });
  }

  return {
    kind: 'completed',
    job: { ...completed, credits_consumed: creditsConsumed },
    creditsConsumed,
  };
}
