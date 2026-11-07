/**
 * PhilSys (Philippine National ID) QR decoding + offline signature verification.
 *
 * Two payload families exist on real cards:
 *
 *   * **v1 — PhilID card.** JSON with a detached Ed25519 signature.
 *   * **v3 — printed ePhilID.** A text prefix followed by base45, which inflates to CBOR
 *     and carries the holder's portrait.
 *
 * Rules for this module:
 *   1. **No code is copied from `bettergovph/openverify`** — that repository has no licence
 *      file. The format below is implemented from the public PSA advisories plus
 *      permissively licensed primitives (Web Crypto Ed25519, `DecompressionStream`).
 *   2. **A failed or skipped signature is never fatal.** `signature.checked = false` means
 *      "we could not check", which must not read as "this card is fake". Only
 *      `signature.checked = true, valid = false` blocks (see `identityVerification.ts`).
 *   3. **Never log or persist the raw payload.** It contains a PCN and a portrait.
 *   4. Unknown payload shapes return `fields: null` so the caller falls back to AI
 *      extraction instead of guessing. A wrong field is worse than no field.
 */

export type PhilSysFields = {
  firstName: string | null;
  middleName: string | null;
  lastName: string | null;
  suffix: string | null;
  fullName: string | null;
  dateOfBirth: string | null;
  sex: string | null;
  nationality: string;
  documentNumber: string | null;
  dateOfIssuance: string | null;
  documentExpiry: string | null;
  portraitBytes: Uint8Array | null;
  portraitMime: string | null;
};

export type PhilSysSignatureCheck =
  | { checked: false; valid: false; reason: 'no_key_configured' | 'no_signature' | 'unsupported' }
  | { checked: true; valid: true }
  | { checked: true; valid: false; reason: 'invalid_signature' | 'malformed_key' };

export type PhilSysDecodeResult = {
  kind: 'v1' | 'v3' | null;
  fields: PhilSysFields | null;
  signature: PhilSysSignatureCheck;
};

const PHILSYS_V3_PREFIXES = ['PHILSYS', 'PHILID', 'EPHILID', 'PSA'] as const;

// --- base45 (RFC 9285) -----------------------------------------------------------------

const BASE45_CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:';

export function base45Decode(input: string): Uint8Array {
  // Space (index 36) is part of the charset. Only trim the ends — stripping interior
  // whitespace shifts every following triplet and corrupts the payload.
  const text = input.trim().toUpperCase();
  if (text.length === 0) return new Uint8Array();
  const values: number[] = [];
  for (const char of text) {
    const index = BASE45_CHARS.indexOf(char);
    if (index < 0) throw new Error('Invalid base45 character');
    values.push(index);
  }

  const out: number[] = [];
  let i = 0;
  while (i < values.length) {
    const remaining = values.length - i;
    if (remaining === 1) throw new Error('Invalid base45 length');
    const c = values[i] ?? 0;
    const d = values[i + 1] ?? 0;
    if (remaining >= 3) {
      const e = values[i + 2] ?? 0;
      const value = c + d * 45 + e * 45 * 45;
      if (value > 0xffff) throw new Error('Invalid base45 triplet');
      out.push((value >> 8) & 0xff, value & 0xff);
      i += 3;
    } else {
      const value = c + d * 45;
      if (value > 0xff) throw new Error('Invalid base45 pair');
      out.push(value & 0xff);
      i += 2;
    }
  }
  return Uint8Array.from(out);
}

// --- minimal CBOR decoder --------------------------------------------------------------
// Supports the subset a PhilSys payload uses: unsigned/negative ints, byte and text
// strings, arrays, maps, tags, booleans, null and floats. Anything outside the subset
// throws, and the caller degrades to AI extraction.

type CborValue = string | number | boolean | null | Uint8Array | CborValue[] | { [k: string]: CborValue };

export function decodeCbor(bytes: Uint8Array): CborValue {
  let offset = 0;

  const readUint = (additional: number): number => {
    if (additional < 24) return additional;
    if (additional === 24) return readByte();
    if (additional === 25) return (readByte() << 8) | readByte();
    if (additional === 26) return (readByte() << 24) | (readByte() << 16) | (readByte() << 8) | readByte();
    if (additional === 27) {
      const high = (readByte() << 24) | (readByte() << 16) | (readByte() << 8) | readByte();
      return high * 0x100000000 + ((readByte() << 24) | (readByte() << 16) | (readByte() << 8) | readByte());
    }
    throw new Error('Unsupported CBOR length');
  };

  const readByte = (): number => {
    if (offset >= bytes.length) throw new Error('Unexpected end of CBOR input');
    return bytes[offset++] ?? 0;
  };

  const readBytes = (length: number): Uint8Array => {
    if (offset + length > bytes.length) throw new Error('Unexpected end of CBOR input');
    const slice = bytes.subarray(offset, offset + length);
    offset += length;
    return slice;
  };

  const decodeItem = (): CborValue => {
    const initial = readByte();
    const major = initial >> 5;
    const additional = initial & 0x1f;

    switch (major) {
      case 0:
        return readUint(additional);
      case 1:
        return -1 - readUint(additional);
      case 2:
        return Uint8Array.from(readBytes(readUint(additional)));
      case 3:
        return new TextDecoder().decode(readBytes(readUint(additional)));
      case 4: {
        const length = readUint(additional);
        const items: CborValue[] = [];
        for (let i = 0; i < length; i++) items.push(decodeItem());
        return items;
      }
      case 5: {
        const length = readUint(additional);
        const map: { [k: string]: CborValue } = {};
        for (let i = 0; i < length; i++) {
          const key = decodeItem();
          const value = decodeItem();
          map[String(key)] = value;
        }
        return map;
      }
      case 6:
        // Tag — drop it and decode the tagged value.
        readUint(additional);
        return decodeItem();
      case 7:
        if (additional === 20) return false;
        if (additional === 21) return true;
        if (additional === 22) return null;
        if (additional === 23) return null;
        if (additional === 25) {
          const raw = readBytes(2);
          return decodeFloat16(((raw[0] ?? 0) << 8) | (raw[1] ?? 0));
        }
        if (additional === 26) {
          const raw = readBytes(4);
          return new DataView(raw.buffer, raw.byteOffset, 4).getFloat32(0);
        }
        if (additional === 27) {
          const raw = readBytes(8);
          return new DataView(raw.buffer, raw.byteOffset, 8).getFloat64(0);
        }
        throw new Error('Unsupported CBOR simple value');
      default:
        throw new Error('Unsupported CBOR major type');
    }
  };

  const value = decodeItem();
  return value;
}

function decodeFloat16(bits: number): number {
  const sign = bits & 0x8000 ? -1 : 1;
  const exponent = (bits >> 10) & 0x1f;
  const fraction = bits & 0x03ff;
  if (exponent === 0) return sign * Math.pow(2, -14) * (fraction / 1024);
  if (exponent === 0x1f) return fraction === 0 ? sign * Infinity : NaN;
  return sign * Math.pow(2, exponent - 15) * (1 + fraction / 1024);
}

// --- payload decoding ------------------------------------------------------------------

/** Copy into a plain ArrayBuffer-backed view — the TS lib types reject SharedArrayBuffer on Blob/SubtleCrypto. */
function toPlainBytes(bytes: Uint8Array): Uint8Array<ArrayBuffer> {
  return Uint8Array.from(bytes);
}

async function inflate(bytes: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([toPlainBytes(bytes)])
    .stream()
    .pipeThrough(new DecompressionStream('deflate'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** Extract the base45 blob from a prefixed v3 payload (`PREFIX|blob`, `PREFIX:blob`, …). */
function splitV3Prefix(payload: string): string | null {
  const trimmed = payload.trim();
  for (const prefix of PHILSYS_V3_PREFIXES) {
    if (!trimmed.toUpperCase().startsWith(prefix)) continue;
    const rest = trimmed.slice(prefix.length).replace(/^[\s:|=,-]+/, '');
    if (rest.length > 0) return rest;
  }
  return null;
}

export async function decodePhilSysPayload(
  payload: string,
  options: { publicKeyBase64?: string | null } = {}
): Promise<PhilSysDecodeResult> {
  const trimmed = payload.trim();
  if (!trimmed) {
    return { kind: null, fields: null, signature: { checked: false, valid: false, reason: 'no_signature' } };
  }

  if (trimmed.startsWith('{')) {
    return decodeV1Json(trimmed, options.publicKeyBase64);
  }

  const base45Blob = splitV3Prefix(trimmed) ?? (/^[0-9A-Z $%*+\-./:]+$/.test(trimmed) ? trimmed : null);
  if (base45Blob) {
    const v3 = await decodeV3Base45(base45Blob);
    if (v3) return { kind: 'v3', fields: v3, signature: v3SignatureCheck(options.publicKeyBase64) };
  }

  return { kind: null, fields: null, signature: { checked: false, valid: false, reason: 'no_signature' } };
}

/**
 * v3 embeds a portrait but the public documentation does not describe a detached
 * signature we can verify with a published key. Until PSA eVerify onboarding lands we
 * report "not checked" rather than pretending. `fields` still carries the readable data.
 */
function v3SignatureCheck(publicKeyBase64?: string | null): PhilSysSignatureCheck {
  return publicKeyBase64
    ? { checked: false, valid: false, reason: 'unsupported' }
    : { checked: false, valid: false, reason: 'no_key_configured' };
}

async function decodeV3Base45(blob: string): Promise<PhilSysFields | null> {
  try {
    const compressed = base45Decode(blob);
    const cborBytes = await inflate(compressed);
    const decoded = decodeCbor(cborBytes);
    return extractFieldsFromDecoded(decoded);
  } catch {
    return null;
  }
}

async function decodeV1Json(
  json: string,
  publicKeyBase64?: string | null
): Promise<PhilSysDecodeResult> {
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(json) as Record<string, unknown>;
  } catch {
    return { kind: null, fields: null, signature: { checked: false, valid: false, reason: 'no_signature' } };
  }
  if (!parsed || typeof parsed !== 'object') {
    return { kind: 'v1', fields: null, signature: { checked: false, valid: false, reason: 'no_signature' } };
  }

  const fields = extractFieldsFromDecoded(parsed);
  const signatureValue = pickString(parsed, ['signature', 'sig', 'sign']);
  const signedPayload =
    pickString(parsed, ['signedPayload', 'signed_payload', 'payload']) ??
    canonicalJson({ ...parsed, signature: undefined, sig: undefined, sign: undefined });

  if (!signatureValue) {
    return { kind: 'v1', fields, signature: { checked: false, valid: false, reason: 'no_signature' } };
  }
  if (!publicKeyBase64?.trim()) {
    return { kind: 'v1', fields, signature: { checked: false, valid: false, reason: 'no_key_configured' } };
  }

  const signature = await verifyEd25519(signedPayload, signatureValue, publicKeyBase64);
  return { kind: 'v1', fields, signature };
}

/** Deterministic JSON (sorted keys, no whitespace) — the canonical form we sign against. */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(',')}}`;
}

function base64ToBytes(value: string): Uint8Array {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/').replace(/\s+/g, '');
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
  const bin = atob(padded);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

async function verifyEd25519(
  payload: string,
  signatureBase64: string,
  publicKeyBase64: string
): Promise<PhilSysSignatureCheck> {
  try {
    const keyBytes = toPlainBytes(base64ToBytes(publicKeyBase64));
    // 32 raw bytes = a raw Ed25519 public key; anything longer is expected to be SPKI DER.
    const key =
      keyBytes.length === 32
        ? await crypto.subtle.importKey('raw', keyBytes, { name: 'Ed25519' }, false, ['verify'])
        : await crypto.subtle.importKey('spki', keyBytes, { name: 'Ed25519' }, false, ['verify']);

    const valid = await crypto.subtle.verify(
      'Ed25519',
      key,
      toPlainBytes(base64ToBytes(signatureBase64)),
      new TextEncoder().encode(payload)
    );
    return valid
      ? { checked: true, valid: true }
      : { checked: true, valid: false, reason: 'invalid_signature' };
  } catch {
    // Web Crypto without Ed25519, or a key that is not importable. Not a card failure.
    return { checked: false, valid: false, reason: 'unsupported' };
  }
}

// --- field extraction ------------------------------------------------------------------

function pickString(source: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const direct = source[key];
    if (typeof direct === 'string' && direct.trim()) return direct.trim();
    const match = Object.keys(source).find((candidate) => candidate.toLowerCase() === key.toLowerCase());
    if (match) {
      const value = source[match];
      if (typeof value === 'string' && value.trim()) return value.trim();
    }
  }
  return null;
}

function pickBytes(source: Record<string, unknown>, keys: string[]): Uint8Array | null {
  for (const key of keys) {
    const direct = source[key];
    if (direct instanceof Uint8Array) return direct;
    const match = Object.keys(source).find((candidate) => candidate.toLowerCase() === key.toLowerCase());
    if (match) {
      const value = source[match];
      if (value instanceof Uint8Array) return value;
    }
  }
  return null;
}

function extractFieldsFromDecoded(decoded: unknown): PhilSysFields | null {
  const flat = flattenToRecord(decoded);
  if (!flat) return null;

  const firstName = pickString(flat, ['firstName', 'first_name', 'givenName', 'given_name', 'fname']);
  const middleName = pickString(flat, ['middleName', 'middle_name', 'mname']);
  const lastName = pickString(flat, ['lastName', 'last_name', 'surname', 'familyName', 'lname']);
  const suffix = pickString(flat, ['suffix', 'nameSuffix']);

  const dateOfBirth = normalizeDate(
    pickString(flat, ['dateOfBirth', 'date_of_birth', 'birthDate', 'birth_date', 'dob'])
  );
  const sex = normalizeSex(pickString(flat, ['sex', 'gender']));
  const documentNumber = pickString(flat, ['pcn', 'philsysNumber', 'philsys_number', 'idNumber', 'id_number']);
  const dateOfIssuance = normalizeDate(pickString(flat, ['dateOfIssuance', 'date_of_issuance', 'issuedAt']));
  const documentExpiry = normalizeDate(
    pickString(flat, ['dateOfExpiry', 'date_of_expiry', 'expiryDate', 'expiry_date'])
  );

  const portraitSources: Array<Record<string, unknown>> = [flat];
  const nestedPortrait = pickRecord(decoded, ['portrait', 'photo', 'image', 'biometric']);
  if (nestedPortrait) portraitSources.unshift(nestedPortrait);
  let portraitBytes: Uint8Array | null = null;
  for (const source of portraitSources) {
    portraitBytes = pickBytes(source, ['portrait', 'photo', 'image', 'imageBytes', 'image_bytes']);
    if (portraitBytes) break;
  }

  const fullName =
    pickString(flat, ['fullName', 'full_name', 'name']) ??
    ([firstName, middleName, lastName, suffix].filter(Boolean).join(' ').trim() || null);

  if (!fullName && !documentNumber && !dateOfBirth) return null;

  return {
    firstName,
    middleName,
    lastName,
    suffix,
    fullName,
    dateOfBirth,
    sex,
    nationality: 'Filipino',
    documentNumber,
    dateOfIssuance,
    documentExpiry,
    portraitBytes,
    portraitMime: portraitBytes ? sniffImageMime(portraitBytes) : null,
  };
}

function pickRecord(value: unknown, keys: string[]): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  for (const key of keys) {
    const match = Object.keys(record).find((candidate) => candidate.toLowerCase() === key.toLowerCase());
    if (match && record[match] && typeof record[match] === 'object' && !Array.isArray(record[match])) {
      return record[match] as Record<string, unknown>;
    }
  }
  return null;
}

/** One level of nesting is enough for every observed payload; deeper values are dropped. */
function flattenToRecord(decoded: unknown): Record<string, unknown> | null {
  if (!decoded || typeof decoded !== 'object') return null;
  if (Array.isArray(decoded)) {
    for (const item of decoded) {
      const nested = flattenToRecord(item);
      if (nested) return nested;
    }
    return null;
  }
  const record = decoded as Record<string, unknown>;
  const flattened: Record<string, unknown> = { ...record };
  for (const value of Object.values(record)) {
    if (value && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Uint8Array)) {
      Object.assign(flattened, value as Record<string, unknown>);
    }
  }
  return flattened;
}

export function normalizeDate(value: string | null | undefined): string | null {
  const trimmed = (value ?? '').trim();
  if (!trimmed) return null;
  // Never round-trip through `Date`: `toISOString()` shifts a Manila-local midnight back a
  // day, which silently changes a date of birth. Every accepted shape is parsed by hand.
  const ymd = trimmed.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (ymd) return formatYmd(ymd[1], ymd[2], ymd[3]);
  const mdy = trimmed.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if (mdy) return formatYmd(mdy[3], mdy[1], mdy[2]);
  return null;
}

function formatYmd(year: string | undefined, month: string | undefined, day: string | undefined): string | null {
  if (!year || !month || !day) return null;
  const y = Number(year);
  const m = Number(month);
  const d = Number(day);
  if (y < 1900 || y > 2200 || m < 1 || m > 12 || d < 1 || d > 31) return null;
  return `${year}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function normalizeSex(value: string | null | undefined): string | null {
  const normalized = (value ?? '').trim().toLowerCase();
  if (!normalized) return null;
  if (normalized.startsWith('m')) return 'male';
  if (normalized.startsWith('f')) return 'female';
  return normalized;
}

export function sniffImageMime(bytes: Uint8Array): string | null {
  if (bytes.length < 4) return null;
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return 'image/jpeg';
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return 'image/png';
  if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46) return 'image/webp';
  return null;
}
