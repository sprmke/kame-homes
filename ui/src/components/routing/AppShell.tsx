import { UnsavedChangesProvider } from '@/components/forms/UnsavedChangesProvider';
import { ScrollToTop } from '@/components/navigation/ScrollToTop';
import { ThemedToaster } from '@/components/theme/ThemedToaster';
import { PostHogIdentitySync } from '@/lib/posthog/PostHogIdentitySync';

import App from '@/App';

/** Root route element: everything that needs router context lives under here. */
export function AppShell() {
  return (
    <UnsavedChangesProvider>
      <ScrollToTop />
      <PostHogIdentitySync />
      <App />
      <ThemedToaster />
    </UnsavedChangesProvider>
  );
}
