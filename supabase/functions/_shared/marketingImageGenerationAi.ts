/**
 * Gemini image generation for the Marketing Studio Generate tab.
 *
 * Uses the classic `models/{model}:generateContent` envelope through the shared AI transport
 * (_shared/ai/llmTransport.ts: per-attempt timeout, one same-key retry on 429/5xx, key rotation,
 * key in header). `extractGeminiUsage` parses its `usageMetadata`, so token metering works
 * verbatim through the existing pipeline.
 *
 * Swapping providers means rewriting this one file plus MARKETING_IMAGE_MODELS in
 * aiModelRouter.ts. Nothing else imports a model id or a price.
 */

import type { SupabaseClient } from './supabaseJs.ts';

import { AiProviderError, geminiModelPath, geminiRequest, isGeminiConfigured } from './ai/llmTransport.ts';
import { type AiImageModelConfig, estimateTokenCostUsd } from './aiModelRouter.ts';
import { extractGeminiUsage } from './aiGeminiKeys.ts';
import { PROPERTY_MEDIA_BUCKET } from './propertyMedia.ts';
import { readImageDimensions } from './marketingGenerationStorage.ts';
import { IMAGE_SYSTEM_INSTRUCTION } from './marketingImagePromptBuilder.ts';

/** Google's own wording for a safety stop, surfaced to the host as rephrase-and-retry. */
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

/** Phase 4b — the provider returned 200 with bytes that don't look like a valid
 *  image (too small, unreadable dimensions, or wildly wrong shape). Thrown before
 *  upload/billing so the job fails and the reservation is freed instead of storing
 *  and charging for garbage. See isDegenerateGeneratedImage. */
export class GenerationOutputError extends Error {
  readonly code = 'invalid_output';

  constructor(message: string) {
    super(message);
    this.name = 'GenerationOutputError';
  }
}

export function isGenerationSafetyError(error: unknown): error is GenerationSafetyError {
  return error instanceof GenerationSafetyError;
}

export type GeneratedImage = {
  bytes: Uint8Array;
  mimeType: string;
  width: number | null;
  height: number | null;
  inputTokens: number;
  outputTokens: number;
  model: string;
  estimatedCostUsd: number;
};

export type ReferenceInlineData = { mimeType: string; data: string };

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** Pull reference objects out of the public bucket and inline them for the model. */
export async function loadReferenceInlineData(
  sb: SupabaseClient,
  references: Array<{ storage_path: string; mime_type: string }>
): Promise<ReferenceInlineData[]> {
  // Independent reads (up to 14) — fetch concurrently instead of one round trip at a time.
  return Promise.all(
    references.map(async (reference) => {
      const { data, error } = await sb.storage
        .from(PROPERTY_MEDIA_BUCKET)
        .download(reference.storage_path);
      if (error || !data) {
        throw new Error('One of the reference files could not be read. Remove it and try again.');
      }
      const bytes = new Uint8Array(await data.arrayBuffer());
      return { mimeType: reference.mime_type, data: bytesToBase64(bytes) };
    })
  );
}

/**
 * Gemini's image endpoint has no dedicated negative-prompt channel. Appending
 * "Avoid: X" as prose to a diffusion-style model can paradoxically make it more
 * likely to render X, since the concept is still present in the input. Folding it
 * into the system instruction as a direct, positive-voiced instruction (closer to
 * "never do X" than "please avoid X") is Gemini 3's own preference — direct beats
 * persuasive — and keeps it out of the user-content prompt entirely.
 */
function buildSystemInstruction(negativePrompt?: string | null): string {
  const negative = negativePrompt?.trim();
  if (!negative) return IMAGE_SYSTEM_INSTRUCTION;
  return `${IMAGE_SYSTEM_INSTRUCTION} Additionally, this image must not contain: ${negative}.`;
}

/** Caps a single provider attempt so one hung request can't hold the job open (Phase 4c). A
 *  timed-out key is treated like any other failed attempt and rotation proceeds. The transport
 *  also gives each key one same-key retry on 429/5xx before rotating (Phase 4a). */
const PROVIDER_TIMEOUT_MS = 45_000;

export type GenerateMarketingImageInput = {
  config: AiImageModelConfig;
  prompt: string;
  negativePrompt?: string | null;
  aspectRatio: string;
  imageSize: string;
  references: ReferenceInlineData[];
};

export async function generateMarketingImage(
  input: GenerateMarketingImageInput
): Promise<GeneratedImage> {
  if (!isGeminiConfigured()) {
    throw new GenerationProviderError('Image generation is not configured');
  }

  const body = {
    systemInstruction: { parts: [{ text: buildSystemInstruction(input.negativePrompt) }] },
    contents: [
      {
        role: 'user',
        parts: [
          { text: input.prompt.trim() },
          ...input.references.map((reference) => ({ inlineData: reference })),
        ],
      },
    ],
    generationConfig: {
      responseModalities: ['IMAGE'],
      imageConfig: {
        aspectRatio: input.aspectRatio,
        imageSize: input.imageSize,
      },
    },
  };

  let raw: Record<string, unknown>;
  try {
    raw = await geminiRequest(geminiModelPath(input.config.model, 'generateContent'), body, {
      timeoutMs: PROVIDER_TIMEOUT_MS,
    });
  } catch (err) {
    if (err instanceof AiProviderError) {
      throw new GenerationProviderError(
        err.code === 'timeout' ? 'Image generation timed out' : err.message
      );
    }
    throw err;
  }

  const json = raw as {
    candidates?: Array<{
      finishReason?: string;
      content?: { parts?: Array<{ inlineData?: { mimeType?: string; data?: string } }> };
    }>;
    promptFeedback?: { blockReason?: string };
  };
  if (json.promptFeedback?.blockReason) {
    throw new GenerationSafetyError();
  }

  const candidate = json.candidates?.[0];
  const finishReason = candidate?.finishReason ?? '';
  if (
    finishReason === 'SAFETY' ||
    finishReason === 'PROHIBITED_CONTENT' ||
    finishReason === 'IMAGE_SAFETY'
  ) {
    throw new GenerationSafetyError();
  }

  const imagePart = candidate?.content?.parts?.find((part) => part.inlineData?.data);
  if (!imagePart?.inlineData?.data) {
    throw new GenerationProviderError('The model did not return an image. Try rephrasing.');
  }

  const bytes = base64ToBytes(imagePart.inlineData.data);
  const dimensions = readImageDimensions(bytes);
  const { inputTokens, outputTokens } = extractGeminiUsage(json);

  return {
    bytes,
    mimeType: imagePart.inlineData.mimeType ?? 'image/png',
    width: dimensions?.width ?? null,
    height: dimensions?.height ?? null,
    inputTokens,
    outputTokens,
    model: input.config.model,
    estimatedCostUsd: estimateTokenCostUsd(input.config, inputTokens, outputTokens),
  };
}
