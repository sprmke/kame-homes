/** Preset reasons for Super Admin hard reject (not for “Request changes”). */
export const HOST_REJECTION_REASON_OPTIONS = [
  {
    id: 'fraud_or_misrepresentation',
    label: 'Suspected fraud or misrepresentation',
  },
  {
    id: 'identity_mismatch',
    label: 'Identity does not match the documents provided',
  },
  {
    id: 'ownership_unproven',
    label: 'Unable to verify property ownership or authorization',
  },
  {
    id: 'fraud_history',
    label: 'History of fraud or scam activity',
  },
  {
    id: 'duplicate_or_suspicious',
    label: 'Duplicate or suspicious account or listing',
  },
] as const;

export type HostRejectionReasonId = (typeof HOST_REJECTION_REASON_OPTIONS)[number]['id'];

export function hostRejectionReasonLabel(id: HostRejectionReasonId): string {
  return HOST_REJECTION_REASON_OPTIONS.find((option) => option.id === id)?.label ?? id;
}

/** Compose the host-facing rejection message from a preset + optional note. */
export function buildRejectionMessage(
  reasonId: HostRejectionReasonId | '',
  customNote: string
): string | null {
  if (!reasonId) return null;
  const label = hostRejectionReasonLabel(reasonId);
  const note = customNote.trim();
  if (!note) return label;
  return `${label}\n\n${note}`;
}
