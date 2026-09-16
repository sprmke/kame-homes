/**
 * Shared org team logo upload — used by upload-org-settings-asset and AI assistant apply.
 */

import { createClient } from './supabaseJs.ts';
import { DatabaseService } from './databaseService.ts';
import { invalidateAppSettingsCache } from './appSettings.ts';
import { ensureOrgSettingsRow, invalidateOrgSettingsCache } from './orgSettings.ts';
import { assertWithinUploadLimit } from './uploadLimits.ts';
import { formatPublicUrl } from './utils.ts';

const BUCKET = 'app-settings-assets';
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);
/** Reject 1×1 / seed placeholder “logos” that render as solid color squares. */
const MIN_LOGO_PX = 8;

export type ApplyOrgTeamLogoInput = {
  organizationId: string;
  bytes: Uint8Array;
  mimeType: string;
  fileName: string;
};

export type ApplyOrgTeamLogoResult = {
  url: string;
  bucket: string;
  path: string;
  column: 'email_logo_url';
  replacedExisting: boolean;
};

function extensionFor(mime: string, fileName: string): string {
  if (fileName.includes('.')) {
    return `.${fileName.split('.').pop()?.toLowerCase()}`;
  }
  if (mime === 'image/png') return '.png';
  if (mime === 'image/webp') return '.webp';
  return '.jpg';
}

function readU32BE(bytes: Uint8Array, offset: number): number {
  return (
    ((bytes[offset]! << 24) |
      (bytes[offset + 1]! << 16) |
      (bytes[offset + 2]! << 8) |
      bytes[offset + 3]!) >>>
    0
  );
}

function readPngSize(bytes: Uint8Array): { width: number; height: number } | null {
  if (bytes.length < 24) return null;
  if (bytes[0] !== 0x89 || bytes[1] !== 0x50 || bytes[2] !== 0x4e || bytes[3] !== 0x47) {
    return null;
  }
  return { width: readU32BE(bytes, 16), height: readU32BE(bytes, 20) };
}

function readJpegSize(bytes: Uint8Array): { width: number; height: number } | null {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  let i = 2;
  while (i + 9 < bytes.length) {
    if (bytes[i] !== 0xff) {
      i += 1;
      continue;
    }
    const marker = bytes[i + 1]!;
    if (marker === 0xd9 || marker === 0xda) break;
    const size = (bytes[i + 2]! << 8) | bytes[i + 3]!;
    if (size < 2) break;
    // SOF0 / SOF2 (baseline / progressive)
    if (marker === 0xc0 || marker === 0xc2) {
      const height = (bytes[i + 5]! << 8) | bytes[i + 6]!;
      const width = (bytes[i + 7]! << 8) | bytes[i + 8]!;
      return { width, height };
    }
    i += 2 + size;
  }
  return null;
}

function readWebpSize(bytes: Uint8Array): { width: number; height: number } | null {
  if (bytes.length < 30) return null;
  const riff = String.fromCharCode(bytes[0]!, bytes[1]!, bytes[2]!, bytes[3]!);
  const webp = String.fromCharCode(bytes[8]!, bytes[9]!, bytes[10]!, bytes[11]!);
  if (riff !== 'RIFF' || webp !== 'WEBP') return null;
  const chunk = String.fromCharCode(bytes[12]!, bytes[13]!, bytes[14]!, bytes[15]!);
  if (chunk === 'VP8X' && bytes.length >= 30) {
    const width = 1 + (bytes[24]! | (bytes[25]! << 8) | (bytes[26]! << 16));
    const height = 1 + (bytes[27]! | (bytes[28]! << 8) | (bytes[29]! << 16));
    return { width, height };
  }
  if (chunk === 'VP8 ' && bytes.length >= 30) {
    const width = (bytes[26]! | (bytes[27]! << 8)) & 0x3fff;
    const height = (bytes[28]! | (bytes[29]! << 8)) & 0x3fff;
    return { width, height };
  }
  if (chunk === 'VP8L' && bytes.length >= 25) {
    const b0 = bytes[21]!;
    const b1 = bytes[22]!;
    const b2 = bytes[23]!;
    const b3 = bytes[24]!;
    const width = 1 + (((b1 & 0x3f) << 8) | b0);
    const height = 1 + (((b3 & 0xf) << 10) | (b2 << 2) | ((b1 & 0xc0) >> 6));
    return { width, height };
  }
  return null;
}

export function readImagePixelSize(
  bytes: Uint8Array,
  mimeType: string
): { width: number; height: number } | null {
  const mime = mimeType.toLowerCase();
  if (mime === 'image/png' || mime === 'image/x-png') return readPngSize(bytes);
  if (mime === 'image/jpeg' || mime === 'image/jpg') return readJpegSize(bytes);
  if (mime === 'image/webp') return readWebpSize(bytes);
  return readPngSize(bytes) ?? readJpegSize(bytes) ?? readWebpSize(bytes);
}

function assertMinLogoDimensions(bytes: Uint8Array, mimeType: string): void {
  const size = readImagePixelSize(bytes, mimeType);
  if (!size) {
    throw new Error('Could not read logo dimensions. Use a JPEG, PNG, or WebP image.');
  }
  if (size.width < MIN_LOGO_PX || size.height < MIN_LOGO_PX) {
    throw new Error(`Logo must be at least ${MIN_LOGO_PX}×${MIN_LOGO_PX} pixels`);
  }
}

export async function applyOrgTeamLogoFromBytes(
  input: ApplyOrgTeamLogoInput
): Promise<ApplyOrgTeamLogoResult> {
  const mime = (input.mimeType || '').toLowerCase();
  if (!ALLOWED_MIME.has(mime)) {
    throw new Error('File must be JPEG, PNG, or WebP');
  }

  assertMinLogoDimensions(input.bytes, mime);

  const file = new File([input.bytes], input.fileName || 'logo.jpg', { type: mime });
  assertWithinUploadLimit(file, 'image');

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  const { data: orgRow } = await supabase
    .from('organizations')
    .select('logo_url')
    .eq('id', input.organizationId)
    .maybeSingle();
  const replacedExisting = Boolean(typeof orgRow?.logo_url === 'string' && orgRow.logo_url.trim());

  const ext = extensionFor(mime, input.fileName || 'logo.jpg');
  const storagePath = `team-logo/org/${input.organizationId}/current${ext}`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, file, { upsert: true, contentType: mime });
  if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`);

  const {
    data: { publicUrl },
  } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);
  const safePublicUrl = formatPublicUrl(publicUrl);

  await ensureOrgSettingsRow(input.organizationId);
  await DatabaseService.updateOrgSettings({ email_logo_url: safePublicUrl }, input.organizationId);
  await supabase
    .from('organizations')
    .update({ logo_url: safePublicUrl })
    .eq('id', input.organizationId);

  invalidateOrgSettingsCache(input.organizationId);
  invalidateAppSettingsCache();

  return {
    url: safePublicUrl,
    bucket: BUCKET,
    path: storagePath,
    column: 'email_logo_url',
    replacedExisting,
  };
}
