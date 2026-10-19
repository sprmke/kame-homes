import { AlertCircle } from 'lucide-react';

type Props = {
  message?: string;
  onRetry: () => void;
  retrying?: boolean;
};

export function SearchErrorState({
  message = 'Search failed. Check your connection and try again.',
  onRetry,
  retrying = false,
}: Props) {
  return (
    <div
      className="border-destructive/30 bg-destructive/5 flex flex-col items-center justify-center rounded-2xl border px-4 py-16 text-center sm:py-20"
      role="alert"
    >
      <span className="bg-destructive/10 text-destructive mb-5 flex size-14 items-center justify-center rounded-2xl">
        <AlertCircle className="h-6 w-6" aria-hidden />
      </span>
      <h2 className="text-foreground text-base font-semibold sm:text-lg">Couldn’t load results</h2>
      <p className="text-muted-foreground mt-2 max-w-md text-sm leading-relaxed">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        disabled={retrying}
        className="bg-primary-strong text-primary-foreground hover:bg-primary-strong/90 mt-5 min-h-[44px] cursor-pointer rounded-full px-5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
      >
        {retrying ? 'Retrying…' : 'Try again'}
      </button>
    </div>
  );
}
