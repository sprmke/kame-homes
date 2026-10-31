/**
 * Outbound workflow-email packages — must be on file before manual send.
 * UI mirror: `ui/.../workflowEmailSendPrerequisites.ts`.
 */

function hasUrl(v: unknown): boolean {
  return typeof v === 'string' && v.trim() !== '';
}

type GafRequestSendBookingFields = {
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

function firstMissingGafRequestValidIdLabel(booking: GafRequestSendBookingFields): string | null {
  if (!hasUrl(booking.valid_id_url)) return 'Valid ID';

  const additional = [
    { name: booking.guest2_name, url: booking.guest2_valid_id_url, position: 2 },
    { name: booking.guest3_name, url: booking.guest3_valid_id_url, position: 3 },
    { name: booking.guest4_name, url: booking.guest4_valid_id_url, position: 4 },
    { name: booking.guest5_name, url: booking.guest5_valid_id_url, position: 5 },
  ];

  for (const guest of additional) {
    if (guest.name?.trim() && !hasUrl(guest.url)) {
      return `Valid ID · Guest ${guest.position}`;
    }
  }

  return null;
}

export function gafRequestSendBlockReason(booking: GafRequestSendBookingFields): string | null {
  const label = firstMissingGafRequestValidIdLabel(booking);
  if (!label) return null;
  return `Upload ${label} on GAF Approval before sending the GAF request.`;
}

type PetRequestSendBookingFields = {
  pet_vaccination_url?: string | null;
  pet_image_url?: string | null;
};

function firstMissingPetRequestSendLabel(booking: PetRequestSendBookingFields): string | null {
  if (!hasUrl(booking.pet_vaccination_url)) return 'Vaccination';
  if (!hasUrl(booking.pet_image_url)) return 'Pet photo';
  return null;
}

export function petRequestSendBlockReason(booking: PetRequestSendBookingFields): string | null {
  const label = firstMissingPetRequestSendLabel(booking);
  if (!label) return null;
  return `Upload ${label} on the pet approval step before sending the pet request.`;
}
