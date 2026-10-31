/**
 * AI gateway — the single entry point for text / vision / JSON model calls.
 *
 *   caller (feature service) → llmClient → llmTransport → provider
 *
 * One call here does, in order: quota gate → response cache → Gemini (router model, per-feature
 * timeout, retries, key rotation) → optional Groq fallback → schema validation (+ one repair
 * retry) → usage + credits metering with trace fields (prompt id/version, latency, fallback,
 * status) → one structured log line without prompt or response bodies.
 *
 * Feature services own their prompts (versioned PromptRef), grounding and business rules; they
 * never build provider requests themselves. See docs/architecture/ai-platform.md.
 */

import { z } from 'zod';

import { extractGeminiText, extractGeminiUsage } from '../aiGeminiKeys.ts';
import {
  estimateTokenCostUsd,
  getModelConfig,
  GROQ_FALLBACK_MODEL,
  type AiFeature,
} from '../aiModelRouter.ts';
import {
  computePromptFingerprint,
  getCachedAiResponse,
  setCachedAiResponse,
} from '../aiQuotaCache.ts';
import {
  assertOrgAndPropertyAiQuota,
  recordAiFailure,
  recordAiUsage,
  recordAiUsagePlatformOnly,
  type AiActorType,
  type AiCallTrace,
} from '../aiUsageService.ts';
import { logEvent } from '../requestLog.ts';
import {
  AiProviderError,
  geminiModelPath,
  geminiRequest,
  groqChatCompletion,
  isGeminiConfigured,
  isGroqConfigured,
  type AiProvider,
} from './llmTransport.ts';
import type { PromptRef } from './prompt.ts';

export { AiProviderError } from './llmTransport.ts';

export type LlmPart = { text: string } | { inlineData: { mimeType: string; data: string } };

export type LlmBilling = {
  /** Null = no org context (usage is not recorded, quota is not checked). */
  organizationId: string | null | undefined;
  propertyId?: string | null;
  actorUserId?: string | null;
  actorType?: AiActorType;
  /**
   * credits (default): host-billed against org/property allowances.
   * platform: recorded as platform cost only (never reaches a host's balance).
   * none: not recorded (health probes).
   */
  mode?: 'credits' | 'platform' | 'none';
  /** The caller already ran assertOrgAndPropertyAiQuota (e.g. before building costly context). */
  quotaChecked?: boolean;
};

export type LlmRequest = {
  feature: AiFeature;
  prompt: PromptRef;
  system: string;
  user: string | LlmPart[];
  billing: LlmBilling;
  temperature?: number;
  maxOutputTokens?: number;
  /** Explicit model (e.g. tier-specific); defaults to the router's model for `feature`. */
  model?: string;
  timeoutMs?: number;
  /** Attempts per key for transient failures (default 2). Use 1 on latency-critical, fail-open paths. */
  attemptsPerKey?: number;
  signal?: AbortSignal;
  /** Overrides the router's per-feature Groq fallback flag. */
  groqFallback?: boolean;
  /** Short-term response cache (aiQuotaCache). `shouldStore` lets callers cache only accepted output. */
  cache?: { extras?: Record<string, unknown>; shouldStore?: (text: string) => boolean };
  /** Gemini responseSchema (OpenAPI subset). Switches both providers to JSON mode. */
  jsonSchema?: Record<string, unknown>;
  requestId?: string;
};

/** What metering / logging needs to know about a call (text, JSON or tool calling). */
export type AiCallContext = Pick<LlmRequest, 'feature' | 'billing' | 'model'>;

export type LlmTextResult = {
  text: string;
  provider: AiProvider;
  model: string;
  inputTokens: number;
  outputTokens: number;
  creditsConsumed: number;
  latencyMs: number;
  cacheHit: boolean;
  fallbackUsed: boolean;
};

export type LlmStructuredResult<T> = LlmTextResult & { data: T };

/** Model output failed JSON parsing or schema validation even after the repair retry. */
export class AiOutputValidationError extends Error {
  readonly issues: string[];
  constructor(message: string, issues: string[]) {
    super(message);
    this.name = 'AiOutputValidationError';
    this.issues = issues;
  }
}

const GROQ_VISION_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);

function toParts(user: string | LlmPart[]): LlmPart[] {
  return typeof user === 'string' ? [{ text: user }] : user;
}

function buildGeminiBody(req: LlmRequest, model: string, parts: LlmPart[]) {
  const config = getModelConfig(req.feature);
  const generationConfig: Record<string, unknown> = {
    temperature: req.temperature ?? 0.2,
    maxOutputTokens: req.maxOutputTokens ?? config.defaultMaxOutputTokens,
    thinkingConfig: { thinkingBudget: config.thinkingBudget },
  };
  if (req.jsonSchema) {
    generationConfig.responseMimeType = 'application/json';
    generationConfig.responseSchema = req.jsonSchema;
  }
  return {
    ...(req.system.trim() ? { systemInstruction: { parts: [{ text: req.system }] } } : {}),
    contents: [{ role: 'user', parts }],
    generationConfig,
  };
}

function buildGroqBody(req: LlmRequest, parts: LlmPart[]) {
  const config = getModelConfig(req.feature);
  const content = parts.map((part) =>
    'text' in part
      ? { type: 'text', text: part.text }
      : {
          type: 'image_url',
          image_url: { url: `data:${part.inlineData.mimeType};base64,${part.inlineData.data}` },
        }
  );
  const hasImages = parts.some((p) => 'inlineData' in p);
  return {
    model: GROQ_FALLBACK_MODEL.model,
    messages: [
      ...(req.system.trim() ? [{ role: 'system', content: req.system }] : []),
      {
        role: 'user',
        content: hasImages ? content : parts.map((p) => ('text' in p ? p.text : '')).join('\n'),
      },
    ],
    temperature: req.temperature ?? 0.2,
    max_tokens: req.maxOutputTokens ?? config.defaultMaxOutputTokens,
    ...(req.jsonSchema ? { response_format: { type: 'json_object' } } : {}),
  };
}

function canUseGroq(req: LlmRequest, parts: LlmPart[]): boolean {
  const enabled = req.groqFallback ?? getModelConfig(req.feature).groqFallback;
  if (!enabled || !isGroqConfigured()) return false;
  return parts.every((p) => 'text' in p || GROQ_VISION_MIME_TYPES.has(p.inlineData.mimeType));
}

type RawCompletion = {
  text: string;
  provider: AiProvider;
  model: string;
  inputTokens: number;
  outputTokens: number;
  fallbackUsed: boolean;
};

async function callProviders(req: LlmRequest, parts: LlmPart[]): Promise<RawCompletion> {
  const config = getModelConfig(req.feature);
  const model = req.model ?? config.model;
  const transport = {
    timeoutMs: req.timeoutMs ?? config.timeoutMs,
    signal: req.signal,
    attemptsPerKey: req.attemptsPerKey,
  };
  let geminiError: AiProviderError | null = null;

  if (isGeminiConfigured()) {
    try {
      const json = await geminiRequest(
        geminiModelPath(model, 'generateContent'),
        buildGeminiBody(req, model, parts),
        transport
      );
      const text = extractGeminiText(json);
      if (!text) throw new AiProviderError('gemini', 'empty_response', 'Gemini returned no text');
      const usage = extractGeminiUsage(json);
      return { text, provider: 'gemini', model, ...usage, fallbackUsed: false };
    } catch (err) {
      if (!(err instanceof AiProviderError) || err.code === 'aborted') throw err;
      geminiError = err;
    }
  }

  if (canUseGroq(req, parts)) {
    const json = await groqChatCompletion(buildGroqBody(req, parts), transport);
    const choices = json.choices as Array<{ message?: { content?: string } }> | undefined;
    const text = choices?.[0]?.message?.content?.trim();
    if (!text) throw new AiProviderError('groq', 'empty_response', 'Groq returned no text');
    const usage = json.usage as { prompt_tokens?: number; completion_tokens?: number } | undefined;
    return {
      text,
      provider: 'groq',
      model: GROQ_FALLBACK_MODEL.model,
      inputTokens: Number(usage?.prompt_tokens ?? 0),
      outputTokens: Number(usage?.completion_tokens ?? 0),
      fallbackUsed: geminiError !== null,
    };
  }

  throw (
    geminiError ??
    new AiProviderError('gemini', 'not_configured', 'No AI provider is configured (GEMINI_API_KEY)')
  );
}

function costUsd(
  raw: Pick<RawCompletion, 'provider' | 'inputTokens' | 'outputTokens'>,
  feature: AiFeature
): number {
  if (raw.provider === 'groq') {
    const input = (raw.inputTokens / 1_000_000) * GROQ_FALLBACK_MODEL.inputUsdPer1M;
    const output = (raw.outputTokens / 1_000_000) * GROQ_FALLBACK_MODEL.outputUsdPer1M;
    return Math.round((input + output) * 1_000_000) / 1_000_000;
  }
  return estimateTokenCostUsd(getModelConfig(feature), raw.inputTokens, raw.outputTokens);
}

/** @internal gateway helper (also used by llmTools.ts). */
export async function meter(
  req: AiCallContext,
  raw: Pick<RawCompletion, 'provider' | 'model' | 'inputTokens' | 'outputTokens'>,
  trace: AiCallTrace,
  cacheHit: boolean,
  cachedCostUsd?: number
): Promise<number> {
  const { organizationId, mode = 'credits' } = req.billing;
  if (!organizationId || mode === 'none') return 0;
  const usage = {
    organizationId,
    propertyId: req.billing.propertyId ?? null,
    feature: req.feature,
    provider: raw.provider,
    model: raw.model,
    inputTokens: raw.inputTokens,
    outputTokens: raw.outputTokens,
    estimatedCostUsd: cacheHit ? (cachedCostUsd ?? 0) : costUsd(raw, req.feature),
    cacheHit,
    actorUserId: req.billing.actorUserId ?? null,
    actorType: req.billing.actorType,
    trace,
  };
  if (mode === 'platform') {
    await recordAiUsagePlatformOnly(usage);
    return 0;
  }
  const { creditsConsumed } = await recordAiUsage(usage);
  return creditsConsumed;
}

/** @internal gateway helper (also used by llmTools.ts). */
export function logCall(
  req: AiCallContext,
  trace: AiCallTrace,
  outcome: {
    status: 'success' | 'error';
    provider?: AiProvider;
    model?: string;
    errorCode?: string;
    cacheHit?: boolean;
  }
) {
  logEvent(outcome.status === 'error' ? 'warn' : 'info', {
    fn: 'ai-gateway',
    requestId: trace.requestId ?? 'none',
    orgId: req.billing.organizationId ?? undefined,
    propertyId: req.billing.propertyId ?? undefined,
    event: `ai.${req.feature}.${outcome.status}`,
    durationMs: trace.latencyMs ?? undefined,
    meta: {
      promptId: trace.promptId,
      promptVersion: trace.promptVersion,
      provider: outcome.provider,
      model: outcome.model,
      fallbackUsed: trace.fallbackUsed ?? false,
      cacheHit: outcome.cacheHit ?? false,
      errorCode: outcome.errorCode,
    },
  });
}

/** Ops/eval switch: `AI_RESPONSE_CACHE_DISABLED=1` bypasses the response cache entirely. */
const responseCacheDisabled = () => Deno.env.get('AI_RESPONSE_CACHE_DISABLED') === '1';

function cacheKeyFor(req: LlmRequest, parts: LlmPart[]): Promise<string | null> {
  if (!req.cache || responseCacheDisabled()) return Promise.resolve(null);
  return computePromptFingerprint({
    prompt: `${req.prompt.id}@${req.prompt.version}`,
    model: req.model ?? getModelConfig(req.feature).model,
    system: req.system,
    parts,
    schema: req.jsonSchema ?? null,
    extras: req.cache.extras ?? null,
  }).catch(() => null);
}

/**
 * @internal gateway helper (also used by llmTools.ts). Logs + records a failed provider call
 * (zero cost, never counted against quotas); aborts are not recorded.
 */
export async function recordCallFailure(
  req: AiCallContext,
  trace: AiCallTrace,
  err: unknown
): Promise<void> {
  const errorCode = err instanceof AiProviderError ? err.code : 'unexpected';
  const provider = err instanceof AiProviderError ? err.provider : 'gemini';
  const { organizationId, mode = 'credits' } = req.billing;
  if (organizationId && mode !== 'none' && errorCode !== 'aborted') {
    await recordAiFailure({
      organizationId,
      propertyId: req.billing.propertyId ?? null,
      feature: req.feature,
      provider,
      model: req.model ?? getModelConfig(req.feature).model,
      errorCode,
      actorUserId: req.billing.actorUserId ?? null,
      actorType: req.billing.actorType,
      trace,
    });
  }
  logCall(req, trace, { status: 'error', provider, errorCode });
}

/** Text (or JSON-mode) completion through the gateway. */
export async function generateText(req: LlmRequest): Promise<LlmTextResult> {
  const parts = toParts(req.user);
  const started = Date.now();
  const trace: AiCallTrace = {
    promptId: req.prompt.id,
    promptVersion: req.prompt.version,
    requestId: req.requestId ?? crypto.randomUUID(),
  };
  const { organizationId, mode = 'credits' } = req.billing;

  if (organizationId && mode === 'credits' && !req.billing.quotaChecked) {
    await assertOrgAndPropertyAiQuota(organizationId, req.billing.propertyId ?? null, req.feature);
  }

  const cacheKey = await cacheKeyFor(req, parts);
  if (cacheKey) {
    // The response cache is an optimization, never a dependency: read failures fall through.
    const cached = await getCachedAiResponse(req.feature, cacheKey).catch(() => null);
    if (cached) {
      trace.latencyMs = Date.now() - started;
      const raw: RawCompletion = {
        text: cached.responseText,
        provider: cached.provider,
        model: cached.model,
        inputTokens: cached.inputTokens,
        outputTokens: cached.outputTokens,
        fallbackUsed: false,
      };
      const creditsConsumed = await meter(req, raw, trace, true, 0);
      logCall(req, trace, {
        status: 'success',
        provider: raw.provider,
        model: raw.model,
        cacheHit: true,
      });
      return { ...raw, creditsConsumed, latencyMs: trace.latencyMs, cacheHit: true };
    }
  }

  let raw: RawCompletion;
  try {
    raw = await callProviders(req, parts);
  } catch (err) {
    trace.latencyMs = Date.now() - started;
    await recordCallFailure(req, trace, err);
    throw err;
  }

  trace.latencyMs = Date.now() - started;
  trace.fallbackUsed = raw.fallbackUsed;
  const creditsConsumed = await meter(req, raw, trace, false);

  if (cacheKey && (req.cache?.shouldStore?.(raw.text) ?? true)) {
    await setCachedAiResponse(req.feature, cacheKey, {
      provider: raw.provider,
      model: raw.model,
      responseText: raw.text,
      inputTokens: raw.inputTokens,
      outputTokens: raw.outputTokens,
      estimatedCostUsd: 0,
    }).catch((err) => console.warn('[ai-gateway] cache write failed (non-fatal):', err?.message));
  }

  logCall(req, trace, { status: 'success', provider: raw.provider, model: raw.model });
  return { ...raw, creditsConsumed, latencyMs: trace.latencyMs, cacheHit: false };
}

/**
 * Tolerant JSON extraction: plain JSON, fenced ```json blocks, or the outermost {...}/[...] span.
 * Returns undefined when nothing parses.
 */
export function parseModelJson(text: string): unknown {
  const trimmed = text
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '');
  try {
    return JSON.parse(trimmed);
  } catch {
    /* fall through to span extraction */
  }
  for (const [open, close] of [
    ['{', '}'],
    ['[', ']'],
  ] as const) {
    const start = trimmed.indexOf(open);
    const end = trimmed.lastIndexOf(close);
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(trimmed.slice(start, end + 1));
      } catch {
        /* try next */
      }
    }
  }
  return undefined;
}

function describeIssues(error: z.ZodError): string[] {
  return error.issues.slice(0, 5).map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`);
}

/**
 * JSON-mode completion validated against a zod schema. On a parse/validation failure it retries
 * once with the validation issues appended (a "repair" turn); a second failure throws
 * AiOutputValidationError. Business rules stay in the caller, after this returns.
 */
export async function generateStructured<T>(
  req: LlmRequest & { schema: z.ZodType<T>; jsonSchema: Record<string, unknown> }
): Promise<LlmStructuredResult<T>> {
  const { schema, ...base } = req;
  const validate = (text: string): { ok: true; data: T } | { ok: false; issues: string[] } => {
    const json = parseModelJson(text);
    if (json === undefined) return { ok: false, issues: ['(root): response was not valid JSON'] };
    const parsed = schema.safeParse(json);
    return parsed.success
      ? { ok: true, data: parsed.data }
      : { ok: false, issues: describeIssues(parsed.error) };
  };

  const first = await generateText({
    ...base,
    cache: base.cache
      ? {
          ...base.cache,
          shouldStore: (text) => validate(text).ok && (base.cache?.shouldStore?.(text) ?? true),
        }
      : undefined,
  });
  const firstCheck = validate(first.text);
  if (firstCheck.ok) return { ...first, data: firstCheck.data };

  const repairParts: LlmPart[] = [
    ...toParts(base.user),
    {
      text:
        `Your previous reply did not match the required JSON schema:\n- ${firstCheck.issues.join('\n- ')}\n` +
        'Reply again with only the corrected JSON object.',
    },
  ];
  const second = await generateText({
    ...base,
    user: repairParts,
    cache: undefined,
    billing: { ...base.billing, quotaChecked: true },
  });
  const secondCheck = validate(second.text);
  const combined = {
    ...second,
    creditsConsumed: first.creditsConsumed + second.creditsConsumed,
    latencyMs: first.latencyMs + second.latencyMs,
  };
  if (secondCheck.ok) return { ...combined, data: secondCheck.data };

  logEvent('warn', {
    fn: 'ai-gateway',
    requestId: base.requestId ?? 'none',
    orgId: base.billing.organizationId ?? undefined,
    event: `ai.${base.feature}.invalid_output`,
    meta: {
      promptId: base.prompt.id,
      promptVersion: base.prompt.version,
      issues: secondCheck.issues,
    },
  });
  throw new AiOutputValidationError(
    `${base.feature}: model output failed schema validation`,
    secondCheck.issues
  );
}

export function isAiGatewayError(err: unknown): err is AiProviderError | AiOutputValidationError {
  return err instanceof AiProviderError || err instanceof AiOutputValidationError;
}
