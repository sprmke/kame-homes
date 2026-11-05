/**
 * Tool-calling (function-calling) through the AI gateway — the dashboard assistant's agent loop.
 * Shares quota, metering, failure logging, caching and tracing with llmClient.ts; only the
 * Gemini request/response shape for tools lives here. The model only *proposes* calls: the
 * server-side tool registry decides what exists, validates arguments and enforces authorization.
 */

import type { z } from 'zod';

import { extractGeminiText, extractGeminiUsage, getGeminiApiKeys } from '../aiGeminiKeys.ts';
import { getModelConfig } from '../aiModelRouter.ts';
import {
  computePromptFingerprint,
  getCachedAiResponse,
  setCachedAiResponse,
} from '../aiQuotaCache.ts';
import { assertOrgAndPropertyAiQuota, type AiCallTrace } from '../aiUsageService.ts';
import { logCall, meter, recordCallFailure, type LlmBilling } from './llmClient.ts';
import {
  AiProviderError,
  GEMINI_API_BASE,
  geminiModelPath,
  geminiRequest,
} from './llmTransport.ts';
import type { PromptRef } from './prompt.ts';
import type { AiFeature } from '../aiModelRouter.ts';

export type ToolDeclaration = {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
};

export type GeminiContentPart =
  | { text: string; thoughtSignature?: string }
  | { functionCall: { name: string; args: Record<string, unknown> }; thoughtSignature?: string }
  | {
      functionResponse: { name: string; response: Record<string, unknown> };
      thoughtSignature?: string;
    }
  | { inlineData: { mimeType: string; data: string }; thoughtSignature?: string };

export type GeminiContent = { role: 'user' | 'model'; parts: GeminiContentPart[] };

export type LlmToolRequest = {
  feature: AiFeature;
  prompt: PromptRef;
  system: string;
  /** Single user turn (ignored when `history` is set). */
  user?: string;
  /** Full multi-round history (user / model function calls / function responses). */
  history?: GeminiContent[];
  tools?: ToolDeclaration[];
  toolMode?: 'auto' | 'any' | 'none';
  billing: LlmBilling;
  temperature?: number;
  maxOutputTokens?: number;
  timeoutMs?: number;
  signal?: AbortSignal;
  /** Cache only single-turn calls; multi-round history changes every round. */
  cache?: { extras?: Record<string, unknown> };
  requestId?: string;
};

export type LlmToolResult = {
  toolCalls: Array<{ name: string; arguments: Record<string, unknown> }>;
  text: string | null;
  /** Credits this call consumed — 0 on a cache hit. Loops should sum this per turn. */
  creditsConsumed: number;
  /**
   * Raw model `content.parts` (incl. `thoughtSignature`). Echo verbatim into the next round's
   * history — never rebuild functionCall parts.
   */
  modelParts?: GeminiContentPart[];
  latencyMs: number;
  model: string;
};

function buildToolRequestBody(
  req: LlmToolRequest,
  thinkingBudget: number,
  maxOutputTokens: number
) {
  const generationConfig: Record<string, unknown> = {
    temperature: req.temperature ?? 0,
    maxOutputTokens: req.maxOutputTokens ?? maxOutputTokens,
  };
  // Some Gemini models reject thinkingBudget: 0 in tool mode — only send a non-zero budget.
  if (thinkingBudget !== 0) generationConfig.thinkingConfig = { thinkingBudget };

  const contents =
    req.history && req.history.length > 0
      ? req.history
      : [{ role: 'user' as const, parts: [{ text: req.user ?? '' }] }];

  const body: Record<string, unknown> = {
    systemInstruction: { parts: [{ text: req.system }] },
    contents,
    generationConfig,
  };
  if (req.tools?.length) {
    body.tools = req.tools.map((t) => ({
      functionDeclarations: [
        { name: t.name, description: t.description, parameters: t.parameters },
      ],
    }));
    if (req.toolMode === 'any') body.toolConfig = { functionCallingConfig: { mode: 'ANY' } };
    else if (req.toolMode === 'none') body.toolConfig = { functionCallingConfig: { mode: 'NONE' } };
  }
  return body;
}

function parseToolCalls(json: unknown): LlmToolResult['toolCalls'] {
  const candidates =
    (json as { candidates?: Array<{ content?: { parts?: unknown[] } }> }).candidates ?? [];
  const calls: LlmToolResult['toolCalls'] = [];
  for (const candidate of candidates) {
    for (const part of (candidate.content?.parts ?? []) as Array<{
      functionCall?: { name?: string; args?: Record<string, unknown> };
    }>) {
      if (part.functionCall?.name) {
        calls.push({ name: part.functionCall.name, arguments: part.functionCall.args ?? {} });
      }
    }
  }
  return calls;
}

/** Valid base64 (the field's wire type) — never decodable as a real signature, only well-formed. */
const MISSING_THOUGHT_SIGNATURE_PLACEHOLDER = btoa('no_thought_signature_returned');

/** Preserve thoughtSignature / thought_signature on model parts for multi-round tool loops. */
function parseModelParts(json: unknown): GeminiContentPart[] {
  const candidates =
    (json as { candidates?: Array<{ content?: { parts?: unknown[] } }> }).candidates ?? [];
  const rawParts = (candidates[0]?.content?.parts ?? []) as Array<Record<string, unknown>>;

  // On a multi-call turn Gemini only signs the first functionCall part; later ones legitimately
  // have none, and echoing a fabricated signature back on those is REJECTED next round
  // ("Corrupted thought signature" — reproduced live, gemini-3.5-flash-lite). But a turn can also
  // come back with no signature anywhere (observed on gemini-2.5-flash), and echoing a functionCall
  // with the field missing entirely was rejected too ("Function call is missing a thought_signature").
  // So: echo every real signature exactly as given, and only fabricate the well-formed-but-opaque
  // placeholder when the WHOLE round had no real signature to echo — never next to a real one.
  const anyRealSignature = rawParts.some(
    (part) =>
      typeof part.thoughtSignature === 'string' || typeof part.thought_signature === 'string'
  );

  const out: GeminiContentPart[] = [];
  for (const part of rawParts) {
    const signature =
      (typeof part.thoughtSignature === 'string' && part.thoughtSignature) ||
      (typeof part.thought_signature === 'string' && part.thought_signature) ||
      undefined;
    if (part.functionCall && typeof part.functionCall === 'object') {
      const fc = part.functionCall as { name?: string; args?: Record<string, unknown> };
      // The field is typed as bytes (base64) server-side, so the placeholder must itself be valid
      // base64 — it does not claim to know the model's real reasoning state for that call, only
      // keeps the field present and well-formed for the no-signature-anywhere fallback case.
      const fcSig =
        signature !== undefined
          ? { thoughtSignature: signature }
          : anyRealSignature
            ? {}
            : { thoughtSignature: MISSING_THOUGHT_SIGNATURE_PLACEHOLDER };
      if (fc.name) out.push({ functionCall: { name: fc.name, args: fc.args ?? {} }, ...fcSig });
    } else if (typeof part.text === 'string') {
      out.push({ text: part.text, ...(signature ? { thoughtSignature: signature } : {}) });
    } else if (part.inlineData && typeof part.inlineData === 'object') {
      const data = part.inlineData as { mimeType?: string; data?: string };
      if (data.mimeType && data.data) {
        out.push({
          inlineData: { mimeType: data.mimeType, data: data.data },
          ...(signature ? { thoughtSignature: signature } : {}),
        });
      }
    }
  }
  return out;
}

/**
 * Whether a failed call is worth retrying once against `fallbackModel` instead of giving up.
 * Only for a genuine provider outage (5xx/429/timeout/network) on a different, configured model —
 * never for a 400 or empty response, which fail identically on any model.
 */
export function shouldTryFallbackModel(
  error: unknown,
  primaryModel: string | undefined,
  fallbackModel: string | undefined
): boolean {
  if (!primaryModel || !fallbackModel || primaryModel === fallbackModel) return false;
  return error instanceof AiProviderError && error.retryable;
}

export async function generateWithTools(req: LlmToolRequest): Promise<LlmToolResult> {
  const config = getModelConfig(req.feature);
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

  const cacheable = Boolean(req.cache) && !(req.history && req.history.length > 0);
  const cacheKey = cacheable
    ? await computePromptFingerprint({
        prompt: `${req.prompt.id}@${req.prompt.version}`,
        model: config.model,
        system: req.system,
        user: req.user ?? '',
        tools: req.tools?.map((t) => t.name) ?? [],
        toolMode: req.toolMode ?? 'auto',
        extras: req.cache?.extras ?? null,
      }).catch(() => null)
    : null;

  if (cacheKey) {
    const cached = await getCachedAiResponse(req.feature, cacheKey).catch(() => null);
    if (cached) {
      let toolCalls: LlmToolResult['toolCalls'] = [];
      let text: string | null = cached.responseText;
      try {
        const parsed = JSON.parse(cached.responseText);
        if (Array.isArray(parsed.toolCalls)) {
          toolCalls = parsed.toolCalls;
          text = parsed.text ?? null;
        }
      } catch {
        /* cached response is plain text */
      }
      trace.latencyMs = Date.now() - started;
      const creditsConsumed = await meter(req, { ...cached }, trace, true, 0);
      logCall(req, trace, {
        status: 'success',
        provider: cached.provider,
        model: cached.model,
        cacheHit: true,
      });
      return { toolCalls, text, creditsConsumed, latencyMs: trace.latencyMs, model: cached.model };
    }
  }

  let json: Record<string, unknown>;
  let answeredByModel = config.model;
  try {
    json = await geminiRequest(
      geminiModelPath(config.model, 'generateContent'),
      buildToolRequestBody(req, config.thinkingBudget, config.defaultMaxOutputTokens),
      { timeoutMs: req.timeoutMs ?? config.timeoutMs, signal: req.signal }
    );
  } catch (err) {
    if (shouldTryFallbackModel(err, config.model, config.fallbackModel)) {
      try {
        json = await geminiRequest(
          geminiModelPath(config.fallbackModel as string, 'generateContent'),
          buildToolRequestBody(req, config.thinkingBudget, config.defaultMaxOutputTokens),
          { timeoutMs: req.timeoutMs ?? config.timeoutMs, signal: req.signal }
        );
        answeredByModel = config.fallbackModel as string;
        trace.fallbackUsed = true;
      } catch (fallbackErr) {
        trace.latencyMs = Date.now() - started;
        await recordCallFailure(req, trace, fallbackErr);
        throw fallbackErr;
      }
    } else {
      trace.latencyMs = Date.now() - started;
      await recordCallFailure(req, trace, err);
      throw err;
    }
  }

  trace.latencyMs = Date.now() - started;
  const usage = extractGeminiUsage(json);
  const toolCalls = parseToolCalls(json);
  const text = extractGeminiText(json);
  const raw = { provider: 'gemini' as const, model: answeredByModel, ...usage };
  const creditsConsumed = await meter(req, raw, trace, false);

  if (cacheKey) {
    await setCachedAiResponse(req.feature, cacheKey, {
      ...raw,
      responseText: JSON.stringify({ toolCalls, text }),
      estimatedCostUsd: 0,
    }).catch(() => undefined);
  }

  logCall(req, trace, { status: 'success', provider: 'gemini', model: answeredByModel });
  return {
    toolCalls,
    text,
    creditsConsumed,
    modelParts: parseModelParts(json),
    latencyMs: trace.latencyMs,
    model: answeredByModel,
  };
}

export type LlmStreamToolRequest = LlmToolRequest & {
  onTextDelta?: (delta: string) => void;
};

/**
 * Gemini `streamGenerateContent` for the last tool-loop round. Emits text deltas until a
 * function call appears (then the caller should retract the preview). Falls back to
 * `generateWithTools` when streaming is unavailable.
 */
export async function generateWithToolsStream(req: LlmStreamToolRequest): Promise<LlmToolResult> {
  const onTextDelta = req.onTextDelta;
  if (!onTextDelta) return generateWithTools(req);

  const config = getModelConfig(req.feature);
  const keys = getGeminiApiKeys();
  const key = keys[0];
  if (!key) return generateWithTools(req);

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

  const url = `${GEMINI_API_BASE}/v1beta/${geminiModelPath(config.model, 'streamGenerateContent')}?alt=sse`;
  const timeoutSignal = AbortSignal.timeout(req.timeoutMs ?? config.timeoutMs);
  const signal = req.signal ? AbortSignal.any([timeoutSignal, req.signal]) : timeoutSignal;

  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify(
        buildToolRequestBody(req, config.thinkingBudget, config.defaultMaxOutputTokens)
      ),
      signal,
    });
  } catch {
    return generateWithTools(req);
  }
  if (!res.ok || !res.body) return generateWithTools(req);

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  let seenToolCall = false;
  let emitted = '';
  let lastJson: Record<string, unknown> = {};

  const consumeEvent = (raw: string) => {
    const line = raw.trim();
    if (!line.startsWith('data:')) return;
    const payload = line.slice(5).trim();
    if (!payload || payload === '[DONE]') return;
    try {
      lastJson = JSON.parse(payload) as Record<string, unknown>;
    } catch {
      return;
    }
    const calls = parseToolCalls(lastJson);
    if (calls.length > 0) {
      seenToolCall = true;
      return;
    }
    const text = extractGeminiText(lastJson) ?? '';
    if (text.length > emitted.length) {
      const delta = text.slice(emitted.length);
      emitted = text;
      if (delta && !seenToolCall) onTextDelta(delta);
    }
  };

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const parts = buf.split('\n\n');
      buf = parts.pop() ?? '';
      for (const part of parts) consumeEvent(part);
    }
    if (buf.trim()) consumeEvent(buf);
  } catch {
    return generateWithTools(req);
  }

  trace.latencyMs = Date.now() - started;
  const usage = extractGeminiUsage(lastJson);
  const toolCalls = parseToolCalls(lastJson);
  const text = extractGeminiText(lastJson);
  const raw = { provider: 'gemini' as const, model: config.model, ...usage };
  const creditsConsumed = await meter(req, raw, trace, false);
  logCall(req, trace, { status: 'success', provider: 'gemini', model: config.model });
  return {
    toolCalls,
    text,
    creditsConsumed,
    modelParts: parseModelParts(lastJson),
    latencyMs: trace.latencyMs,
    model: config.model,
  };
}

export type LlmToolStructuredResult<T> = {
  /** Validated payload, or null when the model returned nothing usable (callers must fail safe). */
  data: T | null;
  text: string | null;
  creditsConsumed: number;
};

/**
 * Structured output via a forced single function call (works alongside multi-round tool
 * history, which JSON mode does not). The payload is zod-validated; invalid output → null.
 */
export async function generateStructuredViaTool<T>(
  req: Omit<LlmToolRequest, 'tools' | 'toolMode'> & {
    jsonSchema: Record<string, unknown>;
    schema: z.ZodType<T>;
  }
): Promise<LlmToolStructuredResult<T>> {
  const { jsonSchema, schema, ...rest } = req;
  const call = () =>
    generateWithTools({
      ...rest,
      tools: [
        {
          name: 'extract_structured_data',
          description: 'Return the structured data matching the requested schema.',
          parameters: jsonSchema,
        },
      ],
      toolMode: 'any',
    });

  let result = await call();
  let parsed = schema.safeParse(result.toolCalls[0]?.arguments);
  let creditsConsumed = result.creditsConsumed;

  // One retry when the model skipped the call or returned arguments that don't match the
  // schema — a transient slip, not worth failing the whole turn over.
  if (!parsed.success) {
    result = await call();
    creditsConsumed += result.creditsConsumed;
    parsed = schema.safeParse(result.toolCalls[0]?.arguments);
  }

  if (!parsed.success) {
    logCall(
      rest,
      { promptId: rest.prompt.id, promptVersion: rest.prompt.version },
      {
        status: 'error',
        errorCode: 'invalid_output',
      }
    );
  }
  return {
    data: parsed.success ? parsed.data : null,
    text: result.text,
    creditsConsumed,
  };
}
