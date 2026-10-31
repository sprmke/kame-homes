import React from 'react';

import ReactDOM from 'react-dom/client';

import { createBrowserRouter, RouterProvider } from 'react-router-dom';

import { PostHogProvider } from '@posthog/react';

import { AppErrorBoundary } from '@/components/error/AppErrorBoundary';
import { RouteErrorFallback } from '@/components/error/RouteErrorFallback';
import { AppShell } from '@/components/routing/AppShell';
import { bootstrapPostHogTelemetry } from '@/lib/posthog/bootstrapTelemetry';
import { posthog } from '@/lib/posthog/client';

import { ThemeProvider } from './components/theme/ThemeProvider';
import '@/lib/pwa/installPrompt'; // capture beforeinstallprompt early
import 'react-day-picker/dist/style.css';
import './index.css';

bootstrapPostHogTelemetry();

/**
 * Data router (not `<BrowserRouter>`) so `useBlocker` works for the global
 * unsaved-changes guard. One splat route keeps `<Routes>` in `AppRoutes` as-is.
 * `errorElement` is required: createBrowserRouter catches route render errors
 * itself and does not bubble them to the outer `AppErrorBoundary`.
 */
const router = createBrowserRouter([
  { path: '*', element: <AppShell />, errorElement: <RouteErrorFallback /> },
]);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AppErrorBoundary>
      <PostHogProvider client={posthog}>
        <ThemeProvider>
          <RouterProvider router={router} />
        </ThemeProvider>
      </PostHogProvider>
    </AppErrorBoundary>
  </React.StrictMode>
);
