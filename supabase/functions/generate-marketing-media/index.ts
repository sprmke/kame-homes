/**
 * generate-marketing-media — prompt + reference assets in, a finished AI image or
 * video out.
 *
 * Images run INLINE on the POST, exactly like generate-marketing-template: they
 * complete in 5-15s, comfortably inside the edge timeout, and the repo deliberately
 * avoids EdgeRuntime.waitUntil (local `functions serve` drops background work,
 * leaving rows stuck at `processing`).
 *
 * Video cannot run inline (Veo takes 11s-6min), so it submits to Veo's
 * `:predictLongRunning` and returns immediately with a `processing` row — the client
 * polls `get-marketing-generation-job`, and a `pg_cron` sweeper (`marketing-generation-
 * sweeper`) finalizes it even if the tab closes. See the Phase 2 plan §4.
 *
 * Both branches return `{ job }` in one shape so the client always just hands the row
 * to the poller.
 *
 * Gate order (mirrors generate-marketing-template, extended):
 *   property scope → team permission + plan feature (differs by media type) → rate
 *   limit → option validation → assertOrgAndPropertyAiQuota →
 *   assertMarketingGenerationBudget → insert job → generate
 */

import { jsonError, jsonResponse, jsonSuccess, readJsonBody } from '../_shared/httpResponse.ts';
import { HOST_FACING_GENERATION_FAILED, toHostFacingError } from '../_shared/hostFacingError.ts';
import {
  isAiFeatureDisabledError,
  isAiPlatformDisabledError,
  isAiQuotaError,
  assertOrgAndPropertyAiQuota,
  recordAiUsage,
} from '../_shared/aiUsageService.ts';
import { createServiceClient, requirePropertyPermissionAndFeature } from '../_shared/orgAuth.ts';
import { logAssetActivity } from '../_shared/assetActivity.ts';
import { rateLimitGate } from '../_shared/rateLimit.ts';
import { resolveScopedPropertyAccess } from '../_shared/propertyScope.ts';
import { serveAuthenticated } from '../_shared/serveEdge.ts';
import {
  MAX_IMAGE_PROMPT_CHARS,
  MAX_NEGATIVE_PROMPT_CHARS,
  MAX_VIDEO_PROMPT_CHARS,
  assertValidImageOptions,
  assertValidVideoOptions,
  estimateGenerationCostUsd,
  estimateGenerationCredits,
  isGenerationOptionError,
} from '../_shared/marketingGenerationPricing.ts';
import {
  assertMarketingGenerationBudget,
  isGenerationConcurrencyError,
} from '../_shared/marketingGenerationBudget.ts';
import {
  claimMarketingGenerationJobBilling,
  completeMarketingGenerationJob,
  failMarketingGenerationJob,
  insertMarketingGenerationJob,
  recordMarketingGenerationJobUsage,
  toMarketingGenerationJobDto,
  touchGenerationReferences,
} from '../_shared/marketingGenerationJobs.ts';
import {
  generateMarketingImage,
  isGenerationSafetyError,
  loadReferenceInlineData,
} from '../_shared/marketingImageGenerationAi.ts';
import { startMarketingVideoJob } from '../_shared/marketingVideoGenerationAi.ts';
import {
  allowPremiumForFeature,
  getMarketingGenerationOverrides,
  MARKETING_IMAGE_GENERATE_FEATURE,
  MARKETING_VIDEO_GENERATE_FEATURE,
} from '../_shared/marketingGenerationFeatureConfig.ts';
import {
  extensionForVisualMime,
  marketingGenerationStoragePath,
  uploadGenerationBytes,
} from '../_shared/marketingGenerationStorage.ts';

const MAX_REFERENCE_IDS = 14;
/** Video jobs run for up to ~6 minutes (Veo p99); expire the row if it never finishes. */
const VIDEO_JOB_TTL_MS = 45 * 60_000;

type ReferenceRow = { id: string; storage_path: string; public_url: string; mime_type: string };

serveAuthenticated('generate-marketing-media', async (req) => {
  if (req.method !== 'POST') {
    return jsonError(req, 'Method not allowed', 405);
  }

  const body = await readJsonBody(req);
  const mediaType = body.mediaType === 'video' ? 'video' : 'image';
  const isVideo = mediaType === 'video';

  const permission = isVideo ? 'marketing.generate.video:add' : 'marketing.generate:add';
  const planFeature = isVideo ? 'aiMarketingVideoGeneration' : 'aiMarketingImageGeneration';
  const feature = isVideo ? 'marketing_video_generate' : 'marketing_image_generate';

  let propertyId: string;
  let organizationId: string;
  let actorUserId: string;
  let actorEmail: string;
  let accessKind: string;
  try {
    const scoped = await resolveScopedPropertyAccess(req, permission);
    propertyId = scoped.property.id;
    organizationId = String(scoped.property.organization_id);
    const access = await requirePropertyPermissionAndFeature(
      req,
      propertyId,
      permission,
      planFeature
    );
    actorUserId = access.user.id;
    actorEmail = access.user.email;
    accessKind = access.accessKind;
  } catch (err) {
    if (err instanceof Response) return err;
    throw err;
  }

  const limited = await rateLimitGate(req, {
    scope: isVideo ? 'marketing-generation-video' : 'marketing-generation-image',
    identity: actorUserId,
    limit: isVideo ? 5 : 20,
    windowSec: 300,
  });
  if (limited) return limited;

  const maxPromptChars = isVideo ? MAX_VIDEO_PROMPT_CHARS : MAX_IMAGE_PROMPT_CHARS;
  const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : '';
  if (!prompt) return jsonError(req, 'Prompt is required', 400);
  if (prompt.length > maxPromptChars) {
    return jsonError(req, 'Prompt is too long', 400);
  }

  const negativePrompt =
    typeof body.negativePrompt === 'string' && body.negativePrompt.trim()
      ? body.negativePrompt.trim().slice(0, MAX_NEGATIVE_PROMPT_CHARS)
      : null;

  const referenceIds = Array.isArray(body.referenceIds)
    ? body.referenceIds
        .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
        .slice(0, MAX_REFERENCE_IDS)
    : [];

  const sb = createServiceClient();

  let references: ReferenceRow[] = [];
  if (referenceIds.length > 0) {
    const { data, error } = await sb
      .from('marketing_generation_references')
      .select('id, property_id, storage_path, public_url, mime_type, media_type')
      .in('id', referenceIds);
    if (error) return jsonError(req, error.message, 500);

    const rows = data ?? [];
    if (rows.length !== referenceIds.length) {
      return jsonError(req, 'One or more reference files could not be found', 400);
    }
    if (rows.some((row) => row.property_id !== propertyId)) {
      return jsonError(req, 'Reference does not belong to this property', 403);
    }
    // Veo's referenceImages (video) and Gemini's inline references (image) are both
    // still-image guidance — neither branch accepts a video clip as a reference.
    if (rows.some((row) => row.media_type !== 'image')) {
      return jsonError(req, 'Only image references are supported', 400);
    }
    references = rows as ReferenceRow[];
  }

  if (isVideo) {
    return handleVideoGeneration(req, {
      sb,
      organizationId,
      propertyId,
      actorUserId,
      actorEmail,
      accessKind,
      prompt,
      negativePrompt,
      references,
      body,
      feature,
    });
  }

  return handleImageGeneration(req, {
    sb,
    organizationId,
    propertyId,
    actorUserId,
    actorEmail,
    accessKind,
    prompt,
    negativePrompt,
    references,
    body,
    feature,
  });
});

type GenerationRequestContext = {
  sb: ReturnType<typeof createServiceClient>;
  organizationId: string;
  propertyId: string;
  actorUserId: string;
  actorEmail: string;
  accessKind: string;
  prompt: string;
  negativePrompt: string | null;
  references: ReferenceRow[];
  body: Record<string, unknown>;
  feature: 'marketing_image_generate' | 'marketing_video_generate';
};

async function handleImageGeneration(req: Request, ctx: GenerationRequestContext) {
  const {
    sb,
    organizationId,
    propertyId,
    actorUserId,
    actorEmail,
    accessKind,
    prompt,
    negativePrompt,
    references,
    body,
  } = ctx;

  let options: ReturnType<typeof assertValidImageOptions>;
  try {
    options = assertValidImageOptions({
      tier: typeof body.qualityTier === 'string' ? body.qualityTier : undefined,
      aspectRatio: typeof body.aspectRatio === 'string' ? body.aspectRatio : undefined,
      imageSize: typeof body.imageSize === 'string' ? body.imageSize : undefined,
      referenceCount: references.length,
    });
  } catch (err) {
    if (isGenerationOptionError(err)) return jsonError(req, err.message, 400);
    throw err;
  }

  const premiumBlocked = await rejectPremiumIfDisabled(
    req,
    propertyId,
    organizationId,
    MARKETING_IMAGE_GENERATE_FEATURE,
    options.tier
  );
  if (premiumBlocked) return premiumBlocked;

  const estimatedCredits = estimateGenerationCredits({
    mediaType: 'image',
    tier: options.tier,
    imageSize: options.imageSize,
  });

  const budgetError = await checkQuotaAndBudget(req, {
    organizationId,
    propertyId,
    feature: 'marketing_image_generate',
    estimatedCredits,
  });
  if (budgetError) return budgetError;

  const job = await insertMarketingGenerationJob(sb, {
    organizationId,
    propertyId,
    mediaType: 'image',
    prompt,
    negativePrompt,
    model: options.config.model,
    qualityTier: options.tier,
    aspectRatio: options.aspectRatio,
    imageSize: options.imageSize,
    referencePaths: references.map((reference) => reference.storage_path),
    referenceUrls: references.map((reference) => reference.public_url),
    estimatedCredits,
    estimatedCostUsd: 0,
    triggeredBy: actorUserId,
  });
  const jobId = String(job.id);

  try {
    const inlineReferences = await loadReferenceInlineData(sb, references);
    const generated = await generateMarketingImage({
      config: options.config,
      prompt,
      negativePrompt,
      aspectRatio: options.aspectRatio,
      imageSize: options.imageSize,
      references: inlineReferences,
    });

    const storagePath = marketingGenerationStoragePath(
      propertyId,
      jobId,
      extensionForVisualMime(generated.mimeType)
    );
    const outputUrl = await uploadGenerationBytes(
      sb,
      storagePath,
      generated.bytes,
      generated.mimeType
    );

    const completed = await completeMarketingGenerationJob(sb, jobId, 'pending', {
      outputStoragePath: storagePath,
      outputUrl,
      outputMimeType: generated.mimeType,
      outputBytes: generated.bytes.byteLength,
      outputWidth: generated.width,
      outputHeight: generated.height,
      estimatedCostUsd: generated.estimatedCostUsd,
    });
    if (!completed) {
      return jsonError(req, 'Generation could not be saved', 500);
    }

    // Claim billing before calling recordAiUsage, not after — the sweeper's billing-
    // repair pass covers image jobs too, and without this claim a crash between
    // recordAiUsage succeeding and the stamp below would look like "never billed" and
    // get double-billed on repair. See claimMarketingGenerationJobBilling's doc comment.
    let creditsConsumed = 0;
    if (await claimMarketingGenerationJobBilling(sb, jobId)) {
      const usage = await recordAiUsage({
        organizationId,
        propertyId,
        feature: 'marketing_image_generate',
        provider: 'gemini',
        model: generated.model,
        inputTokens: generated.inputTokens,
        outputTokens: generated.outputTokens,
        estimatedCostUsd: generated.estimatedCostUsd,
        actorUserId,
        actorType: 'staff',
      });
      creditsConsumed = usage.creditsConsumed;
      await recordMarketingGenerationJobUsage(sb, jobId, {
        creditsConsumed: usage.creditsConsumed,
        usageEventId: usage.usageEventId,
      });
    }

    // Independent bookkeeping writes — run concurrently, neither depends on the other.
    await Promise.all([
      touchGenerationReferences(
        sb,
        references.map((reference) => reference.id)
      ),
      logAssetActivity({
        req,
        user: { id: actorUserId, email: actorEmail },
        action: 'marketing.image_generated',
        propertyId,
        organizationId,
        accessKind,
        targetType: 'marketing_generation',
        targetId: jobId,
        metadata: {
          model: generated.model,
          quality_tier: options.tier,
          aspect_ratio: options.aspectRatio,
          image_size: options.imageSize,
          reference_count: references.length,
          credits: creditsConsumed,
        },
      }),
    ]);

    return jsonSuccess(req, {
      job: toMarketingGenerationJobDto({
        ...completed,
        credits_consumed: creditsConsumed,
      }),
    });
  } catch (err) {
    console.warn('[generate-marketing-media] image generation failed:', err);
    const safety = isGenerationSafetyError(err);
    const errorCode = safety
      ? 'safety_blocked'
      : ((err as { code?: string }).code ?? 'provider_error');
    const message = toHostFacingError(
      (err as Error).message ?? 'Image generation failed',
      HOST_FACING_GENERATION_FAILED
    );
    const failed = await failMarketingGenerationJob(sb, jobId, errorCode, message);

    return jsonResponse(
      req,
      {
        success: false,
        error: message,
        data: failed ? { job: toMarketingGenerationJobDto(failed) } : undefined,
      },
      safety ? 400 : 502
    );
  }
}

async function handleVideoGeneration(req: Request, ctx: GenerationRequestContext) {
  const {
    sb,
    organizationId,
    propertyId,
    actorUserId,
    actorEmail,
    accessKind,
    prompt,
    negativePrompt,
    references,
    body,
  } = ctx;

  let options: ReturnType<typeof assertValidVideoOptions>;
  try {
    options = assertValidVideoOptions({
      tier: typeof body.qualityTier === 'string' ? body.qualityTier : undefined,
      aspectRatio: typeof body.aspectRatio === 'string' ? body.aspectRatio : undefined,
      resolution: typeof body.resolution === 'string' ? body.resolution : undefined,
      durationSeconds: typeof body.durationSeconds === 'number' ? body.durationSeconds : undefined,
      referenceCount: references.length,
    });
  } catch (err) {
    if (isGenerationOptionError(err)) return jsonError(req, err.message, 400);
    throw err;
  }

  const premiumBlocked = await rejectPremiumIfDisabled(
    req,
    propertyId,
    organizationId,
    MARKETING_VIDEO_GENERATE_FEATURE,
    options.tier
  );
  if (premiumBlocked) return premiumBlocked;

  const estimatedCredits = estimateGenerationCredits({
    mediaType: 'video',
    tier: options.tier,
    resolution: options.resolution,
    durationSeconds: options.durationSeconds,
  });
  const estimatedCostUsd = estimateGenerationCostUsd({
    mediaType: 'video',
    tier: options.tier,
    resolution: options.resolution,
    durationSeconds: options.durationSeconds,
  });

  const budgetError = await checkQuotaAndBudget(req, {
    organizationId,
    propertyId,
    feature: 'marketing_video_generate',
    estimatedCredits,
  });
  if (budgetError) return budgetError;

  const job = await insertMarketingGenerationJob(sb, {
    organizationId,
    propertyId,
    mediaType: 'video',
    prompt,
    negativePrompt,
    model: options.config.model,
    qualityTier: options.tier,
    aspectRatio: options.aspectRatio,
    resolution: options.resolution,
    durationSeconds: options.durationSeconds,
    referencePaths: references.map((reference) => reference.storage_path),
    referenceUrls: references.map((reference) => reference.public_url),
    estimatedCredits,
    estimatedCostUsd,
    expiresAt: new Date(Date.now() + VIDEO_JOB_TTL_MS).toISOString(),
    triggeredBy: actorUserId,
  });
  const jobId = String(job.id);

  try {
    const inlineReferences = await loadReferenceInlineData(sb, references);
    const processing = await startMarketingVideoJob(sb, jobId, {
      config: options.config,
      prompt,
      negativePrompt,
      aspectRatio: options.aspectRatio,
      resolution: options.resolution,
      durationSeconds: options.durationSeconds,
      references: inlineReferences,
    });

    // Independent bookkeeping writes — run concurrently, neither depends on the other.
    await Promise.all([
      touchGenerationReferences(
        sb,
        references.map((reference) => reference.id)
      ),
      logAssetActivity({
        req,
        user: { id: actorUserId, email: actorEmail },
        action: 'marketing.video_generation_started',
        propertyId,
        organizationId,
        accessKind,
        targetType: 'marketing_generation',
        targetId: jobId,
        metadata: {
          model: options.config.model,
          quality_tier: options.tier,
          aspect_ratio: options.aspectRatio,
          resolution: options.resolution,
          duration_seconds: options.durationSeconds,
          reference_count: references.length,
          estimated_credits: estimatedCredits,
        },
      }),
    ]);

    return jsonSuccess(req, { job: toMarketingGenerationJobDto(processing) });
  } catch (err) {
    console.warn('[generate-marketing-media] video generation failed to start:', err);
    const safety = isGenerationSafetyError(err);
    const errorCode = safety
      ? 'safety_blocked'
      : ((err as { code?: string }).code ?? 'provider_error');
    const message = toHostFacingError(
      (err as Error).message ?? 'Video generation could not be started',
      HOST_FACING_GENERATION_FAILED
    );
    const failed = await failMarketingGenerationJob(sb, jobId, errorCode, message);

    return jsonResponse(
      req,
      {
        success: false,
        error: message,
        data: failed ? { job: toMarketingGenerationJobDto(failed) } : undefined,
      },
      safety ? 400 : 502
    );
  }
}

async function checkQuotaAndBudget(
  req: Request,
  input: {
    organizationId: string;
    propertyId: string;
    feature: 'marketing_image_generate' | 'marketing_video_generate';
    estimatedCredits: number;
  }
): Promise<Response | null> {
  try {
    await assertOrgAndPropertyAiQuota(input.organizationId, input.propertyId, input.feature);
    await assertMarketingGenerationBudget(input);
  } catch (err) {
    if (isGenerationConcurrencyError(err)) {
      return jsonResponse(req, { success: false, error: err.message, retryable: true }, 429);
    }
    if (isAiQuotaError(err)) {
      return jsonResponse(
        req,
        { success: false, error: (err as Error).message, upgradeHook: true },
        429
      );
    }
    if (isAiPlatformDisabledError(err) || isAiFeatureDisabledError(err)) {
      return jsonError(req, (err as Error).message, 503);
    }
    throw err;
  }
  return null;
}

async function rejectPremiumIfDisabled(
  req: Request,
  propertyId: string,
  organizationId: string,
  feature: typeof MARKETING_IMAGE_GENERATE_FEATURE | typeof MARKETING_VIDEO_GENERATE_FEATURE,
  tier: string
): Promise<Response | null> {
  if (tier !== 'premium') return null;
  const overrides = await getMarketingGenerationOverrides(propertyId, organizationId);
  if (allowPremiumForFeature(overrides, feature)) return null;
  return jsonError(req, 'Premium quality is not enabled for this property', 403);
}
