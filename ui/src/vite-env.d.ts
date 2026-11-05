/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  /** VAPID public key for Web Push subscriptions (Phase 3). Base64url. */
  readonly VITE_VAPID_PUBLIC_KEY?: string;
  /** Cloudflare Turnstile site key for anti-spam CAPTCHA. Unset → widget disabled. */
  readonly VITE_TURNSTILE_SITE_KEY?: string;
  /**
   * Deploy id (git SHA), injected by `vite.config.ts` `define` from
   * `vite-plugins/releaseId.ts`. Sentry release name and PostHog `app_release`.
   */
  readonly VITE_APP_VERSION?: string;
  /** Opt into the service worker under `vite` serve (fights HMR — off by default). */
  readonly VITE_PWA_DEV?: string;
  /** Released build id (`resolveReleaseId`), shown in Help & Support. */
  readonly VITE_APP_VERSION?: string;
  /** Canonical app origin, e.g. `https://kamespace.com` (legacy-origin notice). */
  readonly VITE_CANONICAL_APP_ORIGIN?: string;
  /** Comma-separated hostnames whose installed apps must move to the canonical origin. */
  readonly VITE_LEGACY_APP_HOSTS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

/** Injected by vite.config.ts `define` — monotonic build id (epoch seconds). */
declare const __PWA_BUILD_ID__: string;
