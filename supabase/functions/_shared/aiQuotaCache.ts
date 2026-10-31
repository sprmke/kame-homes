/**
 * Deterministic short-term cache for AI responses.
 * Keyed by feature + SHA-256 fingerprint of the canonical prompt/system/inputs.
 * Entries expire after 1 hour: reads ignore expired rows and the ai-retention cron purges them.
 */

import { createClient } from './supabaseJs.ts';

import type { AiFeature } from './aiModelRouter.ts';

export type AiCacheEntry = {
  provider: 'gemini' | 'groq';
  model: string;
  responseText: string;
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd: number;
};

/**
 * Deterministic JSON with keys sorted at every depth. (A replacer *array* would filter nested
 * keys to the top-level key set and silently drop them, so different prompts could collide.)
 */
export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`);
  return `{${entries.join(',')}}`;
}

export async function computePromptFingerprint(inputs: unknown): Promise<string> {
  const canonical = stableStringify(inputs);
  const encoder = new TextEncoder();
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(canonical));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function db() {
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) throw new Error('Supabase env not configured');
  return createClient(url, key);
}

export async function getCachedAiResponse(
  feature: AiFeature,
  fingerprint: string
): Promise<AiCacheEntry | null> {
  const sb = db();
  const { data, error } = await sb
    .from('ai_platform_response_cache')
    .select('provider, model, response_text, input_tokens, output_tokens, estimated_cost_usd')
    .eq('feature', feature)
    .eq('fingerprint', fingerprint)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle();
  if (error) {
    console.warn('[aiQuotaCache] get cache failed:', error.message);
    return null;
  }
  if (!data) return null;
  return {
    provider: data.provider as 'gemini' | 'groq',
    model: data.model as string,
    responseText: data.response_text as string,
    inputTokens: Number(data.input_tokens ?? 0),
    outputTokens: Number(data.output_tokens ?? 0),
    estimatedCostUsd: Number(data.estimated_cost_usd ?? 0),
  };
}

export async function setCachedAiResponse(
  feature: AiFeature,
  fingerprint: string,
  entry: AiCacheEntry,
  ttlMinutes = 60
): Promise<void> {
  const sb = db();
  const expiresAt = new Date(Date.now() + ttlMinutes * 60_000).toISOString();
  const { error } = await sb.from('ai_platform_response_cache').upsert(
    {
      feature,
      fingerprint,
      provider: entry.provider,
      model: entry.model,
      response_text: entry.responseText,
      input_tokens: entry.inputTokens,
      output_tokens: entry.outputTokens,
      estimated_cost_usd: entry.estimatedCostUsd,
      expires_at: expiresAt,
    },
    { onConflict: 'feature, fingerprint' }
  );
  if (error) {
    console.warn('[aiQuotaCache] set cache failed:', error.message);
  }
}

/** Build a cache key from the parts that are deterministic for a given AI request. */
export function buildCacheInputs(
  systemPrompt: string,
  userPrompt: string,
  extras?: Record<string, unknown>
): unknown {
  return {
    system: systemPrompt,
    user: userPrompt,
    ...extras,
  };
}
