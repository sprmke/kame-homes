import posthog from 'posthog-js';

import { shouldAutocapture } from '@/lib/posthog/analyticsMode';
import {
  detectAnalyticsEnvironment,
  detectAppTrack,
  resolvePostHogApiHost,
} from '@/lib/posthog/env';

const apiKey = (import.meta.env.VITE_POSTHOG_KEY as string | undefined)?.trim();
const apiHost = resolvePostHogApiHost();
const supabaseFunctionsHost = (() => {
  const functionsUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  if (!functionsUrl) return undefined;

  try {
    return new URL(functionsUrl).hostname;
  } catch {
    return undefined;
  }
})();

export const isPostHogEnabled = Boolean(apiKey && apiHost);

const isProdBuild = import.meta.env.PROD;
const sessionReplayEnabled =
  (import.meta.env.VITE_POSTHOG_SESSION_REPLAY as string | undefined)?.trim().toLowerCase() ===
  'true';

if (isPostHogEnabled) {
  posthog.init(apiKey!, {
    api_host: apiHost,
    defaults: '2026-05-30',
    person_profiles: 'identified_only',
    persistence: 'localStorage+cookie',
    opt_out_capturing_by_default: false,
    autocapture: shouldAutocapture(),
    disable_session_recording: isProdBuild && !sessionReplayEnabled,
    session_recording: {
      maskAllInputs: true,
      maskTextSelector: '[data-ph-mask], input, textarea',
    },
    ...(supabaseFunctionsHost ? { tracing_headers: [supabaseFunctionsHost] } : {}),
    capture_exceptions: {
      capture_unhandled_errors: true,
      capture_unhandled_rejections: true,
      capture_console_errors: false,
    },
    loaded: (ph) => {
      ph.register({
        environment: detectAnalyticsEnvironment(),
        app_track: detectAppTrack(),
      });
    },
  });
}

// Singleton. Do not call posthog.init() elsewhere — import this module instead.
export { posthog };
