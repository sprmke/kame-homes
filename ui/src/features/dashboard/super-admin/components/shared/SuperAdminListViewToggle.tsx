import { Grid3X3, Table2 } from 'lucide-react';

import type { SuperAdminListViewMode } from '@/features/dashboard/super-admin/lib/superAdminListViewMode';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type Props = {
  viewMode: SuperAdminListViewMode;
  onViewModeChange: (mode: SuperAdminListViewMode) => void;
  className?: string;
  /** Hide table option on mobile layouts that force grid. */
  hideTableView?: boolean;
};

export function SuperAdminListViewToggle({
  viewMode,
  onViewModeChange,
  className,
  hideTableView = false,
}: Props) {
  if (hideTableView) {
    return null;
  }

  return (
    <div
      className={cn(
        'border-border/50 bg-card flex shrink-0 items-center gap-1 rounded-xl border px-1 shadow-sm',
        className
      )}
      role="group"
      aria-label="View mode"
    >
      <Button
        type="button"
        variant={viewMode === 'table' ? 'secondary' : 'ghost'}
        size="icon"
        className="min-h-[44px] min-w-[44px]"
        onClick={() => onViewModeChange('table')}
        aria-pressed={viewMode === 'table'}
        aria-label="Table view"
      >
        <Table2 className="size-4" aria-hidden />
      </Button>
      <Button
        type="button"
        variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
        size="icon"
        className="min-h-[44px] min-w-[44px]"
        onClick={() => onViewModeChange('grid')}
        aria-pressed={viewMode === 'grid'}
        aria-label="Grid view"
      >
        <Grid3X3 className="size-4" aria-hidden />
      </Button>
    </div>
  );
}
