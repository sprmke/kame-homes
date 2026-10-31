import { useMemo } from 'react';

import { formatDistanceToNow } from 'date-fns';
import { ChevronLeft } from 'lucide-react';

import { useMarketingPublications } from '@/features/dashboard/marketing/lib/marketingPublishApi';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

function statusVariant(status: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (status === 'published') return 'default';
  if (status === 'failed') return 'destructive';
  return 'secondary';
}

/**
 * Recent publishes view: one of the two history views a Marketing tab can show in
 * place of its grid (the other is Recently deleted). Property-wide, so every tab
 * opens the same list.
 */
export function PublishHistory({ onBack }: { onBack?: () => void }) {
  const { data, isLoading } = useMarketingPublications();

  const publishedCount = useMemo(
    () => (data ?? []).filter((row) => row.status === 'published').length,
    [data]
  );

  return (
    <section className="space-y-3" aria-label="Recent publishes">
      <div className="flex min-h-11 items-center gap-1">
        {onBack ? (
          <>
            <Button
              type="button"
              variant="ghost"
              className="-ml-2 min-h-11 shrink-0 gap-1 px-2"
              onClick={onBack}
            >
              <ChevronLeft className="size-4" aria-hidden />
              Back
            </Button>
            <span className="bg-border h-5 w-px shrink-0" aria-hidden />
          </>
        ) : null}
        <h2 className="text-section-title min-w-0 truncate">Recent publishes</h2>
        {data?.length ? (
          <span className="text-muted-foreground ml-auto shrink-0 text-xs font-medium tabular-nums">
            {publishedCount} published
          </span>
        ) : null}
      </div>

      {isLoading ? (
        <ul className="space-y-2" aria-busy="true" aria-label="Loading recent publishes">
          {Array.from({ length: 4 }).map((_, index) => (
            <li
              key={index}
              className="border-border flex items-center justify-between gap-3 rounded-xl border px-3 py-2.5"
            >
              <div className="min-w-0 flex-1 space-y-1.5">
                <Skeleton className="h-3.5 w-36" />
                <Skeleton className="h-3 w-52 max-w-full" />
              </div>
              <Skeleton className="h-5 w-16 shrink-0 rounded-full" />
            </li>
          ))}
        </ul>
      ) : !data?.length ? (
        <div className="border-border rounded-xl border border-dashed p-6 text-center">
          <p className="text-muted-foreground text-sm">Nothing published yet.</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {data.map((row) => (
            <li
              key={row.id}
              className="border-border bg-card flex flex-wrap items-start justify-between gap-2 rounded-xl border px-3 py-2.5"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm capitalize">
                  {row.platform} · {row.publishType}
                </p>
                {row.caption ? (
                  <p className="text-muted-foreground line-clamp-2 text-xs">{row.caption}</p>
                ) : null}
                {row.errorMessage ? (
                  <p className="text-destructive text-xs">{row.errorMessage}</p>
                ) : null}
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <Badge variant={statusVariant(row.status)} className="capitalize">
                  {row.status}
                </Badge>
                <span className="text-muted-foreground text-[11px]">
                  {formatDistanceToNow(new Date(row.createdAt), { addSuffix: true })}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
