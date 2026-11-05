import { createElement, Fragment, useCallback, type ReactNode } from 'react';

import {
  FORM_LOADED_AT_FIELD,
  HONEYPOT_FIELD,
  appendAntiSpamToFormData,
  withAntiSpam,
  type AntiSpamRequestFields,
} from '@/lib/security/antiSpamRequest';

import { useAntiSpamFields } from './useAntiSpamFields';
import { useCaptchaToken } from './useCaptchaToken';

export type { AntiSpamRequestFields } from '@/lib/security/antiSpamRequest';

export type AntiSpamSubmitController = {
  /** Render once inside the form, near the submit button. Includes the (invisible) widget + honeypot. */
  render: ReactNode;
  /** True when no CAPTCHA token is pending (Turnstile solved or not configured). */
  ready: boolean;
  /**
   * Resolve the anti-spam payload for a submit: waits for a CAPTCHA token (up to
   * `timeoutMs`, default 15s) then snapshots the honeypot + timing fields.
   */
  collect: (timeoutMs?: number) => Promise<AntiSpamRequestFields>;
  /** Merge the payload into a JSON body object. */
  applyToBody: <T extends object>(
    body: T,
    fields: AntiSpamRequestFields
  ) => T & Partial<AntiSpamRequestFields>;
  /** Append the payload to a FormData body. */
  applyToFormData: (form: FormData, fields: AntiSpamRequestFields) => void;
  /** Clear the held token and re-arm the widget. Call after every submit attempt. */
  reset: () => void;
};

/**
 * One hook that wires both invisible anti-spam layers into a public form:
 * a Cloudflare Turnstile widget (invisible-first) + a honeypot/timing field.
 * Plan: docs/workflow/in-progress/production-readiness/audits/captcha-anti-spam-hardening.md (Phase 3 / Phase 5)
 *
 * Usage:
 *   const antiSpam = useAntiSpamSubmit({ action: 'submit-form' });
 *   // JSX: {antiSpam.render}
 *   // submit:
 *   const fields = await antiSpam.collect();
 *   antiSpam.applyToFormData(formData, fields);   // or applyToBody(body, fields)
 *   // …fetch…
 *   antiSpam.reset();
 */
export function useAntiSpamSubmit({
  action,
  className,
}: {
  action: string;
  className?: string;
}): AntiSpamSubmitController {
  const captcha = useCaptchaToken({ action, className });
  const heuristics = useAntiSpamFields();

  const collect = useCallback(
    async (timeoutMs?: number): Promise<AntiSpamRequestFields> => {
      const captchaToken = await captcha.ensureToken(timeoutMs);
      const hp = heuristics.getFields();
      return {
        captchaToken,
        [HONEYPOT_FIELD]: hp[HONEYPOT_FIELD],
        [FORM_LOADED_AT_FIELD]: hp[FORM_LOADED_AT_FIELD],
      };
    },
    [captcha, heuristics]
  );

  const applyToBody = useCallback(
    <T extends object>(body: T, fields: AntiSpamRequestFields) => withAntiSpam(body, fields),
    []
  );

  const applyToFormData = useCallback(
    (form: FormData, fields: AntiSpamRequestFields) => appendAntiSpamToFormData(form, fields),
    []
  );

  const render = createElement(Fragment, null, heuristics.field, captcha.widget);

  return {
    render,
    ready: captcha.ready,
    collect,
    applyToBody,
    applyToFormData,
    reset: captcha.reset,
  };
}
