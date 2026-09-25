/**
 * AI document validation (payment receipts, government IDs) via the AI gateway: Gemini vision
 * with Groq vision fallback for image types Groq supports. Output is schema-validated; the
 * verdict is advisory and never auto-approves a booking. Non-blocking when AI is unconfigured.
 */

import { z } from 'zod';

import { createClient } from './supabaseJs.ts';

import { AiProviderError, generateStructured, isAiGatewayError } from './ai/llmClient.ts';
import {
  DOCUMENT_VERDICT_JSON_SCHEMA,
  RECEIPT_SYSTEM_PROMPT,
  RECEIPT_VALIDATION_PROMPT,
  VALID_ID_SYSTEM_PROMPT,
  VALID_ID_VALIDATION_PROMPT,
} from './ai/prompts/documentValidation.ts';
import { probeAiProviders } from './ai/providerHealth.ts';
import type { PromptRef } from './ai/prompt.ts';
import { getModelConfig } from './aiModelRouter.ts';
import { isAiQuotaError, type AiActorType } from './aiUsageService.ts';
import { toHostFacingError } from './hostFacingError.ts';
import { computeTotalGuestBalanceFromBooking } from './totalGuestBalance.ts';

export type AiUsageContext = {
  organizationId: string;
  propertyId?: string | null;
  actorUserId?: string | null;
  actorType?: AiActorType;
};

export type ReceiptValidationVerdict = 'valid' | 'likely_valid' | 'unclear' | 'invalid' | 'skipped';

export type ReceiptValidationResult = {
  verdict: ReceiptValidationVerdict;
  confidence: number | null;
  summary: string;
  has_amount: boolean;
  has_date: boolean;
  has_reference: boolean;
  /** Numeric PHP amount read off the receipt, when legible — null otherwise. */
  extracted_amount: number | null;
  /** ISO (YYYY-MM-DD) date read off the receipt, when legible — null otherwise. */
  extracted_date: string | null;
  /** Gemini/network failure — do not persist verdict; surface to admin for retry. */
  aiModelError?: string;
  /** Which provider produced the result (for logging/debugging). */
  provider?: 'gemini' | 'groq';
};

const RECEIPT_FEATURE = 'receipt_validation' as const;
const VERIFY_GEMINI_MODEL = getModelConfig('ai_integration_verify').model;

// --- Verify integration ---

export type AiProviderVerifyResult = {
  model: string;
  ok: boolean;
  latencyMs?: number;
  error?: string;
};

/** Admin-only: minimal provider health probe that does not expose key counts. */
export async function verifyAiProviders(): Promise<AiProviderVerifyResult> {
  const probe = await probeAiProviders({ force: true });
  return {
    model: VERIFY_GEMINI_MODEL,
    ok: probe.available,
    latencyMs: probe.latencyMs ?? undefined,
    error: probe.error ?? undefined,
  };
}






function skipped(summary = 'AI validation unavailable'): ReceiptValidationResult {
  return {
    verdict: 'skipped',
    confidence: null,
    summary,
    has_amount: false,
    has_date: false,
    has_reference: false,
    extracted_amount: null,
    extracted_date: null,
  };
}

function aiModelFailure(summary: string, detail?: string): ReceiptValidationResult {
  return {
    ...skipped(summary),
    aiModelError: detail ?? summary,
  };
}

/** True when a real verdict was produced and may be written to guest_submissions. */
export function shouldPersistReceiptValidation(result: ReceiptValidationResult): boolean {
  return !result.aiModelError;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function coerceNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function normalizeExtractedDate(value: unknown): string | null {
  const raw = String(value ?? '').trim();
  return ISO_DATE_RE.test(raw) ? raw : null;
}

function normalizeVisionMimeType(mimeType: string, path?: string): string {
  if (mimeType?.startsWith('image/')) return mimeType;
  if (mimeType === 'application/pdf') return mimeType;
  const ext = path?.split('.').pop()?.toLowerCase();
  if (ext === 'pdf') return 'application/pdf';
  if (ext === 'png') return 'image/png';
  if (ext === 'webp') return 'image/webp';
  if (ext === 'gif') return 'image/gif';
  return 'image/jpeg';
}

/** Structural contract. The verdict enum is strict (a bad verdict triggers the repair retry). */
const DocumentVerdictResponse = z.object({
  verdict: z.enum(['valid', 'likely_valid', 'unclear', 'invalid']),
  confidence: z.coerce.number().nullable().optional(),
  summary: z.string().optional(),
  has_amount: z.coerce.boolean().optional(),
  has_date: z.coerce.boolean().optional(),
  has_reference: z.coerce.boolean().optional(),
  extracted_amount: z.unknown().optional(),
  extracted_date: z.unknown().optional(),
});

/** Business-rule normalization of validated model output. */
function toValidationResult(
  data: z.infer<typeof DocumentVerdictResponse>,
  defaultSummary: string,
  provider: 'gemini' | 'groq'
): ReceiptValidationResult {
  const confidence =
    typeof data.confidence === 'number' && Number.isFinite(data.confidence)
      ? Math.min(1, Math.max(0, data.confidence))
      : null;
  return {
    verdict: data.verdict,
    confidence,
    summary: (data.summary ?? '').replace(/\s+/g, ' ').trim().slice(0, 200) || defaultSummary,
    has_amount: Boolean(data.has_amount),
    has_date: Boolean(data.has_date),
    has_reference: Boolean(data.has_reference),
    extracted_amount: coerceNumber(data.extracted_amount),
    extracted_date: normalizeExtractedDate(data.extracted_date),
    provider,
  };
}

/**
 * One document check through the gateway. Never throws for AI problems: quota, provider
 * outage or unreadable output become an aiModelError result the admin can retry.
 */
async function validateDocument(options: {
  prompt: PromptRef;
  system: string;
  imageBytes: Uint8Array;
  mimeType: string;
  logTag: string;
  defaultSummary: string;
  usageContext?: AiUsageContext | null;
}): Promise<ReceiptValidationResult> {
  if (!options.imageBytes?.length) return skipped('No image data to validate');

  try {
    const result = await generateStructured({
      feature: RECEIPT_FEATURE,
      prompt: options.prompt,
      system: options.system,
      user: [
        { text: 'Assess the attached document and return the JSON object.' },
        { inlineData: { mimeType: options.mimeType, data: bytesToBase64(options.imageBytes) } },
      ],
      temperature: 0.1,
      schema: DocumentVerdictResponse,
      jsonSchema: DOCUMENT_VERDICT_JSON_SCHEMA,
      billing: {
        organizationId: options.usageContext?.organizationId,
        propertyId: options.usageContext?.propertyId ?? null,
        actorUserId: options.usageContext?.actorUserId ?? null,
        actorType: options.usageContext?.actorType,
      },
    });
    const verdict = toValidationResult(result.data, options.defaultSummary, result.provider);
    // Verdict + provider only: summaries can echo guest ID / payment details.
    console.log(`[${options.logTag}] [${result.provider}] verdict=${verdict.verdict}`);
    return verdict;
  } catch (err) {
    if (err instanceof AiProviderError && err.code === 'not_configured') {
      console.warn(`[${options.logTag}] No AI provider configured — skipping`);
      return skipped();
    }
    if (isAiQuotaError(err)) return aiModelFailure('AI quota exceeded', err.message);
    if (isAiGatewayError(err)) {
      console.warn(`[${options.logTag}] AI validation failed: ${err.name}`);
      return aiModelFailure(
        'AI validation temporarily unavailable',
        toHostFacingError(err, 'AI validation is unavailable right now. Try again.')
      );
    }
    throw err;
  }
}

function validateReceiptImage(
  imageBytes: Uint8Array,
  mimeType: string,
  usageContext?: AiUsageContext | null
): Promise<ReceiptValidationResult> {
  return validateDocument({
    prompt: RECEIPT_VALIDATION_PROMPT,
    system: RECEIPT_SYSTEM_PROMPT,
    imageBytes,
    mimeType: normalizeVisionMimeType(mimeType),
    logTag: 'receipt-validation',
    defaultSummary: 'Receipt analyzed.',
    usageContext,
  });
}

function validateValidIdImage(
  imageBytes: Uint8Array,
  mimeType: string,
  path?: string,
  usageContext?: AiUsageContext | null
): Promise<ReceiptValidationResult> {
  return validateDocument({
    prompt: VALID_ID_VALIDATION_PROMPT,
    system: VALID_ID_SYSTEM_PROMPT,
    imageBytes,
    mimeType: normalizeVisionMimeType(mimeType, path),
    logTag: 'valid-id-validation',
    defaultSummary: 'ID analyzed.',
    usageContext,
  });
}

export async function validateReceiptFile(
  file: File | Blob,
  usageContext?: AiUsageContext | null
): Promise<ReceiptValidationResult> {
  const mimeType = file instanceof File ? file.type || 'image/jpeg' : 'image/jpeg';
  const bytes = new Uint8Array(await file.arrayBuffer());
  return validateReceiptImage(bytes, mimeType, usageContext);
}

export async function validateValidIdFile(
  file: File | Blob,
  usageContext?: AiUsageContext | null
): Promise<ReceiptValidationResult> {
  const fileName = file instanceof File ? file.name : '';
  const mimeType = file instanceof File ? file.type || mimeTypeFromPath(fileName) : 'image/jpeg';
  const bytes = new Uint8Array(await file.arrayBuffer());
  return validateValidIdImage(bytes, mimeType, fileName, usageContext);
}

const STORAGE_OBJECT_PATH_RE = /\/storage\/v1\/object\/(?:public|sign)\/([^/]+)\/(.+)$/;

export function parseStorageUrl(url: string): { bucket: string; path: string } | null {
  const trimmed = url?.trim();
  if (!trimmed || trimmed === 'dev-mode-skipped' || trimmed === 'test-mode-skipped') {
    return null;
  }
  const match = trimmed.match(STORAGE_OBJECT_PATH_RE);
  if (!match) return null;
  const bucket = match[1];
  const rawPath = match[2]?.split('?')[0] ?? '';
  if (!bucket || !rawPath) return null;
  return { bucket, path: decodeURIComponent(rawPath) };
}

function mimeTypeFromPath(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase();
  if (ext === 'pdf') return 'application/pdf';
  if (ext === 'png') return 'image/png';
  if (ext === 'webp') return 'image/webp';
  if (ext === 'gif') return 'image/gif';
  return 'image/jpeg';
}

async function validateDocumentFromStorageUrl(
  url: string,
  validate: (bytes: Uint8Array, mimeType: string, path: string) => Promise<ReceiptValidationResult>,
  parseErrorSummary: string,
  downloadErrorSummary: string
): Promise<ReceiptValidationResult> {
  const loc = parseStorageUrl(url);
  if (!loc) {
    return skipped(parseErrorSummary);
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  try {
    const { data, error } = await supabase.storage.from(loc.bucket).download(loc.path);
    if (error || !data) {
      console.error('[document-validation] Storage download failed:', error?.message);
      return skipped(downloadErrorSummary);
    }
    const bytes = new Uint8Array(await data.arrayBuffer());
    const mimeType =
      data.type?.startsWith('image/') || data.type === 'application/pdf'
        ? data.type
        : mimeTypeFromPath(loc.path);
    return await validate(bytes, mimeType, loc.path);
  } catch (err) {
    console.error('[document-validation] Storage download error:', err);
    return skipped(downloadErrorSummary);
  }
}

/** Download a stored receipt image and run Gemini validation (admin backfill). */
async function validateReceiptFromStorageUrl(
  url: string,
  usageContext?: AiUsageContext | null
): Promise<ReceiptValidationResult> {
  return validateDocumentFromStorageUrl(
    url,
    (bytes, mimeType) => validateReceiptImage(bytes, mimeType, usageContext),
    'Could not parse receipt URL',
    'Could not download receipt image'
  );
}

/** Download a stored valid ID and run Gemini validation (admin backfill). */
async function validateValidIdFromStorageUrl(
  url: string,
  usageContext?: AiUsageContext | null
): Promise<ReceiptValidationResult> {
  return validateDocumentFromStorageUrl(
    url,
    (bytes, mimeType, path) => validateValidIdImage(bytes, mimeType, path, usageContext),
    'Could not parse valid ID URL',
    'Could not download valid ID image'
  );
}

export type ReceiptBackfillKind = 'downpayment' | 'balance' | 'parking' | 'sd_refund' | 'valid_id';

const RECEIPT_DATE_FUTURE_GRACE_DAYS = 1;
const RECEIPT_DATE_MAX_AGE_DAYS = 180;

function manilaTodayYmd(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(now);
}

function daysBetween(fromYmd: string, toYmd: string): number {
  return Math.round(
    (new Date(`${toYmd}T00:00:00Z`).getTime() - new Date(`${fromYmd}T00:00:00Z`).getTime()) /
      86_400_000
  );
}

function pesoFormat(amount: number): string {
  return `₱${amount.toLocaleString('en-PH', { maximumFractionDigits: 2 })}`;
}

/**
 * Code-level sanity warnings for the AI-extracted amount/date — never blocks a
 * transition (see receiptVerdictBlocksAdminTransition, unaffected by these),
 * just surfaces a note for admin review. Date reasonableness is checked
 * against today (when the receipt was uploaded), not the booking's check-in
 * date, since bookings can be made far in advance of the stay.
 */
export function evaluateReceiptSanityWarnings(params: {
  extractedAmount: number | null;
  extractedDate: string | null;
  minimumAmount: number | null;
}): string[] {
  const { extractedAmount, extractedDate, minimumAmount } = params;
  const warnings: string[] = [];

  if (
    extractedAmount !== null &&
    minimumAmount !== null &&
    minimumAmount > 0 &&
    extractedAmount < minimumAmount
  ) {
    warnings.push(
      `Amount ${pesoFormat(extractedAmount)} is below the ${pesoFormat(minimumAmount)} expected.`
    );
  }

  if (extractedDate) {
    const today = manilaTodayYmd();
    const daysAgo = daysBetween(extractedDate, today);
    if (daysAgo < -RECEIPT_DATE_FUTURE_GRACE_DAYS) {
      warnings.push('Receipt date is in the future — please double-check.');
    } else if (daysAgo > RECEIPT_DATE_MAX_AGE_DAYS) {
      warnings.push('Receipt date looks unusually old — please double-check.');
    }
  }

  return warnings;
}

function appendSanityWarnings(summary: string, warnings: string[]): string {
  if (warnings.length === 0) return summary;
  return `${summary} ${warnings.map((w) => `⚠ ${w}`).join(' ')}`.trim();
}

/** Minimum PHP amount the receipt is expected to show, per receipt kind — null when unknown/not applicable. */
export function expectedMinimumAmountForReceiptKind(
  kind: ReceiptBackfillKind,
  booking: Record<string, unknown>
): number | null {
  switch (kind) {
    case 'downpayment':
      return coerceNumber(booking.down_payment) ?? coerceNumber(booking.booking_rate);
    case 'balance': {
      const due = computeTotalGuestBalanceFromBooking(booking);
      return due !== null && due > 0 ? due : null;
    }
    case 'parking':
      return coerceNumber(booking.parking_rate_guest);
    case 'sd_refund':
      return coerceNumber(booking.sd_refund_amount);
    case 'valid_id':
      return null;
    default:
      return null;
  }
}

/** Appends amount/date sanity warnings to a receipt's summary — a no-op for valid_id or a failed AI call. */
export function applyReceiptSanityChecks(
  kind: ReceiptBackfillKind,
  booking: Record<string, unknown>,
  result: ReceiptValidationResult
): ReceiptValidationResult {
  if (kind === 'valid_id' || result.aiModelError) return result;

  const warnings = evaluateReceiptSanityWarnings({
    extractedAmount: result.extracted_amount,
    extractedDate: result.extracted_date,
    minimumAmount: expectedMinimumAmountForReceiptKind(kind, booking),
  });
  if (warnings.length === 0) return result;

  return { ...result, summary: appendSanityWarnings(result.summary, warnings) };
}

export type ReceiptBackfillItem = {
  kind: ReceiptBackfillKind;
  verdict: ReceiptValidationVerdict;
  summary: string;
};

export type ReceiptBackfillError = {
  kind: ReceiptBackfillKind;
  message: string;
};

export type ReceiptBackfillResult = {
  validated: ReceiptBackfillItem[];
  errors: ReceiptBackfillError[];
};

/** Returns true when a receipt URL exists but AI verdict was never persisted. */
function receiptUrlNeedsAiBackfill(
  url: string | null | undefined,
  verdict: string | null | undefined
): boolean {
  return Boolean(url?.trim()) && !String(verdict ?? '').trim();
}

const TERMINAL_BOOKING_STATUSES = new Set(['COMPLETED', 'CANCELLED']);

/**
 * One-shot backfill for legacy rows: validate stored receipt images that never
 * received an AI verdict during submit/upload.
 */
export async function backfillMissingReceiptAiVerdicts(
  booking: Record<string, unknown>,
  usageContext?: AiUsageContext | null
): Promise<ReceiptBackfillResult> {
  const status = String(booking.status ?? '');
  if (TERMINAL_BOOKING_STATUSES.has(status)) {
    return { validated: [], errors: [] };
  }

  const targets: Array<{ kind: ReceiptBackfillKind; url: string }> = [];

  const dpUrl = String(booking.payment_receipt_url ?? '').trim();
  if (receiptUrlNeedsAiBackfill(dpUrl, booking.dp_receipt_ai_verdict as string)) {
    targets.push({ kind: 'downpayment', url: dpUrl });
  }

  const balanceUrl = String(booking.guest_balance_payment_receipt_url ?? '').trim();
  if (receiptUrlNeedsAiBackfill(balanceUrl, booking.balance_receipt_ai_verdict as string)) {
    targets.push({ kind: 'balance', url: balanceUrl });
  }

  const parkingUrl = String(booking.parking_payment_receipt_url ?? '').trim();
  if (receiptUrlNeedsAiBackfill(parkingUrl, booking.parking_receipt_ai_verdict as string)) {
    targets.push({ kind: 'parking', url: parkingUrl });
  }

  const sdRefundUrl = String(booking.sd_refund_receipt_url ?? '').trim();
  if (receiptUrlNeedsAiBackfill(sdRefundUrl, booking.sd_refund_receipt_ai_verdict as string)) {
    targets.push({ kind: 'sd_refund', url: sdRefundUrl });
  }

  const validIdUrl = String(booking.valid_id_url ?? '').trim();
  if (receiptUrlNeedsAiBackfill(validIdUrl, booking.valid_id_ai_verdict as string)) {
    targets.push({ kind: 'valid_id', url: validIdUrl });
  }

  const validated: ReceiptBackfillItem[] = [];
  const errors: ReceiptBackfillError[] = [];
  for (const target of targets) {
    const rawValidation =
      target.kind === 'valid_id'
        ? await validateValidIdFromStorageUrl(target.url, usageContext)
        : await validateReceiptFromStorageUrl(target.url, usageContext);
    if (rawValidation.aiModelError) {
      errors.push({
        kind: target.kind,
        message: rawValidation.aiModelError,
      });
      continue;
    }
    const validation = applyReceiptSanityChecks(target.kind, booking, rawValidation);
    validated.push({
      kind: target.kind,
      verdict: validation.verdict,
      summary: validation.summary,
    });
  }
  return { validated, errors };
}

export function dbPatchFromReceiptBackfillItems(
  items: ReceiptBackfillItem[]
): Record<string, string> {
  const patch: Record<string, string> = {};
  for (const item of items) {
    Object.assign(
      patch,
      dbPatchForDocumentAiValidation(item.kind, {
        verdict: item.verdict,
        confidence: null,
        summary: item.summary,
        has_amount: false,
        has_date: false,
        has_reference: false,
        extracted_amount: null,
        extracted_date: null,
      })
    );
  }
  return patch;
}

export function formatReceiptVerdictLabel(
  verdict: ReceiptValidationVerdict | string | null | undefined
): string {
  switch (String(verdict ?? '').toLowerCase()) {
    case 'valid':
      return 'Valid';
    case 'likely_valid':
      return 'Likely valid';
    case 'unclear':
      return 'Unclear';
    case 'invalid':
      return 'Invalid';
    case 'skipped':
      return 'Not checked';
    default:
      return 'Unknown';
  }
}

export function receiptVerdictBlocksAdminTransition(
  verdict: ReceiptValidationVerdict | string | null | undefined
): boolean {
  return String(verdict ?? '').toLowerCase() === 'invalid';
}

export type ReceiptValidationDbPatch =
  | {
      dp_receipt_ai_verdict: string;
      dp_receipt_ai_summary: string;
    }
  | {
      balance_receipt_ai_verdict: string;
      balance_receipt_ai_summary: string;
    }
  | {
      parking_receipt_ai_verdict: string;
      parking_receipt_ai_summary: string;
    }
  | {
      sd_refund_receipt_ai_verdict: string;
      sd_refund_receipt_ai_summary: string;
    }
  | {
      valid_id_ai_verdict: string;
      valid_id_ai_summary: string;
    };

export function dbPatchForDocumentAiValidation(
  kind: ReceiptBackfillKind,
  result: ReceiptValidationResult
): ReceiptValidationDbPatch {
  if (kind === 'downpayment') {
    return {
      dp_receipt_ai_verdict: result.verdict,
      dp_receipt_ai_summary: result.summary,
    };
  }
  if (kind === 'parking') {
    return {
      parking_receipt_ai_verdict: result.verdict,
      parking_receipt_ai_summary: result.summary,
    };
  }
  if (kind === 'sd_refund') {
    return {
      sd_refund_receipt_ai_verdict: result.verdict,
      sd_refund_receipt_ai_summary: result.summary,
    };
  }
  if (kind === 'valid_id') {
    return {
      valid_id_ai_verdict: result.verdict,
      valid_id_ai_summary: result.summary,
    };
  }
  return {
    balance_receipt_ai_verdict: result.verdict,
    balance_receipt_ai_summary: result.summary,
  };
}

/** @deprecated Use dbPatchForDocumentAiValidation */
export function dbPatchForReceiptValidation(
  kind: 'downpayment' | 'balance' | 'parking',
  result: ReceiptValidationResult
): ReceiptValidationDbPatch {
  return dbPatchForDocumentAiValidation(kind, result);
}

function receiptKindForAssetType(
  assetType: string
): 'downpayment' | 'balance' | 'parking' | 'sd_refund' | null {
  switch (assetType) {
    case 'payment_receipt':
      return 'downpayment';
    case 'guest_balance_payment_receipt':
      return 'balance';
    case 'parking_payment_receipt':
      return 'parking';
    case 'sd_refund_receipt':
      return 'sd_refund';
    default:
      return null;
  }
}

export function documentAiKindForAssetType(assetType: string): ReceiptBackfillKind | null {
  if (
    assetType === 'valid_id' ||
    assetType === 'guest2_valid_id' ||
    assetType === 'guest3_valid_id' ||
    assetType === 'guest4_valid_id' ||
    assetType === 'guest5_valid_id'
  ) {
    return 'valid_id';
  }
  return receiptKindForAssetType(assetType);
}
