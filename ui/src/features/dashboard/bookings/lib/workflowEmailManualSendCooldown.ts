/**
 * Free-tier Automation Triggers resend cooldown — mirrors
 * `_shared/workflowEmailManualSendCooldown.ts`.
 */

import type { BookingWorkflowEmailKind } from '@/features/dashboard/bookings/lib/bookingWorkflowEmail';

export const WORKFLOW_EMAIL_MANUAL_RESEND_COOLDOWN_MS = 60 * 60 * 1000;

export type WorkflowEmailManualSentAtMap = Record<string, string>;

export function parseWorkflowEmailManualSentAt(raw: unknown): WorkflowEmailManualSentAtMap {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: WorkflowEmailManualSentAtMap = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof value === 'string' && value.trim()) out[key] = value.trim();
  }
  return out;
}

export function lastWorkflowEmailManualSentAt(
  map: WorkflowEmailManualSentAtMap,
  kind: BookingWorkflowEmailKind | 'sd_refund_form_request',
  sdRefundFormEmailedAt?: string | null
): string | null {
  const fromMap = map[kind];
  if (fromMap) return fromMap;
  if (kind === 'sd_refund_form_request') {
    const fallback = typeof sdRefundFormEmailedAt === 'string' ? sdRefundFormEmailedAt.trim() : '';
    return fallback || null;
  }
  return null;
}

export function workflowEmailManualCooldownRemainingMs(
  lastSentIso: string | null | undefined,
  nowMs = Date.now(),
  cooldownMs = WORKFLOW_EMAIL_MANUAL_RESEND_COOLDOWN_MS
): number {
  if (!lastSentIso) return 0;
  const sentMs = Date.parse(lastSentIso);
  if (!Number.isFinite(sentMs)) return 0;
  return Math.max(0, sentMs + cooldownMs - nowMs);
}

export function formatWorkflowEmailResendWait(remainingMs: number): string {
  const minutes = Math.max(1, Math.ceil(remainingMs / 60_000));
  if (minutes >= 60) {
    const hours = Math.ceil(minutes / 60);
    return hours === 1 ? 'You can resend in 1 hour' : `You can resend in ${hours} hours`;
  }
  return minutes === 1 ? 'You can resend in 1 minute' : `You can resend in ${minutes} minutes`;
}

export type WorkflowEmailManualSendUi = {
  /** Never sent on Free → Send; after first send → Resend. */
  labelPrefix: 'Send' | 'Resend';
  hasSent: boolean;
  inCooldown: boolean;
  remainingMs: number;
  cooldownReason: string | null;
};

export function resolveWorkflowEmailManualSendUi(
  kind: BookingWorkflowEmailKind,
  opts: {
    enforceCooldown: boolean;
    sentAtMap: unknown;
    sdRefundFormEmailedAt?: string | null;
    nowMs?: number;
    /** When cooldown is off (paid), force Resend wording (Check-out Instructions). */
    preferResendLabel?: boolean;
  }
): WorkflowEmailManualSendUi {
  const map = parseWorkflowEmailManualSentAt(opts.sentAtMap);
  const lastSent = lastWorkflowEmailManualSentAt(map, kind, opts.sdRefundFormEmailedAt);
  const hasSent = Boolean(lastSent);
  if (!opts.enforceCooldown) {
    return {
      labelPrefix: opts.preferResendLabel ? 'Resend' : 'Send',
      hasSent,
      inCooldown: false,
      remainingMs: 0,
      cooldownReason: null,
    };
  }
  const remainingMs = workflowEmailManualCooldownRemainingMs(lastSent, opts.nowMs);
  const inCooldown = remainingMs > 0;
  return {
    labelPrefix: hasSent ? 'Resend' : 'Send',
    hasSent,
    inCooldown,
    remainingMs,
    cooldownReason: inCooldown ? formatWorkflowEmailResendWait(remainingMs) : null,
  };
}
