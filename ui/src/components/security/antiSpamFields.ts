/**
 * Client mirror of `supabase/functions/_shared/botHeuristics.ts`.
 * Plan: docs/workflow/in-progress/production-readiness/audits/captcha-anti-spam-hardening.md (Phase 1, Layer 0)
 *
 * Keep the field names in sync with the server helper.
 */

export const HONEYPOT_FIELD = 'contact_time';
export const FORM_LOADED_AT_FIELD = 'formLoadedAt';

export type AntiSpamPayload = {
  [HONEYPOT_FIELD]: string;
  [FORM_LOADED_AT_FIELD]: string;
};

/** Append the honeypot + timing fields to a FormData body. */
export function appendAntiSpamFields(form: FormData, fields: AntiSpamPayload): void {
  form.set(HONEYPOT_FIELD, fields[HONEYPOT_FIELD]);
  form.set(FORM_LOADED_AT_FIELD, fields[FORM_LOADED_AT_FIELD]);
}
