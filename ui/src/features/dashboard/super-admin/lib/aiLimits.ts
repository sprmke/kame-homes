/** Shared metadata for the super-admin AI limits console. Mirrors `_shared/aiLimitResolver.ts`. */

export const AI_LIMIT_KEYS = [
  'dailyCallLimit',
  'monthlyCallLimit',
  'dailyCostUsdLimit',
  'dailyCreditLimit',
  'monthlyCreditLimit',
  'assistantDailyMessageLimit',
  'assistantMonthlyMessageLimit',
  'assistantDailyWriteActionLimit',
  'voiceMaxSessionSeconds',
  'voiceMaxSessionsPerGuestPerDay',
  'voiceMaxConcurrentSessions',
  'imageMonthlyCreditCap',
  'videoMonthlyCreditCap',
] as const;

export type AiLimitKey = (typeof AI_LIMIT_KEYS)[number];

export type AiLimitSource =
  | 'override'
  | 'property'
  | 'development'
  | 'org'
  | 'plan'
  | 'plan_allowance'
  | 'default'
  | 'global';

export type ResolvedLimit = {
  value: number | null;
  source: AiLimitSource;
  profileCode: string | null;
};

export type ResolvedAiLimits = Record<AiLimitKey, ResolvedLimit>;
export type AiLimitValues = Record<AiLimitKey, number | null>;

export type AiLimitFieldMeta = {
  label: string;
  /** Decimal input (USD / credits) vs whole numbers. */
  decimal?: boolean;
  unit?: string;
  /** Hint shown when blank on a profile. */
  blankHint?: string;
};

export const AI_LIMIT_FIELDS: Record<AiLimitKey, AiLimitFieldMeta> = {
  dailyCallLimit: { label: 'Daily calls', unit: 'calls' },
  monthlyCallLimit: { label: 'Monthly calls', unit: 'calls' },
  dailyCostUsdLimit: { label: 'Daily cost', decimal: true, unit: 'USD' },
  dailyCreditLimit: { label: 'Daily credits', decimal: true, unit: 'credits' },
  monthlyCreditLimit: { label: 'Monthly credits', decimal: true, unit: 'credits' },
  assistantDailyMessageLimit: { label: 'Daily messages', unit: 'messages' },
  assistantMonthlyMessageLimit: { label: 'Monthly messages', unit: 'messages' },
  assistantDailyWriteActionLimit: { label: 'Daily write actions', unit: 'actions' },
  voiceMaxSessionSeconds: { label: 'Max session', unit: 'sec' },
  voiceMaxSessionsPerGuestPerDay: { label: 'Sessions per guest / day' },
  voiceMaxConcurrentSessions: { label: 'Concurrent sessions' },
  imageMonthlyCreditCap: { label: 'Image credits / month', unit: 'credits', blankHint: '60%' },
  videoMonthlyCreditCap: { label: 'Video credits / month', unit: 'credits', blankHint: '60%' },
};

export type AiLimitGroup = { id: string; label: string; keys: readonly AiLimitKey[] };

export const AI_LIMIT_GROUPS: readonly AiLimitGroup[] = [
  {
    id: 'platform',
    label: 'Calls, cost and credits',
    keys: [
      'dailyCallLimit',
      'monthlyCallLimit',
      'dailyCostUsdLimit',
      'dailyCreditLimit',
      'monthlyCreditLimit',
    ],
  },
  {
    id: 'assistant',
    label: 'Dashboard assistant',
    keys: [
      'assistantDailyMessageLimit',
      'assistantMonthlyMessageLimit',
      'assistantDailyWriteActionLimit',
    ],
  },
  {
    id: 'voice',
    label: 'Voice receptionist',
    keys: [
      'voiceMaxSessionSeconds',
      'voiceMaxSessionsPerGuestPerDay',
      'voiceMaxConcurrentSessions',
    ],
  },
  {
    id: 'media',
    label: 'Media generation',
    keys: ['imageMonthlyCreditCap', 'videoMonthlyCreditCap'],
  },
];

/** Keys a tenant-level override may set, per scope. Mirrors the server allow lists. */
export const ORG_OVERRIDE_KEYS: readonly AiLimitKey[] = [
  'dailyCallLimit',
  'monthlyCallLimit',
  'dailyCostUsdLimit',
  'dailyCreditLimit',
  'monthlyCreditLimit',
  'assistantDailyMessageLimit',
  'assistantMonthlyMessageLimit',
  'assistantDailyWriteActionLimit',
];

export const PROPERTY_OVERRIDE_KEYS: readonly AiLimitKey[] = [
  'dailyCallLimit',
  'monthlyCallLimit',
  'dailyCostUsdLimit',
  'dailyCreditLimit',
  'monthlyCreditLimit',
  'voiceMaxSessionSeconds',
  'voiceMaxSessionsPerGuestPerDay',
  'voiceMaxConcurrentSessions',
  'imageMonthlyCreditCap',
  'videoMonthlyCreditCap',
];

export const SOURCE_LABEL: Record<AiLimitSource, string> = {
  override: 'Override',
  property: 'Property profile',
  development: 'Development profile',
  org: 'Org profile',
  plan: 'Plan profile',
  plan_allowance: 'Plan allowance',
  default: 'Default profile',
  global: 'Platform default',
};

export function formatLimitValue(key: AiLimitKey, value: number | null): string {
  if (value === null) return AI_LIMIT_FIELDS[key].blankHint ? 'Auto' : '-';
  if (key === 'dailyCostUsdLimit') return `$${value.toLocaleString('en-US')}`;
  return value.toLocaleString('en-US', { maximumFractionDigits: 3 });
}

export function emptyDraft(): Record<AiLimitKey, string> {
  return Object.fromEntries(AI_LIMIT_KEYS.map((key) => [key, ''])) as Record<AiLimitKey, string>;
}

/** Blank = null (inherit). Returns an error message for the first invalid field. */
export function draftToLimits(
  draft: Record<AiLimitKey, string>,
  keys: readonly AiLimitKey[]
): { ok: true; limits: Partial<AiLimitValues> } | { ok: false; error: string } {
  const limits: Partial<AiLimitValues> = {};
  for (const key of keys) {
    const raw = draft[key].trim();
    if (raw === '') {
      limits[key] = null;
      continue;
    }
    const value = Number(raw);
    const meta = AI_LIMIT_FIELDS[key];
    if (!Number.isFinite(value) || value < 0) {
      return { ok: false, error: `${meta.label} must be a positive number` };
    }
    if (!meta.decimal && !Number.isInteger(value)) {
      return { ok: false, error: `${meta.label} must be a whole number` };
    }
    limits[key] = value;
  }
  return { ok: true, limits };
}

export function limitsToDraft(
  limits: Partial<Record<AiLimitKey, number | null>>
): Record<AiLimitKey, string> {
  const draft = emptyDraft();
  for (const key of AI_LIMIT_KEYS) {
    const value = limits[key];
    draft[key] = value === null || value === undefined ? '' : String(value);
  }
  return draft;
}
