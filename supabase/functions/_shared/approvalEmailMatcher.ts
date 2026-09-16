/**
 * Shared GAF/pet approval-email matching for Resend inbound (production) and any
 * future reprocess tools.
 *
 * Decisions (Phase 2):
 * - (a) Property routing: plus-addressing `approvals+{propertySlug}@inbound.{domain}`
 *   is primary; subject regex confirms kind + dates (no hardcoded unit label).
 * - (b) Dedupe: hard cutover — `processed_emails.message_id` stores Resend `email_id`
 *   (or RFC Message-Id when email_id is absent).
 */

import { createClient } from './supabaseJs.ts';
import { getApprovalSenderAllowList } from './appSettings.ts';
import type { BookingStatus } from './statusMachine.ts';

export type ApprovalKind = 'gaf' | 'pet';

export type ParsedApprovalSubject = {
  kind: ApprovalKind;
  checkInDate: string; // MM-DD-YYYY
  checkOutDate: string;
};

export type ApprovalBookingMatch =
  | { booking: Record<string, unknown> & { id: string } }
  | { ambiguous: true; matchCount: number }
  | null;

function supabaseAdmin() {
  return createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );
}

function toMmDdYyyy(date: Date): string {
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const yyyy = String(date.getFullYear());
  return `${mm}-${dd}-${yyyy}`;
}

export function parseDateTokenToDbFormat(raw: string): string | null {
  const token = raw.trim();
  if (/^\d{2}-\d{2}-\d{4}$/.test(token)) return token;
  if (/^\d{4}-\d{2}-\d{2}$/.test(token)) {
    const [y, m, d] = token.split('-');
    return `${m}-${d}-${y}`;
  }
  const parsed = new Date(token);
  if (!Number.isNaN(parsed.getTime())) return toMmDdYyyy(parsed);
  return null;
}

/**
 * Parse Azure approval subjects from emailService:
 *   `{unitLabel} - GAF Request (date to date)`
 *   `{unitLabel} - Pet Request (date to date)`
 * Optional prefixes (⚠️ TEST -, 🚨 URGENT -, UPDATED -) are ignored by the regex.
 */
export function parseApprovalSubject(subject: string): ParsedApprovalSubject | null {
  const GAF_RE = /-\s*GAF Request\s+\(([^)]+?)\s+to\s+([^)]+?)\)/i;
  const PET_RE = /-\s*Pet Request\s+\(([^)]+?)\s+to\s+([^)]+?)\)/i;

  const gafMatch = subject.match(GAF_RE);
  if (gafMatch) {
    const checkInDate = parseDateTokenToDbFormat(gafMatch[1]!);
    const checkOutDate = parseDateTokenToDbFormat(gafMatch[2]!);
    if (!checkInDate || !checkOutDate) return null;
    return { kind: 'gaf', checkInDate, checkOutDate };
  }

  const petMatch = subject.match(PET_RE);
  if (petMatch) {
    const checkInDate = parseDateTokenToDbFormat(petMatch[1]!);
    const checkOutDate = parseDateTokenToDbFormat(petMatch[2]!);
    if (!checkInDate || !checkOutDate) return null;
    return { kind: 'pet', checkInDate, checkOutDate };
  }

  return null;
}

export function extractEmailAddress(fromHeader: string): string {
  if (!fromHeader) return '';
  const bracketMatch = fromHeader.match(/<([^>]+)>/);
  if (bracketMatch?.[1]) return bracketMatch[1].trim().toLowerCase();
  return fromHeader.trim().toLowerCase();
}

export async function isSenderAllowed(propertyId: string, fromHeader: string): Promise<boolean> {
  const allowed = await getApprovalSenderAllowList(propertyId);
  if (allowed.length === 0) return true;
  const sender = extractEmailAddress(fromHeader);
  return allowed.includes(sender);
}

export function normalizeAttachmentFilename(filename: string): string {
  return filename
    .toLowerCase()
    .replace(/[ _-]+/g, '')
    .trim();
}

/** Returns kind when filename matches an approved GAF/pet PDF variant. */
export function matchAttachment(filename: string): ApprovalKind | null {
  const normalized = normalizeAttachmentFilename(filename);
  if (normalized === 'approvedgaf.pdf') return 'gaf';
  if (normalized === 'approvedpet.pdf' || normalized === 'approvedpetform.pdf') {
    return 'pet';
  }
  return null;
}

export function findApprovedAttachmentFilename(
  kind: ApprovalKind,
  filenames: string[]
): string | undefined {
  const accepted =
    kind === 'gaf'
      ? ['approvedgaf.pdf']
      : ['approvedpet.pdf', 'approvedpetform.pdf', 'approvedgaf.pdf'];
  return filenames.find((name) => accepted.includes(normalizeAttachmentFilename(name)));
}

export async function findBookingForApproval(
  propertyId: string,
  kind: ApprovalKind,
  checkIn: string,
  checkOut: string
): Promise<ApprovalBookingMatch> {
  const expectedStatuses: BookingStatus[] =
    kind === 'gaf'
      ? ['PENDING_DOCUMENTS', 'PENDING_GAF']
      : ['PENDING_DOCUMENTS', 'PENDING_PET_REQUEST'];

  const { data, error } = await supabaseAdmin()
    .from('guest_submissions')
    .select('*')
    .eq('property_id', propertyId)
    .eq('check_in_date', checkIn)
    .eq('check_out_date', checkOut)
    .in('status', expectedStatuses);

  if (error) throw new Error(`DB lookup failed: ${error.message}`);
  if (!data || data.length === 0) return null;
  if (data.length > 1) return { ambiguous: true, matchCount: data.length };
  return { booking: data[0] as Record<string, unknown> & { id: string } };
}

/** Silent orchestrator flags for inbound approval applies (no outbound request emails). */
export const APPROVAL_INTAKE_DEV_CONTROLS = {
  saveToDatabase: true,
  generatePdf: false,
  sendGafRequestEmail: false,
  sendParkingBroadcastEmail: false,
  sendPetRequestEmail: false,
  sendBookingAcknowledgementEmail: false,
  sendReadyForCheckinEmail: false,
} as const;
