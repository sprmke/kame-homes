/**
 * Per-parking automation master switches (`parking_settings.automation_toggles`) — email
 * sends plus (Phase 5) `autoAcceptTopMatch`, which isn't an email setting but shares this same
 * JSONB bag rather than adding a dedicated column.
 */

import { createServiceClient } from './orgAuth.ts';

export const PARKING_AUTOMATION_TOGGLE_KEYS = [
  'emailParkingReservationRequest',
  'emailParkingGuestConfirmed',
  'emailParkingNoHostAvailable',
  'autoAcceptTopMatch',
] as const;

export type ParkingAutomationToggleKey = (typeof PARKING_AUTOMATION_TOGGLE_KEYS)[number];

export type ParkingAutomationToggles = Record<ParkingAutomationToggleKey, boolean>;

export const DEFAULT_PARKING_AUTOMATION_TOGGLES: ParkingAutomationToggles = {
  emailParkingReservationRequest: true,
  emailParkingGuestConfirmed: true,
  emailParkingNoHostAvailable: true,
  autoAcceptTopMatch: false,
};

export function mergeParkingAutomationToggles(raw: unknown): ParkingAutomationToggles {
  const merged = { ...DEFAULT_PARKING_AUTOMATION_TOGGLES };
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return merged;
  }
  const record = raw as Record<string, unknown>;
  for (const key of PARKING_AUTOMATION_TOGGLE_KEYS) {
    if (typeof record[key] === 'boolean') {
      merged[key] = record[key];
    }
  }
  return merged;
}

export function parseParkingAutomationTogglesPatch(
  body: unknown
): Partial<ParkingAutomationToggles> | null {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
  const record = body as Record<string, unknown>;
  const patch: Partial<ParkingAutomationToggles> = {};
  for (const key of PARKING_AUTOMATION_TOGGLE_KEYS) {
    if (typeof record[key] === 'boolean') {
      patch[key] = record[key];
    }
  }
  return Object.keys(patch).length > 0 ? patch : null;
}

export async function resolveParkingAutomationToggles(
  parkingId: string
): Promise<ParkingAutomationToggles> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('parking_settings')
    .select('automation_toggles')
    .eq('parking_id', parkingId)
    .maybeSingle();

  if (error) {
    console.warn('[parkingAutomationToggles] load failed:', error.message);
    return { ...DEFAULT_PARKING_AUTOMATION_TOGGLES };
  }

  return mergeParkingAutomationToggles(data?.automation_toggles);
}

export async function parkingAutomationEnabled(
  parkingId: string | null | undefined,
  key: ParkingAutomationToggleKey
): Promise<boolean> {
  if (!parkingId) return true;
  const toggles = await resolveParkingAutomationToggles(parkingId);
  return toggles[key];
}
