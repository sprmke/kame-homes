/**
 * Parking broadcast — candidate matching, TTL, host recipient resolution, fan-out.
 * Notify/side-effect glue only; the status graph lives in `parkingStatusMachine.ts`.
 */

import type { SupabaseClient } from './supabaseJs.ts';

import { resolveAppSettings } from './appSettings.ts';
import { createServiceClient, type ParkingRow } from './orgAuth.ts';
import { parkingDatesOverlap } from './parkingDateOverlap.ts';
import { hasParkingBlockedNightsInRange } from './parkingBlockedDates.ts';
import { parkingAutomationEnabled } from './parkingAutomationToggles.ts';
import { minutesBetweenTimes } from './cleaningBuffer.ts';
import {
  getOrgSlug,
  sendParkingReservationRequestEmail,
  type ParkingReservationRequestEmailInput,
} from './parkingBroadcastEmail.ts';
import { loadParkingTelegramSettingsRow, templateTextForKey } from './telegramParking.ts';
import { resolvePropertyTelegramCredentials } from './propertyTelegramCredentials.ts';
import {
  PARKING_BATCH_SIZE,
  PARKING_TURNOVER_BUFFER_MINUTES,
  rankAndDedupeParkingCandidates,
  type RankedParkingCandidate,
} from './parkingBroadcastRanking.ts';
import { selectInIdChunks } from './postgrestInChunks.ts';

/**
 * Non-terminal (or effectively-still-occupying) statuses for date-overlap purposes.
 * Matches the host-broadcast spec: exclude only CANCELLED / NO_HOST_AVAILABLE — a
 * COMPLETED booking still occupied its dates and must still block an overlapping
 * new request for the same slot.
 */
const OCCUPYING_STATUSES = [
  'PENDING_HOST_ACCEPTANCE',
  'PENDING_PAYMENT',
  'PENDING_REVIEW',
  'READY_FOR_CHECKIN',
  'COMPLETED',
];

/** Same-day check-in (Asia/Manila) gets a short TTL; everything else gets the standard window. */
export function parkingBroadcastTtlMs(
  checkInDateManila: string,
  nowMs: number = Date.now()
): number {
  const todayManila = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(nowMs));
  return checkInDateManila === todayManila ? 15 * 60_000 : 60 * 60_000;
}

export type ParkingBroadcastCandidate = Pick<
  ParkingRow,
  | 'id'
  | 'name'
  | 'slug'
  | 'organization_id'
  | 'residence_name'
  | 'tower'
  | 'level'
  | 'slot_label'
  | 'created_at'
  | 'settings'
>;

/**
 * Eligible parkings for a broadcast request: same org, ACTIVE, accepts the requested
 * vehicle type, not pinned-out, and no date-overlapping non-terminal booking.
 */
export async function findParkingBroadcastCandidates(input: {
  organizationId: string;
  requestedVehicleType: 'car' | 'motorcycle';
  checkInDate: string;
  checkOutDate: string;
  pinnedParkingId?: string | null;
  excludeParkingIds?: string[];
}): Promise<ParkingBroadcastCandidate[]> {
  const supabase = createServiceClient();

  let query = supabase
    .from('parkings')
    .select(
      'id, name, slug, organization_id, residence_name, tower, level, slot_label, created_at, settings'
    )
    .eq('organization_id', input.organizationId)
    .eq('status', 'ACTIVE')
    .contains('accepted_vehicle_types', [input.requestedVehicleType]);

  if (input.pinnedParkingId) {
    query = query.eq('id', input.pinnedParkingId);
  }
  if (input.excludeParkingIds && input.excludeParkingIds.length > 0) {
    query = query.not('id', 'in', `(${input.excludeParkingIds.join(',')})`);
  }

  const { data: parkings, error } = await query;
  if (error) {
    throw new Error(`findParkingBroadcastCandidates: ${error.message}`);
  }
  const candidates = (parkings ?? []) as ParkingBroadcastCandidate[];
  if (candidates.length === 0) return [];
  const candidatesById = new Map(candidates.map((c) => [c.id, c]));

  const parkingIds = candidates.map((c) => c.id);
  // Large orgs (100+ slots) blow PostgREST URI limits on a single `.in()` — chunk.
  let occupying: Array<{
    parking_id: string | null;
    parking_check_in_date: string | null;
    parking_check_out_date: string | null;
    check_in_date: string | null;
    check_out_date: string | null;
  }>;
  try {
    occupying = await selectInIdChunks(parkingIds, (chunk) =>
      supabase
        .from('guest_submissions')
        .select(
          'parking_id, parking_check_in_date, parking_check_out_date, check_in_date, check_out_date'
        )
        .in('parking_id', chunk)
        .in('status', OCCUPYING_STATUSES)
    );
  } catch (err) {
    throw new Error(
      `findParkingBroadcastCandidates (occupancy): ${err instanceof Error ? err.message : err}`
    );
  }

  const conflictedParkingIds = new Set<string>();
  for (const row of occupying) {
    const parkingId = row.parking_id as string | null;
    if (!parkingId) continue;
    const existingCheckIn = String(row.parking_check_in_date ?? row.check_in_date ?? '');
    const existingCheckOut = String(row.parking_check_out_date ?? row.check_out_date ?? '');
    if (!existingCheckIn || !existingCheckOut) continue;

    if (
      parkingDatesOverlap(input.checkInDate, input.checkOutDate, existingCheckIn, existingCheckOut)
    ) {
      conflictedParkingIds.add(parkingId);
      continue;
    }

    // Same-day back-to-back (decision #5): not a date-range overlap, but still needs the
    // locked 30 min turnover buffer between the two bookings on this exact slot.
    const isSameDayTurnover =
      input.checkInDate === existingCheckOut || input.checkOutDate === existingCheckIn;
    if (!isSameDayTurnover) continue;

    const candidate = candidatesById.get(parkingId);
    const settings = (candidate?.settings ?? {}) as Record<string, unknown>;
    const listingCheckInTime =
      typeof settings.checkInTime === 'string' && settings.checkInTime.trim()
        ? settings.checkInTime.trim()
        : '14:00';
    const listingCheckOutTime =
      typeof settings.checkOutTime === 'string' && settings.checkOutTime.trim()
        ? settings.checkOutTime.trim()
        : '12:00';
    const gapMinutes = minutesBetweenTimes(listingCheckOutTime, listingCheckInTime);
    if (gapMinutes < PARKING_TURNOVER_BUFFER_MINUTES) {
      conflictedParkingIds.add(parkingId);
    }
  }

  const withoutBookingConflicts = candidates.filter((c) => !conflictedParkingIds.has(c.id));
  const available: ParkingBroadcastCandidate[] = [];
  for (const candidate of withoutBookingConflicts) {
    const blocked = await hasParkingBlockedNightsInRange(
      candidate.id,
      input.checkInDate,
      input.checkOutDate
    );
    if (!blocked) available.push(candidate);
  }
  return available;
}

/**
 * Resolves the next ranked, deduped, price-capped batch of up to `PARKING_BATCH_SIZE`
 * candidates for a booking — excluding any parking already broadcast to in a prior batch.
 * Used for both the initial batch (submit) and every subsequent batch (batch-advance).
 */
export async function resolveNextParkingBatch(input: {
  organizationId: string;
  requestedVehicleType: 'car' | 'motorcycle';
  checkInDate: string;
  checkOutDate: string;
  pinnedParkingId?: string | null;
  excludeParkingIds?: string[];
}): Promise<RankedParkingCandidate[]> {
  const rawCandidates = await findParkingBroadcastCandidates(input);
  if (rawCandidates.length === 0) return [];
  const ranked = await rankAndDedupeParkingCandidates(
    rawCandidates,
    input.checkInDate,
    input.checkOutDate
  );
  return ranked.slice(0, PARKING_BATCH_SIZE);
}

export type ParkingHostRecipient = { userId: string; email: string };

/** Owner + active org ADMINs + active parking_members with bookings:edit, de-duplicated by email. */
export async function resolveParkingHostRecipients(
  supabase: SupabaseClient,
  parking: Pick<ParkingRow, 'id' | 'organization_id'>
): Promise<ParkingHostRecipient[]> {
  const { data: org } = await supabase
    .from('organizations')
    .select('owner_id')
    .eq('id', parking.organization_id)
    .maybeSingle();

  const userIds = new Set<string>();
  if (org?.owner_id) userIds.add(String(org.owner_id));

  const { data: orgAdmins } = await supabase
    .from('organization_members')
    .select('user_id')
    .eq('organization_id', parking.organization_id)
    .eq('status', 'active')
  for (const row of orgAdmins ?? []) userIds.add(String(row.user_id));

  const { data: members } = await supabase
    .from('parking_members')
    .select('user_id, role_id, permissions, status')
    .eq('parking_id', parking.id)
    .eq('status', 'active');
  for (const row of members ?? []) {
    const permissions = Array.isArray(row.permissions) ? (row.permissions as string[]) : [];
    if (
      row.role_id === 'MANAGER' ||
      row.role_id === 'STAFF' ||
      permissions.includes('bookings:edit')
    ) {
      userIds.add(String(row.user_id));
    }
  }

  const recipients: ParkingHostRecipient[] = [];
  const seenEmails = new Set<string>();
  for (const userId of userIds) {
    const { data, error } = await supabase.auth.admin.getUserById(userId);
    const email = data?.user?.email?.trim().toLowerCase();
    if (error || !email || seenEmails.has(email)) continue;
    seenEmails.add(email);
    recipients.push({ userId, email });
  }
  return recipients;
}

export type ParkingHostContact = { name: string; email: string; phone: string | null };

/**
 * Phase 5 guest-facing contact reveal — the same recipient pool as `resolveParkingHostRecipients`
 * (owner first, by Set insertion order), enriched with `parking_members.display_name`/
 * `contact_phone` when available. Caller (`get-parking-booking-status`) gates this on
 * `endorsement_sent_at IS NOT NULL` — never call before endorsement is sent.
 */
export async function resolveParkingHostContact(
  supabase: SupabaseClient,
  parking: Pick<ParkingRow, 'id' | 'organization_id'>
): Promise<ParkingHostContact | null> {
  const recipients = await resolveParkingHostRecipients(supabase, parking);
  if (recipients.length === 0) return null;
  const primary = recipients[0];

  const [{ data: memberRow }, { data: userData }] = await Promise.all([
    supabase
      .from('parking_members')
      .select('display_name, contact_phone')
      .eq('parking_id', parking.id)
      .eq('user_id', primary.userId)
      .maybeSingle(),
    supabase.auth.admin.getUserById(primary.userId),
  ]);

  const authName =
    (userData?.user?.user_metadata?.full_name as string | undefined) ||
    (userData?.user?.user_metadata?.name as string | undefined) ||
    '';

  return {
    name: (memberRow?.display_name as string | undefined)?.trim() || authName || 'Parking host',
    email: primary.email,
    phone: (memberRow?.contact_phone as string | undefined)?.trim() || null,
  };
}

export type ParkingBroadcastBookingInput = {
  id: string;
  guestName: string;
  checkInDate: string;
  checkOutDate: string;
  expiresAtIso: string;
};

/**
 * Inserts a `pending` broadcast row per ranked candidate (stamped with `batchNumber` and the
 * host_gross it was ranked on) and notifies (Telegram + email). Notify failures are logged
 * and skipped per-candidate — never rolls back the booking. Used for both the initial batch
 * (submit) and every subsequent batch (`advanceOrTerminateParkingBatch`).
 */
export async function fanOutParkingBroadcast(
  booking: ParkingBroadcastBookingInput,
  ranked: RankedParkingCandidate[],
  batchNumber = 1,
  options?: { skipNotify?: boolean }
): Promise<void> {
  if (ranked.length === 0) return;
  const supabase = createServiceClient();
  const skipNotify = options?.skipNotify === true;

  const { error: insertError } = await supabase.from('parking_booking_broadcasts').insert(
    ranked.map(({ candidate, hostGross }) => ({
      booking_id: booking.id,
      parking_id: candidate.id,
      response: 'pending',
      batch_number: batchNumber,
      host_gross_at_broadcast: hostGross,
    }))
  );
  if (insertError) {
    throw new Error(`fanOutParkingBroadcast insert: ${insertError.message}`);
  }

  if (skipNotify) return;

  await Promise.all(
    ranked.map(async ({ candidate }) => {
      try {
        await notifyParkingCandidate(supabase, booking, candidate);
      } catch (err) {
        console.error(
          `[fanOutParkingBroadcast] notify failed for parking ${candidate.id}:`,
          err instanceof Error ? err.message : err
        );
      }
      const { error } = await supabase
        .from('parking_booking_broadcasts')
        .update({ notified_at: new Date().toISOString() })
        .eq('booking_id', booking.id)
        .eq('parking_id', candidate.id);
      if (error) {
        console.error(`[fanOutParkingBroadcast] notified_at update failed:`, error.message);
      }
    })
  );
}

function parkingSlotLabel(candidate: ParkingBroadcastCandidate): string {
  return [candidate.slot_label, candidate.tower].filter(Boolean).join(' · ') || candidate.name;
}

/** Deep link straight to the specific booking's Accept/Decline screen — Telegram has no CTA button. */
async function buildParkingBookingDeepLink(
  candidate: ParkingBroadcastCandidate,
  bookingId: string
): Promise<string | null> {
  if (!candidate.slug) return null;
  const orgSlug = await getOrgSlug(candidate.organization_id);
  if (!orgSlug) return null;
  const { publicGuestAppOrigin } = await resolveAppSettings(null);
  return `${publicGuestAppOrigin.replace(/\/+$/, '')}/org/${orgSlug}/parking/${candidate.slug}/bookings/${bookingId}`;
}

async function notifyParkingCandidate(
  supabase: SupabaseClient,
  booking: ParkingBroadcastBookingInput,
  candidate: ParkingBroadcastCandidate
): Promise<void> {
  const recipients = await resolveParkingHostRecipients(supabase, candidate);
  if (recipients.length === 0) return;

  await sendParkingReservationRequestTelegram(candidate, booking);

  const emailEnabled = await parkingAutomationEnabled(
    candidate.id,
    'emailParkingReservationRequest'
  );
  if (!emailEnabled) return;

  const emailInput: Omit<ParkingReservationRequestEmailInput, 'to'> = {
    parking: candidate,
    guestName: booking.guestName,
    checkInDate: booking.checkInDate,
    checkOutDate: booking.checkOutDate,
    expiresAtIso: booking.expiresAtIso,
    bookingId: booking.id,
  };

  await Promise.all(
    recipients.map((recipient) =>
      sendParkingReservationRequestEmail({ ...emailInput, to: recipient.email }).catch((err) => {
        console.error(
          `[notifyParkingCandidate] email failed for ${recipient.email}:`,
          err instanceof Error ? err.message : err
        );
      })
    )
  );
}

async function sendParkingReservationRequestTelegram(
  candidate: ParkingBroadcastCandidate,
  booking: ParkingBroadcastBookingInput
): Promise<void> {
  const settingsRow = await loadParkingTelegramSettingsRow(candidate.id);
  const enabled = Boolean(settingsRow.enabled);
  const notifyOnRequest = settingsRow.notify_on_reservation_request !== false;
  if (!enabled || !notifyOnRequest) return;

  const creds = await resolvePropertyTelegramCredentials('parking', { parkingId: candidate.id });
  if (!creds.ok) return;

  const template = templateTextForKey(settingsRow, 'reservation_request');
  const expiresLabel = new Date(booking.expiresAtIso).toLocaleString('en-PH', {
    timeZone: 'Asia/Manila',
    hour: 'numeric',
    minute: '2-digit',
    month: 'short',
    day: 'numeric',
  });
  const text = template
    .replaceAll('{{slot_label}}', parkingSlotLabel(candidate))
    .replaceAll('{{check_in_date}}', booking.checkInDate)
    .replaceAll('{{guest_name}}', booking.guestName)
    .replaceAll('{{expires_at}}', expiresLabel)
    .replaceAll('{{booking_id}}', booking.id.slice(0, 8));

  const deepLink = await buildParkingBookingDeepLink(candidate, booking.id);
  const fullText = deepLink ? `${text}\n\n${deepLink}` : text;

  const url = `https://api.telegram.org/bot${creds.token}/sendMessage`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: creds.chatId,
      text: fullText.slice(0, 4096),
      disable_web_page_preview: true,
    }),
  });
  const json = (await res.json().catch(() => ({}))) as { ok?: boolean; description?: string };
  if (!json.ok) {
    console.error(`[sendParkingReservationRequestTelegram] ${candidate.id}:`, json.description);
  }
}
