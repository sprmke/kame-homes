import { Skeleton } from '@/components/ui/skeleton';

/** AI assistant slide-over while the panel chunk loads. */
export function AiAssistantPanelSkeleton() {
  return (
    <div
      className="flex h-full min-h-[20rem] flex-col gap-3 p-4"
      aria-busy="true"
      aria-label="Loading assistant"
    >
      <div className="flex items-center gap-2 border-b pb-3">
        <Skeleton className="size-8 rounded-lg" />
        <Skeleton className="h-4 w-28" />
      </div>
      <div className="flex flex-1 flex-col gap-2 py-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton
            key={i}
            className={`h-12 max-w-[90%] rounded-2xl ${i % 2 === 0 ? 'mr-auto w-[75%]' : 'ml-auto w-[65%]'}`}
          />
        ))}
      </div>
      <Skeleton className="h-11 w-full rounded-xl" />
    </div>
  );
}
