import { Skeleton } from '@/components/ui/skeleton';

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
