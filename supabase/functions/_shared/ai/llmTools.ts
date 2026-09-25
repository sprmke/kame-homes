/**
 * Tool-calling (function-calling) through the AI gateway — the dashboard assistant's agent loop.
 * Shares quota, metering, failure logging, caching and tracing with llmClient.ts; only the
 * Gemini request/response shape for tools lives here. The model only *proposes* calls: the
 * server-side tool registry decides what exists, validates arguments and enforces authorization.
 */

import type { z } from 'zod';

import { extractGeminiText, extractGeminiUsage } from '../aiGeminiKeys.ts';
import { getModelConfig } from '../aiModelRouter.ts';
import {
  computePromptFingerprint,
  getCachedAiResponse,
  setCachedAiResponse,
} from '../aiQuotaCache.ts';
import { assertOrgAndPropertyAiQuota, type AiCallTrace } from '../aiUsageService.ts';
import { logCall, meter, recordCallFailure, type LlmBilling } from './llmClient.ts';
import { geminiModelPath, geminiRequest } from './llmTransport.ts';
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

/** Preserve thoughtSignature / thought_signature on model parts for multi-round tool loops. */
function parseModelParts(json: unknown): GeminiContentPart[] {
  const candidates =
    (json as { candidates?: Array<{ content?: { parts?: unknown[] } }> }).candidates ?? [];
  const out: GeminiContentPart[] = [];
  for (const part of (candidates[0]?.content?.parts ?? []) as Array<Record<string, unknown>>) {
    const signature =
      (typeof part.thoughtSignature === 'string' && part.thoughtSignature) ||
      (typeof part.thought_signature === 'string' && part.thought_signature) ||
      undefined;
    const sig = signature ? { thoughtSignature: signature } : {};
    if (part.functionCall && typeof part.functionCall === 'object') {
      const fc = part.functionCall as { name?: string; args?: Record<string, unknown> };
      if (fc.name) out.push({ functionCall: { name: fc.name, args: fc.args ?? {} }, ...sig });
    } else if (typeof part.text === 'string') {
      out.push({ text: part.text, ...sig });
    } else if (part.inlineData && typeof part.inlineData === 'object') {
      const data = part.inlineData as { mimeType?: string; data?: string };
      if (data.mimeType && data.data) {
        out.push({ inlineData: { mimeType: data.mimeType, data: data.data }, ...sig });
      }
    }
  }
  return out;
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
  try {
    json = await geminiRequest(
      geminiModelPath(config.model, 'generateContent'),
      buildToolRequestBody(req, config.thinkingBudget, config.defaultMaxOutputTokens),
      { timeoutMs: req.timeoutMs ?? config.timeoutMs, signal: req.signal }
    );
  } catch (err) {
    trace.latencyMs = Date.now() - started;
    await recordCallFailure(req, trace, err);
    throw err;
  }

  trace.latencyMs = Date.now() - started;
  const usage = extractGeminiUsage(json);
  const toolCalls = parseToolCalls(json);
  const text = extractGeminiText(json);
  const raw = { provider: 'gemini' as const, model: config.model, ...usage };
  const creditsConsumed = await meter(req, raw, trace, false);

  if (cacheKey) {
    await setCachedAiResponse(req.feature, cacheKey, {
      ...raw,
      responseText: JSON.stringify({ toolCalls, text }),
      estimatedCostUsd: 0,
    }).catch(() => undefined);
  }

  logCall(req, trace, { status: 'success', provider: 'gemini', model: config.model });
  return {
    toolCalls,
    text,
    creditsConsumed,
    modelParts: parseModelParts(json),
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
  const result = await generateWithTools({
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
  const parsed = schema.safeParse(result.toolCalls[0]?.arguments);
  if (!parsed.success) {
    logCall(rest, { promptId: rest.prompt.id, promptVersion: rest.prompt.version }, {
      status: 'error',
      errorCode: 'invalid_output',
    });
  }
  return {
    data: parsed.success ? parsed.data : null,
    text: result.text,
    creditsConsumed: result.creditsConsumed,
  };
}
