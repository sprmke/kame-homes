/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  /** VAPID public key for Web Push subscriptions (Phase 3). Base64url. */
  readonly VITE_VAPID_PUBLIC_KEY?: string;
  /** Cloudflare Turnstile site key for anti-spam CAPTCHA. Unset → widget disabled. */
  readonly VITE_TURNSTILE_SITE_KEY?: string;
  /** Opt into the service worker under `vite` serve (fights HMR — off by default). */
  readonly VITE_PWA_DEV?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

/** Injected by vite.config.ts `define` — monotonic build id (epoch seconds). */
declare const __PWA_BUILD_ID__: string;
