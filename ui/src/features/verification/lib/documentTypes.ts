/** Accepted identity documents and the capture shape each one needs. */

export type IdentityDocumentType =
  | 'philid'
  | 'ephilid'
  | 'passport'
  | 'drivers_license'
  | 'umid'
  | 'sss'
  | 'philhealth'
  | 'postal'
  | 'voters'
  | 'prc'
  | 'other';

export type IdentityCaptureMethod = 'philsys_qr' | 'document' | 'passport';

export type IdentityDocumentDefinition = {
  value: IdentityDocumentType;
  label: string;
  /** Capture the reverse side too. */
  needsBack: boolean;
  /** A machine-readable zone we can validate with checksums. */
  hasMrz: boolean;
  /** Offers the QR scan step. */
  hasQr: boolean;
};

export const IDENTITY_DOCUMENTS: readonly IdentityDocumentDefinition[] = [
  { value: 'philid', label: 'PhilSys ID', needsBack: false, hasMrz: false, hasQr: true },
  { value: 'ephilid', label: 'ePhilID', needsBack: false, hasMrz: false, hasQr: true },
  { value: 'passport', label: 'Passport', needsBack: false, hasMrz: true, hasQr: false },
  { value: 'drivers_license', label: "Driver's license", needsBack: true, hasMrz: false, hasQr: false },
  { value: 'umid', label: 'UMID', needsBack: true, hasMrz: false, hasQr: false },
  { value: 'sss', label: 'SSS ID', needsBack: false, hasMrz: false, hasQr: false },
  { value: 'philhealth', label: 'PhilHealth ID', needsBack: false, hasMrz: false, hasQr: false },
  { value: 'postal', label: 'Postal ID', needsBack: false, hasMrz: false, hasQr: false },
  { value: 'voters', label: "Voter's ID", needsBack: false, hasMrz: false, hasQr: false },
  { value: 'prc', label: 'PRC ID', needsBack: false, hasMrz: false, hasQr: false },
  { value: 'other', label: 'Other government ID', needsBack: false, hasMrz: false, hasQr: false },
];

export function findIdentityDocument(value: string | null | undefined): IdentityDocumentDefinition | null {
  const normalized = (value ?? '').trim().toLowerCase();
  return IDENTITY_DOCUMENTS.find((document) => document.value === normalized) ?? null;
}

export const IDENTITY_METHODS: ReadonlyArray<{
  value: IdentityCaptureMethod;
  label: string;
  hint?: string;
}> = [
  { value: 'philsys_qr', label: 'Scan the PhilSys QR', hint: 'Fastest for the national ID' },
  { value: 'document', label: 'Take a photo of an ID' },
  { value: 'passport', label: 'Use a passport' },
];

/** MIME types we accept from a gallery fallback. */
export const IDENTITY_UPLOAD_ACCEPT = 'image/jpeg,image/jpg,image/png,image/webp,image/heic,image/heif';
