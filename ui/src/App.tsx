import { Suspense } from 'react';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { GuestAuthProvider } from '@/features/guest/auth/context/GuestAuthContext';
import { GuestEmbedPreviewEffect } from '@/features/guest/components/GuestEmbedPreviewEffect';
import { SavedPropertiesSync } from '@/features/guest/marketing/properties/components/SavedPropertiesSync';
import { ModeSwitchTransitionProvider } from '@/features/guest/marketing/shared/context/ModeSwitchTransitionContext';

import { PlatformMaintenanceBanner } from '@/components/platform/PlatformMaintenanceBanner';
import { PwaProvider } from '@/components/pwa/PwaProvider';
import { PwaQueryPersistence } from '@/components/pwa/PwaQueryPersistence';
import { PageLoadingFallback } from '@/components/routing/RouteFallback';
import { TooltipProvider } from '@/components/ui/tooltip';


import { AppRoutes } from '@/routes';

// Conservative defaults: short stale time so admins see fresh data, but refetch on window focus
// is disabled to avoid hammering Supabase while an admin has multiple tabs open.
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 15_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <PwaQueryPersistence />
      <TooltipProvider delayDuration={200}>
        <GuestAuthProvider>
          {/* Global so the curtain survives AdminLayout ↔ MarketingLayoutShell remounts. */}
          <ModeSwitchTransitionProvider>
            <GuestEmbedPreviewEffect />
            <SavedPropertiesSync />
            <PwaProvider />
            <PlatformMaintenanceBanner />
            <Suspense fallback={<PageLoadingFallback />}>
              <AppRoutes />
            </Suspense>
          </ModeSwitchTransitionProvider>
        </GuestAuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
