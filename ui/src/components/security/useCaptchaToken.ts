import { createElement, useCallback, useRef, useState, type ReactNode } from 'react';

import { isTurnstileConfigured } from './turnstileLoader';
import { TurnstileWidget, type TurnstileWidgetHandle } from './TurnstileWidget';

type Options = {
  /** Logical form name; forwarded to Turnstile as `action` and verified server-side. */
  action: string;
  className?: string;
};

export type CaptchaController = {
  /** Render this once inside the form (near the submit button). */
  widget: ReactNode;
  /** True when a token is in hand OR Turnstile is not configured (submit need not wait). */
  ready: boolean;
  /** Latest token without waiting. '' when none / not configured. */
  getToken: () => string;
  /**
   * Resolve a token for a submit. Returns immediately if one is already held or
   * Turnstile is unconfigured; otherwise nudges the widget and waits up to
   * `timeoutMs` (default 15s — enough for a human to solve a shown challenge),
   * then resolves '' so the caller still submits and lets the server decide.
   */
  ensureToken: (timeoutMs?: number) => Promise<string>;
  /** Clear the held token and re-arm the widget. Call after every submit attempt. */
  reset: () => void;
};

/**
 * Attaches an invisible-first Turnstile widget to a form.
 * Plan: docs/workflow/in-progress/production-readiness/audits/captcha-anti-spam-hardening.md (Phase 1)
 *
 * Usage:
 *   const captcha = useCaptchaToken({ action: 'submit-form' });
 *   // in JSX: {captcha.widget}
 *   // on submit:
 *   const token = await captcha.ensureToken();
 *   formData.append('captchaToken', token);
 *   // in the catch / finally: captcha.reset();
 */
export function useCaptchaToken({ action, className }: Options): CaptchaController {
  const widgetRef = useRef<TurnstileWidgetHandle | null>(null);
  const tokenRef = useRef<string>('');
  const waitersRef = useRef<Array<(token: string) => void>>([]);
  const [ready, setReady] = useState<boolean>(() => !isTurnstileConfigured());

  const handleVerify = useCallback((token: string) => {
    tokenRef.current = token;
    setReady(token.length > 0 || !isTurnstileConfigured());
    if (token) {
      const waiters = waitersRef.current;
      waitersRef.current = [];
      waiters.forEach((resolve) => resolve(token));
    }
  }, []);

  const reset = useCallback(() => {
    tokenRef.current = '';
    setReady(!isTurnstileConfigured());
    widgetRef.current?.reset();
  }, []);

  const getToken = useCallback(() => tokenRef.current, []);

  const ensureToken = useCallback((timeoutMs = 15_000): Promise<string> => {
    if (!isTurnstileConfigured()) return Promise.resolve('');
    if (tokenRef.current) return Promise.resolve(tokenRef.current);

    widgetRef.current?.execute();

    return new Promise<string>((resolve) => {
      let settled = false;
      const done = (token: string) => {
        if (settled) return;
        settled = true;
        resolve(token);
      };
      waitersRef.current.push(done);
      window.setTimeout(() => {
        // Drop this waiter and resolve with whatever we have.
        waitersRef.current = waitersRef.current.filter((w) => w !== done);
        done(tokenRef.current);
      }, timeoutMs);
    });
  }, []);

  const widget = createElement(TurnstileWidget, {
    ref: widgetRef,
    action,
    className,
    onVerify: handleVerify,
    onExpire: () => {
      tokenRef.current = '';
      setReady(!isTurnstileConfigured());
    },
  });

  return { widget, ready, getToken, ensureToken, reset };
}
