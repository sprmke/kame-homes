/**
 * Durable guest-safe share links for private approved-document PDFs (GAF, Pet).
 * Mirrors `guestStayGuide.ts`'s token pattern, minus the stay-dated validity window —
 * approval proof is useful any time after approval. One token unlocks both documents
 * for its booking; a fresh signed Storage URL is minted server-side on each visit.
 */

import { createClient } from './supabaseJs.ts';

import { resolvePropertySlugById } from './propertyScope.ts';
import { formatPublicUrl } from './utils.ts';
import type { GuestSubmission } from './types.ts';

export type BookingDocumentKind = 'gaf' | 'pet';

const DOCUMENT_URL_COLUMN: Record<BookingDocumentKind, string> = {
  gaf: 'approved_gaf_pdf_url',
  pet: 'approved_pet_pdf_url',
};

const DOCUMENT_LABEL: Record<BookingDocumentKind, string> = {
  gaf: 'Approved GAF',
  pet: 'Approved Pet Form',
};

const PRIVATE_BUCKETS = new Set(['approved-gafs', 'approved-pet-forms']);
const STORAGE_OBJECT_PATH_RE = /\/storage\/v1\/object\/(?:public|sign)\/([^/]+)\/(.+)$/;
const SIGNED_URL_TTL_SEC = 60 * 30;

function supabaseAdmin() {
  return createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );
}

function generateDocumentShareToken(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

function readExistingToken(booking: GuestSubmission): string {
  return String(
    (booking as { document_share_token?: string | null }).document_share_token ?? ''
  ).trim();
}

/** Issue-if-missing — call before returning a share link to a host. */
export async function ensureBookingDocumentShareToken(
  booking: GuestSubmission
): Promise<string | null> {
  const bookingId = String(booking.id ?? '').trim();
  if (!bookingId) return null;

  const existing = readExistingToken(booking);
  if (existing) return existing;

  const token = generateDocumentShareToken();
  const { error } = await supabaseAdmin()
    .from('guest_submissions')
    .update({ document_share_token: token })
    .eq('id', bookingId);

  if (error) {
    console.error('[bookingDocumentShareToken] ensureBookingDocumentShareToken:', error);
    throw new Error('Failed to save document share token');
  }
  return token;
}

function parseStorageLocation(url: string): { bucket: string; path: string } | null {
  const withoutQuery = url.split('?')[0] ?? '';
  const m = withoutQuery.match(STORAGE_OBJECT_PATH_RE);
  if (!m) return null;
  const bucket = m[1];
  const rawPath = m[2] ?? '';
  if (!bucket || !rawPath) return null;
  try {
    return { bucket, path: decodeURIComponent(rawPath) };
  } catch {
    return { bucket, path: rawPath };
  }
}

/** Public resolver: token + which doc → a fresh signed URL, or null on any mismatch. */
export async function resolveBookingDocumentByToken(
  token: string,
  doc: BookingDocumentKind,
  expectedPropertySlug?: string | null
): Promise<{ url: string; label: string } | null> {
  const trimmed = token.trim();
  if (!trimmed) return null;

  const supabase = supabaseAdmin();
  const { data: row, error } = await supabase
    .from('guest_submissions')
    .select('*')
    .eq('document_share_token', trimmed)
    .maybeSingle();

  if (error || !row) {
    if (error) console.error('[bookingDocumentShareToken] resolveBookingDocumentByToken:', error);
    return null;
  }

  if (String(row.status ?? '').trim() === 'CANCELLED') return null;

  const column = DOCUMENT_URL_COLUMN[doc];
  const storedUrl = String((row as Record<string, unknown>)[column] ?? '').trim();
  if (!storedUrl) return null;

  if (expectedPropertySlug?.trim()) {
    const propertyId = String(row.property_id ?? '').trim();
    const slug = propertyId ? await resolvePropertySlugById(propertyId) : null;
    if (slug !== expectedPropertySlug.trim()) return null;
  }

  const normalized = formatPublicUrl(storedUrl);
  const loc = parseStorageLocation(normalized);
  if (!loc || !PRIVATE_BUCKETS.has(loc.bucket)) {
    return { url: normalized, label: DOCUMENT_LABEL[doc] };
  }

  const { data: signed, error: signError } = await supabase.storage
    .from(loc.bucket)
    .createSignedUrl(loc.path, SIGNED_URL_TTL_SEC);

  if (signError || !signed?.signedUrl) {
    console.error('[bookingDocumentShareToken] createSignedUrl:', signError);
    return null;
  }

  return { url: formatPublicUrl(signed.signedUrl), label: DOCUMENT_LABEL[doc] };
}
