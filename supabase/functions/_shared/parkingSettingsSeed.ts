/**
 * Seed per-parking settings on create-parking (idempotent).
 */

import { createServiceClient } from './orgAuth.ts';

const DEFAULT_PARKING_NOTIFICATION_TEMPLATES = {
  reservation_request: 'New parking reservation request for {{slot_label}}.',
  check_in_reminder: 'Parking check-in reminder: {{slot_label}} on {{check_in_date}}.',
  payment_received: 'Payment received for parking {{slot_label}}.',
};

const DEFAULT_SEED_WEEKDAY_RATE = 300;
const DEFAULT_SEED_WEEKEND_RATE = 400;

/**
 * `initialRate` is the nightly rate the host entered at create time. Guests are charged
 * from parking_settings, so seeding it here keeps the public price, the detail page,
 * and checkout on the host's number instead of the 300/400 defaults.
 */
export async function seedParkingSettings(
  parkingId: string,
  initialRate?: number | null
): Promise<void> {
  const supabase = createServiceClient();
  const hasRate = typeof initialRate === 'number' && Number.isFinite(initialRate) && initialRate >= 0;
  const { error } = await supabase.from('parking_settings').upsert(
    {
      parking_id: parkingId,
      weekday_nightly_rate: hasRate ? initialRate : DEFAULT_SEED_WEEKDAY_RATE,
      weekend_nightly_rate: hasRate ? initialRate : DEFAULT_SEED_WEEKEND_RATE,
      parking_notification_templates: DEFAULT_PARKING_NOTIFICATION_TEMPLATES,
    },
    { onConflict: 'parking_id', ignoreDuplicates: true }
  );
  if (error) {
    console.error('[parkingSettingsSeed]', error.message);
    throw new Error('Failed to seed parking settings');
  }
}

export async function ensureParkingSettings(parkingId: string): Promise<void> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from('parking_settings')
    .select('parking_id')
    .eq('parking_id', parkingId)
    .maybeSingle();
  if (!data) {
    await seedParkingSettings(parkingId);
  }
}
