import { formatDistanceToNowStrict } from 'date-fns';

import type { ActivityChange } from '@/features/dashboard/activity/lib/activityCatalog';

/** "3 min ago" style — for the row timestamp. */
export function activityRelativeTime(iso: string): string {
  try {
    return `${formatDistanceToNowStrict(new Date(iso))} ago`;
  } catch {
    return iso;
  }
}

/** Absolute Asia/Manila timestamp — for the tooltip / detail sheet. */
export function activityAbsoluteTime(iso: string): string {
  try {
    return new Intl.DateTimeFormat('en-PH', {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: 'Asia/Manila',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

/**
 * Short action phrase for detail chrome — verb only, not "Billing · Plan Downgraded".
 * Prefer the category label in the UI; this is a fallback.
 */
export function humanizeAction(action: string): string {
  const verb = action.split('.').slice(1).join('.').replace(/_/g, ' ').trim();
  if (!verb) return action.replace(/[._]/g, ' ');
  return verb.replace(/\b\w/g, (c) => c.toUpperCase());
}

const UUID_IN_TEXT = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi;
const UUID_ONLY = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Truncated UUIDs we may have shown earlier (`277610f1…`). */
const TRUNCATED_ID = /\b[0-9a-f]{8}…/gi;

function looksLikeUuid(value: string): boolean {
  return UUID_ONLY.test(value);
}

function planLabelFromMetadata(metadata?: Record<string, unknown> | null): string | null {
  if (!metadata) return null;
  for (const key of ['to_plan_name', 'from_plan_name', 'plan_name', 'plan'] as const) {
    const value = metadata[key];
    if (typeof value === 'string' && value.trim() && !looksLikeUuid(value)) {
      return value.trim();
    }
  }
  return null;
}

function planFallbackLabel(summary: string): string {
  const lower = summary.toLowerCase();
  if (lower.includes('downgrad')) return 'a lower plan';
  if (lower.includes('upgrad')) return 'a higher plan';
  return 'another plan';
}

/**
 * Host-facing summary: never show plan UUIDs or truncated hashes.
 * Prefer `to_plan_name` / similar metadata; otherwise a plain fallback phrase.
 */
export function friendlyActivitySummary(
  summary: string,
  metadata?: Record<string, unknown> | null
): string {
  if (!summary) return summary;
  const planLabel = planLabelFromMetadata(metadata);
  const fallback = planFallbackLabel(summary);
  let out = summary;
  if (UUID_IN_TEXT.test(out)) {
    UUID_IN_TEXT.lastIndex = 0;
    out = out.replace(UUID_IN_TEXT, planLabel ?? fallback);
  }
  UUID_IN_TEXT.lastIndex = 0;
  if (TRUNCATED_ID.test(out)) {
    TRUNCATED_ID.lastIndex = 0;
    out = out.replace(TRUNCATED_ID, planLabel ?? fallback);
  }
  TRUNCATED_ID.lastIndex = 0;
  return out.replace(/\s{2,}/g, ' ').trim();
}

/** Drop a leading actor token from the summary when the meta row already shows them. */
export function activitySummaryWithoutLeadingActor(
  summary: string,
  actor: string | null | undefined
): string {
  const name = actor?.trim();
  if (!name || !summary) return summary;
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const stripped = summary
    .replace(new RegExp(`^${escaped}\\s+`, 'i'), '')
    .replace(/^\s*[·•|-]\s*/, '')
    .trim();
  if (!stripped) return summary;
  return stripped.replace(/^\w/, (c) => c.toUpperCase());
}

export function formatChangeValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '-';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  const text = String(value);
  if (looksLikeUuid(text)) return '-';
  return text;
}

export function changeSummary(changes: ActivityChange[] | null): string {
  if (!changes?.length) return '';
  const names = changes.map((c) => c.field.replace(/_/g, ' '));
  return names.length <= 3
    ? names.join(', ')
    : `${names.slice(0, 3).join(', ')} +${names.length - 3} more`;
}

/** Title-case a role slug; null when empty. */
export function humanizeActorRole(role: string | null | undefined): string | null {
  const raw = role?.trim();
  if (!raw) return null;
  return raw.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Actor line for the detail sheet — avoids "Owner · owner".
 * Returns `{ primary, secondary }` where secondary is a single role label or null.
 */
export function formatActivityActorParts(input: {
  displayName?: string | null;
  email?: string | null;
  typeLabel: string;
  role?: string | null;
}): { primary: string; secondary: string | null } {
  const primary = input.displayName?.trim() || input.email?.trim() || input.typeLabel || 'Someone';
  const roleLabel = humanizeActorRole(input.role);
  if (!roleLabel) return { primary, secondary: input.typeLabel };
  if (roleLabel.toLowerCase() === input.typeLabel.toLowerCase()) {
    return { primary, secondary: input.typeLabel };
  }
  // Type already implied by role (e.g. Owner + org_owner)
  if (primary.toLowerCase() === input.typeLabel.toLowerCase()) {
    return { primary, secondary: roleLabel };
  }
  return { primary, secondary: roleLabel };
}

const SOURCE_LABELS: Record<string, string> = {
  dashboard: 'Dashboard',
  public_form: 'Public form',
  ai_assistant: 'AI assistant',
  cron: 'Scheduled job',
  webhook: 'Webhook',
  telegram: 'Telegram',
  email_inbound: 'Inbound email',
  db_trigger: 'System',
};

export function friendlySourceLabel(source: string): string {
  return SOURCE_LABELS[source] ?? source.replace(/_/g, ' ');
}

/** Compact browser/OS label from a user-agent — keep the Device field, drop the raw string. */
export function friendlyDeviceLabel(userAgent: string | null | undefined): string | null {
  const ua = userAgent?.trim();
  if (!ua) return null;

  let browser = 'Browser';
  if (/Edg\//i.test(ua)) browser = 'Edge';
  else if (/Chrome\//i.test(ua) && !/Chromium/i.test(ua)) browser = 'Chrome';
  else if (/Firefox\//i.test(ua)) browser = 'Firefox';
  else if (/Safari\//i.test(ua) && !/Chrome/i.test(ua)) browser = 'Safari';

  let os = '';
  if (/iPhone|iPad/i.test(ua)) os = 'iOS';
  else if (/Android/i.test(ua)) os = 'Android';
  else if (/Mac OS X/i.test(ua)) os = 'Mac';
  else if (/Windows/i.test(ua)) os = 'Windows';
  else if (/Linux/i.test(ua)) os = 'Linux';

  return os ? `${browser} on ${os}` : browser;
}

/** Metadata keys we never show hosts (internal refs / raw ids). */
const HIDDEN_METADATA_KEYS = new Set([
  'related_event_ref',
  'to_plan',
  'from_plan',
  'plan_id',
  'planId',
  'request_id',
  'conversation_id',
  'external_uid',
  'feed_id',
]);

const METADATA_LABELS: Record<string, string> = {
  to_plan_name: 'Plan',
  from_plan_name: 'Previous plan',
  plan_name: 'Plan',
  plan: 'Plan',
  property_count: 'Properties',
  override_price_php: 'Override price',
  amount: 'Amount',
  message: 'Note',
};

export type ActivityDetailFact = { label: string; value: string };

/** Host-facing metadata rows — no raw JSON, no internal table refs. */
export function friendlyMetadataFacts(
  metadata: Record<string, unknown> | null | undefined
): ActivityDetailFact[] {
  if (!metadata) return [];
  const facts: ActivityDetailFact[] = [];
  for (const [key, raw] of Object.entries(metadata)) {
    if (HIDDEN_METADATA_KEYS.has(key)) continue;
    if (raw === null || raw === undefined || raw === '') continue;
    if (typeof raw === 'object') continue;
    const text = String(raw).trim();
    if (!text || looksLikeUuid(text)) continue;
    const label =
      METADATA_LABELS[key] ?? key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
    facts.push({ label, value: text });
  }
  return facts;
}
