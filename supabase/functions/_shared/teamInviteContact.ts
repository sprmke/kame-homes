import { validatePhilippineMobilePhone } from './fieldValidation.ts';

export type ParsedTeamInviteContact = {
  contactPhone: string;
};

export function parseTeamInviteContactFields(
  body: Record<string, unknown>
): ParsedTeamInviteContact {
  const contactPhoneRaw = typeof body.contactPhone === 'string' ? body.contactPhone.trim() : '';
  if (!contactPhoneRaw) {
    throw new Error('Phone number is required');
  }
  const phoneErr = validatePhilippineMobilePhone(contactPhoneRaw);
  if (phoneErr) throw new Error(phoneErr);

  return {
    contactPhone: contactPhoneRaw.replace(/\s+/g, ''),
  };
}
