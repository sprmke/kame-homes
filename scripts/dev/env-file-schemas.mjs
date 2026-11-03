/**
 * Shared section schemas for the gitignored env files.
 *
 * One source of truth: `reorganize-env-files.mjs` reformats from it and
 * `sync-dev-env.mjs` re-writes the hosted file from it. A key with no row is dropped
 * by both, so add a row in the same change that introduces a new env key.
 */

export const UI_SECTIONS = [
  { title: 'App', keys: ['VITE_NODE_ENV'] },
  {
    title: 'Supabase',
    keys: [
      'VITE_SUPABASE_URL',
      'VITE_API_URL',
      'VITE_SUPABASE_ANON_KEY',
      'VITE_SUPABASE_PROJECT_URL',
    ],
  },
  {
    title: 'Platform branding (UI only)',
    keys: ['VITE_PLATFORM_APP_NAME', 'VITE_PLATFORM_CONTACT_EMAIL'],
  },
  { title: 'Maps', keys: ['VITE_GOOGLE_MAPS_API_KEY'] },
  { title: 'Anti-spam', keys: ['VITE_TURNSTILE_SITE_KEY'] },
  {
    title: 'Observability',
    keys: [
      'VITE_POSTHOG_KEY',
      'VITE_POSTHOG_HOST',
      'VITE_POSTHOG_INGEST_PATH',
      'VITE_POSTHOG_SESSION_REPLAY',
      'POSTHOG_PERSONAL_API_KEY',
      'POSTHOG_PROJECT_ID',
      'VITE_SENTRY_DSN',
      'VITE_SENTRY_TRACES_SAMPLE_RATE',
    ],
  },
  { title: 'PWA', keys: ['VITE_VAPID_PUBLIC_KEY', 'VITE_PWA_DEV'] },
  {
    title: 'Image optimization',
    keys: ['VITE_DISABLE_IMAGE_OPTIMIZATION', 'VITE_IMAGE_OPT_SURFACES'],
  },
  { title: 'GoTrue (local only)', keys: ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET'] },
  { title: 'Optional', keys: ['VITE_INBOX_MOCK_DATA'] },
  {
    title: 'Public host handling',
    keys: ['VITE_CANONICAL_APP_ORIGIN', 'VITE_LEGACY_APP_HOSTS', 'VITE_SUPER_ADMIN_EMAILS'],
  },
  {
    title: 'Marketing media',
    keys: ['VITE_VIDEO_EDITOR_V2', 'VITE_REMOTION_LICENSE_KEY'],
  },
];

export const EDGE_SECTIONS = [
  { title: 'Scripts', keys: ['PROD_DB_URL'] },
  { title: 'Env', keys: ['ENVIRONMENT', 'DENO_ENV'] },
  { title: 'URLs', keys: ['PUBLIC_GUEST_APP_ORIGIN', 'PUBLIC_API_URL', 'SUPABASE_PUBLIC_URL'] },
  { title: 'Auth', keys: ['ADMIN_ALLOWED_EMAILS', 'SUPER_ADMIN_EMAILS'] },
  {
    title: 'Email',
    keys: [
      'RESEND_API_KEY',
      'RESEND_FROM_EMAIL',
      'RESEND_INBOUND_WEBHOOK_SECRET',
      'RESEND_APPROVAL_INBOUND_DOMAIN',
      'SUPPORT_TEAM_EMAIL',
    ],
  },
  {
    title: 'Crypto',
    keys: [
      'GMAIL_OAUTH_TOKEN_ENCRYPTION_KEY',
      'SETTINGS_VERIFICATION_SECRET',
      'SUPER_ADMIN_VERIFICATION_SECRET',
      'REVIEW_IDENTITY_PEPPER',
    ],
  },
  {
    title: 'Anti-spam',
    keys: ['TURNSTILE_SECRET_KEY', 'CAPTCHA_MODE'],
  },
  {
    title: 'Guest booking access',
    keys: [
      'GUEST_BOOKING_ACCESS_SECRET',
      'GUEST_BOOKING_ACCESS_ENFORCE',
      'GUEST_BOOKING_ACCESS_LEGACY_GRACE_DAYS',
    ],
  },
  {
    title: 'Social fallbacks',
    keys: ['FACEBOOK_REVIEWS_URL', 'AIRBNB_URL', 'INSTAGRAM_URL', 'TIKTOK_URL'],
  },
  {
    title: 'AI',
    keys: [
      'GEMINI_API_KEYS',
      'GEMINI_API_KEY',
      'GROQ_API_KEY',
      'GEMINI_MODEL_OVERRIDE',
      'GEMINI_MODEL_OVERRIDE_DASHBOARD_ASSISTANT',
      'AI_PLATFORM_DAILY_COST_USD_CAP',
      'AI_ASSISTANT_ATTACHMENT_RETENTION_DAYS',
      'ASSISTANT_TOOL_TIMEOUT_MS',
      'ASSISTANT_TURN_DEADLINE_MS',
    ],
  },
  {
    title: 'Meta',
    keys: [
      'META_APP_ID',
      'META_APP_SECRET',
      'META_INBOX_TOKEN_ENCRYPTION_KEY',
      'META_WEBHOOK_VERIFY_TOKEN',
      'META_OAUTH_ALLOWED_RETURN_ORIGINS',
      'META_OAUTH_EXCLUDE_PUBLISHING_SCOPES',
      'META_OAUTH_EXTRA_SCOPES',
    ],
  },
  { title: 'PayMongo', keys: ['PAYMONGO_SECRET_KEY', 'PAYMONGO_WEBHOOK_SECRET'] },
  { title: 'Jamendo', keys: ['JAMENDO_CLIENT_ID'] },
  {
    title: 'Observability',
    keys: [
      'POSTHOG_API_KEY',
      'POSTHOG_HOST',
      'SENTRY_DSN',
      'SENTRY_SAMPLE_RATE_WARNING',
      'APP_RELEASE',
    ],
  },
  {
    title: 'PWA Web Push',
    keys: ['VAPID_KEYS', 'VAPID_SUBJECT', 'PUSH_FANOUT_SECRET'],
  },
  { title: 'Platform email branding', keys: ['PLATFORM_APP_NAME'] },
  {
    title: 'Cron secrets',
    keys: [
      'SD_REFUND_CRON_SECRET',
      'TELEGRAM_CRON_SECRET',
      'TELEGRAM_STAFF_CRON_SECRET',
      'TELEGRAM_ADMIN_CRON_SECRET',
      'TELEGRAM_FINANCE_CRON_SECRET',
      'TELEGRAM_MAINTENANCE_CRON_SECRET',
      'PARKING_BROADCAST_EXPIRE_CRON_SECRET',
      'PARKING_REMINDER_CRON_SECRET',
      'CONTRACT_EXPIRY_CRON_SECRET',
      'DASHBOARD_ASSISTANT_EXPIRE_CRON_SECRET',
      'META_INBOX_WEBHOOK_HEALTHCHECK_CRON_SECRET',
      'PLATFORM_BILLING_CRON_SECRET',
      'CALENDAR_SYNC_CRON_SECRET',
      'CALENDAR_SYNC_MIN_INTERVAL_MINUTES',
      'SMART_PRICING_CRON_SECRET',
      'SUPERHOST_ASSESSMENT_CRON_SECRET',
      'ANALYTICS_AI_REVIEW_CRON_SECRET',
      'PROPERTY_PAGE_VIEWS_PRUNE_CRON_SECRET',
      'ACTIVITY_LOG_RETENTION_CRON_SECRET',
      'MARKETING_GENERATION_CRON_SECRET',
      'QUERY_CACHE_SWEEP_CRON_SECRET',
      'VOICE_RECEPTIONIST_REAPER_SECRET',
      'VOICE_RECEPTIONIST_CANARY_SECRET',
      'REVIEW_LIFECYCLE_CRON_SECRET',
    ],
  },
];

/** Script-only credentials. Kept out of runtime env files. */
export const SCRIPT_SECTIONS = [
  { title: 'Access', keys: ['SUPABASE_ACCESS_TOKEN', 'VERCEL_TOKEN'] },
  {
    title: 'Production database',
    keys: ['PROD_DB_URL', 'TARGET_DB_REF', 'TARGET_DB_PASSWORD', 'TARGET_SERVICE_ROLE_KEY'],
  },
  {
    title: 'Legacy project (retired)',
    keys: ['LEGACY_SERVICE_ROLE_KEY', 'LEGACY_OBJECT_BASE_URL'],
  },
  {
    title: 'Vendor tokens',
    keys: [
      'SENTRY_AUTH_TOKEN',
      'CLOUDFLARE_API_TOKEN',
      'META_USER_ACCESS_TOKEN',
      'POSTHOG_PERSONAL_API_KEY',
    ],
  },
];

/** Keys that must never live in UI env files (edge-only). */
export const UI_DENYLIST = new Set(['TURNSTILE_SECRET_KEY', 'CAPTCHA_MODE']);

/** Keys that must never live in edge env files (UI-only, script-only, or removed). */
export const EDGE_DENYLIST = new Set([
  'PROD_DB_URL',
  'VERCEL_TOKEN',
  'SUPABASE_ACCESS_TOKEN',
  'SENTRY_AUTH_TOKEN',
  'POSTHOG_PERSONAL_API_KEY',
  'TARGET_DB_REF',
  'TARGET_DB_PASSWORD',
  'TARGET_SERVICE_ROLE_KEY',
  'LEGACY_SERVICE_ROLE_KEY',
  'LEGACY_OBJECT_BASE_URL',
  'PLATFORM_CONTACT_EMAIL',
  'VITE_PLATFORM_APP_NAME',
  'VITE_PLATFORM_CONTACT_EMAIL',
  'VITE_SUPABASE_URL',
  'VITE_API_URL',
  'VITE_SUPABASE_ANON_KEY',
  'VITE_NODE_ENV',
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  // Migrated to DB — do not re-add
  'GMAIL_API_WEB_CLIENT_JSON',
  'GMAIL_OAUTH_ALLOWED_RETURN_ORIGINS',
  'GMAIL_OAUTH_CLIENT_ID',
  'GMAIL_OAUTH_CLIENT_SECRET',
  'GMAIL_OAUTH_REDIRECT_URI',
  'GMAIL_OAUTH_TOKEN_JSON',
  'GOOGLE_CALENDAR_ID',
  'GOOGLE_SERVICE_ACCOUNT',
  'GOOGLE_SPREADSHEET_ID',
  'TELEGRAM_BOT_TOKEN',
  'TELEGRAM_CHAT_ID',
  'EMAIL_TO',
  'EMAIL_REPLY_TO',
  'PARKING_OWNER_EMAILS',
  'GCASH_ACCOUNT_NAME',
  'GCASH_ACCOUNT_NUMBER',
  'GCASH_QR_URL',
  'EMAIL_LOGO_URL',
  'PERMIT_APPROVER_EMAIL',
]);

/** @type {Record<string, { path: string; sections: { title: string; keys: string[] }[]; denylist?: Set<string> }>} */
export const SCHEMAS = {
  'ui/.env': {
    path: 'ui/.env',
    sections: [
      {
        title: 'Build-only vendor tokens (never bundled)',
        keys: ['POSTHOG_PERSONAL_API_KEY', 'POSTHOG_PROJECT_ID'],
      },
    ],
  },
  'ui/.env.development': {
    path: 'ui/.env.development',
    sections: UI_SECTIONS,
    denylist: UI_DENYLIST,
  },
  'ui/.env.development.dev': {
    path: 'ui/.env.development.dev',
    sections: UI_SECTIONS.filter((s) => s.title !== 'GoTrue (local only)'),
    denylist: UI_DENYLIST,
  },
  'ui/.env.production': {
    path: 'ui/.env.production',
    sections: [
      { title: 'App', keys: ['VITE_NODE_ENV'] },
      {
        title: 'Supabase',
        keys: [
          'VITE_SUPABASE_URL',
          'VITE_API_URL',
          'VITE_SUPABASE_ANON_KEY',
          'VITE_SUPABASE_PROJECT_URL',
        ],
      },
      {
        title: 'Platform branding (UI only)',
        keys: ['VITE_PLATFORM_APP_NAME', 'VITE_PLATFORM_CONTACT_EMAIL'],
      },
      { title: 'Maps', keys: ['VITE_GOOGLE_MAPS_API_KEY'] },
      { title: 'Anti-spam', keys: ['VITE_TURNSTILE_SITE_KEY'] },
      {
        title: 'Observability',
        keys: [
          'VITE_POSTHOG_KEY',
          'VITE_POSTHOG_HOST',
          'VITE_POSTHOG_INGEST_PATH',
          'VITE_POSTHOG_SESSION_REPLAY',
          'POSTHOG_PERSONAL_API_KEY',
          'POSTHOG_PROJECT_ID',
          'VITE_SENTRY_DSN',
          'VITE_SENTRY_TRACES_SAMPLE_RATE',
        ],
      },
      { title: 'PWA', keys: ['VITE_VAPID_PUBLIC_KEY'] },
    ],
  },
  'supabase/.env.local': {
    path: 'supabase/.env.local',
    sections: EDGE_SECTIONS,
    denylist: EDGE_DENYLIST,
  },
  'supabase/.env.dev.local': {
    path: 'supabase/.env.dev.local',
    sections: [
      {
        title: 'Dev project',
        keys: ['DEV_PROJECT_REF', 'DEV_SUPABASE_URL', 'DEV_SERVICE_ROLE_KEY', 'PROD_PROJECT_REF'],
      },
      { title: 'Scripts', keys: ['DEV_DB_URL'] },
      ...EDGE_SECTIONS.filter((s) => s.title !== 'Scripts'),
    ],
    denylist: EDGE_DENYLIST,
  },
  'supabase/.env.management.local': {
    path: 'supabase/.env.management.local',
    sections: SCRIPT_SECTIONS,
  },
  'supabase/.env.prod.local': {
    path: 'supabase/.env.prod.local',
    sections: [
      {
        title: 'Hosted project',
        keys: ['MT_PROD_PROJECT_REF', 'TARGET_DB_REF', 'TARGET_DB_PASSWORD'],
      },
    ],
  },
  'supabase/.env.production': {
    path: 'supabase/.env.production',
    sections: EDGE_SECTIONS.filter((s) => s.title !== 'Scripts'),
    denylist: EDGE_DENYLIST,
  },
};
