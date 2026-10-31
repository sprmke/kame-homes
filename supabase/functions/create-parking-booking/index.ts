/**
 * create-parking-booking — Admin insert for parking-only reservations.
 * No stay workflow orchestrator; guest public submit e2e is a follow-up.
 */

import { DatabaseService } from '../_shared/databaseService.ts';
import {
  jsonError,
  jsonResponse,
  readJsonBody,
  requireHttpMethod,
} from '../_shared/httpResponse.ts';
import { verifyParkingTeamAccess } from '../_shared/orgAuth.ts';
import { readParkingIdFromUrl } from '../_shared/parkingScope.ts';
import { serveAuthenticated } from '../_shared/serveEdge.ts';

const DATE_RE = /^\d{2}-\d{2}-\d{4}$/;

function nightsBetween(checkIn: string, checkOut: string): number {
  const toIso = (mmddyyyy: string) => {
    const [mm, dd, yyyy] = mmddyyyy.split('-');
    return `${yyyy}-${mm}-${dd}`;
  };
  const start = new Date(`${toIso(checkIn)}T00:00:00Z`).getTime();
  const end = new Date(`${toIso(checkOut)}T00:00:00Z`).getTime();
  const diff = Math.round((end - start) / (24 * 60 * 60 * 1000));
  return diff > 0 ? diff : 1;
}

serveAuthenticated('create-parking-booking', async (req) => {
  requireHttpMethod(req, 'POST');
  const url = new URL(req.url);
  const parkingIdFromUrl = readParkingIdFromUrl(url);
  const body = await readJsonBody(req);
  const parkingId = String(body.parkingId ?? parkingIdFromUrl ?? '').trim();
  if (!parkingId) {
    return jsonError(req, 'parking_id is required');
  }

  const { parking: parkingRow } = await verifyParkingTeamAccess(req, parkingId, 'bookings:edit');

  const primaryGuestName = String(body.primaryGuestName ?? '').trim();
  const guestEmail = String(body.guestEmail ?? '').trim();
  const guestPhoneNumber = String(body.guestPhoneNumber ?? '').trim();
  const checkInDate = String(body.checkInDate ?? '').trim();
  const checkOutDate = String(body.checkOutDate ?? '').trim();
  const carPlateNumber = String(body.carPlateNumber ?? '').trim();

  if (!primaryGuestName || !guestEmail || !guestPhoneNumber) {
    return jsonError(req, 'Guest name, email, and phone are required');
  }
  if (!DATE_RE.test(checkInDate) || !DATE_RE.test(checkOutDate)) {
    return jsonError(req, 'Dates must be MM-DD-YYYY');
  }
  if (!carPlateNumber) {
    return jsonError(req, 'Plate number is required');
  }

  const numberOfNights = nightsBetween(checkInDate, checkOutDate);
  const parkingLabel =
    [parkingRow.slot_label, parkingRow.tower].filter(Boolean).join(' · ') || parkingRow.name;

  const row = await DatabaseService.createParkingBooking({
    parkingId,
    primaryGuestName,
    guestEmail,
    guestPhoneNumber,
    checkInDate,
    checkOutDate,
    numberOfNights,
    carPlateNumber,
    carBrandModel: body.carBrandModel ? String(body.carBrandModel) : null,
    carColor: body.carColor ? String(body.carColor) : null,
    parkingLabel,
    residenceName: parkingRow.residence_name,
  });

  return jsonResponse(req, { success: true, data: row });
});
