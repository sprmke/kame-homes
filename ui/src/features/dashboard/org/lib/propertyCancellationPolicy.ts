export const CANCELLATION_POLICY_CUSTOM_TITLE_MAX = 80;
export const CANCELLATION_POLICY_CUSTOM_DESCRIPTION_MAX = 500;

export const CANCELLATION_GRACE_HOUR_OPTIONS = [24, 48, 72, 168] as const;
export const CANCELLATION_DAYS_BEFORE_OPTIONS = [1, 3, 5, 7, 14, 30] as const;
export const CANCELLATION_PARTIAL_PERCENT_OPTIONS = [25, 50, 75] as const;

export type CancellationPolicyType =
  | 'grace_period'
  | 'full_before_checkin'
  | 'moderate'
  | 'partial_before_checkin'
  | 'non_refundable'
  | 'custom';

export type CancellationPolicySettings = {
  type: CancellationPolicyType;
  gracePeriodHours?: number;
  daysBeforeCheckIn?: number;
  partialRefundPercent?: number;
  customTitle?: string;
  customDescription?: string;
};

export type ResolvedCancellationPolicyDisplay = {
  type: CancellationPolicyType;
  title: string;
  description: string;
  tone: 'positive' | 'neutral' | 'warning';
  showListingHighlight: boolean;
  shortLabel: string;
};

export const DEFAULT_CANCELLATION_POLICY: CancellationPolicySettings = {
  type: 'grace_period',
  gracePeriodHours: 48,
};

export const CANCELLATION_POLICY_PRESETS: {
  type: CancellationPolicyType;
  label: string;
  summary: string;
}[] = [
  {
    type: 'grace_period',
    label: 'Free cancellation window',
    summary: 'Full refund when guests cancel within a set time after booking.',
  },
  {
    type: 'full_before_checkin',
    label: 'Full refund before check-in',
    summary: 'Full refund when guests cancel far enough ahead of check-in.',
  },
  {
    type: 'moderate',
    label: 'Moderate',
    summary: 'Grace period after booking or full refund when cancelled early enough.',
  },
  {
    type: 'partial_before_checkin',
    label: 'Partial refund',
    summary: 'Percentage refund when guests cancel before a deadline.',
  },
  {
    type: 'non_refundable',
    label: 'Non-refundable',
    summary: 'No refunds after the booking is confirmed.',
  },
  {
    type: 'custom',
    label: 'Custom policy',
    summary: 'Write your own guest-facing title and explanation.',
  },
];

const POLICY_TYPES = new Set<CancellationPolicyType>([
  'grace_period',
  'full_before_checkin',
  'moderate',
  'partial_before_checkin',
  'non_refundable',
  'custom',
]);

function readNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.round(value);
  return undefined;
}

function readString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function normalizeGraceHours(value: number | undefined): number {
  if (
    value &&
    CANCELLATION_GRACE_HOUR_OPTIONS.includes(
      value as (typeof CANCELLATION_GRACE_HOUR_OPTIONS)[number]
    )
  ) {
    return value;
  }
  return DEFAULT_CANCELLATION_POLICY.gracePeriodHours ?? 48;
}

function normalizeDaysBefore(value: number | undefined): number {
  if (
    value &&
    CANCELLATION_DAYS_BEFORE_OPTIONS.includes(
      value as (typeof CANCELLATION_DAYS_BEFORE_OPTIONS)[number]
    )
  ) {
    return value;
  }
  return 7;
}

function normalizePartialPercent(value: number | undefined): number {
  if (
    value &&
    CANCELLATION_PARTIAL_PERCENT_OPTIONS.includes(
      value as (typeof CANCELLATION_PARTIAL_PERCENT_OPTIONS)[number]
    )
  ) {
    return value;
  }
  return 50;
}

export function normalizeCancellationPolicySettings(raw: unknown): CancellationPolicySettings {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ...DEFAULT_CANCELLATION_POLICY };
  }

  const input = raw as Record<string, unknown>;
  const typeRaw = readString(input.type);
  const type = POLICY_TYPES.has(typeRaw as CancellationPolicyType)
    ? (typeRaw as CancellationPolicyType)
    : DEFAULT_CANCELLATION_POLICY.type;

  const policy: CancellationPolicySettings = { type };

  if (type === 'grace_period' || type === 'moderate') {
    policy.gracePeriodHours = normalizeGraceHours(readNumber(input.gracePeriodHours));
  }
  if (type === 'full_before_checkin' || type === 'moderate' || type === 'partial_before_checkin') {
    policy.daysBeforeCheckIn = normalizeDaysBefore(readNumber(input.daysBeforeCheckIn));
  }
  if (type === 'partial_before_checkin') {
    policy.partialRefundPercent = normalizePartialPercent(readNumber(input.partialRefundPercent));
  }
  if (type === 'custom') {
    policy.customTitle = readString(input.customTitle).trim();
    policy.customDescription = readString(input.customDescription).trim();
  }

  return policy;
}

export function readCancellationPolicyFromSettings(
  settings: Record<string, unknown> | undefined
): CancellationPolicySettings {
  return normalizeCancellationPolicySettings(settings?.cancellationPolicy);
}

export function cancellationPolicySettingsEqual(
  a: CancellationPolicySettings,
  b: CancellationPolicySettings
): boolean {
  return (
    JSON.stringify(normalizeCancellationPolicySettings(a)) ===
    JSON.stringify(normalizeCancellationPolicySettings(b))
  );
}

function formatGraceDuration(hours: number): string {
  if (hours === 168) return '7 days';
  return `${hours} hours`;
}

function formatDaysBefore(days: number): string {
  return days === 1 ? '1 day' : `${days} days`;
}

export function resolveCancellationPolicyDisplay(
  policyInput: CancellationPolicySettings | unknown
): ResolvedCancellationPolicyDisplay {
  const policy = normalizeCancellationPolicySettings(policyInput);

  switch (policy.type) {
    case 'grace_period': {
      const hours = policy.gracePeriodHours ?? 48;
      const duration = formatGraceDuration(hours);
      return {
        type: policy.type,
        title: `Free cancellation for ${duration}`,
        description: `Get a full refund if you cancel within ${duration} of booking.`,
        tone: 'positive',
        showListingHighlight: true,
        shortLabel: 'Free cancellation',
      };
    }
    case 'full_before_checkin': {
      const days = policy.daysBeforeCheckIn ?? 7;
      const duration = formatDaysBefore(days);
      return {
        type: policy.type,
        title: `Full refund ${duration} before check-in`,
        description: `Cancel at least ${duration} before check-in for a full refund.`,
        tone: 'positive',
        showListingHighlight: true,
        shortLabel: 'Free cancellation',
      };
    }
    case 'moderate': {
      const hours = policy.gracePeriodHours ?? 48;
      const days = policy.daysBeforeCheckIn ?? 5;
      const grace = formatGraceDuration(hours);
      const before = formatDaysBefore(days);
      return {
        type: policy.type,
        title: `Free cancellation for ${grace}`,
        description: `Get a full refund if you cancel within ${grace} of booking, or at least ${before} before check-in. Otherwise, the booking is non-refundable.`,
        tone: 'positive',
        showListingHighlight: true,
        shortLabel: 'Free cancellation',
      };
    }
    case 'partial_before_checkin': {
      const days = policy.daysBeforeCheckIn ?? 7;
      const percent = policy.partialRefundPercent ?? 50;
      const before = formatDaysBefore(days);
      return {
        type: policy.type,
        title: `${percent}% refund ${before} before check-in`,
        description: `Cancel at least ${before} before check-in for a ${percent}% refund. After that, the booking is non-refundable.`,
        tone: 'neutral',
        showListingHighlight: true,
        shortLabel: 'Partial refund',
      };
    }
    case 'non_refundable':
      return {
        type: policy.type,
        title: 'Non-refundable',
        description: 'This booking is non-refundable after it is confirmed.',
        tone: 'warning',
        showListingHighlight: false,
        shortLabel: 'Non-refundable',
      };
    case 'custom': {
      const title = policy.customTitle?.trim() || 'Cancellation policy';
      const description =
        policy.customDescription?.trim() || 'Contact the host for cancellation terms.';
      return {
        type: policy.type,
        title,
        description,
        tone: 'neutral',
        showListingHighlight: Boolean(policy.customTitle?.trim()),
        shortLabel: title,
      };
    }
    default:
      return resolveCancellationPolicyDisplay(DEFAULT_CANCELLATION_POLICY);
  }
}

export function validateCancellationPolicySettings(
  policyInput: CancellationPolicySettings
): string | null {
  const policy = normalizeCancellationPolicySettings(policyInput);

  if (policy.type === 'custom') {
    const title = policy.customTitle?.trim() ?? '';
    const description = policy.customDescription?.trim() ?? '';
    if (!title) return 'Enter a cancellation policy title';
    if (title.length > CANCELLATION_POLICY_CUSTOM_TITLE_MAX) {
      return `Title must be ${CANCELLATION_POLICY_CUSTOM_TITLE_MAX} characters or fewer`;
    }
    if (!description) return 'Enter a cancellation policy description';
    if (description.length > CANCELLATION_POLICY_CUSTOM_DESCRIPTION_MAX) {
      return `Description must be ${CANCELLATION_POLICY_CUSTOM_DESCRIPTION_MAX} characters or fewer`;
    }
  }

  return null;
}

export function cancellationPolicyToSettingsPatch(
  policy: CancellationPolicySettings
): Record<string, unknown> {
  return {
    cancellationPolicy: normalizeCancellationPolicySettings(policy),
  };
}
