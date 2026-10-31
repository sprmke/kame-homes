import { Suspense, memo, useEffect, useMemo, useRef, useState } from 'react';

import { PreviewOverrideProvider } from '@/features/guest/lib/previewOverrideContext';
import { PreviewViewportProvider } from '@/features/guest/lib/previewViewportContext';
import { ShowcaseTemplateThumbSurface } from '@/features/guest/marketing/showcase/lib/showcaseTemplateThumbSurface';
import { getShowcaseTemplate } from '@/features/guest/marketing/showcase/templates/registry';
import type { ShowcaseTemplateKey } from '@/features/guest/marketing/showcase/types/showcase';
import type { GuestStayGuideDto } from '@/features/guest/stay-guide/lib/api';
import type { StayGuideConfigV2 } from '@/features/guest/stay-guide/lib/stayGuideConfig';

import {
  STAY_GUIDE_TEMPLATE_THUMB_CLIP_HEIGHT,
  STAY_GUIDE_TEMPLATE_THUMB_FRAME_WIDTH,
  buildStayGuideTemplateThumbData,
} from '@/features/dashboard/page-editor/lib/stayGuideTemplateThumbData';

import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

type Props = {
  dto: GuestStayGuideDto;
  config: StayGuideConfigV2;
  templateKey: ShowcaseTemplateKey;
  selected?: boolean;
};

function ThumbSkeleton() {
  return <Skeleton className="size-full rounded-none" aria-hidden />;
}

/** Live, inert, scaled mobile render of a Stay Guide template — mirrors `ShowcaseTemplatePreviewThumb`. */
export const StayGuideTemplatePreviewThumb = memo(function StayGuideTemplatePreviewThumb({
  dto,
  config,
  templateKey,
  selected,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.2);

  const data = useMemo(
    () => buildStayGuideTemplateThumbData(dto, config, templateKey),
    [dto, config, templateKey]
  );

  const previewOverride = useMemo(
    () => ({ kind: 'stay-guide' as const, data: { ...dto, templateKey } }),
    [dto, templateKey]
  );

  const entry = getShowcaseTemplate(templateKey);
  const Template = entry.component;

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const updateScale = () => {
      const width = element.clientWidth;
      if (width <= 0) return;
      setScale(width / STAY_GUIDE_TEMPLATE_THUMB_FRAME_WIDTH);
    };
    updateScale();
    const observer = new ResizeObserver(updateScale);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={containerRef}
      className={cn(
        'bg-muted/20 relative aspect-[5/8] w-full min-w-0 overflow-hidden rounded-md border transition-[box-shadow,ring-color] duration-200',
        selected
          ? 'border-primary ring-primary ring-offset-background shadow-sm ring-2 ring-offset-1'
          : 'border-border/80 group-hover:border-primary/35'
      )}
      aria-hidden
    >
      <PreviewOverrideProvider value={previewOverride}>
        <PreviewViewportProvider value="mobile">
          <ShowcaseTemplateThumbSurface>
            <div
              className="showcase-template-thumb-surface pointer-events-none absolute left-0 top-0 isolate h-full select-none overflow-hidden"
              style={{
                width: STAY_GUIDE_TEMPLATE_THUMB_FRAME_WIDTH,
                height: STAY_GUIDE_TEMPLATE_THUMB_CLIP_HEIGHT,
                transform: `scale(${scale})`,
                transformOrigin: 'top left',
              }}
            >
              <Suspense fallback={<ThumbSkeleton />}>
                <Template data={data} />
              </Suspense>
            </div>
          </ShowcaseTemplateThumbSurface>
        </PreviewViewportProvider>
      </PreviewOverrideProvider>
    </div>
  );
});
