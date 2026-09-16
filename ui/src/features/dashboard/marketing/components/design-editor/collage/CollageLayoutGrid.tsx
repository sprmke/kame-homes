import { useMemo, useState } from 'react';

import {
  collageLayoutsForCellCount,
  type CollageLayout,
} from '@/features/dashboard/marketing/lib/collage/collageLayouts';

import { cn } from '@/lib/utils';

const CELL_COUNT_FILTERS: Array<{ value: number | null; label: string }> = [
  { value: null, label: 'All' },
  { value: 2, label: '2' },
  { value: 3, label: '3' },
  { value: 4, label: '4' },
  { value: 5, label: '5+' },
];

const CELL_GAP = 4;
const CELL_RADIUS = 3;

function LayoutThumbnail({ layout }: { layout: CollageLayout }) {
  return (
    <svg viewBox="0 0 100 100" className="h-full w-full" aria-hidden>
      <rect x={0} y={0} width={100} height={100} rx={6} className="fill-muted" />
      {layout.cells.map((cell, index) => {
        const x = cell.xr * 100 + CELL_GAP / 2;
        const y = cell.yr * 100 + CELL_GAP / 2;
        const width = Math.max(1, cell.wr * 100 - CELL_GAP);
        const height = Math.max(1, cell.hr * 100 - CELL_GAP);
        return (
          <rect
            key={index}
            x={x}
            y={y}
            width={width}
            height={height}
            rx={CELL_RADIUS}
            className="fill-foreground/25"
          />
        );
      })}
    </svg>
  );
}

type Props = {
  selectedLayoutId: string | null;
  onSelect: (layoutId: string) => void;
};

export function CollageLayoutGrid({ selectedLayoutId, onSelect }: Props) {
  const [cellFilter, setCellFilter] = useState<number | null>(null);
  const layouts = useMemo(() => collageLayoutsForCellCount(cellFilter), [cellFilter]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by cell count">
        {CELL_COUNT_FILTERS.map((filter) => (
          <button
            key={filter.label}
            type="button"
            aria-pressed={cellFilter === filter.value}
            className={cn(
              'min-h-[36px] rounded-full border px-2.5 text-xs font-medium transition-colors',
              cellFilter === filter.value
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border text-muted-foreground hover:text-foreground'
            )}
            onClick={() => setCellFilter(filter.value)}
          >
            {filter.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-4 gap-2 lg:grid-cols-3">
        {layouts.map((layout) => (
          <button
            key={layout.id}
            type="button"
            aria-pressed={selectedLayoutId === layout.id}
            title={layout.name}
            className={cn(
              'border-border bg-card flex min-h-[44px] flex-col items-center gap-1 rounded-lg border p-1.5 transition-colors',
              selectedLayoutId === layout.id
                ? 'border-primary ring-primary/30 ring-2'
                : 'hover:border-foreground/30'
            )}
            onClick={() => onSelect(layout.id)}
          >
            <div className="aspect-square w-full">
              <LayoutThumbnail layout={layout} />
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
