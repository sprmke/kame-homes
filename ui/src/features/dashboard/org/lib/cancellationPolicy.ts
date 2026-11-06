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
export const CANCELLATION_POLICY_NOTE_MAX = 300;
export const CANCELLATION_GRACE_HOUR_OPTIONS = [24, 48, 72, 168] as const;
export const CANCELLATION_MIN_LEAD_DAY_OPTIONS = [0, 3, 7, 14, 30] as const;

export type CancellationPresetId =
  | 'flexible'
  | 'moderate'
  | 'limited'
  | 'firm'
  | 'strict'
  | 'non_refundable'
  | 'custom';

export type CancellationTier = {
  /** "Cancel at least `daysBefore` days before check-in …" */
  daysBefore: number;
  /** … "→ `refundPercent`% of the stay amount." */
  refundPercent: number;
};

export type CancellationFeeRule = 'follow_policy' | 'always_refund' | 'never_refund';

export type CancellationGrace = {
  enabled: boolean;
  hours: number;
  /** Grace only applies when the booking was made at least this many days before check-in. */
  minLeadDays: number;
};

export type CancellationPolicy = {
  version: typeof CANCELLATION_POLICY_VERSION;
  presetId: CancellationPresetId;
  /** Sorted most generous first (highest `daysBefore` first). */
  tiers: CancellationTier[];
  fallbackRefundPercent: number;
  grace: CancellationGrace | null;
  feeRules: {
    petFee: CancellationFeeRule;
    additionalFees: CancellationFeeRule;
  };
  guestCancellation: 'instant' | 'request';
  /** Optional host note shown under the schedule (<=300 chars). */
  note?: string;
  /** Legacy free-text title, preserved for display. */
  legacyTitle?: string;
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
    summary: 'Full refund of what you paid up to 1 day before check-in.',
  },
  {
    id: 'moderate',
    label: 'Moderate',
    summary: 'Full refund of what you paid up to 5 days before check-in.',
    recommended: true,
  },
  {
    id: 'limited',
    label: 'Limited',
    summary: 'Full refund of what you paid up to 14 days before check-in.',
  },
  {
    id: 'firm',
    label: 'Firm',
    summary: 'Full refund of what you paid up to 30 days before, 50% up to 7 days before.',
  },
  {
    id: 'strict',
    label: 'Strict',
    summary: '50% of what you paid, up to 7 days before check-in.',
  },
  {
    id: 'non_refundable',
    label: 'Non-refundable',
    summary: 'No refund of your down payment after booking.',
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

const DEFAULT_GRACE: CancellationGrace = { enabled: true, hours: 24, minLeadDays: 7 };

const PRESET_DEFINITIONS: Record<
  Exclude<CancellationPresetId, 'custom'>,
  { tiers: CancellationTier[]; fallbackRefundPercent: number; grace: CancellationGrace | null }
> = {
  flexible: { tiers: [{ daysBefore: 1, refundPercent: 100 }], fallbackRefundPercent: 0, grace: DEFAULT_GRACE },
  moderate: { tiers: [{ daysBefore: 5, refundPercent: 100 }], fallbackRefundPercent: 0, grace: DEFAULT_GRACE },
  limited: { tiers: [{ daysBefore: 14, refundPercent: 100 }], fallbackRefundPercent: 0, grace: DEFAULT_GRACE },
  firm: {
    tiers: [
      { daysBefore: 30, refundPercent: 100 },
      { daysBefore: 7, refundPercent: 50 },
    ],
    fallbackRefundPercent: 0,
    grace: DEFAULT_GRACE,
  },
  strict: { tiers: [{ daysBefore: 7, refundPercent: 50 }], fallbackRefundPercent: 0, grace: DEFAULT_GRACE },
  non_refundable: { tiers: [], fallbackRefundPercent: 0, grace: null },
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

function normalizeFeeRule(value: unknown, fallback: CancellationFeeRule): CancellationFeeRule {
  return value === 'follow_policy' || value === 'always_refund' || value === 'never_refund'
    ? value
    : fallback;
}

function normalizeGrace(raw: unknown): CancellationGrace | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const input = raw as Record<string, unknown>;
  if (input.enabled === false) return null;
  const hours = clampInt(readNumber(input.hours) ?? DEFAULT_GRACE.hours, 1, 168);
  const minLeadDays = clampInt(readNumber(input.minLeadDays) ?? DEFAULT_GRACE.minLeadDays, 0, 30);
  return { enabled: true, hours, minLeadDays };
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
  presetId: Exclude<CancellationPresetId, 'custom'>,
  input?: Record<string, unknown>
): CancellationPolicy {
  const def = PRESET_DEFINITIONS[presetId];
  const grace =
    input?.grace === undefined
      ? def.grace
        ? { ...def.grace }
        : null
      : normalizeGrace(input.grace);
  return {
    version: CANCELLATION_POLICY_VERSION,
    presetId,
    tiers: def.tiers.map((tier) => ({ ...tier })),
    fallbackRefundPercent: def.fallbackRefundPercent,
    grace,
    feeRules: {
      petFee: normalizeFeeRule(
        (input?.feeRules as Record<string, unknown> | undefined)?.petFee,
        'follow_policy'
      ),
      additionalFees: normalizeFeeRule(
        (input?.feeRules as Record<string, unknown> | undefined)?.additionalFees,
        'follow_policy'
      ),
    },
    guestCancellation: input?.guestCancellation === 'request' ? 'request' : 'instant',
    ...(readString(input?.note).trim()
      ? { note: readString(input?.note).trim().slice(0, CANCELLATION_POLICY_NOTE_MAX) }
      : {}),
  };
}

/** Build a fresh policy from a preset id (used by the settings UI and seeds). */
export function buildCancellationPreset(
  presetId: CancellationPresetId,
  input?: Record<string, unknown>
): CancellationPolicy {
  if (presetId !== 'custom') return buildPresetPolicy(presetId, input);
  const tiers = normalizeCancellationTiers(input?.tiers);
  return {
    version: CANCELLATION_POLICY_VERSION,
    presetId: 'custom',
    tiers,
    fallbackRefundPercent: clampInt(readNumber(input?.fallbackRefundPercent) ?? 0, 0, 100),
    grace: normalizeGrace(input?.grace),
    feeRules: {
      petFee: normalizeFeeRule(
        (input?.feeRules as Record<string, unknown> | undefined)?.petFee,
        'follow_policy'
      ),
      additionalFees: normalizeFeeRule(
        (input?.feeRules as Record<string, unknown> | undefined)?.additionalFees,
        'follow_policy'
      ),
    },
    guestCancellation: input?.guestCancellation === 'instant' ? 'instant' : 'request',
    ...(readString(input?.note).trim()
      ? { note: readString(input?.note).trim().slice(0, CANCELLATION_POLICY_NOTE_MAX) }
      : {}),
  };
}

/** Legacy v1 settings shape (still in production rows). */
type LegacyCancellationPolicy = {
  type?: unknown;
  gracePeriodHours?: unknown;
  daysBeforeCheckIn?: unknown;
  partialRefundPercent?: unknown;
  customTitle?: unknown;
  customDescription?: unknown;
};

function normalizeLegacyHours(value: number | undefined): number {
  if (value && CANCELLATION_GRACE_HOUR_OPTIONS.includes(value as (typeof CANCELLATION_GRACE_HOUR_OPTIONS)[number])) {
    return value;
  }
  return 48;
}

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
      return {
        version: CANCELLATION_POLICY_VERSION,
        presetId: 'custom',
        tiers: [],
        fallbackRefundPercent: 0,
        grace: {
          enabled: true,
          hours: normalizeLegacyHours(readNumber(raw.gracePeriodHours)),
          minLeadDays: 0,
        },
        feeRules: { petFee: 'follow_policy', additionalFees: 'follow_policy' },
        guestCancellation: 'instant',
      };
    case 'full_before_checkin':
      return {
        version: CANCELLATION_POLICY_VERSION,
        presetId: 'custom',
        tiers: [{ daysBefore: normalizeLegacyDays(readNumber(raw.daysBeforeCheckIn)), refundPercent: 100 }],
        fallbackRefundPercent: 0,
        grace: null,
        feeRules: { petFee: 'follow_policy', additionalFees: 'follow_policy' },
        guestCancellation: 'instant',
      };
    case 'moderate':
      return {
        version: CANCELLATION_POLICY_VERSION,
        presetId: 'custom',
        tiers: [{ daysBefore: normalizeLegacyDays(readNumber(raw.daysBeforeCheckIn)), refundPercent: 100 }],
        fallbackRefundPercent: 0,
        grace: {
          enabled: true,
          hours: normalizeLegacyHours(readNumber(raw.gracePeriodHours)),
          minLeadDays: 0,
        },
        feeRules: { petFee: 'follow_policy', additionalFees: 'follow_policy' },
        guestCancellation: 'instant',
      };
    case 'partial_before_checkin':
      return {
        version: CANCELLATION_POLICY_VERSION,
        presetId: 'custom',
        tiers: [
          {
            daysBefore: normalizeLegacyDays(readNumber(raw.daysBeforeCheckIn)),
            refundPercent: normalizeLegacyPercent(readNumber(raw.partialRefundPercent)),
          },
        ],
        fallbackRefundPercent: 0,
        grace: null,
        feeRules: { petFee: 'follow_policy', additionalFees: 'follow_policy' },
        guestCancellation: 'instant',
      };
    case 'non_refundable':
      return buildCancellationPreset('non_refundable');
    case 'custom': {
      const note = readString(raw.customDescription).trim();
      const legacyTitle = readString(raw.customTitle).trim();
      return {
        version: CANCELLATION_POLICY_VERSION,
        presetId: 'custom',
        tiers: [],
        fallbackRefundPercent: 0,
        grace: null,
        feeRules: { petFee: 'follow_policy', additionalFees: 'follow_policy' },
        guestCancellation: 'request',
        needsReview: true,
        ...(note ? { note: note.slice(0, CANCELLATION_POLICY_NOTE_MAX) } : {}),
        ...(legacyTitle ? { legacyTitle } : {}),
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

  if (presetId !== 'custom') return buildPresetPolicy(presetId, input);

  const tiers = normalizeCancellationTiers(input.tiers);
  const fallbackRefundPercent = clampInt(
    readNumber(input.fallbackRefundPercent) ?? 0,
    0,
    100
  );
  const note = readString(input.note).trim();
  const legacyTitle = readString(input.legacyTitle).trim();

  return {
    version: CANCELLATION_POLICY_VERSION,
    presetId: 'custom',
    tiers,
    fallbackRefundPercent,
    grace: normalizeGrace(input.grace),
    feeRules: {
      petFee: normalizeFeeRule(
        (input.feeRules as Record<string, unknown> | undefined)?.petFee,
        'follow_policy'
      ),
      additionalFees: normalizeFeeRule(
        (input.feeRules as Record<string, unknown> | undefined)?.additionalFees,
        'follow_policy'
      ),
    },
    guestCancellation: input.guestCancellation === 'instant' ? 'instant' : 'request',
    ...(note ? { note: note.slice(0, CANCELLATION_POLICY_NOTE_MAX) } : {}),
    ...(legacyTitle ? { legacyTitle } : {}),
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
  const note = policy.note?.trim();
  const legacyTitle = policy.legacyTitle?.trim();

  if (policy.needsReview) {
    return {
      presetId: 'custom',
      title: legacyTitle || 'Finish setting up your cancellation policy',
      description:
        note ||
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
        description: 'Full refund of what you paid up to 14 days before check-in.',
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
        description: 'Full refund of what you paid up to 30 days before check-in, 50% up to 7 days before.',
        tone: 'neutral',
        showListingHighlight: true,
        shortLabel: 'Partial refund',
        timeline,
        fallbackRefundPercent: policy.fallbackRefundPercent,
        needsReview: false,
        unset: false,
      };
    case 'strict':
      return {
        presetId: policy.presetId,
        title: 'Strict',
        description: '50% of what you paid, up to 7 days before check-in.',
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
        description: 'No refund of your down payment after the booking is confirmed.',
        tone: 'warning',
        showListingHighlight: false,
        shortLabel: 'Non-refundable',
        timeline,
        fallbackRefundPercent: policy.fallbackRefundPercent,
        needsReview: false,
        unset: false,
      };
    default: {
      if (timeline.length === 0 && policy.grace?.enabled) {
        return {
          presetId: 'custom',
          title: legacyTitle || `Free cancellation for ${policy.grace.hours} hours`,
          description: note || `Full refund of what you paid if the guest cancels within ${policy.grace.hours} hours of booking.`,
          tone: 'positive',
          showListingHighlight: true,
          shortLabel: 'Free cancellation',
          timeline,
          fallbackRefundPercent: policy.fallbackRefundPercent,
          needsReview: false,
          unset: false,
        };
      }
      if (timeline.length === 0) {
        return {
          presetId: 'custom',
          title: legacyTitle || 'Cancellation terms',
          description: note || 'Contact the host for cancellation terms.',
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
          note ||
          timeline
            .map((row) => `${row.refundPercent}% of what you paid at least ${daysLabel(row.daysBefore)} before check-in`)
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

/** Returns an error message, or null when the policy is valid. */
export function validateCancellationPolicy(policyInput: unknown): string | null {
  const policy = normalizeCancellationPolicy(policyInput);
  if (!policy) return 'Choose a cancellation policy';

  if (policy.note && policy.note.length > CANCELLATION_POLICY_NOTE_MAX) {
    return `Note must be ${CANCELLATION_POLICY_NOTE_MAX} characters or fewer`;
  }

  if (policy.presetId !== 'custom') return null;

  if (policy.needsReview) return null;

  if (policy.tiers.length === 0 && !policy.grace?.enabled) {
    return 'Add a refund deadline or a free cancellation window';
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

  if (policy.tiers.length > 0) {
    const last = policy.tiers[policy.tiers.length - 1]!;
    if (policy.fallbackRefundPercent > last.refundPercent) {
      return 'The fallback refund cannot be higher than the closest deadline';
    }
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
