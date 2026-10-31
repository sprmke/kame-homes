import {
  templateDetailPanelClassName,
  templatePanelClassName,
  templateRailPanelClassName,
  templateWorkbenchShellClassName,
} from '@/features/dashboard/bookings/lib/templateWorkbenchChrome';

import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

function RailRowSkeleton() {
  return (
    <div className="flex min-h-[52px] items-center gap-2.5 py-2 pl-2.5 pr-1.5">
      <Skeleton className="size-8 shrink-0 rounded-md" />
      <div className="min-w-0 flex-1 space-y-1.5">
        <Skeleton className="h-3.5 w-32 max-w-full" />
        <Skeleton className="h-3 w-20 max-w-full" />
      </div>
    </div>
  );
}

function RailGroupSkeleton({ rows, labelWidth }: { rows: number; labelWidth: string }) {
  return (
    <div>
      <div className="flex min-h-[32px] items-center pb-1 pl-2.5 pr-1 pt-3 first:pt-1">
        <Skeleton className={cn('h-3', labelWidth)} />
      </div>
      {Array.from({ length: rows }).map((_, index) => (
        <RailRowSkeleton key={index} />
      ))}
    </div>
  );
}

/**
 * Mirrors the loaded Templates workbench: library rail beside one editor pane,
 * with the rail's search field and grouped rows in place.
 * Below `lg` only the rail shows, matching the list-first phone layout.
 *
 * The rail uses the same `self-start` sizing as the real panel, so the loading
 * card does not stretch to the editor's height and then collapse on load.
 */
export function TemplateWorkbenchSkeleton() {
  return (
    <div
      className={templateWorkbenchShellClassName}
      aria-busy="true"
      aria-label="Loading templates"
    >
      <div
        className={cn(templatePanelClassName, 'flex-1 lg:flex-none', templateRailPanelClassName)}
      >
        <div className="flex min-h-0 flex-1 flex-col p-2">
          <div className="shrink-0 px-0.5 pb-2">
            <Skeleton className="h-10 w-full rounded-lg" />
          </div>
          <div className="min-h-0 flex-1 overflow-hidden px-0.5 pb-1">
            <RailGroupSkeleton rows={4} labelWidth="w-20" />
            <RailGroupSkeleton rows={3} labelWidth="w-24" />
            <RailGroupSkeleton rows={2} labelWidth="w-16" />
          </div>
        </div>
      </div>

      <div
        className={cn(
          templatePanelClassName,
          'hidden flex-1 lg:flex',
          templateDetailPanelClassName
        )}
      >
        <div className="border-separator shrink-0 border-b">
          <div className="flex items-start gap-3 px-4 pb-2.5 pt-3">
            <Skeleton className="size-10 shrink-0 rounded-lg" />
            <div className="min-w-0 flex-1 space-y-1.5">
              <Skeleton className="h-4 w-40 max-w-full" />
              <Skeleton className="h-3 w-56 max-w-full" />
            </div>
          </div>
          <div className="flex items-center justify-between gap-2 px-4 pb-2">
            <Skeleton className="h-7 w-28 rounded-lg" />
            <div className="flex items-center gap-1.5">
              <Skeleton className="h-8 w-28 rounded-lg" />
              <Skeleton className="h-8 w-20 rounded-lg" />
            </div>
          </div>
        </div>
        <div className="min-h-0 flex-1 p-4">
          <Skeleton className="h-full min-h-[280px] w-full rounded-lg" />
        </div>
      </div>
    </div>
  );
}
