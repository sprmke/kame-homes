import { validatePhilippineMobilePhone } from '@/lib/validation/fieldValidation';

import { isAllowedTeamInviteEmail, teamInviteEmailLooksInvalid } from './teamInviteEmail';

export type TeamInviteContactDraft = {
  email: string;
  contactPhone: string;
};

export function teamInvitePhoneError(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return 'Enter a phone number';
  return validatePhilippineMobilePhone(trimmed);
}

export function canSubmitTeamInvite(draft: TeamInviteContactDraft, submitPending = false): boolean {
  if (submitPending) return false;
  if (!draft.email.trim() || !isAllowedTeamInviteEmail(draft.email)) return false;
  if (teamInviteEmailLooksInvalid(draft.email)) return false;
  if (teamInvitePhoneError(draft.contactPhone)) return false;
  return true;
}
