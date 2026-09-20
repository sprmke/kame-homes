/**
 * Magic-byte MIME sniff for guest-document and booking-asset uploads.
 * Client `Content-Type` / extension is not trusted (production-readiness doc 20).
 */

const PDF = 'application/pdf';
const JPEG = 'image/jpeg';
const PNG = 'image/png';
const WEBP = 'image/webp';
const HEIC = 'image/heic';
const HEIF = 'image/heif';

export function sniffDocumentMime(bytes: Uint8Array): string | null {
  if (bytes.byteLength < 12) return null;

  if (bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) {
    return PDF;
  }

  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return JPEG;

  if (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return PNG;
  }

  if (
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return WEBP;
  }

  if (bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70) {
    const brand = String.fromCharCode(bytes[8]!, bytes[9]!, bytes[10]!, bytes[11]!).toLowerCase();
    if (brand.startsWith('heic') || brand.startsWith('heix') || brand.startsWith('mif1')) {
      return HEIC;
    }
    if (brand.startsWith('heif') || brand.startsWith('msf1')) return HEIF;
  }

  return null;
}

function normalizeMime(mime: string): string {
  return mime.trim().toLowerCase().split(';')[0]?.trim() ?? '';
}

/** Declared MIME must match the bytes. Returns the sniffed MIME. */
export function assertMimeMatchesBytes(bytes: Uint8Array, declaredMime: string): string {
  const declared = normalizeMime(declaredMime);
  const sniffed = sniffDocumentMime(bytes);
  if (!sniffed) {
    throw new Error('File type not recognized. Use JPEG, PNG, WebP, HEIC, or PDF.');
  }
  if (!declared) {
    throw new Error('Missing Content-Type.');
  }
  if (declared !== sniffed) {
    throw new Error(`File content is ${sniffed}, not ${declared}.`);
  }
  return sniffed;
}
