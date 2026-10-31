/** Primary label for booking / finance list guest cells (matches Bookings table). */
export function bookingListDisplayName(row: {
  primary_guest_name?: string | null;
  guest_facebook_name?: string | null;
  guest_email?: string | null;
}): string {
  const primary = row.primary_guest_name?.trim();
  const facebook = row.guest_facebook_name?.trim();
  const email = row.guest_email?.trim();
  return primary || facebook || email || 'Guest';
}
