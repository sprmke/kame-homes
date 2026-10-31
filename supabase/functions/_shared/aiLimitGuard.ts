/**
 * Hosts may only toggle AI on/off. Every numeric AI limit is super-admin owned
 * (see aiLimitResolver.ts). Host endpoints call this before any write so a stale or
 * hand-rolled client gets a loud 403 instead of a silently ignored field.
 */

import { jsonResponse } from './httpResponse.ts';

export const AI_LIMIT_PLATFORM_MANAGED_CODE = 'ai_limit_platform_managed' as const;

export const HOST_ORG_AI_LIMIT_FIELDS = [
  'dailyCallLimit',
  'monthlyCallLimit',
  'dailyCostUsdLimit',
  'dailyCreditLimit',
  'monthlyCreditLimit',
] as const;

export const HOST_PROPERTY_AI_LIMIT_FIELDS = [
  ...HOST_ORG_AI_LIMIT_FIELDS,
  'imageMonthlyCreditCap',
  'videoMonthlyCreditCap',
] as const;

export const HOST_ASSISTANT_LIMIT_FIELDS = [
  'dailyMessageLimit',
  'monthlyMessageLimit',
  'dailyWriteActionLimit',
] as const;

export const HOST_VOICE_LIMIT_FIELDS = [
  'maxSessionSeconds',
  'maxSessionsPerGuestPerDay',
  'maxConcurrentSessions',
] as const;

/** Names of platform-managed fields present in the body (presence alone counts, even `null`). */
export function findPlatformManagedLimitFields(
  body: Record<string, unknown>,
  fields: readonly string[]
): string[] {
  return fields.filter((field) => Object.prototype.hasOwnProperty.call(body, field));
}

export function platformManagedLimitResponse(req: Request, fields: string[]): Response {
  return jsonResponse(
    req,
    {
      success: false,
      error: 'AI limits are managed by the platform and cannot be changed here',
      code: AI_LIMIT_PLATFORM_MANAGED_CODE,
      fields,
    },
    403,
    'private'
  );
}

/** Returns a 403 response when the body tries to write any platform-managed field, else null. */
export function rejectPlatformManagedLimits(
  req: Request,
  body: Record<string, unknown>,
  fields: readonly string[]
): Response | null {
  const found = findPlatformManagedLimitFields(body, fields);
  return found.length > 0 ? platformManagedLimitResponse(req, found) : null;
}
