import type { KeyboardEvent, ReactNode } from 'react';

import { Check } from 'lucide-react';

import { PlanGateWatermarkPattern } from '@/features/dashboard/plans/components/PlanGateWatermarkPattern';

import { cn } from '@/lib/utils';

type Props = {
  /** Card art (image, SVG). Sits centered, contained, on a soft backdrop. */
  art: ReactNode;
  name: string;
  meta?: ReactNode;
  /** Small chips over the art (bottom-left), e.g. size, AI, Collage. */
  badges?: ReactNode;
  /** Top-right corner chip over the art, e.g. "3 sizes", "Used 2x". */
  corner?: ReactNode;
  /** ⋯ menu (rendered beside the name). */
  menu?: ReactNode;
  onOpen: () => void;
  /** Select mode: the tile toggles selection instead of opening. */
  selectable?: boolean;
  selected?: boolean;
  onToggleSelect?: () => void;
  /** Highlight (current template / open item). */
  active?: boolean;
  watermarked?: boolean;
  onIntent?: () => void;
  /** Accessible label for the open button. Defaults to the name. */
  openLabel?: string;
  className?: string;
};

/**
 * One Library / gallery card. Every tile has the same frame so a grid of mixed sizes
 * stays aligned; the art keeps its real shape inside (story tall, Facebook wide).
 */
export function MarketingTile({
  art,
  name,
  meta,
  badges,
  corner,
  menu,
  onOpen,
  selectable = false,
  selected = false,
  onToggleSelect,
  active = false,
  watermarked = false,
  onIntent,
  openLabel,
  className,
}: Props) {
  const handleActivate = () => {
    if (selectable) onToggleSelect?.();
    else onOpen();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === ' ' && selectable) {
      event.preventDefault();
      onToggleSelect?.();
    }
  };

  return (
    <div className={cn('group relative flex min-w-0 flex-col gap-1.5', className)}>
      <button
        type="button"
        onClick={handleActivate}
        onKeyDown={handleKeyDown}
        onPointerEnter={onIntent}
        onFocus={onIntent}
        aria-label={
          selectable ? `${selected ? 'Deselect' : 'Select'} ${name}` : (openLabel ?? name)
        }
        aria-pressed={selectable ? selected : undefined}
        className={cn(
          'relative block aspect-[4/5] w-full overflow-hidden rounded-xl',
          'bg-muted/60 dark:bg-muted/30',
          'ring-border/70 ring-1 transition-[box-shadow,transform] duration-200',
          'focus-visible:ring-primary focus-visible:outline-none focus-visible:ring-2',
          'native-press hover:ring-primary/40 hover:shadow-md',
          (active || selected) && 'ring-primary ring-2'
        )}
      >
        <span className="absolute inset-2.5 flex items-center justify-center sm:inset-3">
          <span className="pointer-events-none flex size-full items-center justify-center overflow-hidden rounded-md [&>*]:max-h-full [&>*]:max-w-full">
            {art}
          </span>
        </span>
        {watermarked ? <PlanGateWatermarkPattern compact /> : null}
        {badges ? (
          <span className="pointer-events-none absolute bottom-1.5 left-1.5 flex flex-wrap gap-1">
            {badges}
          </span>
        ) : null}
        {corner ? (
          <span className="pointer-events-none absolute right-1.5 top-1.5">{corner}</span>
        ) : null}
        {selectable ? (
          <span
            className={cn(
              'absolute left-1.5 top-1.5 flex size-6 items-center justify-center rounded-full border-2 shadow-sm',
              selected
                ? 'bg-primary-strong border-primary text-primary-foreground'
                : 'border-white bg-black/20'
            )}
            aria-hidden
          >
            {selected ? <Check className="size-3.5" strokeWidth={3} /> : null}
          </span>
        ) : null}
      </button>
      <div className="flex min-w-0 items-start gap-1">
        <div className="min-w-0 flex-1 px-0.5">
          <p className="text-foreground truncate text-[13px] font-medium leading-tight">{name}</p>
          {meta ? (
            <p className="text-muted-foreground mt-0.5 truncate text-[11px] leading-tight">
              {meta}
            </p>
          ) : null}
        </div>
        {menu && !selectable ? <div className="-mr-1 -mt-1 shrink-0">{menu}</div> : null}
      </div>
    </div>
  );
}

/** Small dark chip over tile art. */
export function MarketingTileChip({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-md bg-black/60 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-white backdrop-blur-sm">
      {children}
    </span>
  );
}
