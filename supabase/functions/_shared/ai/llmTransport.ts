/**
 * The only module that talks HTTP to AI providers (Gemini + Groq). Everything that reaches a
 * model goes through here, so reliability rules live in one place:
 *
 * - Hard timeout per attempt (AbortSignal.timeout) combined with the caller's signal.
 * - Retries only on transient failures (network, timeout, 429, 5xx), with jittered exponential
 *   backoff that honors `retry-after` (capped so an edge request never stalls).
 * - Multi-key rotation for Gemini (free-tier projects); 401/403 moves to the next key without
 *   retrying, 400 fails fast (the request itself is wrong; another key will not fix it).
 * - API keys travel in headers, never in the URL (URLs end up in logs and traces).
 *
 * `scripts/dev/check-ai-gateway.mjs` fails CI if a provider host appears anywhere else.
 */

import { getGeminiApiKeys, getGroqApiKey, providerError } from '../aiGeminiKeys.ts';

export const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com';
export const GROQ_CHAT_URL = 'https://api.groq.com/openai/v1/chat/completions';

export type AiProvider = 'gemini' | 'groq';

export type AiErrorCode =
  | 'not_configured'
  | 'timeout'
  | 'aborted'
  | 'rate_limited'
  | 'auth'
  | 'bad_request'
  | 'provider_error'
  | 'network'
  | 'empty_response'
  | 'invalid_output';

export class AiProviderError extends Error {
  readonly provider: AiProvider;
  readonly code: AiErrorCode;
  readonly status: number | null;
  /** Provider `retry-after` header on 429/503, when sent. */
  readonly retryAfter: string | null;

  constructor(
    provider: AiProvider,
    code: AiErrorCode,
    message: string,
    status: number | null = null,
    retryAfter: string | null = null
  ) {
    super(message);
    this.name = 'AiProviderError';
    this.provider = provider;
    this.code = code;
    this.status = status;
    this.retryAfter = retryAfter;
  }

  get retryable(): boolean {
    return (
      this.code === 'timeout' ||
      this.code === 'rate_limited' ||
      this.code === 'network' ||
      (this.code === 'provider_error' && (this.status ?? 0) >= 500)
    );
  }
}

export type TransportOptions = {
  /** Per-attempt timeout. */
  timeoutMs: number;
  /** Caller cancellation (e.g. the edge request's own signal). */
  signal?: AbortSignal;
  /** Attempts per key for transient failures (default 2 = one retry). */
  attemptsPerKey?: number;
  /**
   * Extra HTTP statuses that mean "wrong key for this resource" (rotate, don't fail fast) —
   * e.g. 404 when polling a long-running operation owned by another key's project.
   */
  keySpecificStatuses?: number[];
};

const MAX_BACKOFF_MS = 4_000;
const BASE_BACKOFF_MS = 400;

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(signal.reason);
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        reject(signal.reason);
      },
      { once: true }
    );
  });
}

/** Jittered exponential backoff; a provider `retry-after` wins when present (capped). */
export function backoffDelayMs(attempt: number, retryAfterHeader: string | null): number {
  const retryAfterSec = retryAfterHeader ? Number(retryAfterHeader) : NaN;
  if (Number.isFinite(retryAfterSec) && retryAfterSec >= 0) {
    return Math.min(retryAfterSec * 1000, MAX_BACKOFF_MS);
  }
  const exp = BASE_BACKOFF_MS * 2 ** attempt;
  return Math.min(exp + Math.floor(Math.random() * BASE_BACKOFF_MS), MAX_BACKOFF_MS);
}

function classifyStatus(status: number, message: string): AiErrorCode {
  if (status === 429) return 'rate_limited';
  if (status === 401 || status === 403) return 'auth';
  // Gemini reports a bad/expired key as 400 API_KEY_INVALID — key-specific, so rotate.
  if (status === 400 && /api[_ ]key/i.test(message)) return 'auth';
  if (status >= 400 && status < 500) return 'bad_request';
  return 'provider_error';
}

type HttpAttempt = {
  url: string;
  headers: Record<string, string>;
  body?: string;
  method?: 'POST' | 'GET';
};

/** One HTTP attempt with timeout + caller signal. Returns parsed JSON or throws AiProviderError. */
async function attemptJson(
  provider: AiProvider,
  attempt: HttpAttempt,
  options: TransportOptions
): Promise<Record<string, unknown>> {
  const timeoutSignal = AbortSignal.timeout(options.timeoutMs);
  const signal = options.signal ? AbortSignal.any([timeoutSignal, options.signal]) : timeoutSignal;
  let res: Response;
  try {
    res = await fetch(attempt.url, {
      method: attempt.method ?? 'POST',
      headers: { 'Content-Type': 'application/json', ...attempt.headers },
      body: attempt.body,
      signal,
    });
  } catch (err) {
    if (options.signal?.aborted) {
      throw new AiProviderError(provider, 'aborted', 'AI request cancelled');
    }
    if (timeoutSignal.aborted) {
      throw new AiProviderError(
        provider,
        'timeout',
        `AI request timed out after ${options.timeoutMs}ms`
      );
    }
    throw new AiProviderError(
      provider,
      'network',
      err instanceof Error ? err.message : String(err)
    );
  }

  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const message = providerError(json, `${provider} API returned ${res.status}`);
    throw new AiProviderError(
      provider,
      options.keySpecificStatuses?.includes(res.status) ? 'auth' : classifyStatus(res.status, message),
      message,
      res.status,
      res.headers.get('retry-after')
    );
  }
  return json;
}

/**
 * Runs `attempt` across keys with retry/backoff. `buildAttempt(key)` returns the request for a
 * given key so each provider controls its own auth header.
 */
async function withRetries(
  provider: AiProvider,
  keys: string[],
  buildAttempt: (key: string) => HttpAttempt,
  options: TransportOptions
): Promise<Record<string, unknown>> {
  if (keys.length === 0) {
    throw new AiProviderError(provider, 'not_configured', `${provider} API key is not configured`);
  }
  const attemptsPerKey = Math.max(1, options.attemptsPerKey ?? 2);
  const start = nextKeyStartIndex(provider, keys.length);
  let lastError: AiProviderError | null = null;

  for (let k = 0; k < keys.length; k++) {
    const key = keys[(start + k) % keys.length];
    for (let attempt = 0; attempt < attemptsPerKey; attempt++) {
      try {
        return await attemptJson(provider, buildAttempt(key), options);
      } catch (err) {
        const error = err as AiProviderError;
        lastError = error;
        if (error.code === 'aborted' || error.code === 'bad_request') throw error;
        if (error.code === 'auth') break; // key-specific: next key, no retry
        if (!error.retryable) break;
        if (attempt < attemptsPerKey - 1) {
          await sleep(backoffDelayMs(attempt, error.retryAfter), options.signal).catch(
            () => {
              throw new AiProviderError(provider, 'aborted', 'AI request cancelled');
            }
          );
        }
      }
    }
  }
  throw lastError ?? new AiProviderError(provider, 'provider_error', `${provider} request failed`);
}

const keyCursor: Record<AiProvider, number> = { gemini: 0, groq: 0 };

/** Test-only: make key rotation start at the first configured key again. */
export function resetKeyRotationForTests(): void {
  keyCursor.gemini = 0;
  keyCursor.groq = 0;
}

/** Round-robin starting key per isolate so free-tier load spreads across projects. */
function nextKeyStartIndex(provider: AiProvider, keyCount: number): number {
  const start = keyCursor[provider] % keyCount;
  keyCursor[provider] = (keyCursor[provider] + 1) % keyCount;
  return start;
}

export function geminiModelPath(model: string, method: string): string {
  return `models/${model}:${method}`;
}

type GeminiRequestOptions = TransportOptions & {
  apiVersion?: 'v1beta' | 'v1alpha';
  method?: 'POST' | 'GET';
};

/**
 * POST/GET a Gemini REST path and also return the key that succeeded. Only for flows that must
 * reuse the same project's key for a follow-up call (e.g. downloading a Veo video file).
 */
export async function geminiRequestWithKey(
  path: string,
  body: unknown,
  options: GeminiRequestOptions
): Promise<{ json: Record<string, unknown>; apiKey: string }> {
  const url = `${GEMINI_API_BASE}/${options.apiVersion ?? 'v1beta'}/${path.replace(/^\/+/, '')}`;
  let usedKey = '';
  const json = await withRetries(
    'gemini',
    getGeminiApiKeys(),
    (key) => {
      usedKey = key;
      return {
        url,
        method: options.method ?? 'POST',
        headers: { 'x-goog-api-key': key },
        body: options.method === 'GET' ? undefined : JSON.stringify(body),
      };
    },
    options
  );
  return { json, apiKey: usedKey };
}

/**
 * POST/GET a Gemini REST path (e.g. `models/gemini-2.5-flash:generateContent`,
 * `operations/abc`), with rotation, retries and timeout.
 */
export async function geminiRequest(
  path: string,
  body: unknown,
  options: GeminiRequestOptions
): Promise<Record<string, unknown>> {
  return (await geminiRequestWithKey(path, body, options)).json;
}

/** OpenAI-compatible Groq chat completion (fallback provider). */
export function groqChatCompletion(
  body: Record<string, unknown>,
  options: TransportOptions
): Promise<Record<string, unknown>> {
  const key = getGroqApiKey();
  return withRetries(
    'groq',
    key ? [key] : [],
    (k) => ({
      url: GROQ_CHAT_URL,
      headers: { Authorization: `Bearer ${k}` },
      body: JSON.stringify(body),
    }),
    options
  );
}

export function isGeminiConfigured(): boolean {
  return getGeminiApiKeys().length > 0;
}

export function isGroqConfigured(): boolean {
  return Boolean(getGroqApiKey());
}
