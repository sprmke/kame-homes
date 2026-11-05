/**
 * Pure classifiers for live probe responses. Kept separate from `probes.ts` so they can be
 * unit-tested without network. Never put response bodies (which may echo keys) into `detail`.
 */
import { type HealthStatus } from './types.ts';

export type ProbeOutcome = {
  status: HealthStatus;
  detail: string;
  meta?: Record<string, unknown>;
};

type Json = Record<string, unknown> | null;

function rateLimited(provider: string): ProbeOutcome {
  return { status: 'warn', detail: `${provider} rate limit or quota reached` };
}

function unexpected(httpStatus: number): ProbeOutcome {
  return { status: 'warn', detail: `Unexpected response (HTTP ${httpStatus})` };
}

export function classifyResend(httpStatus: number, body: Json, fromEmail?: string): ProbeOutcome {
  if (httpStatus === 401 || httpStatus === 403) {
    const name = typeof body?.name === 'string' ? body.name : '';
    if (name === 'restricted_api_key') {
      return { status: 'ok', detail: 'Sending-only key (domain status hidden)' };
    }
    return { status: 'error', detail: 'API key rejected' };
  }
  if (httpStatus === 429) return rateLimited('Resend');
  if (httpStatus !== 200) return unexpected(httpStatus);

  const domains = Array.isArray(body?.data) ? (body.data as Array<Record<string, unknown>>) : [];
  const fromDomain = fromEmail?.match(/@([^>\s]+)>?\s*$/)?.[1]?.toLowerCase();
  const match = fromDomain
    ? domains.find((d) => String(d.name).toLowerCase() === fromDomain)
    : undefined;
  if (fromDomain && !match) {
    return { status: 'error', detail: `Sender domain ${fromDomain} not in Resend` };
  }
  if (match && match.status !== 'verified') {
    return { status: 'error', detail: `Sender domain ${fromDomain} is ${String(match.status)}` };
  }
  if (!match && !domains.some((d) => d.status === 'verified')) {
    return { status: 'warn', detail: 'No verified domain' };
  }
  return { status: 'ok', detail: fromDomain ? `${fromDomain} verified` : 'Key valid' };
}

export function classifyGemini(httpStatus: number, body: Json): ProbeOutcome {
  if (httpStatus === 200) return { status: 'ok', detail: 'Key valid' };
  if (httpStatus === 429) return rateLimited('Gemini');
  const error = (body?.error ?? {}) as Record<string, unknown>;
  const reason = JSON.stringify(error.details ?? '');
  if (httpStatus === 400 && reason.includes('API_KEY_INVALID')) {
    return { status: 'error', detail: 'Key invalid or deleted' };
  }
  if (httpStatus === 400 || httpStatus === 401 || httpStatus === 403) {
    return { status: 'error', detail: 'Key rejected (disabled API or restricted key)' };
  }
  return unexpected(httpStatus);
}

export function classifyBearer(provider: string, httpStatus: number): ProbeOutcome {
  if (httpStatus === 200) return { status: 'ok', detail: 'Key valid' };
  if (httpStatus === 401 || httpStatus === 403) return { status: 'error', detail: 'Key rejected' };
  if (httpStatus === 429) return rateLimited(provider);
  return unexpected(httpStatus);
}

export function classifyPaymongo(httpStatus: number, body: Json): ProbeOutcome {
  if (httpStatus === 401 || httpStatus === 403)
    return { status: 'error', detail: 'Secret key rejected' };
  if (httpStatus === 429) return rateLimited('PayMongo');
  if (httpStatus !== 200) return unexpected(httpStatus);
  const hooks = Array.isArray(body?.data) ? (body.data as Array<Record<string, unknown>>) : [];
  const enabled = hooks.filter((hook) => {
    const attrs = (hook.attributes ?? {}) as Record<string, unknown>;
    return attrs.status === 'enabled' && String(attrs.url ?? '').includes('paymongo-webhook');
  });
  if (enabled.length === 0) {
    return { status: 'warn', detail: 'Key valid, no enabled webhook for paymongo-webhook' };
  }
  return { status: 'ok', detail: `Key valid, ${enabled.length} webhook enabled` };
}

export function classifyMetaAppToken(httpStatus: number, body: Json): ProbeOutcome {
  if (httpStatus === 200 && typeof body?.access_token === 'string') {
    return { status: 'ok', detail: 'App ID and secret valid' };
  }
  if (httpStatus === 429) return rateLimited('Meta');
  if (httpStatus === 400 || httpStatus === 401)
    return { status: 'error', detail: 'App ID or secret rejected' };
  return unexpected(httpStatus);
}

export type MetaTokenDebug = {
  is_valid?: boolean;
  expires_at?: number;
  data_access_expires_at?: number;
};

/** Why a single page token needs attention, or null when it is fine for the next 7 days. */
export function metaTokenProblem(r: MetaTokenDebug, nowSec: number): string | null {
  if (!r.is_valid) return 'Token invalid';
  const expiries = [r.expires_at, r.data_access_expires_at].filter((t): t is number => Boolean(t));
  return expiries.some((t) => t - nowSec < 7 * 86400) ? 'Expires within 7 days' : null;
}

/** Rolls up `debug_token` results for connected page tokens. */
export function classifyMetaPageTokens(results: MetaTokenDebug[], nowSec: number): ProbeOutcome {
  if (results.length === 0) return { status: 'off', detail: 'No connected pages' };
  let invalid = 0;
  let expiring = 0;
  for (const r of results) {
    const problem = metaTokenProblem(r, nowSec);
    if (problem === 'Token invalid') invalid++;
    else if (problem) expiring++;
  }
  const meta = { checked: results.length, invalid, expiring };
  if (invalid > 0) {
    return { status: 'error', detail: `${invalid} of ${results.length} page tokens invalid`, meta };
  }
  if (expiring > 0) {
    return {
      status: 'warn',
      detail: `${expiring} of ${results.length} page tokens expire within 7 days`,
      meta,
    };
  }
  return { status: 'ok', detail: `${results.length} page tokens valid`, meta };
}

export function classifyTurnstile(httpStatus: number, body: Json): ProbeOutcome {
  if (httpStatus === 429) return rateLimited('Turnstile');
  if (httpStatus !== 200) return unexpected(httpStatus);
  const codes = Array.isArray(body?.['error-codes']) ? (body['error-codes'] as string[]) : [];
  if (codes.includes('invalid-input-secret') || codes.includes('missing-input-secret')) {
    return { status: 'error', detail: 'Secret key rejected' };
  }
  return { status: 'ok', detail: 'Secret key valid' };
}

export function classifyJamendo(httpStatus: number, body: Json): ProbeOutcome {
  if (httpStatus === 429) return rateLimited('Jamendo');
  if (httpStatus !== 200) return unexpected(httpStatus);
  const headers = (body?.headers ?? {}) as Record<string, unknown>;
  if (headers.status === 'success') return { status: 'ok', detail: 'Client ID valid' };
  return { status: 'error', detail: 'Client ID rejected' };
}

/** `getMe` result: true valid, false rejected (revoked/deleted bot), null inconclusive. */
export function classifyTelegramGetMe(httpStatus: number, body: Json): boolean | null {
  if (httpStatus === 200 && body?.ok === true) return true;
  if (httpStatus === 401 || httpStatus === 404) return false;
  return null;
}

export function classifyTelegramBots(results: Array<boolean | null>): ProbeOutcome {
  if (results.length === 0) return { status: 'off', detail: 'No bots configured' };
  const invalid = results.filter((r) => r === false).length;
  const unknown = results.filter((r) => r === null).length;
  const meta = { checked: results.length, invalid, unknown };
  if (invalid > 0) {
    return { status: 'error', detail: `${invalid} of ${results.length} bot tokens rejected`, meta };
  }
  if (unknown > 0) {
    return { status: 'warn', detail: `${unknown} of ${results.length} bots did not respond`, meta };
  }
  return { status: 'ok', detail: `${results.length} bot tokens valid`, meta };
}

export function classifySupabaseAuth(httpStatus: number, body: Json): ProbeOutcome {
  if (httpStatus !== 200)
    return { status: 'error', detail: `Auth settings unavailable (HTTP ${httpStatus})` };
  const external = (body?.external ?? {}) as Record<string, unknown>;
  if (external.google !== true) return { status: 'warn', detail: 'Google sign-in disabled' };
  return { status: 'ok', detail: 'Google sign-in enabled' };
}
