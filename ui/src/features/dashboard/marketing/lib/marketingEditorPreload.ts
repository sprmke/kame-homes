import type { ComponentType } from 'react';

import type {
  MarketingEditorDocument,
  MarketingEditorNav,
} from '@/features/dashboard/marketing/components/shared/MarketingEditorHost';
import type { MarketingContentType } from '@/features/dashboard/marketing/hooks/useMarketingTemplates';
import { isVideoEditorV2Enabled } from '@/features/dashboard/marketing/lib/video/videoEditorFlag';

/** What the Publish flow needs from either editor's export. */
export type MarketingVideoExportPayload = {
  templateId: string;
  blob: Blob;
  dataUrl: string;
};

export type MarketingVideoEditorProps = {
  document: MarketingEditorDocument;
  nav: MarketingEditorNav;
  onPublish?: (payload: MarketingVideoExportPayload) => void;
};

export type MarketingVideoEditorModule = {
  VideoEditor: ComponentType<MarketingVideoEditorProps>;
};

/**
 * Editor chunks (Polotno, Remotion, calendar builder) load only when a design opens.
 * Hovering a Library card warms the chunk so the editor appears without a wait.
 * The page's `lazy()` imports use these same loaders, so Vite reuses one chunk.
 */
/**
 * Multi-track editor (v2) unless `VITE_VIDEO_EDITOR_V2=false`. One seam, so the page and the
 * hover preload always resolve the same chunk and rollback is an env flip.
 */
export function loadMarketingVideoEditor(): Promise<MarketingVideoEditorModule> {
  return isVideoEditorV2Enabled(import.meta.env.VITE_VIDEO_EDITOR_V2)
    ? import('@/features/dashboard/marketing/components/video-editor/VideoEditorV2').then(
        (module) => ({
          VideoEditor: module.VideoEditorV2 as ComponentType<MarketingVideoEditorProps>,
        })
      )
    : import('@/features/dashboard/marketing/components/video-editor/VideoEditor').then(
        (module) => ({
          VideoEditor: module.VideoEditor as ComponentType<MarketingVideoEditorProps>,
        })
      );
}

export const loadMarketingEditor = {
  design: () => import('@/features/dashboard/marketing/components/design-editor/DesignEditor'),
  video: loadMarketingVideoEditor,
  calendar: () =>
    import('@/features/dashboard/marketing/components/calendar-builder/MarketingCalendarSection'),
} satisfies Record<MarketingContentType, () => Promise<unknown>>;

const started = new Set<MarketingContentType>();

export function preloadMarketingEditor(contentType: MarketingContentType): void {
  if (started.has(contentType)) return;
  started.add(contentType);
  void loadMarketingEditor[contentType]().catch(() => {
    // A failed warm-up is retried by the real lazy import when the editor opens.
    started.delete(contentType);
  });
}
