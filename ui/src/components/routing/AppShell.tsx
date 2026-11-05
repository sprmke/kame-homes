import { UnsavedChangesProvider } from '@/components/forms/UnsavedChangesProvider';
import { ScrollToTop } from '@/components/navigation/ScrollToTop';
import { ThemedToaster } from '@/components/theme/ThemedToaster';
import { PostHogIdentitySync } from '@/lib/posthog/PostHogIdentitySync';
import { SentryIdentitySync } from '@/lib/sentry/SentryIdentitySync';
import { SentrySurfaceSync } from '@/lib/sentry/SentrySurfaceSync';

import App from '@/App';

/** Root route element: everything that needs router context lives under here. */
export function AppShell() {
  return (
    <UnsavedChangesProvider>
      <ScrollToTop />
      <PostHogIdentitySync />
      <SentryIdentitySync />
      <SentrySurfaceSync />
      <App />
      <ThemedToaster />
    </UnsavedChangesProvider>
  );
}
