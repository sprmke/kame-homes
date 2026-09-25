/**
 * Gemini/Groq key loading + provider response parsing, used only by the AI gateway
 * (_shared/ai/llmTransport.ts, llmClient.ts, llmTools.ts). Feature code never reads keys.
 *
 * Production: one paid GEMINI_API_KEY on the billing project (see docs/archive/operations/ai-platform-billing.md).
 * Local/dev: comma-separated GEMINI_API_KEYS from different projects is still supported for free-tier rotation.
 */

export function getGeminiApiKeys(): string[] {
  const multi = Deno.env.get('GEMINI_API_KEYS')?.trim();
  if (multi) {
    return multi
      .split(',')
      .map((k) => k.trim())
      .filter(Boolean);
  }
  const single = Deno.env.get('GEMINI_API_KEY')?.trim();
  return single ? [single] : [];
}

export function getGroqApiKey(): string | null {
  return Deno.env.get('GROQ_API_KEY')?.trim() || null;
}

export function extractGeminiUsage(json: unknown): {
  inputTokens: number;
  outputTokens: number;
} {
  const meta = (json as { usageMetadata?: Record<string, number> }).usageMetadata ?? {};
  const inputTokens = Number(meta.promptTokenCount ?? meta.prompt_token_count ?? 0) || 0;
  const outputTokens =
    Number(meta.candidatesTokenCount ?? meta.candidates_token_count ?? 0) ||
    Number(meta.totalTokenCount ?? 0) - inputTokens ||
    0;
  return { inputTokens: Math.max(0, inputTokens), outputTokens: Math.max(0, outputTokens) };
}

export function extractGeminiText(json: unknown): string | null {
  const parts =
    (
      json as {
        candidates?: Array<{
          content?: { parts?: Array<{ text?: string; thought?: boolean }> };
        }>;
      }
    ).candidates?.[0]?.content?.parts ?? [];
  const text = parts
    .filter((p) => !p.thought)
    .map((p) => p.text ?? '')
    .join('')
    .trim();
  return text || null;
}

export function providerError(json: unknown, fallback: string): string {
  const err = json as { error?: { message?: string } };
  const message = err.error?.message?.trim();
  return message || fallback;
}
