# Third-party origins (browser)

Inventory for CSP (doc 22) and defer-non-critical scripts (doc 04). First-party rewrites count as `'self'`.

| Origin / pattern                                                    | Used for                                                                                              | Load path                            |
| ------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | ------------------------------------ |
| `'self'`                                                            | Vite bundles, PWA, `/ingest` PostHog proxy (`ui/vercel.json`)                                         | Same origin                          |
| `https://fonts.googleapis.com`                                      | Brand font CSS (`ui/index.html` preload)                                                              | `<link>`                             |
| `https://fonts.gstatic.com`                                         | Font files                                                                                            | CSS + service worker cache           |
| `https://*.supabase.co`                                             | Auth, REST, Realtime, Storage public URLs                                                             | `VITE_SUPABASE_URL` (hosted project) |
| `wss://*.supabase.co`                                               | Realtime subscriptions                                                                                | Supabase client                      |
| `https://challenges.cloudflare.com`                                 | Turnstile widget script                                                                               | `turnstileLoader.ts`                 |
| `https://www.google.com` / `https://maps.google.com`                | Map embed iframes, directions links                                                                   | Property map components              |
| `https://maps.googleapis.com`                                       | Static map images (chat link cards)                                                                   | `ChatMapLinkCard.tsx`                |
| `https://maps.googleapis.com` / `https://maps.gstatic.com` (script) | Google Maps JS on listing pages                                                                       | `google-maps` loader                 |
| `https://us.i.posthog.com` / `https://us-assets.i.posthog.com`      | PostHog flags + lazy scripts (exception autocapture, web vitals) when the `/ingest` proxy is not used | `posthog-js`                         |
| `data:` (connect, media)                                            | Booking form image optimizer reads a `data:` URL; for-hosts film inline audio                         | `imageOptimization.ts`, tour film    |
| `https://www.openstreetmap.org`                                     | OSM embed fallback                                                                                    | `propertyMapEmbed.ts`                |
| `https://staticmap.openstreetmap.de`                                | Static map preview tiles                                                                              | `parseChatRichBlocks.ts`             |
| `https://generativelanguage.googleapis.com`                         | Voice receptionist WebSocket (when enabled)                                                           | `voiceReceptionistApi.ts`            |

Not loaded as third-party script tags in production UI: PayMongo (redirect/checkout), Meta OAuth (full redirect), Resend (server only).

CSP policy source: `ui/vercel.json` → `Content-Security-Policy-Report-Only`. No inline scripts or handlers: theme boot is `ui/public/theme-init.js`, font swap is `ui/public/async-styles.js`, guarded by `scripts/dev/check-csp-theme-hash.sh` (Vite rewrites inline script whitespace at build time, so a hash would drift). Enforced-policy check 2026-10-19 (Chromium, header injected on a local prod build): 0 own-origin violations on `/`, `/search`, `/properties`, listing, booking form, `/parkings`, `/for-hosts`, pricing, `/about`; only Cloudflare's challenge frame logs `data:` under its own policy. Enforcing CSP is doc 22 exit gate (after Report-Only violations are triaged).
