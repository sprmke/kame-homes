/**
 * AI document validation via Google Gemini Flash (vision) with multi-key rotation
 * and Groq (Llama 4 Scout) fallback. Non-blocking when no API keys are configured.
 *
 * Provider chain:
 *  1. Gemini keys (round-robin from GEMINI_API_KEYS or single GEMINI_API_KEY)
 *  2. Groq Llama 4 Scout (GROQ_API_KEY) — fallback when all Gemini keys fail
 *
 * Rate-limit (429) or server errors on one key immediately try the next.
 */

import { createClient } from './supabaseJs.ts';

import {
  getGeminiApiKeys,
  getGroqApiKey,
  nextGeminiKeyStartIndex,
  probeAiProviderMinimal,
  shouldTryNextProvider,
  extractGeminiUsage,
} from './aiGeminiKeys.ts';
import { geminiGenerateContentUrl, getModelConfig } from './aiModelRouter.ts';
import {
  assertPropertyAiQuotaOptional,
  AiQuotaExceededError,
  recordAiUsageOptional,
  type AiActorType,
  type RecordAiUsageInput,
} from './aiUsageService.ts';
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
const VERIFY_FEATURE = 'ai_integration_verify' as const;
const CONFIG = getModelConfig(RECEIPT_FEATURE);
const GEMINI_MODEL = CONFIG.model;
const VERIFY_GEMINI_MODEL = getModelConfig(VERIFY_FEATURE).model;
const GEMINI_URL = geminiGenerateContentUrl(GEMINI_MODEL);
const GROQ_MODEL = 'meta-llama/llama-4-scout-17b-16e-instruct';
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';

// --- Verify integration ---

export type AiProviderVerifyResult = {
  model: string;
  ok: boolean;
  latencyMs?: number;
  error?: string;
};

/** Admin-only: minimal provider health probe that does not expose key counts. */
export async function verifyAiProviders(): Promise<AiProviderVerifyResult> {
  const probe = await probeAiProviderMinimal();
  return {
    model: VERIFY_GEMINI_MODEL,
    ok: probe.ok,
    latencyMs: probe.latencyMs,
    error: probe.error,
  };
}

/** @deprecated Use verifyAiProviders() which does not expose key counts. */
export async function verifyGeminiIntegration(): Promise<AiProviderVerifyResult> {
  return verifyAiProviders();
}

const RECEIPT_PROMPT = `You are validating a payment proof image for a vacation rental booking in the Philippines.
Analyze the image and return ONLY valid JSON (no markdown) with this exact shape:
{
  "verdict": "valid" | "likely_valid" | "unclear" | "invalid",
  "confidence": number between 0 and 1,
  "summary": "one short sentence for an admin",
  "has_amount": boolean,
  "has_date": boolean,
  "has_reference": boolean,
  "extracted_amount": number | null,
  "extracted_date": "YYYY-MM-DD" | null
}

Accept TWO forms of payment proof:
1) Digital — GCash, Maya, InstaPay, bank transfer, or similar e-wallet/bank app screenshots showing money sent (amount plus date or reference when visible).
2) Cash — a photo clearly showing Philippine peso (PHP) banknotes as payment proof (e.g. bills held in hand, fanned out, or on a table). Recognizable PHP denominations (₱20–₱1000) count as valid proof even without a transaction reference or date.

Rules:
- "valid": clear digital transfer receipt/screenshot with transaction details, OR a clear photo of PHP cash bills as payment proof.
- "likely_valid": payment screenshot or cash photo that is partly blurry/cropped but still recognizable as payment proof.
- "unclear": too blurry or ambiguous to tell if it is digital payment proof or PHP cash payment proof.
- "invalid": clearly NOT payment proof (random photo, scenery, meme, blank, ID only, chat without payment proof, unrelated objects with no visible transfer details or PHP cash).
- For cash photos: set has_amount true when bill denominations are visible; has_date and has_reference are usually false — that is OK.
- extracted_amount: the numeric Philippine peso amount actually sent/paid (ignore fees, balances, or unrelated numbers). Null when not legible.
- extracted_date: the transaction date shown on the screenshot (bank/e-wallet apps always show one), normalized to YYYY-MM-DD. If only a partial date is visible (e.g. no year), infer the most recent plausible year. Null for cash photos or when no date is visible at all.
- summary must be plain English, max 120 characters, no line breaks.`;

const VALID_ID_PROMPT = `You are validating a government-issued photo ID image for a vacation rental guest check-in in the Philippines.
Analyze the image or PDF and return ONLY valid JSON (no markdown) with this exact shape:
{
  "verdict": "valid" | "likely_valid" | "unclear" | "invalid",
  "confidence": number between 0 and 1,
  "summary": "one short sentence for an admin",
  "has_amount": boolean,
  "has_date": boolean,
  "has_reference": boolean
}

Accept common Philippine and travel IDs, including:
- Philippine National ID (PhilSys / ePhilID)
- Passport (Philippine or foreign)
- Driver's license
- UMID, SSS, PhilHealth, postal ID, voter's ID, PRC ID, and similar government photo IDs

Rules:
- "valid": clear government-issued photo ID with recognizable ID document layout (name and/or photo visible; rotation is OK).
- "likely_valid": ID appears genuine but is blurry, cropped, glare-heavy, or rotated — still recognizable as an ID document.
- "unclear": too blurry or ambiguous to tell if it is a government ID.
- "invalid": clearly NOT an ID (selfie only, payment receipt, scenery, meme, blank image, random object, chat screenshot without ID).
- Set has_amount false. Set has_date true when a birth date or expiry is visible. Set has_reference true when an ID number is visible.
- summary must be plain English, max 120 characters, no line breaks. Mention ID type when confident (e.g. "PhilSys ID", "passport").`;

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

function parseGeminiApiError(status: number, errText: string): string {
  let message = `Gemini API returned ${status}`;
  try {
    const parsed = JSON.parse(errText) as { error?: { message?: string } };
    if (parsed.error?.message) message = parsed.error.message;
  } catch {
    if (errText.trim()) message = errText.trim().slice(0, 240);
  }
  return message;
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

function normalizeVerdict(raw: unknown): ReceiptValidationVerdict {
  const v = String(raw ?? '')
    .trim()
    .toLowerCase();
  if (v === 'valid' || v === 'likely_valid' || v === 'unclear' || v === 'invalid') {
    return v;
  }
  return 'unclear';
}

function parseGeminiJson(
  text: string,
  defaultSummary = 'Document analyzed.'
): ReceiptValidationResult | null {
  const trimmed = text.trim();
  const jsonMatch = trimmed.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;
  try {
    const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
    const confidenceRaw = Number(parsed.confidence);
    const confidence = Number.isFinite(confidenceRaw)
      ? Math.min(1, Math.max(0, confidenceRaw))
      : null;
    const summary =
      String(parsed.summary ?? '')
        .trim()
        .slice(0, 200) || defaultSummary;
    return {
      verdict: normalizeVerdict(parsed.verdict),
      confidence,
      summary,
      has_amount: Boolean(parsed.has_amount),
      has_date: Boolean(parsed.has_date),
      has_reference: Boolean(parsed.has_reference),
      extracted_amount: coerceNumber(parsed.extracted_amount),
      extracted_date: normalizeExtractedDate(parsed.extracted_date),
    };
  } catch {
    return null;
  }
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

/** Try a single Gemini key. Returns result or null if rate-limited/server-error (caller should try next). */
async function tryGeminiKey(
  apiKey: string,
  prompt: string,
  base64: string,
  safeMime: string,
  logTag: string,
  defaultSummary: string
): Promise<{
  result: ReceiptValidationResult;
  usage: { inputTokens: number; outputTokens: number };
} | null> {
  try {
    const res = await fetch(`${GEMINI_URL}?key=${encodeURIComponent(apiKey)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: prompt }, { inline_data: { mime_type: safeMime, data: base64 } }],
          },
        ],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: CONFIG.defaultMaxOutputTokens,
          responseMimeType: 'application/json',
          thinkingConfig: { thinkingBudget: CONFIG.thinkingBudget },
        },
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      if (shouldTryNextProvider(res.status)) {
        console.warn(`[${logTag}] Gemini key exhausted/error (${res.status}), trying next...`);
        return null; // signal: try next key/provider
      }
      const detail = parseGeminiApiError(res.status, errText);
      console.error(`[${logTag}] Gemini API error:`, res.status, errText);
      return {
        result: aiModelFailure('AI validation failed', detail),
        usage: { inputTokens: 0, outputTokens: 0 },
      };
    }

    const body = await res.json();
    const text =
      (body as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> })
        .candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    const parsed = parseGeminiJson(text, defaultSummary);
    if (!parsed) {
      console.warn(`[${logTag}] Could not parse Gemini response:`, text.slice(0, 200));
      return {
        result: aiModelFailure(
          'AI validation returned unreadable result',
          'The AI model returned a response we could not parse. Try again.'
        ),
        usage: extractGeminiUsage(body),
      };
    }

    console.log(
      `[${logTag}] [gemini] verdict=${parsed.verdict} confidence=${parsed.confidence} summary=${parsed.summary}`
    );
    return {
      result: { ...parsed, provider: 'gemini' },
      usage: extractGeminiUsage(body),
    };
  } catch (err) {
    console.warn(
      `[${logTag}] Gemini key threw (network?):`,
      err instanceof Error ? err.message : err
    );
    return null; // treat network errors as transient → try next
  }
}

const GROQ_SUPPORTED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);

/** Groq (Llama 4 Scout) fallback — OpenAI-compatible vision API. */
async function tryGroq(
  groqKey: string,
  prompt: string,
  base64: string,
  safeMime: string,
  logTag: string,
  defaultSummary: string
): Promise<ReceiptValidationResult | null> {
  if (!GROQ_SUPPORTED_MIME_TYPES.has(safeMime)) {
    console.warn(`[${logTag}] Groq skipped — unsupported MIME type: ${safeMime}`);
    return null;
  }

  try {
    const res = await fetch(GROQ_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${groqKey}`,
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              {
                type: 'image_url',
                image_url: { url: `data:${safeMime};base64,${base64}` },
              },
            ],
          },
        ],
        temperature: 0.1,
        max_tokens: CONFIG.defaultMaxOutputTokens,
        response_format: { type: 'json_object' },
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      if (shouldTryNextProvider(res.status)) {
        console.warn(`[${logTag}] Groq rate-limited/error (${res.status})`);
        return null;
      }
      console.error(`[${logTag}] Groq API error:`, res.status, errText);
      return aiModelFailure('AI validation failed (fallback)', `Groq returned ${res.status}`);
    }

    const body = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const text = body.choices?.[0]?.message?.content ?? '';
    const parsed = parseGeminiJson(text, defaultSummary);
    if (!parsed) {
      console.warn(`[${logTag}] Could not parse Groq response:`, text.slice(0, 200));
      return aiModelFailure(
        'AI validation returned unreadable result',
        'Fallback AI model returned a response we could not parse.'
      );
    }

    console.log(
      `[${logTag}] [groq] verdict=${parsed.verdict} confidence=${parsed.confidence} summary=${parsed.summary}`
    );
    return { ...parsed, provider: 'groq' };
  } catch (err) {
    console.error(`[${logTag}] Groq unexpected error:`, err);
    return null;
  }
}

/**
 * Multi-provider vision validation:
 *  1. Round-robin through Gemini keys (skip 429/5xx → next key)
 *  2. Fallback to Groq if all Gemini keys are exhausted
 *  3. Return aiModelError only when ALL providers fail
 */
async function callGeminiVision(
  prompt: string,
  imageBytes: Uint8Array,
  mimeType: string,
  logTag: string,
  defaultSummary: string,
  usageContext?: AiUsageContext | null
): Promise<ReceiptValidationResult> {
  try {
    await assertPropertyAiQuotaOptional(
      usageContext?.organizationId,
      usageContext?.propertyId,
      RECEIPT_FEATURE
    );
  } catch (error) {
    if (error instanceof AiQuotaExceededError) {
      return aiModelFailure('AI quota exceeded', error.message);
    }
    throw error;
  }

  const geminiKeys = getGeminiApiKeys();
  const groqKey = getGroqApiKey();

  if (geminiKeys.length === 0 && !groqKey) {
    console.warn(`[${logTag}] No AI API keys configured — skipping`);
    return skipped();
  }
  if (!imageBytes?.length) {
    return skipped('No image data to validate');
  }

  const safeMime = normalizeVisionMimeType(mimeType);
  const base64 = bytesToBase64(imageBytes);

  // Layer 1: Try all Gemini keys (round-robin starting from last successful index)
  if (geminiKeys.length > 0) {
    const startIdx = nextGeminiKeyStartIndex(geminiKeys.length);
    for (let i = 0; i < geminiKeys.length; i++) {
      const idx = (startIdx + i) % geminiKeys.length;
      const geminiAttempt = await tryGeminiKey(
        geminiKeys[idx],
        prompt,
        base64,
        safeMime,
        logTag,
        defaultSummary
      );
      if (geminiAttempt) {
        await recordVisionUsage(usageContext, 'gemini', geminiAttempt.usage);
        return geminiAttempt.result;
      }
    }
    console.warn(
      `[${logTag}] All ${geminiKeys.length} Gemini key(s) failed, trying Groq fallback...`
    );
  }

  // Layer 2: Groq fallback
  if (groqKey) {
    const result = await tryGroq(groqKey, prompt, base64, safeMime, logTag, defaultSummary);
    if (result) {
      await recordVisionUsage(usageContext, 'groq', null);
      return result;
    }
  }

  // All providers exhausted
  const providers = [];
  if (geminiKeys.length > 0)
    providers.push(`Gemini (${geminiKeys.length} key${geminiKeys.length > 1 ? 's' : ''})`);
  if (groqKey) providers.push('Groq');
  const detail = `All AI providers exhausted: ${providers.join(', ')}. Try again later.`;
  console.error(`[${logTag}] ${detail}`);
  return aiModelFailure('AI validation temporarily unavailable', detail);
}

async function recordVisionUsage(
  usageContext: AiUsageContext | null | undefined,
  provider: 'gemini' | 'groq',
  tokenUsage: { inputTokens: number; outputTokens: number } | null
): Promise<void> {
  if (!usageContext?.organizationId) return;
  const usage: Omit<RecordAiUsageInput, 'organizationId'> = {
    propertyId: usageContext.propertyId ?? null,
    feature: RECEIPT_FEATURE,
    provider,
    model: provider === 'gemini' ? GEMINI_MODEL : GROQ_MODEL,
    inputTokens: tokenUsage?.inputTokens,
    outputTokens: tokenUsage?.outputTokens,
    actorUserId: usageContext.actorUserId ?? null,
    actorType: usageContext.actorType,
  };
  await recordAiUsageOptional(usageContext.organizationId, usage);
}

async function validateReceiptImage(
  imageBytes: Uint8Array,
  mimeType: string,
  usageContext?: AiUsageContext | null
): Promise<ReceiptValidationResult> {
  return callGeminiVision(
    RECEIPT_PROMPT,
    imageBytes,
    mimeType,
    'receipt-validation',
    'Receipt analyzed.',
    usageContext
  );
}

async function validateValidIdImage(
  imageBytes: Uint8Array,
  mimeType: string,
  path?: string,
  usageContext?: AiUsageContext | null
): Promise<ReceiptValidationResult> {
  return callGeminiVision(
    VALID_ID_PROMPT,
    imageBytes,
    normalizeVisionMimeType(mimeType, path),
    'valid-id-validation',
    'ID analyzed.',
    usageContext
  );
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
