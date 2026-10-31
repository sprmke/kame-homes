/**
 * AI column-header → booking field mapping (Gemini Flash-Lite primary, Groq Scout fallback).
 * Categorical status only — never numeric confidence scores.
 */

import { z } from 'zod';

import { generateStructured, type LlmBilling } from './ai/llmClient.ts';
import { definePrompt } from './ai/prompt.ts';
import { withUntrustedDataRule, wrapUntrusted } from './ai/untrusted.ts';
import { assertOrgAndPropertyAiQuota, type AiActorType } from './aiUsageService.ts';
import {
  isBookingImportTargetFieldId,
  resolveBookingImportTargetId,
  serializeBookingImportTargetFields,
} from './importTargetSchemas.ts';

export const IMPORT_COLUMN_MAPPING_STATUSES = [
  'matched',
  'likely_matched',
  'ambiguous',
  'unmatched',
] as const;

export type ImportColumnMappingStatus = (typeof IMPORT_COLUMN_MAPPING_STATUSES)[number];

export type ImportColumnMappingEntry = {
  rawHeader: string;
  suggestedTarget: string | null;
  status: ImportColumnMappingStatus;
  reason: string;
};

export type ImportColumnMappingResult = {
  mappings: ImportColumnMappingEntry[];
  provider: 'gemini' | 'groq' | 'none';
  degraded: boolean;
};

export type ImportColumnMappingInput = {
  organizationId: string;
  propertyId: string;
  headers: string[];
  /** Up to 5 sample cell values per header (column-major). */
  samplesByHeader: Record<string, string[]>;
  actorUserId?: string | null;
  actorType?: AiActorType;
};

const IMPORT_FEATURE = 'import_column_map' as const;

export const IMPORT_COLUMN_MAPPING_PROMPT = definePrompt({
  id: 'import_column_map',
  version: '2026-09-24.1',
});

/** Prompt budget: extra columns fall back to deterministic header matching. */
const MAX_AI_HEADERS = 100;
const MAX_SAMPLES_PER_HEADER = 3;
const MAX_SAMPLE_CHARS = 80;

function normalizeMappingStatus(raw: unknown): ImportColumnMappingStatus {
  const value = String(raw ?? '')
    .trim()
    .toLowerCase();
  if (
    value === 'matched' ||
    value === 'likely_matched' ||
    value === 'ambiguous' ||
    value === 'unmatched'
  ) {
    return value;
  }
  return 'unmatched';
}

const MAPPING_STATUS_RANK: Record<ImportColumnMappingStatus, number> = {
  matched: 3,
  likely_matched: 2,
  ambiguous: 1,
  unmatched: 0,
};

/**
 * When AI maps two headers to the same target field, keep the higher-confidence
 * mapping (matched > likely_matched > ambiguous) and downgrade the other to
 * ambiguous with no suggested target so the user resolves the conflict manually.
 */
function resolveDuplicateSuggestedTargets(
  mappings: ImportColumnMappingEntry[]
): ImportColumnMappingEntry[] {
  const winnerByTarget = new Map<string, number>();

  for (let index = 0; index < mappings.length; index++) {
    const entry = mappings[index]!;
    const target = entry.suggestedTarget;
    if (!target) continue;

    const existingIndex = winnerByTarget.get(target);
    if (existingIndex === undefined) {
      winnerByTarget.set(target, index);
      continue;
    }

    const existing = mappings[existingIndex]!;
    const existingRank = MAPPING_STATUS_RANK[existing.status];
    const candidateRank = MAPPING_STATUS_RANK[entry.status];

    if (candidateRank > existingRank) {
      winnerByTarget.set(target, index);
    }
  }

  return mappings.map((entry, index) => {
    const target = entry.suggestedTarget;
    if (!target) return entry;

    const winnerIndex = winnerByTarget.get(target);
    if (winnerIndex === index) return entry;

    return {
      ...entry,
      suggestedTarget: null,
      status: 'ambiguous' as const,
      reason: `Duplicate target — resolve manually (${target})`,
    };
  });
}

function sanitizeMappingEntry(
  entry: Record<string, unknown>,
  rawHeader: string
): ImportColumnMappingEntry {
  let suggestedTarget =
    typeof entry.suggestedTarget === 'string' && entry.suggestedTarget.trim()
      ? entry.suggestedTarget.trim()
      : null;
  let status = normalizeMappingStatus(entry.status);
  const reason =
    typeof entry.reason === 'string' && entry.reason.trim()
      ? entry.reason.trim().slice(0, 240)
      : status === 'unmatched'
        ? 'No confident match'
        : 'Suggested by AI';

  if (suggestedTarget && !isBookingImportTargetFieldId(suggestedTarget)) {
    suggestedTarget = resolveBookingImportTargetId(suggestedTarget);
  }
  if (suggestedTarget && !isBookingImportTargetFieldId(suggestedTarget)) {
    suggestedTarget = null;
    status = 'unmatched';
  }

  if (!suggestedTarget && status !== 'unmatched') {
    status = 'unmatched';
  }

  return {
    rawHeader,
    suggestedTarget,
    status,
    reason,
  };
}

function buildDegradedMappings(headers: string[]): ImportColumnMappingEntry[] {
  return applyDeterministicHeaderMatches(
    headers.map((rawHeader) => {
      const resolved = resolveBookingImportTargetId(rawHeader);
      if (resolved) {
        return {
          rawHeader,
          suggestedTarget: resolved,
          status: 'matched' as const,
          reason: 'Column header matches booking field',
        };
      }
      return {
        rawHeader,
        suggestedTarget: null,
        status: 'unmatched' as const,
        reason: 'AI mapping unavailable — map manually',
      };
    })
  );
}

/** When a CSV header equals a canonical field id (or legacy alias), trust the header over AI drift. */
function applyDeterministicHeaderMatches(
  mappings: ImportColumnMappingEntry[]
): ImportColumnMappingEntry[] {
  return mappings.map((entry) => {
    const resolved = resolveBookingImportTargetId(entry.rawHeader);
    if (!resolved) return entry;
    return {
      ...entry,
      suggestedTarget: resolved,
      status: 'matched',
      reason: 'Column header matches booking field',
    };
  });
}

/**
 * Minimize guest PII sent to the provider: the model only needs the *shape* of a column to map
 * it, so emails, phone numbers and long digit runs (IDs, card/account numbers) are masked.
 */
export function maskSampleValue(value: string): string {
  return value
    .slice(0, MAX_SAMPLE_CHARS)
    .replace(/[^\s@]+@[^\s@]+\.[^\s@]+/g, '<email>')
    .replace(/\+?\d[\d\s().-]{6,}\d/g, (match) =>
      match.replace(/\D/g, '').length >= 7 ? '<number>' : match
    );
}

function buildPrompt(input: ImportColumnMappingInput): { system: string; user: string } {
  const targetFields = serializeBookingImportTargetFields();
  const columns = input.headers.map((header) => ({
    rawHeader: header,
    sampleValues: (input.samplesByHeader[header] ?? [])
      .slice(0, MAX_SAMPLES_PER_HEADER)
      .map(maskSampleValue),
  }));

  const system = withUntrustedDataRule(
    'You map spreadsheet column headers to canonical booking database fields.\n' +
      'Rules:\n' +
      '- suggestedTarget MUST be one of the target field ids provided, or null.\n' +
      '- Never map to status, file URLs, AI verdict columns, or workflow timestamps.\n' +
      '- Use matched when the header clearly equals a target id or obvious synonym.\n' +
      '- Use likely_matched for strong but not exact matches.\n' +
      '- Use ambiguous when multiple targets could fit.\n' +
      '- Use unmatched when no target fits.\n' +
      '- Do NOT output numeric confidence scores.\n' +
      '- Return exactly one mapping object per input column, same rawHeader values, as JSON.'
  );
  const user =
    `Target fields:\n${JSON.stringify(targetFields)}\n\n` +
    `Input columns (uploaded spreadsheet content):\n${wrapUntrusted('csv_columns', JSON.stringify(columns), 20_000)}`;
  return { system, user };
}

const MappingResponse = z.object({
  mappings: z.array(
    z
      .object({
        rawHeader: z.string(),
        suggestedTarget: z.string().nullable().optional(),
        status: z.string().optional(),
        reason: z.string().optional(),
      })
      .passthrough()
  ),
});

const MAPPING_JSON_SCHEMA = {
  type: 'OBJECT',
  properties: {
    mappings: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          rawHeader: { type: 'STRING' },
          suggestedTarget: { type: 'STRING', nullable: true },
          status: { type: 'STRING', enum: [...IMPORT_COLUMN_MAPPING_STATUSES] },
          reason: { type: 'STRING' },
        },
        required: ['rawHeader', 'status', 'reason'],
      },
    },
  },
  required: ['mappings'],
};

/** Business-rule pass over validated model output: one entry per header, known targets only. */
function toMappingEntries(
  payload: z.infer<typeof MappingResponse>,
  headers: string[]
): ImportColumnMappingEntry[] {
  const byHeader = new Map<string, Record<string, unknown>>();
  for (const row of payload.mappings) {
    const header = row.rawHeader.trim();
    if (header) byHeader.set(header, row);
  }
  const sanitized = headers.map((header) =>
    sanitizeMappingEntry(byHeader.get(header) ?? { rawHeader: header }, header)
  );
  return resolveDuplicateSuggestedTargets(sanitized);
}

/**
 * The model step alone (prompt → validated contract → business rules), shared by
 * suggestImportColumnMappings and the live eval runner. Throws on AI failure.
 */
export async function mapColumnsWithModel(
  input: { headers: string[]; samplesByHeader: Record<string, string[]> },
  billing: LlmBilling
): Promise<{ mappings: ImportColumnMappingEntry[]; provider: 'gemini' | 'groq' }> {
  const aiHeaders = input.headers.slice(0, MAX_AI_HEADERS);
  const { system, user } = buildPrompt({
    organizationId: billing.organizationId ?? '',
    propertyId: billing.propertyId ?? '',
    headers: aiHeaders,
    samplesByHeader: input.samplesByHeader,
  });
  const result = await generateStructured({
    feature: IMPORT_FEATURE,
    prompt: IMPORT_COLUMN_MAPPING_PROMPT,
    system,
    user,
    temperature: 0.1,
    schema: MappingResponse,
    jsonSchema: MAPPING_JSON_SCHEMA,
    cache: {},
    billing,
  });
  const aiMappings = toMappingEntries(result.data, aiHeaders);
  const overflow = buildDegradedMappings(input.headers.slice(MAX_AI_HEADERS));
  return {
    mappings: applyDeterministicHeaderMatches([...aiMappings, ...overflow]),
    provider: result.provider,
  };
}

/** Suggest booking-field mappings for CSV headers. Degrades to all-unmatched when AI is unavailable. */
export async function suggestImportColumnMappings(
  input: ImportColumnMappingInput
): Promise<ImportColumnMappingResult> {
  const headers = input.headers.filter((header) => header.trim().length > 0);
  if (!headers.length) {
    return { mappings: [], provider: 'none', degraded: true };
  }

  try {
    await assertOrgAndPropertyAiQuota(input.organizationId, input.propertyId, IMPORT_FEATURE);
  } catch (error) {
    console.warn('[importColumnMappingAi] quota blocked:', (error as Error).message);
    return {
      mappings: buildDegradedMappings(headers),
      provider: 'none',
      degraded: true,
    };
  }

  try {
    const { mappings, provider } = await mapColumnsWithModel(
      { headers, samplesByHeader: input.samplesByHeader },
      {
        organizationId: input.organizationId,
        propertyId: input.propertyId,
        actorUserId: input.actorUserId ?? null,
        actorType: input.actorType ?? 'staff',
        quotaChecked: true,
      }
    );
    return { mappings, provider, degraded: false };
  } catch (error) {
    console.warn('[importColumnMappingAi] AI mapping failed:', (error as Error).message);
  }

  console.warn('[importColumnMappingAi] All providers unavailable — degrading to unmatched');
  return {
    mappings: buildDegradedMappings(headers),
    provider: 'none',
    degraded: true,
  };
}
