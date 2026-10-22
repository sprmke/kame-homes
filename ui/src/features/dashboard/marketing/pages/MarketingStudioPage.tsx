import { lazy, Suspense, useCallback, useState } from 'react';

import { useAdminLayoutFillMain } from '@/features/dashboard/bookings/lib/adminLayoutFillMain';
import type { DesignExportPayload } from '@/features/dashboard/marketing/components/design-editor/DesignEditor';
import { MarketingLibraryHome } from '@/features/dashboard/marketing/components/library/MarketingLibraryHome';
import {
  PublishDialog,
  type PublishMedia,
} from '@/features/dashboard/marketing/components/publishing/PublishDialog';
import { MarketingEditorHost } from '@/features/dashboard/marketing/components/shared/MarketingEditorHost';
import {
  MarketingStudioModeTabs,
  SlidingTabs,
} from '@/features/dashboard/marketing/components/shared/MarketingStudioModeTabs';
import { MarketingStudioShell } from '@/features/dashboard/marketing/components/shared/MarketingStudioShell';
import { MarketingThemeEditorProvider } from '@/features/dashboard/marketing/components/themes/MarketingThemeEditor';
import {
  MarketingThemeProvider,
  useMarketingTheme,
} from '@/features/dashboard/marketing/components/themes/MarketingThemeProvider';
import { ThemeContextBar } from '@/features/dashboard/marketing/components/themes/ThemeContextBar';
import { ThemesHome } from '@/features/dashboard/marketing/components/themes/ThemesHome';
import type { VideoExportPayload } from '@/features/dashboard/marketing/components/video-editor/VideoEditor';
import { loadMarketingEditor } from '@/features/dashboard/marketing/lib/marketingEditorPreload';
import {
  isMarketingEditorTab,
  normalizeMarketingStudioTab,
} from '@/features/dashboard/marketing/lib/theme/marketingStudioNav';

import { AdminMobilePage } from '@/components/mobile/MobileBrandHero';
import {
  MarketingEditorSkeleton,
  MarketingLibraryBodySkeleton,
} from '@/components/skeletons/AdminSkeletons';
import { useIsBelowLg } from '@/hooks/useMediaQuery';

// Lazy-loaded: Polotno (posts), Remotion (videos) and the calendar builder are heavy and
// only load when a design is opened, never for the Library. Same specifiers as
// `marketingEditorPreload` (hovering a Library card warms the chunk).
const DesignEditor = lazy(() =>
  loadMarketingEditor.design().then((m) => ({ default: m.DesignEditor }))
);
const VideoEditor = lazy(() =>
  loadMarketingEditor.video().then((m) => ({ default: m.VideoEditor }))
);
const MarketingCalendarSection = lazy(() =>
  loadMarketingEditor.calendar().then((m) => ({ default: m.MarketingCalendarSection }))
);
const AiStudioHome = lazy(() =>
  import('@/features/dashboard/marketing/components/ai-studio/AiStudioHome').then((m) => ({
    default: m.AiStudioHome,
  }))
);
const AiStudioConversation = lazy(() =>
  import('@/features/dashboard/marketing/components/ai-studio/AiStudioConversation').then((m) => ({
    default: m.AiStudioConversation,
  }))
);

export function MarketingStudioPage() {
  // Immersive editor — fill the admin main column on mobile (flex chain, not viewport
  // math) so the studio canvas gets real height instead of ~50% of `100vh`.
  useAdminLayoutFillMain(true);

  return (
    <MarketingThemeProvider>
      <MarketingThemeEditorProvider>
        <MarketingStudioWorkspace />
      </MarketingThemeEditorProvider>
    </MarketingThemeProvider>
  );
}

function MarketingStudioWorkspace() {
  const { view, tab, tabReady, setTab, active, item, openItem } = useMarketingTheme();
  const [publishOpen, setPublishOpen] = useState(false);
  const [publishMedia, setPublishMedia] = useState<PublishMedia | null>(null);

  const openPublishWithBlob = useCallback(
    (blob: Blob, mediaType: 'image' | 'video', templateId?: string) => {
      setPublishMedia({ blob, mediaType, templateId });
      setPublishOpen(true);
    },
    []
  );

  const showThemes = view === 'themes';
  // Focus mode: while a design or an AI creation is open, the tab row gives way to its
  // own top bar.
  const editorOpen = (isMarketingEditorTab(tab) || tab === 'generate') && item.mode !== 'library';
  // Theme is page-level context: beside the page title on desktop, atop the card on phones.
  const isBelowLg = useIsBelowLg();
  const themeBar = showThemes ? null : <ThemeContextBar />;

  const content = (() => {
    if (showThemes) return <ThemesHome />;
    if (!active || !tabReady) return <MarketingLibraryBodySkeleton />;

    if (tab === 'generate') {
      return (
        <Suspense
          fallback={
            item.mode === 'library' ? <MarketingLibraryBodySkeleton /> : <MarketingEditorSkeleton />
          }
        >
          {item.mode === 'library' ? (
            <AiStudioHome key={active.key} />
          ) : (
            <AiStudioConversation
              key={`ai:${active.key}`}
              onPublish={(payload) =>
                openPublishWithBlob(payload.blob, payload.mediaType, 'ai-generated')
              }
              onOpenInDesign={(templateId) => openItem(templateId, { tab: 'design' })}
            />
          )}
        </Suspense>
      );
    }

    if (item.mode === 'library') {
      return <MarketingLibraryHome key={`${tab}:${active.key}`} contentType={tab} />;
    }

    return (
      <Suspense fallback={<MarketingEditorSkeleton />}>
        <MarketingEditorHost key={`${tab}:${active.key}`} contentType={tab}>
          {(document, nav) =>
            tab === 'design' ? (
              <DesignEditor
                document={document}
                nav={nav}
                onPublish={(payload: DesignExportPayload) =>
                  openPublishWithBlob(payload.blob, 'image', payload.templateId)
                }
              />
            ) : tab === 'video' ? (
              <VideoEditor
                document={document}
                nav={nav}
                onPublish={(payload: VideoExportPayload) =>
                  openPublishWithBlob(payload.blob, 'video', payload.templateId)
                }
              />
            ) : (
              <MarketingCalendarSection
                document={document}
                nav={nav}
                onPublish={(blob) => openPublishWithBlob(blob, 'image', 'calendar')}
              />
            )
          }
        </MarketingEditorHost>
      </Suspense>
    );
  })();

  return (
    <>
      <SlidingTabs value={tab} onValueChange={(next) => setTab(normalizeMarketingStudioTab(next))}>
        <AdminMobilePage
          title="Marketing"
          subtitle="Make posts, videos and calendars in one theme."
          titleId="marketing-heading"
        >
          <MarketingStudioShell
            leading={isBelowLg && !editorOpen ? themeBar : null}
            tabs={showThemes || editorOpen ? null : <MarketingStudioModeTabs />}
            actions={!isBelowLg && !editorOpen ? themeBar : null}
            hasDock={editorOpen && isMarketingEditorTab(tab)}
          >
            {content}
          </MarketingStudioShell>
        </AdminMobilePage>
      </SlidingTabs>

      <PublishDialog open={publishOpen} onOpenChange={setPublishOpen} media={publishMedia} />
    </>
  );
}
