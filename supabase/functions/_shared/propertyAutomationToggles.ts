/**
 * Per-property automation master switches (`app_settings.automation_toggles`).
 * Email only — Telegram is controlled per property in telegram_*_settings.
 *
 * Plan gate: all keys except `emailNewBookingRequest` (the "a guest submitted a form" ops
 * alert, which stays free like the rest of the core booking loop) additionally require the
 * `automatedBookingFlow` plan feature — see PLAN_GATED_AUTOMATION_TOGGLE_KEYS. When a property
 * isn't entitled, those keys are forced off regardless of the property's own saved setting.
 */

import { createClient } from './supabaseJs.ts';
import { isFeatureEnabled } from './planFeatures.ts';
import { resolvePropertyEntitlements } from './planEntitlements.ts';

export const PROPERTY_AUTOMATION_TOGGLE_KEYS = [
  'emailNewBookingRequest',
  'emailGafRequest',
  'emailBookingAcknowledgement',
  'emailPetRequest',
  'emailParkingBroadcast',
  'emailReadyForCheckin',
  'emailSdRefundCheckout',
] as const;

/** Subset of PROPERTY_AUTOMATION_TOGGLE_KEYS gated by the `automatedBookingFlow` plan feature. */
export const PLAN_GATED_AUTOMATION_TOGGLE_KEYS: readonly PropertyAutomationToggleKey[] = [
  'emailGafRequest',
  'emailBookingAcknowledgement',
  'emailPetRequest',
  'emailParkingBroadcast',
  'emailReadyForCheckin',
  'emailSdRefundCheckout',
];

export type PropertyAutomationToggleKey = (typeof PROPERTY_AUTOMATION_TOGGLE_KEYS)[number];

export type PropertyAutomationToggles = Record<PropertyAutomationToggleKey, boolean>;

export const DEFAULT_PROPERTY_AUTOMATION_TOGGLES: PropertyAutomationToggles = {
  emailNewBookingRequest: true,
  emailGafRequest: true,
  emailBookingAcknowledgement: true,
  emailPetRequest: true,
  emailParkingBroadcast: true,
  emailReadyForCheckin: true,
  emailSdRefundCheckout: true,
};

export function mergePropertyAutomationToggles(raw: unknown): PropertyAutomationToggles {
  const merged = { ...DEFAULT_PROPERTY_AUTOMATION_TOGGLES };
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return merged;
  }
  const record = raw as Record<string, unknown>;
  for (const key of PROPERTY_AUTOMATION_TOGGLE_KEYS) {
    if (typeof record[key] === 'boolean') {
      merged[key] = record[key];
    }
  }
  return merged;
}

export function parsePropertyAutomationTogglesPatch(
  body: unknown
): Partial<PropertyAutomationToggles> | null {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
  const record = body as Record<string, unknown>;
  const patch: Partial<PropertyAutomationToggles> = {};
  for (const key of PROPERTY_AUTOMATION_TOGGLE_KEYS) {
    if (typeof record[key] === 'boolean') {
      patch[key] = record[key];
    }
  }
  return Object.keys(patch).length > 0 ? patch : null;
}

async function loadAutomationTogglesRaw(propertyId: string): Promise<unknown> {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );
  const { data, error } = await supabase
    .from('app_settings')
    .select('automation_toggles')
    .eq('property_id', propertyId)
    .maybeSingle();

  if (error) {
    console.warn('[propertyAutomationToggles] load failed:', error.message);
    return null;
  }

  return data?.automation_toggles ?? null;
}

async function resolvePropertyAutomationState(propertyId: string): Promise<{
  toggles: PropertyAutomationToggles;
  /** Plan-gated keys that would be on per the property's own setting but are forced off by tier. */
  planBlockedKeys: PropertyAutomationToggleKey[];
}> {
  const raw = await loadAutomationTogglesRaw(propertyId);
  const rawMerged = mergePropertyAutomationToggles(raw);

  const entitlements = await resolvePropertyEntitlements(propertyId);
  if (isFeatureEnabled(entitlements, 'automatedBookingFlow')) {
    return { toggles: rawMerged, planBlockedKeys: [] };
  }

  const planBlockedKeys = PLAN_GATED_AUTOMATION_TOGGLE_KEYS.filter((key) => rawMerged[key]);
  const toggles = { ...rawMerged };
  for (const key of PLAN_GATED_AUTOMATION_TOGGLE_KEYS) toggles[key] = false;
  return { toggles, planBlockedKeys };
}

export async function resolvePropertyAutomationToggles(
  propertyId: string
): Promise<PropertyAutomationToggles> {
  const { toggles } = await resolvePropertyAutomationState(propertyId);
  return toggles;
}

/** Which plan-gated automation emails this property would send if not for its plan tier. */
export async function planBlockedAutomationToggleKeys(
  propertyId: string | null | undefined
): Promise<PropertyAutomationToggleKey[]> {
  if (!propertyId) return [];
  const { planBlockedKeys } = await resolvePropertyAutomationState(propertyId);
  return planBlockedKeys;
}

export async function propertyAutomationEnabled(
  propertyId: string | null | undefined,
  key: PropertyAutomationToggleKey
): Promise<boolean> {
  if (!propertyId) return true;
  const toggles = await resolvePropertyAutomationToggles(propertyId);
  return toggles[key];
}

/**
 * Same lookup, but WITHOUT the plan gate — only respects the property's own saved setting.
 * Use this for explicit admin-triggered manual sends (e.g. `send-sd-refund-form-email`), which
 * are the manual fallback for when `propertyAutomationEnabled` blocks the automatic path; those
 * must stay usable regardless of plan tier, or there is no way left to send the email at all.
 */
export async function rawPropertyAutomationEnabled(
  propertyId: string | null | undefined,
  key: PropertyAutomationToggleKey
): Promise<boolean> {
  if (!propertyId) return true;
  const raw = await loadAutomationTogglesRaw(propertyId);
  return mergePropertyAutomationToggles(raw)[key];
}
