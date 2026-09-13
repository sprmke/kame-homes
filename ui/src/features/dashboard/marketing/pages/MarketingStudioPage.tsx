import { lazy, Suspense, useState } from 'react';

import { useAdminLayoutFillMain } from '@/features/dashboard/bookings/lib/adminLayoutFillMain';
import { MarketingCalendarSection } from '@/features/dashboard/marketing/components/calendar-builder/MarketingCalendarSection';
import type { DesignExportPayload } from '@/features/dashboard/marketing/components/design-editor/DesignEditor';
import {
  PublishDialog,
  type PublishMedia,
} from '@/features/dashboard/marketing/components/publishing/PublishDialog';
import { PublishHistory } from '@/features/dashboard/marketing/components/publishing/PublishHistory';
import { MarketingStudioHeaderActionsProvider } from '@/features/dashboard/marketing/components/shared/MarketingStudioHeaderActions';
import { MarketingStudioModeTabs } from '@/features/dashboard/marketing/components/shared/MarketingStudioModeTabs';
import { SlidingTabs } from '@/features/dashboard/marketing/components/shared/MarketingStudioModeTabs';
import { MarketingStudioShell } from '@/features/dashboard/marketing/components/shared/MarketingStudioShell';
import type { VideoExportPayload } from '@/features/dashboard/marketing/components/video-editor/VideoEditor';

import { AdminMobilePage } from '@/components/mobile/MobileBrandHero';
import { Skeleton } from '@/components/ui/skeleton';
import { SlidingTabsContent } from '@/components/ui/sliding-tabs';

// Lazy-loaded: Polotno (design editor) and Remotion/Blueprint (video editor) are heavy
// deps that only the "design"/"video" tabs need — SlidingTabsContent already unmounts
// the inactive tab's tree, but a static import still ships their JS in every Marketing
// Studio page load regardless of which tab is open. Splitting into separate chunks means
// that JS is only fetched the first time a guest actually opens that tab.
const DesignEditor = lazy(() =>
  import('@/features/dashboard/marketing/components/design-editor/DesignEditor').then((m) => ({
    default: m.DesignEditor,
  }))
);
const VideoEditor = lazy(() =>
  import('@/features/dashboard/marketing/components/video-editor/VideoEditor').then((m) => ({
    default: m.VideoEditor,
  }))
);
const AiStudioSection = lazy(() =>
  import('@/features/dashboard/marketing/components/ai-studio/AiStudioSection').then((m) => ({
    default: m.AiStudioSection,
  }))
);

function StudioTabFallback() {
  return (
    <div className="flex flex-1 flex-col gap-3 p-4">
      <Skeleton className="h-8 w-40 rounded-lg" />
      <Skeleton className="h-64 w-full rounded-xl" />
    </div>
  );
}

export function MarketingStudioPage() {
  // Immersive editor — fill the admin main column on mobile (flex chain, not viewport
  // math) so the studio canvas gets real height instead of ~50% of `100vh`.
  useAdminLayoutFillMain(true);

  const [tab, setTab] = useState('calendar');
  const [publishOpen, setPublishOpen] = useState(false);
  const [publishMedia, setPublishMedia] = useState<PublishMedia | null>(null);

  const openPublishWithBlob = (blob: Blob, mediaType: 'image' | 'video', templateId?: string) => {
    setPublishMedia({ blob, mediaType, templateId });
    setPublishOpen(true);
  };

  const handleCalendarPublish = (blob: Blob) => {
    openPublishWithBlob(blob, 'image', 'calendar');
  };

  const handleDesignPublish = (payload: DesignExportPayload) => {
    openPublishWithBlob(payload.blob, 'image', payload.templateId);
  };

  const handleVideoPublish = (payload: VideoExportPayload) => {
    openPublishWithBlob(payload.blob, 'video', payload.templateId);
  };

  const handleGeneratePublish = (payload: { blob: Blob; mediaType: 'image' | 'video' }) => {
    openPublishWithBlob(payload.blob, payload.mediaType, 'ai-generated');
  };

  return (
    <>
      <SlidingTabs value={tab} onValueChange={setTab}>
        <MarketingStudioHeaderActionsProvider>
          <AdminMobilePage
            title="Marketing"
            subtitle="Build calendars, designs, and promo videos."
            titleId="marketing-heading"
          >
            <MarketingStudioShell tabs={<MarketingStudioModeTabs />}>
              <SlidingTabsContent value="calendar" className="mt-0 flex min-h-0 flex-1 flex-col">
                <MarketingCalendarSection onPublish={handleCalendarPublish} />
              </SlidingTabsContent>

              <SlidingTabsContent value="design" className="mt-0 flex min-h-0 flex-1 flex-col">
                <Suspense fallback={<StudioTabFallback />}>
                  <DesignEditor onPublish={handleDesignPublish} />
                </Suspense>
              </SlidingTabsContent>

              <SlidingTabsContent value="video" className="mt-0 flex min-h-0 flex-1 flex-col">
                <Suspense fallback={<StudioTabFallback />}>
                  <VideoEditor onPublish={handleVideoPublish} />
                </Suspense>
              </SlidingTabsContent>

              <SlidingTabsContent value="generate" className="mt-0 flex min-h-0 flex-1 flex-col">
                <Suspense fallback={<StudioTabFallback />}>
                  <AiStudioSection onPublish={handleGeneratePublish} />
                </Suspense>
              </SlidingTabsContent>
            </MarketingStudioShell>

            <PublishHistory />
          </AdminMobilePage>
        </MarketingStudioHeaderActionsProvider>
      </SlidingTabs>

      <PublishDialog open={publishOpen} onOpenChange={setPublishOpen} media={publishMedia} />
    </>
  );
}
