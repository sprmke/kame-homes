/**
 * AI provider health probe (settings pages, receipt-validation status, health checks).
 * One tiny unbilled call through the gateway, memoized per isolate so page loads never
 * trigger a model call each time. Errors are host-facing text, never provider dumps.
 */

import { toHostFacingError } from '../hostFacingError.ts';
import { generateText } from './llmClient.ts';
import { isGeminiConfigured, isGroqConfigured } from './llmTransport.ts';
import { definePrompt } from './prompt.ts';

export type AiProviderHealth = {
  available: boolean;
  geminiConfigured: boolean;
  groqConfigured: boolean;
  latencyMs: number | null;
  error: string | null;
};

const PROBE_PROMPT = definePrompt({ id: 'provider_probe', version: '2026-09-24.1' });
const MEMO_TTL_MS = 5 * 60_000;

let memo: { at: number; value: AiProviderHealth } | null = null;

export async function probeAiProviders(
  options: { force?: boolean } = {}
): Promise<AiProviderHealth> {
  if (!options.force && memo && Date.now() - memo.at < MEMO_TTL_MS) return memo.value;

  const geminiConfigured = isGeminiConfigured();
  const groqConfigured = isGroqConfigured();
  let value: AiProviderHealth;

  if (!geminiConfigured && !groqConfigured) {
    value = {
      available: false,
      geminiConfigured,
      groqConfigured,
      latencyMs: null,
      error: 'AI is not configured',
    };
  } else {
    try {
      const result = await generateText({
        feature: 'ai_integration_verify',
        prompt: PROBE_PROMPT,
        system: '',
        user: 'Reply with exactly: ok',
        temperature: 0,
        maxOutputTokens: 8,
        billing: { organizationId: null, mode: 'none' },
      });
      value = {
        available: true,
        geminiConfigured,
        groqConfigured,
        latencyMs: result.latencyMs,
        error: null,
      };
    } catch (err) {
      value = {
        available: false,
        geminiConfigured,
        groqConfigured,
        latencyMs: null,
        error: toHostFacingError(err, 'AI is unavailable right now'),
      };
    }
  }

  memo = { at: Date.now(), value };
  return value;
}
