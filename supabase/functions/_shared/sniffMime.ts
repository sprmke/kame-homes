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

function ascii(bytes: Uint8Array, start: number, length: number): string {
  return String.fromCharCode(...bytes.subarray(start, start + length));
}

/** Documents/images plus GIF and the video containers host media uploads accept. */
export function sniffUploadMime(bytes: Uint8Array): string | null {
  if (bytes.byteLength < 12) return null;
  const head = ascii(bytes, 0, 6);
  if (head === 'GIF87a' || head === 'GIF89a') return 'image/gif';
  if (bytes[0] === 0x42 && bytes[1] === 0x4d) return 'image/bmp';
  const tiffLe = bytes[0] === 0x49 && bytes[1] === 0x49 && bytes[2] === 0x2a && bytes[3] === 0x00;
  const tiffBe = bytes[0] === 0x4d && bytes[1] === 0x4d && bytes[2] === 0x00 && bytes[3] === 0x2a;
  if (tiffLe || tiffBe) return 'image/tiff';
  if (bytes[0] === 0x00 && bytes[1] === 0x00 && bytes[2] === 0x01) {
    if (bytes[3] === 0xba || bytes[3] === 0xb3) return 'video/mpeg';
  }

  if (ascii(bytes, 4, 4) === 'ftyp') {
    const brand = ascii(bytes, 8, 4).toLowerCase();
    if (brand === 'qt  ') return 'video/quicktime';
    if (brand === 'avif' || brand === 'avis') return 'image/avif';
    const document = sniffDocumentMime(bytes);
    if (document) return document;
    if (brand.startsWith('m4a')) return 'audio/mp4';
    return 'video/mp4';
  }

  if (bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3) {
    return ascii(bytes, 0, Math.min(bytes.byteLength, 64)).includes('webm')
      ? 'video/webm'
      : 'video/x-matroska';
  }
  if (ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 4) === 'AVI ') return 'video/x-msvideo';
  if (ascii(bytes, 0, 4) === 'OggS') return 'video/ogg';

  return sniffDocumentMime(bytes);
}

const MIME_FAMILY: Record<string, string> = {
  'image/jpg': 'image/jpeg',
  'image/pjpeg': 'image/jpeg',
  'image/x-png': 'image/png',
  'image/heif': 'image/heic',
  'video/quicktime': 'video/mp4',
  'audio/mp4': 'video/mp4',
  'audio/x-m4a': 'video/mp4',
  'video/x-matroska': 'video/webm',
  'audio/webm': 'video/webm',
  'audio/ogg': 'video/ogg',
};

function mimeFamily(mime: string): string {
  return MIME_FAMILY[mime] ?? mime;
}

const UNKNOWN_DECLARED = new Set(['', 'application/octet-stream', 'binary/octet-stream']);

/**
 * Bytes must be one of `allowed`, and agree with the declared type (aliases such as
 * `image/jpg` or MP4 vs QuickTime tolerated). A generic declared type defers to the bytes.
 * Returns the sniffed MIME; store that as the object's content type.
 */
export function assertUploadMatchesBytes(
  bytes: Uint8Array,
  declaredMime: string,
  allowed: ReadonlySet<string>
): string {
  const sniffed = sniffUploadMime(bytes);
  if (!sniffed) throw new Error('File type not recognized.');
  const allowedFamilies = new Set([...allowed].map((m) => mimeFamily(normalizeMime(m))));
  if (!allowedFamilies.has(mimeFamily(sniffed))) {
    throw new Error(`File content is ${sniffed}, which is not allowed here.`);
  }
  const declared = normalizeMime(declaredMime);
  if (!UNKNOWN_DECLARED.has(declared) && mimeFamily(declared) !== mimeFamily(sniffed)) {
    throw new Error(`File content is ${sniffed}, not ${declared}.`);
  }
  return sniffed;
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
