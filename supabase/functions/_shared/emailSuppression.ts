/**
 * Resend bounce/complaint suppression list (doc 25 Phase 25.4/25.5).
 *
 * `approval-email-webhook` records `email.bounced`/`email.complained` events here.
 * Guest-facing send paths in `emailService.ts` check `isEmailSuppressed` first and
 * skip the send rather than repeatedly mailing a dead/complaining address, which
 * would otherwise harm Resend domain reputation for every subsequent send.
 */

import { createClient } from './supabaseJs.ts';

function supabaseAdmin() {
  return createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export type EmailSuppressionReason = 'bounced' | 'complained';

/** Upsert an address into the suppression list. Called from the Resend webhook. */
export async function recordEmailSuppression(params: {
  email: string;
  reason: EmailSuppressionReason;
  eventType: string;
  messageId?: string;
  detail?: string;
}): Promise<void> {
  const email = normalizeEmail(params.email);
  if (!email) return;

  const { error } = await supabaseAdmin()
    .from('email_suppressions')
    .upsert(
      {
        email,
        reason: params.reason,
        event_type: params.eventType,
        message_id: params.messageId ?? null,
        detail: params.detail ?? null,
        suppressed_at: new Date().toISOString(),
      },
      { onConflict: 'email' }
    );
  if (error) {
    console.error('[emailSuppression] Failed to record suppression:', error.message);
  }
}

/** Returns true when the address has an active bounce/complaint suppression. */
export async function isEmailSuppressed(email: string | null | undefined): Promise<boolean> {
  const normalized = normalizeEmail(email ?? '');
  if (!normalized) return false;

  const { data, error } = await supabaseAdmin()
    .from('email_suppressions')
    .select('email')
    .eq('email', normalized)
    .maybeSingle();

  if (error) {
    console.error('[emailSuppression] Suppression lookup failed (fail-open):', error.message);
    return false;
  }
  return !!data;
}
