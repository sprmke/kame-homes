import { SCHEDULED_JOBS } from './jobsRegistry.ts';
import {
  supabaseDashboardUrl,
  supabaseProjectRef,
  type HealthCheck,
  type HealthStatus,
} from './types.ts';

/**
 * Edge secrets the platform reads, with how bad it is when each is missing. Add a row here in
 * the same change that introduces a new `Deno.env.get(...)` key (see validation-and-env.md).
 * Secret values never leave this module: checks carry presence, a validation result, and the
 * value only for `showValue` keys (origins, hosts, names).
 */
export type EnvLevel = 'required' | 'prodRequired' | 'recommended' | 'prodRecommended' | 'optional';

type Validation = { status: HealthStatus; detail: string } | null;

export type EnvDef = {
  key: string;
  /** Any of these satisfies presence (e.g. GEMINI_API_KEYS or GEMINI_API_KEY). */
  anyOf?: string[];
  group: string;
  level: EnvLevel;
  features: string[];
  showValue?: boolean;
  hint?: string;
  /** Effective value when unset (tuning knobs). */
  defaultValue?: string;
  /** Provider console where the key is created or rotated. */
  console?: string;
  validate?: (value: string, isProd: boolean) => Validation;
};

export type PostureRule = {
  id: string;
  label: string;
  features: string[];
  /** Returns a problem when the current value is unsafe in production, else null. */
  check: (get: (key: string) => string | undefined) => Validation;
  hint: string;
};

function decodedByteLength(value: string): number | null {
  if (/^[0-9a-fA-F]+$/.test(value) && value.length % 2 === 0) return value.length / 2;
  try {
    return atob(value.replace(/-/g, '+').replace(/_/g, '/')).length;
  } catch {
    return null;
  }
}

export function validateAes256Key(value: string): Validation {
  return decodedByteLength(value) === 32
    ? null
    : { status: 'error', detail: 'Must be 32 bytes (64 hex chars or base64)' };
}

function validateUrl(value: string, isProd: boolean): Validation {
  try {
    const url = new URL(value);
    if (isProd && /^(localhost|127\.0\.0\.1|host\.docker\.internal)$/.test(url.hostname)) {
      return { status: 'warn', detail: 'Points at a local address' };
    }
    return null;
  } catch {
    return { status: 'error', detail: 'Not a valid URL' };
  }
}

function validateUrlList(value: string, isProd: boolean): Validation {
  for (const part of value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)) {
    const problem = validateUrl(part, isProd);
    if (problem) return problem;
  }
  return null;
}

function validateEmailList(value: string): Validation {
  const emails = value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  if (emails.length === 0) return { status: 'error', detail: 'Empty list' };
  return emails.every((email) => email.includes('@'))
    ? null
    : { status: 'error', detail: 'Contains an invalid email' };
}

export function validateVapidKeys(value: string): Validation {
  try {
    const parsed = JSON.parse(value) as { publicKey?: unknown; privateKey?: unknown };
    return parsed.publicKey && parsed.privateKey
      ? null
      : { status: 'error', detail: 'Needs publicKey and privateKey' };
  } catch {
    return { status: 'error', detail: 'Not valid JSON' };
  }
}

export function validateSentryDsn(value: string): Validation {
  try {
    const url = new URL(value);
    return url.username && url.pathname.length > 1
      ? null
      : { status: 'error', detail: 'Malformed DSN' };
  } catch {
    return { status: 'error', detail: 'Malformed DSN' };
  }
}

export function validatePaymongoSecret(value: string, isProd: boolean): Validation {
  if (value.startsWith('sk_live_')) return null;
  if (value.startsWith('sk_test_')) {
    return isProd ? { status: 'warn', detail: 'Test key in production' } : null;
  }
  return { status: 'error', detail: 'Expected sk_live_ or sk_test_ key' };
}

function validatePositiveNumber(value: string): Validation {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? null : { status: 'error', detail: 'Not a number' };
}

const CORE = 'Core';
const EMAIL = 'Email';
const AI = 'AI';
const META = 'Meta';
const PAYMENTS = 'Payments';
const SECURITY = 'Security';
const PUSH = 'Push';
const OBSERVABILITY = 'Observability';
const OTHER = 'Other';
const TUNING = 'Tuning';
const LEGACY = 'Legacy fallbacks';
const CRON = 'Cron secrets';

export const EDGE_ENV_REGISTRY: EnvDef[] = [
  {
    key: 'SUPABASE_URL',
    group: CORE,
    level: 'required',
    features: ['Everything'],
    showValue: true,
    validate: validateUrl,
    hint: 'Set by Supabase on hosted projects.',
  },
  {
    key: 'SUPABASE_SERVICE_ROLE_KEY',
    group: CORE,
    level: 'required',
    features: ['Everything'],
    hint: 'Set by Supabase on hosted projects.',
  },
  {
    key: 'SUPABASE_ANON_KEY',
    group: CORE,
    level: 'required',
    features: ['Auth checks', 'Meta OAuth'],
    hint: 'Set by Supabase on hosted projects.',
  },
  {
    key: 'ENVIRONMENT',
    anyOf: ['ENVIRONMENT', 'DENO_ENV'],
    group: CORE,
    level: 'recommended',
    features: ['Cron secret enforcement', 'Error tracking'],
    showValue: true,
    hint: 'Set to production on the live project.',
  },
  {
    key: 'SUPER_ADMIN_EMAILS',
    group: CORE,
    level: 'required',
    features: ['Super admin'],
    validate: validateEmailList,
  },
  {
    key: 'ADMIN_ALLOWED_EMAILS',
    group: CORE,
    level: 'optional',
    features: ['Legacy admin'],
    validate: validateEmailList,
  },
  {
    key: 'PUBLIC_GUEST_APP_ORIGIN',
    group: CORE,
    level: 'recommended',
    features: ['Email links', 'Guest deep links'],
    showValue: true,
    validate: validateUrl,
  },
  {
    key: 'PUBLIC_API_URL',
    anyOf: ['PUBLIC_API_URL', 'SUPABASE_PUBLIC_URL'],
    group: CORE,
    level: 'optional',
    features: ['Meta OAuth', 'Webhooks'],
    showValue: true,
    validate: validateUrl,
  },
  {
    key: 'CORS_ALLOWED_ORIGINS',
    group: CORE,
    level: 'optional',
    features: ['Preview deployments'],
    showValue: true,
    validate: validateUrlList,
  },

  {
    key: 'RESEND_API_KEY',
    console: 'https://resend.com/api-keys',
    group: EMAIL,
    level: 'required',
    features: ['Booking emails', 'OTP codes', 'Billing emails'],
  },
  {
    key: 'RESEND_FROM_EMAIL',
    group: EMAIL,
    level: 'recommended',
    features: ['Booking emails'],
    showValue: true,
    validate: (v) => (v.includes('@') ? null : { status: 'error', detail: 'Not an email address' }),
  },
  {
    key: 'RESEND_INBOUND_WEBHOOK_SECRET',
    group: EMAIL,
    level: 'recommended',
    features: ['GAF and pet approvals'],
  },
  {
    key: 'RESEND_APPROVAL_INBOUND_DOMAIN',
    group: EMAIL,
    level: 'recommended',
    features: ['GAF and pet approvals'],
    showValue: true,
  },
  {
    key: 'SUPPORT_TEAM_EMAIL',
    group: EMAIL,
    level: 'recommended',
    features: ['Support tickets'],
    validate: validateEmailList,
  },

  {
    key: 'GEMINI_API_KEY',
    console: 'https://aistudio.google.com/apikey',
    anyOf: ['GEMINI_API_KEYS', 'GEMINI_API_KEY'],
    group: AI,
    level: 'required',
    features: ['All AI features'],
  },
  {
    key: 'GROQ_API_KEY',
    group: AI,
    level: 'recommended',
    features: ['AI fallback'],
    console: 'https://console.groq.com/keys',
  },
  {
    key: 'AI_PLATFORM_DAILY_COST_USD_CAP',
    group: AI,
    level: 'optional',
    features: ['AI spend cap'],
    showValue: true,
    validate: (v) => {
      const n = Number(v);
      if (!Number.isFinite(n) || n < 0) return { status: 'error', detail: 'Not a number' };
      return n === 0 ? { status: 'warn', detail: 'Daily AI spend cap disabled' } : null;
    },
  },

  {
    key: 'META_APP_ID',
    console: 'https://developers.facebook.com/apps',
    group: META,
    level: 'recommended',
    features: ['Guest inbox', 'Meta publishing'],
    showValue: true,
  },
  {
    key: 'META_APP_SECRET',
    console: 'https://developers.facebook.com/apps',
    group: META,
    level: 'recommended',
    features: ['Guest inbox', 'Meta publishing'],
  },
  {
    key: 'META_INBOX_TOKEN_ENCRYPTION_KEY',
    group: META,
    level: 'recommended',
    features: ['Guest inbox'],
    validate: validateAes256Key,
  },
  {
    key: 'META_WEBHOOK_VERIFY_TOKEN',
    group: META,
    level: 'recommended',
    features: ['Guest inbox'],
  },
  {
    key: 'META_OAUTH_ALLOWED_RETURN_ORIGINS',
    group: META,
    level: 'optional',
    features: ['Meta connect'],
    showValue: true,
    validate: validateUrlList,
  },
  {
    key: 'META_OAUTH_EXTRA_SCOPES',
    group: META,
    level: 'optional',
    features: ['Meta connect'],
    showValue: true,
  },

  {
    key: 'PAYMONGO_SECRET_KEY',
    console: 'https://dashboard.paymongo.com/developers',
    group: PAYMENTS,
    level: 'recommended',
    features: ['Subscriptions', 'Parking checkout'],
    validate: validatePaymongoSecret,
  },
  {
    key: 'PAYMONGO_WEBHOOK_SECRET',
    console: 'https://dashboard.paymongo.com/developers',
    group: PAYMENTS,
    level: 'recommended',
    features: ['Payment confirmation'],
  },

  {
    key: 'GMAIL_OAUTH_TOKEN_ENCRYPTION_KEY',
    group: SECURITY,
    level: 'required',
    features: ['Telegram bots', 'Calendar sync'],
    validate: validateAes256Key,
  },
  {
    key: 'SETTINGS_VERIFICATION_SECRET',
    group: SECURITY,
    level: 'recommended',
    features: ['Settings OTP'],
    hint: 'Falls back to the encryption key.',
  },
  {
    key: 'SUPER_ADMIN_VERIFICATION_SECRET',
    group: SECURITY,
    level: 'optional',
    features: ['Super admin step-up'],
  },
  {
    key: 'GUEST_BOOKING_ACCESS_SECRET',
    group: SECURITY,
    level: 'recommended',
    features: ['Guest form links'],
    hint: 'Falls back to the service role key.',
  },
  {
    key: 'REVIEW_IDENTITY_PEPPER',
    group: SECURITY,
    level: 'prodRecommended',
    features: ['Two-way reviews'],
    hint: 'Unset uses a public dev pepper. Set before reviews go live; changing it later unlinks past reviews.',
  },
  {
    key: 'TURNSTILE_SECRET_KEY',
    console: 'https://dash.cloudflare.com/?to=/:account/turnstile',
    group: SECURITY,
    level: 'prodRecommended',
    features: ['Anti-spam'],
  },

  {
    key: 'VAPID_KEYS',
    group: PUSH,
    level: 'prodRecommended',
    features: ['Push notifications'],
    validate: validateVapidKeys,
  },
  {
    key: 'VAPID_SUBJECT',
    group: PUSH,
    level: 'prodRecommended',
    features: ['Push notifications'],
    showValue: true,
    validate: (v) =>
      /^(mailto:|https:)/.test(v) ? null : { status: 'error', detail: 'Use mailto: or https:' },
  },
  {
    key: 'PUSH_FANOUT_SECRET',
    group: PUSH,
    level: 'prodRecommended',
    features: ['Push notifications'],
  },

  {
    key: 'POSTHOG_API_KEY',
    console: 'https://app.posthog.com/settings/project',
    group: OBSERVABILITY,
    level: 'prodRecommended',
    features: ['Server error tracking'],
  },
  {
    key: 'POSTHOG_HOST',
    group: OBSERVABILITY,
    level: 'optional',
    features: ['Server error tracking'],
    showValue: true,
    validate: validateUrl,
  },
  {
    key: 'SENTRY_DSN',
    console: 'https://sentry.io/settings/projects/',
    group: OBSERVABILITY,
    level: 'optional',
    features: ['Server alerting'],
    validate: validateSentryDsn,
  },

  {
    key: 'JAMENDO_CLIENT_ID',
    console: 'https://devportal.jamendo.com',
    group: OTHER,
    level: 'optional',
    features: ['Marketing video music'],
  },
  {
    key: 'PLATFORM_APP_NAME',
    group: OTHER,
    level: 'optional',
    features: ['Email branding'],
    showValue: true,
  },

  {
    key: 'CALENDAR_SYNC_MIN_INTERVAL_MINUTES',
    group: TUNING,
    level: 'optional',
    features: ['Calendar sync'],
    showValue: true,
    defaultValue: '30',
    validate: validatePositiveNumber,
  },
  {
    key: 'AI_ASSISTANT_ATTACHMENT_RETENTION_DAYS',
    group: TUNING,
    level: 'optional',
    features: ['AI assistant'],
    showValue: true,
    defaultValue: '90',
    validate: validatePositiveNumber,
  },
  {
    key: 'GUEST_BOOKING_ACCESS_LEGACY_GRACE_DAYS',
    group: TUNING,
    level: 'optional',
    features: ['Guest form links'],
    showValue: true,
    defaultValue: '30',
    validate: validatePositiveNumber,
  },

  ...['FACEBOOK_REVIEWS_URL', 'AIRBNB_URL', 'INSTAGRAM_URL', 'TIKTOK_URL'].map((key): EnvDef => ({
    key,
    group: LEGACY,
    level: 'optional',
    features: ['Email social links'],
    showValue: true,
    validate: validateUrl,
    hint: 'Used only when an organization has no link saved.',
  })),

  ...SCHEDULED_JOBS.map((job): EnvDef => ({
    key: job.secretEnv,
    group: CRON,
    level: job.nonProdOnly ? 'optional' : 'prodRequired',
    features: [job.label],
    hint: 'Production rejects cron calls when unset. Set the matching Vault secret too.',
  })),
];

export const EDGE_POSTURE_RULES: PostureRule[] = [
  {
    id: 'GUEST_BOOKING_ACCESS_ENFORCE',
    label: 'Guest link tokens enforced',
    features: ['Guest form links'],
    check: (get) =>
      get('GUEST_BOOKING_ACCESS_ENFORCE')?.trim() === 'true'
        ? null
        : { status: 'warn', detail: 'Guest PII links work without a token' },
    hint: 'Set GUEST_BOOKING_ACCESS_ENFORCE=true.',
  },
  {
    id: 'CAPTCHA_MODE',
    label: 'CAPTCHA enforcing',
    features: ['Anti-spam'],
    check: (get) => {
      const mode = get('CAPTCHA_MODE')?.trim();
      const hasSecret = Boolean(get('TURNSTILE_SECRET_KEY')?.trim());
      const effective = mode || (hasSecret ? 'enforce' : 'disabled');
      return effective === 'enforce' ? null : { status: 'warn', detail: `Mode is ${effective}` };
    },
    hint: 'Set TURNSTILE_SECRET_KEY and leave CAPTCHA_MODE unset or enforce.',
  },
  {
    id: 'AI_RESPONSE_CACHE_DISABLED',
    label: 'AI response cache on',
    features: ['AI cost'],
    check: (get) =>
      get('AI_RESPONSE_CACHE_DISABLED')?.trim() === '1'
        ? { status: 'warn', detail: 'Cache bypassed' }
        : null,
    hint: 'Unset AI_RESPONSE_CACHE_DISABLED.',
  },
  {
    id: 'EDGE_INLINE_BACKGROUND_TASKS',
    label: 'Background tasks deferred',
    features: ['Response latency'],
    check: (get) =>
      get('EDGE_INLINE_BACKGROUND_TASKS')?.trim() === '1'
        ? { status: 'warn', detail: 'Local-only flag is set' }
        : null,
    hint: 'Unset EDGE_INLINE_BACKGROUND_TASKS.',
  },
  {
    id: 'GEMINI_MODEL_OVERRIDE',
    label: 'Default AI models',
    features: ['AI quality'],
    check: (get) =>
      get('GEMINI_MODEL_OVERRIDE')?.trim()
        ? { status: 'warn', detail: 'Model override is set' }
        : null,
    hint: 'Unset GEMINI_MODEL_OVERRIDE unless intended.',
  },
  {
    id: 'META_OAUTH_EXCLUDE_PUBLISHING_SCOPES',
    label: 'Meta publishing scopes requested',
    features: ['Meta publishing'],
    check: (get) =>
      get('META_OAUTH_EXCLUDE_PUBLISHING_SCOPES')?.trim() === '1'
        ? { status: 'warn', detail: 'New Meta connections cannot publish posts' }
        : null,
    hint: 'Unset META_OAUTH_EXCLUDE_PUBLISHING_SCOPES once the Meta app is approved.',
  },
  {
    id: 'EDGE_LOG_DEBUG',
    label: 'Debug logging off',
    features: ['Log volume'],
    check: (get) =>
      get('EDGE_LOG_DEBUG')?.trim() === '1' ? { status: 'warn', detail: 'Debug logs on' } : null,
    hint: 'Unset EDGE_LOG_DEBUG.',
  },
];

function presentValue(
  def: EnvDef,
  get: (key: string) => string | undefined
): { key: string; value: string } | null {
  for (const key of def.anyOf ?? [def.key]) {
    const value = get(key)?.trim();
    if (value) return { key, value };
  }
  return null;
}

function missingStatus(level: EnvLevel, isProd: boolean): HealthStatus {
  switch (level) {
    case 'required':
      return 'error';
    case 'prodRequired':
      return isProd ? 'error' : 'off';
    case 'recommended':
      return 'warn';
    case 'prodRecommended':
      return isProd ? 'warn' : 'off';
    default:
      return 'off';
  }
}

export function evaluateEdgeEnv(
  get: (key: string) => string | undefined,
  isProd: boolean
): HealthCheck[] {
  const secretsUrl = supabaseDashboardUrl(supabaseProjectRef(get), 'functions/secrets');
  const checks: HealthCheck[] = EDGE_ENV_REGISTRY.map((def) => {
    const label = def.anyOf ? def.anyOf.join(' or ') : def.key;
    const base = {
      id: `env.edge.${def.key}`,
      category: 'configuration' as const,
      group: def.group,
      label,
      features: def.features,
    };
    const present = presentValue(def, get);
    if (!present) {
      const status = missingStatus(def.level, isProd);
      const isOff = status === 'off';
      return {
        ...base,
        status,
        detail: def.defaultValue ? `Default ${def.defaultValue}` : isOff ? 'Not set' : 'Missing',
        hint: isOff ? undefined : def.hint,
        manageHref: isOff ? undefined : secretsUrl,
      };
    }
    const problem = def.validate?.(present.value, isProd) ?? null;
    if (problem) {
      return {
        ...base,
        status: problem.status,
        detail: problem.detail,
        hint: def.hint,
        manageHref: def.console ?? secretsUrl,
      };
    }

    let detail = 'Set';
    if (def.showValue) detail = present.value;
    else if (def.key === 'GEMINI_API_KEY' && present.key === 'GEMINI_API_KEYS') {
      const count = present.value.split(',').filter((item) => item.trim()).length;
      detail = `${count} key${count === 1 ? '' : 's'}`;
    } else if (def.key.endsWith('_EMAILS')) {
      const count = present.value.split(',').filter((item) => item.trim()).length;
      detail = `${count} email${count === 1 ? '' : 's'}`;
    }
    return { ...base, status: 'ok' as const, detail };
  });

  for (const rule of EDGE_POSTURE_RULES) {
    const problem = isProd ? rule.check(get) : null;
    checks.push({
      id: `posture.edge.${rule.id}`,
      category: 'security',
      group: 'Production posture',
      label: rule.label,
      features: rule.features,
      status: isProd ? (problem?.status ?? 'ok') : 'off',
      detail: isProd ? (problem?.detail ?? 'OK') : 'Checked in production only',
      hint: problem ? rule.hint : undefined,
      manageHref: problem ? secretsUrl : undefined,
    });
  }

  return checks;
}
