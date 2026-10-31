import type { ReactNode } from 'react';

type Props = {
  leading?: ReactNode;
  actions?: ReactNode;
};

export function MarketingPreviewHeader({ leading, actions }: Props) {
  if (!leading && !actions) {
    // Nothing to show — a full 44px separator bar just wastes mobile height.
    return (
      <div className="border-border bg-card border-b max-lg:hidden lg:min-h-[44px]" aria-hidden />
    );
  }

  return (
    <div className="border-border bg-card flex min-h-[44px] items-center justify-between gap-2 border-b px-3 py-2 sm:px-4">
      {leading ? (
        <div className="flex min-w-0 flex-1 items-center gap-2">{leading}</div>
      ) : (
        <span aria-hidden />
      )}
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  );
}
