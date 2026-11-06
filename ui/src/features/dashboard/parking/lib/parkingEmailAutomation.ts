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

/** Email toggles only — rendered in the "Email automation" section. */
export const PARKING_EMAIL_AUTOMATION_TOGGLE_KEYS = [
  'emailParkingReservationRequest',
  'emailParkingGuestConfirmed',
  'emailParkingNoHostAvailable',
] as const satisfies readonly ParkingAutomationToggleKey[];

export const PARKING_AUTOMATION_TOGGLE_LABELS: Record<ParkingAutomationToggleKey, string> = {
  emailParkingReservationRequest: 'Reservation request',
  emailParkingGuestConfirmed: 'Guest confirmed',
  emailParkingNoHostAvailable: 'No host available',
  autoAcceptTopMatch: 'Auto-accept top match',
};

/** Who gets each parking automation email and when it sends. */
export const PARKING_EMAIL_AUTOMATION_COPY: Record<
  Extract<
    ParkingAutomationToggleKey,
    'emailParkingReservationRequest' | 'emailParkingGuestConfirmed' | 'emailParkingNoHostAvailable'
  >,
  { recipient: string; trigger: string }
> = {
  emailParkingReservationRequest: {
    recipient: 'You',
    trigger: 'When a guest asks to book this slot.',
  },
  emailParkingGuestConfirmed: {
    recipient: 'Guest',
    trigger: 'When their parking is confirmed and paid.',
  },
  emailParkingNoHostAvailable: {
    recipient: 'Guest',
    trigger: 'When no slot could be matched in time.',
  },
};

export function mergeParkingAutomationToggles(raw: unknown): ParkingAutomationToggles {
  const merged = { ...DEFAULT_PARKING_AUTOMATION_TOGGLES };
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return merged;
  const record = raw as Record<string, unknown>;
  for (const key of PARKING_AUTOMATION_TOGGLE_KEYS) {
    if (typeof record[key] === 'boolean') merged[key] = record[key];
  }
  return merged;
}
