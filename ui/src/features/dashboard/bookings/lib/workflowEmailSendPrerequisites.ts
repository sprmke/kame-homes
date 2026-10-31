/**
 * Outbound workflow-email packages — must be on file before Send is enabled.
 * Mirrors GAF / pet rows in `WorkflowPendingDocStatusCard` Sent Docs groups.
 */

export type WorkflowSendPrerequisiteRow = { label: string; missing: boolean };

function hasUrl(v: unknown): boolean {
  return typeof v === 'string' && v.trim() !== '';
}

export type GafRequestSendBookingFields = {
  valid_id_url?: string | null;
  guest2_name?: string | null;
  guest2_valid_id_url?: string | null;
  guest3_name?: string | null;
  guest3_valid_id_url?: string | null;
  guest4_name?: string | null;
  guest4_valid_id_url?: string | null;
  guest5_name?: string | null;
  guest5_valid_id_url?: string | null;
};

export function gafRequestValidIdPrerequisiteRows(
  booking: GafRequestSendBookingFields
): WorkflowSendPrerequisiteRow[] {
  const rows: WorkflowSendPrerequisiteRow[] = [
    { label: 'Valid ID', missing: !hasUrl(booking.valid_id_url) },
  ];

  const additional = [
    { name: booking.guest2_name, url: booking.guest2_valid_id_url, position: 2 },
    { name: booking.guest3_name, url: booking.guest3_valid_id_url, position: 3 },
    { name: booking.guest4_name, url: booking.guest4_valid_id_url, position: 4 },
    { name: booking.guest5_name, url: booking.guest5_valid_id_url, position: 5 },
  ];

  for (const guest of additional) {
    if (guest.name?.trim()) {
      rows.push({
        label: `Valid ID · Guest ${guest.position}`,
        missing: !hasUrl(guest.url),
      });
    }
  }

  return rows;
}

export function firstMissingGafRequestValidIdLabel(
  booking: GafRequestSendBookingFields
): string | null {
  return gafRequestValidIdPrerequisiteRows(booking).find((row) => row.missing)?.label ?? null;
}

export function gafRequestValidIdsReady(booking: GafRequestSendBookingFields): boolean {
  return firstMissingGafRequestValidIdLabel(booking) == null;
}

export function gafRequestSendDisabledReason(booking: GafRequestSendBookingFields): string | null {
  const label = firstMissingGafRequestValidIdLabel(booking);
  if (!label) return null;
  return `Upload ${label} on GAF Approval first.`;
}

export type PetRequestSendBookingFields = {
  pet_vaccination_url?: string | null;
  pet_image_url?: string | null;
};

export function petRequestSendPrerequisiteRows(
  booking: PetRequestSendBookingFields
): WorkflowSendPrerequisiteRow[] {
  return [
    { label: 'Vaccination', missing: !hasUrl(booking.pet_vaccination_url) },
    { label: 'Pet photo', missing: !hasUrl(booking.pet_image_url) },
  ];
}

export function firstMissingPetRequestSendLabel(
  booking: PetRequestSendBookingFields
): string | null {
  return petRequestSendPrerequisiteRows(booking).find((row) => row.missing)?.label ?? null;
}

export function petRequestSendDisabledReason(booking: PetRequestSendBookingFields): string | null {
  const label = firstMissingPetRequestSendLabel(booking);
  if (!label) return null;
  return `Upload ${label} on the pet approval step first.`;
}
