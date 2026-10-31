import * as React from 'react';

import { Loader2, RotateCcw, ZoomIn, ZoomOut } from 'lucide-react';
import {
  TransformWrapper,
  TransformComponent,
  type ReactZoomPanPinchRef,
} from 'react-zoom-pan-pinch';

import { renderPdfBytesToPageImages } from '@/features/dashboard/bookings/lib/renderPdfPageImages';

import { MediaPreviewSkeleton } from '@/components/skeletons/AdminSkeletons';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const MIN_SCALE = 0.5;
const MAX_SCALE = 3.5;
const ZOOM_STEP = 0.25;
const DEFAULT_SCALE = 1;

function preloadDataUrls(urls: string[]): Promise<void> {
  return Promise.all(
    urls.map(
      (url) =>
        new Promise<void>((resolve, reject) => {
          const img = new Image();
          img.onload = () => resolve();
          img.onerror = () => reject(new Error('Preview image failed to load'));
          img.src = url;
        })
    )
  ).then(() => undefined);
}

type PreviewToolbarProps = {
  zoomPercent: number;
  initialLoading: boolean;
  isRefreshing: boolean;
  canReset: boolean;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onReset: () => void;
};

function PreviewToolbar({
  zoomPercent,
  initialLoading,
  isRefreshing,
  canReset,
  onZoomIn,
  onZoomOut,
  onReset,
}: PreviewToolbarProps) {
  const canZoomIn = zoomPercent < Math.round(MAX_SCALE * 100);
  const canZoomOut = zoomPercent > Math.round(MIN_SCALE * 100);

  return (
    <div className="border-separator flex flex-wrap items-center justify-between gap-2 border-b px-3 py-2">
      <p className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">
        Live preview
      </p>
      <div className="flex items-center gap-1 sm:gap-1.5">
        {isRefreshing ? (
          <span className="text-muted-foreground inline-flex items-center gap-1.5 px-1 text-xs">
            <Loader2 className="size-3.5 animate-spin" aria-hidden />
            Updating…
          </span>
        ) : null}
        <div
          className="border-border bg-background/60 flex items-center rounded-lg border"
          role="group"
          aria-label="Preview zoom"
        >
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="min-h-[44px] min-w-[44px] rounded-none rounded-l-lg"
            disabled={initialLoading || !canZoomOut}
            onClick={onZoomOut}
            aria-label="Zoom out"
          >
            <ZoomOut className="size-4" aria-hidden />
          </Button>
          <span
            className="text-foreground min-w-[3rem] px-1 text-center text-xs font-medium tabular-nums"
            aria-live="polite"
            aria-atomic="true"
          >
            {zoomPercent}%
          </span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="min-h-[44px] min-w-[44px] rounded-none rounded-r-lg"
            disabled={initialLoading || !canZoomIn}
            onClick={onZoomIn}
            aria-label="Zoom in"
          >
            <ZoomIn className="size-4" aria-hidden />
          </Button>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="min-h-[44px] gap-1.5 px-2.5"
          disabled={initialLoading || !canReset}
          onClick={onReset}
          aria-label="Reset zoom and pan"
        >
          <RotateCcw className="size-3.5 shrink-0" aria-hidden />
          <span className="hidden sm:inline">Reset</span>
        </Button>
      </div>
    </div>
  );
}

export type AdminPdfZoomPreviewProps = {
  className?: string;
  pageAltPrefix: string;
  renderPdfBytes: () => Promise<Uint8Array>;
  refreshDeps: React.DependencyList;
};

export function AdminPdfZoomPreview({
  className,
  pageAltPrefix,
  renderPdfBytes,
  refreshDeps,
}: AdminPdfZoomPreviewProps) {
  const [pageImages, setPageImages] = React.useState<string[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const [initialLoading, setInitialLoading] = React.useState(true);
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const [zoomPercent, setZoomPercent] = React.useState(100);
  const [canReset, setCanReset] = React.useState(false);
  const [contentHeight, setContentHeight] = React.useState(0);

  const transformRef = React.useRef<ReactZoomPanPinchRef>(null);
  const contentRef = React.useRef<HTMLDivElement>(null);
  const renderGenerationRef = React.useRef(0);
  const hasDisplayedPreviewRef = React.useRef(false);

  const isZoomedIn = zoomPercent > 100;

  const measureContentHeight = React.useCallback(() => {
    const el = contentRef.current;
    if (!el) return;
    const next = el.offsetHeight;
    if (next > 0) setContentHeight(next);
  }, []);

  React.useEffect(() => {
    let cancelled = false;
    const generation = ++renderGenerationRef.current;
    const isInitial = !hasDisplayedPreviewRef.current;

    const timer = window.setTimeout(() => {
      void (async () => {
        let refreshIndicatorTimer: number | undefined;
        if (isInitial) {
          setInitialLoading(true);
        } else {
          refreshIndicatorTimer = window.setTimeout(() => {
            if (!cancelled && generation === renderGenerationRef.current) {
              setIsRefreshing(true);
            }
          }, 400);
        }

        try {
          const bytes = await renderPdfBytes();
          if (cancelled || generation !== renderGenerationRef.current) return;

          const images = await renderPdfBytesToPageImages(bytes);
          if (cancelled || generation !== renderGenerationRef.current) return;

          await preloadDataUrls(images);
          if (cancelled || generation !== renderGenerationRef.current) return;

          setPageImages(images);
          setError(null);
          hasDisplayedPreviewRef.current = true;
        } catch (err) {
          if (cancelled || generation !== renderGenerationRef.current) return;
          setError((err as Error).message ?? 'Could not render preview');
          if (isInitial) {
            setPageImages([]);
          }
        } finally {
          if (refreshIndicatorTimer !== undefined) {
            window.clearTimeout(refreshIndicatorTimer);
          }
          if (!cancelled && generation === renderGenerationRef.current) {
            setInitialLoading(false);
            setIsRefreshing(false);
          }
        }
      })();
    }, 300);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- caller supplies explicit refresh keys
  }, refreshDeps);

  React.useEffect(() => {
    if (pageImages.length === 0) return;

    requestAnimationFrame(() => {
      measureContentHeight();
      transformRef.current?.resetTransform(200);
      setZoomPercent(100);
      setCanReset(false);
    });
  }, [pageImages, measureContentHeight]);

  React.useEffect(() => {
    const el = contentRef.current;
    if (!el || pageImages.length === 0) return;

    measureContentHeight();
    const observer = new ResizeObserver(() => measureContentHeight());
    observer.observe(el);
    return () => observer.disconnect();
  }, [pageImages, measureContentHeight]);

  return (
    <div className={cn('border-border bg-muted/10 flex flex-col rounded-lg border', className)}>
      {error ? (
        <>
          <PreviewToolbar
            zoomPercent={100}
            initialLoading={false}
            isRefreshing={false}
            canReset={false}
            onZoomIn={() => undefined}
            onZoomOut={() => undefined}
            onReset={() => undefined}
          />
          <p className="text-destructive px-5 py-6 text-sm">{error}</p>
        </>
      ) : pageImages.length > 0 ? (
        <TransformWrapper
          ref={transformRef}
          initialScale={DEFAULT_SCALE}
          minScale={MIN_SCALE}
          maxScale={MAX_SCALE}
          centerOnInit
          limitToBounds={isZoomedIn}
          wheel={{ step: 0.12, smoothStep: 0.004 }}
          pinch={{ step: 5 }}
          doubleClick={{ disabled: false, mode: 'reset' }}
          panning={{ disabled: !isZoomedIn, velocityDisabled: false }}
          onTransformed={(_ref, state) => {
            const nextZoom = Math.round(state.scale * 100);
            setZoomPercent(nextZoom);
            const atDefault =
              Math.abs(state.scale - DEFAULT_SCALE) < 0.01 &&
              Math.abs(state.positionX) < 1 &&
              Math.abs(state.positionY) < 1;
            setCanReset(!atDefault);
          }}
        >
          {({ zoomIn, zoomOut, resetTransform }) => (
            <>
              <PreviewToolbar
                zoomPercent={zoomPercent}
                initialLoading={initialLoading}
                isRefreshing={isRefreshing}
                canReset={canReset}
                onZoomIn={() => zoomIn(ZOOM_STEP, 200)}
                onZoomOut={() => zoomOut(ZOOM_STEP, 200)}
                onReset={() => resetTransform(200)}
              />
              <TransformComponent
                wrapperClass={cn(
                  'bg-muted/5 !w-full',
                  isZoomedIn ? '!overflow-hidden' : '!overflow-visible'
                )}
                wrapperStyle={
                  isZoomedIn && contentHeight > 0
                    ? { height: contentHeight }
                    : { height: 'auto', overflow: 'visible' }
                }
                contentClass="!w-full p-2 sm:p-3"
              >
                <div ref={contentRef} className="mx-auto w-full min-w-0 max-w-full space-y-3">
                  {pageImages.map((src, index) => (
                    <img
                      key={index}
                      src={src}
                      alt={`${pageAltPrefix} page ${index + 1}`}
                      draggable={false}
                      className="border-border w-full max-w-none rounded-md border bg-white"
                      width={800}
                      height={1100}
                    />
                  ))}
                </div>
              </TransformComponent>
            </>
          )}
        </TransformWrapper>
      ) : (
        <>
          <PreviewToolbar
            zoomPercent={100}
            initialLoading={initialLoading}
            isRefreshing={false}
            canReset={false}
            onZoomIn={() => undefined}
            onZoomOut={() => undefined}
            onReset={() => undefined}
          />
          {initialLoading ? <MediaPreviewSkeleton /> : null}
        </>
      )}
    </div>
  );
}
