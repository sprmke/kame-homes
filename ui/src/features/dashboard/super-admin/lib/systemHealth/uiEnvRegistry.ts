import type {
  HealthCheck,
  HealthStatus,
} from '@/features/dashboard/super-admin/lib/systemHealth/healthStatus';

type Level = 'required' | 'prodRequired' | 'recommended' | 'prodRecommended' | 'optional';

type UiEnvDef = {
  key: string;
  group: string;
  level: Level;
  features: string[];
  /** Public build-time values only; never mark a key that could be secret. */
  showValue?: boolean;
  hint?: string;
  validate?: (value: string, isProd: boolean) => { status: HealthStatus; detail: string } | null;
};

function validateUrl(value: string, isProd: boolean) {
  try {
    const url = new URL(value);
    if (isProd && /^(localhost|127\.0\.0\.1)$/.test(url.hostname)) {
      return { status: 'warn' as const, detail: 'Points at a local address' };
    }
    return null;
  } catch {
    return { status: 'error' as const, detail: 'Not a valid URL' };
  }
}

/**
 * Vite build-time vars the SPA reads. Add a row in the same change that introduces a new
 * `import.meta.env.VITE_*` key. Values are baked into the bundle, so they are public anyway;
 * only non-key values are displayed.
 */
export const UI_ENV_REGISTRY: UiEnvDef[] = [
  {
    key: 'VITE_SUPABASE_URL',
    group: 'Core',
    level: 'required',
    features: ['Everything'],
    showValue: true,
    validate: validateUrl,
  },
  { key: 'VITE_SUPABASE_ANON_KEY', group: 'Core', level: 'required', features: ['Everything'] },
  {
    key: 'VITE_API_URL',
    group: 'Core',
    level: 'required',
    features: ['Guest form'],
    showValue: true,
    validate: validateUrl,
  },
  {
    key: 'VITE_PLATFORM_APP_NAME',
    group: 'Branding',
    level: 'recommended',
    features: ['Page titles', 'Marketing site'],
    showValue: true,
  },
  {
    key: 'VITE_PLATFORM_CONTACT_EMAIL',
    group: 'Branding',
    level: 'optional',
    features: ['Marketing footer'],
    showValue: true,
  },
  {
    key: 'VITE_TURNSTILE_SITE_KEY',
    group: 'Security',
    level: 'prodRecommended',
    features: ['Public form CAPTCHA'],
    hint: 'Pairs with the TURNSTILE_SECRET_KEY edge secret.',
  },
  {
    key: 'VITE_VAPID_PUBLIC_KEY',
    group: 'Push',
    level: 'prodRecommended',
    features: ['Push notifications'],
    hint: 'Must match the public key in the VAPID_KEYS edge secret.',
  },
  {
    key: 'VITE_GOOGLE_MAPS_API_KEY',
    group: 'Maps',
    level: 'recommended',
    features: ['Map picker', 'Listing maps'],
  },
  {
    key: 'VITE_POSTHOG_KEY',
    group: 'Observability',
    level: 'prodRecommended',
    features: ['Product analytics'],
  },
  {
    key: 'VITE_SENTRY_DSN',
    group: 'Observability',
    level: 'prodRecommended',
    features: ['Frontend error tracking'],
  },
  {
    key: 'VITE_APP_VERSION',
    group: 'Observability',
    level: 'optional',
    features: ['Release tagging'],
    showValue: true,
  },
  {
    key: 'VITE_SUPABASE_PROJECT_URL',
    group: 'Core',
    level: 'optional',
    features: ['Storage links'],
    showValue: true,
    validate: validateUrl,
  },
  {
    key: 'VITE_PLATFORM_CONTACT_PHONE',
    group: 'Branding',
    level: 'optional',
    features: ['Marketing footer'],
    showValue: true,
  },
  ...[
    'VITE_PLATFORM_SOCIAL_FACEBOOK',
    'VITE_PLATFORM_SOCIAL_INSTAGRAM',
    'VITE_PLATFORM_SOCIAL_TWITTER',
  ].map((key): UiEnvDef => ({
    key,
    group: 'Branding',
    level: 'optional',
    features: ['Marketing footer'],
    showValue: true,
    validate: validateUrl,
  })),
  {
    key: 'VITE_POSTHOG_HOST',
    group: 'Observability',
    level: 'optional',
    features: ['Product analytics'],
    showValue: true,
    validate: validateUrl,
  },
  {
    key: 'VITE_POSTHOG_INGEST_PATH',
    group: 'Observability',
    level: 'optional',
    features: ['Product analytics'],
    showValue: true,
  },
  {
    key: 'VITE_POSTHOG_SESSION_REPLAY',
    group: 'Observability',
    level: 'optional',
    features: ['Session replay'],
    showValue: true,
  },
  {
    key: 'VITE_APP_TRACK',
    group: 'Observability',
    level: 'optional',
    features: ['Analytics track'],
    showValue: true,
  },
  {
    key: 'VITE_SUPABASE_IMAGE_TRANSFORMS',
    group: 'Media',
    level: 'optional',
    features: ['Responsive images'],
    showValue: true,
  },
  {
    key: 'VITE_IMAGE_OPT_SURFACES',
    group: 'Media',
    level: 'optional',
    features: ['Image optimization'],
    showValue: true,
  },
];

type UiPostureRule = {
  id: string;
  label: string;
  features: string[];
  check: (
    env: Record<string, string | undefined>
  ) => { status: HealthStatus; detail: string } | null;
  hint: string;
};

/** Build flags that are unsafe on a production build. Evaluated in production only. */
export const UI_POSTURE_RULES: UiPostureRule[] = [
  {
    id: 'VITE_NODE_ENV',
    label: 'Guest form dev controls hidden',
    features: ['Guest form'],
    check: (env) =>
      env.VITE_NODE_ENV?.trim() === 'production'
        ? null
        : { status: 'error', detail: 'Guests see dev controls' },
    hint: 'Set VITE_NODE_ENV=production and redeploy.',
  },
  {
    id: 'VITE_INBOX_MOCK_DATA',
    label: 'Inbox uses live data',
    features: ['Guest inbox'],
    check: (env) =>
      env.VITE_INBOX_MOCK_DATA?.trim() === 'true'
        ? { status: 'error', detail: 'Inbox shows mock data' }
        : null,
    hint: 'Unset VITE_INBOX_MOCK_DATA and redeploy.',
  },
  {
    id: 'VITE_DISABLE_IMAGE_OPTIMIZATION',
    label: 'Image optimization on',
    features: ['Page speed'],
    check: (env) =>
      env.VITE_DISABLE_IMAGE_OPTIMIZATION?.trim() === '1'
        ? { status: 'warn', detail: 'Kill switch is set' }
        : null,
    hint: 'Unset VITE_DISABLE_IMAGE_OPTIMIZATION and redeploy.',
  },
];

/** Project ref from `https://<ref>.supabase.co`; null for local or custom domains. */
export function supabaseRefFromUrl(url: string | undefined): string | null {
  try {
    return new URL(url ?? '').hostname.match(/^([a-z0-9]{20})\.supabase\.co$/)?.[1] ?? null;
  } catch {
    return null;
  }
}

/** UI build vs edge runtime: catches a build pointed at the wrong project or a stale VAPID key. */
export function evaluateUiServerParity(
  env: Record<string, string | undefined>,
  server: { projectRef: string | null; vapidPublicKey: string | null }
): HealthCheck[] {
  const base = { category: 'configuration' as const, group: 'UI and edge match' };
  const checks: HealthCheck[] = [];
  const uiRef = supabaseRefFromUrl(env.VITE_SUPABASE_URL);
  if (uiRef && server.projectRef) {
    const same = uiRef === server.projectRef;
    checks.push({
      ...base,
      id: 'parity.supabase_project',
      label: 'Supabase project',
      status: same ? 'ok' : 'error',
      detail: same ? uiRef : `UI uses ${uiRef}, edge uses ${server.projectRef}`,
      hint: same ? undefined : 'Point VITE_SUPABASE_URL at the same project and redeploy.',
      features: ['Everything'],
    });
  }
  const uiVapid = env.VITE_VAPID_PUBLIC_KEY?.trim();
  if (uiVapid && server.vapidPublicKey) {
    const same = uiVapid === server.vapidPublicKey;
    checks.push({
      ...base,
      id: 'parity.vapid',
      label: 'Push key pair',
      status: same ? 'ok' : 'error',
      detail: same ? 'Public keys match' : 'VITE_VAPID_PUBLIC_KEY differs from VAPID_KEYS',
      hint: same ? undefined : 'Copy the public key from VAPID_KEYS and redeploy.',
      features: ['Push notifications'],
    });
  }
  return checks;
}

function missingStatus(level: Level, isProd: boolean): HealthStatus {
  if (level === 'required') return 'error';
  if (level === 'prodRequired') return isProd ? 'error' : 'off';
  if (level === 'recommended') return 'warn';
  if (level === 'prodRecommended') return isProd ? 'warn' : 'off';
  return 'off';
}

export function evaluateUiEnv(
  env: Record<string, string | undefined>,
  isProd: boolean
): HealthCheck[] {
  const checks = UI_ENV_REGISTRY.map((def): HealthCheck => {
    const base = {
      id: `env.ui.${def.key}`,
      category: 'configuration' as const,
      group: `${def.group} (UI)`,
      label: def.key,
      features: def.features,
    };
    const value = env[def.key]?.trim();
    if (!value) {
      const status = missingStatus(def.level, isProd);
      return {
        ...base,
        status,
        detail: status === 'off' ? 'Not set' : 'Missing',
        hint: status === 'off' ? undefined : (def.hint ?? 'Set in the hosting env and redeploy.'),
      };
    }
    const problem = def.validate?.(value, isProd) ?? null;
    if (problem) return { ...base, ...problem, hint: def.hint };
    return { ...base, status: 'ok', detail: def.showValue ? value : 'Set' };
  });

  for (const rule of UI_POSTURE_RULES) {
    const problem = isProd ? rule.check(env) : null;
    checks.push({
      id: `posture.ui.${rule.id}`,
      category: 'security',
      group: 'Production posture (UI)',
      label: rule.label,
      features: rule.features,
      status: isProd ? (problem?.status ?? 'ok') : 'off',
      detail: isProd ? (problem?.detail ?? 'OK') : 'Checked in production only',
      hint: problem ? rule.hint : undefined,
    });
  }
  return checks;
}

/** Explicit reads so Vite inlines each key at build time. */
export function readUiEnv(): Record<string, string | undefined> {
  return {
    VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL,
    VITE_SUPABASE_ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY,
    VITE_API_URL: import.meta.env.VITE_API_URL,
    VITE_PLATFORM_APP_NAME: import.meta.env.VITE_PLATFORM_APP_NAME,
    VITE_PLATFORM_CONTACT_EMAIL: import.meta.env.VITE_PLATFORM_CONTACT_EMAIL,
    VITE_TURNSTILE_SITE_KEY: import.meta.env.VITE_TURNSTILE_SITE_KEY,
    VITE_VAPID_PUBLIC_KEY: import.meta.env.VITE_VAPID_PUBLIC_KEY,
    VITE_GOOGLE_MAPS_API_KEY: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
    VITE_POSTHOG_KEY: import.meta.env.VITE_POSTHOG_KEY,
    VITE_SENTRY_DSN: import.meta.env.VITE_SENTRY_DSN,
    VITE_APP_VERSION: import.meta.env.VITE_APP_VERSION,
    VITE_SUPABASE_PROJECT_URL: import.meta.env.VITE_SUPABASE_PROJECT_URL,
    VITE_PLATFORM_CONTACT_PHONE: import.meta.env.VITE_PLATFORM_CONTACT_PHONE,
    VITE_PLATFORM_SOCIAL_FACEBOOK: import.meta.env.VITE_PLATFORM_SOCIAL_FACEBOOK,
    VITE_PLATFORM_SOCIAL_INSTAGRAM: import.meta.env.VITE_PLATFORM_SOCIAL_INSTAGRAM,
    VITE_PLATFORM_SOCIAL_TWITTER: import.meta.env.VITE_PLATFORM_SOCIAL_TWITTER,
    VITE_POSTHOG_HOST: import.meta.env.VITE_POSTHOG_HOST,
    VITE_POSTHOG_INGEST_PATH: import.meta.env.VITE_POSTHOG_INGEST_PATH,
    VITE_POSTHOG_SESSION_REPLAY: import.meta.env.VITE_POSTHOG_SESSION_REPLAY,
    VITE_APP_TRACK: import.meta.env.VITE_APP_TRACK,
    VITE_SUPABASE_IMAGE_TRANSFORMS: import.meta.env.VITE_SUPABASE_IMAGE_TRANSFORMS,
    VITE_IMAGE_OPT_SURFACES: import.meta.env.VITE_IMAGE_OPT_SURFACES,
    VITE_NODE_ENV: import.meta.env.VITE_NODE_ENV,
    VITE_INBOX_MOCK_DATA: import.meta.env.VITE_INBOX_MOCK_DATA,
    VITE_DISABLE_IMAGE_OPTIMIZATION: import.meta.env.VITE_DISABLE_IMAGE_OPTIMIZATION,
  };
}
