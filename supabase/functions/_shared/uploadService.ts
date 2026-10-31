import { createClient } from './supabaseJs.ts';
import { assertMimeMatchesBytes } from './sniffMime.ts';
import { copyBytes, formatPublicUrl } from './utils.ts';
import { prefixPropertyStorageKey } from './bookingStoragePaths.ts';

/**
 * Sanitizes a filename for use as a Supabase Storage object key.
 * Supabase Storage rejects object names with special characters (apostrophes,
 * quotes, %, non-ASCII, etc.). This keeps the extension and replaces
 * problematic characters with underscores.
 */
function sanitizeStorageFileName(fileName: string): string {
  if (!fileName || typeof fileName !== 'string') return fileName;
  // Decode URL-encoded spaces and other sequences so we don't use literal % in path
  try {
    fileName = decodeURIComponent(fileName);
  } catch {
    // If decoding fails, use as-is and sanitize below
  }
  // Replace characters that cause "object name contains invalid characters" in Supabase Storage
  const sanitized = fileName
    .replace(/[''`"]/g, '_') // apostrophes and quotes
    .replace(/[%#?\\]/g, '_') // percent, hash, question, backslash
    .replace(/\s+/g, '_'); // spaces
  return sanitized || fileName;
}

export class UploadService {
  private static client: ReturnType<typeof createClient> | null = null;

  private static get supabase() {
    if (!this.client) {
      this.client = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      );
    }
    return this.client;
  }

  static async uploadPaymentReceipt(
    file: File | null,
    fileName: string,
    propertyId?: string | null
  ): Promise<string> {
    try {
      if (!file) {
        console.log('No downpayment receipt file provided, skipping upload');
        return '';
      }

      const { url } = await this.uploadFile(file, fileName, 'payment-receipts', propertyId);
      return url;
    } catch (error) {
      console.error('Error uploading downpayment receipt:', error);
      throw new Error('Failed to upload downpayment receipt');
    }
  }

  static async uploadValidId(
    file: File | null,
    fileName: string,
    propertyId?: string | null
  ): Promise<string> {
    try {
      if (!file) {
        console.log('No valid ID file provided, skipping upload');
        return '';
      }

      const { url } = await this.uploadFile(file, fileName, 'valid-ids', propertyId);
      return url;
    } catch (error) {
      console.error('Error uploading valid ID:', error);
      throw new Error('Failed to upload valid ID');
    }
  }

  static async uploadPetVaccination(
    file: File | null,
    fileName: string,
    propertyId?: string | null
  ): Promise<string> {
    try {
      if (!file) {
        console.log('No pet vaccination file provided, skipping upload');
        return '';
      }

      const { url } = await this.uploadFile(file, fileName, 'pet-vaccinations', propertyId);
      return url;
    } catch (error) {
      console.error('Error uploading pet vaccination:', error);
      throw new Error('Failed to upload pet vaccination record');
    }
  }

  static async uploadPetImage(
    file: File | null,
    fileName: string,
    propertyId?: string | null
  ): Promise<string> {
    try {
      if (!file) {
        console.log('No pet image file provided, skipping upload');
        return '';
      }

      const { url } = await this.uploadFile(file, fileName, 'pet-images', propertyId);
      return url;
    } catch (error) {
      console.error('Error uploading pet image:', error);
      throw new Error('Failed to upload pet image');
    }
  }

  static async uploadFile(
    file: File,
    fileName: string,
    bucket: string,
    propertyId?: string | null
  ): Promise<{ url: string }> {
    const storageKey = sanitizeStorageFileName(prefixPropertyStorageKey(propertyId, fileName));
    if (storageKey !== fileName) {
      console.log(`Sanitized storage key: "${fileName}" -> "${storageKey}"`);
    }
    console.log(`Processing ${bucket} upload...`);

    // `generateFileName` (client) is deterministic per guest + stay, so re-submitting
    // a booking reuses the same key. Upsert overwrites instead of returning 409
    // Duplicate, and — unlike the old skip-if-exists check — a genuinely edited file
    // replaces the stored one rather than silently keeping the stale copy. The old
    // check also listed at the root prefix, so it never matched property-scoped
    // (`{propertyId}/…`) keys and every re-upload hit the 409 path.
    const bytes = new Uint8Array(await file.arrayBuffer());
    assertMimeMatchesBytes(bytes, file.type || '');

    const { error: uploadError } = await this.supabase.storage
      .from(bucket)
      .upload(storageKey, bytes, {
        upsert: true,
        cacheControl: '300',
        contentType: file.type || 'application/octet-stream',
      });

    if (uploadError) {
      console.error(`${bucket} upload error:`, uploadError);
      throw new Error(`Failed to upload file to ${bucket}`);
    }

    const {
      data: { publicUrl },
    } = this.supabase.storage.from(bucket).getPublicUrl(storageKey);

    console.log(`${bucket} uploaded successfully`);
    return { url: formatPublicUrl(publicUrl) };
  }

  /** Upload raw PDF bytes (e.g. orchestrator-generated GAF / pet request forms). */
  static async uploadPdfBytes(
    bucket: string,
    objectPath: string,
    bytes: Uint8Array
  ): Promise<string> {
    const blob = new Blob([copyBytes(bytes)], { type: 'application/pdf' });
    const { error } = await this.supabase.storage.from(bucket).upload(objectPath, blob, {
      contentType: 'application/pdf',
      upsert: true,
      cacheControl: '300',
    });
    if (error) {
      console.error(`[UploadService] PDF upload to ${bucket}/${objectPath}:`, error);
      throw new Error(`Failed to upload PDF to ${bucket}: ${error.message}`);
    }
    const {
      data: { publicUrl },
    } = this.supabase.storage.from(bucket).getPublicUrl(objectPath);
    const base = formatPublicUrl(publicUrl);
    const sep = base.includes('?') ? '&' : '?';
    return `${base}${sep}v=${Date.now()}`;
  }
}
