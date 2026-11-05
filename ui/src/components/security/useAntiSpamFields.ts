import { createElement, useCallback, useMemo, useRef, type ReactNode } from 'react';

import { FORM_LOADED_AT_FIELD, HONEYPOT_FIELD, type AntiSpamPayload } from './antiSpamFields';

export type AntiSpamController = {
  /** Render once inside the form — a visually-hidden decoy input. */
  field: ReactNode;
  /** Snapshot of `{ contact_time, formLoadedAt }` to merge into the submit payload. */
  getFields: () => AntiSpamPayload;
};

/**
 * Invisible bot filters for a public form: a honeypot decoy + a mount timestamp.
 * Plan: docs/workflow/in-progress/production-readiness/audits/captcha-anti-spam-hardening.md (Phase 1, Layer 0)
 *
 * Usage:
 *   const antiSpam = useAntiSpamFields();
 *   // JSX: {antiSpam.field}
 *   // submit: Object.assign(payload, antiSpam.getFields())
 *   //     or: appendAntiSpamFields(formData, antiSpam.getFields())
 */
export function useAntiSpamFields(): AntiSpamController {
  const honeypotRef = useRef<HTMLInputElement | null>(null);
  // Stamp once, when the form first mounts.
  const loadedAt = useRef<number>(Date.now());

  const getFields = useCallback(
    (): AntiSpamPayload => ({
      [HONEYPOT_FIELD]: honeypotRef.current?.value ?? '',
      [FORM_LOADED_AT_FIELD]: String(loadedAt.current),
    }),
    []
  );

  const field = useMemo(
    () =>
      createElement('input', {
        ref: honeypotRef,
        type: 'text',
        name: HONEYPOT_FIELD,
        tabIndex: -1,
        autoComplete: 'off',
        'aria-hidden': true,
        // Off-screen rather than display:none — some bots skip non-rendered inputs.
        style: {
          position: 'absolute',
          width: '1px',
          height: '1px',
          padding: 0,
          margin: '-1px',
          overflow: 'hidden',
          clip: 'rect(0 0 0 0)',
          whiteSpace: 'nowrap',
          border: 0,
        },
        defaultValue: '',
      }),
    []
  );

  return { field, getFields };
}
