import { scopedAdminPath, scopedFunctionsUrl } from '@/features/dashboard/org/lib/adminApiScope';
import { throwIfUpgradeHookFromJson } from '@/features/dashboard/org/lib/aiQuotaToast';
import { callEdgeFunction } from '@/features/dashboard/org/lib/edgeClient';
import type { PlanFeatureKey } from '@/features/dashboard/plans/lib/planFeatures';

import { supabase } from '@/lib/supabase/client';

export type ReviewAutomationRules = {
  enabled: boolean;
  delayDays: number;
  overallRating: number;
  cleanlinessRating: number;
  communicationRating: number;
  houseRulesRating: number;
  wouldHostAgain: boolean;
  templates: string[];
  skipOnIssueTags: boolean;
  skipOnOpenMaintenance: boolean;
  skipOnSdDeduction: boolean;
};

export const DEFAULT_REVIEW_AUTOMATION_TEMPLATES = [
  '{{guest_first_name}} was a pleasure to host at {{property_name}}. Thank you for a smooth stay.',
  'We enjoyed hosting {{guest_first_name}} at {{property_name}}. Welcome back any time.',
  '{{guest_first_name}} took great care of {{property_name}}. We would host again.',
];

export const DEFAULT_REVIEW_AUTOMATION_RULES: ReviewAutomationRules = {
  enabled: false,
  delayDays: 3,
  overallRating: 5,
  cleanlinessRating: 5,
  communicationRating: 5,
  houseRulesRating: 5,
  wouldHostAgain: true,
  templates: [...DEFAULT_REVIEW_AUTOMATION_TEMPLATES],
  skipOnIssueTags: true,
  skipOnOpenMaintenance: true,
  skipOnSdDeduction: true,
};

export type ReviewAutomationClientError = Error & {
  upgradeRequired?: boolean;
  feature?: PlanFeatureKey;
};

async function authHeaders(): Promise<HeadersInit> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Not signed in');
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

async function parseMutating<T>(res: Response): Promise<T> {
  const json = (await res.json().catch(() => ({}))) as {
    success?: boolean;
    error?: string;
    data?: T;
    upgradeHook?: boolean;
    feature?: string;
  };
  throwIfUpgradeHookFromJson(json, res);
  if (json.upgradeHook) {
    const err = new Error(json.error ?? 'Upgrade required') as ReviewAutomationClientError;
    err.upgradeRequired = true;
    if (typeof json.feature === 'string') err.feature = json.feature as PlanFeatureKey;
    throw err;
  }
  if (!res.ok || json.success === false) {
    throw new Error(json.error ?? 'Request failed');
  }
  return (json.data ?? json) as T;
}

export async function fetchReviewAutomationRules(
  propertyId: string
): Promise<ReviewAutomationRules> {
  const path = scopedAdminPath('review-automation-settings', propertyId);
  const payload = await callEdgeFunction<{ rules: ReviewAutomationRules }>(path);
  return payload.rules ?? DEFAULT_REVIEW_AUTOMATION_RULES;
}

export async function saveReviewAutomationRules(
  propertyId: string,
  rules: ReviewAutomationRules
): Promise<ReviewAutomationRules> {
  const res = await fetch(scopedFunctionsUrl('/review-automation-settings', propertyId), {
    method: 'PATCH',
    headers: await authHeaders(),
    body: JSON.stringify({ action: 'saveRules', ...rules }),
  });
  const payload = await parseMutating<{ rules: ReviewAutomationRules }>(res);
  return payload.rules;
}

export async function setAutoReviewPaused(
  propertyId: string,
  bookingId: string,
  paused: boolean
): Promise<void> {
  const res = await fetch(scopedFunctionsUrl('/review-automation-settings', propertyId), {
    method: 'PATCH',
    headers: await authHeaders(),
    body: JSON.stringify({ action: 'setPaused', bookingId, paused }),
  });
  await parseMutating<{ paused: boolean }>(res);
}

export async function draftReviewWithAi(input: {
  propertyId: string;
  bookingId: string;
  kind: 'host_review' | 'guest_response';
}): Promise<string> {
  const res = await fetch(scopedFunctionsUrl('/draft-review-with-ai', input.propertyId), {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({ bookingId: input.bookingId, kind: input.kind }),
  });
  const payload = await parseMutating<{ text: string }>(res);
  return payload.text;
}
