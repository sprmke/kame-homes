/**
 * Short Gemini TTS preview for admin voice picker (same prebuilt voices as Live).
 * Returns raw PCM base64 — clients wrap as WAV for playback.
 */

import {
  AiProviderError,
  geminiModelPath,
  geminiRequest,
  isGeminiConfigured,
} from './ai/llmTransport.ts';
import { GEMINI_TTS_PREVIEW_MODELS } from './aiModelRouter.ts';
import { GEMINI_LIVE_VOICES, type GeminiLiveVoice } from './geminiLiveEphemeral.ts';
import { PROPERTY_GUEST_NAME_FALLBACK } from './propertyGuestName.ts';

const TTS_TIMEOUT_MS = 15_000;

/** Sample line for admin voice picker — uses Basic Information property name when provided. */
export function voicePreviewLine(propertyName?: string | null): string {
  const name = propertyName?.trim() || PROPERTY_GUEST_NAME_FALLBACK;
  return `Hi, I'm the ${name} receptionist. How can I help with your stay today?`;
}

export const GEMINI_LIVE_VOICE_LABELS: Record<GeminiLiveVoice, string> = {
  Puck: 'Puck — Upbeat',
  Charon: 'Charon — Informative',
  Kore: 'Kore — Firm',
  Fenrir: 'Fenrir — Excitable',
  Aoede: 'Aoede — Breezy',
};

export type VoicePreviewResult = {
  voiceId: GeminiLiveVoice;
  text: string;
  mimeType: string;
  sampleRateHz: number;
  audioBase64: string;
};

function parseSampleRate(mimeType: string): number {
  const match = /rate=(\d+)/i.exec(mimeType);
  if (match?.[1]) {
    const rate = Number(match[1]);
    if (Number.isFinite(rate) && rate > 0) return rate;
  }
  return 24_000;
}

export async function previewGeminiLiveVoice(
  voiceIdRaw: string,
  propertyName?: string | null
): Promise<VoicePreviewResult> {
  const voiceId = voiceIdRaw.trim() as GeminiLiveVoice;
  if (!GEMINI_LIVE_VOICES.includes(voiceId)) {
    throw new Error(`voiceId must be one of: ${GEMINI_LIVE_VOICES.join(', ')}`);
  }

  const previewLine = voicePreviewLine(propertyName);

  if (!isGeminiConfigured()) {
    throw new Error('GEMINI_API_KEYS or GEMINI_API_KEY not set');
  }

  // Try each TTS model in turn (preview models come and go); keys rotate inside the transport.
  let lastError = 'voice preview unavailable';
  for (const model of GEMINI_TTS_PREVIEW_MODELS) {
    try {
      const json = (await geminiRequest(
        geminiModelPath(model, 'generateContent'),
        {
          contents: [{ parts: [{ text: `Say warmly: ${previewLine}` }] }],
          generationConfig: {
            responseModalities: ['AUDIO'],
            speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voiceId } } },
          },
        },
        { timeoutMs: TTS_TIMEOUT_MS }
      )) as {
        candidates?: Array<{
          content?: { parts?: Array<{ inlineData?: { mimeType?: string; data?: string } }> };
        }>;
      };
      const inline = json.candidates?.[0]?.content?.parts?.[0]?.inlineData;
      const audioBase64 = inline?.data?.trim();
      if (!audioBase64) {
        lastError = 'empty audio candidate';
        continue;
      }
      const mimeType = inline?.mimeType?.trim() || 'audio/L16;rate=24000';
      return {
        voiceId,
        text: previewLine,
        mimeType,
        sampleRateHz: parseSampleRate(mimeType),
        audioBase64,
      };
    } catch (err) {
      if (!(err instanceof AiProviderError) || err.code === 'aborted') throw err;
      lastError = err.message;
    }
  }

  throw new Error(lastError);
}
