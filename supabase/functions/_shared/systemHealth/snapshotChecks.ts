import {
  SCHEDULED_JOBS,
  vaultSecretName,
  type CronJobRow,
  type JobHeartbeatRow,
} from './jobsRegistry.ts';
import {
  supabaseDashboardUrl,
  supabaseProjectRef,
  type HealthCheck,
  type HealthStatus,
} from './types.ts';

/** Shape returned by `public.get_system_health_snapshot()`. */
export type SystemHealthSnapshot = {
  extensions: { pg_cron: boolean; pg_net: boolean };
  cron_jobs: CronJobRow[] | null;
  vault_secret_names: string[] | null;
  db_size_bytes: number;
  heartbeats: JobHeartbeatRow[];
  probes: Array<{
    probe_id: string;
    status: HealthStatus;
    detail: string | null;
    latency_ms: number | null;
    meta: Record<string, unknown>;
    checked_at: string;
  }>;
  platform_settings: {
    maintenance_mode: boolean;
    signups_enabled: boolean;
    authenticated_rate_limit_enforce: boolean;
  } | null;
  ai_settings: {
    enabled: boolean;
    enforce_quotas: boolean;
    voice_health_status: 'unknown' | 'healthy' | 'unhealthy' | null;
    voice_health_checked_at: string | null;
    voice_health_failure_code: string | null;
  } | null;
  meta: {
    total: number;
    connected: number;
    error: number;
    disconnected: number;
    token_expired: number;
    token_expiring_7d: number;
    webhook_unverified_24h: number;
    webhook_failing?: number;
  } | null;
  meta_items?: Array<{
    display_name: string | null;
    platform: string;
    org_name: string;
    org_slug: string;
    reason: string;
  }>;
  calendar_feeds: { active: number; failing: number; stale_6h: number } | null;
  calendar_items?: Array<{
    feed: string;
    property_name: string;
    org_name: string;
    org_slug: string;
    consecutive_failures: number;
    last_error: string | null;
  }>;
  push: { active: number; disabled: number; failing: number } | null;
  marketing_jobs: { created_24h: number; failed_24h: number; stuck: number } | null;
  telegram?: {
    enabled: number;
    missing_creds: number;
    missing_items: Array<{
      channel: string;
      unit_name: string | null;
      org_name: string | null;
      org_slug: string | null;
    }>;
  } | null;
  ai_providers?: Record<
    string,
    {
      calls: number;
      errors: number;
      rate_limited: number;
      auth: number;
      last_error_at: string | null;
    }
  >;
  email?: {
    bounced_7d: number;
    complained_7d: number;
    inbound_7d: number;
    inbound_failed_7d: number;
    inbound_last_at: string | null;
  } | null;
  paymongo_last_event_at: string | null;
};

const orgHref = (slug: string | null | undefined) => (slug ? `/admin/orgs/${slug}` : undefined);

/** Supabase Pro included database size. Change if the plan changes. */
export const DB_SIZE_REFERENCE_BYTES = 8 * 1024 ** 3;

function formatBytes(bytes: number): string {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(0)} MB`;
  return `${Math.round(bytes / 1024)} KB`;
}

export function evaluateDatabase(
  snapshot: SystemHealthSnapshot,
  get: (key: string) => string | undefined,
  isProd: boolean
): HealthCheck[] {
  const checks: HealthCheck[] = [];
  const base = { category: 'database' as const, group: 'Database' };
  const missingExtension: HealthStatus = isProd ? 'error' : 'off';
  const ref = supabaseProjectRef(get);
  const extensionsUrl = supabaseDashboardUrl(ref, 'database/extensions');
  const vaultUrl = supabaseDashboardUrl(ref, 'integrations/vault/secrets');
  const secretsUrl = supabaseDashboardUrl(ref, 'functions/secrets');

  checks.push({
    ...base,
    id: 'db.ext.pg_cron',
    label: 'pg_cron extension',
    status: snapshot.extensions.pg_cron ? 'ok' : missingExtension,
    detail: snapshot.extensions.pg_cron ? 'Installed' : 'Not installed',
    manageHref: snapshot.extensions.pg_cron ? undefined : extensionsUrl,
    features: ['All scheduled jobs'],
  });
  checks.push({
    ...base,
    id: 'db.ext.pg_net',
    label: 'pg_net extension',
    status: snapshot.extensions.pg_net ? 'ok' : missingExtension,
    detail: snapshot.extensions.pg_net ? 'Installed' : 'Not installed',
    manageHref: snapshot.extensions.pg_net ? undefined : extensionsUrl,
    features: ['All scheduled jobs', 'Push notifications'],
  });

  const vault = snapshot.vault_secret_names ? new Set(snapshot.vault_secret_names) : null;
  for (const name of ['project_url', 'anon_key']) {
    checks.push({
      ...base,
      id: `db.vault.${name}`,
      group: 'Vault',
      label: `Vault ${name}`,
      status: !vault ? 'unknown' : vault.has(name) ? 'ok' : isProd ? 'error' : 'off',
      detail: !vault ? 'Vault not readable' : vault.has(name) ? 'Set' : 'Missing',
      hint:
        vault && !vault.has(name) ? 'Every cron job needs it to call edge functions.' : undefined,
      manageHref: vault && !vault.has(name) ? vaultUrl : undefined,
      features: ['All scheduled jobs'],
    });
  }

  const secretPairs = [
    ...SCHEDULED_JOBS.filter((job) => !(job.nonProdOnly && isProd)).map((job) => ({
      env: job.secretEnv,
      label: job.label,
    })),
    { env: 'PUSH_FANOUT_SECRET', label: 'Push fan-out' },
  ];
  for (const pair of secretPairs) {
    const envSet = Boolean(get(pair.env)?.trim());
    const vaultName = vaultSecretName(pair.env);
    const vaultSet = vault?.has(vaultName) ?? null;
    let status: HealthStatus = 'ok';
    let detail = 'Edge and Vault match';
    let hint: string | undefined;
    if (vaultSet === null) {
      status = 'unknown';
      detail = 'Vault not readable';
    } else if (envSet && !vaultSet) {
      status = 'error';
      detail = 'Edge secret set, Vault secret missing';
      hint = `Add Vault secret ${vaultName}. Calls are rejected (401).`;
    } else if (!envSet && vaultSet) {
      status = isProd ? 'error' : 'warn';
      detail = 'Vault secret set, edge secret missing';
      hint = `Set edge secret ${pair.env}.`;
    } else if (!envSet && !vaultSet) {
      status = isProd ? 'error' : 'off';
      detail = 'Neither set';
      hint = isProd ? `Set ${pair.env} and Vault ${vaultName}.` : undefined;
    }
    checks.push({
      ...base,
      id: `db.vault.parity.${pair.env}`,
      group: 'Vault',
      label: pair.label,
      status,
      detail,
      hint,
      manageHref:
        status === 'error' || status === 'warn'
          ? envSet && !vaultSet
            ? vaultUrl
            : secretsUrl
          : undefined,
    });
  }

  const pct = snapshot.db_size_bytes / DB_SIZE_REFERENCE_BYTES;
  checks.push({
    ...base,
    id: 'db.size',
    label: 'Database size',
    status: pct >= 0.95 ? 'error' : pct >= 0.8 ? 'warn' : 'ok',
    detail: `${formatBytes(snapshot.db_size_bytes)} of ${formatBytes(DB_SIZE_REFERENCE_BYTES)}`,
    hint: pct >= 0.8 ? 'Run retention jobs or upgrade disk.' : undefined,
    fixHref: '/admin/health/usage',
  });

  return checks;
}

export function evaluatePlatformPosture(
  snapshot: SystemHealthSnapshot,
  isProd: boolean
): HealthCheck[] {
  const settings = snapshot.platform_settings;
  const ai = snapshot.ai_settings;
  const base = { category: 'security' as const, group: 'Platform settings' };
  const checks: HealthCheck[] = [];
  if (settings) {
    checks.push({
      ...base,
      id: 'posture.platform.maintenance',
      label: 'Maintenance mode',
      status: settings.maintenance_mode ? 'warn' : 'ok',
      detail: settings.maintenance_mode ? 'On' : 'Off',
      fixHref: '/admin/platform-settings',
    });
    checks.push({
      ...base,
      id: 'posture.platform.signups',
      label: 'Host signups',
      status: settings.signups_enabled ? 'ok' : 'warn',
      detail: settings.signups_enabled ? 'Open' : 'Closed',
      fixHref: '/admin/platform-settings',
    });
    checks.push({
      ...base,
      id: 'posture.platform.rate_limit',
      label: 'Authenticated rate limit',
      status: settings.authenticated_rate_limit_enforce ? 'ok' : isProd ? 'warn' : 'off',
      detail: settings.authenticated_rate_limit_enforce ? 'Enforcing' : 'Log only',
      fixHref: '/admin/platform-settings',
    });
  }
  if (ai) {
    checks.push({
      ...base,
      id: 'posture.ai.enabled',
      label: 'AI platform switch',
      status: ai.enabled ? 'ok' : 'warn',
      detail: ai.enabled ? 'On' : 'Off for every organization',
      features: ['All AI features'],
      fixHref: '/admin/ai?tab=controls',
    });
    checks.push({
      ...base,
      id: 'posture.ai.quotas',
      label: 'AI quota enforcement',
      status: ai.enforce_quotas ? 'ok' : 'warn',
      detail: ai.enforce_quotas ? 'Enforcing' : 'Off',
      features: ['AI cost'],
      fixHref: '/admin/ai?tab=controls',
    });
  }
  return checks;
}

const AI_CONSOLES: Record<string, string> = {
  gemini: 'https://aistudio.google.com/apikey',
  groq: 'https://console.groq.com/keys',
};

/** Real-traffic provider errors (24h). Catches exhausted quotas the free probes cannot see. */
export function evaluateAiProviders(snapshot: SystemHealthSnapshot): HealthCheck[] {
  if (!snapshot.ai_providers) return [];
  return (['gemini', 'groq'] as const).map((provider): HealthCheck => {
    const stats = snapshot.ai_providers?.[provider];
    const label = provider === 'gemini' ? 'Gemini calls (24h)' : 'Groq calls (24h)';
    const base = {
      id: `traffic.ai.${provider}`,
      category: 'integrations' as const,
      group: 'AI',
      label,
      features: provider === 'gemini' ? ['All AI features'] : ['AI fallback'],
      fixHref: '/admin/ai?tab=usage',
    };
    if (!stats || stats.calls === 0) return { ...base, status: 'off', detail: 'No calls' };
    const errorRate = stats.errors / stats.calls;
    const parts = [`${stats.calls} calls`, `${stats.errors} failed`];
    if (stats.rate_limited) parts.push(`${stats.rate_limited} rate limited`);
    if (stats.auth) parts.push(`${stats.auth} key rejected`);
    const detail = parts.join(', ');
    if (stats.auth > 0) {
      return {
        ...base,
        status: 'error',
        detail,
        hint: 'A key was rejected. Run live checks to find which one.',
        manageHref: AI_CONSOLES[provider],
      };
    }
    if (stats.rate_limited > 0 || errorRate > 0.1) {
      return {
        ...base,
        status: 'warn',
        detail,
        hint:
          stats.rate_limited > 0
            ? 'Quota or rate limit reached. Add a key or raise the quota.'
            : undefined,
        manageHref: AI_CONSOLES[provider],
      };
    }
    return { ...base, status: 'ok', detail };
  });
}

export function evaluateEmailTraffic(
  snapshot: SystemHealthSnapshot,
  get: (key: string) => string | undefined
): HealthCheck[] {
  const email = snapshot.email;
  if (!email) return [];
  const base = { category: 'integrations' as const, group: 'Email' };
  const checks: HealthCheck[] = [
    {
      ...base,
      id: 'traffic.email.deliverability',
      label: 'Bounces and complaints (7d)',
      status: email.complained_7d > 0 || email.bounced_7d >= 10 ? 'warn' : 'ok',
      detail: `${email.bounced_7d} bounced, ${email.complained_7d} complaints`,
      hint:
        email.complained_7d > 0
          ? 'Spam complaints hurt the sender domain. Review recent email content.'
          : email.bounced_7d >= 10
            ? 'Many bounces. Check guest email capture.'
            : undefined,
      manageHref: 'https://resend.com/emails',
      features: ['All email'],
    },
  ];
  if (get('RESEND_INBOUND_WEBHOOK_SECRET')?.trim()) {
    checks.push({
      ...base,
      id: 'traffic.email.inbound',
      label: 'Inbound approvals (7d)',
      status: email.inbound_failed_7d > 0 ? 'warn' : email.inbound_7d === 0 ? 'off' : 'ok',
      detail:
        email.inbound_7d === 0
          ? 'None received'
          : `${email.inbound_7d} received, ${email.inbound_failed_7d} failed`,
      hint:
        email.inbound_failed_7d > 0
          ? 'Some approval emails could not be matched to a booking.'
          : undefined,
      checkedAt: email.inbound_last_at ?? undefined,
      features: ['GAF and pet approvals'],
    });
  }
  return checks;
}

export function evaluatePayments(
  snapshot: SystemHealthSnapshot,
  get: (key: string) => string | undefined
): HealthCheck[] {
  if (!get('PAYMONGO_SECRET_KEY')?.trim()) return [];
  const last = snapshot.paymongo_last_event_at;
  return [
    {
      id: 'traffic.paymongo.webhook',
      category: 'integrations',
      group: 'Payments',
      label: 'Webhook events',
      status: last ? 'ok' : 'off',
      detail: last ? 'Received' : 'None received yet',
      checkedAt: last ?? undefined,
      features: ['Payment confirmation'],
    },
  ];
}

export function evaluateTenantIntegrations(
  snapshot: SystemHealthSnapshot,
  isProd = false
): HealthCheck[] {
  const checks: HealthCheck[] = [];
  const base = { category: 'integrations' as const };

  const meta = snapshot.meta;
  if (meta) {
    const broken = meta.error + meta.token_expired;
    const metaItems = (snapshot.meta_items ?? []).map((item) => ({
      label: `${item.org_name} · ${item.display_name ?? item.platform}`,
      detail: item.reason,
      href: orgHref(item.org_slug),
    }));
    checks.push({
      ...base,
      id: 'tenant.meta.tokens',
      group: 'Meta channels',
      label: 'Page connections',
      status:
        meta.total === 0
          ? 'off'
          : broken > 0
            ? 'error'
            : meta.token_expiring_7d > 0
              ? 'warn'
              : 'ok',
      detail:
        meta.total === 0
          ? 'No connections'
          : `${meta.connected} connected, ${meta.error} error, ${meta.token_expired} expired, ${meta.token_expiring_7d} expiring in 7 days`,
      hint:
        broken > 0 || meta.token_expiring_7d > 0
          ? 'The host must reconnect Meta in Inbox settings.'
          : undefined,
      items: broken > 0 || meta.token_expiring_7d > 0 ? metaItems : undefined,
      features: ['Guest inbox', 'Meta publishing'],
    });
    const failing = meta.webhook_failing ?? 0;
    checks.push({
      ...base,
      id: 'tenant.meta.webhooks',
      group: 'Meta channels',
      label: 'Webhook delivery',
      status:
        meta.connected === 0
          ? 'off'
          : failing > 0 || meta.webhook_unverified_24h > 0
            ? 'warn'
            : 'ok',
      detail:
        meta.connected === 0
          ? 'No connections'
          : failing > 0
            ? `${failing} failing verification`
            : meta.webhook_unverified_24h > 0
              ? `${meta.webhook_unverified_24h} not checked in 24h`
              : `${meta.connected} subscribed`,
      hint:
        failing > 0
          ? 'Check the Meta app webhook subscription.'
          : meta.webhook_unverified_24h > 0
            ? 'The Meta webhook check job may not be running.'
            : undefined,
      items:
        failing > 0 ? metaItems.filter((item) => item.detail === 'Webhook failing') : undefined,
      features: ['Guest inbox'],
    });
  }

  const feeds = snapshot.calendar_feeds;
  if (feeds) {
    checks.push({
      ...base,
      id: 'tenant.calendar.feeds',
      group: 'Calendar sync',
      label: 'iCal feeds',
      status:
        feeds.active === 0
          ? 'off'
          : feeds.failing > 0
            ? 'error'
            : feeds.stale_6h > 0
              ? 'warn'
              : 'ok',
      detail:
        feeds.active === 0
          ? 'No active feeds'
          : `${feeds.active} active, ${feeds.failing} failing, ${feeds.stale_6h} not synced in 6h`,
      hint: feeds.failing > 0 ? 'The host should check the feed URL in Calendar sync.' : undefined,
      items: (snapshot.calendar_items ?? []).map((item) => ({
        label: `${item.org_name} · ${item.property_name}`,
        detail: `${item.feed}: ${item.last_error ?? `${item.consecutive_failures} failures`}`,
        href: orgHref(item.org_slug),
      })),
      features: ['Calendar sync'],
    });
  }

  const telegram = snapshot.telegram;
  if (telegram) {
    checks.push({
      ...base,
      id: 'tenant.telegram.credentials',
      group: 'Telegram',
      label: 'Bot credentials',
      status: telegram.enabled === 0 ? 'off' : telegram.missing_creds > 0 ? 'warn' : 'ok',
      detail:
        telegram.enabled === 0
          ? 'No bots enabled'
          : `${telegram.enabled} enabled, ${telegram.missing_creds} missing a token or chat`,
      hint:
        telegram.missing_creds > 0
          ? 'These alerts are on but never send. The host must add the bot token and chat.'
          : undefined,
      items: telegram.missing_items.map((item) => ({
        label: `${item.org_name ?? 'Unknown org'} · ${item.unit_name ?? 'Unknown unit'}`,
        detail: item.channel,
        href: orgHref(item.org_slug),
      })),
      features: ['Telegram alerts'],
    });
  }

  const push = snapshot.push;
  if (push) {
    checks.push({
      ...base,
      id: 'tenant.push.subscriptions',
      group: 'Push',
      label: 'Device subscriptions',
      status: push.active === 0 ? 'off' : push.failing > 0 ? 'warn' : 'ok',
      detail: `${push.active} active, ${push.failing} failing, ${push.disabled} disabled`,
      features: ['Push notifications'],
    });
  }

  const jobs = snapshot.marketing_jobs;
  if (jobs) {
    const failRate = jobs.created_24h > 0 ? jobs.failed_24h / jobs.created_24h : 0;
    checks.push({
      ...base,
      id: 'tenant.marketing.jobs',
      group: 'Marketing Studio',
      label: 'Image and video jobs (24h)',
      status:
        jobs.created_24h === 0 && jobs.stuck === 0
          ? 'off'
          : jobs.stuck > 0 || failRate > 0.25
            ? 'warn'
            : 'ok',
      detail: `${jobs.created_24h} created, ${jobs.failed_24h} failed, ${jobs.stuck} stuck`,
      hint: jobs.stuck > 0 ? 'The marketing sweeper job should clear stuck jobs.' : undefined,
      features: ['Marketing Studio'],
    });
  }

  const ai = snapshot.ai_settings;
  if (ai) {
    const voice = ai.voice_health_status ?? 'unknown';
    checks.push({
      ...base,
      id: 'tenant.voice.canary',
      group: 'Voice receptionist',
      label: 'Provider canary',
      status:
        voice === 'healthy' ? 'ok' : voice === 'unhealthy' ? 'error' : isProd ? 'off' : 'unknown',
      detail:
        voice === 'unhealthy'
          ? `Failing${ai.voice_health_failure_code ? ` (${ai.voice_health_failure_code})` : ''}`
          : voice === 'healthy'
            ? 'Healthy'
            : isProd
              ? 'No failures reported'
              : 'Not checked yet',
      checkedAt: ai.voice_health_checked_at ?? undefined,
      features: ['Voice receptionist'],
    });
  }

  return checks;
}
