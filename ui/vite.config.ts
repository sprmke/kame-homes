import { createRequire } from 'module';
import path from 'path';
import { fileURLToPath } from 'url';

import posthogRollupPlugin, { type PostHogRollupPluginOptions } from '@posthog/rollup-plugin';
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

const require = createRequire(import.meta.url);
/** Shared with scripts/pwa/check-precache-budget.mjs — edit the JSON, not here. */
const precacheGlobs = require('../scripts/pwa/precache-globs.json') as {
  globPatterns: string[];
  globIgnores: string[];
  budgetKiB: number;
};

import {
  buildScopedPolotnoBlueprintCss,
  isBlueprintSourceStylesheet,
  isPolotnoBlueprintEntry,
  POLOTNO_BLUEPRINT_ENTRY,
  scopeBlueprintCss,
} from './postcss.config.js';
import {
  patchOpenPolotnoHighlighter,
  openPolotnoHighlighterEsbuildPlugin,
} from './vite-plugins/patchOpenPolotnoHighlighter';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const reactRoot = path.resolve(__dirname, '../node_modules/react');
const reactDomRoot = path.resolve(__dirname, '../node_modules/react-dom');
const blueprintCoreRoot = path.resolve(__dirname, '../node_modules/@blueprintjs/core');
const blueprintIconsRoot = path.resolve(__dirname, '../node_modules/@blueprintjs/icons');
const reactPopperRoot = path.resolve(__dirname, '../node_modules/react-popper');
const popperCoreRoot = path.resolve(__dirname, '../node_modules/@popperjs/core');
const useSyncExternalStoreShimRoot = path.resolve(
  __dirname,
  './src/lib/shims/use-sync-external-store/shim'
);
const classnamesShim = path.resolve(__dirname, './src/lib/shims/classnames.ts');

// Build-time only (Node context, never bundled into client code) — set these in
// CI/Vercel to enable readable production stack traces in PostHog. Requires a
// *personal* API key (error tracking write scope) — deliberately not named
// POSTHOG_API_KEY, which is a different (project) key used by the edge runtime.
// See docs/architecture/validation-and-env.md §11.1.
const posthogSourceMapsEnabled = Boolean(
  process.env.POSTHOG_PERSONAL_API_KEY && process.env.POSTHOG_PROJECT_ID
);

/**
 * `@posthog/rollup-plugin`'s `writeBundle` hook shells out to `posthog-cli sourcemap upload`
 * and rejects the whole build on any non-zero exit (bad/expired personal API key, network
 * blip, PostHog outage, rate limit) — see `spawnLocal` in `@posthog/plugin-utils`. That hook
 * runs *after* Rollup has already written the real JS/CSS bundle to disk, so a failed upload
 * has nothing left to roll back; the only loss is readable stack traces for this release.
 * Losing that must never block a production deploy (including an urgent hotfix), so this
 * wraps the hook to warn-and-continue instead of throwing.
 */
function resilientPosthogSourcemapsPlugin(options: PostHogRollupPluginOptions): Plugin {
  const plugin = posthogRollupPlugin(options);
  const writeBundle = plugin.writeBundle;

  if (writeBundle && typeof writeBundle === 'object' && 'handler' in writeBundle) {
    const originalHandler = writeBundle.handler.bind(writeBundle);
    writeBundle.handler = async (...args: Parameters<typeof originalHandler>) => {
      try {
        await originalHandler(...args);
      } catch (error) {
        console.warn(
          '[posthog-rollup-plugin] source map upload failed; continuing build without readable production stack traces for this release.',
          error
        );
      }
    };
  }

  return plugin;
}

let scopedPolotnoBlueprintCache: string | null = null;

async function getScopedPolotnoBlueprintCss() {
  if (!scopedPolotnoBlueprintCache) {
    scopedPolotnoBlueprintCache = await buildScopedPolotnoBlueprintCss();
  }
  return scopedPolotnoBlueprintCache;
}

/**
 * Vite resolves @import before PostCSS can inline + scope Blueprint.
 * Provide fully scoped CSS from the entry file and block raw Blueprint sources.
 */
function scopeBlueprintCssPlugin(): Plugin {
  return {
    name: 'scope-blueprint-css',
    enforce: 'pre',
    async load(id) {
      const normalized = id.replace(/\\/g, '/');
      if (normalized.split('?')[0] === POLOTNO_BLUEPRINT_ENTRY.replace(/\\/g, '/')) {
        return await getScopedPolotnoBlueprintCss();
      }
      return null;
    },
    async transform(code, id) {
      if (!id.endsWith('.css')) return null;

      if (isPolotnoBlueprintEntry(id)) {
        return {
          code: await getScopedPolotnoBlueprintCss(),
          map: null,
        };
      }

      if (isBlueprintSourceStylesheet(id)) {
        return {
          code: await scopeBlueprintCss(code, id),
          map: null,
        };
      }

      return null;
    },
    configureServer(server) {
      server.watcher.on('change', (file) => {
        if (isPolotnoBlueprintEntry(file) || isBlueprintSourceStylesheet(file)) {
          scopedPolotnoBlueprintCache = null;
        }
      });
    },
  };
}

/**
 * PWA — installable shell + custom Workbox service worker (`src/pwa/sw.ts`).
 *
 * `injectManifest` (not `generateSW`): the SW hand-rolls push / notificationclick /
 * background-sync / kill-switch handlers `generateSW` can't express. See
 * docs/architecture/pwa.md.
 *
 * Precache = app shell + entry chunks only. The heavy feature-lazy chunks
 * (Polotno studio, mediabunny audio encoders, html2canvas) are excluded here and
 * runtime-cached on demand instead — keeps the install payload bounded.
 */
function gfmPwaPlugin(): Plugin[] {
  return VitePWA({
    strategies: 'injectManifest',
    srcDir: 'src/pwa',
    filename: 'sw.ts',
    registerType: 'prompt',
    // Registration is owned by `@/lib/pwa/useRegisterSW` (workbox-window) — not
    // `virtual:pwa-register/*`, which breaks under a stale Vite process.
    injectRegister: false,
    // SW off in `vite` dev so it never fights HMR. Test the SW with
    // `bun run build && bun run preview`. Flip VITE_PWA_DEV=true to opt in locally.
    devOptions: {
      enabled: process.env.VITE_PWA_DEV === 'true',
      type: 'module',
      navigateFallback: 'index.html',
    },
    injectManifest: {
      globPatterns: precacheGlobs.globPatterns,
      // Feature-lazy heavy chunks — runtime-cached on demand, never precached.
      globIgnores: precacheGlobs.globIgnores,
      // The app's main entry chunk is large; allow it past the 2 MB default.
      // `scripts/pwa/check-precache-budget.mjs` guards the total in CI.
      maximumFileSizeToCacheInBytes: 12 * 1024 * 1024,
    },
    manifest: {
      id: '/?app',
      name: 'Kame Homes',
      short_name: 'Kame Homes',
      description:
        'Manage bookings, guest messages, pricing and your property operations from one place.',
      lang: 'en',
      dir: 'ltr',
      scope: '/',
      start_url: '/?source=pwa',
      display: 'standalone',
      display_override: ['standalone', 'minimal-ui'],
      orientation: 'portrait',
      theme_color: '#f5f6f8',
      background_color: '#f5f6f8',
      categories: ['business', 'productivity'],
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
      ],
      shortcuts: [
        {
          name: 'Bookings',
          short_name: 'Bookings',
          url: '/?source=pwa&shortcut=bookings',
          icons: [{ src: '/icons/pwa-192.png', sizes: '192x192' }],
        },
        {
          name: 'Guest Inbox',
          short_name: 'Inbox',
          url: '/?source=pwa&shortcut=inbox',
          icons: [{ src: '/icons/pwa-192.png', sizes: '192x192' }],
        },
        {
          name: "Today's check-ins",
          short_name: 'Check-ins',
          url: '/?source=pwa&shortcut=checkins',
          icons: [{ src: '/icons/pwa-192.png', sizes: '192x192' }],
        },
      ],
    },
  }) as Plugin[];
}

/** Monotonic build id (epoch seconds) — the PWA kill-switch compares against it. */
const pwaBuildId = String(Math.floor(Date.now() / 1000));

const posthogReleaseName =
  process.env.VERCEL_GIT_COMMIT_SHA?.trim() ||
  process.env.GITHUB_SHA?.trim() ||
  `guest-form-management-ui@${pwaBuildId}`;

export default defineConfig({
  define: {
    __PWA_BUILD_ID__: JSON.stringify(pwaBuildId),
  },
  // Strip dev-only code from production output (production-readiness doc 02,
  // Phase 2.2). Deliberately does NOT drop console.log/warn/error — those are
  // the only record of a swallowed error in a catch block, and PostHog's
  // exception capture goes through window.onerror / the React error boundary,
  // not by intercepting console output, so dropping them would cost real
  // debuggability for no correctness or bundle-size benefit.
  esbuild: {
    drop: ['debugger'],
    pure: ['console.debug'],
    // NOT setting `legalComments: 'external'` here even though vendor license
    // banners add real bytes (lucide-react alone ships ~280 of them): tested
    // against this Vite 4 + Rollup esbuild-minify pipeline and confirmed it
    // silently drops the comments entirely instead of writing the documented
    // `.LEGAL.txt` sidecar — a license-compliance regression, not a safe
    // bytes-saving win. Leave banners inline (esbuild's default) until a
    // config is found that actually externalizes them.
  },
  plugins: [
    patchOpenPolotnoHighlighter(),
    scopeBlueprintCssPlugin(),
    react(),
    ...gfmPwaPlugin(),
    ...(posthogSourceMapsEnabled
      ? [
          resilientPosthogSourcemapsPlugin({
            personalApiKey: process.env.POSTHOG_PERSONAL_API_KEY!,
            projectId: process.env.POSTHOG_PROJECT_ID!,
            host: process.env.POSTHOG_HOST,
            sourcemaps: {
              releaseName: posthogReleaseName,
              deleteAfterUpload: true,
            },
          }),
        ]
      : []),
  ],
  build: {
    // 'hidden' still generates + uploads maps but omits the sourceMappingURL
    // comment from shipped JS, so they aren't publicly fetchable.
    sourcemap: posthogSourceMapsEnabled ? 'hidden' : false,
    // Explicit (production-readiness doc 02, Phase 2.1) — these already match
    // Vite 4's defaults, but pinning them means a future debugging change
    // (e.g. `minify: false`) can never ship to production silently. esbuild
    // over lightningcss for CSS: no extra native-binary dependency for a
    // measured-marginal gain (see doc 02 §Phase 2.1).
    minify: 'esbuild',
    cssMinify: 'esbuild',
    rollupOptions: {
      output: {
        // Function form so the vendor-group matching below is exact
        // (`node_modules/<pkg>/`) instead of the substring match a static
        // object config would do. We deliberately do NOT add manualChunks
        // rules for first-party lazy-only code (e.g. the PDF export helpers
        // under ui/src/lib/pdf/) or for editor-only vendor libs
        // (konva/fabric/openpolotno/@blueprintjs) — those already ship
        // bundled *inside* their owning lazy chunk (PolotnoDesignStudio-*.js,
        // or Rollup's automatic shared-chunk splitting for exportPdf.ts).
        // Naming a chunk via manualChunks makes Vite treat it as commonly-
        // needed and add a `modulepreload` hint for it in index.html — i.e.
        // it gets *eagerly* fetched on every page load, which is the opposite
        // of what a lazy-only chunk needs (verified against a real build,
        // production-readiness doc 01 Phase 1.2 edge case). Automatic
        // chunking already gives these stable-enough dedup without that cost;
        // scripts/pwa/check-precache-budget.mjs's total-KiB budget is the
        // backstop against one silently growing unbounded.
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;

          const vendorGroups: Record<string, string[]> = {
            'react-vendor': ['react', 'react-dom', 'react-router-dom'],
            'query-vendor': [
              '@tanstack/query-async-storage-persister',
              '@tanstack/query-persist-client-core',
              '@tanstack/react-query',
              '@tanstack/react-query-persist-client',
            ],
            'supabase-vendor': ['@supabase/supabase-js'],
            'motion-vendor': ['framer-motion'],
            'icons-vendor': ['lucide-react'],
            'forms-vendor': ['@hookform/resolvers', 'react-hook-form', 'zod'],
            // No 'date-vendor' group: date-fns/dayjs/react-day-picker were
            // previously forced into their own chunk here, but that created a
            // real circular chunk dependency with react-vendor — dayjs is CJS,
            // and Rollup hoisted the shared CJS-interop helper it needed into
            // that date chunk, while react-vendor (via react-router-dom's own
            // CJS deps) also needs that same helper and imported it back from
            // date-vendor. date-vendor separately statically imports React
            // bindings from react-vendor for react-day-picker's hooks. Whichever
            // chunk executed first therefore saw the other's still-uninitialized
            // export as `undefined`, crashing the entire app on every route with
            // "Cannot read properties of undefined (reading 'createContext')" —
            // verified in a real browser against a production build. Removing
            // the explicit group lets Rollup's automatic chunking place these
            // packages without forcing a cross-chunk cycle; the total-KiB
            // precache budget (scripts/pwa/check-precache-budget.mjs) is the
            // backstop against any one of them growing unbounded.
            'observability-vendor': ['@posthog/react', 'posthog-js'],
            'ui-vendor': [
              'class-variance-authority',
              'clsx',
              'cmdk',
              'embla-carousel-react',
              'sonner',
              'tailwind-merge',
            ],
            'radix-vendor': [
              '@radix-ui/react-alert-dialog',
              '@radix-ui/react-avatar',
              '@radix-ui/react-checkbox',
              '@radix-ui/react-collapsible',
              '@radix-ui/react-dialog',
              '@radix-ui/react-dropdown-menu',
              '@radix-ui/react-label',
              '@radix-ui/react-popover',
              '@radix-ui/react-progress',
              '@radix-ui/react-radio-group',
              '@radix-ui/react-scroll-area',
              '@radix-ui/react-select',
              '@radix-ui/react-separator',
              '@radix-ui/react-slot',
              '@radix-ui/react-tabs',
              '@radix-ui/react-tooltip',
            ],
          };

          for (const [chunkName, packages] of Object.entries(vendorGroups)) {
            for (const pkg of packages) {
              // Match `node_modules/<pkg>/` exactly — a plain substring test
              // would wrongly match e.g. `date-fns` against a hypothetical
              // `date-fns-tz` package.
              if (id.includes(`node_modules/${pkg}/`) || id.includes(`node_modules/${pkg}\\`)) {
                return chunkName;
              }
            }
          }
          return undefined;
        },
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      react: reactRoot,
      'react-dom': reactDomRoot,
      'react/jsx-runtime': path.join(reactRoot, 'jsx-runtime.js'),
      'react/jsx-dev-runtime': path.join(reactRoot, 'jsx-dev-runtime.js'),
      '@blueprintjs/core': blueprintCoreRoot,
      '@blueprintjs/icons': blueprintIconsRoot,
      '@blueprintjs/select': path.resolve(__dirname, '../node_modules/@blueprintjs/select'),
      'react-popper': reactPopperRoot,
      '@popperjs/core': popperCoreRoot,
      classnames: classnamesShim,
      'use-sync-external-store/shim/index.js': path.join(useSyncExternalStoreShimRoot, 'index.ts'),
      'use-sync-external-store/shim/with-selector.js': path.join(
        useSyncExternalStoreShimRoot,
        'withSelector.ts'
      ),
      'use-sync-external-store/shim/with-selector': path.join(
        useSyncExternalStoreShimRoot,
        'withSelector.ts'
      ),
      'use-sync-external-store/shim': path.join(useSyncExternalStoreShimRoot, 'index.ts'),
    },
    dedupe: [
      'react',
      'react-dom',
      'react-konva',
      'konva',
      '@blueprintjs/core',
      '@blueprintjs/icons',
      '@blueprintjs/select',
      'react-popper',
      '@popperjs/core',
      'classnames',
      'use-sync-external-store',
    ],
  },
  css: {
    postcss: './postcss.config.js',
  },
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react/jsx-runtime',
      'react/jsx-dev-runtime',
      'openpolotno',
      '@blueprintjs/core',
      '@blueprintjs/icons',
      '@blueprintjs/select',
      'react-popper',
      '@popperjs/core',
      'classnames',
      'mobx',
      'mobx-react-lite',
      'mobx-state-tree',
      'konva',
      'react-konva',
      'react-konva-utils',
      'use-image',
      'swr',
      '@tiptap/react',
      // Remotion transition subpaths — keep in sync with VideoCompositions imports
      // so Vite does not fail on stale optimize cache after @remotion/transitions upgrades.
      '@remotion/transitions',
      '@remotion/transitions/clock-wipe',
      '@remotion/transitions/dissolve',
      '@remotion/transitions/fade',
      '@remotion/transitions/flip',
      '@remotion/transitions/push-cut',
      '@remotion/transitions/slide',
      '@remotion/transitions/wipe',
      '@remotion/transitions/zoom-in-out',
      '@remotion/player',
      'remotion',
      // Building Forms / verification PDF preview — keep prebundled so Vite does not serve a
      // stale missing `.vite/deps/pdfjs-dist.js` from a prior dynamic import.
      'pdfjs-dist',
    ],
    esbuildOptions: {
      plugins: [openPolotnoHighlighterEsbuildPlugin()],
      alias: {
        react: reactRoot,
        'react-dom': reactDomRoot,
        classnames: classnamesShim,
      },
    },
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
});
