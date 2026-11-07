/**
 * ICAO 9303 machine-readable zone parsing for the edge.
 *
 * The client has `identite-ts` for the camera-side read; the server must not trust that
 * result, so this is an independent implementation used to validate what the client sent.
 * Both must agree on the checksums before a read counts.
 *
 * Supported formats: TD3 (passport, 2×44), TD2 (2×36), TD1 (ID card, 3×30).
 * A failed check digit means we return `null` rather than a partially wrong identity.
 */

export type MrzFormat = 'TD1' | 'TD2' | 'TD3';

export type MrzFields = {
  format: MrzFormat;
  documentType: string | null;
  issuingCountry: string | null;
  documentNumber: string | null;
  fullName: string | null;
  firstName: string | null;
  lastName: string | null;
  nationality: string | null;
  dateOfBirth: string | null;
  sex: string | null;
  documentExpiry: string | null;
};

const CHECK_WEIGHTS = [7, 3, 1] as const;

function charValue(char: string): number {
  if (char >= '0' && char <= '9') return char.charCodeAt(0) - 48;
  if (char >= 'A' && char <= 'Z') return char.charCodeAt(0) - 55;
  return 0; // '<' and any filler
}

export function mrzCheckDigit(input: string): number {
  let sum = 0;
  for (let i = 0; i < input.length; i++) {
    sum += charValue(input[i] ?? '<') * (CHECK_WEIGHTS[i % 3] ?? 1);
  }
  return sum % 10;
}

function digits(value: string): number {
  const trimmed = value.replace(/</g, '').trim();
  return trimmed ? Number(trimmed) : Number.NaN;
}

/** `YYMMDD` → `YYYY-MM-DD`, using the ICAO century rule (a document cannot be issued in the future). */
export function mrzDateToYmd(raw: string | null | undefined, kind: 'birth' | 'expiry' | 'issue'): string | null {
  const value = (raw ?? '').trim();
  if (!/^\d{6}$/.test(value)) return null;
  const yy = Number(value.slice(0, 2));
  const mm = Number(value.slice(2, 4));
  const dd = Number(value.slice(4, 6));
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return null;

  const nowYear = new Date().getFullYear();
  const currentCentury = Math.floor(nowYear / 100) * 100;
  let year = currentCentury + yy;
  if (kind === 'birth') {
    // Nobody born this century is an adult booking a stay today; roll back one century.
    if (year > nowYear - 16) year -= 100;
  } else {
    // Expiry and issue are always near the present: allow a decade of slack either way.
    if (year > nowYear + 10) year -= 100;
  }
  const iso = `${year}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
  return Number.isNaN(new Date(`${iso}T00:00:00Z`).getTime()) ? null : iso;
}

function splitNames(nameField: string): { fullName: string | null; firstName: string | null; lastName: string | null } {
  const cleaned = nameField.replace(/</g, ' ').replace(/\s+/g, ' ').trim();
  if (!cleaned) return { fullName: null, firstName: null, lastName: null };
  const [lastRaw, firstRaw] = nameField.split('<<');
  const lastName = (lastRaw ?? '').replace(/</g, ' ').replace(/\s+/g, ' ').trim() || null;
  const firstName = (firstRaw ?? '').replace(/</g, ' ').replace(/\s+/g, ' ').trim() || null;
  return { fullName: cleaned, firstName, lastName };
}

function normalizeSex(char: string | undefined): string | null {
  if (char === 'M') return 'male';
  if (char === 'F') return 'female';
  return null;
}

export function parseMrz(raw: string | null | undefined): MrzFields | null {
  const text = (raw ?? '')
    .toUpperCase()
    .replace(/[^A-Z0-9<\n]/g, '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  if (text.length === 2 && text[0]?.length === 44 && text[1]?.length === 44) return parseTd3(text);
  if (text.length === 2 && text[0]?.length === 36 && text[1]?.length === 36) return parseTd2(text);
  if (text.length === 3 && text.every((line) => line.length === 30)) return parseTd1(text);
  return null;
}

function parseTd3(lines: string[]): MrzFields | null {
  const [line1, line2] = lines as [string, string];
  const documentNumber = line2.slice(0, 9);
  const dobRaw = line2.slice(13, 19);
  const expiryRaw = line2.slice(21, 27);

  if (mrzCheckDigit(documentNumber) !== digits(line2[9] ?? '')) return null;
  if (mrzCheckDigit(dobRaw) !== digits(line2[19] ?? '')) return null;
  if (mrzCheckDigit(expiryRaw) !== digits(line2[27] ?? '')) return null;
  const composite = `${line2.slice(0, 10)}${line2.slice(13, 20)}${line2.slice(21, 43)}`;
  if (mrzCheckDigit(composite) !== digits(line2[43] ?? '')) return null;

  const names = splitNames(line1.slice(5));
  const dateOfBirth = mrzDateToYmd(dobRaw, 'birth');
  const documentExpiry = mrzDateToYmd(expiryRaw, 'expiry');
  if (!dateOfBirth || !documentExpiry) return null;

  return {
    format: 'TD3',
    documentType: line1.slice(0, 2).replace(/</g, '') || null,
    issuingCountry: line1.slice(2, 5).replace(/</g, '') || null,
    documentNumber: documentNumber.replace(/</g, '') || null,
    fullName: names.fullName,
    firstName: names.firstName,
    lastName: names.lastName,
    nationality: line2.slice(10, 13).replace(/</g, '') || null,
    dateOfBirth,
    sex: normalizeSex(line2[20]),
    documentExpiry,
  };
}

function parseTd2(lines: string[]): MrzFields | null {
  const [line1, line2] = lines as [string, string];
  const documentNumber = line1.slice(5, 14);
  const dobRaw = line2.slice(0, 6);
  const expiryRaw = line2.slice(8, 14);

  if (mrzCheckDigit(documentNumber) !== digits(line1[14] ?? '')) return null;
  if (mrzCheckDigit(dobRaw) !== digits(line2[6] ?? '')) return null;
  if (mrzCheckDigit(expiryRaw) !== digits(line2[14] ?? '')) return null;
  const composite = `${line1.slice(5, 15)}${line2.slice(0, 7)}${line2.slice(8, 15)}`;
  if (mrzCheckDigit(composite) !== digits(line2[15] ?? '')) return null;

  const names = splitNames(line1.slice(16));
  const dateOfBirth = mrzDateToYmd(dobRaw, 'birth');
  const documentExpiry = mrzDateToYmd(expiryRaw, 'expiry');
  if (!dateOfBirth || !documentExpiry) return null;

  return {
    format: 'TD2',
    documentType: line1.slice(0, 2).replace(/</g, '') || null,
    issuingCountry: line1.slice(2, 5).replace(/</g, '') || null,
    documentNumber: documentNumber.replace(/</g, '') || null,
    fullName: names.fullName,
    firstName: names.firstName,
    lastName: names.lastName,
    nationality: line2.slice(18, 21).replace(/</g, '') || null,
    dateOfBirth,
    sex: normalizeSex(line2[7]),
    documentExpiry,
  };
}

function parseTd1(lines: string[]): MrzFields | null {
  const [line1, line2, line3] = lines as [string, string, string];
  const documentNumber = line1.slice(5, 14);
  const dobRaw = line2.slice(0, 6);
  const expiryRaw = line2.slice(8, 14);

  if (mrzCheckDigit(documentNumber) !== digits(line1[14] ?? '')) return null;
  if (mrzCheckDigit(dobRaw) !== digits(line2[6] ?? '')) return null;
  if (mrzCheckDigit(expiryRaw) !== digits(line2[14] ?? '')) return null;
  const composite = `${line1.slice(5, 30)}${line2.slice(0, 7)}${line2.slice(8, 15)}${line2.slice(18, 29)}`;
  if (mrzCheckDigit(composite) !== digits(line2[29] ?? '')) return null;

  const names = splitNames(line3);
  const dateOfBirth = mrzDateToYmd(dobRaw, 'birth');
  const documentExpiry = mrzDateToYmd(expiryRaw, 'expiry');
  if (!dateOfBirth || !documentExpiry) return null;

  return {
    format: 'TD1',
    documentType: line1.slice(0, 2).replace(/</g, '') || null,
    issuingCountry: line1.slice(2, 5).replace(/</g, '') || null,
    documentNumber: documentNumber.replace(/</g, '') || null,
    fullName: names.fullName,
    firstName: names.firstName,
    lastName: names.lastName,
    nationality: line2.slice(15, 18).replace(/</g, '') || null,
    dateOfBirth,
    sex: normalizeSex(line2[7]),
    documentExpiry,
  };
}

/** Build a synthetic TD3 MRZ for tests and fixtures. Never used at runtime. */
export function buildTd3MrzForTests(input: {
  documentNumber: string;
  issuingCountry?: string;
  nationality?: string;
  surname: string;
  givenNames: string;
  dateOfBirth: string; // YYMMDD
  sex?: 'M' | 'F' | '<';
  expiry: string; // YYMMDD
}): [string, string] {
  const country = (input.issuingCountry ?? 'PHL').padEnd(3, '<').slice(0, 3);
  const nationality = (input.nationality ?? 'PHL').padEnd(3, '<').slice(0, 3);
  const documentNumber = input.documentNumber.padEnd(9, '<').slice(0, 9);
  const name = `${input.surname.toUpperCase()}<<${input.givenNames.toUpperCase()}`.replace(/\s/g, '<');
  const line1 = `P<${country}${name.padEnd(39, '<')}`.slice(0, 44);
  const personal = ''.padEnd(14, '<');
  const partial = `${documentNumber}${mrzCheckDigit(documentNumber)}${nationality}${input.dateOfBirth}${mrzCheckDigit(
    input.dateOfBirth
  )}${input.sex ?? '<'}${input.expiry}${mrzCheckDigit(input.expiry)}${personal}`;
  const personalCheck = String(mrzCheckDigit(personal));
  // Composite covers line 2 positions 0-9, 13-19 and 21-42 (i.e. through the
  // personal-number check digit), and is stored at position 43. Nationality (10-12)
  // and sex (20) are deliberately excluded.
  const compositeInput = `${documentNumber}${mrzCheckDigit(documentNumber)}${input.dateOfBirth}${mrzCheckDigit(
    input.dateOfBirth
  )}${input.expiry}${mrzCheckDigit(input.expiry)}${personal}${personalCheck}`;
  const line2 = `${partial}${personalCheck}${mrzCheckDigit(compositeInput)}`.padEnd(44, '<').slice(0, 44);
  return [line1, line2];
}
