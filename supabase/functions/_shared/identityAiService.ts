/**
 * Identity document extraction + advisory face comparison through the AI gateway.
 *
 * Same contract as `receiptValidationService.validateDocument`: never throws for an AI
 * problem. A quota error, an outage, or unreadable model output returns `status: 'error'`
 * and the caller degrades to `unverified` with an `ai_unavailable` flag. Identity capture
 * must never fail because a model is down.
 */

import { z } from 'zod';

import { AiProviderError, generateStructured, isAiGatewayError } from './ai/llmClient.ts';
import {
  IDENTITY_EXTRACTION_JSON_SCHEMA,
  IDENTITY_EXTRACTION_PROMPT,
  IDENTITY_EXTRACTION_SYSTEM_PROMPT,
} from './ai/prompts/identityExtraction.ts';
import { isAiQuotaError, type AiActorType } from './aiUsageService.ts';
import { toHostFacingError } from './hostFacingError.ts';
import type { IdentityFaceMatchVerdict } from './identityVerification.ts';

const IDENTITY_FEATURE = 'identity_extraction' as const;

export type IdentityAiUsageContext = {
  organizationId?: string | null;
  propertyId?: string | null;
  actorUserId?: string | null;
  actorType?: AiActorType;
};

export type IdentityExtraction = {
  status: 'ok' | 'skipped' | 'error';
  isDocument: boolean;
  documentType: string | null;
  fullName: string | null;
  dateOfBirth: string | null;
  sex: string | null;
  nationality: string | null;
  documentNumber: string | null;
  expiryDate: string | null;
  issueDate: string | null;
  genuineOpinion: 'genuine' | 'likely_genuine' | 'unclear' | 'suspected_fake';
  screenOrPhotocopySuspected: boolean;
  faceComparison: IdentityFaceMatchVerdict;
  confidence: number;
  notes: string;
  /** Present only when `status === 'error'`. */
  error?: string;
};

const DOCUMENT_TYPES = [
  'philid',
  'ephilid',
  'passport',
  'drivers_license',
  'umid',
  'sss',
  'philhealth',
  'postal',
  'voters',
  'prc',
  'other',
  'none',
] as const;

const ResponseSchema = z.object({
  is_document: z.coerce.boolean(),
  document_type: z.enum(DOCUMENT_TYPES),
  full_name: z.string().nullable().optional(),
  date_of_birth: z.string().nullable().optional(),
  sex: z.string().nullable().optional(),
  nationality: z.string().nullable().optional(),
  document_number: z.string().nullable().optional(),
  expiry_date: z.string().nullable().optional(),
  issue_date: z.string().nullable().optional(),
  is_genuine_document_opinion: z.enum(['genuine', 'likely_genuine', 'unclear', 'suspected_fake']),
  screen_or_photocopy_suspected: z.coerce.boolean(),
  face_comparison: z.enum(['match', 'likely_match', 'unclear', 'mismatch', 'skipped']),
  confidence: z.coerce.number(),
  notes: z.string().optional(),
});

function emptyResult(status: 'skipped' | 'error', error?: string): IdentityExtraction {
  return {
    status,
    isDocument: false,
    documentType: null,
    fullName: null,
    dateOfBirth: null,
    sex: null,
    nationality: null,
    documentNumber: null,
    expiryDate: null,
    issueDate: null,
    genuineOpinion: 'unclear',
    screenOrPhotocopySuspected: false,
    faceComparison: 'skipped',
    confidence: 0,
    notes: '',
    ...(error ? { error } : {}),
  };
}

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function normalizeDate(value: string | null | undefined): string | null {
  const trimmed = (value ?? '').trim();
  return ISO_DATE_RE.test(trimmed) ? trimmed : null;
}

function normalizeSex(value: string | null | undefined): string | null {
  const normalized = (value ?? '').trim().toLowerCase();
  if (normalized.startsWith('m')) return 'male';
  if (normalized.startsWith('f')) return 'female';
  return null;
}

function normalizeNumber(value: string | null | undefined): string | null {
  const normalized = (value ?? '').replace(/[\s-]/g, '').trim();
  return normalized || null;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function normalizeVisionMimeType(mimeType: string): string {
  if (mimeType?.startsWith('image/')) return mimeType;
  return 'image/jpeg';
}

export async function extractIdentityDocument(options: {
  documentBytes: Uint8Array;
  documentMimeType: string;
  selfieBytes?: Uint8Array | null;
  selfieMimeType?: string | null;
  usageContext?: IdentityAiUsageContext | null;
  requestId?: string;
}): Promise<IdentityExtraction> {
  if (!options.documentBytes?.length) return emptyResult('skipped', 'no_document_image');

  const parts = [
    { text: 'Read the attached ID and return the JSON object described in the system prompt.' },
    {
      inlineData: {
        mimeType: normalizeVisionMimeType(options.documentMimeType),
        data: bytesToBase64(options.documentBytes),
      },
    },
  ];
  if (options.selfieBytes?.length) {
    parts.push({
      text: 'The second image is the person. Compare the face in the portrait on the ID with this face and return face_comparison. If the ID carries no portrait, return "unclear".',
    });
    parts.push({
      inlineData: {
        mimeType: normalizeVisionMimeType(options.selfieMimeType ?? 'image/jpeg'),
        data: bytesToBase64(options.selfieBytes),
      },
    });
  }

  try {
    const result = await generateStructured({
      feature: IDENTITY_FEATURE,
      prompt: IDENTITY_EXTRACTION_PROMPT,
      system: IDENTITY_EXTRACTION_SYSTEM_PROMPT,
      user: parts,
      temperature: 0.1,
      schema: ResponseSchema,
      jsonSchema: IDENTITY_EXTRACTION_JSON_SCHEMA,
      billing: {
        organizationId: options.usageContext?.organizationId ?? undefined,
        propertyId: options.usageContext?.propertyId ?? null,
        actorUserId: options.usageContext?.actorUserId ?? null,
        actorType: options.usageContext?.actorType,
      },
    });

    const data = result.data;
    const confidence = Number.isFinite(data.confidence)
      ? Math.min(1, Math.max(0, data.confidence))
      : 0;
    // Extraction + provider only. Notes can echo document text, so they are never logged.
    console.log(`[identity-extraction] [${result.provider}] type=${data.document_type}`);
    return {
      status: 'ok',
      isDocument: data.is_document && data.document_type !== 'none',
      documentType: data.document_type === 'none' ? null : data.document_type,
      fullName: (data.full_name ?? '').replace(/\s+/g, ' ').trim().slice(0, 200) || null,
      dateOfBirth: normalizeDate(data.date_of_birth),
      sex: normalizeSex(data.sex),
      nationality: (data.nationality ?? '').trim().slice(0, 64) || null,
      documentNumber: normalizeNumber(data.document_number),
      expiryDate: normalizeDate(data.expiry_date),
      issueDate: normalizeDate(data.issue_date),
      genuineOpinion: data.is_genuine_document_opinion,
      screenOrPhotocopySuspected: data.screen_or_photocopy_suspected,
      faceComparison: options.selfieBytes?.length ? data.face_comparison : 'skipped',
      confidence,
      notes: (data.notes ?? '').replace(/\s+/g, ' ').trim().slice(0, 160),
    };
  } catch (err) {
    if (err instanceof AiProviderError && err.code === 'not_configured') {
      console.warn('[identity-extraction] No AI provider configured - skipping');
      return emptyResult('skipped', 'not_configured');
    }
    if (isAiQuotaError(err)) return emptyResult('error', 'AI quota exceeded');
    if (isAiGatewayError(err)) {
      console.warn(`[identity-extraction] failed: ${err.name}`);
      return emptyResult(
        'error',
        toHostFacingError(err, 'AI extraction is unavailable right now. Try again.')
      );
    }
    throw err;
  }
}
