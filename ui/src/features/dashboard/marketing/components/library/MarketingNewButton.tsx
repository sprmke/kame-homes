import { ChevronDown, Plus, Sparkles } from 'lucide-react';

import { TierBadgeAnchor } from '@/features/dashboard/plans/components/TierBadge';

import { ResponsiveOverflowMenu } from '@/components/mobile/ResponsiveOverflowMenu';
import { Button } from '@/components/ui/button';

type Size = { value: string; label: string; width: number; height: number };

type Props = {
  noun: string;
  sizes: readonly Size[];
  /** Opens the template gallery, at a size when one was picked from the menu. */
  onNew: (size?: string) => void;
  /** "Create with AI" (hidden when the role cannot generate). */
  onCreateWithAi?: () => void;
};

/**
 * The create row at the top of every Library: one split button for a new item (the
 * menu half picks the size first) and Create with AI beside it.
 */
export function MarketingNewButton({ noun, sizes, onNew, onCreateWithAi }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex">
        <Button
          type="button"
          className="min-h-[44px] gap-2 rounded-r-none pr-3.5 lg:min-h-10"
          onClick={() => onNew()}
        >
          <Plus className="size-4" aria-hidden />
          New {noun}
        </Button>
        <ResponsiveOverflowMenu
          label={`New ${noun} in a size`}
          sheetTitle={`New ${noun}`}
          actionGroups={[
            sizes.map((size) => ({
              key: size.value,
              label: size.label,
              icon: <SizeGlyph width={size.width} height={size.height} />,
              onSelect: () => onNew(size.value),
            })),
          ]}
          trigger={
            <Button
              type="button"
              className="border-primary-foreground/25 min-h-[44px] rounded-l-none border-l px-2.5 lg:min-h-10"
              aria-label={`New ${noun} in a size`}
            >
              <ChevronDown className="size-4" aria-hidden />
            </Button>
          }
        />
      </div>
      {onCreateWithAi ? (
        <TierBadgeAnchor feature="aiMarketingGeneration">
          <Button
            type="button"
            variant="outline"
            className="min-h-[44px] gap-2 lg:min-h-10"
            onClick={onCreateWithAi}
          >
            <Sparkles className="size-4" aria-hidden />
            Create with AI
          </Button>
        </TierBadgeAnchor>
      ) : null}
    </div>
  );
}

/** Outline of a canvas shape (square, tall, wide), centered in a fixed box. */
export function SizeGlyph({ width, height }: { width: number; height: number }) {
  const max = 13;
  const ratio = width / Math.max(height, 1);
  const w = ratio >= 1 ? max : Math.max(7, Math.round(max * ratio));
  const h = ratio >= 1 ? Math.max(7, Math.round(max / ratio)) : max;
  return (
    <span className="inline-flex size-4 shrink-0 items-center justify-center" aria-hidden>
      <span
        className="rounded-[2px] border-[1.5px] border-current"
        style={{ width: w, height: h }}
      />
    </span>
  );
}
