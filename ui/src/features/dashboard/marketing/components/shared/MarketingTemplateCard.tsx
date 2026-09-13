import { type SyntheticEvent } from 'react';

import { Check, Settings2 } from 'lucide-react';

import type { MarketingSidebarMenuItem } from '@/features/dashboard/marketing/components/shared/MarketingSidebarSection';
import { MarketingOverflowMenu } from '@/features/dashboard/marketing/components/shared/MarketingOverflowMenu';
import { useVisibleThumbnailRequest } from '@/features/dashboard/marketing/hooks/useVisibleThumbnailRequest';
import {
  marketingFormatMeta,
  templateThumbnailAspectRatio,
  templateThumbnailMaxHeight,
  type FormatOrientation,
} from '@/features/dashboard/marketing/lib/marketingFormats';
import { PlanGateWatermarkPattern } from '@/features/dashboard/plans/components/PlanGateWatermarkPattern';
import { useFeatureGate } from '@/features/dashboard/plans/hooks/useFeatureGate';

import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

function blockThumbnailMediaEvent(event: SyntheticEvent) {
  event.preventDefault();
}

type Props = {
  name: string;
  selected?: boolean;
  onClick: () => void;
  onCustomize?: () => void;
  menuItems?: MarketingSidebarMenuItem[];
  thumbnailUrl?: string | null;
  thumbnailLoading?: boolean;
  onRequestThumbnail?: () => void;
  /** Canvas pixel dimensions — drives thumbnail frame aspect ratio. */
  thumbnailWidth?: number;
  thumbnailHeight?: number;
  /** Used when width/height omitted (e.g. calendar). */
  thumbnailAspectRatio?: string;
  thumbnailOrientation?: FormatOrientation;
  badge?: string;
  meta?: string;
  layout?: 'grid' | 'row';
};

function resolveThumbnailFrame(
  props: Pick<
    Props,
    'thumbnailWidth' | 'thumbnailHeight' | 'thumbnailAspectRatio' | 'thumbnailOrientation'
  >
) {
  const width = props.thumbnailWidth ?? 1;
  const height = props.thumbnailHeight ?? 1;
  const orientation = props.thumbnailOrientation ?? marketingFormatMeta(width, height).orientation;
  const aspectRatio = props.thumbnailAspectRatio ?? templateThumbnailAspectRatio(width, height);
  const maxHeight = templateThumbnailMaxHeight(orientation);

  return { aspectRatio, maxHeight, orientation };
}

function previewFrameStyle(frame: ReturnType<typeof resolveThumbnailFrame>) {
  if (frame.orientation === 'portrait' && frame.maxHeight) {
    return {
      aspectRatio: frame.aspectRatio,
      height: frame.maxHeight,
      width: 'auto' as const,
      maxWidth: '100%',
    };
  }

  return {
    aspectRatio: frame.aspectRatio,
    maxHeight: frame.maxHeight,
    width: '100%' as const,
  };
}

function TemplatePreviewFrame({
  selected,
  thumbnailUrl,
  thumbnailLoading,
  badge,
  frame,
  watermarked,
}: {
  selected?: boolean;
  thumbnailUrl?: string | null;
  thumbnailLoading?: boolean;
  badge?: string;
  frame: ReturnType<typeof resolveThumbnailFrame>;
  watermarked?: boolean;
}) {
  return (
    <div
      className={cn(
        'relative mx-auto overflow-hidden rounded-lg transition-all duration-200',
        'bg-gradient-to-br from-neutral-900/[0.06] via-neutral-900/[0.04] to-neutral-900/[0.02]',
        'shadow-sm ring-1 ring-border/60',
        selected && 'shadow-md ring-2 ring-primary',
        !selected && 'group-hover:shadow group-hover:ring-primary/35'
      )}
      style={previewFrameStyle(frame)}
      aria-busy={thumbnailLoading || !thumbnailUrl}
      onContextMenu={watermarked ? blockThumbnailMediaEvent : undefined}
    >
      {thumbnailUrl ? (
        <img
          src={thumbnailUrl}
          alt=""
          className="pointer-events-none size-full select-none object-contain object-center"
          draggable={false}
          onDragStart={blockThumbnailMediaEvent}
        />
      ) : (
        <Skeleton className="absolute inset-0 size-full rounded-none" aria-hidden />
      )}

      {watermarked ? <PlanGateWatermarkPattern compact /> : null}

      {badge ? (
        <span className="absolute right-1 top-1 z-10 rounded-md bg-black/60 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-white backdrop-blur-sm">
          {badge}
        </span>
      ) : null}

      {selected ? (
        <span className="absolute left-1 top-1 z-10 flex size-5 items-center justify-center rounded-full bg-primary shadow-sm">
          <Check className="size-3 text-primary-foreground" strokeWidth={3} aria-hidden />
        </span>
      ) : null}
    </div>
  );
}

export function MarketingTemplateCard({
  name,
  selected,
  onClick,
  onCustomize,
  menuItems,
  thumbnailUrl,
  thumbnailLoading = false,
  onRequestThumbnail,
  thumbnailWidth,
  thumbnailHeight,
  thumbnailAspectRatio: aspectRatioProp,
  thumbnailOrientation,
  badge,
  meta,
  layout = 'grid',
}: Props) {
  const frame = resolveThumbnailFrame({
    thumbnailWidth,
    thumbnailHeight,
    thumbnailAspectRatio: aspectRatioProp,
    thumbnailOrientation,
  });

  // Preview-open: browsable on every tier. Free gets a soft watermark (no blur) so hosts
  // can still pick templates; drag / context-menu on the thumb image is blocked.
  const { canUse: canUseMarketingStudio, isLoading: marketingStudioLoading } =
    useFeatureGate('marketingStudio');
  const watermarked = marketingStudioLoading || !canUseMarketingStudio;

  const visibilityRef = useVisibleThumbnailRequest({
    enabled: Boolean(onRequestThumbnail) && !thumbnailUrl,
    onVisible: () => onRequestThumbnail?.(),
  });

  const actionBar =
    (menuItems && menuItems.length > 0) || onCustomize ? (
      <div
        className={cn(
          'absolute right-0.5 top-0.5 z-20 flex gap-0.5 transition-opacity',
          // Settings stays visible so hosts can open advanced edit without hunting hover.
          onCustomize
            ? 'opacity-100'
            : 'opacity-0 group-focus-within:opacity-100 group-hover:opacity-100'
        )}
      >
        {onCustomize ? (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onCustomize();
            }}
            aria-label={`Customize ${name}`}
            title="Settings"
            className="flex min-h-[36px] min-w-[36px] items-center justify-center rounded-md bg-card/95 text-foreground shadow-sm backdrop-blur-sm transition-colors hover:bg-white sm:min-h-[32px] sm:min-w-[32px]"
          >
            <Settings2 className="size-3.5" aria-hidden />
          </button>
        ) : null}
        {menuItems && menuItems.length > 0 ? (
          <MarketingOverflowMenu
            label={`${name} options`}
            menuItems={menuItems}
            icon="horizontal"
            triggerClassName="size-7 min-h-[28px] min-w-[28px] rounded-md bg-card/90 shadow-sm backdrop-blur-sm"
            onTriggerClick={(event) => event.stopPropagation()}
          />
        ) : null}
      </div>
    ) : null;

  if (layout === 'row') {
    const rowThumbStyle = {
      aspectRatio: frame.aspectRatio,
      width: frame.orientation === 'portrait' ? '2.5rem' : '2.75rem',
      maxHeight: '2.75rem',
    };

    return (
      <div
        ref={visibilityRef}
        className={cn(
          'group relative min-w-0 overflow-hidden rounded-lg transition-colors',
          selected ? 'bg-primary/5' : 'hover:bg-muted/40'
        )}
      >
        <button
          type="button"
          onClick={onClick}
          className="flex min-h-[44px] w-full min-w-0 items-center gap-2.5 px-1 py-1.5 text-left"
        >
          <div
            className={cn(
              'relative shrink-0 overflow-hidden rounded-md',
              'bg-gradient-to-br from-neutral-900/[0.06] to-neutral-900/[0.02]',
              'ring-1 ring-border/60',
              selected && 'ring-2 ring-primary'
            )}
            style={rowThumbStyle}
            aria-busy={thumbnailLoading || !thumbnailUrl}
            onContextMenu={watermarked ? blockThumbnailMediaEvent : undefined}
          >
            {thumbnailUrl ? (
              <img
                src={thumbnailUrl}
                alt=""
                className="pointer-events-none size-full select-none object-contain object-center"
                draggable={false}
                onDragStart={blockThumbnailMediaEvent}
              />
            ) : (
              <Skeleton className="absolute inset-0 size-full rounded-none" aria-hidden />
            )}
            {watermarked ? <PlanGateWatermarkPattern compact /> : null}
          </div>
          <div className="min-w-0 flex-1">
            <p className={cn('truncate text-xs font-medium', selected && 'text-primary')}>{name}</p>
            {meta ? <p className="truncate text-[10px] text-muted-foreground">{meta}</p> : null}
          </div>
        </button>
        {actionBar}
      </div>
    );
  }

  return (
    <div
      ref={visibilityRef}
      className={cn(
        'group relative min-w-0 rounded-lg transition-colors',
        selected ? 'bg-primary/5' : 'hover:bg-muted/20'
      )}
    >
      <button
        type="button"
        onClick={onClick}
        className="flex w-full min-w-0 flex-col gap-1.5 px-1 py-1.5 text-left"
      >
        <TemplatePreviewFrame
          selected={selected}
          thumbnailUrl={thumbnailUrl}
          thumbnailLoading={thumbnailLoading}
          watermarked={watermarked}
          badge={badge}
          frame={frame}
        />
        <div className="min-w-0 px-0.5">
          <p
            className={cn(
              'line-clamp-2 text-center text-xs font-medium leading-snug',
              selected ? 'text-primary' : 'text-foreground'
            )}
          >
            {name}
          </p>
          {meta ? (
            <p
              className="mt-0.5 line-clamp-1 text-center text-[10px] text-muted-foreground"
              aria-label={meta}
              title={meta}
            >
              {meta}
            </p>
          ) : null}
        </div>
      </button>
      {actionBar}
    </div>
  );
}
