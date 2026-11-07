/**
 * Cancellation policy engine — client mirror of
 * `supabase/functions/_shared/cancellationPolicy.ts`.
 *
 * Keep this file byte-for-byte aligned with the server copy (the header differs
 * only). `cancellationPolicyParity.test.ts` fails on drift.
 *
 * Plan: docs/workflow/in-progress/cancellation-policy-and-process.md
 */

export const CANCELLATION_POLICY_VERSION = 2 as const;
export const CANCELLATION_POLICY_MAX_TIERS = 5;

export type CancellationPresetId =
  | 'flexible'
  | 'moderate'
  | 'standard'
  | 'limited'
  | 'firm'
  | 'non_refundable'
  | 'custom';

export type CancellationTier = {
  /** "Cancel at least `daysBefore` days before check-in …" */
  daysBefore: number;
  /** … "→ `refundPercent`% of what you paid." */
  refundPercent: number;
};

export type CancellationPolicy = {
  version: typeof CANCELLATION_POLICY_VERSION;
  presetId: CancellationPresetId;
  /** Sorted most generous first (highest `daysBefore` first). */
  tiers: CancellationTier[];
  /** Percent refunded when no tier matches. 0 for every preset and the builder. */
  fallbackRefundPercent: number;
  /** Legacy free-text title, preserved for display. */
  legacyTitle?: string;
  /** Legacy free-text description, preserved for display. */
  legacyDescription?: string;
  /** Migrated free text: the host must finish setup before this drives money. */
  needsReview?: boolean;
};

export type CancellationPolicySnapshot = {
  policy: CancellationPolicy | null;
  capturedAt: string;
  capturedFrom: 'guest_form' | 'form_completion' | 'import' | 'external' | 'backfill' | 'admin';
  propertyPolicyVersionId: string | null;
  rendered: {
    title: string;
    description: string;
    shortLabel: string;
  };
  hash: string;
  externalSource?: string | null;
  unset?: boolean;
};

export type CancellationTimelineRow = {
  daysBefore: number;
  refundPercent: number;
  label: string;
};

export type ResolvedCancellationPolicyDisplay = {
  presetId: CancellationPresetId | 'unset';
  title: string;
  description: string;
  tone: 'positive' | 'neutral' | 'warning';
  showListingHighlight: boolean;
  shortLabel: string;
  timeline: CancellationTimelineRow[];
  fallbackRefundPercent: number;
  needsReview: boolean;
  unset: boolean;
};

export const CANCELLATION_PRESETS: {
  id: CancellationPresetId;
  label: string;
  summary: string;
  recommended?: boolean;
}[] = [
  {
    id: 'flexible',
    label: 'Flexible',
    summary: 'Full refund of what the guest paid up to 1 day before check-in.',
  },
  {
    id: 'moderate',
    label: 'Moderate',
    summary: 'Full refund of what the guest paid up to 3 days before check-in.',
    recommended: true,
  },
  {
    id: 'standard',
    label: 'Standard',
    summary: 'Full refund of what the guest paid up to 5 days before check-in.',
  },
  {
    id: 'limited',
    label: 'Limited',
    summary: 'Full refund of what the guest paid up to 7 days before check-in.',
  },
  {
    id: 'firm',
    label: 'Firm',
    summary: 'Full refund of what the guest paid up to 14 days before, 50% up to 7 days before.',
  },
  {
    id: 'non_refundable',
    label: 'Non-refundable',
    summary: 'No refund of what the guest paid after booking.',
  },
  {
    id: 'custom',
    label: 'Custom',
    summary: 'Build your own refund schedule.',
  },
];

const PRESET_IDS = new Set<CancellationPresetId>(
  CANCELLATION_PRESETS.map((preset) => preset.id)
);

const PRESET_DEFINITIONS: Record<
  Exclude<CancellationPresetId, 'custom'>,
  { tiers: CancellationTier[]; fallbackRefundPercent: number }
> = {
  flexible: { tiers: [{ daysBefore: 1, refundPercent: 100 }], fallbackRefundPercent: 0 },
  moderate: { tiers: [{ daysBefore: 3, refundPercent: 100 }], fallbackRefundPercent: 0 },
  standard: { tiers: [{ daysBefore: 5, refundPercent: 100 }], fallbackRefundPercent: 0 },
  limited: { tiers: [{ daysBefore: 7, refundPercent: 100 }], fallbackRefundPercent: 0 },
  firm: {
    tiers: [
      { daysBefore: 14, refundPercent: 100 },
      { daysBefore: 7, refundPercent: 50 },
    ],
    fallbackRefundPercent: 0,
  },
  non_refundable: { tiers: [], fallbackRefundPercent: 0 },
};

function readString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function readNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

function clampInt(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(value)));
}

/** Sort most generous first, drop duplicates, and clamp. */
export function normalizeCancellationTiers(raw: unknown): CancellationTier[] {
  if (!Array.isArray(raw)) return [];
  const byDay = new Map<number, CancellationTier>();
  for (const row of raw.slice(0, CANCELLATION_POLICY_MAX_TIERS * 2)) {
    if (!row || typeof row !== 'object' || Array.isArray(row)) continue;
    const entry = row as Record<string, unknown>;
    const days = readNumber(entry.daysBefore);
    const percent = readNumber(entry.refundPercent);
    if (days == null || percent == null) continue;
    const daysBefore = clampInt(days, 0, 365);
    const refundPercent = clampInt(percent, 0, 100);
    byDay.set(daysBefore, { daysBefore, refundPercent });
  }
  return [...byDay.values()]
    .sort((a, b) => b.daysBefore - a.daysBefore)
    .slice(0, CANCELLATION_POLICY_MAX_TIERS);
}

function buildPresetPolicy(
  presetId: Exclude<CancellationPresetId, 'custom'>
): CancellationPolicy {
  const def = PRESET_DEFINITIONS[presetId];
  return {
    version: CANCELLATION_POLICY_VERSION,
    presetId,
    tiers: def.tiers.map((tier) => ({ ...tier })),
    fallbackRefundPercent: def.fallbackRefundPercent,
  };
}

/** Build a fresh policy from a preset id (used by the settings UI and seeds). */
export function buildCancellationPreset(
  presetId: CancellationPresetId,
  input?: Record<string, unknown>
): CancellationPolicy {
  if (presetId !== 'custom') return buildPresetPolicy(presetId);
  return {
    version: CANCELLATION_POLICY_VERSION,
    presetId: 'custom',
    tiers: normalizeCancellationTiers(input?.tiers),
    fallbackRefundPercent: 0,
  };
}

/** Legacy v1 settings shape (still in production rows). */
type LegacyCancellationPolicy = {
  type?: unknown;
  daysBeforeCheckIn?: unknown;
  partialRefundPercent?: unknown;
  customTitle?: unknown;
  customDescription?: unknown;
};

function normalizeLegacyDays(value: number | undefined): number {
  if (value && value > 0) return clampInt(value, 0, 365);
  return 7;
}

function normalizeLegacyPercent(value: number | undefined): number {
  if (value && value > 0) return clampInt(value, 0, 100);
  return 50;
}

function mapLegacyPolicy(raw: LegacyCancellationPolicy): CancellationPolicy | null {
  const type = readString(raw.type);
  if (!type) return null;

  switch (type) {
    case 'grace_period':
      // The old "free cancellation within N hours of booking" cannot be
      // represented by a simple deadline. Flexible is the closest simple
      // preset; hosts can pick a stricter one.
      return buildCancellationPreset('flexible');
    case 'full_before_checkin':
      return buildCancellationPreset('custom', {
        tiers: [{ daysBefore: normalizeLegacyDays(readNumber(raw.daysBeforeCheckIn)), refundPercent: 100 }],
      });
    case 'moderate':
      return buildCancellationPreset('custom', {
        tiers: [{ daysBefore: normalizeLegacyDays(readNumber(raw.daysBeforeCheckIn)), refundPercent: 100 }],
      });
    case 'partial_before_checkin':
      return buildCancellationPreset('custom', {
        tiers: [
          {
            daysBefore: normalizeLegacyDays(readNumber(raw.daysBeforeCheckIn)),
            refundPercent: normalizeLegacyPercent(readNumber(raw.partialRefundPercent)),
          },
        ],
      });
    case 'non_refundable':
      return buildCancellationPreset('non_refundable');
    case 'custom': {
      const description = readString(raw.customDescription).trim();
      const title = readString(raw.customTitle).trim();
      return {
        version: CANCELLATION_POLICY_VERSION,
        presetId: 'custom',
        tiers: [],
        fallbackRefundPercent: 0,
        needsReview: true,
        ...(description ? { legacyDescription: description } : {}),
        ...(title ? { legacyTitle: title } : {}),
      };
    }
    default:
      return null;
  }
}

/**
 * Normalize any stored shape to v2. Returns `null` when the property has no
 * policy at all — never a silent default.
 */
export function normalizeCancellationPolicy(raw: unknown): CancellationPolicy | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const input = raw as Record<string, unknown>;

  // v1 rows have `type`; v2 rows have `presetId` + `version`. Anything else is unset.
  if (!('presetId' in input) && !('type' in input)) return null;
  if (!('presetId' in input) && ('type' in input)) {
    return mapLegacyPolicy(input as LegacyCancellationPolicy);
  }

  const presetRaw = readString(input.presetId);
  const presetId = PRESET_IDS.has(presetRaw as CancellationPresetId)
    ? (presetRaw as CancellationPresetId)
    : 'custom';

  if (presetId !== 'custom') return buildPresetPolicy(presetId);

  const legacyTitle = readString(input.legacyTitle).trim();
  const legacyDescription = readString(input.legacyDescription).trim();

  return {
    version: CANCELLATION_POLICY_VERSION,
    presetId: 'custom',
    tiers: normalizeCancellationTiers(input.tiers),
    fallbackRefundPercent: clampInt(readNumber(input.fallbackRefundPercent) ?? 0, 0, 100),
    ...(legacyTitle ? { legacyTitle } : {}),
    ...(legacyDescription ? { legacyDescription } : {}),
    ...(input.needsReview === true ? { needsReview: true } : {}),
  };
}

export function readCancellationPolicyFromSettings(
  settings: Record<string, unknown> | undefined | null
): CancellationPolicy | null {
  return normalizeCancellationPolicy(settings?.cancellationPolicy);
}

export function readCancellationPolicyVersionId(
  settings: Record<string, unknown> | undefined | null
): string | null {
  const value = settings?.cancellationPolicyVersionId;
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

export function cancellationPolicyEqual(
  a: CancellationPolicy | null,
  b: CancellationPolicy | null
): boolean {
  return stableStringify(a) === stableStringify(b);
}

/** Deterministic JSON so hashes and equality do not depend on key order. */
export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`).join(',')}}`;
}

/** FNV-1a 64-bit, hex. Tamper-evidence only; the DB trigger is the real guard. */
export function cancellationPolicyHash(policy: CancellationPolicy | null): string {
  const input = stableStringify(policy);
  let hash = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= BigInt(input.charCodeAt(i));
    hash = (hash * prime) & 0xffffffffffffffffn;
  }
  return hash.toString(16).padStart(16, '0');
}

function daysLabel(days: number): string {
  if (days === 0) return 'on check-in day';
  return days === 1 ? '1 day' : `${days} days`;
}

function buildTimeline(policy: CancellationPolicy): CancellationTimelineRow[] {
  return policy.tiers.map((tier) => ({
    daysBefore: tier.daysBefore,
    refundPercent: tier.refundPercent,
    label: `${daysLabel(tier.daysBefore)} before check-in`,
  }));
}

export function resolveCancellationPolicyDisplay(
  policyInput: CancellationPolicy | null | unknown
): ResolvedCancellationPolicyDisplay {
  const policy =
    policyInput === null || policyInput === undefined
      ? null
      : normalizeCancellationPolicy(policyInput);

  if (!policy) {
    return {
      presetId: 'unset',
      title: 'Ask the host about cancellation',
      description: 'This host has not set cancellation terms yet.',
      tone: 'neutral',
      showListingHighlight: false,
      shortLabel: 'Ask the host',
      timeline: [],
      fallbackRefundPercent: 0,
      needsReview: false,
      unset: true,
    };
  }

  const timeline = buildTimeline(policy);
  const legacyTitle = policy.legacyTitle?.trim();
  const legacyDescription = policy.legacyDescription?.trim();

  if (policy.needsReview) {
    return {
      presetId: 'custom',
      title: legacyTitle || 'Finish setting up your cancellation policy',
      description:
        legacyDescription ||
        'This policy was written as free text. Add refund deadlines so guests see exact terms.',
      tone: 'warning',
      showListingHighlight: false,
      shortLabel: legacyTitle || 'Custom policy',
      timeline,
      fallbackRefundPercent: policy.fallbackRefundPercent,
      needsReview: true,
      unset: false,
    };
  }

  switch (policy.presetId) {
    case 'flexible':
      return {
        presetId: policy.presetId,
        title: 'Flexible',
        description: 'Full refund of what you paid up to 1 day before check-in.',
        tone: 'positive',
        showListingHighlight: true,
        shortLabel: 'Free cancellation',
        timeline,
        fallbackRefundPercent: policy.fallbackRefundPercent,
        needsReview: false,
        unset: false,
      };
    case 'moderate':
      return {
        presetId: policy.presetId,
        title: 'Moderate',
        description: 'Full refund of what you paid up to 3 days before check-in.',
        tone: 'positive',
        showListingHighlight: true,
        shortLabel: 'Free cancellation',
        timeline,
        fallbackRefundPercent: policy.fallbackRefundPercent,
        needsReview: false,
        unset: false,
      };
    case 'standard':
      return {
        presetId: policy.presetId,
        title: 'Standard',
        description: 'Full refund of what you paid up to 5 days before check-in.',
        tone: 'positive',
        showListingHighlight: true,
        shortLabel: 'Free cancellation',
        timeline,
        fallbackRefundPercent: policy.fallbackRefundPercent,
        needsReview: false,
        unset: false,
      };
    case 'limited':
      return {
        presetId: policy.presetId,
        title: 'Limited',
        description: 'Full refund of what you paid up to 7 days before check-in.',
        tone: 'positive',
        showListingHighlight: true,
        shortLabel: 'Free cancellation',
        timeline,
        fallbackRefundPercent: policy.fallbackRefundPercent,
        needsReview: false,
        unset: false,
      };
    case 'firm':
      return {
        presetId: policy.presetId,
        title: 'Firm',
        description: 'Full refund of what you paid up to 14 days before check-in, 50% up to 7 days before.',
        tone: 'neutral',
        showListingHighlight: true,
        shortLabel: 'Partial refund',
        timeline,
        fallbackRefundPercent: policy.fallbackRefundPercent,
        needsReview: false,
        unset: false,
      };
    case 'non_refundable':
      return {
        presetId: policy.presetId,
        title: 'Non-refundable',
        description: 'No refund of what you paid after the booking is confirmed.',
        tone: 'warning',
        showListingHighlight: false,
        shortLabel: 'Non-refundable',
        timeline,
        fallbackRefundPercent: policy.fallbackRefundPercent,
        needsReview: false,
        unset: false,
      };
    default: {
      if (timeline.length === 0) {
        return {
          presetId: 'custom',
          title: legacyTitle || 'Cancellation terms',
          description: legacyDescription || 'Contact the host for cancellation terms.',
          tone: 'neutral',
          showListingHighlight: false,
          shortLabel: legacyTitle || 'Custom policy',
          timeline,
          fallbackRefundPercent: policy.fallbackRefundPercent,
          needsReview: false,
          unset: false,
        };
      }
      const first = timeline[0]!;
      return {
        presetId: 'custom',
        title:
          legacyTitle ||
          (timeline.length === 1
            ? `${first.refundPercent}% of what you paid, ${daysLabel(first.daysBefore)} before check-in`
            : 'Tiered refunds'),
        description:
          legacyDescription ||
          timeline
            .map(
              (row) =>
                `${row.refundPercent}% of what you paid at least ${daysLabel(row.daysBefore)} before check-in`
            )
            .join(', ') +
            (policy.fallbackRefundPercent > 0
              ? `, ${policy.fallbackRefundPercent}% after that.`
              : ', no refund after that.'),
        tone: first.refundPercent >= 100 ? 'positive' : 'neutral',
        showListingHighlight: first.refundPercent >= 100,
        shortLabel: first.refundPercent >= 100 ? 'Free cancellation' : 'Partial refund',
        timeline,
        fallbackRefundPercent: policy.fallbackRefundPercent,
        needsReview: false,
        unset: false,
      };
    }
  }
}


/** True when the guest gets nothing back at any deadline. */
export function isCancellationPolicyNonRefundable(
  display: ResolvedCancellationPolicyDisplay
): boolean {
  if (display.unset || display.needsReview) return false;
  if (display.shortLabel === 'Non-refundable') return true;
  if (display.timeline.length === 0) return false;
  return (
    display.fallbackRefundPercent === 0 &&
    display.timeline.every((row) => row.refundPercent === 0)
  );
}

/** Returns an error message, or null when the policy is valid. */
export function validateCancellationPolicy(policyInput: unknown): string | null {
  const policy = normalizeCancellationPolicy(policyInput);
  if (!policy) return 'Choose a cancellation policy';

  if (policy.presetId !== 'custom') return null;
  if (policy.needsReview) return null;

  if (policy.tiers.length === 0) {
    return 'Add at least one refund deadline';
  }

  let previousDays = Number.POSITIVE_INFINITY;
  let previousPercent = 101;
  for (const tier of policy.tiers) {
    if (tier.daysBefore >= previousDays) {
      return 'Refund deadlines must be different and listed from furthest to closest';
    }
    if (tier.refundPercent > previousPercent) {
      return 'Refund percent cannot increase closer to check-in';
    }
    previousDays = tier.daysBefore;
    previousPercent = tier.refundPercent;
  }

  const last = policy.tiers[policy.tiers.length - 1]!;
  if (policy.fallbackRefundPercent > last.refundPercent) {
    return 'The fallback refund cannot be higher than the closest deadline';
  }

  return null;
}

export function cancellationPolicyToSettingsPatch(
  policy: CancellationPolicy | null
): Record<string, unknown> {
  return {
    cancellationPolicy: policy ? normalizeCancellationPolicy(policy) : null,
  };
}

/** Build the immutable booking-time snapshot. */
export function buildCancellationPolicySnapshot(input: {
  policy: CancellationPolicy | null;
  capturedFrom: CancellationPolicySnapshot['capturedFrom'];
  propertyPolicyVersionId?: string | null;
  capturedAt?: string;
  externalSource?: string | null;
}): CancellationPolicySnapshot {
  const display = resolveCancellationPolicyDisplay(input.policy);
  const capturedAt = input.capturedAt ?? new Date().toISOString();
  return {
    policy: input.policy,
    capturedAt,
    capturedFrom: input.capturedFrom,
    propertyPolicyVersionId: input.propertyPolicyVersionId ?? null,
    rendered: {
      title: display.title,
      description: display.description,
      shortLabel: display.shortLabel,
    },
    hash: cancellationPolicyHash(input.policy),
    ...(input.externalSource ? { externalSource: input.externalSource } : {}),
    ...(input.policy === null ? { unset: true } : {}),
  };
}

export function readCancellationPolicySnapshot(raw: unknown): CancellationPolicySnapshot | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const input = raw as Record<string, unknown>;
  const policy = normalizeCancellationPolicy(input.policy);
  const rendered = (input.rendered ?? {}) as Record<string, unknown>;
  return {
    policy,
    capturedAt: readString(input.capturedAt) || new Date(0).toISOString(),
    capturedFrom:
      input.capturedFrom === 'guest_form' ||
      input.capturedFrom === 'form_completion' ||
      input.capturedFrom === 'import' ||
      input.capturedFrom === 'external' ||
      input.capturedFrom === 'backfill' ||
      input.capturedFrom === 'admin'
        ? input.capturedFrom
        : 'backfill',
    propertyPolicyVersionId: readString(input.propertyPolicyVersionId) || null,
    rendered: {
      title: readString(rendered.title),
      description: readString(rendered.description),
      shortLabel: readString(rendered.shortLabel),
    },
    hash: readString(input.hash),
    ...(readString(input.externalSource) ? { externalSource: readString(input.externalSource) } : {}),
    ...(input.unset === true || policy === null ? { unset: true } : {}),
  };
}
