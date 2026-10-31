import type { HelpSupportSection } from '@/features/dashboard/help-support/lib/helpSupportPaths';

import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

/** Help documentation topic list (icon + title + description rows). */
export function HelpDocumentationTopicsSkeleton() {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Loading guides">
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="border-border/50 flex items-start gap-3 rounded-xl border p-4"
          style={{ opacity: 1 - i * 0.08 }}
        >
          <Skeleton className="size-10 shrink-0 rounded-lg" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-4 w-40 max-w-full" />
            <Skeleton className="h-3 w-full max-w-md" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** `HelpSupportModuleNav`: four StatCard tiles, 2×2 below xl. */
function HelpSupportModuleNavSkeleton() {
  return (
    <div
      className={cn(
        'flex flex-wrap justify-center gap-3 xl:gap-4',
        '[&>*]:min-w-[9.25rem] [&>*]:max-w-[calc((100%-0.75rem)/2)] [&>*]:flex-[1_1_calc((100%-0.75rem)/2)]',
        'xl:[&>*]:min-w-0 xl:[&>*]:max-w-[calc((100%-3rem)/4)] xl:[&>*]:flex-[1_1_calc((100%-3rem)/4)]'
      )}
      aria-hidden
    >
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="surface-card h-full p-3 sm:p-3.5 md:p-4">
          <div className="flex items-start justify-between gap-2.5 sm:gap-3">
            <div className="min-w-0 flex-1 space-y-1.5 sm:space-y-2">
              <Skeleton className="h-3 w-14 sm:h-4" />
              <div className="min-h-[2.5rem] space-y-1.5 sm:min-h-[2.75rem]">
                <Skeleton className="h-4 w-4/5" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            </div>
            <Skeleton className="hidden size-8 shrink-0 rounded-lg sm:size-10 sm:rounded-xl lg:block" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Content under the section intro: FAQ / guide rows in a card, or the tickets workspace. */
export function HelpSupportSectionSkeleton({ section }: { section: HelpSupportSection }) {
  if (section === 'tickets') {
    return (
      <div
        className="border-border/80 bg-card flex min-h-[20rem] overflow-hidden rounded-xl border shadow-sm lg:min-h-[480px]"
        aria-busy="true"
        aria-label="Loading tickets"
      >
        <div className="border-border/80 flex w-full flex-col lg:w-[min(100%,400px)] lg:border-r">
          <div className="flex items-center justify-between gap-3 border-b px-3 py-2.5">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-11 w-16 rounded-md sm:h-9" />
          </div>
          <div className="space-y-1 p-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" style={{ opacity: 1 - i * 0.08 }} />
            ))}
          </div>
        </div>
        <div className="hidden flex-1 lg:block" />
      </div>
    );
  }

  return (
    <Card
      className="overflow-hidden"
      aria-busy="true"
      aria-label={section === 'guides' ? 'Loading guides' : 'Loading FAQs'}
    >
      <div className="px-4 sm:px-5">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="my-3 h-12 w-full" style={{ opacity: 1 - i * 0.08 }} />
        ))}
      </div>
    </Card>
  );
}

/** Help & Support body: module nav, centered section intro, then section content. */
export function HelpSupportPageSkeleton({ section }: { section: HelpSupportSection }) {
  return (
    <div className="flex min-w-0 flex-col gap-5 sm:gap-6">
      <HelpSupportModuleNavSkeleton />
      <div className="flex min-w-0 flex-col gap-3 sm:gap-4">
        <div className="flex flex-col items-center gap-1.5 px-1" aria-hidden>
          <Skeleton className="h-6 w-24 sm:h-7" />
          <Skeleton className="h-4 w-64 max-w-full sm:h-5" />
        </div>
        <HelpSupportSectionSkeleton section={section} />
      </div>
    </div>
  );
}
