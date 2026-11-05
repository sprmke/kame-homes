/**
 * Shared request-side shape for the invisible anti-spam layers.
 * Plan: docs/workflow/in-progress/production-readiness/audits/captcha-anti-spam-hardening.md (Phase 3)
 *
 * Field names mirror `supabase/functions/_shared/botHeuristics.ts` +
 * `_shared/captcha.ts` (`readCaptchaToken`). Kept in `lib/` (not the hook file)
 * so plain API helpers can depend on it without importing React.
 */

export const HONEYPOT_FIELD = 'contact_time';
export const FORM_LOADED_AT_FIELD = 'formLoadedAt';

export type AntiSpamRequestFields = {
  captchaToken: string;
  [HONEYPOT_FIELD]: string;
  [FORM_LOADED_AT_FIELD]: string;
};

/** Merge the anti-spam payload into a JSON request body (omits an empty token). */
export function withAntiSpam<T extends object>(
  body: T,
  fields?: Partial<AntiSpamRequestFields> | null
): T & Partial<AntiSpamRequestFields> {
  if (!fields) return body;
  const merged = { ...body } as T & Partial<AntiSpamRequestFields>;
  if (fields.captchaToken) merged.captchaToken = fields.captchaToken;
  if (fields[HONEYPOT_FIELD] !== undefined) merged[HONEYPOT_FIELD] = fields[HONEYPOT_FIELD];
  if (fields[FORM_LOADED_AT_FIELD] !== undefined) {
    merged[FORM_LOADED_AT_FIELD] = fields[FORM_LOADED_AT_FIELD];
  }
  return merged;
}

/** Append the anti-spam payload to a FormData body (omits an empty token). */
export function appendAntiSpamToFormData(
  form: FormData,
  fields?: Partial<AntiSpamRequestFields> | null
): void {
  if (!fields) return;
  if (fields.captchaToken) form.set('captchaToken', fields.captchaToken);
  if (fields[HONEYPOT_FIELD] !== undefined) form.set(HONEYPOT_FIELD, fields[HONEYPOT_FIELD]);
  if (fields[FORM_LOADED_AT_FIELD] !== undefined) {
    form.set(FORM_LOADED_AT_FIELD, fields[FORM_LOADED_AT_FIELD]);
  }
}
