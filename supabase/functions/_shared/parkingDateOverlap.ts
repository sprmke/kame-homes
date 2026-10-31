/** Parking stay-date overlap helpers. Dates are stored MM-DD-YYYY (see `guest_submissions`). */

function parseMmDdYyyy(value: string): number {
  const [mm, dd, yyyy] = value.split('-');
  return new Date(`${yyyy}-${mm}-${dd}T00:00:00Z`).getTime();
}

/** Half-open interval overlap: [checkIn, checkOut). A same-day checkout/check-in does not conflict. */
export function parkingDatesOverlap(
  aCheckIn: string,
  aCheckOut: string,
  bCheckIn: string,
  bCheckOut: string
): boolean {
  const aStart = parseMmDdYyyy(aCheckIn);
  const aEnd = parseMmDdYyyy(aCheckOut);
  const bStart = parseMmDdYyyy(bCheckIn);
  const bEnd = parseMmDdYyyy(bCheckOut);
  return aStart < bEnd && aEnd > bStart;
}
