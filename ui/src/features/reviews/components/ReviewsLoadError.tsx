import { Button } from '@/components/ui/button';

type Props = {
  onRetry: () => void;
};

/** Data-region error for the host / org Reviews pages; page chrome stays mounted. */
export function ReviewsLoadError({ onRetry }: Props) {
  return (
    <div
      role="alert"
      className="border-border bg-card flex flex-col items-center gap-3 rounded-xl border px-4 py-8 text-center"
    >
      <p className="text-sm">Could not load reviews</p>
      <Button type="button" variant="outline" className="min-h-[44px]" onClick={onRetry}>
        Try again
      </Button>
    </div>
  );
}
