import type { MarketingContentType } from '@/features/dashboard/marketing/hooks/useMarketingTemplates';

/**
 * Editor chunks (Polotno, Remotion, calendar builder) load only when a design opens.
 * Hovering a Library card warms the chunk so the editor appears without a wait.
 * The page's `lazy()` imports use these same loaders, so Vite reuses one chunk.
 */
export const loadMarketingEditor = {
  design: () => import('@/features/dashboard/marketing/components/design-editor/DesignEditor'),
  video: () => import('@/features/dashboard/marketing/components/video-editor/VideoEditor'),
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
