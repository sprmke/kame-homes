/**
 * Gemini image generation for the Marketing Studio Generate tab.
 *
 * Deliberately uses the classic `models/{model}:generateContent` envelope rather than
 * the newer `/v1beta/interactions`: `geminiGenerateContentUrl` already builds that URL
 * and `extractGeminiUsage` already parses its `usageMetadata`, so token metering works
 * verbatim through the existing pipeline.
 *
 * Swapping providers means rewriting this one file plus MARKETING_IMAGE_MODELS in
 * aiModelRouter.ts. Nothing else imports a model id or a price.
 */

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

import {
  type AiImageModelConfig,
  estimateTokenCostUsd,
  geminiGenerateContentUrl,
} from './aiModelRouter.ts';
import {
  extractGeminiUsage,
  getGeminiApiKeys,
  nextGeminiKeyStartIndex,
  providerError,
  shouldTryNextProvider,
} from './aiGeminiKeys.ts';
import { PROPERTY_MEDIA_BUCKET } from './propertyMedia.ts';
import { readImageDimensions } from './marketingGenerationStorage.ts';

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

function buildPromptText(prompt: string, negativePrompt?: string | null): string {
  const trimmed = prompt.trim();
  const negative = negativePrompt?.trim();
  if (!negative) return trimmed;
  return `${trimmed}\n\nAvoid: ${negative}`;
}

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
  const keys = getGeminiApiKeys();
  if (keys.length === 0) {
    throw new GenerationProviderError('Image generation is not configured');
  }

  const body = {
    contents: [
      {
        role: 'user',
        parts: [
          { text: buildPromptText(input.prompt, input.negativePrompt) },
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

  const url = geminiGenerateContentUrl(input.config.model);
  const start = nextGeminiKeyStartIndex(keys.length);
  let lastError = 'Image generation failed';

  for (let attempt = 0; attempt < keys.length; attempt += 1) {
    const key = keys[(start + attempt) % keys.length]!;
    const res = await fetch(`${url}?key=${encodeURIComponent(key)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      let parsed: unknown = null;
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = null;
      }
      lastError = providerError(parsed, `Image generation failed (${res.status})`);
      if (shouldTryNextProvider(res.status) && attempt < keys.length - 1) continue;
      throw new GenerationProviderError(lastError);
    }

    const json = (await res.json()) as {
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

  throw new GenerationProviderError(lastError);
}
