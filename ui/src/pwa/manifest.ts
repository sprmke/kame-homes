/**
 * Web app manifest, extracted from `vite.config.ts` so it can be snapshot-tested.
 *
 * Hard-won invariants (changing any of these silently breaks existing installs):
 *
 *  - `id` never changes. A new value is a *new app identity*: every current install
 *    is orphaned and the user has to add it again.
 *  - `start_url` is the launch resolver (`/app`), never `/`. Pointing it at the
 *    public marketplace is what made installed host apps open the guest landing
 *    page and made the manifest shortcuts dead (P0-1).
 *  - Shortcut URLs go through `/app?shortcut=…` for the same reason.
 *  - No `orientation`: locking portrait broke tablets, the calendar and editors.
 *  - Installability requires 192px, 512px, a maskable pair, plus `screenshots` for
 *    the rich install dialog.
 */

export type ManifestIcon = {
  src: string;
  sizes: string;
  type: string;
  purpose?: string;
};

export type ManifestScreenshot = {
  src: string;
  sizes: string;
  type: string;
  form_factor: 'narrow' | 'wide';
  label: string;
};

export type WebAppManifest = {
  id: string;
  name: string;
  short_name: string;
  description: string;
  lang: string;
  dir: 'ltr' | 'rtl';
  scope: string;
  start_url: string;
  display: string;
  display_override: string[];
  theme_color: string;
  background_color: string;
  categories: string[];
  launch_handler: { client_mode: string[] };
  icons: ManifestIcon[];
  screenshots: ManifestScreenshot[];
  shortcuts: Array<{
    name: string;
    short_name: string;
    description: string;
    url: string;
    icons: ManifestIcon[];
  }>;
};

export const LAUNCH_START_URL = '/app?source=pwa';

export function buildWebAppManifest(platformAppName: string): WebAppManifest {
  return {
    // NEVER change this value (see file header).
    id: '/?app',
    name: platformAppName,
    short_name: platformAppName,
    description:
      'Manage bookings, guest messages, pricing and your property operations from one place.',
    lang: 'en',
    dir: 'ltr',
    scope: '/',
    start_url: LAUNCH_START_URL,
    display: 'standalone',
    display_override: ['standalone', 'minimal-ui'],
    theme_color: '#f5f6f8',
    background_color: '#f5f6f8',
    categories: ['business', 'productivity', 'travel'],
    launch_handler: { client_mode: ['navigate-existing', 'auto'] },
    icons: [
      { src: '/icons/pwa-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      {
        src: '/icons/pwa-maskable-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/icons/pwa-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/icons/monochrome-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'monochrome',
      },
    ],
    screenshots: [
      {
        src: '/screenshots/pwa-bookings-narrow.png',
        sizes: '1080x1920',
        type: 'image/png',
        form_factor: 'narrow',
        label: 'Bookings and today\u2019s check-ins',
      },
      {
        src: '/screenshots/pwa-inbox-narrow.png',
        sizes: '1080x1920',
        type: 'image/png',
        form_factor: 'narrow',
        label: 'Guest messages in one inbox',
      },
      {
        src: '/screenshots/pwa-dashboard-narrow.png',
        sizes: '1080x1920',
        type: 'image/png',
        form_factor: 'narrow',
        label: 'Property overview',
      },
      {
        src: '/screenshots/pwa-dashboard-wide.png',
        sizes: '1920x1080',
        type: 'image/png',
        form_factor: 'wide',
        label: 'Property overview on desktop',
      },
    ],
    shortcuts: [
      {
        name: 'Bookings',
        short_name: 'Bookings',
        description: 'Open today\u2019s booking list',
        url: '/app?shortcut=bookings',
        icons: [{ src: '/icons/shortcut-bookings.png', sizes: '96x96', type: 'image/png' }],
      },
      {
        name: 'Guest Inbox',
        short_name: 'Inbox',
        description: 'Open guest messages',
        url: '/app?shortcut=inbox',
        icons: [{ src: '/icons/shortcut-inbox.png', sizes: '96x96', type: 'image/png' }],
      },
      {
        name: "Today's check-ins",
        short_name: 'Check-ins',
        description: 'Bookings arriving today',
        url: '/app?shortcut=checkins',
        icons: [{ src: '/icons/shortcut-checkins.png', sizes: '96x96', type: 'image/png' }],
      },
    ],
  };
}
