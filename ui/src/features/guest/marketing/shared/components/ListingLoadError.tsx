import { Button } from '@/components/ui/button';

type Props = {
  noun: string;
  onRetry: () => void;
  retrying?: boolean;
};

/** Main-column error state for a failed listing fetch, with retry. */
export function ListingLoadError({ noun, onRetry, retrying }: Props) {
  return (
    <div className="flex flex-col items-center gap-3 py-16 text-center" role="alert">
      <p className="text-muted-foreground text-sm">Could not load {noun}.</p>
      <Button
        type="button"
        variant="outline"
        className="min-h-[44px]"
        disabled={retrying}
        onClick={onRetry}
      >
        Try again
      </Button>
    </div>
  );
}
