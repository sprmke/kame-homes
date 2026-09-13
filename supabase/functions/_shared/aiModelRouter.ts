/**
 * Central model routing for platform AI features — keeps Flash vs Flash-Lite tiering
 * in one place instead of hard-coded model strings per service.
 *
 * Tiering guidance:
 * - flash_lite: cheap, fast text-only tasks that do not need reasoning (classify, caption,
 *   simple map, text verify, polish).
 * - flash: vision, structured JSON with many fields, multi-step reasoning, safety-critical
 *   validation (receipts, IDs, booking summaries, templates, dashboard assistant).
 * - live: native audio (voice receptionist).
 */

export const AI_FEATURES = [
  'receipt_validation',
  'inbox_suggest',
  'inbox_auto_reply',
  'marketing_caption',
  'marketing_template',
  'import_column_map',
  'voice_polish',
  'ai_integration_verify',
  'booking_ai_summary_guests',
  'booking_ai_summary_pets',
  'booking_ai_summary_pricing',
  'voice_receptionist',
  'dashboard_assistant',
  'smart_pricing',
  'host_analytics',
  'marketing_image_generate',
  'marketing_video_generate',
] as const;

export type AiFeature = (typeof AI_FEATURES)[number];

export type AiModelTier = 'flash_lite' | 'flash' | 'live';

export type AiModelConfig = {
  model: string;
  tier: AiModelTier;
  /** USD per 1M input tokens (text/image; audio uses separate rates for Live). */
  inputUsdPer1M: number;
  /** USD per 1M output tokens. */
  outputUsdPer1M: number;
  /** Default max output tokens for this feature. */
  defaultMaxOutputTokens: number;
  /** Whether thinking tokens should be budgeted for this task. */
  thinkingBudget: number;
};

/** Authoritative feature → model map. */
const FEATURE_MODELS: Record<AiFeature, AiModelConfig> = {
  receipt_validation: {
    model: 'gemini-2.5-flash',
    tier: 'flash',
    inputUsdPer1M: 0.3,
    outputUsdPer1M: 2.5,
    defaultMaxOutputTokens: 512,
    thinkingBudget: 0,
  },
  inbox_suggest: {
    model: 'gemini-3.1-flash-lite',
    tier: 'flash_lite',
    inputUsdPer1M: 0.25,
    outputUsdPer1M: 1.5,
    defaultMaxOutputTokens: 256,
    thinkingBudget: 0,
  },
  inbox_auto_reply: {
    model: 'gemini-3.1-flash-lite',
    tier: 'flash_lite',
    inputUsdPer1M: 0.25,
    outputUsdPer1M: 1.5,
    defaultMaxOutputTokens: 256,
    thinkingBudget: 0,
  },
  marketing_caption: {
    model: 'gemini-3.1-flash-lite',
    tier: 'flash_lite',
    inputUsdPer1M: 0.25,
    outputUsdPer1M: 1.5,
    defaultMaxOutputTokens: 256,
    thinkingBudget: 0,
  },
  marketing_template: {
    model: 'gemini-2.5-flash',
    tier: 'flash',
    inputUsdPer1M: 0.3,
    outputUsdPer1M: 2.5,
    defaultMaxOutputTokens: 1024,
    thinkingBudget: 0,
  },
  import_column_map: {
    model: 'gemini-3.1-flash-lite',
    tier: 'flash_lite',
    inputUsdPer1M: 0.25,
    outputUsdPer1M: 1.5,
    defaultMaxOutputTokens: 1024,
    thinkingBudget: 0,
  },
  voice_polish: {
    model: 'gemini-3.1-flash-lite',
    tier: 'flash_lite',
    inputUsdPer1M: 0.25,
    outputUsdPer1M: 1.5,
    defaultMaxOutputTokens: 512,
    thinkingBudget: 0,
  },
  ai_integration_verify: {
    model: 'gemini-3.1-flash-lite',
    tier: 'flash_lite',
    inputUsdPer1M: 0.25,
    outputUsdPer1M: 1.5,
    defaultMaxOutputTokens: 16,
    thinkingBudget: 0,
  },
  booking_ai_summary_guests: {
    model: 'gemini-2.5-flash',
    tier: 'flash',
    inputUsdPer1M: 0.3,
    outputUsdPer1M: 2.5,
    defaultMaxOutputTokens: 512,
    thinkingBudget: 0,
  },
  booking_ai_summary_pets: {
    model: 'gemini-2.5-flash',
    tier: 'flash',
    inputUsdPer1M: 0.3,
    outputUsdPer1M: 2.5,
    defaultMaxOutputTokens: 512,
    thinkingBudget: 0,
  },
  booking_ai_summary_pricing: {
    model: 'gemini-2.5-flash',
    tier: 'flash',
    inputUsdPer1M: 0.3,
    outputUsdPer1M: 2.5,
    defaultMaxOutputTokens: 512,
    thinkingBudget: 0,
  },
  voice_receptionist: {
    model: 'gemini-2.5-flash-native-audio-preview-12-2025',
    tier: 'live',
    inputUsdPer1M: 0.3,
    outputUsdPer1M: 2.5,
    defaultMaxOutputTokens: 1024,
    thinkingBudget: 0,
  },
  dashboard_assistant: {
    model: 'gemini-2.5-flash',
    tier: 'flash',
    inputUsdPer1M: 0.3,
    outputUsdPer1M: 2.5,
    defaultMaxOutputTokens: 2048,
    thinkingBudget: 0,
  },
  smart_pricing: {
    model: 'gemini-2.5-flash',
    tier: 'flash',
    inputUsdPer1M: 0.3,
    outputUsdPer1M: 2.5,
    defaultMaxOutputTokens: 768,
    thinkingBudget: 0,
  },
  host_analytics: {
    model: 'gemini-2.5-flash',
    tier: 'flash',
    inputUsdPer1M: 0.3,
    outputUsdPer1M: 2.5,
    defaultMaxOutputTokens: 1024,
    thinkingBudget: 0,
  },
  // Media generation is priced from MARKETING_IMAGE_MODELS / MARKETING_VIDEO_MODELS
  // below, not from these rows. They exist so getModelConfig() and the kill-switch
  // allowlist resolve for every AiFeature; callers always pass an explicit
  // estimatedCostUsd to recordAiUsage.
  marketing_image_generate: {
    model: 'gemini-3.1-flash-image',
    tier: 'flash',
    inputUsdPer1M: 0.5,
    outputUsdPer1M: 60,
    defaultMaxOutputTokens: 8192,
    thinkingBudget: 0,
  },
  marketing_video_generate: {
    model: 'veo-3.1-fast-generate-preview',
    tier: 'flash',
    inputUsdPer1M: 0,
    outputUsdPer1M: 0,
    defaultMaxOutputTokens: 0,
    thinkingBudget: 0,
  },
};

/**
 * Optional local/dev override: `GEMINI_MODEL_OVERRIDE_<FEATURE>` (e.g.
 * `GEMINI_MODEL_OVERRIDE_DASHBOARD_ASSISTANT=gemini-3.5-flash-lite`) or a global
 * `GEMINI_MODEL_OVERRIDE`. Used when free-tier quota is exhausted on the default model.
 * Does not change pricing metadata — only the model id sent to Gemini.
 */
export function getModelConfig(feature: AiFeature): AiModelConfig {
  const base = FEATURE_MODELS[feature];
  const featureKey = `GEMINI_MODEL_OVERRIDE_${feature.toUpperCase()}`;
  const override =
    (typeof Deno !== 'undefined' ? Deno.env.get(featureKey) : undefined)?.trim() ||
    (typeof Deno !== 'undefined' ? Deno.env.get('GEMINI_MODEL_OVERRIDE') : undefined)?.trim();
  if (!override) return base;
  return { ...base, model: override };
}

export function geminiGenerateContentUrl(model: string): string {
  return `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
}

export function estimateTokenCostUsd(
  config: AiModelConfig,
  inputTokens: number,
  outputTokens: number
): number {
  const input = (inputTokens / 1_000_000) * config.inputUsdPer1M;
  const output = (outputTokens / 1_000_000) * config.outputUsdPer1M;
  return Math.round((input + output) * 1_000_000) / 1_000_000;
}

export function isValidAiFeature(value: string): value is AiFeature {
  return (AI_FEATURES as readonly string[]).includes(value);
}

/* ── Marketing Studio media generation ──────────────────────────────────────
 *
 * Model ids and prices for the Generate tab live here, next to every other
 * model fact, rather than in ai_platform_global_settings: there are 3 tiers x
 * 2 resolutions of Veo pricing, which a single settings column cannot express
 * (voice_receptionist_cost_per_minute_usd works because voice has one scalar).
 *
 * Swapping a provider means rewriting one generation module plus one of these
 * tables. Prices are USD, verified against Google's published rates.
 */

export type MarketingGenerationTier = 'draft' | 'standard' | 'premium';

export type AiImageModelConfig = AiModelConfig & {
  /** Total reference images the model accepts in one request. */
  maxReferenceImages: number;
  allowedSizes: readonly string[];
  allowedAspectRatios: readonly string[];
};

export type AiVideoModelConfig = {
  model: string;
  usdPerSecondByResolution: Record<'720p' | '1080p', number>;
  maxReferenceImages: number;
  allowedDurations: readonly number[];
  allowedAspectRatios: readonly string[];
  allowedResolutions: readonly string[];
};

const IMAGE_ASPECT_RATIOS = [
  '1:1',
  '3:2',
  '2:3',
  '3:4',
  '4:3',
  '4:5',
  '5:4',
  '9:16',
  '16:9',
  '21:9',
] as const;

export const MARKETING_IMAGE_MODELS: Record<MarketingGenerationTier, AiImageModelConfig> = {
  draft: {
    model: 'gemini-3.1-flash-lite-image',
    tier: 'flash_lite',
    inputUsdPer1M: 0.25,
    outputUsdPer1M: 30,
    defaultMaxOutputTokens: 8192,
    thinkingBudget: 0,
    maxReferenceImages: 14,
    allowedSizes: ['1K'],
    allowedAspectRatios: IMAGE_ASPECT_RATIOS,
  },
  standard: {
    model: 'gemini-3.1-flash-image',
    tier: 'flash',
    inputUsdPer1M: 0.5,
    outputUsdPer1M: 60,
    defaultMaxOutputTokens: 8192,
    thinkingBudget: 0,
    maxReferenceImages: 10,
    allowedSizes: ['512px', '1K', '2K', '4K'],
    allowedAspectRatios: IMAGE_ASPECT_RATIOS,
  },
  premium: {
    model: 'gemini-3-pro-image',
    tier: 'flash',
    inputUsdPer1M: 2,
    outputUsdPer1M: 120,
    defaultMaxOutputTokens: 8192,
    thinkingBudget: 0,
    maxReferenceImages: 6,
    allowedSizes: ['512px', '1K', '2K', '4K'],
    allowedAspectRatios: IMAGE_ASPECT_RATIOS,
  },
};

export const MARKETING_VIDEO_MODELS: Record<MarketingGenerationTier, AiVideoModelConfig> = {
  draft: {
    model: 'veo-3.1-lite-generate-preview',
    usdPerSecondByResolution: { '720p': 0.05, '1080p': 0.08 },
    maxReferenceImages: 3,
    allowedDurations: [6, 8],
    allowedAspectRatios: ['16:9', '9:16'],
    allowedResolutions: ['720p', '1080p'],
  },
  standard: {
    model: 'veo-3.1-fast-generate-preview',
    usdPerSecondByResolution: { '720p': 0.1, '1080p': 0.3 },
    maxReferenceImages: 3,
    allowedDurations: [6, 8],
    allowedAspectRatios: ['16:9', '9:16'],
    allowedResolutions: ['720p', '1080p'],
  },
  premium: {
    model: 'veo-3.1-generate-preview',
    usdPerSecondByResolution: { '720p': 0.4, '1080p': 0.6 },
    maxReferenceImages: 3,
    allowedDurations: [6, 8],
    allowedAspectRatios: ['16:9', '9:16'],
    allowedResolutions: ['720p', '1080p'],
  },
};

export function getMarketingImageModel(tier: MarketingGenerationTier): AiImageModelConfig {
  const base = MARKETING_IMAGE_MODELS[tier];
  const override = (
    typeof Deno !== 'undefined'
      ? Deno.env.get(`GEMINI_MODEL_OVERRIDE_MARKETING_IMAGE_${tier.toUpperCase()}`)
      : undefined
  )?.trim();
  return override ? { ...base, model: override } : base;
}

export function getMarketingVideoModel(tier: MarketingGenerationTier): AiVideoModelConfig {
  const base = MARKETING_VIDEO_MODELS[tier];
  const override = (
    typeof Deno !== 'undefined'
      ? Deno.env.get(`GEMINI_MODEL_OVERRIDE_MARKETING_VIDEO_${tier.toUpperCase()}`)
      : undefined
  )?.trim();
  return override ? { ...base, model: override } : base;
}

/** Veo long-running generation submit endpoint. */
export function geminiPredictLongRunningUrl(model: string): string {
  return `https://generativelanguage.googleapis.com/v1beta/models/${model}:predictLongRunning`;
}

/** Poll endpoint for a long-running operation name returned by :predictLongRunning. */
export function geminiOperationUrl(operationName: string): string {
  const trimmed = operationName.replace(/^\/+/, '');
  return `https://generativelanguage.googleapis.com/v1beta/${trimmed}`;
}

export function estimateVideoCostUsd(
  config: AiVideoModelConfig,
  resolution: '720p' | '1080p',
  durationSeconds: number
): number {
  const perSecond = config.usdPerSecondByResolution[resolution];
  return Math.round(perSecond * durationSeconds * 1_000_000) / 1_000_000;
}
